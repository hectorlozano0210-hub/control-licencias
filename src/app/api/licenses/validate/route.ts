import { NextRequest, NextResponse } from "next/server";
import { validateLicenseSchema } from "@/lib/security/license-schemas";
import { validateRequestBody } from "@/lib/security/validators";
import { handleApiError } from "@/lib/security/error-handler";
import { licensesEngine } from "@/lib/licenses-engine";

export const dynamic = "force-dynamic";

/**
 * POST /api/licenses/validate
 * Realiza el ping/heartbeat de verificación periódica de una licencia activa.
 * Actualiza last_ping_at en la base de datos.
 */
export async function POST(req: NextRequest) {
  try {
    const validation = await validateRequestBody(req, validateLicenseSchema);
    if (!validation.success) {
      return validation.response;
    }

    const { license_key, device_fingerprint } = validation.data;

    const result = await licensesEngine.validate({
      license_key,
      device_fingerprint,
    });

    if (!result.valid) {
      const statusCode = result.code === "LICENSE_NOT_FOUND" ? 404 : 403;
      return NextResponse.json(
        {
          valid: false,
          code: result.code,
          message: result.message,
        },
        { status: statusCode }
      );
    }

    return NextResponse.json(
      {
        valid: true,
        code: result.code,
        message: result.message,
        last_ping_at: result.last_ping_at,
        plan_tier: result.plan_tier,
      },
      { status: 200 }
    );
  } catch (error: any) {
    return handleApiError(error, "Error en validación de licencia");
  }
}
