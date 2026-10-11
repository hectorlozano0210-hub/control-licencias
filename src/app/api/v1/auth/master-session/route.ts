import { NextRequest, NextResponse } from "next/server";
import {
  MASTER_SESSION_COOKIE,
  verifyMasterSessionToken,
  getMasterDeviceFingerprint,
} from "@/lib/security/master-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const tokenCookie = req.cookies.get(MASTER_SESSION_COOKIE);

    if (!tokenCookie || !tokenCookie.value) {
      return NextResponse.json({
        authenticated: false,
        master_device_fp: getMasterDeviceFingerprint(),
      });
    }

    const verification = await verifyMasterSessionToken(tokenCookie.value);

    if (!verification.valid) {
      const response = NextResponse.json({
        authenticated: false,
        reason: verification.reason,
        master_device_fp: getMasterDeviceFingerprint(),
      });
      // Limpiar cookie inválida
      response.cookies.delete(MASTER_SESSION_COOKIE);
      return response;
    }

    return NextResponse.json({
      authenticated: true,
      device_fingerprint: verification.deviceFingerprint,
      master_device_fp: getMasterDeviceFingerprint(),
    });
  } catch (err: any) {
    return NextResponse.json({
      authenticated: false,
      error: err.message,
    });
  }
}
