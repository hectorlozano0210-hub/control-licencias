import { createClient } from "@supabase/supabase-js";
import { store } from "./store";

export interface DatabaseHealthResult {
  connected: boolean;
  provider: "supabase" | "in-memory-store";
  latency_ms: number;
  error?: string;
}

/**
 * Realiza una prueba activa de conectividad con la base de datos
 * cronometrando el tiempo de respuesta real en milisegundos.
 */
export async function checkDatabaseHealth(forceFailure = false): Promise<DatabaseHealthResult> {
  if (forceFailure) {
    return {
      connected: false,
      provider: "in-memory-store",
      latency_ms: 0,
      error: "Forced database connectivity failure for health check testing",
    };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // 1. Si existen credenciales de Supabase, realizar ping real a la base de datos
  if (supabaseUrl && supabaseKey) {
    const start = performance.now();
    try {
      const supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false },
      });

      // Query ligera para verificar conectividad activa
      const { error } = await supabase.from("companies").select("id").limit(1);
      const latency_ms = Math.round(performance.now() - start);

      if (error) {
        return {
          connected: false,
          provider: "supabase",
          latency_ms,
          error: error.message,
        };
      }

      return {
        connected: true,
        provider: "supabase",
        latency_ms,
      };
    } catch (err: any) {
      const latency_ms = Math.round(performance.now() - start);
      return {
        connected: false,
        provider: "supabase",
        latency_ms,
        error: err.message || "Failed to establish connection to Supabase",
      };
    }
  }

  // 2. Si opera en modo in-memory (store persistente con seed de producción)
  const start = performance.now();
  try {
    const companies = store.getCompanies();
    const licenses = store.getLicenses();
    const latency_ms = Math.max(1, Math.round(performance.now() - start));

    const isHealthy = Array.isArray(companies) && Array.isArray(licenses);

    if (!isHealthy) {
      return {
        connected: false,
        provider: "in-memory-store",
        latency_ms,
        error: "Corrupted internal in-memory database state",
      };
    }

    return {
      connected: true,
      provider: "in-memory-store",
      latency_ms,
    };
  } catch (err: any) {
    const latency_ms = Math.round(performance.now() - start);
    return {
      connected: false,
      provider: "in-memory-store",
      latency_ms,
      error: err.message || "Unknown error checking in-memory store health",
    };
  }
}
