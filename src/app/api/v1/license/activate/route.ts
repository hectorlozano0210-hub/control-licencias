import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import { signLicensePayload, validateKeyChecksum } from "@/lib/crypto";
import { activateLicenseSchema, validateRequestBody } from "@/lib/security/validators";
import { handleApiError } from "@/lib/security/error-handler";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    // 1. Strict validation via Zod (blocks mass-assignment and unknown fields)
    const validation = await validateRequestBody(req, activateLicenseSchema);
    if (!validation.success) {
      return validation.response;
    }

    const { license_key, app_slug, machine_fingerprint, device_name, os_info, app_version } = validation.data;

    // 2. Client-side fast checksum verification (anti-garbage/anti-bruteforce)
    if (!validateKeyChecksum(license_key)) {
      return NextResponse.json(
        { success: false, code: "CHECKSUM_INVALID", message: "La estructura o checksum de la clave de licencia es inválida." },
        { status: 422 }
      );
    }

    // 3. Client IP
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1";

    // 4. Atomic activation in store (simulates Supabase rpc_activate_device)
    const result = store.activateDevice({
      license_key: license_key.trim(),
      app_slug: app_slug.trim(),
      machine_fingerprint: machine_fingerprint.trim(),
      device_name: device_name || "Dispositivo Desconocido",
      os_info: os_info || "OS Genérico",
      app_version: app_version || "1.0.0",
      ip_address: clientIp,
    });

    if (!result.success || !result.license) {
      return NextResponse.json(
        {
          success: false,
          code: result.code,
          message: result.message,
          max_seats: result.max_seats,
          current_seats: result.current_seats,
        },
        { status: result.code === "MAX_SEATS_REACHED" ? 409 : 403 }
      );
    }

    // 5. Sign cryptographic response token (Anti-Charles Proxy / Anti-Tampering)
    const daysRemaining = Math.max(
      0,
      Math.floor((new Date(result.license.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    );

    const signedToken = await signLicensePayload({
      license_id: result.license.id,
      license_key: result.license.license_key,
      app_slug: result.license.app_slug || app_slug,
      company_id: result.license.company_id,
      machine_fingerprint: machine_fingerprint,
      plan_tier: result.license.plan_tier,
      max_seats: result.license.max_seats,
      current_seats: result.license.current_seats,
      status: result.license.status,
      issued_at: result.license.issued_at,
      expires_at: result.license.expires_at,
      days_remaining: daysRemaining,
      alerts: {
        show_alert: daysRemaining <= 30,
        level: daysRemaining <= 1 ? "critical" : daysRemaining <= 3 ? "urgent" : daysRemaining <= 7 ? "warning" : "info",
        message: daysRemaining <= 7 ? `Atención: Quedan ${daysRemaining} días de vigencia.` : null,
      },
      nonce: Math.random().toString(36).substring(2, 15),
    });

    return NextResponse.json({
      success: true,
      code: result.code,
      message: result.code === "DEVICE_REACTIVATED" ? "Dispositivo reactivado correctamente." : "Dispositivo vinculado y activado con éxito.",
      token: signedToken,
      data: {
        license_id: result.license.id,
        plan_tier: result.license.plan_tier,
        max_seats: result.license.max_seats,
        current_seats: result.license.current_seats,
        expires_at: result.license.expires_at,
        days_remaining: daysRemaining,
      },
    });
  } catch (error: any) {
    return handleApiError(error, "Error en activación de dispositivo");
  }
}
