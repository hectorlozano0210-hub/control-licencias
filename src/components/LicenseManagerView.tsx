"use client";

import React, { useState } from "react";
import { toast } from "sonner";
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
  preselectedAppId?: string;
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
  preselectedAppId,
}: LicenseManagerViewProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [appFilter, setAppFilter] = useState<string>("all");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [actionMenuOpenId, setActionMenuOpenId] = useState<string | null>(null);

  const allApps = React.useMemo(() => {
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
              <span className="bg-gradient-to-r from-white via-gold-300 to-emerald-400 bg-clip-text text-transparent">
                Gestor & Generador de Licencias
              </span>
            </h1>
            <p className="text-sm text-zinc-400 mt-1">
              Emisión de claves criptográficas, cuotas de cupos concurrentes y ciclo de vida de contratos.
            </p>
          </div>
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
              onSetOpenCreateModal(true);
            }}
            className="btn-shine flex items-center gap-2 px-4 py-2.5 rounded-full font-bold uppercase tracking-wider text-[#080f15] text-xs shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all border border-gold-300"
            style={{
              background: "linear-gradient(135deg, #ffdea1 0%, #caa455 50%, #8c6e2d 100%)",
              boxShadow: "0 0 20px rgba(202, 164, 85, 0.4)",
            }}
          >
            <Plus className="w-4 h-4 text-[#080f15]" />
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
    </div>
  );
}
