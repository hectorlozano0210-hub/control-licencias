"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import {
  KeyRound,
  ShieldCheck,
  ShieldAlert,
  Cpu,
  Laptop,
  CheckCircle2,
  Clock,
  Loader2,
  AlertTriangle,
  RotateCcw,
  X,
  ExternalLink,
} from "lucide-react";
import { useLicense } from "@/lib/sdk/use-license";

interface LicenseActivationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function LicenseActivationModal({
  isOpen,
  onClose,
  onSuccess,
}: LicenseActivationModalProps) {
  const {
    isLicensed,
    isOfflineGraceActive,
    offlineDaysRemaining,
    license,
    fingerprint,
    defaultDeviceName,
    loading,
    error,
    errorCode,
    activateLicense,
    deactivateLicense,
  } = useLicense();

  const [inputKey, setInputKey] = useState<string>("");
  const [deviceName, setDeviceName] = useState<string>(defaultDeviceName);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputKey.trim()) {
      toast.error("Por favor introduce tu clave de licencia.");
      return;
    }

    setIsSubmitting(true);
    const result = await activateLicense(inputKey.trim(), deviceName.trim());
    setIsSubmitting(false);

    if (result.success) {
      toast.success("¡Licencia activada con éxito!", {
        description: "Tu equipo ha sido vinculado y cuenta con cobertura offline.",
      });
      setInputKey("");
      if (onSuccess) onSuccess();
    } else {
      toast.error(result.code === "MAX_ACTIVATIONS_REACHED" ? "Límite de activaciones" : "Error de activación", {
        description: result.message,
      });
    }
  };

  const handleDeactivate = () => {
    if (confirm("¿Estás seguro de desvincular la licencia de este equipo?")) {
      deactivateLicense();
      toast.info("Licencia desvinculada de este equipo.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl glass-panel border border-white/10 bg-zinc-950/95 p-6 shadow-2xl text-white space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Activación de Licencia</h2>
              <p className="text-xs text-zinc-400">
                Conexión segura al servidor de validación CoreAuth
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Estado actual de la licencia */}
        {isLicensed && license ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  Licencia Activa y Vinculada
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Plan {license.planTier || "PRO"}
                </span>
              </div>

              <div className="space-y-1">
                <p className="text-[11px] text-zinc-400 font-mono break-all">
                  Clave: <span className="text-white font-semibold">{license.licenseKey}</span>
                </p>
                <p className="text-[11px] text-zinc-400 font-mono truncate">
                  Dispositivo: <span className="text-zinc-300">{license.deviceName || deviceName}</span>
                </p>
              </div>

              {/* Offline Grace Period Badge */}
              <div className="pt-2 border-t border-emerald-500/10 flex items-center justify-between text-xs">
                <span className="text-zinc-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                  Vigencia Offline:
                </span>
                <span className="font-semibold text-cyan-300">
                  {offlineDaysRemaining > 0
                    ? `${offlineDaysRemaining} días restantes`
                    : "Requiere conexión"}
                </span>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleDeactivate}
                className="w-full py-2.5 px-4 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-semibold transition-all"
              >
                Desvincular Licencia
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition-all"
              >
                Cerrar
              </button>
            </div>
          </div>
        ) : (
          /* Formulario de Activación */
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Mensaje de Error Mapeado */}
            {error && (
              <div
                className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                  errorCode === "MAX_ACTIVATIONS_REACHED"
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                    : "bg-red-500/10 border-red-500/30 text-red-300"
                }`}
              >
                {errorCode === "MAX_ACTIVATIONS_REACHED" ? (
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                ) : (
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                )}
                <div>
                  <p className="font-semibold">
                    {errorCode === "MAX_ACTIVATIONS_REACHED"
                      ? "Límite de activaciones alcanzado"
                      : errorCode === "LICENSE_NOT_FOUND"
                      ? "Licencia no encontrada"
                      : "Fallo en la activación"}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-relaxed opacity-90">{error}</p>
                </div>
              </div>
            )}

            {/* Input Clave de Licencia */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-300">
                Clave de Licencia (Product Key)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={inputKey}
                  onChange={(e) => setInputKey(e.target.value.toUpperCase())}
                  placeholder="PROD-PRO-XXXX-XXXX-XXXX-XXXX"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white placeholder-zinc-500 text-xs font-mono focus:outline-none focus:border-cyan-500/50"
                  disabled={isSubmitting}
                  required
                />
              </div>
              <p className="text-[11px] text-zinc-500">
                Formato estándar con checksum criptográfico de validación.
              </p>
            </div>

            {/* Datos del Dispositivo */}
            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 space-y-2 text-xs">
              <div className="flex items-center justify-between text-zinc-400">
                <span className="flex items-center gap-1.5">
                  <Laptop className="w-3.5 h-3.5 text-cyan-400" />
                  Nombre de equipo:
                </span>
                <input
                  type="text"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  className="bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-right text-white font-mono text-[11px] focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex items-center justify-between text-zinc-400 pt-1 border-t border-white/5">
                <span className="flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                  Huella de hardware (HWID):
                </span>
                <span className="font-mono text-[10px] text-zinc-300 truncate max-w-[180px]" title={fingerprint}>
                  {fingerprint}
                </span>
              </div>
            </div>

            {/* Botones de acción */}
            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="w-1/3 py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-semibold transition-all"
                disabled={isSubmitting}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !inputKey.trim()}
                className="w-2/3 py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-semibold transition-all shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Activando en producción...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Activar Licencia</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
