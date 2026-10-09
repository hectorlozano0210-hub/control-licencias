# ==============================================================================
# Dockerfile Multi-Stage Optimizado para Producción (Render / Cloud / Standalone)
# ==============================================================================

# 1. Base Image
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# 2. Stage Dependencies
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# 3. Stage Builder
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Deshabilitar telemetría de Next.js durante la compilación
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Variables dummy para el paso de compilación estática (next build)
ENV NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder

# Limitar memoria de Node para prevenir saturación y cuelgues en contenedores
ENV NODE_OPTIONS="--max-old-space-size=1024"

# Compilación estricta sin pruebas ni llamadas externas
RUN npm run build

# 4. Stage Runner (Lightweight Production Image)
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8080
ENV HOSTNAME="0.0.0.0"

# Crear usuario y grupo no privilegiado appuser (Seguridad: Least Privilege)
RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 -G appgroup appuser

# Copiar artefactos optimizados de la etapa builder
COPY --from=builder /app/public ./public
COPY --from=builder --chown=appuser:appgroup /app/.next/standalone ./
COPY --from=builder --chown=appuser:appgroup /app/.next/static ./.next/static

# Asignar permisos y cambiar a usuario no privilegiado appuser
USER appuser

EXPOSE 8080

CMD ["node", "server.js"]
