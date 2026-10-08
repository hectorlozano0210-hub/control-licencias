import { NextRequest, NextResponse } from "next/server";
import { rateLimiter, RouteTier } from "@/lib/security/rate-limiter";

/**
 * Resuelve la IP real del cliente implementando Trust Proxy
 * compatible con Cloudflare (CF-Connecting-IP), Nginx/ALB (X-Real-IP)
 * y proxies inversos estándares (X-Forwarded-For).
 */
export function resolveClientIp(request: NextRequest): string {
  // 1. Cloudflare CDN
  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();

  // 2. Nginx / AWS ALB / Reverse Proxy
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  // 3. Cadena estándar X-Forwarded-For (tomar la primera IP de la cadena)
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0].trim();
    if (firstIp) return firstIp;
  }

  // 4. Fallback seguro
  return "127.0.0.1";
}

/**
 * Obtiene los orígenes autorizados para CORS
 * En producción se exige coincidencia estricta con FRONTEND_URL y se prohíben comodines (*).
 */
function getAllowedOrigins(): string[] {
  const isProduction = process.env.NODE_ENV === "production";
  const frontendUrl = process.env.FRONTEND_URL;
  const corsOrigins = process.env.CORS_ALLOWED_ORIGINS;

  const origins: string[] = [];

  if (frontendUrl) {
    frontendUrl.split(",").forEach((o) => {
      const trimmed = o.trim();
      if (trimmed && (trimmed !== "*" || !isProduction)) {
        origins.push(trimmed);
      }
    });
  }

  if (corsOrigins) {
    corsOrigins.split(",").forEach((o) => {
      const trimmed = o.trim();
      if (trimmed && (trimmed !== "*" || !isProduction)) {
        origins.push(trimmed);
      }
    });
  }

  // En desarrollo, permitir localhost por defecto si no hay orígenes configurados
  if (origins.length === 0 && !isProduction) {
    origins.push("http://localhost:3000", "http://127.0.0.1:3000");
  }

  return origins;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const origin = request.headers.get("origin") || "";
  const isProduction = process.env.NODE_ENV === "production";
  const allowedOrigins = getAllowedOrigins();

  // En producción se prohíbe explícitamente el comodín '*'
  const isAllowedOrigin =
    !origin ||
    allowedOrigins.includes(origin) ||
    (!isProduction && allowedOrigins.includes("*"));

  // =========================================================================
  // 1. GESTIÓN DE CORS (Preflight OPTIONS)
  // =========================================================================
  if (request.method === "OPTIONS") {
    // Si viene de un origen no autorizado en producción, rechazar preflight
    if (origin && !isAllowedOrigin && isProduction) {
      return new NextResponse(null, { status: 403 });
    }

    const preflightHeaders = new Headers();
    if (isAllowedOrigin && origin) {
      preflightHeaders.set("Access-Control-Allow-Origin", origin);
      preflightHeaders.set("Access-Control-Allow-Credentials", "true");
    }
    preflightHeaders.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PATCH, PUT, DELETE, OPTIONS"
    );
    preflightHeaders.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Requested-With, Idempotency-Key"
    );
    preflightHeaders.set("Access-Control-Max-Age", "86400");

    return new NextResponse(null, { status: 204, headers: preflightHeaders });
  }

  // =========================================================================
  // 2. EXCLUSIÓN DE HEALTH CHECKS Y LIVENESS DEL RATE LIMITING
  // =========================================================================
  const isHealthProbe =
    pathname === "/live" ||
    pathname === "/health" ||
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/api/live");

  // =========================================================================
  // 3. RATE LIMITING ESCALONADO PARA RUTAS DE API
  // =========================================================================
  let rateLimitResponse: NextResponse | null = null;
  let limitHeaders: Record<string, string> = {};

  if (!isHealthProbe && pathname.startsWith("/api/")) {
    const ip = resolveClientIp(request);

    // Clasificación de rutas por nivel de criticidad
    let tier: RouteTier = "standard";
    if (
      pathname.includes("/license/activate") ||
      pathname.includes("/license/verify") ||
      pathname.startsWith("/api/licenses")
    ) {
      tier = "auth";
    } else if (
      pathname.includes("/payments/manual") ||
      pathname.includes("/webhooks/payment")
    ) {
      tier = "transactional";
    } else if (
      pathname.includes("/licenses") ||
      pathname.includes("/clients") ||
      pathname.includes("/devices")
    ) {
      tier = "sensitive";
    }

    // Comprobación de Rate Limiting
    const rateCheck = rateLimiter.check(ip, pathname, tier);
    limitHeaders = {
      "RateLimit-Limit": String(rateCheck.limit),
      "RateLimit-Remaining": String(rateCheck.remaining),
      "RateLimit-Reset": String(rateCheck.resetSeconds),
    };

    if (!rateCheck.allowed) {
      rateLimitResponse = NextResponse.json(
        {
          error: "TOO_MANY_REQUESTS",
          message: `Límite de peticiones excedido para esta operación. Por favor intenta de nuevo en ${rateCheck.resetSeconds} segundos.`,
          retry_after: rateCheck.resetSeconds,
        },
        {
          status: 429,
          headers: {
            ...limitHeaders,
            "Retry-After": String(rateCheck.resetSeconds),
            "Content-Type": "application/json",
          },
        }
      );
    }
  }

  // Si fue bloqueado por rate limit, retornamos inmediatamente con cabeceras de seguridad
  const response = rateLimitResponse || NextResponse.next();

  // Inyectar cabeceras de RateLimit en la respuesta si aplica
  for (const [k, v] of Object.entries(limitHeaders)) {
    response.headers.set(k, v);
  }

  // =========================================================================
  // 4. CABECERAS DE SEGURIDAD DEFENSIVAS (DEFENSE IN DEPTH)
  // =========================================================================
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  );

  // Content Security Policy
  const cspHeader = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https: ws: wss:",
    "frame-ancestors 'none'",
  ].join("; ");

  response.headers.set("Content-Security-Policy", cspHeader);

  // CORS en respuestas exitosas o regulares
  if (isAllowedOrigin && origin) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Credentials", "true");
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Coincidir con todas las rutas excepto archivos estáticos de Next.js y favicon
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
