"use client";

import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import { BorderBeam } from "./ui/BorderBeam";
import {
  KeyRound,
  Search,
  Filter,
  Plus,
  Copy,
  Check,
  Calendar,
  Building,
  Laptop,
  AlertTriangle,
  MoreVertical,
  CheckCircle2,
  Clock,
  PauseCircle,
  XCircle,
  Sparkles,
  RefreshCw,
  ExternalLink,
  CreditCard,
} from "lucide-react";
import { License, Company, Application } from "@/lib/types";

interface LicenseManagerViewProps {
  licenses: License[];
  companies: Company[];
  apps: Application[];
  onRefresh: () => void;
  isOpenCreateModal: boolean;
  onSetOpenCreateModal: (open: boolean) => void;
  onExtendLicense: (id: string, days: number) => Promise<void>;
  onUpdateStatus: (id: string, status: License["status"]) => Promise<void>;
  onCreateLicense: (data: {
    company_id: string;
    app_id: string;
    plan_tier: "Standard" | "Professional" | "Enterprise";
    max_seats: number;
    duration_days: number;
    notes?: string;
    customer_email?: string;
  }) => Promise<any>;
  onOpenManualPayment?: (companyId?: string, licenseId?: string) => void;
}

export function LicenseManagerView({
  licenses,
  companies,
  apps,
  onRefresh,
  isOpenCreateModal,
  onSetOpenCreateModal,
  onExtendLicense,
  onUpdateStatus,
  onCreateLicense,
  onOpenManualPayment,
}: LicenseManagerViewProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [appFilter, setAppFilter] = useState<string>("all");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [actionMenuOpenId, setActionMenuOpenId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Form states
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(
    companies[0]?.id || ""
  );
  const [customerEmail, setCustomerEmail] = useState<string>(
    companies[0]?.email || ""
  );
  const [selectedAppId, setSelectedAppId] = useState<string>(apps[0]?.id || "");

  // Actualizar email por defecto si cambia la empresa seleccionada
  useEffect(() => {
    const comp = companies.find((c) => c.id === selectedCompanyId);
    if (comp?.email) {
      setCustomerEmail(comp.email);
    }
  }, [selectedCompanyId, companies]);

  // Catálogo completo de aplicaciones garantizando Master FixPC Joyerías ERP
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
  const [selectedTier, setSelectedTier] = useState<"Standard" | "Professional" | "Enterprise">(
    "Enterprise"
  );
  const [seats, setSeats] = useState<number>(5);
  const [durationDays, setDurationDays] = useState<number>(365);
  const [notes, setNotes] = useState<string>("");
  const [createdLicenseResult, setCreatedLicenseResult] = useState<License | null>(null);

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

  const filteredLicenses = licenses.filter((lic) => {
    const matchesSearch =
      lic.license_key.toLowerCase().includes(search.toLowerCase()) ||
      (lic.company_name && lic.company_name.toLowerCase().includes(search.toLowerCase())) ||
      (lic.app_name && lic.app_name.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && lic.status === "active") ||
      (statusFilter === "paused" && lic.status === "paused") ||
      (statusFilter === "expired" && lic.status === "expired") ||
      (statusFilter === "revoked" && lic.status === "revoked");

    const matchesApp = appFilter === "all" || lic.app_id === appFilter;

    return matchesSearch && matchesStatus && matchesApp;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Title & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
            <KeyRound className="w-7 h-7 text-violet-400" />
            Gestor & Generador de Licencias
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Emisión de claves criptográficas, cuotas de cupos concurrentes y ciclo de vida de contratos.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {onOpenManualPayment && (
            <button
              onClick={() => onOpenManualPayment()}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold shadow-lg shadow-emerald-950/40 transition-all active:scale-95"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Registrar Pago</span>
            </button>
          )}

          <button
            onClick={() => {
              setCreatedLicenseResult(null);
              onSetOpenCreateModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-emerald-500 hover:from-violet-500 hover:to-emerald-400 text-white font-semibold text-xs shadow-lg shadow-violet-600/30 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Generar Nueva Licencia</span>
          </button>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 rounded-2xl glass-panel border border-white/10">
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por clave, cliente o software..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs placeholder:text-zinc-500 focus:outline-none focus:border-violet-500/50"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-zinc-400 shrink-0" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-zinc-200 text-xs focus:outline-none focus:border-violet-500/50"
          >
            <option value="all">Todos los Estados</option>
            <option value="active">Activas</option>
            <option value="paused">Pausadas / Suspendidas</option>
            <option value="expired">Vencidas / Caducadas</option>
            <option value="revoked">Revocadas</option>
          </select>
        </div>

        <div>
          <select
            value={appFilter}
            onChange={(e) => setAppFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-zinc-200 text-xs focus:outline-none focus:border-violet-500/50"
          >
            <option value="all">Todas las Aplicaciones</option>
            {allApps.map((app) => (
              <option key={app.id} value={app.id}>
                {app.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* License Table */}
      <div className="overflow-hidden rounded-2xl glass-panel border border-white/10 shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-white/5 text-[11px] uppercase tracking-wider text-zinc-400 font-semibold">
                <th className="py-3.5 px-4">Clave de Licencia</th>
                <th className="py-3.5 px-4">Empresa / Cliente</th>
                <th className="py-3.5 px-4">Aplicación & Plan</th>
                <th className="py-3.5 px-4">Cupos (Asientos)</th>
                <th className="py-3.5 px-4">Estado</th>
                <th className="py-3.5 px-4">Vencimiento</th>
                <th className="py-3.5 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs text-zinc-300">
              {filteredLicenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-zinc-500">
                    No se encontraron licencias con los criterios aplicados.
                  </td>
                </tr>
              ) : (
                filteredLicenses.map((lic) => {
                  const daysLeft = Math.ceil(
                    (new Date(lic.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                  );
                  const isExpiringSoon = daysLeft > 0 && daysLeft <= 15;
                  const isExpired = daysLeft <= 0;

                  return (
                    <tr
                      key={lic.id}
                      className="hover:bg-white/[0.03] transition-colors group"
                    >
                      {/* Clave con Copy */}
                      <td className="py-3.5 px-4 font-mono font-medium">
                        <div className="flex items-center gap-2">
                          <span className="text-white text-xs select-all bg-black/40 px-2 py-1 rounded-md border border-white/5">
                            {lic.license_key}
                          </span>
                          <button
                            onClick={() => handleCopy(lic.license_key)}
                            className="p-1 rounded-md hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                            title="Copiar Clave"
                          >
                            {copiedKey === lic.license_key ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Empresa */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-white">
                          {lic.company_name || "Sin Empresa"}
                        </div>
                        <div className="text-[10px] text-zinc-400">
                          {lic.company_nit || "NIT no registrado"}
                        </div>
                      </td>

                      {/* Aplicación & Plan */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 font-medium text-zinc-200">
                          <span>{lic.app_name || lic.app_slug}</span>
                        </div>
                        <span
                          className={`inline-block mt-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase border ${
                            lic.plan_tier === "Enterprise"
                              ? "bg-violet-500/10 text-violet-300 border-violet-500/30"
                              : lic.plan_tier === "Professional"
                              ? "bg-cyan-500/10 text-cyan-300 border-cyan-500/30"
                              : "bg-zinc-500/10 text-zinc-300 border-zinc-500/30"
                          }`}
                        >
                          {lic.plan_tier}
                        </span>
                      </td>

                      {/* Cupos (Seats) */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-semibold text-white">
                            {lic.current_seats} / {lic.max_seats}
                          </span>
                          <span className="text-[10px] text-zinc-400">
                            {lic.max_seats - lic.current_seats} libres
                          </span>
                        </div>
                        <div className="w-28 h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              lic.current_seats >= lic.max_seats
                                ? "bg-rose-500"
                                : lic.current_seats > 0
                                ? "bg-emerald-400"
                                : "bg-zinc-600"
                            }`}
                            style={{
                              width: `${Math.min(
                                100,
                                (lic.current_seats / lic.max_seats) * 100
                              )}%`,
                            }}
                          />
                        </div>
                      </td>

                      {/* Estado */}
                      <td className="py-3.5 px-4">
                        {lic.status === "active" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Activa
                          </span>
                        ) : lic.status === "paused" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            <PauseCircle className="w-3 h-3 text-amber-400" />
                            Suspendida
                          </span>
                        ) : lic.status === "expired" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-zinc-500/20 text-zinc-400 border border-zinc-500/30">
                            <Clock className="w-3 h-3 text-zinc-400" />
                            Vencida
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                            <XCircle className="w-3 h-3 text-rose-400" />
                            Revocada
                          </span>
                        )}
                      </td>

                      {/* Vencimiento */}
                      <td className="py-3.5 px-4">
                        <div suppressHydrationWarning className="font-mono text-zinc-200">
                          {new Date(lic.expires_at).toISOString().split("T")[0]}
                        </div>
                        <div
                          className={`text-[10px] font-medium ${
                            isExpired
                              ? "text-rose-400"
                              : isExpiringSoon
                              ? "text-amber-400"
                              : "text-zinc-400"
                          }`}
                        >
                          {isExpired
                            ? "Caducada"
                            : `${daysLeft} días restantes`}
                        </div>
                      </td>

                      {/* Acciones Rápidas */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="relative inline-block text-left">
                          <button
                            onClick={() =>
                              setActionMenuOpenId(
                                actionMenuOpenId === lic.id ? null : lic.id
                              )
                            }
                            className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {actionMenuOpenId === lic.id && (
                            <div className="absolute right-0 mt-2 w-48 rounded-xl glass-panel shadow-2xl border border-white/15 p-1 z-30 space-y-0.5 text-xs">
                              <button
                                onClick={async () => {
                                  setActionMenuOpenId(null);
                                  await onExtendLicense(lic.id, 30);
                                  toast.success("Vigencia extendida (+30 días)", {
                                    description: `Licencia ${lic.license_key} extendida un mes.`,
                                  });
                                }}
                                className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-white/10 text-emerald-300 hover:text-emerald-200 transition-colors flex items-center gap-2"
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>Extender +30 Días</span>
                              </button>

                              <button
                                onClick={async () => {
                                  setActionMenuOpenId(null);
                                  await onExtendLicense(lic.id, 365);
                                  toast.success("Vigencia extendida (+1 año)", {
                                    description: `Licencia ${lic.license_key} extendida por 365 días.`,
                                  });
                                }}
                                className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-white/10 text-violet-300 hover:text-violet-200 transition-colors flex items-center gap-2"
                              >
                                <Calendar className="w-3.5 h-3.5" />
                                <span>Extender +1 Año</span>
                              </button>

                              {onOpenManualPayment && (
                                <button
                                  onClick={() => {
                                    setActionMenuOpenId(null);
                                    onOpenManualPayment(lic.company_id, lic.id);
                                  }}
                                  className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-emerald-500/20 text-emerald-300 hover:text-emerald-200 transition-colors flex items-center gap-2"
                                >
                                  <CreditCard className="w-3.5 h-3.5" />
                                  <span>Registrar Pago</span>
                                </button>
                              )}

                              <div className="border-t border-white/10 my-1" />

                              {lic.status === "active" ? (
                                <button
                                  onClick={async () => {
                                    setActionMenuOpenId(null);
                                    await onUpdateStatus(lic.id, "paused");
                                    toast.warning("Licencia pausada", {
                                      description: `La clave ${lic.license_key} ha sido suspendida temporalmente.`,
                                    });
                                  }}
                                  className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-white/10 text-amber-300 transition-colors flex items-center gap-2"
                                >
                                  <PauseCircle className="w-3.5 h-3.5" />
                                  <span>Suspender / Pausar</span>
                                </button>
                              ) : (
                                <button
                                  onClick={async () => {
                                    setActionMenuOpenId(null);
                                    await onUpdateStatus(lic.id, "active");
                                    toast.success("Licencia reactivada", {
                                      description: `La clave ${lic.license_key} vuelve a estar en estado ACTIVA.`,
                                    });
                                  }}
                                  className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-white/10 text-emerald-300 transition-colors flex items-center gap-2"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Reactivar Licencia</span>
                                </button>
                              )}

                              <button
                                onClick={async () => {
                                  if (
                                    confirm(
                                      "¿Estás seguro de revocar permanentemente esta licencia? Ningún equipo podrá usarla."
                                    )
                                  ) {
                                    setActionMenuOpenId(null);
                                    await onUpdateStatus(lic.id, "revoked");
                                    toast.error("Licencia revocada", {
                                      description: `La clave ${lic.license_key} ha sido invalidada definitivamente.`,
                                    });
                                  }
                                }}
                                className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-rose-500/20 text-rose-400 transition-colors flex items-center gap-2"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Revocar Licencia</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Crear Nueva Licencia */}
      <AnimatePresence>
        {isOpenCreateModal && (
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
              className="relative w-full max-w-xl rounded-2xl glass-panel border border-white/20 p-6 shadow-2xl overflow-hidden"
            >
              <BorderBeam size={220} duration={8} colorFrom="#8b5cf6" colorTo="#10b981" />
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-violet-600/20 text-violet-400 border border-violet-500/30">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    Generar Nueva Licencia Criptográfica
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Emite una clave firmada con cupos de hardware garantizados.
                  </p>
                </div>
              </div>
              <button
                onClick={() => { onSetOpenCreateModal(false); setCreateError(null); }}
                className="p-1 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white"
              >
                ✕
              </button>
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
                    onClick={() => {
                      onSetOpenCreateModal(false);
                      setCreatedLicenseResult(null);
                    }}
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
                  <label className="block text-zinc-300 font-semibold mb-1">
                    Empresa Cliente
                  </label>
                  <select
                    value={selectedCompanyId}
                    onChange={(e) => setSelectedCompanyId(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white focus:outline-none focus:border-violet-500/50"
                  >
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.nit_rut})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Correo Electrónico del Cliente (customer_email) */}
                <div>
                  <label className="block text-zinc-300 font-semibold mb-1">
                    Correo del Cliente (customer_email)
                  </label>
                  <input
                    type="email"
                    placeholder="cliente@joyeria.com (Opcional, compatible con Supabase)"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/50"
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
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white focus:outline-none focus:border-violet-500/50"
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
                      className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white focus:outline-none focus:border-violet-500/50"
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
                      className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white focus:outline-none focus:border-violet-500/50"
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
                            ? "bg-violet-600/30 border-violet-500 text-white"
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
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white focus:outline-none focus:border-violet-500/50"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => { onSetOpenCreateModal(false); setCreateError(null); }}
                    className="px-4 py-2 rounded-xl hover:bg-white/10 text-zinc-300 font-medium transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-emerald-500 hover:from-violet-500 hover:to-emerald-400 text-white font-semibold shadow-lg shadow-violet-600/25 transition-all"
                  >
                    {isSubmitting ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                    <span>Emitir y Generar Clave</span>
                  </button>
                </div>
              </form>
            )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
