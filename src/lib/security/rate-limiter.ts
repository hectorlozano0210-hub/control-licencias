/**
 * Rate Limiter con ventana deslizante en memoria y soporte de Idempotencia
 * RFC 6585 & RFC draft RateLimit headers compatibles
 */

interface RateLimitConfig {
  max: number; // Número máximo de peticiones permitidas
  windowMs: number; // Ventana de tiempo en milisegundos
}

interface ClientRecord {
  timestamps: number[];
}

export type RouteTier = "auth" | "transactional" | "sensitive" | "standard";

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
}

class MemoryRateLimiter {
  private records: Map<string, ClientRecord> = new Map();
  private idempotencyStore: Map<string, { status: number; body: string; expiresAt: number }> = new Map();
  private lastCleanup: number = Date.now();

  private getConfigForTier(tier: RouteTier): RateLimitConfig {
    switch (tier) {
      case "auth":
        // Rutas de autenticación / activación de claves: 10 peticiones cada 15 min por defecto
        return {
          max: Number(process.env.RATE_LIMIT_AUTH_MAX || 15),
          windowMs: Number(process.env.RATE_LIMIT_AUTH_WINDOW_MS || 15 * 60 * 1000),
        };
      case "transactional":
        // Rutas transaccionales / pagos: 25 peticiones cada 1 min por defecto
        return {
          max: Number(process.env.RATE_LIMIT_TRANSACTIONAL_MAX || 25),
          windowMs: Number(process.env.RATE_LIMIT_TRANSACTIONAL_WINDOW_MS || 60 * 1000),
        };
      case "sensitive":
        // Gestión de licencias y clientes: 50 peticiones cada 1 min
        return {
          max: Number(process.env.RATE_LIMIT_SENSITIVE_MAX || 50),
          windowMs: Number(process.env.RATE_LIMIT_SENSITIVE_WINDOW_MS || 60 * 1000),
        };
      case "standard":
      default:
        // Pings / heartbeats / stats generales: 120 peticiones cada 1 min
        return {
          max: Number(process.env.RATE_LIMIT_STANDARD_MAX || 120),
          windowMs: Number(process.env.RATE_LIMIT_STANDARD_WINDOW_MS || 60 * 1000),
        };
    }
  }

  public check(ip: string, routeKey: string, tier: RouteTier): RateLimitResult {
    this.cleanupIfNeeded();

    const config = this.getConfigForTier(tier);
    const key = `${tier}:${routeKey}:${ip}`;
    const now = Date.now();
    const windowStart = now - config.windowMs;

    let record = this.records.get(key);
    if (!record) {
      record = { timestamps: [] };
      this.records.set(key, record);
    }

    // Filtrar timestamps fuera de la ventana
    record.timestamps = record.timestamps.filter((ts) => ts > windowStart);

    const count = record.timestamps.length;
    const allowed = count < config.max;

    if (allowed) {
      record.timestamps.push(now);
    }

    const oldestTimestamp = record.timestamps[0] || now;
    const resetSeconds = Math.max(1, Math.ceil((oldestTimestamp + config.windowMs - now) / 1000));
    const remaining = Math.max(0, config.max - record.timestamps.length);

    return {
      allowed,
      limit: config.max,
      remaining,
      resetSeconds,
    };
  }

  // Idempotency check para pagos o transacciones duplicadas
  public getIdempotentResponse(idempotencyKey: string) {
    const entry = this.idempotencyStore.get(idempotencyKey);
    if (entry && entry.expiresAt > Date.now()) {
      return entry;
    }
    return null;
  }

  public setIdempotentResponse(idempotencyKey: string, status: number, body: string, ttlMs = 86400000) {
    this.idempotencyStore.set(idempotencyKey, {
      status,
      body,
      expiresAt: Date.now() + ttlMs,
    });
  }

  // Limpieza periódica para evitar fugas de memoria
  private cleanupIfNeeded() {
    const now = Date.now();
    if (now - this.lastCleanup > 60000) {
      this.lastCleanup = now;
      for (const [key, record] of this.records.entries()) {
        const activeTimestamps = record.timestamps.filter((ts) => ts > now - 15 * 60 * 1000);
        if (activeTimestamps.length === 0) {
          this.records.delete(key);
        } else {
          record.timestamps = activeTimestamps;
        }
      }

      for (const [idKey, entry] of this.idempotencyStore.entries()) {
        if (entry.expiresAt <= now) {
          this.idempotencyStore.delete(idKey);
        }
      }
    }
  }

  // Método para testing: reiniciar contadores
  public reset() {
    this.records.clear();
    this.idempotencyStore.clear();
  }

  public resetAll() {
    this.reset();
  }

  public checkIdempotency(idempotencyKey: string): boolean {
    return this.getIdempotentResponse(idempotencyKey) !== null;
  }

  public recordIdempotency(idempotencyKey: string, data: any, ttlMs = 86400000) {
    this.setIdempotentResponse(idempotencyKey, 200, JSON.stringify(data), ttlMs);
  }
}

export const rateLimiter = new MemoryRateLimiter();
