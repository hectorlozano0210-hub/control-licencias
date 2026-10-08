"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  Search,
  Filter,
  Plus,
  CreditCard,
  Mail,
  Phone,
  ArrowUpRight,
  Sparkles,
  Users,
  DollarSign,
  TrendingUp,
  FileText,
  KeyRound,
  CheckCircle2,
  X,
  Receipt,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { GlowCard } from "./GlowCard";
import { BorderBeam } from "./ui/BorderBeam";
import { CompanyWithStats, Company } from "@/lib/types";

interface ClientsViewProps {
  clients: CompanyWithStats[];
  onRefresh: () => Promise<void>;
  onSelectClientForDetail: (client: CompanyWithStats) => void;
  onOpenManualPayment: (companyId?: string) => void;
  onOpenCreateLicense: (companyId?: string) => void;
}

export function ClientsView({
  clients,
  onRefresh,
  onSelectClientForDetail,
  onOpenManualPayment,
  onOpenCreateLicense,
}: ClientsViewProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isOpenCreateClientModal, setIsOpenCreateClientModal] = useState(false);
  const [copiedNit, setCopiedNit] = useState<string | null>(null);

  // Form states for new client
  const [name, setName] = useState("");
  const [nitRut, setNitRut] = useState("");
  const [legalName, setLegalName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCopyNit = (nit: string) => {
    navigator.clipboard.writeText(nit);
    setCopiedNit(nit);
    toast.success("NIT copiado", { description: nit });
    setTimeout(() => setCopiedNit(null), 2000);
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !nitRut.trim() || !email.trim()) {
      toast.error("Por favor completa los campos obligatorios.");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch("/api/v1/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          nit_rut: nitRut.trim(),
          legal_name: legalName.trim() || name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          notes: notes.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "No se pudo crear el cliente");
      }

      toast.success("¡Cliente registrado exitosamente!", {
        description: `${data.client.name} ha sido agregado al directorio.`,
      });

      setName("");
      setNitRut("");
      setLegalName("");
      setEmail("");
      setPhone("");
      setNotes("");
      setIsOpenCreateClientModal(false);
      await onRefresh();
    } catch (err: any) {
      toast.error("Error al crear cliente", { description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredClients = clients.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.nit_rut.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || c.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Global calculations
  const totalClients = clients.length;
  const clientsWithActiveLicenses = clients.filter(
    (c) => c.active_licenses_count > 0
  ).length;
  const totalBilledUSD = clients.reduce((acc, c) => acc + c.total_paid_usd, 0);
  const totalBilledCOP = clients.reduce((acc, c) => acc + c.total_paid_cop, 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Title & Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
            <Building2 className="w-7 h-7 text-blue-400" />
            Directorio de Clientes & Facturación
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Gestión de empresas contratantes, seguimiento de cartera y recaudos de suscripciones.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => onOpenManualPayment()}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold shadow-lg shadow-emerald-950/40 transition-all active:scale-95"
          >
            <CreditCard className="w-4 h-4" />
            <span>Registrar Pago</span>
          </button>

          <button
            onClick={() => setIsOpenCreateClientModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white font-semibold text-xs shadow-lg shadow-blue-900/30 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Cliente</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <GlowCard glowColor="cyan" className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Total Clientes
            </span>
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-extrabold text-white">
            {totalClients}
          </div>
          <span className="text-[11px] text-zinc-400 mt-1 block">
            Empresas en directorio
          </span>
        </GlowCard>

        <GlowCard glowColor="emerald" className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Con Licencias Activas
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <KeyRound className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-extrabold text-white">
            {clientsWithActiveLicenses}
          </div>
          <span className="text-[11px] text-emerald-400 mt-1 block font-medium">
            {totalClients > 0
              ? Math.round((clientsWithActiveLicenses / totalClients) * 100)
              : 0}
            % de penetración activa
          </span>
        </GlowCard>

        <GlowCard glowColor="violet" showBorderBeam={true} className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Recaudo Total (USD)
            </span>
            <div className="p-2 rounded-xl bg-violet-500/10 text-violet-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-extrabold text-white font-mono">
            ${totalBilledUSD.toLocaleString()}
          </div>
          <span className="text-[11px] text-zinc-400 mt-1 block">
            Facturación internacional
          </span>
        </GlowCard>

        <GlowCard glowColor="emerald" className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Recaudo Total (COP)
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-extrabold text-white font-mono">
            ${totalBilledCOP.toLocaleString()}
          </div>
          <span className="text-[11px] text-zinc-400 mt-1 block">
            Cobros locales (PSE / Nequi)
          </span>
        </GlowCard>
      </div>

      {/* Filter toolbar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 rounded-2xl glass-panel border border-white/10">
        <div className="relative md:col-span-2">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por Nombre, NIT o Correo Electrónico..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs placeholder:text-zinc-500 focus:outline-none focus:border-blue-500/50"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-zinc-400 shrink-0" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-zinc-200 text-xs focus:outline-none focus:border-blue-500/50"
          >
            <option value="all">Todos los Estados</option>
            <option value="active">Activos</option>
            <option value="trial">Prueba / Trial</option>
            <option value="suspended">Suspendidos</option>
          </select>
        </div>
      </div>

      {/* Clients Table */}
      <div className="overflow-hidden rounded-2xl glass-panel border border-white/10 shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-white/5 text-[11px] uppercase tracking-wider text-zinc-400 font-semibold">
                <th className="py-3.5 px-4">Empresa / Razón Social</th>
                <th className="py-3.5 px-4">NIT / Identificación</th>
                <th className="py-3.5 px-4">Contacto Principal</th>
                <th className="py-3.5 px-4">Licencias Activas</th>
                <th className="py-3.5 px-4">Total Pagado</th>
                <th className="py-3.5 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs text-zinc-300">
              {filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-500">
                    No se encontraron clientes con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => (
                  <tr
                    key={client.id}
                    className="hover:bg-white/[0.03] transition-colors group"
                  >
                    {/* Empresa */}
                    <td className="py-3.5 px-4">
                      <div
                        onClick={() => onSelectClientForDetail(client)}
                        className="font-bold text-white hover:text-blue-300 transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <span>{client.name}</span>
                        <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-blue-400" />
                      </div>
                      <div className="text-[11px] text-zinc-500">
                        {client.legal_name || "Misma razón social"}
                      </div>
                    </td>

                    {/* NIT */}
                    <td className="py-3.5 px-4 font-mono">
                      <div className="flex items-center gap-2">
                        <span className="text-zinc-200 bg-black/40 px-2 py-0.5 rounded border border-white/5">
                          {client.nit_rut}
                        </span>
                        <button
                          onClick={() => handleCopyNit(client.nit_rut)}
                          className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white"
                          title="Copiar NIT"
                        >
                          {copiedNit === client.nit_rut ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* Contacto */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 text-zinc-300">
                        <Mail className="w-3 h-3 text-zinc-500 shrink-0" />
                        <span className="truncate max-w-[180px]">{client.email}</span>
                      </div>
                      {client.phone && (
                        <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 mt-0.5">
                          <Phone className="w-2.5 h-2.5 text-zinc-500 shrink-0" />
                          <span>{client.phone}</span>
                        </div>
                      )}
                    </td>

                    {/* Licencias */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                            client.active_licenses_count > 0
                              ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                              : "bg-zinc-800 text-zinc-400 border-zinc-700"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              client.active_licenses_count > 0
                                ? "bg-emerald-400 animate-pulse"
                                : "bg-zinc-500"
                            }`}
                          />
                          {client.active_licenses_count} activa
                          {client.active_licenses_count !== 1 ? "s" : ""}
                        </span>
                        <span className="text-[10px] text-zinc-500">
                          ({client.total_licenses} tot.)
                        </span>
                      </div>
                    </td>

                    {/* Total Pagado */}
                    <td className="py-3.5 px-4 font-mono font-medium">
                      {client.total_paid_usd > 0 && (
                        <div className="text-emerald-300">
                          ${client.total_paid_usd.toLocaleString()} USD
                        </div>
                      )}
                      {client.total_paid_cop > 0 && (
                        <div className="text-violet-300 text-[11px]">
                          ${client.total_paid_cop.toLocaleString()} COP
                        </div>
                      )}
                      {client.total_paid_usd === 0 && client.total_paid_cop === 0 && (
                        <span className="text-zinc-500 text-[11px]">$0.00</span>
                      )}
                    </td>

                    {/* Acciones */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onSelectClientForDetail(client)}
                          className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border border-white/10 text-xs font-medium transition-colors"
                          title="Ver Ficha y Licencias"
                        >
                          Ver Ficha
                        </button>

                        <button
                          onClick={() => onOpenManualPayment(client.id)}
                          className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-colors"
                          title="Registrar Pago para este cliente"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => onOpenCreateLicense(client.id)}
                          className="p-1.5 rounded-lg bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 border border-violet-500/20 transition-colors"
                          title="Emitir nueva licencia para este cliente"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Crear Nuevo Cliente */}
      <AnimatePresence>
        {isOpenCreateClientModal && (
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
              className="relative w-full max-w-lg rounded-2xl glass-panel border border-white/20 p-6 shadow-2xl overflow-hidden"
            >
              <BorderBeam size={200} duration={8} colorFrom="#3b82f6" colorTo="#8b5cf6" />

              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">
                      Registrar Nuevo Cliente
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Agrega una empresa o cliente para emitir licencias y registrar pagos.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpenCreateClientModal(false)}
                  className="p-1 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateClient} className="mt-5 space-y-4 text-xs">
                <div>
                  <label className="block text-zinc-300 font-semibold mb-1">
                    Nombre Comercial / Empresa *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Inversiones Andinas S.A.S."
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:border-blue-500/50"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-zinc-300 font-semibold mb-1">
                      NIT / Identificación *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. 901.442.110-3"
                      value={nitRut}
                      onChange={(e) => setNitRut(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white font-mono focus:outline-none focus:border-blue-500/50"
                    />
                  </div>

                  <div>
                    <label className="block text-zinc-300 font-semibold mb-1">
                      Razón Social Legal (Opcional)
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. Inversiones Andinas Global"
                      value={legalName}
                      onChange={(e) => setLegalName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:border-blue-500/50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-zinc-300 font-semibold mb-1">
                      Correo Electrónico *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="admin@empresa.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:border-blue-500/50"
                    />
                  </div>

                  <div>
                    <label className="block text-zinc-300 font-semibold mb-1">
                      Teléfono de Contacto
                    </label>
                    <input
                      type="text"
                      placeholder="+57 312 456 7890"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:border-blue-500/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-zinc-300 font-semibold mb-1">
                    Notas o Dirección de Facturación
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Sede Medellín - Carrera 43A # 1-50"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:border-blue-500/50"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setIsOpenCreateClientModal(false)}
                    className="px-4 py-2 rounded-xl hover:bg-white/10 text-zinc-300 font-medium transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold shadow-lg shadow-blue-900/40 transition-all active:scale-95"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{isSubmitting ? "Guardando..." : "Crear Cliente"}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
