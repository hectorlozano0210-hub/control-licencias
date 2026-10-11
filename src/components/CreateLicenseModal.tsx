"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import { BorderBeam } from "./ui/BorderBeam";
import {
  KeyRound,
  CheckCircle2,
  Copy,
  Check,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import { License, Company, Application } from "@/lib/types";

interface CreateLicenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  companies: Company[];
  apps: Application[];
  preselectedCompanyId?: string;
  preselectedAppId?: string;
  onCreateLicense: (data: {
    company_id: string;
    app_id: string;
    plan_tier: "Standard" | "Professional" | "Enterprise";
    max_seats: number;
    duration_days: number;
    notes?: string;
    customer_email?: string;
  }) => Promise<any>;
}

export function CreateLicenseModal({
  isOpen,
  onClose,
  companies,
  apps,
  preselectedCompanyId,
  preselectedAppId,
  onCreateLicense,
}: CreateLicenseModalProps) {
  const [availableClients, setAvailableClients] = useState<Company[]>(companies);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(
    preselectedCompanyId || companies[0]?.id || ""
  );
  const [customerEmail, setCustomerEmail] = useState<string>("");
  const [selectedAppId, setSelectedAppId] = useState<string>(
    preselectedAppId || apps[0]?.id || ""
  );
  const [selectedTier, setSelectedTier] = useState<"Standard" | "Professional" | "Enterprise">(
    "Enterprise"
  );
  const [seats, setSeats] = useState<number>(5);
  const [durationDays, setDurationDays] = useState<number>(365);
  const [notes, setNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdLicenseResult, setCreatedLicenseResult] = useState<License | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Carga dinámica de clientes de Supabase al abrir el modal
  useEffect(() => {
    let isMounted = true;
    async function loadDynamicClients() {
      if (!isOpen) return;
      try {
        const res = await fetch("/api/v1/clients");
        if (res.ok) {
          const data = await res.json();
          if (data.clients && data.clients.length > 0 && isMounted) {
            setAvailableClients(data.clients);
            if (!selectedCompanyId || !data.clients.some((c: any) => c.id === selectedCompanyId)) {
              const firstClient = data.clients[0];
              setSelectedCompanyId(firstClient.id);
              setCustomerEmail(firstClient.contact_email || firstClient.email || "");
            }
          }
        }
      } catch (err) {
        console.warn("Error cargando clientes dinámicos:", err);
      }
    }
    loadDynamicClients();
    return () => {
      isMounted = false;
    };
  }, [isOpen, selectedCompanyId]);

  // Sincronizar clientes cuando cambian las props
  useEffect(() => {
    if (companies && companies.length > 0) {
      setAvailableClients((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        const merged = [...prev];
        companies.forEach((c) => {
          if (!existingIds.has(c.id)) {
            merged.push(c);
          }
        });
        return merged;
      });
    }
  }, [companies]);

  // Respetar preselecciones
  useEffect(() => {
    if (preselectedCompanyId) {
      setSelectedCompanyId(preselectedCompanyId);
      const list = availableClients.length > 0 ? availableClients : companies;
      const found = list.find((c) => c.id === preselectedCompanyId);
      if (found) {
        setCustomerEmail(found.contact_email || found.email || "");
      }
    }
  }, [preselectedCompanyId, availableClients, companies]);

  useEffect(() => {
    if (preselectedAppId) {
      setSelectedAppId(preselectedAppId);
    }
  }, [preselectedAppId]);

  // Actualizar email cuando cambia la empresa
  useEffect(() => {
    const list = availableClients.length > 0 ? availableClients : companies;
    const comp = list.find((c) => c.id === selectedCompanyId);
    if (comp) {
      setCustomerEmail(comp.contact_email || comp.email || "");
    }
  }, [selectedCompanyId, availableClients, companies]);

  const allApps = useMemo(() => {
    const list = [...apps];
    if (!list.some((a) => a.id === "joyeria-erp" || a.slug === "joyeria-erp")) {
      list.push({
        id: "joyeria-erp",
        slug: "joyeria-erp",
        name: "Master FixPC Joyerías ERP (joyeria-erp)",
        description: "Software profesional para gestión de inventarios de joyería y orfebrería.",
        current_version: "5.1.0",
        min_supported_version: "5.0.0",
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
    return list;
  }, [apps]);

  const handleCopy = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    toast.success("Clave de licencia copiada al portapapeles", {
      description: key,
    });
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    try {
      setIsSubmitting(true);
      const res = await onCreateLicense({
        company_id: selectedCompanyId,
        app_id: selectedAppId,
        plan_tier: selectedTier,
        max_seats: Number(seats),
        duration_days: Number(durationDays),
        notes,
        customer_email: customerEmail.trim() || undefined,
      });

      if (res && res.license) {
        setCreatedLicenseResult(res.license);
        confetti({
          particleCount: 90,
          spread: 70,
          origin: { y: 0.6 },
        });
        toast.success("¡Licencia emitida exitosamente!", {
          description: `Clave: ${res.license.license_key} (${res.license.max_seats} cupos)`,
        });
      } else if (res && res.error) {
        setCreateError(res.error);
        toast.error("Error al emitir la licencia", { description: res.error, duration: 8000 });
      }
    } catch (err: any) {
      const msg = err.message || "Error al registrar en Supabase";
      setCreateError(msg);
      toast.error("Error al emitir la licencia", { description: msg, duration: 8000 });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseModal = () => {
    setCreatedLicenseResult(null);
    setCreateError(null);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
        >
          <motion.div
            initial={{ scale: 0.94, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.94, opacity: 0, y: 15 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="relative w-full max-w-xl rounded-3xl bg-[#090d12]/95 border border-gold-500/30 p-6 shadow-2xl backdrop-blur-2xl overflow-hidden"
          >
            <BorderBeam size={240} duration={8} colorFrom="#caa455" colorTo="#2dd4bf" />

            {/* Logo Centrado y Título Cyber-Luxury Stitch */}
            <div className="flex flex-col items-center text-center pb-4 border-b border-white/10 relative">
              <button
                onClick={handleCloseModal}
                className="absolute right-0 top-0 p-1.5 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                title="Cerrar modal"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="relative mb-2 flex items-center justify-center p-2 rounded-2xl bg-black/60 border border-gold-500/30 shadow-[0_0_20px_rgba(202,164,85,0.25)]">
                <img
                  src="/logo-masterfixpc-reducido.png"
                  alt="Master FixPC"
                  className="w-12 h-12 object-contain"
                />
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400" />
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-gold-500/10 border border-gold-500/30 text-gold-400 text-[10px] font-mono uppercase tracking-widest mb-1">
                <span>CoreAuth Criptográfico</span>
                <span>•</span>
                <span>HSM Tier-3</span>
              </div>

              <h3 className="text-xl font-bold tracking-tight text-white">
                <span className="bg-gradient-to-r from-gold-300 via-gold-400 to-cyanGlow-400 bg-clip-text text-transparent">
                  Emisión de Licencia Comercial
                </span>
              </h3>
              <p className="text-xs text-zinc-400 max-w-sm mt-0.5">
                Generación de llaves criptográficas offline y cupos de hardware garantizados
              </p>
            </div>

            {createdLicenseResult ? (
              <div className="mt-6 space-y-4">
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
                  <div className="flex items-center gap-2 font-bold text-sm mb-1">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ¡Licencia Generada Exitosamente!
                  </div>
                  <p className="text-xs text-emerald-200/80">
                    La clave ha sido registrada en el sistema de seguridad y está lista para activación.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-black/50 border border-white/10 space-y-2">
                  <div className="text-[11px] font-semibold uppercase text-zinc-400">
                    Clave de Activación
                  </div>
                  <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-black/60 border border-white/15 font-mono text-base font-bold text-emerald-400">
                    <span>{createdLicenseResult.license_key}</span>
                    <button
                      onClick={() => handleCopy(createdLicenseResult.license_key)}
                      className="px-3 py-1 rounded-md bg-white/10 hover:bg-white/20 text-white text-xs font-sans font-medium flex items-center gap-1.5 transition-colors"
                    >
                      {copiedKey === createdLicenseResult.license_key ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" /> Copiado
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" /> Copiar
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                    <span className="text-zinc-500 block">Cliente:</span>
                    <span className="font-semibold text-white">
                      {createdLicenseResult.company_name}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                    <span className="text-zinc-500 block">Cupos Máximos:</span>
                    <span className="font-semibold text-emerald-400">
                      {createdLicenseResult.max_seats} equipos permitidos
                    </span>
                  </div>
                </div>

                <div className="flex justify-end pt-3">
                  <button
                    onClick={handleCloseModal}
                    className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium text-xs transition-colors"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateSubmit} className="mt-5 space-y-4 text-xs">
                {createError && (
                  <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 flex items-start gap-2.5 animate-in fade-in duration-200">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-rose-200 text-xs">Error al registrar en Supabase</div>
                      <div className="text-[11px] text-rose-300/90 mt-0.5 leading-relaxed break-words">{createError}</div>
                    </div>
                  </div>
                )}

                {/* Selector Empresa */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-zinc-300 font-semibold">
                      Empresa Cliente
                    </label>
                    <span className="text-[10px] text-zinc-500">
                      {(availableClients.length > 0 ? availableClients : companies).length} clientes disponibles
                    </span>
                  </div>
                  <select
                    value={selectedCompanyId}
                    onChange={(e) => {
                      const newId = e.target.value;
                      setSelectedCompanyId(newId);
                      const comp = (availableClients.length > 0 ? availableClients : companies).find(
                        (c) => c.id === newId
                      );
                      if (comp) {
                        setCustomerEmail(comp.contact_email || comp.email || "");
                      }
                    }}
                    required
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white focus:outline-none focus:border-gold-500/50"
                  >
                    {(availableClients.length > 0 ? availableClients : companies).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.company_name || c.name} ({c.tax_id || c.nit_rut || "Sin NIT"})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Correo Electrónico del Cliente */}
                <div>
                  <label className="block text-zinc-300 font-semibold mb-1">
                    Correo del Cliente (customer_email)
                  </label>
                  <input
                    type="email"
                    placeholder="cliente@joyeria.com (Opcional, compatible con Supabase)"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white placeholder:text-zinc-600 focus:outline-none focus:border-gold-500/50"
                  />
                </div>

                {/* Selector Aplicación */}
                <div>
                  <label className="block text-zinc-300 font-semibold mb-1">
                    Aplicación a Licenciar
                  </label>
                  <select
                    value={selectedAppId}
                    onChange={(e) => setSelectedAppId(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white focus:outline-none focus:border-gold-500/50"
                  >
                    {allApps.map((app) => (
                      <option key={app.id} value={app.id}>
                        {app.name.includes(`(${app.slug})`) ? app.name : `${app.name} (${app.slug})`}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Plan Tier y Cupos */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-zinc-300 font-semibold mb-1">
                      Nivel de Plan (Tier)
                    </label>
                    <select
                      value={selectedTier}
                      onChange={(e) => setSelectedTier(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white focus:outline-none focus:border-gold-500/50"
                    >
                      <option value="Standard">Standard (Base)</option>
                      <option value="Professional">Professional (Medio)</option>
                      <option value="Enterprise">Enterprise (Completo)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-zinc-300 font-semibold mb-1">
                      Cupos de Hardware (Seats)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={seats}
                      onChange={(e) => setSeats(Number(e.target.value))}
                      required
                      className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white focus:outline-none focus:border-gold-500/50"
                    />
                  </div>
                </div>

                {/* Vigencia / Duración */}
                <div>
                  <label className="block text-zinc-300 font-semibold mb-1">
                    Duración del Contrato
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: "30 Días", val: 30 },
                      { label: "90 Días", val: 90 },
                      { label: "1 Año", val: 365 },
                      { label: "2 Años", val: 730 },
                    ].map((item) => (
                      <button
                        key={item.val}
                        type="button"
                        onClick={() => setDurationDays(item.val)}
                        className={`py-1.5 px-2 rounded-lg font-medium border text-center transition-all ${
                          durationDays === item.val
                            ? "bg-gold-500/20 border-gold-500 text-white"
                            : "bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10"
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notas */}
                <div>
                  <label className="block text-zinc-300 font-semibold mb-1">
                    Notas o Referencia de Contrato (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Contrato #CTR-2026-081 con soporte 24/7"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white focus:outline-none focus:border-gold-500/50"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-4 py-2 rounded-xl hover:bg-white/10 text-zinc-300 font-medium transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn-shine flex items-center gap-2 px-6 py-2.5 rounded-full font-bold uppercase tracking-wider text-[#080f15] shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all border border-gold-300 relative overflow-hidden group"
                    style={{
                      background: "linear-gradient(135deg, #ffdea1 0%, #caa455 50%, #8c6e2d 100%)",
                      boxShadow: "0 0 20px rgba(202, 164, 85, 0.45)",
                    }}
                  >
                    <div className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-[-25deg] -translate-x-full group-hover:translate-x-[300%] transition-transform duration-1000 ease-out pointer-events-none" />
                    {isSubmitting ? (
                      <RefreshCw className="w-4 h-4 animate-spin text-[#080f15]" />
                    ) : (
                      <Sparkles className="w-4 h-4 text-[#080f15]" />
                    )}
                    <span>Emitir y Firmar Clave</span>
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
