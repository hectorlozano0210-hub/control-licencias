"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sidebar, NavTab } from "@/components/Sidebar";
import { DashboardView } from "@/components/DashboardView";
import { ClientsView } from "@/components/ClientsView";
import { ClientDetailDrawer } from "@/components/ClientDetailDrawer";
import { ManualPaymentModal } from "@/components/ManualPaymentModal";
import { LicenseManagerView } from "@/components/LicenseManagerView";
import { ApplicationsView } from "@/components/ApplicationsView";
import { DeviceManagerView } from "@/components/DeviceManagerView";
import { TelemetryView } from "@/components/TelemetryView";
import { SimulatorView } from "@/components/SimulatorView";
import { SdkDocsView } from "@/components/SdkDocsView";
import { MasterLoginView } from "@/components/MasterLoginView";
import { Spotlight } from "@/components/ui/Spotlight";
import { formatFingerprintPreview } from "@/lib/security/client-fingerprint";
import { Laptop, LogOut, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  License,
  ActivatedDevice,
  LicenseLog,
  Company,
  CompanyWithStats,
  Application,
} from "@/lib/types";
import {
  initialLicenses,
  initialDevices,
  initialLogs,
  initialCompanies,
  initialApps,
  store,
} from "@/lib/store";

export default function Home() {
  const [currentTab, setCurrentTab] = useState<NavTab>("dashboard");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpenCreateModal, setIsOpenCreateModal] = useState(false);

  // Core application data state
  const [licenses, setLicenses] = useState<License[]>(initialLicenses);
  const [devices, setDevices] = useState<ActivatedDevice[]>(initialDevices);
  const [logs, setLogs] = useState<LicenseLog[]>(initialLogs);
  const [companies, setCompanies] = useState<Company[]>(initialCompanies);
  const [clients, setClients] = useState<CompanyWithStats[]>(
    store.getCompaniesWithStats()
  );
  const [apps, setApps] = useState<Application[]>(initialApps);

  // Manual payment modal state
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentCompanyId, setPaymentCompanyId] = useState<string | undefined>(undefined);
  const [paymentLicenseId, setPaymentLicenseId] = useState<string | undefined>(undefined);

  // Super Admin Master Session State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [activeFingerprint, setActiveFingerprint] = useState<string>("");

  // Verificar sesión maestra al montar la aplicación
  useEffect(() => {
    async function checkMasterSession() {
      try {
        const res = await fetch("/api/v1/auth/master-session");
        const data = await res.json();
        if (data.authenticated) {
          setIsAuthenticated(true);
          setActiveFingerprint(data.device_fingerprint || "");
        } else {
          setIsAuthenticated(false);
        }
      } catch {
        setIsAuthenticated(false);
      }
    }
    checkMasterSession();
  }, []);

  const handleMasterLogout = async () => {
    try {
      await fetch("/api/v1/auth/master-logout", { method: "POST" });
      setIsAuthenticated(false);
      toast.info("Sesión Maestra cerrada exitosamente.");
    } catch {
      setIsAuthenticated(false);
    }
  };

  // Client detail drawer state
  const [selectedClientForDetail, setSelectedClientForDetail] = useState<CompanyWithStats | null>(null);
  const [isClientDetailOpen, setIsClientDetailOpen] = useState(false);

  // Preselected company and app for new license
  const [licensePreselectedCompany, setLicensePreselectedCompany] = useState<string | undefined>(undefined);
  const [licensePreselectedApp, setLicensePreselectedApp] = useState<string | undefined>(undefined);

  // Fetch / Sync with API
  const refreshData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [licRes, statsRes, clientsRes, appsRes] = await Promise.all([
        fetch("/api/v1/licenses"),
        fetch("/api/v1/stats"),
        fetch("/api/v1/clients"),
        fetch("/api/v1/apps"),
      ]);

      if (licRes.ok) {
        const licData = await licRes.json();
        if (licData.licenses) setLicenses(licData.licenses);
        if (licData.companies) setCompanies(licData.companies);
        if (licData.apps) setApps(licData.apps);
        if (licData.devices) setDevices(licData.devices);
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        if (statsData.recent_logs) setLogs(statsData.recent_logs);
      }

      if (clientsRes.ok) {
        const clientsData = await clientsRes.json();
        if (clientsData.clients) {
          setClients(clientsData.clients);
          // If detailed client is open, keep it updated
          if (selectedClientForDetail) {
            const updated = clientsData.clients.find(
              (c: CompanyWithStats) => c.id === selectedClientForDetail.id
            );
            if (updated) setSelectedClientForDetail(updated);
          }
        }
      }

      if (appsRes.ok) {
        const appsData = await appsRes.json();
        if (appsData.apps) {
          setApps(appsData.apps);
        }
      }
    } catch (err) {
      console.error("Error refreshing data:", err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedClientForDetail]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Actions
  const handleExtendLicense = async (id: string, days: number) => {
    try {
      const res = await fetch("/api/v1/licenses", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "extend", days }),
      });
      if (res.ok) {
        await refreshData();
      } else {
        const err = await res.json();
        alert("Error al extender la vigencia: " + err.error);
      }
    } catch (e: any) {
      alert("Error: " + e.message);
    }
  };

  const handleUpdateStatus = async (id: string, status: License["status"]) => {
    try {
      const res = await fetch("/api/v1/licenses", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (res.ok) {
        await refreshData();
      } else {
        const err = await res.json();
        alert("Error al actualizar estado: " + err.error);
      }
    } catch (e: any) {
      alert("Error: " + e.message);
    }
  };

  const handleCreateLicense = async (data: {
    company_id: string;
    app_id: string;
    plan_tier: "Standard" | "Professional" | "Enterprise";
    max_seats: number;
    duration_days: number;
    notes?: string;
    customer_email?: string;
  }) => {
    const res = await fetch("/api/v1/licenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (res.ok && json.success) {
      await refreshData();
      return json;
    } else {
      const errMsg = json.error || json.message || "No se pudo registrar la licencia en Supabase";
      throw new Error(errMsg);
    }
  };

  const handleRevokeDevice = async (deviceId: string) => {
    const res = await fetch("/api/v1/devices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "revoke", device_id: deviceId }),
    });
    if (res.ok) {
      await refreshData();
    } else {
      const json = await res.json();
      throw new Error(json.error || "No se pudo desvincular el dispositivo");
    }
  };

  const handleOpenManualPayment = (companyId?: string, licenseId?: string) => {
    setPaymentCompanyId(companyId);
    setPaymentLicenseId(licenseId);
    setIsPaymentModalOpen(true);
  };

  const handleSelectClientForDetail = (client: CompanyWithStats) => {
    setSelectedClientForDetail(client);
    setIsClientDetailOpen(true);
  };

  const handleOpenCreateLicenseForClient = (companyId: string) => {
    setLicensePreselectedCompany(companyId);
    setIsOpenCreateModal(true);
    setIsClientDetailOpen(false);
  };

  const tenMinAgo = Date.now() - 10 * 60 * 1000;
  const liveDevicesCount = devices.filter(
    (d) => d.is_active && new Date(d.last_heartbeat_at).getTime() > tenMinAgo
  ).length;

  const fraudAlertCount = logs.filter(
    (l) => l.event_type === "activate_fraud_blocked"
  ).length;

  // Estado 1: Verificando sesión maestra
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-[#09090b] text-white flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 animate-pulse">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-violet-600 to-emerald-400 flex items-center justify-center shadow-lg shadow-violet-500/25">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <span className="text-xs text-zinc-400 font-medium">
            Verificando autorización de terminal maestra...
          </span>
        </div>
      </div>
    );
  }

  // Estado 2: No autenticado -> Pantalla de Login Super Admin con Device Binding
  if (isAuthenticated === false) {
    return (
      <MasterLoginView
        onSuccess={(fp) => {
          setIsAuthenticated(true);
          setActiveFingerprint(fp);
          refreshData();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex relative overflow-x-hidden">
      {/* Subtle Background Grid Mesh with Radial Mask */}
      <div className="fixed inset-0 pointer-events-none bg-grid-pattern mask-radial z-0 opacity-60" />

      {/* Directional Spotlights (Aceternity UI effect) */}
      <Spotlight className="-top-40 left-0 md:left-64 md:-top-20" fill="#8b5cf6" />
      <Spotlight className="top-1/3 right-0" fill="#10b981" />

      {/* Background radial ambient lights */}
      <div className="fixed top-0 left-1/4 w-[500px] h-[500px] bg-violet-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="fixed bottom-10 right-1/4 w-[450px] h-[450px] bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onTabChange={(tab) => setCurrentTab(tab)}
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
        fraudAlertCount={fraudAlertCount}
        liveDevicesCount={liveDevicesCount}
        clientsCount={clients.length}
        appsCount={apps.length}
      />

      {/* Main Content Area */}
      <main
        className={`flex-1 min-h-screen transition-all duration-300 px-4 md:px-8 py-8 relative z-10 ${
          isCollapsed ? "md:pl-28" : "md:pl-[304px]"
        }`}
      >
        <div className="max-w-7xl mx-auto">
          {/* Top Bar: Estación Maestra & Cerrar Sesión Maestra */}
          <div className="mb-6 pb-4 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium shadow-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <Laptop className="w-3.5 h-3.5 text-emerald-400" />
                <span>
                  Estación Maestra:{" "}
                  <span className="font-mono font-semibold text-white">
                    {formatFingerprintPreview(activeFingerprint)}
                  </span>
                </span>
              </div>
              <span className="text-[11px] text-zinc-500 hidden sm:inline">
                • Hardware Vinculado
              </span>
            </div>

            <button
              onClick={handleMasterLogout}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-semibold shadow-lg shadow-rose-950/30 transition-all active:scale-95 shrink-0"
              title="Cerrar Sesión Maestra"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-400" />
              <span>Cerrar Sesión Maestra</span>
            </button>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={currentTab}
              initial={{ opacity: 0, y: 14, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
              transition={{ type: "spring", stiffness: 350, damping: 28 }}
            >
              {currentTab === "dashboard" && (
                <DashboardView
                  licenses={licenses}
                  devices={devices}
                  logs={logs}
                  apps={apps}
                  onNavigateTab={(tab) => setCurrentTab(tab)}
                  onOpenCreateLicense={() => setIsOpenCreateModal(true)}
                  onRefreshData={refreshData}
                  isLoading={isLoading}
                />
              )}

              {currentTab === "apps" && (
                <ApplicationsView
                  apps={apps}
                  licenses={licenses}
                  onRefresh={refreshData}
                  onOpenCreateLicenseForApp={(appId) => {
                    setLicensePreselectedApp(appId);
                    setCurrentTab("licenses");
                    setIsOpenCreateModal(true);
                  }}
                />
              )}

              {currentTab === "clients" && (
                <ClientsView
                  clients={clients}
                  onRefresh={refreshData}
                  onSelectClientForDetail={handleSelectClientForDetail}
                  onOpenManualPayment={handleOpenManualPayment}
                  onOpenCreateLicense={(companyId) => {
                    setLicensePreselectedCompany(companyId);
                    setIsOpenCreateModal(true);
                  }}
                />
              )}

              {currentTab === "licenses" && (
                <LicenseManagerView
                  licenses={licenses}
                  companies={companies}
                  apps={apps}
                  onRefresh={refreshData}
                  isOpenCreateModal={isOpenCreateModal}
                  onSetOpenCreateModal={(open) => {
                    setIsOpenCreateModal(open);
                    if (!open) {
                      setLicensePreselectedApp(undefined);
                    }
                  }}
                  onExtendLicense={handleExtendLicense}
                  onUpdateStatus={handleUpdateStatus}
                  onCreateLicense={handleCreateLicense}
                  onOpenManualPayment={handleOpenManualPayment}
                  preselectedAppId={licensePreselectedApp}
                />
              )}

              {currentTab === "devices" && (
                <DeviceManagerView
                  devices={devices}
                  licenses={licenses}
                  onRevokeDevice={handleRevokeDevice}
                  onRefresh={refreshData}
                />
              )}

              {currentTab === "telemetry" && (
                <TelemetryView
                  logs={logs}
                  onRefresh={refreshData}
                  isLoading={isLoading}
                />
              )}

              {currentTab === "simulator" && (
                <SimulatorView
                  licenses={licenses}
                  apps={apps}
                  onTriggerRefresh={refreshData}
                />
              )}

              {currentTab === "sdk" && <SdkDocsView />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Manual Payment Modal */}
      <ManualPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => {
          setIsPaymentModalOpen(false);
          setPaymentCompanyId(undefined);
          setPaymentLicenseId(undefined);
        }}
        companies={companies}
        licenses={licenses}
        preselectedCompanyId={paymentCompanyId}
        preselectedLicenseId={paymentLicenseId}
        onPaymentSuccess={refreshData}
      />

      {/* Client Detail Drawer */}
      <ClientDetailDrawer
        client={selectedClientForDetail}
        isOpen={isClientDetailOpen}
        onClose={() => {
          setIsClientDetailOpen(false);
          setSelectedClientForDetail(null);
        }}
        onOpenCreateLicenseForClient={handleOpenCreateLicenseForClient}
        onOpenManualPaymentForClient={(comp, lic) => {
          handleOpenManualPayment(comp, lic);
        }}
      />
    </div>
  );
}
