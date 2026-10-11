"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck,
  KeyRound,
  Layers,
  Cpu,
  AlertTriangle,
  Code2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Terminal,
  Activity,
  Users,
} from "lucide-react";

export type NavTab = "dashboard" | "apps" | "clients" | "licenses" | "devices" | "telemetry" | "sdk" | "simulator";

interface SidebarProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  fraudAlertCount?: number;
  liveDevicesCount?: number;
  clientsCount?: number;
  appsCount?: number;
}

export function Sidebar({
  currentTab,
  onTabChange,
  isCollapsed,
  onToggleCollapse,
  fraudAlertCount = 1,
  liveDevicesCount = 3,
  clientsCount,
  appsCount,
}: SidebarProps) {
  const navItems = [
    {
      id: "dashboard" as NavTab,
      label: "Centro de Control",
      icon: Activity,
      badge: null,
    },
    {
      id: "apps" as NavTab,
      label: "Software & Apps",
      icon: Layers,
      badge: appsCount ? `${appsCount}` : null,
      badgeColor: "bg-violet-500/20 text-violet-300 border-violet-500/30",
    },
    {
      id: "clients" as NavTab,
      label: "Directorio de Clientes",
      icon: Users,
      badge: clientsCount ? `${clientsCount}` : null,
      badgeColor: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    },
    {
      id: "licenses" as NavTab,
      label: "Gestión de Licencias",
      icon: KeyRound,
      badge: null,
    },
    {
      id: "devices" as NavTab,
      label: "Equipos y Cupos",
      icon: Cpu,
      badge: `${liveDevicesCount} online`,
      badgeColor: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    },
    {
      id: "telemetry" as NavTab,
      label: "Telemetría y Antifraude",
      icon: AlertTriangle,
      badge: fraudAlertCount > 0 ? `${fraudAlertCount} alerta` : null,
      badgeColor: "bg-rose-500/20 text-rose-400 border-rose-500/30",
    },
    {
      id: "simulator" as NavTab,
      label: "Sandbox de Prueba",
      icon: Terminal,
      badge: "Simulador",
      badgeColor: "bg-violet-500/20 text-violet-400 border-violet-500/30",
    },
    {
      id: "sdk" as NavTab,
      label: "SDK e Integración",
      icon: Code2,
      badge: "v1.2",
      badgeColor: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
    },
  ];

  return (
    <motion.aside
      animate={{ width: isCollapsed ? 82 : 280 }}
      transition={{ type: "spring", stiffness: 350, damping: 30 }}
      className="fixed left-4 top-4 bottom-4 z-40 flex flex-col rounded-3xl glass-panel shadow-2xl backdrop-blur-2xl border border-white/10"
    >
      {/* Brand Header */}
      <div className="flex items-center justify-between p-5 border-b border-white/10">
        <div className="flex items-center space-x-3 overflow-hidden">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-2xl bg-black/50 border border-white/10 shadow-lg shadow-violet-500/20 shrink-0 p-1">
            <img
              src="/logo-masterfixpc-reducido.png"
              alt="Master FixPC"
              className="w-full h-full object-contain"
            />
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400" />
          </div>

          <AnimatePresence>
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
                className="flex flex-col whitespace-nowrap"
              >
                <div className="flex items-center space-x-1.5">
                  <span className="font-bold text-base tracking-tight text-white">CoreAuth</span>
                  <span className="text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded-md bg-violet-500/20 text-violet-300 border border-violet-500/30">
                    HUB
                  </span>
                </div>
                <span className="text-[11px] font-medium text-zinc-400">License Management</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Retract button */}
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded-xl hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
          title={isCollapsed ? "Expandir menú" : "Colapsar menú"}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Nav List */}
      <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`group relative flex items-center w-full p-3 rounded-2xl font-medium text-sm transition-all duration-200 ${
                isActive
                  ? "bg-gradient-to-r from-violet-600/25 to-emerald-500/10 text-white border border-white/15 shadow-lg shadow-violet-950/40"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
              }`}
            >
              {/* Active neon strip */}
              {isActive && (
                <motion.div
                  layoutId="activeTabIndicator"
                  className="absolute left-0 top-2 bottom-2 w-1.5 rounded-r-full bg-gradient-to-b from-violet-400 to-emerald-400 shadow-[0_0_12px_#8b5cf6]"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}

              <Icon
                className={`w-5 h-5 shrink-0 transition-colors ${
                  isActive ? "text-violet-400" : "text-zinc-400 group-hover:text-zinc-200"
                }`}
              />

              <AnimatePresence>
                {!isCollapsed && (
                  <motion.div
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.15 }}
                    className="ml-3 flex items-center justify-between w-full overflow-hidden"
                  >
                    <span className="truncate text-left">{item.label}</span>
                    {item.badge && (
                      <span
                        className={`ml-2 text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${
                          item.badgeColor || "bg-white/10 text-zinc-300 border-white/10"
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
          );
        })}
      </nav>

      {/* Footer System Status */}
      <div className="p-4 border-t border-white/10">
        {!isCollapsed ? (
          <div className="p-3 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/20">
            <div className="flex items-center space-x-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-xs font-semibold text-emerald-400 tracking-wide uppercase">
                Supabase RPC Online
              </span>
            </div>
            <p className="mt-1 text-[11px] text-zinc-400">Firmas ECDSA/Ed25519 activas</p>
          </div>
        ) : (
          <div className="flex justify-center">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
            </span>
          </div>
        )}
      </div>
    </motion.aside>
  );
}
