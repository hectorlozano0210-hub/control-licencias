/**
 * ==============================================================================
 * COREAUTH CLIENT SDK - SOFTWARE INTEGRATION MODULE
 * ==============================================================================
 * Módulo cliente para integración en aplicaciones cliente (Next.js, React, Electron, Desktop).
 * 
 * Especificaciones de Producción:
 *  - Endpoint oficial: POST https://api-control-licencias.onrender.com/api/licenses/activate
 *  - Estructura Body: { license_key, device_fingerprint, device_name }
 *  - Huella de dispositivo (device_fingerprint) única y persistente en almacenamiento local.
 *  - Persistencia segura de token JWT, fecha 'offline_valid_until' y datos del plan.
 *  - Soporte de ejecución offline sin internet mientras offline_valid_until no expire.
 *  - Manejo y traducción amigable de errores: MAX_ACTIVATIONS_REACHED, LICENSE_NOT_FOUND, etc.
 */

export interface SdkConfig {
  serverUrl?: string;               // Default: "https://api-control-licencias.onrender.com"
  appSlug?: string;                 // Default: "coreauth-license-client"
  appVersion?: string;              // Default: "1.0.0"
  storageKey?: string;              // Default: "_coreauth_license_vault"
  heartbeatIntervalMs?: number;     // Default: 15 minutos (900000 ms)
  offlineGraceDays?: number;        // Default: 30 días
}

export interface ExpiryAlertPayload {
  showAlert: boolean;
  level: "none" | "notice" | "info" | "warning" | "urgent" | "critical";
  message: string | null;
  daysRemaining: number;
  expiresAt: string;
}

export interface StoredLicenseState {
  licenseKey: string;
  token: string;
  offlineValidUntil: string;
  planTier: string;
  activatedAt: string;
  lastVerifiedAt: string;
  expiresAt?: string | null;
  fingerprint: string;
  deviceName?: string;
  maxActivations?: number;
  currentActivations?: number;
}

export interface ActivationResponse {
  success: boolean;
  code: string;
  message: string;
  token?: string;
  license?: {
    id?: string;
    license_key?: string;
    plan_tier?: string;
    max_activations?: number;
    current_activations?: number;
    expires_at?: string | null;
  };
  offline_valid_until?: string;
}

export type ExpiryListener = (alert: ExpiryAlertPayload) => void;
export type StatusChangeListener = (status: "valid" | "expired" | "revoked" | "unlicensed" | "offline_grace") => void;

/**
 * Decodifica de forma segura la carga útil de un token JWT sin dependencias externas
 */
function parseJwtPayload(jwt: string): any {
  try {
    const parts = jwt.split(".");
    if (parts.length < 2) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

export class CoreAuthClient {
  public readonly config: Required<SdkConfig>;
  private expiryListeners: Set<ExpiryListener> = new Set();
  private statusListeners: Set<StatusChangeListener> = new Set();
  private heartbeatTimer: any = null;
  private currentFingerprint: string = "";

  constructor(config: SdkConfig = {}) {
    this.config = {
      serverUrl: (config.serverUrl || "https://api-control-licencias.onrender.com").replace(/\/$/, ""),
      appSlug: config.appSlug || "coreauth-license-client",
      appVersion: config.appVersion || "1.0.0",
      storageKey: config.storageKey || `_coreauth_${config.appSlug || "client"}_vault`,
      heartbeatIntervalMs: config.heartbeatIntervalMs || 15 * 60 * 1000,
      offlineGraceDays: config.offlineGraceDays || 30,
    };

    this.currentFingerprint = this.getOrGeneratePersistentFingerprint();
  }

  // --------------------------------------------------------------------------
  // 1. DEVICE FINGERPRINT ÚNICO Y PERSISTENTE
  // --------------------------------------------------------------------------
  private getOrGeneratePersistentFingerprint(): string {
    const FP_KEY = `_coreauth_device_fp_${this.config.appSlug}`;

    if (typeof window !== "undefined" && window.localStorage) {
      try {
        const saved = window.localStorage.getItem(FP_KEY);
        if (saved && saved.startsWith("hw_")) {
          return saved;
        }
      } catch (e) {
        // Fallback silencioso si localStorage está bloqueado
      }
    }

    const newFp = this.generateRawFingerprint();

    if (typeof window !== "undefined" && window.localStorage) {
      try {
        window.localStorage.setItem(FP_KEY, newFp);
      } catch (e) {
        // Fallback silencioso
      }
    }

    return newFp;
  }

  private generateRawFingerprint(): string {
    if (typeof window !== "undefined") {
      const nav = window.navigator;
      const screen = window.screen;
      const raw = [
        nav.userAgent || "browser",
        nav.language || "es",
        screen.colorDepth || 24,
        `${screen.width}x${screen.height}`,
        new Date().getTimezoneOffset(),
        (nav as any).hardwareConcurrency || 4,
        (nav as any).deviceMemory || 8,
      ].join("###");
      return this.hashStringToHwid(raw);
    } else {
      try {
        const os = require("os");
        const network = JSON.stringify(os.networkInterfaces());
        const cpus = JSON.stringify(os.cpus());
        const host = os.hostname();
        return this.hashStringToHwid(`${host}###${cpus}###${network}`);
      } catch {
        return this.hashStringToHwid(`node_generic_${this.config.appSlug}_${Date.now()}`);
      }
    }
  }

  private hashStringToHwid(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    const hex = Math.abs(hash).toString(16).padStart(8, "0");
    return `hw_${hex}_${this.config.appSlug}`;
  }

  public getDeviceFingerprint(): string {
    return this.currentFingerprint;
  }

  public getDefaultDeviceName(): string {
    if (typeof window !== "undefined") {
      const platform = window.navigator.platform || "Desktop";
      return `${platform}-Client-${this.currentFingerprint.slice(3, 8).toUpperCase()}`;
    }
    try {
      const os = require("os");
      return os.hostname() || "Workstation";
    } catch {
      return "Workstation";
    }
  }

  // --------------------------------------------------------------------------
  // 2. ALMACENAMIENTO LOCAL SEGURO
  // --------------------------------------------------------------------------
  public saveState(state: StoredLicenseState): void {
    try {
      const json = JSON.stringify(state);
      const obfuscated = btoa(encodeURIComponent(json));
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(this.config.storageKey, obfuscated);
      }
    } catch (e) {
      console.error("[CoreAuth] Error al persistir estado de licencia:", e);
    }
  }

  public getStoredState(): StoredLicenseState | null {
    try {
      if (typeof window === "undefined" || !window.localStorage) return null;
      const raw = window.localStorage.getItem(this.config.storageKey);
      if (!raw) return null;
      const json = decodeURIComponent(atob(raw));
      return JSON.parse(json) as StoredLicenseState;
    } catch (e) {
      return null;
    }
  }

  public clearLicense(): void {
    this.stopHeartbeat();
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        window.localStorage.removeItem(this.config.storageKey);
      } catch (e) {
        // Fallback
      }
    }
    this.notifyStatus("unlicensed");
  }

  // --------------------------------------------------------------------------
  // 3. ACTIVACIÓN OFICIAL (ENDPOINT DE PRODUCCIÓN)
  // --------------------------------------------------------------------------
  public async activate(licenseKey: string, deviceName?: string): Promise<{
    success: boolean;
    code: string;
    message: string;
    token?: string;
    offline_valid_until?: string;
    license?: StoredLicenseState;
  }> {
    const trimmedKey = licenseKey.trim();
    if (!trimmedKey) {
      return {
        success: false,
        code: "INVALID_KEY_FORMAT",
        message: "Por favor introduce una clave de licencia válida.",
      };
    }

    const finalDeviceName = deviceName?.trim() || this.getDefaultDeviceName();

    try {
      const targetUrl = `${this.config.serverUrl}/api/licenses/activate`;

      const response = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          license_key: trimmedKey,
          device_fingerprint: this.currentFingerprint,
          device_name: finalDeviceName,
        }),
      });

      const data: ActivationResponse = await response.json();

      if (!response.ok || !data.success) {
        const friendlyMessage = this.mapErrorCodeToMessage(data.code, data.message);
        return {
          success: false,
          code: data.code || "ACTIVATION_FAILED",
          message: friendlyMessage,
        };
      }

      // Extraer offline_valid_until del JWT recibido o del payload de respuesta
      let offlineValidUntil = data.offline_valid_until;
      let planTier = data.license?.plan_tier || "PRO";

      if (data.token) {
        const decoded = parseJwtPayload(data.token);
        if (decoded) {
          if (decoded.offline_valid_until) {
            offlineValidUntil = decoded.offline_valid_until;
          }
          if (decoded.plan_tier) {
            planTier = decoded.plan_tier;
          }
        }
      }

      // Si no viene en el token, calcular por defecto los días de gracia configurados (30 días)
      if (!offlineValidUntil) {
        const graceDate = new Date();
        graceDate.setDate(graceDate.getDate() + this.config.offlineGraceDays);
        offlineValidUntil = graceDate.toISOString();
      }

      const state: StoredLicenseState = {
        licenseKey: trimmedKey,
        token: data.token || "",
        offlineValidUntil,
        planTier,
        activatedAt: new Date().toISOString(),
        lastVerifiedAt: new Date().toISOString(),
        expiresAt: data.license?.expires_at || null,
        fingerprint: this.currentFingerprint,
        deviceName: finalDeviceName,
        maxActivations: data.license?.max_activations,
        currentActivations: data.license?.current_activations,
      };

      this.saveState(state);
      this.startHeartbeat(trimmedKey);
      this.notifyStatus("valid");

      return {
        success: true,
        code: data.code || "DEVICE_ACTIVATED",
        message: "Licencia activada con éxito en este equipo.",
        token: data.token,
        offline_valid_until: offlineValidUntil,
        license: state,
      };
    } catch (err: any) {
      return {
        success: false,
        code: "NETWORK_ERROR",
        message: "No fue posible conectar con el servidor de licencias. Verifica tu conexión a internet o intenta de nuevo.",
      };
    }
  }

  // --------------------------------------------------------------------------
  // 4. VERIFICACIÓN Y MODO OFFLINE
  // --------------------------------------------------------------------------
  public checkOfflineValidity(): {
    valid: boolean;
    offlineValidUntil?: string;
    daysRemaining: number;
    reason?: string;
  } {
    const stored = this.getStoredState();
    if (!stored || !stored.token || !stored.offlineValidUntil) {
      return { valid: false, daysRemaining: 0, reason: "No hay licencia registrada localmente." };
    }

    const expTime = new Date(stored.offlineValidUntil).getTime();
    const nowTime = Date.now();

    if (nowTime > expTime) {
      return {
        valid: false,
        offlineValidUntil: stored.offlineValidUntil,
        daysRemaining: 0,
        reason: "El período de gracia offline ha expirado.",
      };
    }

    const diffDays = Math.max(0, Math.ceil((expTime - nowTime) / (1000 * 60 * 60 * 24)));
    return {
      valid: true,
      offlineValidUntil: stored.offlineValidUntil,
      daysRemaining: diffDays,
    };
  }

  public async verify(): Promise<{
    valid: boolean;
    code: string;
    message: string;
    isOfflineMode?: boolean;
    offlineDaysRemaining?: number;
    license?: StoredLicenseState | null;
  }> {
    const stored = this.getStoredState();
    if (!stored || !stored.licenseKey) {
      this.notifyStatus("unlicensed");
      return {
        valid: false,
        code: "UNLICENSED",
        message: "Este software no cuenta con una licencia activa.",
      };
    }

    try {
      const response = await fetch(`${this.config.serverUrl}/api/licenses/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          license_key: stored.licenseKey,
          device_fingerprint: this.currentFingerprint,
        }),
      });

      const data = await response.json();

      if (response.ok && data.valid) {
        stored.lastVerifiedAt = new Date().toISOString();
        if (data.plan_tier) stored.planTier = data.plan_tier;
        this.saveState(stored);
        this.notifyStatus("valid");

        return {
          valid: true,
          code: "VALID_ONLINE",
          message: "Licencia verificada en línea correctamente.",
          license: stored,
        };
      } else {
        const code = data.code || "INVALID";
        if (code === "LICENSE_REVOKED") this.notifyStatus("revoked");
        else if (code === "LICENSE_EXPIRED") this.notifyStatus("expired");

        return {
          valid: false,
          code,
          message: this.mapErrorCodeToMessage(code, data.message),
          license: stored,
        };
      }
    } catch (networkError) {
      // Fallback: Modo Offline seguro con offline_valid_until
      const offlineStatus = this.checkOfflineValidity();
      if (offlineStatus.valid) {
        this.notifyStatus("offline_grace");
        return {
          valid: true,
          code: "OFFLINE_GRACE_ACTIVE",
          message: `Operando en modo offline seguro. Restan ${offlineStatus.daysRemaining} días de gracia.`,
          isOfflineMode: true,
          offlineDaysRemaining: offlineStatus.daysRemaining,
          license: stored,
        };
      }

      this.notifyStatus("expired");
      return {
        valid: false,
        code: "OFFLINE_GRACE_EXPIRED",
        message: "El período offline permitido para este software ha vencido. Conéctate a internet para revalidar tu licencia.",
        license: stored,
      };
    }
  }

  // --------------------------------------------------------------------------
  // 5. HEARTBEAT AUTOMÁTICO
  // --------------------------------------------------------------------------
  public startHeartbeat(licenseKey?: string): void {
    this.stopHeartbeat();
    const key = licenseKey || this.getStoredState()?.licenseKey;
    if (!key) return;

    this.heartbeatTimer = setInterval(async () => {
      try {
        await fetch(`${this.config.serverUrl}/api/licenses/validate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            license_key: key,
            device_fingerprint: this.currentFingerprint,
          }),
        });
      } catch (e) {
        // Silencioso ante fallos temporales de heartbeat
      }
    }, this.config.heartbeatIntervalMs);
  }

  public stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // --------------------------------------------------------------------------
  // 6. MAPEO DE ERRORES AMIGABLES
  // --------------------------------------------------------------------------
  public mapErrorCodeToMessage(code?: string, originalMessage?: string): string {
    switch (code) {
      case "MAX_ACTIVATIONS_REACHED":
        return "Se ha alcanzado el límite máximo de dispositivos permitidos para esta licencia. Desactiva un equipo previo o actualiza tu plan para añadir más cupos.";
      case "LICENSE_NOT_FOUND":
        return "La clave de licencia ingresada no existe o fue escrita incorrectamente. Revisa los caracteres e intenta nuevamente.";
      case "LICENSE_EXPIRED":
        return "Esta clave de licencia ha vencido. Contacta a soporte o al administrador para renovarla.";
      case "LICENSE_REVOKED":
        return "La licencia ha sido revocada o suspendida por el administrador del sistema.";
      case "DEVICE_NOT_FOUND":
        return "El dispositivo no está registrado para esta licencia. Realiza la activación inicial.";
      case "RATE_LIMIT_EXCEEDED":
        return "Demasiadas solicitudes en poco tiempo. Por favor espera unos segundos antes de reintentar.";
      default:
        return originalMessage || "Ocurrió un error inesperado al procesar la licencia.";
    }
  }

  // --------------------------------------------------------------------------
  // 7. LISTENERS REACTIVOS
  // --------------------------------------------------------------------------
  public onExpiryAlert(listener: ExpiryListener): () => void {
    this.expiryListeners.add(listener);
    return () => this.expiryListeners.delete(listener);
  }

  public onStatusChange(listener: StatusChangeListener): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  private notifyStatus(status: "valid" | "expired" | "revoked" | "unlicensed" | "offline_grace"): void {
    this.statusListeners.forEach((listener) => {
      try { listener(status); } catch (e) { console.error(e); }
    });
  }
}

// Instancia singleton por defecto configurada para producción
export const defaultLicenseClient = new CoreAuthClient();
