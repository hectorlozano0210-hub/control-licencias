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
            className="relative w-full max-w-xl rounded-2xl glass-panel border border-white/20 p-6 shadow-2xl overflow-hidden"
          >
            <BorderBeam size={220} duration={8} colorFrom="#10b981" colorTo="#8b5cf6" />

            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    Registrar Pago Manual
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Asienta comprobantes de banco, Nequi, PSE o efectivo y actualiza licencias.
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
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
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-violet-600 hover:from-emerald-500 hover:to-violet-500 text-white font-semibold shadow-lg shadow-emerald-950/40 transition-all active:scale-95"
                >
                  <CheckCircle2 className="w-4 h-4" />
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
