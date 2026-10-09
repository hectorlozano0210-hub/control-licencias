import { getSupabaseClient } from "./supabase";
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
  return getSupabaseClient();
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
    // Modo A: Consultas Oficiales a Tablas Supabase (Sin RPC / Sin URLs a mano)
    // =========================================================================
    if (supabase) {
      try {
        const key = params.license_key.trim();
        const hwid = params.device_fingerprint.trim();

        // 1. Consultar licencia directamente en la tabla oficial 'licenses'
        const { data: lic, error: licErr } = await supabase
          .from("licenses")
          .select("id, license_key, status, expires_at, max_activations, current_activations, plan_tier")
          .eq("license_key", key)
          .maybeSingle();

        // Manejo defensivo: Si la consulta a Supabase falla (p.ej. tabla aún no migrada, error de path o conectividad),
        // capturar y recurrir al fallback en memoria sin romper la llamada.
        if (licErr) {
          console.warn("[LICENSES-ENGINE] Error en consulta a tabla 'licenses' de Supabase:", licErr.message);
          return this.activateInMemory(params);
        }

        // Si la licencia no existe en Supabase, verificar si existe en el store local de contingencia
        if (!lic) {
          const memLic = store.getLicenseByKey(key);
          if (memLic) {
            return this.activateInMemory(params);
          }
          return {
            success: false,
            code: "LICENSE_NOT_FOUND",
            message: "La clave de licencia no existe.",
          };
        }

        // Validar estado de la licencia
        if (lic.status !== "active") {
          return {
            success: false,
            code: "LICENSE_INACTIVE",
            message: "La licencia se encuentra inactiva o suspendida.",
          };
        }

        // Validar vigencia temporal
        if (lic.expires_at && new Date(lic.expires_at).getTime() < Date.now()) {
          return {
            success: false,
            code: "LICENSE_EXPIRED",
            message: "La vigencia de la licencia ha expirado.",
          };
        }

        const maxLimit = lic.max_activations ?? 1;
        const currentCount = lic.current_activations ?? 0;
        const tier = lic.plan_tier || "standard";

        // 2. Comprobar si el dispositivo ya está registrado (Reactivación idempotente)
        const { data: existingAct, error: actCheckErr } = await supabase
          .from("license_activations")
          .select("id")
          .eq("license_id", lic.id)
          .eq("device_fingerprint", hwid)
          .maybeSingle();

        if (!actCheckErr && existingAct) {
          // Renovar timestamp del equipo
          await supabase
            .from("license_activations")
            .update({
              last_ping_at: new Date().toISOString(),
              device_name: params.device_name || "Desconocido",
              ip_address: params.ip_address || "127.0.0.1",
            })
            .eq("id", existingAct.id);

          const token = await generateOfflineToken({
            license_id: lic.id,
            license_key: lic.license_key,
            device_fingerprint: hwid,
            plan_tier: tier,
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
              plan_tier: tier,
              max_activations: maxLimit,
              current_activations: currentCount,
              expires_at: lic.expires_at,
            },
          };
        }

        // 3. Comprobar límite de activaciones
        if (currentCount >= maxLimit) {
          return {
            success: false,
            code: "MAX_ACTIVATIONS_REACHED",
            message: "Se ha alcanzado el límite máximo de activaciones permitidas para esta licencia.",
          };
        }

        // 4. Registrar nueva activación en la tabla oficial
        const { error: insertErr } = await supabase
          .from("license_activations")
          .insert({
            license_id: lic.id,
            device_fingerprint: hwid,
            device_name: params.device_name || "Desconocido",
            ip_address: params.ip_address || "127.0.0.1",
            last_ping_at: new Date().toISOString(),
          });

        if (insertErr) {
          console.warn("[LICENSES-ENGINE] Error insertando en 'license_activations':", insertErr.message);
          return this.activateInMemory(params);
        }

        // 5. Incrementar contador de activaciones
        const newCount = currentCount + 1;
        await supabase
          .from("licenses")
          .update({
            current_activations: newCount,
            updated_at: new Date().toISOString(),
          })
          .eq("id", lic.id);

        const token = await generateOfflineToken({
          license_id: lic.id,
          license_key: lic.license_key,
          device_fingerprint: hwid,
          plan_tier: tier,
          expires_at: lic.expires_at,
        });

        return {
          success: true,
          code: "DEVICE_ACTIVATED",
          message: "Dispositivo activado y vinculado correctamente.",
          token,
          license: {
            id: lic.id,
            license_key: lic.license_key,
            plan_tier: tier,
            max_activations: maxLimit,
            current_activations: newCount,
            expires_at: lic.expires_at,
          },
        };
      } catch (err: any) {
        console.warn("[LICENSES-ENGINE] Excepción capturada en Supabase, recurriendo a fallback seguro:", err?.message);
        return this.activateInMemory(params);
      }
    }

    // =========================================================================
    // Modo B: Motor In-Memory Directo
    // =========================================================================
    return this.activateInMemory(params);
  }

  /**
   * Ejecución segura en memoria / fallback resiliente
   */
  private async activateInMemory(params: ActivateParams): Promise<ActivationResult> {
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
          .maybeSingle();

        if (licErr) {
          console.warn("[LICENSES-ENGINE] Error en Supabase validate, usando fallback in-memory:", licErr.message);
          return this.validateInMemory(params);
        }

        if (!lic) {
          const memLic = store.getLicenseByKey(params.license_key.trim());
          if (memLic) return this.validateInMemory(params);
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
          .maybeSingle();

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
        console.warn("[LICENSES-ENGINE] Excepción en validate Supabase, usando fallback:", err?.message);
        return this.validateInMemory(params);
      }
    }

    return this.validateInMemory(params);
  }

  private async validateInMemory(params: { license_key: string; device_fingerprint: string }): Promise<ValidateResult> {
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
        const key = params.license_key.trim();
        const hwid = params.device_fingerprint.trim();

        const { data: lic, error: licErr } = await supabase
          .from("licenses")
          .select("id, current_activations")
          .eq("license_key", key)
          .maybeSingle();

        if (licErr) {
          console.warn("[LICENSES-ENGINE] Error en Supabase deactivate, usando fallback:", licErr.message);
          return this.deactivateInMemory(params);
        }

        if (!lic) {
          const memLic = store.getLicenseByKey(key);
          if (memLic) return this.deactivateInMemory(params);
          return { success: false, code: "LICENSE_NOT_FOUND", message: "La clave de licencia no existe." };
        }

        const { data: act } = await supabase
          .from("license_activations")
          .select("id")
          .eq("license_id", lic.id)
          .eq("device_fingerprint", hwid)
          .maybeSingle();

        if (!act) {
          return { success: false, code: "DEVICE_NOT_FOUND", message: "No se encontró activación registrada para esta huella de hardware." };
        }

        // Eliminar registro de activación
        await supabase
          .from("license_activations")
          .delete()
          .eq("id", act.id);

        const currentCount = lic.current_activations ?? 1;
        const newCount = Math.max(0, currentCount - 1);

        await supabase
          .from("licenses")
          .update({
            current_activations: newCount,
            updated_at: new Date().toISOString(),
          })
          .eq("id", lic.id);

        return {
          success: true,
          code: "DEVICE_DEACTIVATED",
          message: "Dispositivo desvinculado exitosamente.",
          current_activations: newCount,
        };
      } catch (err: any) {
        console.warn("[LICENSES-ENGINE] Excepción en deactivate Supabase, usando fallback:", err?.message);
        return this.deactivateInMemory(params);
      }
    }

    return this.deactivateInMemory(params);
  }

  private async deactivateInMemory(params: { license_key: string; device_fingerprint: string }): Promise<DeactivateResult> {
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
