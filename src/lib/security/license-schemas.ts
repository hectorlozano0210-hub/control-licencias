import { z } from "zod";

/**
 * Esquema estricto para activación de licencias (/api/licenses/activate)
 * Mitiga Mass Assignment al rechazar parámetros no reconocidos.
 */
export const activateLicenseSchema = z
  .object({
    license_key: z
      .string()
      .min(8, "La clave de licencia es requerida")
      .max(64, "Longitud máxima de clave excedida")
      .regex(/^[A-Za-z0-9\-_]+$/, "Formato de clave inválido"),
    device_fingerprint: z
      .string()
      .min(8, "La huella de dispositivo (HWID) es requerida")
      .max(128, "Longitud de huella inválida"),
    device_name: z.string().max(128).optional(),
  })
  .strict();

/**
 * Esquema estricto para validación periódica / Heartbeat (/api/licenses/validate)
 */
export const validateLicenseSchema = z
  .object({
    license_key: z
      .string()
      .min(8, "La clave de licencia es requerida")
      .max(64),
    device_fingerprint: z
      .string()
      .min(8, "La huella de dispositivo es requerida")
      .max(128),
  })
  .strict();

/**
 * Esquema estricto para desactivación de dispositivo (/api/licenses/deactivate)
 */
export const deactivateLicenseSchema = z
  .object({
    license_key: z
      .string()
      .min(8, "La clave de licencia es requerida")
      .max(64),
    device_fingerprint: z
      .string()
      .min(8, "La huella de dispositivo es requerida")
      .max(128),
  })
  .strict();
