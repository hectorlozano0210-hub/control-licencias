import { NextRequest, NextResponse } from "next/server";
import { deactivateLicenseSchema } from "@/lib/security/license-schemas";
import { validateRequestBody } from "@/lib/security/validators";
import { handleApiError } from "@/lib/security/error-handler";
import { licensesEngine } from "@/lib/licenses-engine";

export const dynamic = "force-dynamic";

/**
 * POST /api/licenses/deactivate
 * Desvincula un dispositivo de una licencia liberando el cupo consumido.
 */
export async function POST(req: NextRequest) {
  try {
    const validation = await validateRequestBody(req, deactivateLicenseSchema);
    if (!validation.success) {
      return validation.response;
    }

    const { license_key, device_fingerprint } = validation.data;

    const result = await licensesEngine.deactivate({
      license_key,
      device_fingerprint,
    });

    if (!result.success) {
      const statusCode =
        result.code === "DEVICE_NOT_FOUND"
          ? 404
          : result.code === "LICENSE_NOT_FOUND"
          ? 404
          : 400;

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
        current_activations: result.current_activations,
      },
      { status: 200 }
    );
  } catch (error: any) {
    return handleApiError(error, "Error al desvincular dispositivo de licencia");
  }
}
