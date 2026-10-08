import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import { signLicensePayload, validateKeyChecksum } from "@/lib/crypto";
import { verifyLicenseSchema, validateRequestBody } from "@/lib/security/validators";
import { handleApiError } from "@/lib/security/error-handler";

export async function POST(req: NextRequest) {
  try {
    const validation = await validateRequestBody(req, verifyLicenseSchema);
    if (!validation.success) {
      return validation.response;
    }

    const { license_key, app_slug, machine_fingerprint, app_version, nonce } = validation.data;

    if (!validateKeyChecksum(license_key)) {
      return NextResponse.json(
        { valid: false, code: "CHECKSUM_INVALID", message: "Checksum de clave inválido." },
        { status: 422 }
      );
    }

    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1";

    const verifyResult = store.verifyLicense({
      license_key: license_key.trim(),
      app_slug: app_slug.trim(),
      machine_fingerprint: machine_fingerprint.trim(),
      app_version: app_version || "1.0.0",
      ip_address: clientIp,
    });

    if (!verifyResult.valid || !verifyResult.license) {
      return NextResponse.json(
        {
          valid: false,
          code: verifyResult.code,
          message: verifyResult.message,
        },
        { status: 403 }
      );
    }

    const lic = verifyResult.license;

    // Firmar respuesta criptográficamente
    const signedToken = await signLicensePayload({
      license_id: lic.id,
      license_key: lic.license_key,
      app_slug: lic.app_slug || app_slug,
      company_id: lic.company_id,
      machine_fingerprint: machine_fingerprint,
      plan_tier: lic.plan_tier,
      max_seats: lic.max_seats,
      current_seats: lic.current_seats,
      status: lic.status,
      issued_at: lic.issued_at,
      expires_at: lic.expires_at,
      days_remaining: verifyResult.days_remaining || 0,
      alerts: verifyResult.alerts || {
        show_alert: false,
        level: "none",
        message: null,
      },
      nonce: nonce || Math.random().toString(36).substring(2, 15),
    });

    return NextResponse.json({
      valid: true,
      code: "VALID",
      token: signedToken,
      alerts: verifyResult.alerts,
      data: {
        license_id: lic.id,
        app_name: lic.app_name,
        plan_tier: lic.plan_tier,
        max_seats: lic.max_seats,
        current_seats: lic.current_seats,
        expires_at: lic.expires_at,
        days_remaining: verifyResult.days_remaining,
      },
    });
  } catch (error: any) {
    return handleApiError(error, "Error en verificación de licencia");
  }
}
