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

  const nodeCode = `// 1. Integración en tu proyecto React / Next.js / Electron / Node:
import { CoreAuthClient } from "@/lib/sdk/client-sdk";

// Inicializar el cliente (por defecto apunta a Render en producción)
const licenseClient = new CoreAuthClient({
  serverUrl: "https://api-control-licencias.onrender.com",
  appSlug: "mi-software-pro",
  appVersion: "1.0.0",
});

async function main() {
  const licenseKey = "PROD-PRO-XXXX-XXXX-XXXX-XXXX";

  console.log("Activando equipo...");
  const activation = await licenseClient.activate(licenseKey, "WORKSTATION-MAIN");

  if (!activation.success) {
    console.error("Error al activar:", activation.message);
    // Errores tipados: 'MAX_ACTIVATIONS_REACHED', 'LICENSE_NOT_FOUND', etc.
    return;
  }

  console.log("¡Activación exitosa! Plan:", activation.license?.planTier);
  console.log("Vigencia Offline hasta:", activation.offline_valid_until);

  // Verificar estado (permite operar offline mientras offline_valid_until no expire)
  const check = await licenseClient.verify();
  if (check.valid) {
    console.log("Software habilitado para ejecutar:", check.message);
  }
}

main();`;

  const pythonCode = `import requests
import hashlib
import platform
import uuid

API_BASE = "https://api-control-licencias.onrender.com/api/licenses"

def get_hwid():
    """Genera huella SHA-256 única y persistente del hardware"""
    node_id = str(uuid.getnode())
    system_data = f"{platform.node()}-{platform.processor()}-{node_id}"
    return f"hw_{hashlib.sha256(system_data.encode()).hexdigest()[:16]}"

def activate_license(license_key):
    hwid = get_hwid()
    payload = {
        "license_key": license_key,
        "device_fingerprint": hwid,
        "device_name": platform.node()
    }
    
    resp = requests.post(f"{API_BASE}/activate", json=payload)
    data = resp.json()
    
    if data.get("success"):
        print("✓ Software activado correctamente!")
        print(f"Token JWT firmado: {data.get('token')[:32]}...")
        print(f"Plan: {data.get('license', {}).get('plan_tier')}")
        return data
    else:
        print(f"✗ Activación rechazada [{data.get('code')}]: {data.get('message')}")
        return None

# Ejemplo de uso:
if __name__ == "__main__":
    activate_license("PROD-PRO-XXXX-XXXX-XXXX-XXXX")`;

  const restCode = `# 1. ACTIVACIÓN OFICIAL DE EQUIPO (Descuenta 1 cupo y emite token offline)
curl -X POST https://api-control-licencias.onrender.com/api/licenses/activate \\
  -H "Content-Type: application/json" \\
  -d '{
    "license_key": "PROD-PRO-XXXX-XXXX-XXXX-XXXX",
    "device_fingerprint": "hw_7f8a9b0c1d2e3f4a",
    "device_name": "PC-OFICINA-01"
  }'

# 2. VALIDACIÓN PERIÓDICA / HEARTBEAT
curl -X POST https://api-control-licencias.onrender.com/api/licenses/validate \\
  -H "Content-Type: application/json" \\
  -d '{
    "license_key": "PROD-PRO-XXXX-XXXX-XXXX-XXXX",
    "device_fingerprint": "hw_7f8a9b0c1d2e3f4a"
  }'

# 3. DESVINCULACIÓN (Libera cupo para otro equipo)
curl -X POST https://api-control-licencias.onrender.com/api/licenses/deactivate \\
  -H "Content-Type: application/json" \\
  -d '{
    "license_key": "PROD-PRO-XXXX-XXXX-XXXX-XXXX",
    "device_fingerprint": "hw_7f8a9b0c1d2e3f4a"
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
