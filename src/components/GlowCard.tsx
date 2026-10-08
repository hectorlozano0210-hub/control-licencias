"use client";

import React, { useRef, useState } from "react";
import { motion } from "framer-motion";
import { BorderBeam } from "./ui/BorderBeam";

interface GlowCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  glowColor?: "emerald" | "violet" | "cyan" | "rose";
  showBorderBeam?: boolean;
}

export function GlowCard({
  children,
  className = "",
  glowColor = "violet",
  showBorderBeam = false,
  ...props
}: GlowCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: -1000, y: -1000 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const glowColorMap = {
    emerald: "rgba(16, 185, 129, 0.18)",
    violet: "rgba(139, 92, 246, 0.22)",
    cyan: "rgba(6, 182, 212, 0.18)",
    rose: "rgba(244, 63, 94, 0.20)",
  };

  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setMousePos({ x: -1000, y: -1000 });
      }}
      className={`relative overflow-hidden rounded-2xl glass-panel-interactive transition-all duration-300 ${className}`}
      {...(props as any)}
    >
      {/* Dynamic cursor glow effect */}
      <div
        className="pointer-events-none absolute -inset-px transition-opacity duration-300 rounded-2xl"
        style={{
          opacity: isHovered ? 1 : 0,
          background: `radial-gradient(420px circle at ${mousePos.x}px ${mousePos.y}px, ${glowColorMap[glowColor]}, transparent 70%)`,
        }}
      />

      {/* Optional moving border beam */}
      {showBorderBeam && (
        <BorderBeam
          size={180}
          duration={8}
          colorFrom={glowColor === "emerald" ? "#10b981" : glowColor === "cyan" ? "#06b6d4" : "#8b5cf6"}
          colorTo="#38bdf8"
        />
      )}

      {/* Content wrapper */}
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}
