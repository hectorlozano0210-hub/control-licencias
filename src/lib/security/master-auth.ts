import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export const MASTER_SESSION_COOKIE = "coreauth_master_session";
const SESSION_DURATION_SECONDS = 30 * 24 * 60 * 60; // 30 días

// Referencia global persistente en memoria para Node.js durante ejecución del contenedor en Render
interface GlobalMasterAuthState {
  anchoredDeviceFingerprint: string | null;
}

const globalAuthState: GlobalMasterAuthState =
  (global as any)._coreAuthMasterState || {
    anchoredDeviceFingerprint: process.env.MASTER_DEVICE_FP || null,
  };

if (process.env.NODE_ENV !== "production") {
  (global as any)._coreAuthMasterState = globalAuthState;
}

/**
 * Obtiene el secreto de firma para la sesión Super Admin
 */
function getSigningKey(): Uint8Array {
  const secret =
    process.env.SUPERADMIN_SECRET_KEY ||
    process.env.LICENSE_SIGNING_SECRET ||
    "coreauth_superadmin_master_secret_key_32chars_min";
  return new TextEncoder().encode(secret);
}

/**
 * Obtiene la huella digital del dispositivo maestro anclado
 */
export function getMasterDeviceFingerprint(): string | null {
  return process.env.MASTER_DEVICE_FP || globalAuthState.anchoredDeviceFingerprint || null;
}

/**
 * Ancla una huella digital como dispositivo maestro autorizado
 */
export function setMasterDeviceFingerprint(fingerprint: string): void {
  globalAuthState.anchoredDeviceFingerprint = fingerprint.trim();
  console.log(`[MASTER-AUTH] Estación maestra anclada en runtime: ${fingerprint}`);
}

/**
 * Valida la Clave Maestra de Super Administrador contra el backend
 */
export function validateMasterSecretKey(key: string): boolean {
  const expectedKey = process.env.SUPERADMIN_SECRET_KEY;
  if (!expectedKey) {
    console.warn(
      "[MASTER-AUTH][WARN] SUPERADMIN_SECRET_KEY no está configurada en las variables de entorno. " +
      "Se utilizará la clave de respaldo temporal 'SuperAdmin_Master_2026!'."
    );
    return key === "SuperAdmin_Master_2026!";
  }
  return key.trim() === expectedKey.trim();
}

/**
 * Valida y/o ancla el dispositivo físico (Device Binding)
 */
export function validateMasterDeviceBinding(clientFingerprint: string): {
  allowed: boolean;
  reason?: string;
  isFirstAnchored?: boolean;
} {
  const fp = (clientFingerprint || "").trim();
  if (!fp) {
    return {
      allowed: false,
      reason: "Huella digital de terminal no proporcionada o inválida.",
    };
  }

  // 1. Si la variable de entorno MASTER_DEVICE_FP está configurada de forma estricta
  const envMasterFp = process.env.MASTER_DEVICE_FP?.trim();
  if (envMasterFp) {
    if (fp !== envMasterFp) {
      return {
        allowed: false,
        reason: "Acceso no autorizado: Terminal no vinculada como estación maestra",
      };
    }
    return { allowed: true };
  }

  // 2. Si no hay variable fija, verificar si ya se ancló un dispositivo en memoria
  if (!globalAuthState.anchoredDeviceFingerprint) {
    // Primer inicio de sesión exitoso: anclaje automático de la portátil
    setMasterDeviceFingerprint(fp);
    return {
      allowed: true,
      isFirstAnchored: true,
    };
  }

  // 3. Ya existe una estación anclada: verificar coincidencia exacta
  if (globalAuthState.anchoredDeviceFingerprint === fp) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: "Acceso no autorizado: Terminal no vinculada como estación maestra",
  };
}

/**
 * Genera un token JWT criptográficamente firmado para la sesión de Super Admin
 */
export async function createMasterSessionToken(deviceFingerprint: string): Promise<string> {
  const key = getSigningKey();
  const token = await new SignJWT({
    role: "superadmin",
    device_fingerprint: deviceFingerprint.trim(),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(key);

  return token;
}

/**
 * Valida un token JWT de sesión y comprueba que coincida con la estación anclada
 */
export async function verifyMasterSessionToken(token: string): Promise<{
  valid: boolean;
  deviceFingerprint?: string;
  reason?: string;
}> {
  try {
    const key = getSigningKey();
    const { payload } = await jwtVerify(token, key);

    if (payload.role !== "superadmin" || typeof payload.device_fingerprint !== "string") {
      return { valid: false, reason: "Token no corresponde al rol de Super Administrador." };
    }

    const sessionFp = payload.device_fingerprint.trim();

    // Validar device binding con la estación anclada actualmente
    const bindingCheck = validateMasterDeviceBinding(sessionFp);
    if (!bindingCheck.allowed) {
      return { valid: false, reason: bindingCheck.reason };
    }

    return {
      valid: true,
      deviceFingerprint: sessionFp,
    };
  } catch (err: any) {
    return { valid: false, reason: "Sesión expirada o token inválido." };
  }
}
