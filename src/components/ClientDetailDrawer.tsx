"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Building,
  KeyRound,
  CreditCard,
  Mail,
  Phone,
  Calendar,
  CheckCircle2,
  Clock,
  PauseCircle,
  XCircle,
  Copy,
  Check,
  Plus,
  Sparkles,
  Receipt,
  DollarSign,
  Layers,
  ArrowUpRight,
} from "lucide-react";
import { toast } from "sonner";
import { CompanyWithStats, License, PaymentRecord } from "@/lib/types";

interface ClientDetailDrawerProps {
  client: CompanyWithStats | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenCreateLicenseForClient: (companyId: string) => void;
  onOpenManualPaymentForClient: (companyId: string, licenseId?: string) => void;
}

export function ClientDetailDrawer({
  client,
  isOpen,
  onClose,
  onOpenCreateLicenseForClient,
  onOpenManualPaymentForClient,
}: ClientDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<"licenses" | "payments">("licenses");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!client) return null;

  const handleCopy = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    toast.success("Clave de licencia copiada", { description: key });
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const clientLicenses = client.licenses || [];
  const clientPayments = client.payments || [];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/75 backdrop-blur-md">
          {/* Backdrop click to close */}
          <div className="absolute inset-0" onClick={onClose} />

          <motion.div
            initial={{ x: "100%", opacity: 0.5 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 350, damping: 32 }}
            className="relative w-full max-w-2xl h-full bg-[#0c0c12]/95 border-l border-white/15 p-6 shadow-2xl flex flex-col overflow-hidden z-10"
          >
            {/* Top Close bar */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-900/40">
                  <Building className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-white tracking-tight">
                      {client.name}
                    </h2>
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                        client.status === "active"
                          ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                          : "bg-amber-500/15 text-amber-300 border-amber-500/30"
                      }`}
                    >
                      {client.status}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-400 font-mono mt-0.5">
                    NIT/RUT: <strong className="text-zinc-300">{client.nit_rut}</strong>
                  </div>
                </div>
              </div>

              <button
                onClick={onClose}
                className="p-2 rounded-xl hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Contact & Details Bar */}
            <div className="grid grid-cols-2 gap-3 my-4 p-3.5 rounded-xl bg-white/[0.03] border border-white/5 text-xs text-zinc-300">
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <span className="truncate">{client.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <span>{client.phone || "Sin teléfono"}</span>
              </div>
            </div>

            {/* Financial & Licensing Overview KPIs */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="p-3.5 rounded-xl glass-panel border border-white/10">
                <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider block">
                  Licencias Activas
                </span>
                <div className="text-xl font-extrabold text-white mt-1">
                  {client.active_licenses_count}
                  <span className="text-xs text-zinc-500 font-normal ml-1">
                    / {client.total_licenses} emitidas
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl glass-panel border border-emerald-500/20 bg-emerald-500/5">
                <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider block">
                  Total Pagado (USD)
                </span>
                <div className="text-xl font-extrabold text-emerald-300 mt-1 font-mono">
                  ${client.total_paid_usd.toLocaleString()}
                </div>
              </div>

              <div className="p-3.5 rounded-xl glass-panel border border-violet-500/20 bg-violet-500/5">
                <span className="text-[10px] uppercase font-bold text-violet-400 tracking-wider block">
                  Total Pagado (COP)
                </span>
                <div className="text-xl font-extrabold text-violet-300 mt-1 font-mono">
                  ${client.total_paid_cop.toLocaleString()}
                </div>
              </div>
            </div>

            {/* Quick Actions Header */}
            <div className="flex items-center gap-2.5 pb-4 border-b border-white/10">
              <button
                onClick={() => onOpenManualPaymentForClient(client.id)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs shadow-lg shadow-emerald-950/40 transition-all active:scale-95"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Registrar Pago Manual</span>
              </button>

              <button
                onClick={() => onOpenCreateLicenseForClient(client.id)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-lg shadow-violet-950/40 transition-all active:scale-95"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Emitir Nueva Licencia</span>
              </button>
            </div>

            {/* Tabs Selector */}
            <div className="flex items-center gap-2 my-4">
              <button
                onClick={() => setActiveTab("licenses")}
                className={`flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border transition-all ${
                  activeTab === "licenses"
                    ? "bg-violet-600/25 border-violet-500/40 text-violet-200"
                    : "bg-white/5 border-white/10 text-zinc-400 hover:text-white"
                }`}
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Licencias Vinculadas ({clientLicenses.length})</span>
              </button>

              <button
                onClick={() => setActiveTab("payments")}
                className={`flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border transition-all ${
                  activeTab === "payments"
                    ? "bg-emerald-600/25 border-emerald-500/40 text-emerald-200"
                    : "bg-white/5 border-white/10 text-zinc-400 hover:text-white"
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Historial de Pagos ({clientPayments.length})</span>
              </button>
            </div>

            {/* Tab Contents (Scrollable) */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {activeTab === "licenses" ? (
                clientLicenses.length === 0 ? (
                  <div className="py-12 text-center text-zinc-500 text-xs">
                    Este cliente aún no tiene licencias asignadas. Haz clic en &quot;Emitir Nueva Licencia&quot;.
                  </div>
                ) : (
                  clientLicenses.map((lic) => {
                    const daysLeft = Math.ceil(
                      (new Date(lic.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                    );

                    return (
                      <div
                        key={lic.id}
                        className="p-4 rounded-xl glass-panel border border-white/10 hover:border-white/20 transition-all space-y-2.5 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white">
                              {lic.app_name || lic.app_slug}
                            </span>
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-black/40 border border-white/10 text-violet-300">
                              {lic.plan_tier}
                            </span>
                          </div>

                          {lic.status === "active" ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              Activa
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold text-amber-400">
                              {lic.status.toUpperCase()}
                            </span>
                          )}
                        </div>

                        {/* License key with copy */}
                        <div className="flex items-center justify-between p-2 rounded-lg bg-black/50 border border-white/10 font-mono text-[11px] text-zinc-200">
                          <span className="select-all">{lic.license_key}</span>
                          <button
                            onClick={() => handleCopy(lic.license_key)}
                            className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white"
                          >
                            {copiedKey === lic.license_key ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-zinc-400">
                          <span>
                            Cupos: <strong className="text-white">{lic.current_seats} / {lic.max_seats}</strong>
                          </span>
                          <span className={daysLeft <= 7 ? "text-amber-400 font-semibold" : ""}>
                            Vence: {new Date(lic.expires_at).toISOString().split("T")[0]} ({daysLeft}d)
                          </span>
                        </div>
                      </div>
                    );
                  })
                )
              ) : clientPayments.length === 0 ? (
                <div className="py-12 text-center text-zinc-500 text-xs">
                  No se registran pagos previos para este cliente.
                </div>
              ) : (
                clientPayments.map((pay) => (
                  <div
                    key={pay.id}
                    className="p-4 rounded-xl glass-panel border border-white/10 flex items-center justify-between text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white font-mono text-sm">
                          ${Number(pay.amount).toLocaleString()} {pay.currency}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-zinc-300">
                          {pay.payment_method || pay.payment_provider}
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-400 font-mono">
                        Ref: {pay.external_transaction_id || "N/A"}
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
                        <CheckCircle2 className="w-3 h-3" />
                        Completado
                      </span>
                      <div className="text-[10px] text-zinc-500 mt-1">
                        {new Date(pay.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
