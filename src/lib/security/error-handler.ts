import { NextResponse } from "next/server";

/**
 * Sanitiza objetos o strings para remover o enmascarar datos confidenciales
 * antes de imprimirlos en logs o consolas
 */
export function sanitizeLogData(data: any): any {
  if (!data) return data;

  if (typeof data === "string") {
    // Enmascarar números de tarjetas de crédito
    let sanitized = data.replace(/\b(?:\d[ -]*?){13,16}\b/g, "****-****-****-****");
    // Enmascarar tokens JWT (ey...)
    sanitized = sanitized.replace(/ey[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[REDACTED_JWT_TOKEN]");
    return sanitized;
  }

  if (typeof data === "object") {
    if (Array.isArray(data)) {
      return data.map(sanitizeLogData);
    }

    const sanitizedObj: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes("password") ||
        lowerKey.includes("secret") ||
        lowerKey.includes("card") ||
        lowerKey.includes("cvv") ||
        lowerKey.includes("token") ||
        lowerKey.includes("key") ||
        lowerKey.includes("credential") ||
        lowerKey.includes("auth") ||
        lowerKey.includes("pin")
      ) {
        sanitizedObj[key] = "[REDACTED]";
      } else {
        sanitizedObj[key] = sanitizeLogData(value);
      }
    }
    return sanitizedObj;
  }

  return data;
}

/**
 * Registra logs de seguridad de manera sanitizada
 */
export function safeLog(level: "info" | "warn" | "error", message: string, metadata?: any) {
  const safeMeta = metadata ? sanitizeLogData(metadata) : "";
  const timestamp = new Date().toISOString();

  if (level === "error") {
    console.error(`[SEC-ERROR][${timestamp}] ${message}`, safeMeta);
  } else if (level === "warn") {
    console.warn(`[SEC-WARN][${timestamp}] ${message}`, safeMeta);
  } else {
    console.log(`[SEC-INFO][${timestamp}] ${message}`, safeMeta);
  }
}

/**
 * Manejador centralizado de errores de API
 * Enmascara errores internos, tablas de base de datos y stack traces
 */
export function handleApiError(error: any, contextMessage = "Error interno del servidor"): NextResponse {
  const isProd = process.env.NODE_ENV === "production";
  const errorMessage = error?.message || String(error);

  // Registrar error con datos sanitizados internamente
  safeLog("error", `${contextMessage}: ${errorMessage}`);

  // Mensaje seguro para clientes externos
  let clientMessage = "Ocurrió un error inesperado al procesar la solicitud.";
  let status = 500;
  let errorCode = "INTERNAL_SERVER_ERROR";

  // Errores controlados de lógica de negocio
  if (
    errorMessage.includes("no encontrada") ||
    errorMessage.includes("no válido") ||
    errorMessage.includes("no encontrado")
  ) {
    status = 404;
    errorCode = "NOT_FOUND";
    clientMessage = errorMessage;
  } else if (
    errorMessage.includes("requerido") ||
    errorMessage.includes("obligatorio") ||
    errorMessage.includes("inválid")
  ) {
    status = 400;
    errorCode = "BAD_REQUEST";
    clientMessage = errorMessage;
  } else if (errorMessage.includes("superado") || errorMessage.includes("alcanzado")) {
    status = 409;
    errorCode = "LIMIT_REACHED";
    clientMessage = errorMessage;
  } else if (!isProd) {
    // En desarrollo permitimos ver el mensaje sin exponer stack trace
    clientMessage = errorMessage;
  }

  return NextResponse.json(
    {
      success: false,
      error: errorCode,
      message: clientMessage,
    },
    { status }
  );
}
