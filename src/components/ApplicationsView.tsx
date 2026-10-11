"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Layers,
  Plus,
  Search,
  Code2,
  KeyRound,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  ExternalLink,
  Tag,
  Hash,
  AlertTriangle,
  X,
  FileCode,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Application, License } from "@/lib/types";
import { BorderBeam } from "./ui/BorderBeam";

interface ApplicationsViewProps {
  apps: Application[];
  licenses: License[];
  onRefresh: () => Promise<void>;
  onOpenCreateLicenseForApp: (appId: string) => void;
}

export function ApplicationsView({
  apps,
  licenses,
  onRefresh,
  onOpenCreateLicenseForApp,
}: ApplicationsViewProps) {
  const [search, setSearch] = useState("");
  const [isOpenCreateModal, setIsOpenCreateModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [prefix, setPrefix] = useState("");
  const [version, setVersion] = useState("1.0.0");
  const [description, setDescription] = useState("");

  // Autogenerar slug y prefijo al escribir el nombre
  const handleNameChange = (val: string) => {
    setName(val);
    const generatedSlug = val
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
    setSlug(generatedSlug);

    const words = val.trim().split(/\s+/);
    let autoPrefix = "APP";
    if (words.length >= 2) {
      autoPrefix = (words[0].substring(0, 3) + "-" + words[1].substring(0, 3)).toUpperCase();
    } else if (words.length === 1 && words[0].length >= 3) {
      autoPrefix = words[0].substring(0, 4).toUpperCase();
    }
    setPrefix(autoPrefix);
  };

  const handleCreateApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) {
      toast.error("El nombre y el slug de la aplicación son obligatorios.");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch("/api/v1/apps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim().toLowerCase(),
          license_prefix: prefix.trim().toUpperCase() || "PROD",
          current_version: version.trim() || "1.0.0",
          description: description.trim() || undefined,
          is_active: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "No se pudo registrar la aplicación.");
      }

      toast.success("¡Aplicación registrada exitosamente!", {
        description: `${data.app.name} (${data.app.slug}) ya está disponible para generar licencias.`,
      });

      setName("");
      setSlug("");
      setPrefix("");
      setVersion("1.0.0");
      setDescription("");
      setIsOpenCreateModal(false);
      await onRefresh();
    } catch (err: any) {
      toast.error("Error al registrar aplicación", {
        description: err.message,
        duration: 8000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredApps = apps.filter((a) => {
    const q = search.toLowerCase();
    return (
      a.name.toLowerCase().includes(q) ||
      a.slug.toLowerCase().includes(q) ||
      (a.license_prefix && a.license_prefix.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Title & Top Action Bar */}
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
              <span className="bg-gradient-to-r from-white via-gold-300 to-indigo-400 bg-clip-text text-transparent">
                Catálogo de Software & Aplicaciones
              </span>
            </h1>
            <p className="text-sm text-zinc-400 mt-1">
              Gestión de tus programas autorizados, prefijos de claves y compatibilidad de versiones.
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsOpenCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-violet-600 to-emerald-500 hover:from-indigo-500 hover:to-emerald-400 text-white font-semibold text-xs shadow-lg shadow-indigo-600/30 transition-all active:scale-95 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Registrar Nueva Aplicación</span>
        </button>
      </div>

      {/* Search Toolbar */}
      <div className="p-4 rounded-2xl glass-panel border border-white/10 flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar aplicación por nombre, slug o prefijo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500/50"
          />
        </div>

        <div className="text-xs text-zinc-400 font-medium">
          Total: <span className="text-white font-bold">{filteredApps.length}</span> apps
        </div>
      </div>

      {/* Applications Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredApps.length === 0 ? (
          <div className="col-span-full py-16 text-center text-zinc-500 rounded-2xl glass-panel border border-white/10">
            No se encontraron aplicaciones coincidentes.
          </div>
        ) : (
          filteredApps.map((app) => {
            const appLicenses = licenses.filter(
              (l) => l.app_id === app.id || l.app_slug === app.slug || l.license_key?.startsWith(app.license_prefix || "")
            );
            const activeLicensesCount = appLicenses.filter((l) => l.status === "active").length;
            const prefixDisplay = app.license_prefix || (app.slug === "joyeria-erp" ? "MFP-JOY" : "PROD");

            return (
              <motion.div
                key={app.id || app.slug}
                whileHover={{ y: -3 }}
                transition={{ duration: 0.2 }}
                className="relative rounded-2xl glass-panel border border-white/10 p-5 shadow-xl flex flex-col justify-between group overflow-hidden"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                        <Code2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-sm group-hover:text-indigo-300 transition-colors">
                          {app.name}
                        </h3>
                        <span className="text-[11px] font-mono text-zinc-400">
                          {app.slug}
                        </span>
                      </div>
                    </div>

                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0">
                      v{app.current_version || "1.0.0"}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-zinc-400 line-clamp-2 mb-4 leading-relaxed">
                    {app.description || "Software empresarial registrado en el ecosistema CoreAuth Hub."}
                  </p>

                  {/* Badges / Metrics */}
                  <div className="grid grid-cols-2 gap-2 text-xs mb-4">
                    <div className="p-2.5 rounded-xl bg-white/5 border border-white/5">
                      <span className="text-[11px] text-zinc-500 block mb-0.5 flex items-center gap-1">
                        <Hash className="w-3 h-3 text-indigo-400" />
                        Prefijo Clave:
                      </span>
                      <span className="font-mono font-bold text-white text-xs select-all">
                        {prefixDisplay}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-white/5 border border-white/5">
                      <span className="text-[11px] text-zinc-500 block mb-0.5 flex items-center gap-1">
                        <KeyRound className="w-3 h-3 text-emerald-400" />
                        Licencias:
                      </span>
                      <span className="font-bold text-emerald-400 text-xs">
                        {activeLicensesCount} activas
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer Action */}
                <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                  <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                    Protegido por CoreAuth
                  </span>

                  <button
                    onClick={() => onOpenCreateLicenseForApp(app.id || app.slug)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold transition-all active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Emitir Licencia</span>
                  </button>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Modal: Registrar Nueva Aplicación */}
      <AnimatePresence>
        {isOpenCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg p-6 rounded-3xl bg-[#090d12]/95 border border-gold-500/30 shadow-2xl relative overflow-hidden backdrop-blur-2xl"
            >
              <BorderBeam size={220} duration={12} delay={0} colorFrom="#caa455" colorTo="#6366f1" />

              <div className="flex flex-col items-center text-center pb-4 border-b border-white/10 relative">
                <button
                  onClick={() => setIsOpenCreateModal(false)}
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
                  <span>Catálogo de Software</span>
                  <span>•</span>
                  <span>Nueva App</span>
                </div>

                <h2 className="text-xl font-bold tracking-tight text-white">
                  <span className="bg-gradient-to-r from-gold-300 via-gold-400 to-indigo-400 bg-clip-text text-transparent">
                    Registrar Nueva Aplicación
                  </span>
                </h2>
                <p className="text-xs text-zinc-400 max-w-sm mt-0.5">
                  Se guardará en Supabase y quedará disponible para generar claves de licencia
                </p>
              </div>

              <form onSubmit={handleCreateApp} className="mt-5 space-y-4 text-xs">
                {/* Nombre de la aplicación */}
                <div>
                  <label className="block text-zinc-300 font-semibold mb-1">
                    Nombre del Software / Aplicación *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. FixPC Citas Médicas Pro"
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50"
                  />
                </div>

                {/* Slug y Prefijo */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-zinc-300 font-semibold mb-1">
                      Identificador Slug (API) *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="citas-medicas"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9\-_]/g, ""))}
                      className="w-full font-mono px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50 text-[11px]"
                    />
                  </div>

                  <div>
                    <label className="block text-zinc-300 font-semibold mb-1">
                      Prefijo de Clave (Ej. CIT-MED) *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="CIT-MED"
                      maxLength={16}
                      value={prefix}
                      onChange={(e) => setPrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9\-]/g, ""))}
                      className="w-full font-mono uppercase px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50 text-[11px]"
                    />
                  </div>
                </div>

                {/* Versión */}
                <div>
                  <label className="block text-zinc-300 font-semibold mb-1">
                    Versión Actual de Lanzamiento
                  </label>
                  <input
                    type="text"
                    placeholder="1.0.0"
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                    className="w-full font-mono px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50"
                  />
                </div>

                {/* Descripción */}
                <div>
                  <label className="block text-zinc-300 font-semibold mb-1">
                    Descripción del Software
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Gestión de agenda médica, historiales clínicos y recordatorios por WhatsApp..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50 resize-none"
                  />
                </div>

                {/* Vista previa de clave */}
                <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[11px]">
                  <span className="font-semibold block mb-0.5">Vista previa de licencia generada:</span>
                  <span className="font-mono font-bold text-white">
                    {(prefix || "APP").toUpperCase()}-PRO-XXXX-XXXX-XXXX-XXXX
                  </span>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setIsOpenCreateModal(false)}
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
                      <Sparkles className="w-4 h-4 text-[#080f15]" />
                    )}
                    <span>Guardar Aplicación</span>
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
