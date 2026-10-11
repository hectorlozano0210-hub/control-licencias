import { NextRequest, NextResponse } from "next/server";
import {
  MASTER_SESSION_COOKIE,
  validateMasterSecretKey,
  validateMasterDeviceBinding,
  createMasterSessionToken,
} from "@/lib/security/master-auth";
import { z } from "zod";

export const dynamic = "force-dynamic";

const loginSchema = z.object({
  master_key: z.string().min(1, "Clave Maestra requerida"),
  device_fingerprint: z.string().min(8, "Huella digital de terminal requerida"),
  device_name: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Datos de autenticación incompletos o inválidos.",
          details: parsed.error.format(),
        },
        { status: 400 }
      );
    }

    const { master_key, device_fingerprint, device_name } = parsed.data;

    // 1. Validar la Clave Maestra de Super Administrador
    const isValidKey = validateMasterSecretKey(master_key);
    if (!isValidKey) {
      console.warn(`[MASTER-AUTH] Intento de acceso denegado: Clave incorrecta desde terminal ${device_fingerprint}`);
      return NextResponse.json(
        {
          success: false,
          error: "Clave Maestra de Super Administrador incorrecta.",
          code: "INVALID_MASTER_KEY",
        },
        { status: 401 }
      );
    }

    // 2. Anclaje de Hardware (Device Binding)
    const bindingCheck = validateMasterDeviceBinding(device_fingerprint);
    if (!bindingCheck.allowed) {
      console.warn(
        `[MASTER-AUTH] Intento de intrusión bloqueado: Contraseña válida pero terminal NO vinculada (${device_fingerprint}). Razón: ${bindingCheck.reason}`
      );
      return NextResponse.json(
        {
          success: false,
          error: bindingCheck.reason || "Acceso no autorizado: Terminal no vinculada como estación maestra",
          code: "UNAUTHORIZED_DEVICE",
        },
        { status: 403 }
      );
    }

    // 3. Crear token seguro de sesión con el HWID
    const sessionToken = await createMasterSessionToken(device_fingerprint);

    // 4. Crear cookie HTTP-Only segura
    const response = NextResponse.json({
      success: true,
      message: bindingCheck.isFirstAnchored
        ? "¡Terminal anclada exitosamente como Estación Maestra autorizada!"
        : "Acceso concedido a Estación Maestra.",
      device_fingerprint,
      is_first_anchored: Boolean(bindingCheck.isFirstAnchored),
    });

    const isProduction = process.env.NODE_ENV === "production";

    response.cookies.set({
      name: MASTER_SESSION_COOKIE,
      value: sessionToken,
      httpOnly: true,
      secure: isProduction,
      sameSite: "strict",
      path: "/",
      maxAge: 30 * 24 * 60 * 60, // 30 días
    });

    return response;
  } catch (error: any) {
    console.error("[MASTER-AUTH] Error en login de Super Admin:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Error interno al procesar inicio de sesión maestro.",
      },
      { status: 500 }
    );
  }
}
