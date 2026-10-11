"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { BorderBeam } from "./ui/BorderBeam";
import {
  Terminal,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Cpu,
  KeyRound,
  ShieldAlert,
  Send,
  Sparkles,
  Layers,
  Clock,
  Info,
  Copy,
  Check,
} from "lucide-react";
import { License, Application } from "@/lib/types";

interface SimulatorViewProps {
  licenses: License[];
  apps: Application[];
  onTriggerRefresh: () => void;
}

export function SimulatorView({
  licenses,
  apps,
  onTriggerRefresh,
}: SimulatorViewProps) {
  const [serverUrl, setServerUrl] = useState<string>(
    "https://api-control-licencias.onrender.com"
  );
  const [selectedLicenseKey, setSelectedLicenseKey] = useState<string>(
    licenses[0]?.license_key || ""
  );
  const [selectedAppSlug, setSelectedAppSlug] = useState<string>(
    licenses[0]?.app_slug || apps[0]?.slug || "control-horarios"
  );
  const [machineFingerprint, setMachineFingerprint] = useState<string>(
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
  );
  const [deviceName, setDeviceName] = useState<string>("PC-TEST-LAB-01");
  const [osInfo, setOsInfo] = useState<string>("Windows 11 Pro (Build 22631)");
  const [appVersion, setAppVersion] = useState<string>("2.4.0");

  const [isLoading, setIsLoading] = useState(false);
  const [apiResponse, setApiResponse] = useState<any>(null);
  const [statusCode, setStatusCode] = useState<number | null>(null);
  const [executionTimeMs, setExecutionTimeMs] = useState<number | null>(null);
  const [activeAction, setActiveAction] = useState<string>("");
  const [copiedResponse, setCopiedResponse] = useState(false);

  const generateRandomHWID = () => {
    const chars = "0123456789abcdef";
    let hash = "";
    for (let i = 0; i < 64; i++) {
      hash += chars[Math.floor(Math.random() * chars.length)];
    }
    setMachineFingerprint(hash);
    setDeviceName(`CLIENT-NODE-${Math.floor(100 + Math.random() * 900)}`);
  };

  const handleSelectLicense = (lic: License) => {
    setSelectedLicenseKey(lic.license_key);
    if (lic.app_slug) setSelectedAppSlug(lic.app_slug);
  };

  const runApiCall = async (
    endpoint: string,
    actionName: string,
    payload: Record<string, any>
  ) => {
    setIsLoading(true);
    setActiveAction(actionName);
    const startTime = performance.now();

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      const elapsed = Math.round(performance.now() - startTime);

      setStatusCode(res.status);
      setApiResponse(data);
      setExecutionTimeMs(elapsed);
      onTriggerRefresh();

      if (res.ok && (data.success || data.valid)) {
        toast.success(`Operación ${actionName.toUpperCase()} exitosa`, {
          description: data.code || "Completado correctamente",
        });
      } else {
        toast.error(`Error en ${actionName.toUpperCase()}`, {
          description: data.message || data.error || data.code || "Petición rechazada",
        });
      }
    } catch (err: any) {
      const elapsed = Math.round(performance.now() - startTime);
      setStatusCode(500);
      setApiResponse({ error: err.message });
      setExecutionTimeMs(elapsed);
      toast.error("Fallo de conexión", { description: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  const resolveUrl = (path: string) => {
    if (!serverUrl || serverUrl === "/") return path;
    return `${serverUrl.replace(/\/$/, "")}${path}`;
  };

  const handleActivate = () => {
    runApiCall(resolveUrl("/api/licenses/activate"), "activate", {
      license_key: selectedLicenseKey,
      device_fingerprint: machineFingerprint,
      device_name: deviceName,
    });
  };

  const handleVerify = () => {
    runApiCall(resolveUrl("/api/licenses/validate"), "verify", {
      license_key: selectedLicenseKey,
      device_fingerprint: machineFingerprint,
    });
  };

  const handleHeartbeat = () => {
    runApiCall(resolveUrl("/api/licenses/validate"), "heartbeat", {
      license_key: selectedLicenseKey,
      device_fingerprint: machineFingerprint,
    });
  };

  const handleCopyJson = () => {
    if (apiResponse) {
      navigator.clipboard.writeText(JSON.stringify(apiResponse, null, 2));
      setCopiedResponse(true);
      setTimeout(() => setCopiedResponse(false), 2000);
    }
  };

  // Banner simulation extraction
  const alertInfo = apiResponse?.alerts;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-2xl bg-black/40 border border-gold-500/30 shadow-[0_0_15px_rgba(202,164,85,0.25)] shrink-0">
            <img
              src="/logo-masterfixpc-reducido.png"
              alt="Master FixPC"
              className="w-10 h-10 object-contain"
            />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
              <span className="bg-gradient-to-r from-white via-gold-300 to-cyanGlow-400 bg-clip-text text-transparent">
                Sandbox & Terminal de Activación
              </span>
            </h1>
            <p className="text-sm text-zinc-400 mt-1">
              Prueba cómo interactúa un software cliente con la API de validación y huella digital de hardware.
            </p>
          </div>
        </div>

        <button
          onClick={generateRandomHWID}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border border-white/10 text-xs font-semibold transition-all shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
          <span>Generar HWID Aleatorio</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Client Configuration & Actions (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-5 rounded-2xl glass-panel border border-white/10 space-y-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider text-zinc-300 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-cyan-400" />
              Parámetros de la Máquina Cliente
            </h2>

            {/* Servidor Endpoint URL */}
            <div>
              <label className="block text-[11px] font-semibold text-zinc-400 uppercase mb-1 flex items-center justify-between">
                <span>Servidor de Licencias</span>
                <span className="text-[10px] text-cyan-400 font-semibold">Oficial Render</span>
              </label>
              <input
                type="text"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                placeholder="https://api-control-licencias.onrender.com"
                className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-cyan-300 font-mono text-xs focus:outline-none focus:border-cyan-500/50"
              />
            </div>

            {/* Quick Picker from existing licenses */}
            <div>
              <label className="block text-[11px] font-semibold text-zinc-400 uppercase mb-1">
                Seleccionar Licencia Existente
              </label>
              <select
                value={selectedLicenseKey}
                onChange={(e) => {
                  setSelectedLicenseKey(e.target.value);
                  const found = licenses.find((l) => l.license_key === e.target.value);
                  if (found && found.app_slug) setSelectedAppSlug(found.app_slug);
                }}
                className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-cyan-500/50"
              >
                {licenses.map((lic) => (
                  <option key={lic.id} value={lic.license_key}>
                    {lic.license_key} ({lic.company_name} - {lic.plan_tier})
                  </option>
                ))}
              </select>
            </div>

            {/* License Key input */}
            <div>
              <label className="block text-[11px] font-semibold text-zinc-400 uppercase mb-1">
                Clave de Licencia
              </label>
              <input
                type="text"
                value={selectedLicenseKey}
                onChange={(e) => setSelectedLicenseKey(e.target.value)}
                placeholder="PROD-ENT-XXXX-XXXX-XXXX-XXXX"
                className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-cyan-500/50"
              />
            </div>

            {/* Software Slug */}
            <div>
              <label className="block text-[11px] font-semibold text-zinc-400 uppercase mb-1">
                Slug de la Aplicación
              </label>
              <select
                value={selectedAppSlug}
                onChange={(e) => setSelectedAppSlug(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-500/50"
              >
                {apps.map((app) => (
                  <option key={app.id} value={app.slug}>
                    {app.name} ({app.slug})
                  </option>
                ))}
              </select>
            </div>

            {/* Machine Fingerprint / HWID */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-zinc-400 uppercase">
                  Hardware ID (HWID SHA-256)
                </label>
                <button
                  type="button"
                  onClick={generateRandomHWID}
                  className="text-[10px] text-cyan-400 hover:underline"
                >
                  Nuevo HWID
                </button>
              </div>
              <input
                type="text"
                value={machineFingerprint}
                onChange={(e) => setMachineFingerprint(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-zinc-300 font-mono text-[11px] focus:outline-none focus:border-cyan-500/50"
              />
            </div>

            {/* Device Name & OS */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-400 uppercase mb-1">
                  Hostname / Equipo
                </label>
                <input
                  type="text"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-500/50"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-400 uppercase mb-1">
                  Versión App
                </label>
                <input
                  type="text"
                  value={appVersion}
                  onChange={(e) => setAppVersion(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-500/50"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 space-y-2">
              <div className="text-[11px] font-semibold text-zinc-400 uppercase">
                Operaciones Disponibles
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  onClick={handleActivate}
                  disabled={isLoading}
                  className="w-full py-2.5 px-3 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/40 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-lg shadow-emerald-950/40"
                  title="Enlazar este HWID a la licencia y descontar cupo"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Activate</span>
                </button>

                <button
                  onClick={handleVerify}
                  disabled={isLoading}
                  className="w-full py-2.5 px-3 rounded-xl bg-violet-600/30 hover:bg-violet-600/50 text-violet-300 border border-violet-500/40 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-lg shadow-violet-950/40"
                  title="Verificar validez, expiración y recibir token firmado"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Verify</span>
                </button>

                <button
                  onClick={handleHeartbeat}
                  disabled={isLoading}
                  className="w-full py-2.5 px-3 rounded-xl bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-300 border border-cyan-500/40 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-lg shadow-cyan-950/40"
                  title="Enviar ping de presencia en vivo"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Heartbeat</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Output & Expiration Banner (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Simulated Client App Banner Preview */}
          <div className="p-4 rounded-2xl glass-panel border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Previsualización de Banner en App Cliente
              </span>
              <span className="text-[10px] text-zinc-500">
                Renderizado simulado del SDK
              </span>
            </div>

            {alertInfo && alertInfo.show_alert ? (
              <div
                className={`p-3.5 rounded-xl border flex items-start gap-3 text-xs ${
                  alertInfo.level === "critical"
                    ? "bg-rose-500/20 border-rose-500 text-rose-200"
                    : alertInfo.level === "urgent"
                    ? "bg-amber-500/20 border-amber-500 text-amber-200"
                    : alertInfo.level === "warning"
                    ? "bg-amber-500/15 border-amber-500/40 text-amber-200"
                    : "bg-cyan-500/15 border-cyan-500/40 text-cyan-200"
                }`}
              >
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-bold uppercase tracking-wider text-[10px] mb-0.5">
                    Alerta de Licencia ({alertInfo.level})
                  </div>
                  <div>{alertInfo.message}</div>
                  <div className="mt-1 font-semibold text-[11px]">
                    Días restantes de vigencia: {alertInfo.days_remaining} días
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 text-zinc-400 text-xs flex items-center gap-2">
                <Info className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  Estado normal: La licencia tiene más de 30 días de vigencia o aún no has ejecutado <strong>Verify</strong>.
                </span>
              </div>
            )}
          </div>

          {/* Console / Output Window */}
          <div className="rounded-2xl glass-panel border border-white/10 overflow-hidden shadow-2xl flex flex-col h-[400px]">
            {/* Header bar */}
            <div className="px-4 py-3 bg-black/60 border-b border-white/10 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div className="flex space-x-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
                </div>
                <span className="font-mono text-zinc-400 ml-2">
                  Console Output ({activeAction ? `POST /${activeAction}` : "Listo"})
                </span>
              </div>

              <div className="flex items-center gap-3">
                {statusCode !== null && (
                  <span
                    className={`font-mono font-bold px-2 py-0.5 rounded text-[10px] ${
                      statusCode >= 200 && statusCode < 300
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                    }`}
                  >
                    HTTP {statusCode}
                  </span>
                )}

                {executionTimeMs !== null && (
                  <span className="font-mono text-[10px] text-zinc-400">
                    {executionTimeMs} ms
                  </span>
                )}

                {apiResponse && (
                  <button
                    onClick={handleCopyJson}
                    className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white"
                    title="Copiar respuesta JSON"
                  >
                    {copiedResponse ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Terminal body */}
            <div className="flex-1 p-4 bg-black/80 font-mono text-xs overflow-auto text-zinc-300">
              {isLoading ? (
                <div className="h-full flex items-center justify-center space-x-2 text-cyan-400">
                  <span className="animate-spin">⚙</span>
                  <span>Procesando petición criptográfica y validando cupos...</span>
                </div>
              ) : apiResponse ? (
                <pre className="text-zinc-200 selection:bg-cyan-500/30">
                  {JSON.stringify(apiResponse, null, 2)}
                </pre>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center text-zinc-500 space-y-2">
                  <Terminal className="w-8 h-8 text-zinc-600" />
                  <p>Haz clic en Activate, Verify o Heartbeat para enviar una solicitud en vivo.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
