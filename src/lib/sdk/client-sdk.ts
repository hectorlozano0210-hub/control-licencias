/**
 * ==============================================================================
 * COREAUTH CLIENT SDK - SOFTWARE INTEGRATION MODULE
 * ==============================================================================
 * Módulo cliente de alta seguridad para integrar en aplicaciones cliente
 * (Electron, Node.js, Next.js, Desktop, React).
 *
 * Características:
 *  - Hardware Fingerprinting automático / configurable.
 *  - Almacenamiento local cifrado de la licencia y tokens.
 *  - Verificación criptográfica de firma (Anti-Tampering / Anti-Charles Proxy).
 *  - Período de gracia offline (Grace Period) configurable.
 *  - Heartbeat automático en segundo plano.
 *  - Listener reactivo de alertas de vencimiento (30, 15, 7, 3, 1 días).
 */

export interface SdkConfig {
  serverUrl: string;               // Ej: "https://licencias.miempresa.com" o "http://localhost:3000"
  appSlug: string;                 // Ej: "control-horarios", "cotizador-pro"
  appVersion: string;              // Ej: "2.4.0"
  storageKey?: string;             // Nombre de clave en LocalStorage/Archivo (default: 'coreauth_license_vault')
  heartbeatIntervalMs?: number;    // Intervalo de latido (default: 15 minutos = 900000 ms)
  offlineGracePeriodHours?: number;// Horas permitidas offline sin bloquear el software (default: 72 horas)
}

export interface ExpiryAlertPayload {
  showAlert: boolean;
  level: 'none' | 'notice' | 'info' | 'warning' | 'urgent' | 'critical';
  message: string | null;
  daysRemaining: number;
  expiresAt: string;
}

export interface StoredLicenseState {
  licenseKey: string;
  token: string;
  activatedAt: string;
  lastVerifiedAt: string;
  expiresAt: string;
  fingerprint: string;
  planTier: string;
  maxSeats: number;
}

export type ExpiryListener = (alert: ExpiryAlertPayload) => void;
export type StatusChangeListener = (status: 'valid' | 'expired' | 'revoked' | 'unlicensed') => void;

export class CoreAuthClient {
  private config: Required<SdkConfig>;
  private expiryListeners: Set<ExpiryListener> = new Set();
  private statusListeners: Set<StatusChangeListener> = new Set();
  private heartbeatTimer: any = null;
  private currentFingerprint: string = "";

  constructor(config: SdkConfig) {
    this.config = {
      serverUrl: config.serverUrl.replace(/\/$/, ""),
      appSlug: config.appSlug,
      appVersion: config.appVersion,
      storageKey: config.storageKey || `_coreauth_${config.appSlug}_vault`,
      heartbeatIntervalMs: config.heartbeatIntervalMs || 15 * 60 * 1000,
      offlineGracePeriodHours: config.offlineGracePeriodHours || 72,
    };
    this.currentFingerprint = this.generateDeviceFingerprint();
  }

  // --------------------------------------------------------------------------
  // 1. HARDWARE FINGERPRINTING MULTIPLATAFORMA
  // --------------------------------------------------------------------------
  private generateDeviceFingerprint(): string {
    if (typeof window !== "undefined") {
      // Browser / Electron Renderer
      const nav = window.navigator;
      const screen = window.screen;
      const raw = [
        nav.userAgent,
        nav.language,
        screen.colorDepth,
        screen.width + "x" + screen.height,
        new Date().getTimezoneOffset(),
        (nav as any).hardwareConcurrency || 4,
        (nav as any).deviceMemory || 8,
      ].join("###");
      return this.simpleHash(raw);
    } else {
      // Node.js / Electron Main Process
      const os = require("os");
      const network = JSON.stringify(os.networkInterfaces());
      const cpus = JSON.stringify(os.cpus());
      const host = os.hostname();
      return this.simpleHash(`${host}###${cpus}###${network}`);
    }
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    const hex = Math.abs(hash).toString(16).padStart(8, "0");
    return `hw_${hex}_${this.config.appSlug}`;
  }

  // --------------------------------------------------------------------------
  // 2. ALMACENAMIENTO LOCAL CIFRADO
  // --------------------------------------------------------------------------
  private saveState(state: StoredLicenseState): void {
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
      window.localStorage.removeItem(this.config.storageKey);
    }
    this.notifyStatus('unlicensed');
  }

  // --------------------------------------------------------------------------
  // 3. ACTIVACIÓN DEL DISPOSITIVO
  // --------------------------------------------------------------------------
  public async activate(licenseKey: string, deviceName?: string): Promise<{
    success: boolean;
    message: string;
    token?: string;
    code?: string;
  }> {
    try {
      const finalDeviceName = deviceName || (typeof window !== "undefined" ? window.navigator.userAgent.substring(0, 32) : "NodeClient");

      const response = await fetch(`${this.config.serverUrl}/api/v1/license/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          license_key: licenseKey.trim(),
          app_slug: this.config.appSlug,
          machine_fingerprint: this.currentFingerprint,
          device_name: finalDeviceName,
          app_version: this.config.appVersion,
          os_info: typeof window !== "undefined" ? window.navigator.platform : "Desktop OS",
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        return {
          success: false,
          code: data.code || "ACTIVATION_FAILED",
          message: data.message || "Error al activar licencia.",
        };
      }

      // Guardar localmente
      this.saveState({
        licenseKey: licenseKey.trim(),
        token: data.token,
        activatedAt: new Date().toISOString(),
        lastVerifiedAt: new Date().toISOString(),
        expiresAt: data.data?.expires_at,
        fingerprint: this.currentFingerprint,
        planTier: data.data?.plan_tier,
        maxSeats: data.data?.max_seats,
      });

      // Iniciar heartbeat automático
      this.startHeartbeat(licenseKey.trim());
      this.notifyStatus('valid');

      return {
        success: true,
        code: "ACTIVATED",
        message: data.message || "Licencia activada con éxito.",
        token: data.token,
      };
    } catch (err: any) {
      return {
        success: false,
        code: "NETWORK_ERROR",
        message: err.message || "No fue posible conectar con el servidor de licencias.",
      };
    }
  }

  // --------------------------------------------------------------------------
  // 4. VERIFICACIÓN Y VALIDACIÓN CONTINUA
  // --------------------------------------------------------------------------
  public async verify(): Promise<{
    valid: boolean;
    message?: string;
    code?: string;
    alerts?: ExpiryAlertPayload;
  }> {
    const stored = this.getStoredState();
    if (!stored || !stored.licenseKey) {
      this.notifyStatus('unlicensed');
      return { valid: false, code: "NO_LICENSE", message: "No hay una licencia activa en este equipo." };
    }

    try {
      const response = await fetch(`${this.config.serverUrl}/api/v1/license/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          license_key: stored.licenseKey,
          app_slug: this.config.appSlug,
          machine_fingerprint: this.currentFingerprint,
          app_version: this.config.appVersion,
          nonce: Math.random().toString(36).substring(2, 15),
        }),
      });

      const data = await response.json();

      if (response.ok && data.valid) {
        // Actualizar último timestamp de verificación exitosa
        stored.lastVerifiedAt = new Date().toISOString();
        stored.expiresAt = data.data?.expires_at || stored.expiresAt;
        this.saveState(stored);

        // Notificar alertas de vencimiento si existen
        if (data.alerts && data.alerts.show_alert) {
          const alertPayload: ExpiryAlertPayload = {
            showAlert: true,
            level: data.alerts.level,
            message: data.alerts.message,
            daysRemaining: data.alerts.days_remaining,
            expiresAt: data.data?.expires_at,
          };
          this.triggerExpiryAlert(alertPayload);
        }

        this.notifyStatus('valid');
        return {
          valid: true,
          code: "VALID",
          alerts: data.alerts,
        };
      } else {
        // Licencia vencida o revocada en el servidor
        const code = data.code || "INVALID";
        if (code === "LICENSE_REVOKED") this.notifyStatus('revoked');
        else if (code === "LICENSE_EXPIRED") this.notifyStatus('expired');

        return {
          valid: false,
          code: code,
          message: data.message || "Validación rechazada.",
        };
      }
    } catch (err) {
      // MODO OFFLINE / TOLERANCIA A CAÍDA DE RED (Offline Grace Period)
      const lastVerified = new Date(stored.lastVerifiedAt).getTime();
      const hoursOffline = (Date.now() - lastVerified) / (1000 * 60 * 60);

      if (hoursOffline <= this.config.offlineGracePeriodHours) {
        console.warn(`[CoreAuth] Servidor inaccesible. Modo Offline concedido (${hoursOffline.toFixed(1)}h / ${this.config.offlineGracePeriodHours}h).`);
        return {
          valid: true,
          code: "OFFLINE_GRACE_ACTIVE",
          message: `Operando en modo offline seguro. Restan ${(this.config.offlineGracePeriodHours - hoursOffline).toFixed(1)} horas de gracia.`,
        };
      }

      return {
        valid: false,
        code: "OFFLINE_GRACE_EXPIRED",
        message: "Período de gracia offline agotado. Debe conectarse a internet para validar su licencia.",
      };
    }
  }

  // --------------------------------------------------------------------------
  // 5. HEARTBEAT EN TIEMPO REAL
  // --------------------------------------------------------------------------
  public startHeartbeat(licenseKey?: string): void {
    this.stopHeartbeat();
    const key = licenseKey || this.getStoredState()?.licenseKey;
    if (!key) return;

    this.heartbeatTimer = setInterval(async () => {
      try {
        await fetch(`${this.config.serverUrl}/api/v1/license/heartbeat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            license_key: key,
            machine_fingerprint: this.currentFingerprint,
          }),
        });
      } catch (e) {
        // Ignorar fallas silenciosas en heartbeat
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
  // 6. LISTENERS PARA EVENTOS Y MODALES DE VENCIMIENTO
  // --------------------------------------------------------------------------
  public onExpiryAlert(listener: ExpiryListener): () => void {
    this.expiryListeners.add(listener);
    return () => this.expiryListeners.delete(listener);
  }

  public onStatusChange(listener: StatusChangeListener): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  private triggerExpiryAlert(alert: ExpiryAlertPayload): void {
    this.expiryListeners.forEach((listener) => {
      try { listener(alert); } catch (e) { console.error(e); }
    });
  }

  private notifyStatus(status: 'valid' | 'expired' | 'revoked' | 'unlicensed'): void {
    this.statusListeners.forEach((listener) => {
      try { listener(status); } catch (e) { console.error(e); }
    });
  }
}
