import { z } from "zod";
import { NextResponse } from "next/server";

// 1. Activación de licencias: Estricto contra mass-assignment
export const activateLicenseSchema = z
  .object({
    license_key: z
      .string()
      .min(10, "La clave de licencia es demasiado corta")
      .max(64, "La clave de licencia excede la longitud permitida")
      .regex(/^[A-Za-z0-9\-_]+$/, "Formato de clave de licencia inválido"),
    app_slug: z
      .string()
      .min(2, "Slug de aplicación requerido")
      .max(64)
      .regex(/^[a-z0-9\-_]+$/, "Slug debe ser alfanumérico en minúsculas y guiones"),
    machine_fingerprint: z
      .string()
      .min(16, "Huella de hardware (HWID) demasiado corta")
      .max(128, "Huella de hardware (HWID) inválida"),
    device_name: z.string().max(128).optional(),
    os_info: z.string().max(128).optional(),
    app_version: z.string().max(32).optional(),
    nonce: z.string().max(64).optional(),
  })
  .strict();

// 2. Verificación de licencias
export const verifyLicenseSchema = z
  .object({
    license_key: z.string().min(10).max(64),
    app_slug: z.string().min(2).max(64),
    machine_fingerprint: z.string().min(16).max(128),
    app_version: z.string().max(32).optional(),
    nonce: z.string().max(64).optional(),
  })
  .strict();

// 3. Heartbeat de dispositivo
export const heartbeatSchema = z
  .object({
    license_key: z.string().min(10).max(64),
    machine_fingerprint: z.string().min(16).max(128),
  })
  .strict();

// 4. Creación de licencias
export const createLicenseSchema = z
  .object({
    company_id: z.string().optional(),
    customer_id: z.string().optional(),
    customer_email: z.string().email("Correo electrónico inválido").optional().or(z.literal("")).nullable(),
    app_id: z.string().optional(),
    plan_tier: z.string().optional(),
    plan: z.string().optional(),
    max_seats: z.coerce.number().int().min(1, "Debe tener al menos 1 cupo").max(500, "Máximo 500 cupos").optional(),
    max_activations: z.coerce.number().int().min(1).max(500).optional(),
    cupos: z.coerce.number().int().min(1).max(500).optional(),
    duration_days: z.coerce.number().int().min(1, "Duración mínima 1 día").max(3650, "Duración máxima 10 años").optional(),
    notes: z.string().max(500).optional(),
  })
  .strict();

// 5. Actualización / extensión de licencias
export const patchLicenseSchema = z
  .object({
    id: z.string().min(1, "id es requerido"),
    status: z.enum(["active", "paused", "expired", "revoked"]).optional(),
    action: z.enum(["extend"]).optional(),
    days: z.coerce.number().int().min(1).max(3650).optional(),
  })
  .strict();

// 6. Creación de clientes
export const createClientSchema = z
  .object({
    name: z.string().max(128).optional(),
    company_name: z.string().max(128).optional(),
    nit_rut: z.string().max(32).optional(),
    tax_id: z.string().max(32).optional(),
    legal_name: z.string().max(128).optional(),
    contact_name: z.string().max(128).optional(),
    email: z.string().email("Correo electrónico inválido").max(128).optional(),
    contact_email: z.string().email("Correo electrónico inválido").max(128).optional(),
    phone: z.string().max(32).optional(),
    contact_phone: z.string().max(32).optional(),
    notes: z.string().max(500).optional(),
  })
  .strict()
  .refine(
    (data) => Boolean(data.name || data.company_name),
    { message: "Nombre de empresa requerido", path: ["name"] }
  );

// 7. Registro de pago manual
export const manualPaymentSchema = z
  .object({
    company_id: z.string().min(1, "company_id es requerido"),
    license_id: z.string().max(64).optional(),
    amount: z.coerce.number().positive("El monto debe ser un valor numérico positivo"),
    currency: z.enum(["USD", "COP"]),
    payment_method: z.enum([
      "Transferencia Bancaria",
      "Nequi",
      "PSE",
      "Efectivo",
      "Tarjeta",
    ]),
    reference_id: z.string().max(128).optional(),
    action_on_license: z.enum([
      "extend_30",
      "extend_180",
      "extend_365",
      "reactivate",
      "none",
    ]).default("none"),
    notes: z.string().max(500).optional(),
  })
  .strict();

// 8. Revocación / Gestión de dispositivos
export const deviceActionSchema = z
  .object({
    action: z.enum(["revoke"]),
    device_id: z.string().min(1, "device_id es requerido"),
  })
  .strict();

/**
 * Función utilitaria para parsear y validar requests con Zod
 * Si falla, retorna una respuesta 400 Bad Request estructurada y limpia
 */
export async function validateRequestBody<T>(
  req: Request,
  schema: z.ZodSchema<T>
): Promise<{ success: true; data: T } | { success: false; response: NextResponse }> {
  try {
    let rawBody: any;
    try {
      rawBody = await req.json();
    } catch {
      return {
        success: false,
        response: NextResponse.json(
          {
            error: "INVALID_JSON",
            message: "El cuerpo de la petición no es un JSON válido.",
          },
          { status: 400 }
        ),
      };
    }

    const parsed = schema.safeParse(rawBody);

    if (!parsed.success) {
      const details = parsed.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));

      return {
        success: false,
        response: NextResponse.json(
          {
            error: "VALIDATION_ERROR",
            message: "Datos de entrada inválidos o campos no permitidos.",
            details,
          },
          { status: 400 }
        ),
      };
    }

    return {
      success: true,
      data: parsed.data,
    };
  } catch (error: any) {
    return {
      success: false,
      response: NextResponse.json(
        {
          error: "VALIDATION_EXCEPTION",
          message: error.message || "Error al procesar el cuerpo de la petición.",
        },
        { status: 400 }
      ),
    };
  }
}
