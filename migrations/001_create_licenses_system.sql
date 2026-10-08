-- ==============================================================================
-- MIGRACIÓN 001: SISTEMA Y MOTOR DE LICENCIAS DE SOFTWARE (SUPABASE / POSTGRESQL)
-- ==============================================================================
-- Compatible con Supabase PostgreSQL 15+
-- Incluye: Tablas relacionales, restricciones de integridad, índices B-Tree
-- y funciones RPC atómicas para gestión concurrente de cupos (seats/activations).
-- ==============================================================================

-- Habilitar extensión pgcrypto / uuid-ossp si no estuviese habilitada
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. TABLA: licenses
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_key VARCHAR(64) UNIQUE NOT NULL,
    customer_id UUID NULL,
    plan_tier VARCHAR(32) NOT NULL DEFAULT 'standard' CHECK (plan_tier IN ('standard', 'pro', 'enterprise')),
    status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'expired')),
    max_activations INT NOT NULL DEFAULT 1 CHECK (max_activations >= 1),
    current_activations INT NOT NULL DEFAULT 0 CHECK (current_activations >= 0),
    expires_at TIMESTAMPTZ NULL, -- NULL indica licencia perpetua (sin vencimiento)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 2. TABLA: license_activations
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.license_activations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_id UUID NOT NULL REFERENCES public.licenses(id) ON DELETE CASCADE,
    device_fingerprint VARCHAR(128) NOT NULL,
    device_name VARCHAR(128) NULL,
    ip_address VARCHAR(64) NULL,
    last_ping_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_license_device UNIQUE (license_id, device_fingerprint)
);

-- ------------------------------------------------------------------------------
-- 3. ÍNDICES DE ALTO RENDIMIENTO
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_licenses_key ON public.licenses(license_key);
CREATE INDEX IF NOT EXISTS idx_licenses_status ON public.licenses(status);
CREATE INDEX IF NOT EXISTS idx_activations_fingerprint ON public.license_activations(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_activations_license_id ON public.license_activations(license_id);
CREATE INDEX IF NOT EXISTS idx_activations_last_ping ON public.license_activations(last_ping_at);

-- ------------------------------------------------------------------------------
-- 4. TRIGGER: ACTUALIZACIÓN AUTOMÁTICA DE updated_at EN licenses
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_licenses_updated_at ON public.licenses;
CREATE TRIGGER trg_licenses_updated_at
BEFORE UPDATE ON public.licenses
FOR EACH ROW
EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- ------------------------------------------------------------------------------
-- 5. FUNCIÓN RPC ATÓMICA: activate_license_device
-- Realiza el registro del dispositivo e incremento atómico de cupo sin race conditions.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_activate_license_device(
    p_license_key VARCHAR,
    p_device_fingerprint VARCHAR,
    p_device_name VARCHAR DEFAULT NULL,
    p_ip_address VARCHAR DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_lic RECORD;
    v_existing_activation UUID;
    v_new_activation UUID;
BEGIN
    -- 1. Buscar y bloquear fila de licencia para concurrencia segura
    SELECT * INTO v_lic
    FROM public.licenses
    WHERE license_key = p_license_key
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'code', 'LICENSE_NOT_FOUND', 'message', 'La clave de licencia no existe.');
    END IF;

    -- 2. Validar estado de la licencia
    IF v_lic.status <> 'active' THEN
        RETURN jsonb_build_object('success', false, 'code', 'LICENSE_INACTIVE', 'message', 'La licencia se encuentra suspendida o inactiva.');
    END IF;

    -- 3. Validar vigencia temporal si no es perpetua
    IF v_lic.expires_at IS NOT NULL AND v_lic.expires_at < NOW() THEN
        RETURN jsonb_build_object('success', false, 'code', 'LICENSE_EXPIRED', 'message', 'La vigencia de la licencia ha expirado.');
    END IF;

    -- 4. Verificar si el dispositivo ya está registrado (Reactivación / Renovación)
    SELECT id INTO v_existing_activation
    FROM public.license_activations
    WHERE license_id = v_lic.id AND device_fingerprint = p_device_fingerprint;

    IF FOUND THEN
        -- Actualizar último ping y metadatos sin consumir cupo adicional
        UPDATE public.license_activations
        SET last_ping_at = NOW(),
            device_name = COALESCE(p_device_name, device_name),
            ip_address = COALESCE(p_ip_address, ip_address)
        WHERE id = v_existing_activation;

        RETURN jsonb_build_object(
            'success', true,
            'code', 'DEVICE_REACTIVATED',
            'message', 'Dispositivo reactivado exitosamente.',
            'license_id', v_lic.id,
            'plan_tier', v_lic.plan_tier,
            'max_activations', v_lic.max_activations,
            'current_activations', v_lic.current_activations,
            'expires_at', v_lic.expires_at
        );
    END IF;

    -- 5. Validar cupos disponibles para dispositivo nuevo
    IF v_lic.current_activations >= v_lic.max_activations THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'MAX_ACTIVATIONS_REACHED',
            'message', 'Se ha alcanzado el límite máximo de activaciones permitidas para esta licencia.',
            'max_activations', v_lic.max_activations,
            'current_activations', v_lic.current_activations
        );
    END IF;

    -- 6. Insertar nueva activación
    INSERT INTO public.license_activations (license_id, device_fingerprint, device_name, ip_address, last_ping_at)
    VALUES (v_lic.id, p_device_fingerprint, p_device_name, p_ip_address, NOW())
    RETURNING id INTO v_new_activation;

    -- 7. Incrementar contador atómico
    UPDATE public.licenses
    SET current_activations = current_activations + 1
    WHERE id = v_lic.id;

    RETURN jsonb_build_object(
        'success', true,
        'code', 'DEVICE_ACTIVATED',
        'message', 'Dispositivo activado y vinculado correctamente.',
        'license_id', v_lic.id,
        'activation_id', v_new_activation,
        'plan_tier', v_lic.plan_tier,
        'max_activations', v_lic.max_activations,
        'current_activations', v_lic.current_activations + 1,
        'expires_at', v_lic.expires_at
    );
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 6. FUNCIÓN RPC ATÓMICA: deactivate_license_device
-- Desvincula un dispositivo y decrementa el contador de activaciones.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_deactivate_license_device(
    p_license_key VARCHAR,
    p_device_fingerprint VARCHAR
)
RETURNS JSONB AS $$
DECLARE
    v_lic RECORD;
    v_act_id UUID;
BEGIN
    SELECT * INTO v_lic
    FROM public.licenses
    WHERE license_key = p_license_key
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'code', 'LICENSE_NOT_FOUND', 'message', 'La clave de licencia no existe.');
    END IF;

    SELECT id INTO v_act_id
    FROM public.license_activations
    WHERE license_id = v_lic.id AND device_fingerprint = p_device_fingerprint;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'code', 'DEVICE_NOT_FOUND', 'message', 'El dispositivo no se encuentra vinculado a esta licencia.');
    END IF;

    -- Eliminar activación
    DELETE FROM public.license_activations WHERE id = v_act_id;

    -- Decrementar contador (asegurando no ser menor a 0)
    UPDATE public.licenses
    SET current_activations = GREATEST(0, current_activations - 1)
    WHERE id = v_lic.id;

    RETURN jsonb_build_object(
        'success', true,
        'code', 'DEVICE_DEACTIVATED',
        'message', 'Dispositivo desvinculado exitosamente.',
        'license_id', v_lic.id,
        'current_activations', GREATEST(0, v_lic.current_activations - 1)
    );
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 7. POLÍTICAS DE ROW LEVEL SECURITY (RLS)
-- ------------------------------------------------------------------------------
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.license_activations ENABLE ROW LEVEL SECURITY;

-- Por defecto el Service Role (Backend en Render) tiene acceso total sin bypass
CREATE POLICY service_role_all_licenses ON public.licenses
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY service_role_all_activations ON public.license_activations
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
