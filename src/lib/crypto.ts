import { SignJWT, jwtVerify, generateKeyPair, exportJWK, importJWK } from "jose";
import crypto from "crypto";

// ==============================================================================
// COREAUTH CRYPTO ENGINE
// ==============================================================================

// Default fallback secret for signing if environment variable is not provided
const FALLBACK_PRIVATE_SECRET = "coreauth_master_sec_99a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4";

/**
 * Genera un código de checksum de 4 caracteres para validación rápida en cliente (Luhn / CRC-16 modificado)
 */
export function generateChecksum(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  const hex = Math.abs(hash).toString(16).toUpperCase().padStart(4, "0");
  return hex.substring(0, 4);
}

/**
 * Valida si una clave de licencia tiene la estructura y checksum válidos antes de consultar el backend
 */
export function validateKeyChecksum(licenseKey: string): boolean {
  const parts = licenseKey.trim().toUpperCase().split("-");
  if (parts.length < 4) return false;
  
  const checksumProvided = parts[parts.length - 1];
  const payload = parts.slice(0, parts.length - 1).join("-");
  const expectedChecksum = generateChecksum(payload);
  
  return checksumProvided === expectedChecksum;
}

/**
 * Genera una clave criptográfica human-friendly en formato:
 * PROD-ENT-XXXX-XXXX-XXXX-XXXX
 */
export function generateCryptographicLicenseKey(
  prefix: string = "PROD",
  tier: "STD" | "PRO" | "ENT" = "PRO"
): string {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // Crockford Base32 (sin 0, 1, I, O para legibilidad)
  
  const randomBlock = (length = 4) => {
    let result = "";
    const randomBytes = crypto.randomBytes(length);
    for (let i = 0; i < length; i++) {
      result += alphabet[randomBytes[i] % alphabet.length];
    }
    return result;
  };

  const block1 = randomBlock(4);
  const block2 = randomBlock(4);
  const block3 = randomBlock(4);
  
  const rawKey = `${prefix}-${tier}-${block1}-${block2}-${block3}`;
  const checksum = generateChecksum(rawKey);

  return `${rawKey}-${checksum}`;
}

/**
 * Genera huella digital única del hardware (Machine Fingerprint)
 */
export function computeMachineFingerprint(components: {
  cpuId?: string;
  motherboardSerial?: string;
  macAddress?: string;
  osHost?: string;
}): string {
  const raw = `${components.cpuId || "GENERIC_CPU"}|${components.motherboardSerial || "MB_UNKNOWN"}|${components.macAddress || "MAC_00"}|${components.osHost || "HOST"}`;
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export interface LicenseTokenPayload {
  license_id: string;
  license_key: string;
  app_slug: string;
  company_id: string;
  machine_fingerprint: string;
  plan_tier: string;
  max_seats: number;
  current_seats: number;
  status: "active" | "paused" | "expired" | "revoked";
  issued_at: string;
  expires_at: string;
  days_remaining: number;
  alerts: {
    show_alert: boolean;
    level: "none" | "notice" | "info" | "warning" | "urgent" | "critical";
    message: string | null;
  };
  nonce: string;
}

/**
 * Emite un Token Firmado Criptográficamente (HMAC-SHA256 o Ed25519)
 * para evitar falsificación por proxies de red (Charles, Postman, Fiddler)
 */
export async function signLicensePayload(
  payload: LicenseTokenPayload,
  secretKey = process.env.LICENSE_SIGNING_SECRET || FALLBACK_PRIVATE_SECRET
): Promise<string> {
  const secretBytes = new TextEncoder().encode(secretKey);

  const jwt = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer("coreauth-license-hub")
    .setSubject(payload.license_id)
    .setAudience(payload.app_slug)
    .setIssuedAt()
    .setExpirationTime(Math.floor(new Date(payload.expires_at).getTime() / 1000))
    .sign(secretBytes);

  return jwt;
}

/**
 * Verifica la autenticidad del Token en el cliente o servidor
 */
export async function verifyLicenseToken(
  token: string,
  secretKey = process.env.LICENSE_SIGNING_SECRET || FALLBACK_PRIVATE_SECRET
): Promise<{ valid: boolean; payload?: LicenseTokenPayload; error?: string }> {
  try {
    const secretBytes = new TextEncoder().encode(secretKey);
    const { payload } = await jwtVerify(token, secretBytes, {
      issuer: "coreauth-license-hub",
    });

    return {
      valid: true,
      payload: payload as unknown as LicenseTokenPayload,
    };
  } catch (err: any) {
    return {
      valid: false,
      error: err.message || "Token verification failed or signature mismatch.",
    };
  }
}
