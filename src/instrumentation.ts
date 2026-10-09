/**
 * Hook de ciclo de vida del servidor Next.js
 * Se ejecuta una sola vez al inicializar el runtime del servidor Node.js
 * Permite registrar la captura de señales del SO para Graceful Shutdown.
 */
export async function register() {
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return;
  }

  if (process.env.NEXT_RUNTIME === "nodejs") {
    let isShuttingDown = false;

    const handleShutdown = (signal: string) => {
      if (isShuttingDown) return;
      isShuttingDown = true;

      console.log(`\n[GRACEFUL-SHUTDOWN] Señal ${signal} detectada.`);
      console.log("[GRACEFUL-SHUTDOWN] Drenando conexiones activas y cerrando recursos...");

      // Permitir que las conexiones HTTP en vuelo terminen limpiamente
      const shutdownTimeout = setTimeout(() => {
        console.log("[GRACEFUL-SHUTDOWN] Cierre completado exitosamente. Saliendo.");
        process.exit(0);
      }, 1500);

      shutdownTimeout.unref();
    };

    process.on("SIGTERM", () => handleShutdown("SIGTERM"));
    process.on("SIGINT", () => handleShutdown("SIGINT"));
  }
}
