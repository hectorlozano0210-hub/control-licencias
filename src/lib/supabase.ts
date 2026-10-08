import { createClient, SupabaseClient } from "@supabase/supabase-js";

export interface DatabaseConfig {
  isConfigured: boolean;
  url: string | null;
  key: string | null;
  databaseUrl: string | null;
  source: "SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_URL" | "DATABASE_URL" | "none";
}

let cachedClient: SupabaseClient | null = null;
let cachedClientKey: string | null = null;

/**
 * Extrae la URL REST de Supabase a partir de un string de conexión PostgreSQL (DATABASE_URL)
 * o retorna la misma si ya es un endpoint HTTP/HTTPS.
 *
 * Soporta formatos de Supabase:
 * - Direct: postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
 * - Pooler (Transaction/Session): postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
 * - URL directa: https://[project-ref].supabase.co
 */
export function extractSupabaseUrlFromDatabaseUrl(dbUrl: string): string | null {
  if (!dbUrl || typeof dbUrl !== "string") return null;

  const trimmed = dbUrl.trim();

  // 1. Si ya es una URL HTTP/HTTPS
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed.replace(/\/$/, "");
  }

  // 2. Extracción mediante parser estándar de URL
  try {
    const parsed = new URL(trimmed);

    // Caso username = postgres.<project-ref> (Pooler Supabase)
    if (parsed.username) {
      const userParts = parsed.username.split(".");
      if (userParts.length > 1 && userParts[1]) {
        return `https://${userParts[1]}.supabase.co`;
      }
    }

    // Caso hostname = db.<project-ref>.supabase.co (Conexión Directa)
    const hostMatch = parsed.hostname.match(/^db\.([a-z0-9_-]+)\.supabase\.co$/i);
    if (hostMatch && hostMatch[1]) {
      return `https://${hostMatch[1]}.supabase.co`;
    }

    // Caso hostname = <project-ref>.pooler.supabase.com
    const poolerMatch = parsed.hostname.match(/^([a-z0-9_-]+)\.pooler\.supabase\.co/i);
    if (poolerMatch && poolerMatch[1] && poolerMatch[1] !== "postgres") {
      return `https://${poolerMatch[1]}.supabase.co`;
    }
  } catch {
    // Si URL() falla (por ejemplo por caracteres no escapados en contraseña), recurrir a regex
  }

  // 3. Fallbacks mediante Regex
  const poolerUserMatch = trimmed.match(/postgres\.([a-zA-Z0-9_-]+):/);
  if (poolerUserMatch && poolerUserMatch[1]) {
    return `https://${poolerUserMatch[1]}.supabase.co`;
  }

  const directHostMatch = trimmed.match(/db\.([a-zA-Z0-9_-]+)\.supabase\.co/i);
  if (directHostMatch && directHostMatch[1]) {
    return `https://${directHostMatch[1]}.supabase.co`;
  }

  return null;
}

/**
 * Resuelve y centraliza la configuración de base de datos con orden de prioridad estricto:
 * 1. SUPABASE_URL (Variable de backend en Docker / Render)
 * 2. NEXT_PUBLIC_SUPABASE_URL (Variable de frontend / Vercel)
 * 3. DATABASE_URL (Cadena de conexión PostgreSQL de Supabase)
 *
 * Y resolución de claves:
 * 1. SUPABASE_SERVICE_ROLE_KEY (Privilegiada para backend)
 * 2. SUPABASE_ANON_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY
 */
export function getDatabaseConfig(): DatabaseConfig {
  const databaseUrl = process.env.DATABASE_URL || null;
  const directUrl = process.env.SUPABASE_URL || null;
  const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || null;

  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    null;

  let url: string | null = null;
  let source: DatabaseConfig["source"] = "none";

  if (directUrl && directUrl.trim().length > 0) {
    url = directUrl.trim().replace(/\/$/, "");
    source = "SUPABASE_URL";
  } else if (publicUrl && publicUrl.trim().length > 0) {
    url = publicUrl.trim().replace(/\/$/, "");
    source = "NEXT_PUBLIC_SUPABASE_URL";
  } else if (databaseUrl && databaseUrl.trim().length > 0) {
    const extracted = extractSupabaseUrlFromDatabaseUrl(databaseUrl);
    if (extracted) {
      url = extracted;
      source = "DATABASE_URL";
    }
  }

  const isConfigured = Boolean(url && key);

  return {
    isConfigured,
    url,
    key,
    databaseUrl,
    source,
  };
}

/**
 * Obtiene la instancia del cliente Supabase con Service Role / Backend privileges.
 * Caches the client instance to prevent leaking connections.
 */
export function getSupabaseClient(): SupabaseClient | null {
  const config = getDatabaseConfig();

  if (!config.url || !config.key) {
    return null;
  }

  const cacheKey = `${config.url}::${config.key}`;
  if (cachedClient && cachedClientKey === cacheKey) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(config.url, config.key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    cachedClientKey = cacheKey;
    return cachedClient;
  } catch (err) {
    console.error("[SUPABASE] Error al instanciar cliente de base de datos:", err);
    return null;
  }
}

/**
 * Resetea la caché del cliente (útil en pruebas unitarias con simulación de variables)
 */
export function resetSupabaseClientCache(): void {
  cachedClient = null;
  cachedClientKey = null;
}
