"use client";

import React, { useEffect, useRef, useState } from "react";
import { TONE_COLORS } from "@/lib/audio-engine";
import { ToneNumber } from "@/types/phonetics";

interface PitchContourCanvasProps {
  primaryContour: number[]; // 30 points in Chao [1.0 .. 5.0]
  primaryLabel?: string;
  primaryTone?: ToneNumber;
  secondaryContour?: number[];
  secondaryLabel?: string;
  secondaryTone?: ToneNumber;
  secondaryDashed?: boolean;
  userContour?: number[];
  userLabel?: string;
  syllableCount?: number;
  height?: number;
  className?: string;
}

const CHAO_LEVELS = [
  { level: 5, label: "5 ˥ (Alto)" },
  { level: 4, label: "4 ˦ (Médio-Alto)" },
  { level: 3, label: "3 ˧ (Médio)" },
  { level: 2, label: "2 ˨ (Médio-Baixo)" },
  { level: 1, label: "1 ˩ (Baixo)" },
];

export default function PitchContourCanvas({
  primaryContour,
  primaryLabel = "Nativo (Alvo)",
  primaryTone = 1,
  secondaryContour,
  secondaryLabel,
  secondaryTone = 4,
  secondaryDashed = false,
  userContour,
  userLabel = "Sua Voz (Mic F0)",
  syllableCount = 1,
  height = 200,
  className = "",
}: PitchContourCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDarkTheme, setIsDarkTheme] = useState<boolean>(false);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const syncTheme = () => {
      setIsDarkTheme(document.documentElement.classList.contains("dark"));
    };
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const isDark = isDarkTheme;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width || 520;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const padLeft = 92;
    const padRight = 24;
    const padTop = 22;
    const padBottom = 26;
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    // Background — Papel Xuan ou Pedra de Tinta (Zero Neon)
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = isDark ? "#22201D" : "#F5F2E9";
    ctx.beginPath();
    ctx.roundRect(0, 0, width, height, 10);
    ctx.fill();

    const chaoToY = (val: number) => {
      const clamped = Math.min(5.1, Math.max(0.9, val));
      return padTop + ((5.0 - clamped) / 4.0) * plotH;
    };

    ctx.font = "600 11px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    CHAO_LEVELS.forEach(({ level, label }) => {
      const y = chaoToY(level);
      ctx.strokeStyle = isDark
        ? level === 3
          ? "rgba(220, 214, 200, 0.25)"
          : "rgba(220, 214, 200, 0.12)"
        : level === 3
        ? "rgba(92, 88, 82, 0.35)"
        : "rgba(92, 88, 82, 0.18)";
      ctx.lineWidth = level === 3 ? 1.2 : 1;
      ctx.setLineDash(level === 3 ? [] : [4, 4]);
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(width - padRight, y);
      ctx.stroke();

      ctx.fillStyle = isDark ? "#8C857B" : "#5C5852";
      ctx.fillText(label, padLeft - 10, y);
    });
    ctx.setLineDash([]);

    if (syllableCount > 1) {
      for (let s = 1; s < syllableCount; s++) {
        const x = padLeft + (s / syllableCount) * plotW;
        ctx.strokeStyle = isDark
          ? "rgba(156, 122, 60, 0.35)"
          : "rgba(156, 122, 60, 0.45)";
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 5]);
        ctx.beginPath();
        ctx.moveTo(x, padTop);
        ctx.lineTo(x, height - padBottom);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = isDark ? "#8C857B" : "#5C5852";
        ctx.font = "500 10px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`Sílaba ${s}`, x - plotW / (syllableCount * 2), height - 10);
      }
      ctx.fillText(
        `Sílaba ${syllableCount}`,
        padLeft + plotW - plotW / (syllableCount * 2),
        height - 10
      );
    }

    const drawBrushContour = (
      points: number[],
      color: string,
      lineWidth: number,
      dashed: boolean = false
    ) => {
      if (!points || points.length < 2) return;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      if (dashed) {
        ctx.setLineDash([6, 5]);
      }

      const coords = points.map((v, idx) => ({
        x: padLeft + (idx / (points.length - 1)) * plotW,
        y: chaoToY(v),
      }));

      ctx.beginPath();
      ctx.moveTo(coords[0].x, coords[0].y);
      for (let i = 0; i < coords.length - 1; i++) {
        const xc = (coords[i].x + coords[i + 1].x) / 2;
        const yc = (coords[i].y + coords[i + 1].y) / 2;
        ctx.quadraticCurveTo(coords[i].x, coords[i].y, xc, yc);
      }
      const last = coords[coords.length - 1];
      ctx.lineTo(last.x, last.y);
      ctx.stroke();

      ctx.setLineDash([]);
      [coords[0], last].forEach((pt) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 3.8, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.restore();
    };

    if (secondaryContour && secondaryContour.length > 1) {
      drawBrushContour(
        secondaryContour,
        TONE_COLORS[secondaryTone] || "#9E2A2B",
        2.5,
        secondaryDashed
      );
    }

    if (primaryContour && primaryContour.length > 1) {
      drawBrushContour(
        primaryContour,
        TONE_COLORS[primaryTone] || "#3B596A",
        3.4,
        false
      );
    }

    if (userContour && userContour.length > 1) {
      drawBrushContour(userContour, "#9E2A2B", 3.0, false);
    }
  }, [
    primaryContour,
    primaryTone,
    secondaryContour,
    secondaryTone,
    secondaryDashed,
    userContour,
    syllableCount,
    height,
    isDarkTheme,
  ]);

  return (
    <div className={`w-full select-none ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5 px-1 text-xs">
        <span className="text-xuan-muted font-serif font-semibold tracking-wide">
          Traço Tonal F0 · Escala de Yuen Ren Chao (1–5)
        </span>
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-xuan-ink font-medium">
            <span
              className="w-2.5 h-2.5 rounded-full inline-block"
              style={{ backgroundColor: TONE_COLORS[primaryTone] || "#3B596A" }}
            />
            {primaryLabel}
          </span>
          {secondaryContour && secondaryContour.length > 1 && (
            <span className="inline-flex items-center gap-1.5 text-xuan-muted font-medium">
              <span
                className="w-2.5 h-2.5 rounded-full inline-block"
                style={{
                  backgroundColor: TONE_COLORS[secondaryTone] || "#9E2A2B",
                }}
              />
              {secondaryLabel || "Comparação B"}
            </span>
          )}
          {userContour && userContour.length > 1 && (
            <span className="inline-flex items-center gap-1.5 text-[#9E2A2B] font-semibold">
              <span className="w-2.5 h-2.5 rounded-full inline-block bg-[#9E2A2B]" />
              {userLabel}
            </span>
          )}
        </div>
      </div>
      <canvas
        ref={canvasRef}
        style={{ height: `${height}px` }}
        className="w-full rounded-xl border border-xuan-border"
      />
    </div>
  );
}
