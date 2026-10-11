"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldAlert,
  ShieldCheck,
  Lock,
  LockOpen,
  KeyRound,
  Laptop,
  Eye,
  EyeOff,
  RefreshCw,
  Cpu,
  AlertTriangle,
  Fingerprint,
} from "lucide-react";
import { toast } from "sonner";
import { BorderBeam } from "./ui/BorderBeam";
import { Spotlight } from "./ui/Spotlight";
import { getClientDeviceFingerprint, formatFingerprintPreview } from "@/lib/security/client-fingerprint";

interface MasterLoginViewProps {
  onSuccess: (deviceFingerprint: string) => void;
}

export function MasterLoginView({ onSuccess }: MasterLoginViewProps) {
  const [masterKey, setMasterKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [deviceFingerprint, setDeviceFingerprint] = useState<string>("");
  const [isDetectingDevice, setIsDetectingDevice] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Calcular la huella digital de hardware de esta máquina al cargar
  useEffect(() => {
    let isMounted = true;
    async function resolveFp() {
      try {
        const fp = await getClientDeviceFingerprint();
        if (isMounted) {
          setDeviceFingerprint(fp);
          setIsDetectingDevice(false);
        }
      } catch (e) {
        if (isMounted) {
          setIsDetectingDevice(false);
        }
      }
    }
    resolveFp();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!masterKey.trim()) {
      setErrorMessage("Por favor ingrese la Clave Maestra.");
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const fp = deviceFingerprint || (await getClientDeviceFingerprint());

      const res = await fetch("/api/v1/auth/master-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          master_key: masterKey.trim(),
          device_fingerprint: fp,
          device_name: typeof navigator !== "undefined" ? navigator.platform : "Terminal",
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        toast.success(
          data.is_first_anchored
            ? "¡Estación Maestra vinculada exitosamente!"
            : "Sesión Super Administrador validada",
          {
            description: `Terminal: ${formatFingerprintPreview(fp)}`,
          }
        );
        onSuccess(fp);
      } else {
        const err = data.error || "Error de autenticación maestra.";
        setErrorMessage(err);
        toast.error("Acceso Denegado", { description: err, duration: 6000 });
      }
    } catch (err: any) {
      const msg = err.message || "Error al conectar con el servidor.";
      setErrorMessage(msg);
      toast.error("Error de conexión", { description: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isUnauthorizedDeviceError =
    errorMessage?.includes("Terminal no vinculada como estación maestra") ||
    errorMessage?.includes("Acceso no autorizado");

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex items-center justify-center p-4 relative overflow-hidden select-none">
      {/* Background Mesh Grid */}
      <div className="fixed inset-0 pointer-events-none bg-grid-pattern mask-radial z-0 opacity-60" />

      {/* Spotlights */}
      <Spotlight className="-top-32 left-1/3" fill="#8b5cf6" />
      <Spotlight className="top-1/2 -right-20" fill="#10b981" />

      {/* Ambient Radial Lights */}
      <div className="fixed top-1/4 left-1/3 w-[500px] h-[500px] bg-violet-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="fixed bottom-1/4 right-1/3 w-[450px] h-[450px] bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Central Card */}
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="relative rounded-3xl glass-panel border border-white/10 p-8 shadow-2xl backdrop-blur-2xl overflow-hidden">
          {/* Top Border Animated Beam */}
          <BorderBeam size={220} duration={14} delay={0} colorFrom="#8b5cf6" colorTo="#10b981" />

          {/* Header Icon & Logo */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="relative mb-3 flex items-center justify-center p-2 rounded-2xl bg-black/40 border border-white/10 shadow-2xl backdrop-blur-md">
              <img
                src="/logo-masterfixpc-reducido.png"
                alt="Master FixPC"
                className="w-14 h-14 object-contain drop-shadow-[0_0_15px_rgba(202,164,85,0.4)]"
              />
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-black" />
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-500/15 border border-violet-500/30 text-violet-300 text-[11px] font-semibold uppercase tracking-wider mb-2">
              <Fingerprint className="w-3.5 h-3.5 text-violet-400" />
              <span>Device Binding • Hardware Security</span>
            </div>

            <h1 className="text-2xl font-extrabold tracking-tight text-white">
              CoreAuth Super Admin
            </h1>
            <p className="text-xs text-zinc-400 mt-1 max-w-xs leading-relaxed">
              Terminal de mando y gestión de licencias criptográficas. Acceso restringido a estación autorizada.
            </p>
          </div>

          {/* Device Fingerprint Status Card */}
          <div className="mb-6 p-3.5 rounded-2xl bg-black/50 border border-white/10 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400 flex items-center gap-1.5 font-medium">
                <Laptop className="w-3.5 h-3.5 text-zinc-300" />
                Estación Detectada:
              </span>
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-md">
                {isDetectingDevice ? "Calculando HWID..." : "Anclaje Activo"}
              </span>
            </div>

            <div className="flex items-center gap-2 font-mono text-[11px] text-zinc-300 bg-white/5 px-2.5 py-1.5 rounded-xl border border-white/5 break-all">
              <Cpu className="w-3.5 h-3.5 text-violet-400 shrink-0" />
              <span className="truncate">
                {isDetectingDevice ? "Calculando huella de hardware..." : deviceFingerprint || "HWID no disponible"}
              </span>
            </div>
          </div>

          {/* Error Message Box */}
          <AnimatePresence>
            {errorMessage && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: "auto", marginBottom: 16 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                className={`p-3.5 rounded-2xl border text-xs flex items-start gap-2.5 ${
                  isUnauthorizedDeviceError
                    ? "bg-rose-500/15 border-rose-500/40 text-rose-300"
                    : "bg-amber-500/15 border-amber-500/40 text-amber-300"
                }`}
              >
                {isUnauthorizedDeviceError ? (
                  <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-xs">
                    {isUnauthorizedDeviceError ? "Acceso Bloqueado por Hardware" : "Error de Autenticación"}
                  </div>
                  <div className="text-[11px] mt-0.5 leading-relaxed break-words opacity-90">
                    {errorMessage}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Clave Maestra de Super Administrador
              </label>
              <div className="relative">
                <input
                  type={showKey ? "text" : "password"}
                  value={masterKey}
                  onChange={(e) => setMasterKey(e.target.value)}
                  placeholder="Ingrese la clave maestra secreta"
                  autoFocus
                  required
                  disabled={isSubmitting}
                  className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-black/60 border border-white/15 text-white text-xs placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 transition-colors p-1"
                  tabIndex={-1}
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || isDetectingDevice}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-emerald-500 hover:from-violet-500 hover:to-emerald-400 text-white font-semibold text-xs shadow-lg shadow-violet-600/30 transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Validando Estación Maestra...</span>
                </>
              ) : (
                <>
                  <LockOpen className="w-4 h-4" />
                  <span>Ingresar como Estación Maestra</span>
                </>
              )}
            </button>
          </form>

          {/* Security Notice */}
          <div className="mt-6 pt-4 border-t border-white/10 text-center">
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              Protección por huella criptográfica de hardware única. Solo la estación portátil registrada tiene autorización para emitir licencias de producción.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
