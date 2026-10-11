"use client";

const STORAGE_KEY = "coreauth_master_station_uuid";

/**
 * Genera o recupera un identificador persistente único para este navegador/portátil
 */
function getOrCreateStationUuid(): string {
  if (typeof window === "undefined") return "server-ssr";
  try {
    let id = localStorage.getItem(STORAGE_KEY);
    if (!id) {
      if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        id = crypto.randomUUID();
      } else {
        id = `hwid_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      }
      localStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  } catch {
    return "volatile-storage-fallback";
  }
}

/**
 * Genera una firma visual 2D en Canvas para capturar características del motor gráfico
 */
function getCanvasFingerprint(): string {
  if (typeof window === "undefined" || typeof document === "undefined") return "no-canvas";
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 240;
    canvas.height = 60;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "no-2d-context";

    ctx.textBaseline = "top";
    ctx.font = "14px 'Arial', sans-serif";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#f60";
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = "#069";
    ctx.fillText("CoreAuth Master Station 🔒", 2, 15);
    ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
    ctx.fillText("FixPC Joyerías ERP 2026", 4, 35);

    return canvas.toDataURL().substring(0, 100);
  } catch {
    return "canvas-err";
  }
}

/**
 * Calcula la huella digital criptográfica del dispositivo físico del cliente (SHA-256)
 */
export async function getClientDeviceFingerprint(): Promise<string> {
  if (typeof window === "undefined") return "SERVER_STATION_ENV";

  try {
    const persistentId = getOrCreateStationUuid();
    const userAgent = navigator.userAgent || "ua-unknown";
    const language = navigator.language || "es";
    const platform = (navigator as any).userAgentData?.platform || navigator.platform || "unknown";
    const screenRes = `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`;
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const concurrency = navigator.hardwareConcurrency || 4;
    const canvasHash = getCanvasFingerprint();

    const rawEntropy = [
      persistentId,
      userAgent,
      platform,
      language,
      screenRes,
      timeZone,
      concurrency,
      canvasHash,
    ].join("|#|");

    const encoder = new TextEncoder();
    const data = encoder.encode(rawEntropy);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hexHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    return `MFP-STATION-${hexHash.substring(0, 32).toUpperCase()}`;
  } catch (err) {
    console.error("[DEVICE-FINGERPRINT] Error calculando huella digital:", err);
    return `MFP-STATION-FALLBACK-${Date.now().toString(16).toUpperCase()}`;
  }
}

/**
 * Formatea la huella para visualización limpia en insignias
 */
export function formatFingerprintPreview(fp: string): string {
  if (!fp) return "Detectando...";
  if (fp.length <= 24) return fp;
  return `${fp.substring(0, 15)}...${fp.substring(fp.length - 6)}`;
}
