import { NextRequest, NextResponse } from "next/server";
import { checkDatabaseHealth } from "@/lib/db-health";

export const dynamic = "force-dynamic";

/**
 * Endpoint de Health Check y Diagnóstico Activo (/health)
 * Evalúa conectividad real con la base de datos, latencia de respuesta,
 * uptime del proceso y consumo de memoria del contenedor.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  // Permitir simulación de degradación controlada en pruebas o diagnóstico
  const forceFailure = url.searchParams.get("force_fail") === "true";

  const dbHealth = await checkDatabaseHealth(forceFailure);

  const memUsage = process.memoryUsage();
  const memoryInfo = {
    rss_mb: Math.round((memUsage.rss / 1024 / 1024) * 100) / 100,
    heap_total_mb: Math.round((memUsage.heapTotal / 1024 / 1024) * 100) / 100,
    heap_used_mb: Math.round((memUsage.heapUsed / 1024 / 1024) * 100) / 100,
    external_mb: Math.round((memUsage.external / 1024 / 1024) * 100) / 100,
  };

  const uptimeSeconds = Math.round(process.uptime() * 100) / 100;

  const isHealthy = dbHealth.connected;
  const httpStatus = isHealthy ? 200 : 503;

  const responseBody = {
    status: isHealthy ? "healthy" : "degraded",
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
    uptime_seconds: uptimeSeconds,
    database: {
      connected: dbHealth.connected,
      provider: dbHealth.provider,
      latency_ms: dbHealth.latency_ms,
      ...(dbHealth.error ? { error: dbHealth.error } : {}),
    },
    system: {
      memory: memoryInfo,
      node_version: process.version,
      pid: process.pid,
    },
  };

  return NextResponse.json(responseBody, {
    status: httpStatus,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
