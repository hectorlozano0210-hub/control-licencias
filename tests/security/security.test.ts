import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";
import { rateLimiter } from "@/lib/security/rate-limiter";
import {
  activateLicenseSchema,
  createLicenseSchema,
  createClientSchema,
  manualPaymentSchema,
  validateRequestBody,
} from "@/lib/security/validators";
import { sanitizeLogData, handleApiError } from "@/lib/security/error-handler";

describe("Directiva de Seguridad: Hardening y Defensa en Profundidad", () => {
  // =========================================================================
  // 1. RATE LIMITING ESCALONADO Y RESPUESTA 429
  // =========================================================================
  describe("1. Rate Limiting Escalonado", () => {
    const testIp = "192.168.1.100";
    const authEndpoint = "/api/v1/license/activate";

    beforeEach(() => {
      // Limpiar memoria de rate limiter antes de cada prueba
      rateLimiter.resetAll();
    });

    it("Permite peticiones dentro del umbral de autenticación (auth tier: 15 req/15min)", () => {
      for (let i = 1; i <= 15; i++) {
        const check = rateLimiter.check(testIp, authEndpoint, "auth");
        expect(check.allowed).toBe(true);
        expect(check.remaining).toBe(15 - i);
        expect(check.limit).toBe(15);
      }
    });

    it("Rechaza con allowed: false en la petición 16 (supera el límite)", () => {
      for (let i = 1; i <= 15; i++) {
        rateLimiter.check(testIp, authEndpoint, "auth");
      }

      const blockedCheck = rateLimiter.check(testIp, authEndpoint, "auth");
      expect(blockedCheck.allowed).toBe(false);
      expect(blockedCheck.remaining).toBe(0);
      expect(blockedCheck.resetSeconds).toBeGreaterThan(0);
    });

    it("El Middleware intercepta y responde con 429 Too Many Requests y cabeceras RFC", async () => {
      // Agotar el límite de peticiones para la IP simulada
      const ip = "10.0.0.99";
      for (let i = 0; i < 15; i++) {
        rateLimiter.check(ip, authEndpoint, "auth");
      }

      // La siguiente petición a través de middleware debe dar 429
      const req = new NextRequest(new URL("http://localhost:3000/api/v1/license/activate"), {
        method: "POST",
        headers: {
          "x-forwarded-for": ip,
          "content-type": "application/json",
        },
      });

      const response = middleware(req);
      expect(response.status).toBe(429);

      // Verificar cabeceras estándar
      expect(response.headers.get("RateLimit-Limit")).toBe("15");
      expect(response.headers.get("RateLimit-Remaining")).toBe("0");
      expect(response.headers.get("Retry-After")).toBeDefined();

      const body = await response.json();
      expect(body.error).toBe("TOO_MANY_REQUESTS");
      expect(body.retry_after).toBeGreaterThan(0);
    });

    it("Soporta claves de idempotencia para prevenir duplicidad en transacciones", () => {
      const idempotencyKey = "tx_idem_abc123";
      expect(rateLimiter.checkIdempotency(idempotencyKey)).toBe(false);

      rateLimiter.recordIdempotency(idempotencyKey, { status: "processed" });
      expect(rateLimiter.checkIdempotency(idempotencyKey)).toBe(true);
    });
  });

  // =========================================================================
  // 2. CABECERAS HTTP DE SEGURIDAD (SECURITY HEADERS)
  // =========================================================================
  describe("2. Cabeceras HTTP de Seguridad", () => {
    it("Inyecta todas las cabeceras defensivas requeridas en respuestas HTTP", () => {
      const req = new NextRequest(new URL("http://localhost:3000/api/v1/licenses"), {
        method: "GET",
      });

      const res = middleware(req);

      // X-Frame-Options: DENY (Anti-Clickjacking)
      expect(res.headers.get("X-Frame-Options")).toBe("DENY");

      // X-Content-Type-Options: nosniff (Anti-MIME Sniffing)
      expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");

      // Strict-Transport-Security (HSTS)
      expect(res.headers.get("Strict-Transport-Security")).toContain("max-age=63072000");

      // Content-Security-Policy (CSP)
      const csp = res.headers.get("Content-Security-Policy");
      expect(csp).toBeDefined();
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("frame-ancestors 'none'");

      // Referrer-Policy
      expect(res.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");

      // Permissions-Policy
      expect(res.headers.get("Permissions-Policy")).toContain("camera=()");
    });

    it("Responde a solicitudes preflight OPTIONS de CORS adecuadamente", () => {
      const req = new NextRequest(new URL("http://localhost:3000/api/v1/license/verify"), {
        method: "OPTIONS",
        headers: {
          origin: "http://localhost:3000",
        },
      });

      const res = middleware(req);
      expect(res.status).toBe(204);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:3000");
      expect(res.headers.get("Access-Control-Allow-Methods")).toContain("POST");
    });
  });

  // =========================================================================
  // 3. VALIDACIÓN ESTRICTA Y MITIGACIÓN DE MASS ASSIGNMENT (ZOD STRICT)
  // =========================================================================
  describe("3. Validación Estricta y Sanitización de Entradas", () => {
    it("Rechaza payloads con campos desconocidos (Mass Assignment Attack) con 400 Bad Request", async () => {
      const maliciousPayload = {
        company_id: "comp_123",
        app_id: "app_pos",
        plan_tier: "Enterprise",
        max_seats: 5,
        duration_days: 30,
        // Propiedades maliciosas inyectadas
        is_admin: true,
        bypass_auth: true,
        __proto__: { backdoor: true },
      };

      const req = new Request("http://localhost:3000/api/v1/licenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(maliciousPayload),
      });

      const validation = await validateRequestBody(req, createLicenseSchema);
      expect(validation.success).toBe(false);

      if (!validation.success) {
        expect(validation.response.status).toBe(400);
        const data = await validation.response.json();
        expect(data.error).toBe("VALIDATION_ERROR");
        expect(data.details.length).toBeGreaterThan(0);
      }
    });

    it("Rechaza intentos de inyección en registro de clientes", async () => {
      const maliciousClient = {
        name: "Empresa Legítima",
        nit_rut: "900123456",
        email: "contacto@empresa.com",
        role: "superadmin", // Campo no permitido
        credit_limit: 999999999, // Campo no permitido
      };

      const req = new Request("http://localhost:3000/api/v1/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(maliciousClient),
      });

      const validation = await validateRequestBody(req, createClientSchema);
      expect(validation.success).toBe(false);

      if (!validation.success) {
        expect(validation.response.status).toBe(400);
      }
    });

    it("Rechaza JSON malformado con 400 e INVALID_JSON", async () => {
      const req = new Request("http://localhost:3000/api/v1/license/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{ malformed: json, missing quotes }",
      });

      const validation = await validateRequestBody(req, activateLicenseSchema);
      expect(validation.success).toBe(false);

      if (!validation.success) {
        expect(validation.response.status).toBe(400);
        const data = await validation.response.json();
        expect(data.error).toBe("INVALID_JSON");
      }
    });

    it("Acepta payloads limpios y legítimos", async () => {
      const legitimatePayload = {
        company_id: "comp_123",
        amount: 250,
        currency: "USD",
        payment_method: "Transferencia Bancaria",
        action_on_license: "extend_30",
      };

      const req = new Request("http://localhost:3000/api/v1/payments/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(legitimatePayload),
      });

      const validation = await validateRequestBody(req, manualPaymentSchema);
      expect(validation.success).toBe(true);
      if (validation.success) {
        expect(validation.data.amount).toBe(250);
        expect(validation.data.currency).toBe("USD");
      }
    });
  });

  // =========================================================================
  // 4. MANEJO SEGURO DE ERRORES Y SANITIZACIÓN DE LOGS
  // =========================================================================
  describe("4. Manejo Seguro de Errores y Sanitización de Datos Sensibles", () => {
    it("Enmascara automáticamente secretos, passwords, tokens y números de tarjeta en logs", () => {
      const sensitiveData = {
        user: "admin",
        password: "SuperSecretPassword123!",
        token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0",
        credit_card: "4111111111111234",
        api_key: "sk_live_998877665544332211",
        normal_field: "valor_publico",
      };

      const sanitized = sanitizeLogData(sensitiveData);

      expect(sanitized.password).toBe("[REDACTED]");
      expect(sanitized.token).toBe("[REDACTED]");
      expect(sanitized.credit_card).toBe("[REDACTED]");
      expect(sanitized.api_key).toBe("[REDACTED]");
      expect(sanitized.normal_field).toBe("valor_publico");
    });

    it("handleApiError enmascara errores internos de la BD y evita filtración de stack trace", async () => {
      const internalDbError = new Error(
        "relation 'public.license_keys' does not exist at postgres_backend.c:1248\n    at Client.query (pg/client.js:521)"
      );

      const response = handleApiError(internalDbError, "Operación de base de datos");
      expect(response.status).toBe(500);

      const json = await response.json();
      expect(json.error).toBe("INTERNAL_SERVER_ERROR");
      expect(json.stack).toBeUndefined(); // Nunca filtrar stack
      // En producción no debe exponer 'relation public.license_keys does not exist'
    });
  });
});
