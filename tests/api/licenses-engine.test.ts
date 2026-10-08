import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST as activateRoute } from "@/app/api/licenses/activate/route";
import { POST as singularActivateRoute } from "@/app/api/license/activate/route";
import { POST as validateRoute } from "@/app/api/licenses/validate/route";
import { POST as deactivateRoute } from "@/app/api/licenses/deactivate/route";
import { GET as healthRoute } from "@/app/health/route";
import { middleware } from "@/middleware";
import { store } from "@/lib/store";
import { jwtVerify } from "jose";

describe("Motor de Licencias: Suite de Verificación (Render + Supabase + Vercel)", () => {
  const activeLicenseKey = "PROD-ENT-8F4A-9C2B-7D1E-0A42";
  const pausedLicenseKey = "DEV-ENT-9K1L-3M4N-5P6Q-3D12";
  const testHwid = "hwid_render_test_node_aa112233";

  beforeEach(() => {
    // Asegurar que el dispositivo de prueba no esté previamente vinculado
    const devices = store.getDevices();
    const existing = devices.find((d) => d.machine_fingerprint === testHwid);
    if (existing) {
      store.revokeDevice(existing.id);
    }
  });

  // =========================================================================
  // 1. HEALTH CHECK & OBSERVABILIDAD
  // =========================================================================
  describe("1. Diagnóstico del Servicio (/health)", () => {
    it("GET /health responde 200 con el esquema de diagnóstico esperado", async () => {
      const req = new NextRequest("http://localhost:3000/health");
      const res = await healthRoute(req);

      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.status).toBe("healthy");
      expect(data.database).toBeDefined();
      expect(data.database.connected).toBe(true);
      expect(typeof data.database.latency_ms).toBe("number");
      expect(typeof data.uptime_seconds).toBe("number");
      expect(data.system.memory.heap_used_mb).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // 2. ACTIVACIÓN DE LICENCIAS (POST /api/licenses/activate)
  // =========================================================================
  describe("2. Activación de Equipos (/api/licenses/activate)", () => {
    it("Flujo exitoso: Vincula dispositivo y retorna token JWT firmado de 30 días", async () => {
      const req = new NextRequest("http://localhost:3000/api/licenses/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          license_key: activeLicenseKey,
          device_fingerprint: testHwid,
          device_name: "Nodo-Render-Produccion",
        }),
      });

      const res = await activateRoute(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.token).toBeDefined();
      expect(json.license).toBeDefined();
      expect(json.license.license_key).toBe(activeLicenseKey);

      // Verificar criptográficamente la validez del token JWT generado
      const secret = new TextEncoder().encode(
        process.env.LICENSE_SIGNING_SECRET || "coreauth_master_sec_99a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4"
      );
      const { payload } = await jwtVerify(json.token, secret);
      expect(payload.device_fingerprint).toBe(testHwid);
      expect(payload.license_key).toBe(activeLicenseKey);
      expect(payload.offline_valid_until).toBeDefined();
    });

    it("Alias singular: Responde correctamente en POST /api/license/activate previniendo 404", async () => {
      const aliasHwid = "hwid_singular_alias_test_99";
      const req = new NextRequest("http://localhost:3000/api/license/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          license_key: activeLicenseKey,
          device_fingerprint: aliasHwid,
          device_name: "Equipo-Alias-Test",
        }),
      });

      const res = await singularActivateRoute(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.token).toBeDefined();
      expect(json.license.license_key).toBe(activeLicenseKey);
    });

    it("Reactivación idempotente: Si el equipo ya está vinculado, renueva el token sin consumir asientos adicionales", async () => {
      // 1ra llamada
      const req1 = new NextRequest("http://localhost:3000/api/licenses/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          license_key: activeLicenseKey,
          device_fingerprint: testHwid,
        }),
      });
      const res1 = await activateRoute(req1);
      const json1 = await res1.json();
      expect(res1.status).toBe(200);

      const seatsBefore = json1.license.current_activations;

      // 2da llamada con el mismo HWID
      const req2 = new NextRequest("http://localhost:3000/api/licenses/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          license_key: activeLicenseKey,
          device_fingerprint: testHwid,
        }),
      });
      const res2 = await activateRoute(req2);
      const json2 = await res2.json();

      expect(res2.status).toBe(200);
      expect(json2.code).toBe("DEVICE_REACTIVATED");
      expect(json2.license.current_activations).toBe(seatsBefore);
    });

    it("Rechazo por límite alcanzado: Retorna 409 cuando current_activations >= max_activations", async () => {
      // Crear una licencia temporal con max_seats = 1
      const fullLic = store.createLicense({
        company_id: "comp_01",
        app_id: "app_horarios",
        plan_tier: "Standard",
        max_seats: 1,
        duration_days: 30,
      });

      // Llenar el único cupo disponible
      const req1 = new NextRequest("http://localhost:3000/api/licenses/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          license_key: fullLic.license_key,
          device_fingerprint: "hwid_device_slot_01",
        }),
      });
      await activateRoute(req1);

      // Intentar vincular un segundo dispositivo
      const req2 = new NextRequest("http://localhost:3000/api/licenses/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          license_key: fullLic.license_key,
          device_fingerprint: "hwid_device_slot_02_overflow",
        }),
      });
      const res2 = await activateRoute(req2);

      expect(res2.status).toBe(409);
      const json2 = await res2.json();
      expect(json2.success).toBe(false);
      expect(json2.code).toBe("MAX_ACTIVATIONS_REACHED");
    });

    it("Rechazo por clave inactiva o expirada: Retorna 403", async () => {
      const req = new NextRequest("http://localhost:3000/api/licenses/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          license_key: pausedLicenseKey,
          device_fingerprint: "hwid_unauthorized_999",
        }),
      });

      const res = await activateRoute(req);
      expect(res.status).toBe(403);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(["LICENSE_INACTIVE", "LICENSE_EXPIRED"]).toContain(json.code);
    });

    it("Rechazo por clave inexistente: Retorna 404", async () => {
      const req = new NextRequest("http://localhost:3000/api/licenses/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          license_key: "PROD-FAKE-0000-0000-0000-0000",
          device_fingerprint: "hwid_fake_device",
        }),
      });

      const res = await activateRoute(req);
      expect(res.status).toBe(404);

      const json = await res.json();
      expect(json.code).toBe("LICENSE_NOT_FOUND");
    });
  });

  // =========================================================================
  // 3. HEARTBEAT / VALIDACIÓN PERIÓDICA (POST /api/licenses/validate)
  // =========================================================================
  describe("3. Validación de Heartbeat (/api/licenses/validate)", () => {
    it("Valida estado activo y refresca timestamp", async () => {
      // Activar previamente
      const actReq = new NextRequest("http://localhost:3000/api/licenses/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          license_key: activeLicenseKey,
          device_fingerprint: testHwid,
        }),
      });
      await activateRoute(actReq);

      // Enviar Heartbeat
      const valReq = new NextRequest("http://localhost:3000/api/licenses/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          license_key: activeLicenseKey,
          device_fingerprint: testHwid,
        }),
      });
      const valRes = await validateRoute(valReq);

      expect(valRes.status).toBe(200);
      const json = await valRes.json();
      expect(json.valid).toBe(true);
      expect(json.last_ping_at).toBeDefined();
    });
  });

  // =========================================================================
  // 4. DESACTIVACIÓN DE DISPOSITIVO (POST /api/licenses/deactivate)
  // =========================================================================
  describe("4. Desvinculación de Hardware (/api/licenses/deactivate)", () => {
    it("Desvincula el equipo y libera el cupo", async () => {
      const deactHwid = "hwid_deact_test_unique_44";

      // 1. Activar
      const actReq = new NextRequest("http://localhost:3000/api/licenses/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          license_key: activeLicenseKey,
          device_fingerprint: deactHwid,
        }),
      });
      const actRes = await activateRoute(actReq);
      const actJson = await actRes.json();
      expect(actRes.status).toBe(200);
      const seatsBefore = actJson.license.current_activations;

      // 2. Desactivar
      const deactReq = new NextRequest("http://localhost:3000/api/licenses/deactivate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          license_key: activeLicenseKey,
          device_fingerprint: deactHwid,
        }),
      });
      const deactRes = await deactivateRoute(deactReq);

      expect(deactRes.status).toBe(200);
      const deactJson = await deactRes.json();
      expect(deactJson.success).toBe(true);
      expect(deactJson.code).toBe("DEVICE_DEACTIVATED");
      expect(deactJson.current_activations).toBe(seatsBefore - 1);
    });
  });

  // =========================================================================
  // 5. SEGURIDAD DEFENSIVA: HEADERS Y RECHAZO DE MASS ASSIGNMENT
  // =========================================================================
  describe("5. Seguridad Defensiva y Cabeceras HTTP", () => {
    it("Rechaza campos maliciosos no reconocidos con 400 Bad Request", async () => {
      const maliciousPayload = {
        license_key: activeLicenseKey,
        device_fingerprint: testHwid,
        // Inyecciones no autorizadas
        is_admin: true,
        elevate_privileges: "root",
        __proto__: { bypass: true },
      };

      const req = new NextRequest("http://localhost:3000/api/licenses/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(maliciousPayload),
      });

      const res = await activateRoute(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toBe("VALIDATION_ERROR");
    });

    it("Inyecta cabeceras de seguridad estrictas en las respuestas de la API", () => {
      const req = new NextRequest(new URL("http://localhost:3000/api/licenses/activate"), {
        method: "POST",
      });

      const res = middleware(req);
      expect(res.headers.get("X-Frame-Options")).toBe("DENY");
      expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
      expect(res.headers.get("Strict-Transport-Security")).toContain("max-age=63072000");
    });
  });
});
