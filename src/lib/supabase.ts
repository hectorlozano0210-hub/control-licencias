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
 * Sanitiza exhaustivamente la URL de Supabase para cumplir:
 * 1. Comenzar estrictamente con 'https://'
 * 2. Sin comillas escapadas (\", \'), comillas simples, dobles o backticks
 * 3. Sin espacios ocultos, saltos de línea (\r, \n, \t)
 * 4. Sin sufijos de ruta como /rest/v1, /auth/v1 ni barras finales
 */
export function sanitizeSupabaseUrl(rawUrl: string | null | undefined): string | null {
  if (!rawUrl || typeof rawUrl !== "string") return null;

  // 1. Eliminar comillas escapadas, comillas simples, dobles, backticks, saltos de línea y espacios ocultos
  let cleaned = rawUrl
    .replace(/\\"/g, "")
    .replace(/\\'/g, "")
    .replace(/["'`]/g, "")
    .replace(/[\r\n\t]/g, "")
    .trim();

  if (!cleaned) return null;

  // 2. Si comienza con http://, forzar https://. Si no tiene protocolo, anteponer https://
  if (cleaned.startsWith("http://")) {
    cleaned = "https://" + cleaned.slice(7);
  } else if (!cleaned.startsWith("https://")) {
    cleaned = "https://" + cleaned.replace(/^\/+/, "");
  }

  // 3. Eliminar sufijos de ruta (/rest/v1, /auth/v1, rutas adicionales o trailing slashes)
  try {
    const parsed = new URL(cleaned);
    // parsed.host contiene estrictamente hostname (+ puerto si existiese)
    cleaned = `https://${parsed.host}`;
  } catch {
    // Fallback si URL() fallara por caracteres residuales
    cleaned = cleaned.replace(/^(https:\/\/[^\/\s]+).*$/, "$1");
  }

  // 4. Garantizar estrictamente que elimine cualquier prefijo/sufijo de API si viene configurado por error
  cleaned = cleaned.replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "");

  if (!cleaned.startsWith("https://")) {
    cleaned = `https://${cleaned.replace(/^https?:\/\//, "")}`;
  }

  // Sanitización final: sin prefijo/sufijo de API ni barras finales
  cleaned = cleaned.replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "");

  return cleaned;
}

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

  const trimmed = dbUrl
    .replace(/\\"/g, "")
    .replace(/\\'/g, "")
    .replace(/["'`]/g, "")
    .trim();

  // 1. Si ya es una URL HTTP/HTTPS
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return sanitizeSupabaseUrl(trimmed);
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
  const rawDirect = process.env.SUPABASE_URL || "";
  const rawPublic = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const databaseUrl = process.env.DATABASE_URL || null;

  const directUrl = sanitizeSupabaseUrl(rawDirect);
  const publicUrl = sanitizeSupabaseUrl(rawPublic);

  const rawKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    null;

  const key = rawKey
    ? rawKey
        .replace(/\\"/g, "")
        .replace(/\\'/g, "")
        .replace(/["'`]/g, "")
        .replace(/[\r\n\t\s]/g, "")
        .trim()
    : null;

  let url: string | null = null;
  let source: DatabaseConfig["source"] = "none";

  if (directUrl) {
    url = directUrl;
    source = "SUPABASE_URL";
  } else if (publicUrl) {
    url = publicUrl;
    source = "NEXT_PUBLIC_SUPABASE_URL";
  } else if (databaseUrl && databaseUrl.trim().length > 0) {
    const extracted = extractSupabaseUrlFromDatabaseUrl(databaseUrl);
    if (extracted) {
      url = sanitizeSupabaseUrl(extracted);
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

  let cleanUrl = sanitizeSupabaseUrl(config.url) || config.url;
  cleanUrl = cleanUrl.replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "");
  const cacheKey = `${cleanUrl}::${config.key}`;
  if (cachedClient && cachedClientKey === cacheKey) {
    return cachedClient;
  }

  try {
    // Evitar que RealtimeClient falle en Node.js < 22 si WebSocket global no está definido
    if (typeof globalThis !== "undefined" && typeof (globalThis as any).WebSocket === "undefined") {
      (globalThis as any).WebSocket = class StubWebSocket {
        static CLOSED = 3;
        readyState = 3;
        close() {}
        send() {}
      };
    }

    console.log("[DEBUG SUPABASE URL]:", JSON.stringify(cleanUrl));
    console.log("[DEBUG KEY LENGTH]:", config.key ? config.key.length : 0);

    cachedClient = createClient(cleanUrl, config.key, {
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
