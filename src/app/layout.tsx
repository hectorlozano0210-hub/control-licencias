import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "CoreAuth & License Hub | Plataforma Empresarial de Licenciamiento",
  description:
    "Gestión de licencias de software, control estricto de cupos por hardware (HWID), telemetría en tiempo real y protección antifraude.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`dark ${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-screen bg-[#09090b] text-zinc-100 antialiased font-sans selection:bg-violet-600/30 selection:text-violet-200">
        {children}
        <Toaster
          theme="dark"
          position="top-right"
          richColors
          closeButton
          toastOptions={{
            style: {
              background: "rgba(18, 18, 26, 0.95)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              backdropFilter: "blur(16px)",
              color: "#fff",
              fontFamily: "var(--font-geist-sans), sans-serif",
            },
          }}
        />
      </body>
    </html>
  );
}
