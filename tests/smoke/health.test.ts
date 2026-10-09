import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GET as getLive } from "@/app/live/route";
import { GET as getHealth } from "@/app/health/route";
import { middleware, resolveClientIp } from "@/middleware";
import { rateLimiter } from "@/lib/security/rate-limiter";
import { getDatabaseConfig, extractSupabaseUrlFromDatabaseUrl } from "@/lib/supabase";

describe("Smoke Tests: Verificación de Puesta en Marcha y Observabilidad", () => {
  beforeEach(() => {
    rateLimiter.resetAll();
  });

  // =========================================================================
  // 1. ENDPOINTS DE LIVENESS & HEALTH CHECK
  // =========================================================================
  describe("1. Endpoints de Diagnóstico (/live y /health)", () => {
    it("GET /live responde con status 200 y status: 'live'", async () => {
      const response = await getLive();
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.status).toBe("live");
      expect(data.timestamp).toBeDefined();
    });

    it("GET /health responde 200 con esquema completo cuando la base de datos está saludable", async () => {
      const req = new NextRequest("http://localhost:3000/health");
      const response = await getHealth(req);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.status).toBe("healthy");
      expect(typeof data.uptime_seconds).toBe("number");
      expect(data.uptime_seconds).toBeGreaterThanOrEqual(0);

      // Verificación de conectividad y latencia de BD
      expect(data.database).toBeDefined();
      expect(data.database.connected).toBe(true);
      expect(typeof data.database.latency_ms).toBe("number");
      expect(data.database.provider).toBeDefined();

      // Verificación de métricas del sistema
      expect(data.system).toBeDefined();
      expect(data.system.memory.heap_used_mb).toBeGreaterThan(0);
      expect(data.system.memory.rss_mb).toBeGreaterThan(0);
      expect(data.system.node_version).toBeDefined();
    });

    it("GET /health responde 503 Service Unavailable y status: 'degraded' cuando la BD falla", async () => {
      // Simulación de fallo en base de datos mediante query param
      const req = new NextRequest("http://localhost:3000/health?force_fail=true");
      const response = await getHealth(req);

      expect(response.status).toBe(503);

      const data = await response.json();
      expect(data.status).toBe("degraded");
      expect(data.database.connected).toBe(false);
      expect(data.database.error).toBeDefined();
    });

    it("Prioriza SUPABASE_URL y resuelve correctamente las credenciales de base de datos", () => {
      const originalDirect = process.env.SUPABASE_URL;
      const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      try {
        process.env.SUPABASE_URL = "https://prod-db.supabase.co";
        process.env.SUPABASE_SERVICE_ROLE_KEY = "test-role-key-123";

        const config = getDatabaseConfig();
        expect(config.isConfigured).toBe(true);
        expect(config.source).toBe("SUPABASE_URL");
        expect(config.url).toBe("https://prod-db.supabase.co");
      } finally {
        if (originalDirect) process.env.SUPABASE_URL = originalDirect;
        else delete process.env.SUPABASE_URL;
        if (originalKey) process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
        else delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      }
    });

    it("Extrae correctamente la URL de Supabase desde DATABASE_URL (Pooler y Direct)", () => {
      // 1. Formato Pooler: postgres.<project_ref>
      const urlPooler = extractSupabaseUrlFromDatabaseUrl(
        "postgresql://postgres.myprojectref123:password@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
      );
      expect(urlPooler).toBe("https://myprojectref123.supabase.co");

      // 2. Formato Directo: db.<project_ref>.supabase.co
      const urlDirect = extractSupabaseUrlFromDatabaseUrl(
        "postgresql://postgres:secret@db.customproject789.supabase.co:5432/postgres"
      );
      expect(urlDirect).toBe("https://customproject789.supabase.co");

      // 3. Formato HTTP directo
      const urlHttp = extractSupabaseUrlFromDatabaseUrl("https://direct-api.supabase.co");
      expect(urlHttp).toBe("https://direct-api.supabase.co");
    });

    it("Sanitiza SUPABASE_URL eliminando barras diagonales al final, comillas y sufijos de ruta", () => {
      const originalDirect = process.env.SUPABASE_URL;
      const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      try {
        process.env.SUPABASE_URL = ' "https://prod-db.supabase.co/rest/v1///" \n';
        process.env.SUPABASE_SERVICE_ROLE_KEY = ' "test-role-key-123" ';

        const config = getDatabaseConfig();
        expect(config.url).toBe("https://prod-db.supabase.co");
        expect(config.key).toBe("test-role-key-123");
      } finally {
        if (originalDirect) process.env.SUPABASE_URL = originalDirect;
        else delete process.env.SUPABASE_URL;
        if (originalKey) process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
        else delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      }
    });
  });

  // =========================================================================
  // 2. EXCLUSIÓN DE HEALTH CHECKS DEL RATE LIMITER
  // =========================================================================
  describe("2. Bypass de Rate Limiting para Sondas de Monitoreo", () => {
    it("Permite ráfagas repetidas en /live y /health sin bloquear con 429", () => {
      const ip = "192.168.10.50";

      // Ejecutar más de 25 peticiones a través del middleware
      for (let i = 0; i < 30; i++) {
        const liveReq = new NextRequest(new URL("http://localhost:3000/live"), {
          headers: { "x-forwarded-for": ip },
        });
        const resLive = middleware(liveReq);
        expect(resLive.status).not.toBe(429);

        const healthReq = new NextRequest(new URL("http://localhost:3000/health"), {
          headers: { "x-forwarded-for": ip },
        });
        const resHealth = middleware(healthReq);
        expect(resHealth.status).not.toBe(429);
      }
    });
  });

  // =========================================================================
  // 3. CABECERAS DEFENSIVAS Y TRUST PROXY
  // =========================================================================
  describe("3. Red, Seguridad Perimetral y Trust Proxy", () => {
    it("Inyecta cabeceras de seguridad requeridas en la respuesta de salud", () => {
      const req = new NextRequest(new URL("http://localhost:3000/health"));
      const res = middleware(req);

      expect(res.headers.get("X-Frame-Options")).toBe("DENY");
      expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
      expect(res.headers.get("Strict-Transport-Security")).toContain("max-age=63072000");
      expect(res.headers.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
    });

    it("Trust Proxy: Extrae correctamente la IP del cliente desde Cloudflare, X-Real-IP o X-Forwarded-For", () => {
      // 1. Cloudflare CDN
      const cfReq = new NextRequest("http://localhost:3000/api/v1/licenses", {
        headers: { "cf-connecting-ip": "203.0.113.195" },
      });
      expect(resolveClientIp(cfReq)).toBe("203.0.113.195");

      // 2. Nginx / AWS ALB X-Real-IP
      const realIpReq = new NextRequest("http://localhost:3000/api/v1/licenses", {
        headers: { "x-real-ip": "198.51.100.88" },
      });
      expect(resolveClientIp(realIpReq)).toBe("198.51.100.88");

      // 3. X-Forwarded-For cadena múltiple
      const fwdReq = new NextRequest("http://localhost:3000/api/v1/licenses", {
        headers: { "x-forwarded-for": "192.0.2.1, 10.0.0.1, 172.16.0.1" },
      });
      expect(resolveClientIp(fwdReq)).toBe("192.0.2.1");
    });
  });

  // =========================================================================
  // 4. POLÍTICA DE CORS ESTRICTO EN PRODUCCIÓN
  // =========================================================================
  describe("4. CORS Estricto en Producción", () => {
    const originalEnv = process.env.NODE_ENV;
    const originalFrontendUrl = process.env.FRONTEND_URL;

    afterEach(() => {
      (process.env as any).NODE_ENV = originalEnv;
      process.env.FRONTEND_URL = originalFrontendUrl;
    });

    it("En producción (NODE_ENV=production), rechaza orígenes desconocidos y preflights no autorizados", () => {
      (process.env as any).NODE_ENV = "production";
      process.env.FRONTEND_URL = "https://app.miempresa.com";

      // Solicitud OPTIONS desde un origen no autorizado
      const unauthorizedReq = new NextRequest("http://localhost:3000/api/v1/licenses", {
        method: "OPTIONS",
        headers: {
          origin: "https://sitio-malicioso.com",
        },
      });

      const response = middleware(unauthorizedReq);
      expect(response.status).toBe(403);
    });

    it("En producción, acepta únicamente el origen exacto configurado en FRONTEND_URL", () => {
      (process.env as any).NODE_ENV = "production";
      process.env.FRONTEND_URL = "https://app.miempresa.com";

      const authorizedReq = new NextRequest("http://localhost:3000/api/v1/licenses", {
        method: "OPTIONS",
        headers: {
          origin: "https://app.miempresa.com",
        },
      });

      const response = middleware(authorizedReq);
      expect(response.status).toBe(204);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://app.miempresa.com");
    });
  });
});
