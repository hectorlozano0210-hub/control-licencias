import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "#09090b",
        surface: {
          DEFAULT: "rgba(18, 18, 24, 0.7)",
          card: "rgba(22, 22, 30, 0.65)",
          border: "rgba(255, 255, 255, 0.08)",
          hover: "rgba(255, 255, 255, 0.04)",
        },
        brand: {
          emerald: "#10b981",
          emeraldGlow: "#059669",
          violet: "#8b5cf6",
          violetGlow: "#7c3aed",
          cyan: "#06b6d4",
          amber: "#f59e0b",
          rose: "#f43f5e",
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "fintech-glow": "radial-gradient(circle at 50% 0%, rgba(139, 92, 246, 0.15) 0%, rgba(16, 185, 129, 0.05) 50%, transparent 80%)",
      },
      boxShadow: {
        "glass": "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
        "glow-emerald": "0 0 25px -5px rgba(16, 185, 129, 0.3)",
        "glow-violet": "0 0 25px -5px rgba(139, 92, 246, 0.3)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "border-beam": "border-beam calc(var(--duration)*1s) infinite linear",
        "shimmer": "shimmer 2.5s linear infinite",
        "spotlight": "spotlight 2s ease .75s 1 forwards",
      },
      keyframes: {
        "border-beam": {
          "100%": {
            "offset-distance": "100%",
          },
        },
        shimmer: {
          from: {
            backgroundPosition: "0 0",
          },
          to: {
            backgroundPosition: "-200% 0",
          },
        },
        spotlight: {
          "0%": {
            opacity: "0",
            transform: "translate(-72%, -62%) scale(0.5)",
          },
          "100%": {
            opacity: "1",
            transform: "translate(-50%,-40%) scale(1)",
          },
        },
      },
    },
  },
  plugins: [],
};
export default config;
