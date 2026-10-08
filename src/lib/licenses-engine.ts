import { createClient } from "@supabase/supabase-js";
import { SignJWT } from "jose";
import { store } from "./store";

const FALLBACK_SIGNING_SECRET = "coreauth_master_sec_99a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4";

export interface ActivateParams {
  license_key: string;
  device_fingerprint: string;
  device_name?: string;
  ip_address?: string;
}

export interface ActivationResult {
  success: boolean;
  code: string;
  message: string;
  token?: string;
  license?: {
    id: string;
    license_key: string;
    plan_tier: string;
    max_activations: number;
    current_activations: number;
    expires_at: string | null;
  };
}

export interface ValidateResult {
  valid: boolean;
  code: string;
  message: string;
  last_ping_at?: string;
  plan_tier?: string;
}

export interface DeactivateResult {
  success: boolean;
  code: string;
  message: string;
  current_activations?: number;
}

function getSupabaseAdminClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (url && serviceKey) {
    return createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return null;
}

export async function generateOfflineToken(data: {
  license_id: string;
  license_key: string;
  device_fingerprint: string;
  plan_tier: string;
  expires_at: string | null;
}): Promise<string> {
  const secretKey = process.env.LICENSE_SIGNING_SECRET || FALLBACK_SIGNING_SECRET;
  const secretBytes = new TextEncoder().encode(secretKey);

  const nowMs = Date.now();
  const thirtyDaysMs = nowMs + 30 * 24 * 60 * 60 * 1000;
  let tokenExpirationMs = thirtyDaysMs;

  if (data.expires_at) {
    const licExpMs = new Date(data.expires_at).getTime();
    if (licExpMs < thirtyDaysMs) {
      tokenExpirationMs = licExpMs;
    }
  }

  const expSec = Math.floor(tokenExpirationMs / 1000);

  return new SignJWT({
    license_id: data.license_id,
    license_key: data.license_key,
    device_fingerprint: data.device_fingerprint,
    plan_tier: data.plan_tier,
    expires_at: data.expires_at,
    offline_valid_until: new Date(tokenExpirationMs).toISOString(),
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer("coreauth-license-engine")
    .setIssuedAt()
    .setExpirationTime(expSec)
    .sign(secretBytes);
}

export class LicensesEngine {
  /**
   * 1. Activar licencia en dispositivo
   */
  async activate(params: ActivateParams): Promise<ActivationResult> {
    const supabase = getSupabaseAdminClient();

    // =========================================================================
    // Modo A: Supabase RPC
    // =========================================================================
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc("rpc_activate_license_device", {
          p_license_key: params.license_key.trim(),
          p_device_fingerprint: params.device_fingerprint.trim(),
          p_device_name: params.device_name || "Desconocido",
          p_ip_address: params.ip_address || "127.0.0.1",
        });

        if (error) {
          return {
            success: false,
            code: "DATABASE_ERROR",
            message: error.message,
          };
        }

        if (!data.success) {
          return {
            success: false,
            code: data.code,
            message: data.message,
          };
        }

        const token = await generateOfflineToken({
          license_id: data.license_id,
          license_key: params.license_key.trim(),
          device_fingerprint: params.device_fingerprint.trim(),
          plan_tier: data.plan_tier,
          expires_at: data.expires_at,
        });

        return {
          success: true,
          code: data.code,
          message: data.message,
          token,
          license: {
            id: data.license_id,
            license_key: params.license_key.trim(),
            plan_tier: data.plan_tier,
            max_activations: data.max_activations,
            current_activations: data.current_activations,
            expires_at: data.expires_at,
          },
        };
      } catch (err: any) {
        return {
          success: false,
          code: "INTERNAL_ERROR",
          message: err.message || "Error procesando activación en Supabase",
        };
      }
    }

    // =========================================================================
    // Modo B: Motor In-Memory
    // =========================================================================
    const key = params.license_key.trim();
    const hwid = params.device_fingerprint.trim();

    const lic = store.getLicenseByKey(key);
    if (!lic) {
      return {
        success: false,
        code: "LICENSE_NOT_FOUND",
        message: "La clave de licencia no existe.",
      };
    }

    if (lic.status !== "active") {
      return {
        success: false,
        code: "LICENSE_INACTIVE",
        message: "La licencia se encuentra inactiva o suspendida.",
      };
    }

    if (lic.expires_at && new Date(lic.expires_at).getTime() < Date.now()) {
      return {
        success: false,
        code: "LICENSE_EXPIRED",
        message: "La vigencia de la licencia ha expirado.",
      };
    }

    // Comprobar si el dispositivo ya está registrado (Reactivación idempotente)
    const devices = store.getDevices();
    const existingDev = devices.find(
      (d) => d.license_id === lic.id && d.machine_fingerprint === hwid && d.is_active
    );

    if (existingDev) {
      existingDev.last_heartbeat_at = new Date().toISOString();
      const token = await generateOfflineToken({
        license_id: lic.id,
        license_key: lic.license_key,
        device_fingerprint: hwid,
        plan_tier: lic.plan_tier,
        expires_at: lic.expires_at,
      });

      return {
        success: true,
        code: "DEVICE_REACTIVATED",
        message: "Dispositivo reactivado exitosamente.",
        token,
        license: {
          id: lic.id,
          license_key: lic.license_key,
          plan_tier: lic.plan_tier,
          max_activations: lic.max_seats,
          current_activations: lic.current_seats,
          expires_at: lic.expires_at,
        },
      };
    }

    // Comprobar cupos disponibles
    if (lic.current_seats >= lic.max_seats) {
      return {
        success: false,
        code: "MAX_ACTIVATIONS_REACHED",
        message: "Se ha alcanzado el límite máximo de activaciones permitidas para esta licencia.",
      };
    }

    const activationResult = store.activateDevice({
      license_key: key,
      app_slug: lic.app_slug || "coreauth",
      machine_fingerprint: hwid,
      device_name: params.device_name || "Dispositivo Desconocido",
      os_info: "OS Genérico",
      app_version: "1.0.0",
      ip_address: params.ip_address || "127.0.0.1",
    });

    if (!activationResult.success || !activationResult.license) {
      return {
        success: false,
        code: activationResult.code === "MAX_SEATS_REACHED" ? "MAX_ACTIVATIONS_REACHED" : activationResult.code,
        message: activationResult.message || "Error al procesar activación.",
      };
    }

    const updatedLic = activationResult.license;
    const token = await generateOfflineToken({
      license_id: updatedLic.id,
      license_key: updatedLic.license_key,
      device_fingerprint: hwid,
      plan_tier: updatedLic.plan_tier,
      expires_at: updatedLic.expires_at,
    });

    return {
      success: true,
      code: "DEVICE_ACTIVATED",
      message: "Dispositivo activado y vinculado correctamente.",
      token,
      license: {
        id: updatedLic.id,
        license_key: updatedLic.license_key,
        plan_tier: updatedLic.plan_tier,
        max_activations: updatedLic.max_seats,
        current_activations: updatedLic.current_seats,
        expires_at: updatedLic.expires_at,
      },
    };
  }

  /**
   * 2. Validar licencia (Heartbeat)
   */
  async validate(params: { license_key: string; device_fingerprint: string }): Promise<ValidateResult> {
    const supabase = getSupabaseAdminClient();

    if (supabase) {
      try {
        const { data: lic, error: licErr } = await supabase
          .from("licenses")
          .select("id, status, expires_at, plan_tier")
          .eq("license_key", params.license_key.trim())
          .single();

        if (licErr || !lic) {
          return { valid: false, code: "LICENSE_NOT_FOUND", message: "La licencia no existe." };
        }

        if (lic.status !== "active") {
          return { valid: false, code: "LICENSE_INACTIVE", message: "La licencia no está activa." };
        }

        if (lic.expires_at && new Date(lic.expires_at).getTime() < Date.now()) {
          return { valid: false, code: "LICENSE_EXPIRED", message: "La licencia ha expirado." };
        }

        const { data: act, error: actErr } = await supabase
          .from("license_activations")
          .select("id")
          .eq("license_id", lic.id)
          .eq("device_fingerprint", params.device_fingerprint.trim())
          .single();

        if (actErr || !act) {
          return { valid: false, code: "DEVICE_NOT_ACTIVATED", message: "El equipo no está activado para esta clave." };
        }

        const nowIso = new Date().toISOString();
        await supabase
          .from("license_activations")
          .update({ last_ping_at: nowIso })
          .eq("id", act.id);

        return {
          valid: true,
          code: "VALID",
          message: "Licencia válida y activa.",
          last_ping_at: nowIso,
          plan_tier: lic.plan_tier,
        };
      } catch (err: any) {
        return { valid: false, code: "SERVER_ERROR", message: err.message };
      }
    }

    // Modo In-Memory
    const key = params.license_key.trim();
    const hwid = params.device_fingerprint.trim();

    const lic = store.getLicenseByKey(key);
    if (!lic) {
      return { valid: false, code: "LICENSE_NOT_FOUND", message: "La licencia no existe." };
    }

    if (lic.status !== "active") {
      return { valid: false, code: "LICENSE_INACTIVE", message: "La licencia no está activa." };
    }

    if (lic.expires_at && new Date(lic.expires_at).getTime() < Date.now()) {
      return { valid: false, code: "LICENSE_EXPIRED", message: "La licencia ha expirado." };
    }

    const heartbeatResult = store.heartbeat({
      license_key: key,
      machine_fingerprint: hwid,
      ip_address: "127.0.0.1",
    });

    if (!heartbeatResult.success) {
      return {
        valid: false,
        code: heartbeatResult.code,
        message: "Heartbeat de licencia rechazado.",
      };
    }

    return {
      valid: true,
      code: "VALID",
      message: "Licencia verificada exitosamente.",
      last_ping_at: heartbeatResult.timestamp,
      plan_tier: lic.plan_tier,
    };
  }

  /**
   * 3. Desactivar dispositivo
   */
  async deactivate(params: { license_key: string; device_fingerprint: string }): Promise<DeactivateResult> {
    const supabase = getSupabaseAdminClient();

    if (supabase) {
      try {
        const { data, error } = await supabase.rpc("rpc_deactivate_license_device", {
          p_license_key: params.license_key.trim(),
          p_device_fingerprint: params.device_fingerprint.trim(),
        });

        if (error) {
          return { success: false, code: "DATABASE_ERROR", message: error.message };
        }

        return {
          success: data.success,
          code: data.code,
          message: data.message,
          current_activations: data.current_activations,
        };
      } catch (err: any) {
        return { success: false, code: "SERVER_ERROR", message: err.message };
      }
    }

    // Modo In-Memory
    const key = params.license_key.trim();
    const hwid = params.device_fingerprint.trim();

    const lic = store.getLicenseByKey(key);
    if (!lic) {
      return {
        success: false,
        code: "LICENSE_NOT_FOUND",
        message: "La clave de licencia no existe.",
      };
    }

    const devices = store.getDevices();
    const targetDev = devices.find(
      (d) => d.license_id === lic.id && d.machine_fingerprint === hwid && d.is_active
    );

    if (!targetDev) {
      return {
        success: false,
        code: "DEVICE_NOT_FOUND",
        message: "No se encontró activación registrada para esta huella de hardware.",
      };
    }

    const revokeRes = store.revokeDevice(targetDev.id);
    if (!revokeRes.success) {
      return {
        success: false,
        code: "DEACTIVATION_FAILED",
        message: revokeRes.message || "Error al desvincular dispositivo.",
      };
    }

    const updatedLic = store.getLicenseByKey(key);
    return {
      success: true,
      code: "DEVICE_DEACTIVATED",
      message: "Dispositivo desvinculado exitosamente.",
      current_activations: updatedLic ? updatedLic.current_seats : 0,
    };
  }
}

export const licensesEngine = new LicensesEngine();
