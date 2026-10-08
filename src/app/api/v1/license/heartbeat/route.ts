import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import { heartbeatSchema, validateRequestBody } from "@/lib/security/validators";
import { handleApiError } from "@/lib/security/error-handler";

export async function POST(req: NextRequest) {
  try {
    const validation = await validateRequestBody(req, heartbeatSchema);
    if (!validation.success) {
      return validation.response;
    }

    const { license_key, machine_fingerprint } = validation.data;
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1";

    const result = store.heartbeat({
      license_key: license_key.trim(),
      machine_fingerprint: machine_fingerprint.trim(),
      ip_address: clientIp,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, code: result.code, message: "Heartbeat rechazado." },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      code: "HEARTBEAT_ACK",
      timestamp: result.timestamp,
    });
  } catch (error: any) {
    return handleApiError(error, "Error en heartbeat de dispositivo");
  }
}
