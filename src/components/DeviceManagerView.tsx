"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Cpu,
  Search,
  Laptop,
  CheckCircle2,
  XCircle,
  Clock,
  Trash2,
  Copy,
  Check,
  AlertCircle,
  Activity,
  HardDrive,
  Filter,
} from "lucide-react";
import { ActivatedDevice, License } from "@/lib/types";

interface DeviceManagerViewProps {
  devices: ActivatedDevice[];
  licenses: License[];
  onRevokeDevice: (deviceId: string) => Promise<void>;
  onRefresh: () => void;
}

export function DeviceManagerView({
  devices,
  licenses,
  onRevokeDevice,
  onRefresh,
}: DeviceManagerViewProps) {
  const [mounted, setMounted] = React.useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [copiedHwid, setCopiedHwid] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const tenMinAgo = Date.now() - 10 * 60 * 1000;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHwid(text);
    toast.success("Hardware ID copiado", { description: text });
    setTimeout(() => setCopiedHwid(null), 2000);
  };

  const handleRevoke = async (dev: ActivatedDevice) => {
    if (
      !confirm(
        `¿Confirmas la desvinculación forzada de "${dev.device_name}"? Esta máquina perderá acceso inmediatamente y se liberará su cupo.`
      )
    ) {
      return;
    }

    try {
      setRevokingId(dev.id);
      await onRevokeDevice(dev.id);
      toast.success("Equipo desvinculado forzosamente", {
        description: `Se liberó 1 cupo. El equipo "${dev.device_name}" fue revocado.`,
      });
    } catch (err: any) {
      toast.error("Error al desvincular", { description: err.message });
    } finally {
      setRevokingId(null);
    }
  };

  const filteredDevices = devices.filter((dev) => {
    const matchesSearch =
      dev.device_name.toLowerCase().includes(search.toLowerCase()) ||
      dev.machine_fingerprint.toLowerCase().includes(search.toLowerCase()) ||
      (dev.license_key && dev.license_key.toLowerCase().includes(search.toLowerCase())) ||
      (dev.os_info && dev.os_info.toLowerCase().includes(search.toLowerCase()));

    const isOnline =
      dev.is_active && new Date(dev.last_heartbeat_at).getTime() > tenMinAgo;

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "online" && isOnline) ||
      (statusFilter === "offline" && !isOnline && dev.is_active) ||
      (statusFilter === "revoked" && !dev.is_active);

    return matchesSearch && matchesStatus;
  });

  const activeCount = devices.filter((d) => d.is_active).length;
  const onlineCount = devices.filter(
    (d) => d.is_active && new Date(d.last_heartbeat_at).getTime() > tenMinAgo
  ).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
            <Cpu className="w-7 h-7 text-emerald-400" />
            Control de Dispositivos & Cupos (HWID)
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Máquinas enlazadas criptográficamente a cada licencia por huella de hardware.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-medium text-zinc-300">
            Total activos: <strong className="text-white">{activeCount}</strong>
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs font-semibold text-emerald-300 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            {onlineCount} en línea
          </span>
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 rounded-2xl glass-panel border border-white/10">
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por Hostname, HWID, SO o Licencia..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500/50"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-zinc-400 shrink-0" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-zinc-200 text-xs focus:outline-none focus:border-emerald-500/50"
          >
            <option value="all">Todos los Estados</option>
            <option value="online">En Línea (Heartbeat reciente)</option>
            <option value="offline">Fuera de Línea</option>
            <option value="revoked">Desvinculados / Revocados</option>
          </select>
        </div>
      </div>

      {/* Devices Grid / Table */}
      <div className="grid grid-cols-1 gap-4">
        {filteredDevices.length === 0 ? (
          <div className="p-12 text-center rounded-2xl glass-panel border border-white/10 text-zinc-500 text-sm">
            No se encontraron dispositivos vinculados que coincidan con la búsqueda.
          </div>
        ) : (
          filteredDevices.map((dev) => {
            const isOnline =
              dev.is_active && new Date(dev.last_heartbeat_at).getTime() > tenMinAgo;
            const lic = licenses.find((l) => l.id === dev.license_id);

            return (
              <div
                key={dev.id}
                className="p-5 rounded-2xl glass-panel border border-white/10 hover:border-white/20 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4 group"
              >
                {/* Left: Device Info */}
                <div className="flex items-start gap-4">
                  <div
                    className={`p-3.5 rounded-2xl shrink-0 border ${
                      dev.is_active
                        ? isOnline
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                          : "bg-cyan-500/10 border-cyan-500/30 text-cyan-400"
                        : "bg-zinc-800/60 border-zinc-700 text-zinc-500"
                    }`}
                  >
                    <HardDrive className="w-6 h-6" />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="font-bold text-white text-sm">
                        {dev.device_name}
                      </h3>
                      {dev.is_active ? (
                        isOnline ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            En Línea
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-zinc-600/20 text-zinc-400 border border-zinc-600/30">
                            <Clock className="w-2.5 h-2.5 text-zinc-400" />
                            Offline
                          </span>
                        )
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                          <XCircle className="w-2.5 h-2.5 text-rose-400" />
                          Desvinculado
                        </span>
                      )}
                      <span className="text-[10px] text-zinc-400 px-2 py-0.5 rounded bg-black/40 border border-white/5">
                        v{dev.app_version}
                      </span>
                    </div>

                    <div className="text-xs text-zinc-400 flex items-center gap-3 flex-wrap">
                      <span>{dev.os_info || "Sistema Operativo no detectado"}</span>
                      {dev.ip_address && (
                        <span>
                          IP: <strong className="text-zinc-300">{dev.ip_address}</strong>
                        </span>
                      )}
                      <span>
                        Pings recibidos:{" "}
                        <strong className="text-zinc-300">{dev.heartbeat_count}</strong>
                      </span>
                    </div>

                    {/* HWID hash */}
                    <div className="flex items-center gap-2 pt-1 font-mono text-[11px] text-zinc-400">
                      <span className="text-zinc-500 font-sans text-xs">HWID:</span>
                      <span className="select-all bg-black/40 px-2 py-0.5 rounded border border-white/5 text-zinc-300">
                        {dev.machine_fingerprint.substring(0, 24)}...
                      </span>
                      <button
                        onClick={() => handleCopy(dev.machine_fingerprint)}
                        className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white"
                        title="Copiar Hardware ID completo"
                      >
                        {copiedHwid === dev.machine_fingerprint ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right: License relationship & Actions */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between lg:justify-end gap-4 border-t lg:border-t-0 pt-3 lg:pt-0 border-white/5">
                  <div className="text-left lg:text-right space-y-0.5">
                    <div className="text-[11px] text-zinc-500 uppercase tracking-wider font-semibold">
                      Licencia Asignada
                    </div>
                    <div className="text-xs font-mono font-medium text-emerald-300">
                      {dev.license_key || lic?.license_key || "No asociada"}
                    </div>
                    <div className="text-[11px] text-zinc-400">
                      {lic?.company_name || "Cliente Corporativo"}
                    </div>
                    <div suppressHydrationWarning className="text-[10px] text-zinc-500">
                      Último ping: {mounted ? new Date(dev.last_heartbeat_at).toLocaleTimeString() : "--:--"}
                    </div>
                  </div>

                  {dev.is_active && (
                    <button
                      onClick={() => handleRevoke(dev)}
                      disabled={revokingId === dev.id}
                      className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 border border-rose-500/20 text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0"
                      title="Desvincular forzosamente y liberar un cupo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{revokingId === dev.id ? "Liberando..." : "Desvincular Equipo"}</span>
                    </button>
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
