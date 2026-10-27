"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import { BorderBeam } from "./ui/BorderBeam";
import {
  CreditCard,
  Building,
  KeyRound,
  DollarSign,
  Receipt,
  Sparkles,
  Calendar,
  CheckCircle2,
  X,
  FileText,
  RefreshCw,
} from "lucide-react";
import { Company, License } from "@/lib/types";

interface ManualPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  companies: Company[];
  licenses: License[];
  preselectedCompanyId?: string;
  preselectedLicenseId?: string;
  onPaymentSuccess: () => Promise<void>;
}

export function ManualPaymentModal({
  isOpen,
  onClose,
  companies,
  licenses,
  preselectedCompanyId,
  preselectedLicenseId,
  onPaymentSuccess,
}: ManualPaymentModalProps) {
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [selectedLicenseId, setSelectedLicenseId] = useState<string>("");
  const [amount, setAmount] = useState<number>(150);
  const [currency, setCurrency] = useState<"USD" | "COP">("USD");
  const [paymentMethod, setPaymentMethod] = useState<
    "Transferencia Bancaria" | "Nequi" | "PSE" | "Efectivo" | "Tarjeta"
  >("Transferencia Bancaria");
  const [referenceId, setReferenceId] = useState<string>("");
  const [actionOnLicense, setActionOnLicense] = useState<
    "extend_30" | "extend_180" | "extend_365" | "reactivate" | "none"
  >("extend_30");
  const [notes, setNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (preselectedCompanyId) {
      setSelectedCompanyId(preselectedCompanyId);
    } else if (companies.length > 0 && !selectedCompanyId) {
      setSelectedCompanyId(companies[0].id);
    }
  }, [preselectedCompanyId, companies, selectedCompanyId]);

  useEffect(() => {
    if (preselectedLicenseId) {
      setSelectedLicenseId(preselectedLicenseId);
    }
  }, [preselectedLicenseId]);

  // Filter licenses for selected company
  const companyLicenses = licenses.filter(
    (l) => l.company_id === selectedCompanyId
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompanyId) {
      toast.error("Selecciona una empresa cliente.");
      return;
    }
    if (!amount || amount <= 0) {
      toast.error("Ingresa un monto válido mayor a 0.");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch("/api/v1/payments/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: selectedCompanyId,
          license_id: selectedLicenseId || undefined,
          amount: Number(amount),
          currency,
          payment_method: paymentMethod,
          reference_id: referenceId.trim() || undefined,
          action_on_license: actionOnLicense,
          notes: notes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Error al procesar el pago");
      }

      confetti({
        particleCount: 85,
        spread: 65,
        origin: { y: 0.6 },
      });

      toast.success("¡Pago manual registrado exitosamente!", {
        description: `Monto: $${Number(amount).toLocaleString()} ${currency} vía ${paymentMethod}.`,
      });

      await onPaymentSuccess();
      onClose();
    } catch (err: any) {
      toast.error("Error al registrar pago", { description: err.message });
    } finally {
      setIsSubmitting(false);
    }
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
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            className="relative w-full max-w-xl rounded-3xl bg-[#090d12]/95 border border-gold-500/30 p-6 shadow-2xl backdrop-blur-2xl overflow-hidden"
          >
            <BorderBeam size={240} duration={8} colorFrom="#caa455" colorTo="#10b981" />

            {/* Header */}
            <div className="flex flex-col items-center text-center pb-4 border-b border-white/10 relative">
              <button
                onClick={onClose}
                className="absolute right-0 top-0 p-1.5 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
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
                <span>Tesorería & Facturación</span>
                <span>•</span>
                <span>Recaudo Manual</span>
              </div>

              <h3 className="text-xl font-bold tracking-tight text-white">
                <span className="bg-gradient-to-r from-gold-300 via-gold-400 to-emerald-400 bg-clip-text text-transparent">
                  Registrar Pago Manual
                </span>
              </h3>
              <p className="text-xs text-zinc-400 max-w-sm mt-0.5">
                Asienta comprobantes de banco, Nequi, PSE o efectivo y actualiza licencias en Supabase
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4 text-xs">
              {/* Cliente Selector */}
              <div>
                <label className="block text-zinc-300 font-semibold mb-1">
                  Empresa / Cliente Destinatario
                </label>
                <select
                  value={selectedCompanyId}
                  onChange={(e) => {
                    setSelectedCompanyId(e.target.value);
                    setSelectedLicenseId("");
                  }}
                  required
                  className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:border-emerald-500/50"
                >
                  <option value="" disabled>
                    Selecciona un cliente
                  </option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.nit_rut})
                    </option>
                  ))}
                </select>
              </div>

              {/* Licencia a impactar */}
              <div>
                <label className="block text-zinc-300 font-semibold mb-1">
                  Licencia Asociada (Opcional)
                </label>
                <select
                  value={selectedLicenseId}
                  onChange={(e) => setSelectedLicenseId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:border-emerald-500/50 font-mono text-[11px]"
                >
                  <option value="">-- Sin licencia directa (Solo registro contable) --</option>
                  {companyLicenses.map((lic) => (
                    <option key={lic.id} value={lic.id}>
                      {lic.license_key} - {lic.app_name || lic.app_slug} ({lic.plan_tier})
                    </option>
                  ))}
                </select>
                {selectedCompanyId && companyLicenses.length === 0 && (
                  <span className="text-[11px] text-amber-400/80 mt-1 block">
                    Este cliente aún no tiene licencias registradas.
                  </span>
                )}
              </div>

              {/* Monto y Moneda */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-300 font-semibold mb-1">
                    Monto Cobrado
                  </label>
                  <div className="relative">
                    <DollarSign className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="number"
                      min={1}
                      step="any"
                      value={amount}
                      onChange={(e) => setAmount(Number(e.target.value))}
                      required
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white font-mono font-semibold focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-zinc-300 font-semibold mb-1">
                    Moneda
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setCurrency("USD")}
                      className={`py-2 rounded-xl border font-bold text-center transition-all ${
                        currency === "USD"
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                          : "bg-white/5 text-zinc-400 border-white/10 hover:bg-white/10"
                      }`}
                    >
                      USD ($)
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrency("COP")}
                      className={`py-2 rounded-xl border font-bold text-center transition-all ${
                        currency === "COP"
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                          : "bg-white/5 text-zinc-400 border-white/10 hover:bg-white/10"
                      }`}
                    >
                      COP ($)
                    </button>
                  </div>
                </div>
              </div>

              {/* Método de Pago y Referencia */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-300 font-semibold mb-1">
                    Canal / Método de Pago
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:border-emerald-500/50"
                  >
                    <option value="Transferencia Bancaria">Transferencia Bancaria</option>
                    <option value="Nequi">Nequi</option>
                    <option value="PSE">PSE</option>
                    <option value="Efectivo">Efectivo</option>
                    <option value="Tarjeta">Tarjeta de Crédito / Débito</option>
                  </select>
                </div>

                <div>
                  <label className="block text-zinc-300 font-semibold mb-1">
                    N° Comprobante / Referencia
                  </label>
                  <div className="relative">
                    <Receipt className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Ej. TRF-902182 o N/A"
                      value={referenceId}
                      onChange={(e) => setReferenceId(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white font-mono text-[11px] focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>
                </div>
              </div>

              {/* Acción en la Licencia */}
              {selectedLicenseId && (
                <div className="p-3.5 rounded-xl bg-violet-950/20 border border-violet-500/30 space-y-2">
                  <div className="flex items-center gap-1.5 text-violet-300 font-bold uppercase text-[10px] tracking-wider">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Acción Automática sobre la Licencia</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: "extend_30", label: "+30 Días" },
                      { id: "extend_180", label: "+6 Meses" },
                      { id: "extend_365", label: "+1 Año" },
                      { id: "reactivate", label: "Solo Reactivar" },
                    ].map((act) => (
                      <button
                        key={act.id}
                        type="button"
                        onClick={() => setActionOnLicense(act.id as any)}
                        className={`py-1.5 px-2 rounded-lg font-semibold text-center border transition-all ${
                          actionOnLicense === act.id
                            ? "bg-violet-600/30 text-violet-200 border-violet-400 shadow-md"
                            : "bg-white/5 text-zinc-400 border-white/10 hover:bg-white/10"
                        }`}
                      >
                        {act.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Observaciones */}
              <div>
                <label className="block text-zinc-300 font-semibold mb-1">
                  Notas de Auditoría (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej. Pago verificado con extracto bancario de Bancolombia"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={onClose}
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
                    <CheckCircle2 className="w-4 h-4 text-[#080f15]" />
                  )}
                  <span>{isSubmitting ? "Registrando..." : "Asentar Pago y Actualizar"}</span>
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
