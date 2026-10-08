"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  DollarSign,
  KeyRound,
  Cpu,
  AlertTriangle,
  TrendingUp,
  Activity,
  ArrowUpRight,
  ShieldCheck,
  RefreshCw,
  Layers,
  Clock,
  Sparkles,
  Users,
} from "lucide-react";
import { GlowCard } from "./GlowCard";
import { TextReveal } from "./ui/TextReveal";
import { BorderBeam } from "./ui/BorderBeam";
import { toast } from "sonner";
import { License, ActivatedDevice, LicenseLog, Application } from "@/lib/types";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface DashboardViewProps {
  licenses: License[];
  devices: ActivatedDevice[];
  logs: LicenseLog[];
  apps: Application[];
  onNavigateTab: (tab: any) => void;
  onOpenCreateLicense: () => void;
  onRefreshData: () => void;
  isLoading?: boolean;
}

const chartData = [
  { day: "Lun", activaciones: 4, verificaciones: 42, heartbeats: 180 },
  { day: "Mar", activaciones: 7, verificaciones: 65, heartbeats: 240 },
  { day: "Mié", activaciones: 5, verificaciones: 58, heartbeats: 290 },
  { day: "Jue", activaciones: 11, verificaciones: 84, heartbeats: 380 },
  { day: "Vie", activaciones: 9, verificaciones: 95, heartbeats: 410 },
  { day: "Sáb", activaciones: 3, verificaciones: 30, heartbeats: 195 },
  { day: "Dom", activaciones: 6, verificaciones: 48, heartbeats: 220 },
];

export function DashboardView({
  licenses,
  devices,
  logs,
  apps,
  onNavigateTab,
  onOpenCreateLicense,
  onRefreshData,
  isLoading,
}: DashboardViewProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const activeLicenses = licenses.filter((l) => l.status === "active");
  const tenMinAgo = Date.now() - 10 * 60 * 1000;
  const onlineDevices = devices.filter(
    (d) => d.is_active && new Date(d.last_heartbeat_at).getTime() > tenMinAgo
  );
  const fraudLogs = logs.filter(
    (l) => l.event_type === "activate_fraud_blocked" || (!l.success && l.event_type === "activate_attempt")
  );

  // Estimación de MRR basada en tiers
  const estimatedMRR = licenses.reduce((sum, lic) => {
    if (lic.status !== "active") return sum;
    if (lic.plan_tier === "Enterprise") return sum + 199;
    if (lic.plan_tier === "Professional") return sum + 99;
    return sum + 49;
  }, 0);

  // Distribución de asientos por App
  const appsSeatDistribution = apps.map((app) => {
    const appLicenses = licenses.filter((l) => l.app_id === app.id);
    const totalMax = appLicenses.reduce((acc, l) => acc + l.max_seats, 0);
    const totalUsed = appLicenses.reduce((acc, l) => acc + l.current_seats, 0);
    return {
      name: app.slug.replace("control-", "").replace("gestor-", ""),
      fullName: app.name,
      usados: totalUsed,
      disponibles: Math.max(0, totalMax - totalUsed),
      total: totalMax,
    };
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
              <TextReveal text="Centro de Control & Seguridad" />
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Sistemas Online
            </span>
          </div>
          <p className="text-sm text-zinc-400 mt-1">
            Supervisión criptográfica, cuotas de hardware en vivo y salud del ecosistema de software.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              onRefreshData();
              toast.info("Telemetría sincronizada", { description: "Datos actualizados en tiempo real." });
            }}
            disabled={isLoading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border border-white/10 text-xs font-medium transition-all"
            title="Refrescar telemetría"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-violet-400" : ""}`} />
            <span>Actualizar</span>
          </button>

          <button
            onClick={onOpenCreateLicense}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-emerald-500 hover:from-violet-500 hover:to-emerald-400 text-white font-semibold text-xs shadow-lg shadow-violet-600/25 transition-all transform active:scale-95"
          >
            <Sparkles className="w-4 h-4 text-emerald-200" />
            <span>Emitir Nueva Licencia</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* KPI 1: MRR */}
        <GlowCard glowColor="violet" showBorderBeam={true} className="p-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              MRR Estimado
            </span>
            <div className="p-2.5 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span suppressHydrationWarning className="text-3xl font-extrabold text-white tracking-tight">
              ${estimatedMRR.toLocaleString()}
            </span>
            <span className="text-xs text-zinc-400 font-medium">USD / mes</span>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>+18.4% vs mes anterior</span>
          </div>
        </GlowCard>

        {/* KPI 2: Licencias Activas */}
        <GlowCard glowColor="emerald" className="p-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Licencias Activas
            </span>
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <KeyRound className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white tracking-tight">
              {activeLicenses.length}
            </span>
            <span className="text-xs text-zinc-400 font-medium">
              de {licenses.length} emitidas
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-zinc-400">
            <span>Tasa de activación</span>
            <span className="font-semibold text-emerald-400">
              {licenses.length > 0
                ? Math.round((activeLicenses.length / licenses.length) * 100)
                : 0}
              %
            </span>
          </div>
        </GlowCard>

        {/* KPI 3: Equipos en Línea */}
        <GlowCard glowColor="cyan" className="p-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Dispositivos en Línea
            </span>
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Cpu className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white tracking-tight">
              {onlineDevices.length}
            </span>
            <span className="text-xs text-zinc-400 font-medium">
              vía Heartbeat ({devices.length} reg.)
            </span>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-cyan-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
            </span>
            <span>Heartbeats activos cada 5m</span>
          </div>
        </GlowCard>

        {/* KPI 4: Alertas Antifraude */}
        <GlowCard glowColor="violet" className="p-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Alertas Antifraude
            </span>
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-rose-400 tracking-tight">
              {fraudLogs.length}
            </span>
            <span className="text-xs text-zinc-400 font-medium">bloqueados</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-zinc-400">
            <span className="truncate">Excesos de cupo y HWID falso</span>
            <button
              onClick={() => onNavigateTab("telemetry")}
              className="text-violet-400 hover:text-violet-300 font-medium flex items-center gap-0.5 shrink-0"
            >
              Ver <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
        </GlowCard>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart: Telemetry & Activity */}
        <div className="lg:col-span-2 glass-panel rounded-2xl p-6 border border-white/10 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-violet-400" />
                Telemetría y Peticiones Criptográficas
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Volumen de heartbeats, verificaciones y nuevas activaciones de máquinas.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-zinc-300">
                <span className="w-2.5 h-2.5 rounded-sm bg-violet-500" /> Heartbeats
              </span>
              <span className="flex items-center gap-1.5 text-zinc-300">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400" /> Activaciones
              </span>
            </div>
          </div>

          <div className="h-64 w-full">
            {mounted ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorHeartbeat" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="colorActivations" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="day" stroke="#71717a" fontSize={12} tickLine={false} />
                  <YAxis stroke="#71717a" fontSize={12} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(15, 15, 23, 0.95)",
                      borderColor: "rgba(255, 255, 255, 0.15)",
                      borderRadius: "12px",
                      color: "#fff",
                      fontSize: "12px",
                      backdropFilter: "blur(8px)",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="heartbeats"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorHeartbeat)"
                    name="Heartbeats"
                  />
                  <Area
                    type="monotone"
                    dataKey="activaciones"
                    stroke="#10b981"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorActivations)"
                    name="Activaciones"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-zinc-500">
                Cargando métricas...
              </div>
            )}
          </div>
        </div>

        {/* Side Chart: Cupos por Aplicación */}
        <div className="glass-panel rounded-2xl p-6 border border-white/10 flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              Cupos por Aplicación
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Dispositivos en uso vs. cupos autorizados
            </p>
          </div>

          <div className="h-64 w-full mt-4">
            {mounted ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={appsSeatDistribution} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" stroke="#71717a" fontSize={11} tickLine={false} />
                  <YAxis stroke="#71717a" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(15, 15, 23, 0.95)",
                      borderColor: "rgba(255, 255, 255, 0.15)",
                      borderRadius: "12px",
                      color: "#fff",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="usados" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Equipos Activos" />
                  <Bar dataKey="disponibles" fill="rgba(255,255,255,0.15)" radius={[4, 4, 0, 0]} name="Cupos Libres" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-zinc-500">
                Cargando datos...
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Section: Quick Access & Live Audit Snippet */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Launch Actions */}
        <div className="glass-panel rounded-2xl p-6 border border-white/10 space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider text-zinc-300">
            Módulos del Sistema
          </h3>
          <div className="space-y-3">
            <button
              onClick={() => onNavigateTab("clients")}
              className="w-full flex items-center justify-between p-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all text-left group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 group-hover:scale-105 transition-transform">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">Directorio de Clientes</div>
                  <div className="text-xs text-zinc-400">Ver contratos, facturación y recaudos</div>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors" />
            </button>

            <button
              onClick={() => onNavigateTab("licenses")}
              className="w-full flex items-center justify-between p-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all text-left group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-violet-500/10 text-violet-400 group-hover:scale-105 transition-transform">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">Gestor de Licencias</div>
                  <div className="text-xs text-zinc-400">Ver planes, extender y suspender claves</div>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors" />
            </button>

            <button
              onClick={() => onNavigateTab("devices")}
              className="w-full flex items-center justify-between p-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all text-left group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:scale-105 transition-transform">
                  <Cpu className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">Equipos y Cupos (HWID)</div>
                  <div className="text-xs text-zinc-400">Monitorear y desvincular máquinas</div>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors" />
            </button>

            <button
              onClick={() => onNavigateTab("simulator")}
              className="w-full flex items-center justify-between p-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all text-left group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 group-hover:scale-105 transition-transform">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">Simulador en Vivo</div>
                  <div className="text-xs text-zinc-400">Probar activación, verificación y heartbeat</div>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors" />
            </button>
          </div>
        </div>

        {/* Live Audit Log Feed Preview */}
        <div className="lg:col-span-2 glass-panel rounded-2xl p-6 border border-white/10 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-zinc-400" />
                Actividad y Auditoría Reciente
              </h3>
              <p className="text-xs text-zinc-400">
                Últimos eventos capturados por los agentes de seguridad.
              </p>
            </div>
            <button
              onClick={() => onNavigateTab("telemetry")}
              className="text-xs font-semibold text-violet-400 hover:text-violet-300 flex items-center gap-1"
            >
              Ver Registro Completo <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5 overflow-hidden">
            {logs.slice(0, 4).map((log) => {
              const isBlocked = log.event_type === "activate_fraud_blocked";
              const isSuccess = log.success;

              return (
                <div
                  key={log.id}
                  className={`flex items-start justify-between p-3 rounded-xl border text-xs transition-all ${
                    isBlocked
                      ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
                      : isSuccess
                      ? "bg-white/5 border-white/10 text-zinc-300"
                      : "bg-amber-500/10 border-amber-500/30 text-amber-300"
                  }`}
                >
                  <div className="flex items-start gap-2.5 overflow-hidden">
                    <div className="mt-0.5">
                      {isBlocked ? (
                        <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                      ) : isSuccess ? (
                        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      )}
                    </div>
                    <div className="overflow-hidden">
                      <div className="font-semibold text-white flex items-center gap-2 truncate">
                        <span>{log.event_type}</span>
                        {log.license_key && (
                          <span className="text-[11px] font-mono px-1.5 py-0.2 rounded bg-black/40 text-zinc-400">
                            {log.license_key}
                          </span>
                        )}
                      </div>
                      <div className="text-zinc-400 truncate mt-0.5">{log.message}</div>
                    </div>
                  </div>
                  <span suppressHydrationWarning className="text-[10px] text-zinc-500 whitespace-nowrap ml-3">
                    {mounted
                      ? new Date(log.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "--:--"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
