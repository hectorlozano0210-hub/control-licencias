import { NextRequest, NextResponse } from "next/server";
import { activateLicenseSchema } from "@/lib/security/license-schemas";
import { validateRequestBody } from "@/lib/security/validators";
import { handleApiError } from "@/lib/security/error-handler";
import { licensesEngine } from "@/lib/licenses-engine";
import { resolveClientIp } from "@/middleware";

export const dynamic = "force-dynamic";

/**
 * POST /api/licenses/activate
 * Activa un equipo cliente para una clave de licencia o renueva sesión si ya estaba registrado.
 * Emite token criptográfico JWT firmado para validación offline de 30 días.
 */
export async function POST(req: NextRequest) {
  try {
    const validation = await validateRequestBody(req, activateLicenseSchema);
    if (!validation.success) {
      return validation.response;
    }

    const { license_key, device_fingerprint, device_name } = validation.data;
    const ip_address = resolveClientIp(req);

    const result = await licensesEngine.activate({
      license_key,
      device_fingerprint,
      device_name,
      ip_address,
    });

    if (!result.success) {
      const statusCode =
        result.code === "MAX_ACTIVATIONS_REACHED"
          ? 409
          : result.code === "LICENSE_NOT_FOUND"
          ? 404
          : 403;

      return NextResponse.json(
        {
          success: false,
          code: result.code,
          message: result.message,
        },
        { status: statusCode }
      );
    }

    return NextResponse.json(
      {
        success: true,
        code: result.code,
        message: result.message,
        token: result.token,
        license: result.license,
      },
      { status: 200 }
    );
  } catch (error: any) {
    return handleApiError(error, "Error en activación de licencia");
  }
}
