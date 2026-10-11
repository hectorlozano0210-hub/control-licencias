import { NextResponse } from "next/server";
import { MASTER_SESSION_COOKIE } from "@/lib/security/master-auth";

export const dynamic = "force-dynamic";

export async function POST() {
  const response = NextResponse.json({
    success: true,
    message: "Sesión Maestra cerrada exitosamente.",
  });

  response.cookies.set({
    name: MASTER_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });

  return response;
}
