import { getDatabaseConfig, getSupabaseClient } from "./supabase";
import { store } from "./store";

export interface DatabaseHealthResult {
  connected: boolean;
  provider: "supabase" | "in-memory-store";
  latency_ms: number;
  error?: string;
  source?: string;
}

/**
 * Realiza una prueba activa de conectividad con la base de datos
 * cronometrando el tiempo de respuesta real en milisegundos.
 * Prioriza la conexión real a PostgreSQL / Supabase sobre el almacenamiento en memoria.
 */
export async function checkDatabaseHealth(forceFailure = false): Promise<DatabaseHealthResult> {
  const dbConfig = getDatabaseConfig();

  if (forceFailure) {
    return {
      connected: false,
      provider: dbConfig.isConfigured || dbConfig.url || dbConfig.databaseUrl ? "supabase" : "in-memory-store",
      latency_ms: 0,
      error: "Forced database connectivity failure for health check testing",
    };
  }

  // 1. Si existen credenciales o URL de Supabase / PostgreSQL, conectar prioritariamente
  if (dbConfig.isConfigured) {
    const supabase = getSupabaseClient();
    if (supabase) {
      const start = performance.now();
      try {
        // Query de ping real a PostgreSQL en Supabase con timeout de 3 segundos
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        const { error } = await supabase
          .from("companies")
          .select("id")
          .limit(1)
          .abortSignal(controller.signal);

        clearTimeout(timeoutId);
        const latency_ms = Math.round(performance.now() - start);

        if (error) {
          return {
            connected: false,
            provider: "supabase",
            latency_ms,
            error: error.message,
            source: dbConfig.source,
          };
        }

        return {
          connected: true,
          provider: "supabase",
          latency_ms,
          source: dbConfig.source,
        };
      } catch (err: any) {
        const latency_ms = Math.round(performance.now() - start);
        return {
          connected: false,
          provider: "supabase",
          latency_ms,
          error: err.message || "Failed to establish connection to Supabase",
          source: dbConfig.source,
        };
      }
    }
  }

  // 2. Si se configuró DATABASE_URL o SUPABASE_URL pero falta la clave de servicio
  if ((dbConfig.url || dbConfig.databaseUrl) && !dbConfig.key) {
    return {
      connected: false,
      provider: "supabase",
      latency_ms: 0,
      error: "Database URL está configurada pero falta SUPABASE_SERVICE_ROLE_KEY",
      source: dbConfig.source,
    };
  }

  // 3. Fallback a modo in-memory solo si NO hay variables de base de datos configuradas
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

