"use client";

import React, { useState } from "react";
import {
  Code2,
  Copy,
  Check,
  Terminal,
  FileCode,
  ShieldCheck,
  Lock,
  Cpu,
  Layers,
  Sparkles,
  Clock,
} from "lucide-react";

export function SdkDocsView() {
  const [activeTab, setActiveTab] = useState<"node" | "python" | "rest">("node");
  const [copiedTab, setCopiedTab] = useState<string | null>(null);

  const handleCopy = (tab: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedTab(tab);
    setTimeout(() => setCopiedTab(null), 2000);
  };

  const nodeCode = `// 1. Instalar dependencias en tu proyecto Electron / Node:
// npm install crypto os

import { CoreAuthClient } from "./lib/sdk/client-sdk";

// Inicializar el SDK para tu aplicación
const licenseClient = new CoreAuthClient({
  apiUrl: "https://tudominio.com/api/v1",
  appSlug: "control-horarios",
  appVersion: "2.4.0",
  cacheFilePath: "./license_cache.dat" // Token cifrado para soporte offline
});

async function main() {
  const licenseKey = "PROD-ENT-8F12-9A4B-3C2D-1E7F";

  console.log("Activando equipo...");
  const activation = await licenseClient.activate(licenseKey, "WORKSTATION-MAIN");

  if (!activation.success) {
    console.error("Error al activar:", activation.error);
    return;
  }

  console.log("¡Activación exitosa! Cupos:", activation.license.max_seats);

  // Iniciar heartbeats automáticos cada 5 minutos
  licenseClient.startAutoHeartbeat(5);

  // Verificar estado y alertas de expiración
  const check = await licenseClient.verify();
  if (check.alerts?.show_alert) {
    console.warn("ALERTA DE LICENCIA:", check.alerts.message);
  }
}

main();`;

  const pythonCode = `import requests
import hashlib
import uuid
import platform
import json

API_BASE = "https://tudominio.com/api/v1"
APP_SLUG = "control-horarios"
APP_VERSION = "2.4.0"

def get_hwid():
    """Genera huella SHA-256 única del procesador y tarjeta madre"""
    node_id = str(uuid.getnode())
    system_data = f"{platform.node()}-{platform.processor()}-{node_id}"
    return hashlib.sha256(system_data.encode()).hexdigest()

def activate_license(license_key):
    hwid = get_hwid()
    payload = {
        "license_key": license_key,
        "app_slug": APP_SLUG,
        "machine_fingerprint": hwid,
        "device_name": platform.node(),
        "os_info": f"{platform.system()} {platform.release()}",
        "app_version": APP_VERSION
    }
    
    resp = requests.post(f"{API_BASE}/license/activate", json=payload)
    data = resp.json()
    
    if data.get("success"):
        print("✓ Software activado correctamente!")
        print(f"Token Offline: {data.get('offline_token')[:32]}...")
        return data
    else:
        print(f"✗ Activación rechazada: {data.get('message')}")
        return None

# Ejemplo de uso:
if __name__ == "__main__":
    activate_license("PROD-ENT-8F12-9A4B-3C2D-1E7F")`;

  const restCode = `# 1. ACTIVACIÓN DE EQUIPO (Descuenta 1 cupo y emite token offline)
curl -X POST https://tudominio.com/api/licenses/activate \\
  -H "Content-Type: application/json" \\
  -d '{
    "license_key": "PROD-ENT-8F12-9A4B-3C2D-1E7F",
    "device_fingerprint": "hwid_e3b0c44298fc1c149afbf4c8996fb924",
    "device_name": "TERMINAL-01"
  }'

# 2. VALIDACIÓN PERIÓDICA / HEARTBEAT
curl -X POST https://tudominio.com/api/licenses/validate \\
  -H "Content-Type: application/json" \\
  -d '{
    "license_key": "PROD-ENT-8F12-9A4B-3C2D-1E7F",
    "device_fingerprint": "hwid_e3b0c44298fc1c149afbf4c8996fb924"
  }'

# 3. DESVINCULACIÓN / DESACTIVACIÓN (Libera el cupo)
curl -X POST https://tudominio.com/api/licenses/deactivate \\
  -H "Content-Type: application/json" \\
  -d '{
    "license_key": "PROD-ENT-8F12-9A4B-3C2D-1E7F",
    "device_fingerprint": "hwid_e3b0c44298fc1c149afbf4c8996fb924"
  }'`;

  const currentCode =
    activeTab === "node" ? nodeCode : activeTab === "python" ? pythonCode : restCode;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
            <Code2 className="w-7 h-7 text-cyan-400" />
            Visor de Documentación del SDK
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Integra validación criptográfica y bloqueo de hardware en menos de 5 minutos.
          </p>
        </div>
      </div>

      {/* Information Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl glass-panel border border-white/10 space-y-2">
          <div className="flex items-center gap-2 text-violet-400 font-semibold text-xs">
            <ShieldCheck className="w-4 h-4" />
            <span>Firma Offline Anti-Tamper</span>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Cada activación genera un JWT firmado con Ed25519 con la huella del hardware cifrada. Tu app puede validar la licencia sin internet por semanas.
          </p>
        </div>

        <div className="p-4 rounded-2xl glass-panel border border-white/10 space-y-2">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs">
            <Cpu className="w-4 h-4" />
            <span>Enlace de Hardware Estricto (HWID)</span>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Si un usuario copia la carpeta del programa a otra computadora, el hash de hardware cambia y la clave se bloquea inmediatamente.
          </p>
        </div>

        <div className="p-4 rounded-2xl glass-panel border border-white/10 space-y-2">
          <div className="flex items-center gap-2 text-cyan-400 font-semibold text-xs">
            <Clock className="w-4 h-4" />
            <span>Período de Gracia & Avisos</span>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Notificaciones automáticas en 30, 15, 7, 3 y 1 días restantes, con período de gracia de 3 días para evitar cortes abruptos de servicio.
          </p>
        </div>
      </div>

      {/* Code Snippets Viewer */}
      <div className="rounded-2xl glass-panel border border-white/10 overflow-hidden shadow-2xl">
        {/* Tab selector */}
        <div className="px-4 py-3 bg-black/50 border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("node")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeTab === "node"
                  ? "bg-violet-600/30 text-violet-300 border border-violet-500/40"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>Node.js / Electron SDK</span>
            </button>

            <button
              onClick={() => setActiveTab("python")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeTab === "python"
                  ? "bg-emerald-600/30 text-emerald-300 border border-emerald-500/40"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Python Script</span>
            </button>

            <button
              onClick={() => setActiveTab("rest")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeTab === "rest"
                  ? "bg-cyan-600/30 text-cyan-300 border border-cyan-500/40"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>REST API / cURL</span>
            </button>
          </div>

          <button
            onClick={() => handleCopy(activeTab, currentCode)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors"
          >
            {copiedTab === activeTab ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Copiado al portapapeles</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copiar Código</span>
              </>
            )}
          </button>
        </div>

        {/* Code Block */}
        <div className="p-5 bg-black/80 font-mono text-xs overflow-x-auto text-zinc-300 leading-relaxed">
          <pre>{currentCode}</pre>
        </div>
      </div>
    </div>
  );
}
