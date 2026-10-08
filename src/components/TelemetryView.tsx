"use client";

import React, { useState } from "react";
import {
  ShieldAlert,
  AlertTriangle,
  ShieldCheck,
  Search,
  Filter,
  Activity,
  Globe,
  Cpu,
  Clock,
  KeyRound,
  RefreshCw,
} from "lucide-react";
import { LicenseLog } from "@/lib/types";

interface TelemetryViewProps {
  logs: LicenseLog[];
  onRefresh: () => void;
  isLoading?: boolean;
}

export function TelemetryView({ logs, onRefresh, isLoading }: TelemetryViewProps) {
  const [mounted, setMounted] = React.useState(false);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      (log.message && log.message.toLowerCase().includes(search.toLowerCase())) ||
      (log.license_key && log.license_key.toLowerCase().includes(search.toLowerCase())) ||
      (log.ip_address && log.ip_address.toLowerCase().includes(search.toLowerCase())) ||
      (log.machine_fingerprint &&
        log.machine_fingerprint.toLowerCase().includes(search.toLowerCase())) ||
      log.event_type.toLowerCase().includes(search.toLowerCase());

    const isFraud =
      log.event_type === "activate_fraud_blocked" ||
      (!log.success && log.event_type === "activate_attempt");

    const matchesFilter =
      filterType === "all" ||
      (filterType === "fraud" && isFraud) ||
      (filterType === "success" && log.success) ||
      (filterType === "device" &&
        (log.event_type === "device_deactivated" || log.event_type === "activate_success"));

    return matchesSearch && matchesFilter;
  });

  const fraudCount = logs.filter(
    (l) => l.event_type === "activate_fraud_blocked" || (!l.success && l.event_type === "activate_attempt")
  ).length;

  const successCount = logs.filter((l) => l.success).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
            <ShieldAlert className="w-7 h-7 text-rose-400" />
            Centro Antifraude y Telemetría en Vivo
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Feed en tiempo real de registros de auditoría y detección de clonación o sobrecupo.
          </p>
        </div>

        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border border-white/10 text-xs font-medium transition-all shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-rose-400" : ""}`} />
          <span>Actualizar Feed</span>
        </button>
      </div>

      {/* Metrics mini banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl glass-panel border border-white/10 flex items-center justify-between">
          <div>
            <div className="text-xs text-zinc-400 uppercase font-semibold">
              Eventos Auditados
            </div>
            <div className="text-2xl font-bold text-white mt-1">{logs.length}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-white/5 text-zinc-300">
            <Activity className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl glass-panel border border-rose-500/20 bg-rose-500/5 flex items-center justify-between">
          <div>
            <div className="text-xs text-rose-300 uppercase font-semibold">
              Intentos Bloqueados (Fraude)
            </div>
            <div className="text-2xl font-bold text-rose-400 mt-1">{fraudCount}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl glass-panel border border-emerald-500/20 bg-emerald-500/5 flex items-center justify-between">
          <div>
            <div className="text-xs text-emerald-300 uppercase font-semibold">
              Operaciones Exitosas
            </div>
            <div className="text-2xl font-bold text-emerald-400 mt-1">{successCount}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Search and filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 rounded-2xl glass-panel border border-white/10">
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Filtrar por IP, HWID, clave o descripción de evento..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs placeholder:text-zinc-500 focus:outline-none focus:border-rose-500/50"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-zinc-400 shrink-0" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-zinc-200 text-xs focus:outline-none focus:border-rose-500/50"
          >
            <option value="all">Todos los Registros</option>
            <option value="fraud">Solo Bloqueos y Violaciones Antifraude</option>
            <option value="success">Solo Operaciones Exitosas</option>
            <option value="device">Gestión de Equipos (Activaciones / Revocaciones)</option>
          </select>
        </div>
      </div>

      {/* Log Feed */}
      <div className="space-y-3">
        {filteredLogs.length === 0 ? (
          <div className="p-12 text-center rounded-2xl glass-panel border border-white/10 text-zinc-500 text-sm">
            No hay eventos que coincidan con el filtro de telemetría.
          </div>
        ) : (
          filteredLogs.map((log) => {
            const isFraud =
              log.event_type === "activate_fraud_blocked" ||
              (!log.success && log.event_type === "activate_attempt");

            return (
              <div
                key={log.id}
                className={`p-4 rounded-2xl border transition-all text-xs ${
                  isFraud
                    ? "bg-rose-950/25 border-rose-500/30 text-rose-200 shadow-lg shadow-rose-950/30"
                    : log.success
                    ? "bg-white/[0.03] border-white/10 text-zinc-300 hover:border-white/20"
                    : "bg-amber-950/20 border-amber-500/30 text-amber-200"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-white/5">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {isFraud ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-500/20 text-rose-400 border border-rose-500/40">
                        <AlertTriangle className="w-3 h-3" />
                        Bloqueo Antifraude
                      </span>
                    ) : log.success ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                        <ShieldCheck className="w-3 h-3" />
                        Permitido / Exitoso
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-500/20 text-amber-400 border border-amber-500/40">
                        <AlertTriangle className="w-3 h-3" />
                        Advertencia
                      </span>
                    )}

                    <span className="font-mono text-zinc-400 font-semibold">
                      {log.event_type}
                    </span>

                    {log.app_slug && (
                      <span className="px-2 py-0.5 rounded bg-black/40 text-[10px] text-zinc-400 border border-white/5">
                        {log.app_slug}
                      </span>
                    )}
                  </div>

                  <div suppressHydrationWarning className="text-[11px] text-zinc-500 font-mono flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-zinc-500" />
                    {mounted ? new Date(log.created_at).toLocaleString() : "--:--:--"}
                  </div>
                </div>

                <div className="mt-2.5 text-zinc-100 font-medium leading-relaxed">
                  {log.message}
                </div>

                {/* Metadata items */}
                <div className="mt-3 flex items-center gap-4 flex-wrap text-[11px] text-zinc-400 font-mono">
                  {log.license_key && (
                    <div className="flex items-center gap-1">
                      <KeyRound className="w-3 h-3 text-zinc-500" />
                      <span className="text-zinc-200">{log.license_key}</span>
                    </div>
                  )}

                  {log.ip_address && (
                    <div className="flex items-center gap-1">
                      <Globe className="w-3 h-3 text-zinc-500" />
                      <span>{log.ip_address}</span>
                    </div>
                  )}

                  {log.machine_fingerprint && (
                    <div className="flex items-center gap-1">
                      <Cpu className="w-3 h-3 text-zinc-500" />
                      <span>HWID: {log.machine_fingerprint.substring(0, 16)}...</span>
                    </div>
                  )}

                  {log.device_name && (
                    <div className="text-zinc-400">
                      Equipo: <strong className="text-zinc-300">{log.device_name}</strong>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
