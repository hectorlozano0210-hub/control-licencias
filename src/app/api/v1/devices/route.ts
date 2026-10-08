import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import { deviceActionSchema, validateRequestBody } from "@/lib/security/validators";
import { handleApiError } from "@/lib/security/error-handler";

export async function GET() {
  try {
    const devices = store.getDevices();
    const licenses = store.getLicenses();
    return NextResponse.json({ devices, licenses });
  } catch (error: any) {
    return handleApiError(error, "Error al consultar dispositivos");
  }
}

export async function POST(req: NextRequest) {
  try {
    const validation = await validateRequestBody(req, deviceActionSchema);
    if (!validation.success) {
      return validation.response;
    }

    const { action, device_id } = validation.data;

    if (action === "revoke") {
      const result = store.revokeDevice(device_id);
      if (!result.success) {
        return NextResponse.json({ error: "REVOCATION_FAILED", message: result.message }, { status: 400 });
      }
      return NextResponse.json({ success: true, device: result.device });
    }

    return NextResponse.json({ error: "INVALID_ACTION", message: "Acción no reconocida." }, { status: 400 });
  } catch (error: any) {
    return handleApiError(error, "Error al procesar acción de dispositivo");
  }
}
