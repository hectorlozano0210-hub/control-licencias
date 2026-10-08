-- ==============================================================================
-- COREAUTH & LICENSE HUB - SUPABASE RELATIONAL SCHEMA & SECURITY ENGINE
-- Version: 1.0.0 (Production Grade)
-- PostgreSQL / Supabase Compatible
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. CUSTOM TYPES & ENUMS
DO $$ BEGIN
    CREATE TYPE license_status AS ENUM ('active', 'paused', 'expired', 'revoked');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE company_status AS ENUM ('active', 'suspended', 'trial');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM ('pending', 'succeeded', 'failed', 'refunded');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE log_event_type AS ENUM (
        'activate_attempt',
        'activate_success',
        'activate_fraud_blocked',
        'verify_success',
        'verify_failed',
        'heartbeat_success',
        'heartbeat_timeout',
        'device_deactivated',
        'license_renewed',
        'license_suspended',
        'license_revoked'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. UPDATED_AT TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION update_timestamp_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- 4. TABLES DEFINITIONS
-- ==============================================================================

-- 4.1 COMPANIES / CLIENTES
CREATE TABLE IF NOT EXISTS public.companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    nit_rut VARCHAR(64) NOT NULL UNIQUE,
    legal_name VARCHAR(255),
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(64),
    status company_status NOT NULL DEFAULT 'active',
    billing_address JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_companies_nit_rut ON public.companies(nit_rut);
CREATE INDEX IF NOT EXISTS idx_companies_status ON public.companies(status);

CREATE TRIGGER trg_companies_updated_at
BEFORE UPDATE ON public.companies
FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

-- 4.2 APPLICATIONS (CATÁLOGO DE PRODUCTOS / APPS)
CREATE TABLE IF NOT EXISTS public.apps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(64) NOT NULL UNIQUE, -- ej: 'control-horarios', 'cotizador-pro'
    name VARCHAR(255) NOT NULL,
    description TEXT,
    app_secret_hash TEXT NOT NULL, -- Hash de API secret para comunicación backend a backend
    public_signing_key TEXT, -- Llave pública ECDSA / Ed25519 para verificación en cliente
    current_version VARCHAR(32) NOT NULL DEFAULT '1.0.0',
    min_supported_version VARCHAR(32) NOT NULL DEFAULT '1.0.0',
    webhook_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_apps_slug ON public.apps(slug);

CREATE TRIGGER trg_apps_updated_at
BEFORE UPDATE ON public.apps
FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

-- 4.3 LICENSES & SEATS (LICENCIAS Y CUPOS)
CREATE TABLE IF NOT EXISTS public.licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_key VARCHAR(64) NOT NULL UNIQUE, -- Formato: PROD-XXXX-XXXX-XXXX-XXXX
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    app_id UUID NOT NULL REFERENCES public.apps(id) ON DELETE RESTRICT,
    plan_tier VARCHAR(64) NOT NULL DEFAULT 'Enterprise',
    max_seats INT NOT NULL DEFAULT 1 CHECK (max_seats >= 1),
    current_seats INT NOT NULL DEFAULT 0 CHECK (current_seats >= 0),
    status license_status NOT NULL DEFAULT 'active',
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    activated_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,
    grace_period_days INT NOT NULL DEFAULT 3,
    auto_renew BOOLEAN NOT NULL DEFAULT TRUE,
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_licenses_key ON public.licenses(license_key);
CREATE INDEX IF NOT EXISTS idx_licenses_company_id ON public.licenses(company_id);
CREATE INDEX IF NOT EXISTS idx_licenses_app_id ON public.licenses(app_id);
CREATE INDEX IF NOT EXISTS idx_licenses_status ON public.licenses(status);
CREATE INDEX IF NOT EXISTS idx_licenses_expires_at ON public.licenses(expires_at);

CREATE TRIGGER trg_licenses_updated_at
BEFORE UPDATE ON public.licenses
FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

-- 4.4 ACTIVATED DEVICES (EQUIPOS VINCULADOS / HARDWARE LOCKING)
CREATE TABLE IF NOT EXISTS public.activated_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_id UUID NOT NULL REFERENCES public.licenses(id) ON DELETE CASCADE,
    machine_fingerprint VARCHAR(128) NOT NULL, -- SHA256(CPU_ID + MB_SERIAL + PRIMARY_MAC)
    device_name VARCHAR(255) NOT NULL,
    os_info VARCHAR(255),
    app_version VARCHAR(32) NOT NULL,
    ip_address INET,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    heartbeat_count BIGINT NOT NULL DEFAULT 1,
    metadata JSONB DEFAULT '{}'::jsonb,
    CONSTRAINT uq_license_device UNIQUE (license_id, machine_fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_devices_license_id ON public.activated_devices(license_id);
CREATE INDEX IF NOT EXISTS idx_devices_machine_fingerprint ON public.activated_devices(machine_fingerprint);
CREATE INDEX IF NOT EXISTS idx_devices_last_heartbeat ON public.activated_devices(last_heartbeat_at);
CREATE INDEX IF NOT EXISTS idx_devices_is_active ON public.activated_devices(is_active);

-- 4.5 LICENSE LOGS (AUDITORÍA Y TELEMETRÍA DE FRAUDE)
CREATE TABLE IF NOT EXISTS public.license_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_id UUID REFERENCES public.licenses(id) ON DELETE SET NULL,
    app_id UUID REFERENCES public.apps(id) ON DELETE SET NULL,
    event_type log_event_type NOT NULL,
    machine_fingerprint VARCHAR(128),
    device_name VARCHAR(255),
    ip_address INET,
    app_version VARCHAR(32),
    success BOOLEAN NOT NULL DEFAULT TRUE,
    message TEXT,
    payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_logs_license_id ON public.license_logs(license_id);
CREATE INDEX IF NOT EXISTS idx_logs_event_type ON public.license_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON public.license_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_fingerprint ON public.license_logs(machine_fingerprint);

-- 4.6 PAYMENTS & SUBSCRIPTION BILLING
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    license_id UUID REFERENCES public.licenses(id) ON DELETE SET NULL,
    payment_provider VARCHAR(64) NOT NULL DEFAULT 'stripe', -- 'stripe', 'mercadopago', 'wire'
    external_transaction_id VARCHAR(255) UNIQUE,
    amount NUMERIC(12, 2) NOT NULL,
    currency VARCHAR(8) NOT NULL DEFAULT 'USD',
    status payment_status NOT NULL DEFAULT 'pending',
    payment_method VARCHAR(64),
    invoice_url TEXT,
    period_start TIMESTAMPTZ,
    period_end TIMESTAMPTZ,
    raw_webhook_payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_company_id ON public.payments(company_id);
CREATE INDEX IF NOT EXISTS idx_payments_license_id ON public.payments(license_id);
CREATE INDEX IF NOT EXISTS idx_payments_external_tx ON public.payments(external_transaction_id);

CREATE TRIGGER trg_payments_updated_at
BEFORE UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

-- ==============================================================================
-- 5. RPC PROCEDURES (ALTA CONCURRENCIA, CONTROL TRANSACCIONAL Y ANTI-RACE CONDITION)
-- ==============================================================================

-- 5.1 RPC: ACTIVACIÓN ATÓMICA DE DISPOSITIVO CON ROW LOCKING
CREATE OR REPLACE FUNCTION rpc_activate_device(
    p_license_key VARCHAR(64),
    p_app_slug VARCHAR(64),
    p_machine_fingerprint VARCHAR(128),
    p_device_name VARCHAR(255),
    p_os_info VARCHAR(255),
    p_app_version VARCHAR(32),
    p_ip_address INET
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_license RECORD;
    v_app RECORD;
    v_existing_device RECORD;
    v_active_device_count INT;
    v_result JSONB;
BEGIN
    -- 1. Validar App
    SELECT * INTO v_app FROM public.apps WHERE slug = p_app_slug AND is_active = TRUE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'APP_NOT_FOUND',
            'message', 'Aplicación no registrada o inactiva.'
        );
    END IF;

    -- 2. Bloquear fila de licencia para evitar Race Conditions en concurrencia (FOR UPDATE)
    SELECT * INTO v_license 
    FROM public.licenses 
    WHERE license_key = p_license_key AND app_id = v_app.id 
    FOR UPDATE;

    IF NOT FOUND THEN
        -- Log intento fallido
        INSERT INTO public.license_logs (app_id, event_type, machine_fingerprint, device_name, ip_address, app_version, success, message)
        VALUES (v_app.id, 'activate_attempt', p_machine_fingerprint, p_device_name, p_ip_address, p_app_version, false, 'Licencia inexistente.');

        RETURN jsonb_build_object(
            'success', false,
            'code', 'INVALID_LICENSE',
            'message', 'Clave de licencia inválida o no corresponde a esta aplicación.'
        );
    END IF;

    -- 3. Validar estado de la licencia
    IF v_license.status = 'revoked' THEN
        RETURN jsonb_build_object('success', false, 'code', 'LICENSE_REVOKED', 'message', 'La licencia ha sido revocada por el administrador.');
    END IF;

    IF v_license.status = 'paused' THEN
        RETURN jsonb_build_object('success', false, 'code', 'LICENSE_PAUSED', 'message', 'La licencia se encuentra pausada temporalmente.');
    END IF;

    IF v_license.expires_at < NOW() THEN
        UPDATE public.licenses SET status = 'expired' WHERE id = v_license.id;
        RETURN jsonb_build_object('success', false, 'code', 'LICENSE_EXPIRED', 'message', 'La licencia ha expirado. Por favor renueve su suscripción.');
    END IF;

    -- 4. Verificar si la máquina ya estaba activada en esta licencia
    SELECT * INTO v_existing_device
    FROM public.activated_devices
    WHERE license_id = v_license.id AND machine_fingerprint = p_machine_fingerprint;

    IF FOUND THEN
        -- Si ya existe y estaba inactivo, reactivar
        UPDATE public.activated_devices
        SET is_active = TRUE,
            device_name = p_device_name,
            os_info = p_os_info,
            app_version = p_app_version,
            ip_address = p_ip_address,
            last_heartbeat_at = NOW(),
            heartbeat_count = heartbeat_count + 1
        WHERE id = v_existing_device.id;

        -- Registrar log
        INSERT INTO public.license_logs (license_id, app_id, event_type, machine_fingerprint, device_name, ip_address, app_version, success, message)
        VALUES (v_license.id, v_app.id, 'activate_success', p_machine_fingerprint, p_device_name, p_ip_address, p_app_version, true, 'Dispositivo reactivado exitosamente.');

        RETURN jsonb_build_object(
            'success', true,
            'code', 'DEVICE_REACTIVATED',
            'message', 'Dispositivo reactivado exitosamente.',
            'license_id', v_license.id,
            'plan_tier', v_license.plan_tier,
            'max_seats', v_license.max_seats,
            'current_seats', v_license.current_seats,
            'expires_at', v_license.expires_at
        );
    END IF;

    -- 5. Contar puestos activos actuales
    SELECT COUNT(*) INTO v_active_device_count
    FROM public.activated_devices
    WHERE license_id = v_license.id AND is_active = TRUE;

    -- 6. Validar límite de puestos (Seat limit)
    IF v_active_device_count >= v_license.max_seats THEN
        -- Log de intento de fraude / exceso de cupo
        INSERT INTO public.license_logs (license_id, app_id, event_type, machine_fingerprint, device_name, ip_address, app_version, success, message)
        VALUES (v_license.id, v_app.id, 'activate_fraud_blocked', p_machine_fingerprint, p_device_name, p_ip_address, p_app_version, false, 
                format('Límite de puestos alcanzado (%s/%s). Activación denegada.', v_active_device_count, v_license.max_seats));

        RETURN jsonb_build_object(
            'success', false,
            'code', 'MAX_SEATS_REACHED',
            'message', format('Límite de puestos alcanzado. Esta licencia solo permite %s equipo(s) simultáneo(s). Libere un puesto o amplíe su plan.', v_license.max_seats),
            'max_seats', v_license.max_seats,
            'current_seats', v_active_device_count
        );
    END IF;

    -- 7. Registrar nuevo dispositivo
    INSERT INTO public.activated_devices (
        license_id, machine_fingerprint, device_name, os_info, app_version, ip_address, is_active, activated_at, last_heartbeat_at
    ) VALUES (
        v_license.id, p_machine_fingerprint, p_device_name, p_os_info, p_app_version, p_ip_address, TRUE, NOW(), NOW()
    );

    -- 8. Actualizar contador de puestos y fecha de primera activación en licencia
    UPDATE public.licenses
    SET current_seats = v_active_device_count + 1,
        activated_at = COALESCE(activated_at, NOW())
    WHERE id = v_license.id;

    -- 9. Registrar log de éxito
    INSERT INTO public.license_logs (license_id, app_id, event_type, machine_fingerprint, device_name, ip_address, app_version, success, message)
    VALUES (v_license.id, v_app.id, 'activate_success', p_machine_fingerprint, p_device_name, p_ip_address, p_app_version, true, 'Nuevo dispositivo vinculado exitosamente.');

    RETURN jsonb_build_object(
        'success', true,
        'code', 'DEVICE_ACTIVATED',
        'message', 'Dispositivo vinculado y activado exitosamente.',
        'license_id', v_license.id,
        'plan_tier', v_license.plan_tier,
        'max_seats', v_license.max_seats,
        'current_seats', v_active_device_count + 1,
        'expires_at', v_license.expires_at
    );
END;
$$;

-- 5.2 RPC: VALIDACIÓN Y VERIFICACIÓN CONTINUA (VERIFY)
CREATE OR REPLACE FUNCTION rpc_verify_license(
    p_license_key VARCHAR(64),
    p_app_slug VARCHAR(64),
    p_machine_fingerprint VARCHAR(128),
    p_app_version VARCHAR(32),
    p_ip_address INET
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_license RECORD;
    v_device RECORD;
    v_days_remaining INT;
    v_expiry_alert_level VARCHAR(16);
    v_show_alert BOOLEAN := FALSE;
    v_alert_message TEXT := NULL;
BEGIN
    -- 1. Buscar licencia asociada a la app
    SELECT l.*, a.slug as app_slug, a.min_supported_version
    INTO v_license
    FROM public.licenses l
    JOIN public.apps a ON a.id = l.app_id
    WHERE l.license_key = p_license_key AND a.slug = p_app_slug;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'valid', false,
            'code', 'INVALID_LICENSE',
            'message', 'Clave de licencia no reconocida para esta aplicación.'
        );
    END IF;

    -- 2. Comprobar vigencia de licencia
    IF v_license.status = 'revoked' THEN
        RETURN jsonb_build_object('valid', false, 'code', 'LICENSE_REVOKED', 'message', 'La licencia ha sido revocada.');
    END IF;

    IF v_license.status = 'paused' THEN
        RETURN jsonb_build_object('valid', false, 'code', 'LICENSE_PAUSED', 'message', 'La licencia ha sido pausada.');
    END IF;

    IF v_license.expires_at < NOW() THEN
        UPDATE public.licenses SET status = 'expired' WHERE id = v_license.id;
        RETURN jsonb_build_object(
            'valid', false,
            'code', 'LICENSE_EXPIRED',
            'message', 'La licencia ha caducado. Contacte a soporte o renueve su suscripción.',
            'expired_at', v_license.expires_at
        );
    END IF;

    -- 3. Verificar si el equipo está registrado y activo
    SELECT * INTO v_device
    FROM public.activated_devices
    WHERE license_id = v_license.id AND machine_fingerprint = p_machine_fingerprint;

    IF NOT FOUND OR v_device.is_active = FALSE THEN
        RETURN jsonb_build_object(
            'valid', false,
            'code', 'DEVICE_NOT_AUTHORIZED',
            'message', 'Este equipo no se encuentra autorizado o fue desvinculado.'
        );
    END IF;

    -- 4. Cálculo de días restantes y alertas de vencimiento (30, 15, 7, 3, 1)
    v_days_remaining := FLOOR(EXTRACT(EPOCH FROM (v_license.expires_at - NOW())) / 86400)::INT;

    IF v_days_remaining <= 1 THEN
        v_show_alert := TRUE;
        v_expiry_alert_level := 'critical';
        v_alert_message := '¡Su licencia expira en menos de 24 horas! Renueve ahora para evitar interrupciones.';
    ELSIF v_days_remaining <= 3 THEN
        v_show_alert := TRUE;
        v_expiry_alert_level := 'urgent';
        v_alert_message := format('Atención: Su licencia expirará en %s días.', v_days_remaining);
    ELSIF v_days_remaining <= 7 THEN
        v_show_alert := TRUE;
        v_expiry_alert_level := 'warning';
        v_alert_message := format('Recordatorio: Le quedan %s días de vigencia en su licencia.', v_days_remaining);
    ELSIF v_days_remaining <= 15 THEN
        v_show_alert := TRUE;
        v_expiry_alert_level := 'info';
        v_alert_message := format('Su licencia vencerá en %s días. Agende su renovación.', v_days_remaining);
    ELSIF v_days_remaining <= 30 THEN
        v_show_alert := TRUE;
        v_expiry_alert_level := 'notice';
        v_alert_message := format('Aviso: Su ciclo de suscripción termina en %s días.', v_days_remaining);
    ELSE
        v_show_alert := FALSE;
        v_expiry_alert_level := 'none';
        v_alert_message := NULL;
    END IF;

    -- Actualizar telemetría de versión e IP del dispositivo
    UPDATE public.activated_devices
    SET app_version = p_app_version,
        ip_address = p_ip_address,
        last_heartbeat_at = NOW()
    WHERE id = v_device.id;

    RETURN jsonb_build_object(
        'valid', true,
        'code', 'VALID',
        'license_id', v_license.id,
        'plan_tier', v_license.plan_tier,
        'max_seats', v_license.max_seats,
        'current_seats', v_license.current_seats,
        'expires_at', v_license.expires_at,
        'days_remaining', v_days_remaining,
        'show_alert', v_show_alert,
        'alert_level', v_expiry_alert_level,
        'alert_message', v_alert_message,
        'device_registered_at', v_device.activated_at
    );
END;
$$;

-- 5.3 RPC: HEARTBEAT TELEMETRY EN TIEMPO REAL
CREATE OR REPLACE FUNCTION rpc_heartbeat(
    p_license_key VARCHAR(64),
    p_machine_fingerprint VARCHAR(128),
    p_ip_address INET
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_license RECORD;
    v_device RECORD;
    v_is_alive BOOLEAN := FALSE;
BEGIN
    SELECT id, status, expires_at INTO v_license
    FROM public.licenses
    WHERE license_key = p_license_key;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'code', 'LICENSE_NOT_FOUND');
    END IF;

    IF v_license.status != 'active' OR v_license.expires_at < NOW() THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'LICENSE_NOT_ACTIVE',
            'status', v_license.status
        );
    END IF;

    UPDATE public.activated_devices
    SET last_heartbeat_at = NOW(),
        heartbeat_count = heartbeat_count + 1,
        ip_address = COALESCE(p_ip_address, ip_address)
    WHERE license_id = v_license.id 
      AND machine_fingerprint = p_machine_fingerprint 
      AND is_active = TRUE
    RETURNING id INTO v_device;

    IF FOUND THEN
        v_is_alive := TRUE;
    END IF;

    RETURN jsonb_build_object(
        'success', v_is_alive,
        'code', CASE WHEN v_is_alive THEN 'HEARTBEAT_ACK' ELSE 'DEVICE_NOT_FOUND' END,
        'timestamp', NOW()
    );
END;
$$;

-- ==============================================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activated_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.license_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- 6.1 Service Role (Bypass total para API Backend / Edge Functions)
-- El backend con SUPABASE_SERVICE_ROLE_KEY tiene acceso completo para operar las RPC y endpoints.

-- 6.2 Politica para Administradores de Portal (authenticated users)
CREATE POLICY "Admins have full access to companies"
ON public.companies FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Admins have full access to apps"
ON public.apps FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Admins have full access to licenses"
ON public.licenses FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Admins have full access to devices"
ON public.activated_devices FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Admins have full access to logs"
ON public.license_logs FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Admins have full access to payments"
ON public.payments FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 6.3 Políticas para Clientes / Apps Externas (Anon / Public)
-- Las llamadas de apps de escritorio o web no leen tablas directamente, ejecutan las RPCs SECURITY DEFINER.
-- Nadie no autenticado puede consultar datos crudos de clientes ni licencias directamente por PostgREST.
