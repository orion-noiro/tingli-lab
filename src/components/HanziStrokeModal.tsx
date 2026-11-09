"use client";

import React, { useEffect, useRef, useState } from "react";
import HanziWriter from "hanzi-writer";
import { Play, Edit3, RotateCcw, Sparkles, X } from "lucide-react";

interface HanziStrokeModalProps {
  hanziSimplified: string;
  hanziTraditional?: string;
  pinyin: string;
  meaningPt: string;
  onClose?: () => void;
  inline?: boolean;
}

export default function HanziStrokeModal({
  hanziSimplified,
  hanziTraditional,
  pinyin,
  meaningPt,
  onClose,
  inline = false,
}: HanziStrokeModalProps) {
  const [scriptMode, setScriptMode] = useState<"simplified" | "traditional">(
    "simplified"
  );
  const activeString =
    scriptMode === "traditional" && hanziTraditional
      ? hanziTraditional
      : hanziSimplified;

  const chars = Array.from(activeString).filter((c) => /[\u4e00-\u9fff]/.test(c));
  const [selectedCharIdx, setSelectedCharIdx] = useState(0);
  const currentChar = chars[selectedCharIdx] || chars[0] || "妈";

  const containerRef = useRef<HTMLDivElement | null>(null);
  const writerRef = useRef<HanziWriter | null>(null);
  const [quizActive, setQuizActive] = useState(false);
  const [quizFeedback, setQuizFeedback] = useState<string>("");

  useEffect(() => {
    if (!containerRef.current || !currentChar) return;
    containerRef.current.innerHTML = "";
    setQuizActive(false);
    setQuizFeedback("");

    const isDark =
      typeof document !== "undefined" &&
      document.documentElement.classList.contains("dark");

    try {
      const writer = HanziWriter.create(containerRef.current, currentChar, {
        width: 220,
        height: 220,
        padding: 16,
        showOutline: true,
        strokeAnimationSpeed: 1.15,
        delayBetweenStrokes: 180,
        strokeColor: isDark ? "#DCD6C8" : "#1E1D1B",
        radicalColor: "#9E2A2B",
        outlineColor: isDark ? "#33302B" : "#D2CBB8",
        drawingColor: "#9C7A3C",
        drawingWidth: 18,
      });
      writerRef.current = writer;
      writer.animateCharacter();
    } catch {
      // Fallback if character data cannot be fetched
    }
  }, [currentChar]);

  const handleAnimate = () => {
    setQuizActive(false);
    setQuizFeedback("Animando ordem canônica dos traços...");
    writerRef.current?.showCharacter();
    writerRef.current?.animateCharacter();
  };

  const handleStartQuiz = () => {
    setQuizActive(true);
    setQuizFeedback("Desenhe os traços na ordem correta usando o mouse ou tela sensível!");
    writerRef.current?.quiz({
      onMistake: () => {
        setQuizFeedback("Quase! Veja a dica na tela e tente o traço novamente.");
      },
      onCorrectStroke: (strokeData) => {
        setQuizFeedback(
          `Traço ${strokeData.strokeNum + 1} perfeito! Restam ${strokeData.strokesRemaining}.`
        );
      },
      onComplete: (summaryData) => {
        setQuizActive(false);
        setQuizFeedback(
          `Parabéns! Caractere ${currentChar} concluído com ${summaryData.totalMistakes} erro(s)!`
        );
      },
    });
  };

  const content = (
    <div className="bg-xuan-card border border-xuan-border rounded-2xl p-5 text-xuan-ink shadow-xl max-w-md w-full mx-auto">
      <div className="flex items-center justify-between border-b border-xuan-border pb-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold font-hanzi text-xuan-ink">
              {activeString}
            </span>
            <span className="text-lg font-pinyin text-[#9E2A2B] font-semibold">
              {pinyin}
            </span>
          </div>
          <p className="text-xs text-xuan-muted mt-0.5">{meaningPt}</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-xuan-bg border border-xuan-border p-0.5 text-xs">
            <button
              type="button"
              onClick={() => {
                setScriptMode("simplified");
                setSelectedCharIdx(0);
              }}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                scriptMode === "simplified"
                  ? "bg-[#9E2A2B] text-[#F5F2E9] font-semibold"
                  : "text-xuan-muted hover:text-xuan-ink"
              }`}
            >
              简体
            </button>
            <button
              type="button"
              onClick={() => {
                setScriptMode("traditional");
                setSelectedCharIdx(0);
              }}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                scriptMode === "traditional"
                  ? "bg-[#9E2A2B] text-[#F5F2E9] font-semibold"
                  : "text-xuan-muted hover:text-xuan-ink"
              }`}
            >
              繁體
            </button>
          </div>
          {onClose && !inline && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-xuan-bg hover:bg-xuan-subtle border border-xuan-border text-xuan-muted"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {chars.length > 1 && (
        <div className="flex items-center justify-center gap-2 mb-3">
          {chars.map((c, idx) => (
            <button
              key={`${c}_${idx}`}
              type="button"
              onClick={() => setSelectedCharIdx(idx)}
              className={`w-10 h-10 rounded-xl font-hanzi text-xl font-bold border transition ${
                idx === selectedCharIdx
                  ? "bg-[#9E2A2B]/15 border-[#9E2A2B] text-[#9E2A2B]"
                  : "bg-xuan-bg border-xuan-border text-xuan-muted hover:text-xuan-ink"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      <div className="relative flex items-center justify-center my-2">
        <div className="relative bg-xuan-bg border-2 border-xuan-border rounded-2xl p-2 shadow-inner">
          {/* Mi Zi Ge (米字格) Traditional Calligraphic Grid Background */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none opacity-30"
            viewBox="0 0 100 100"
          >
            <line x1="50" y1="0" x2="50" y2="100" stroke="#9E2A2B" strokeDasharray="3,3" />
            <line x1="0" y1="50" x2="100" y2="50" stroke="#9E2A2B" strokeDasharray="3,3" />
            <line x1="0" y1="0" x2="100" y2="100" stroke="#9C7A3C" strokeDasharray="2,4" />
            <line x1="100" y1="0" x2="0" y2="100" stroke="#9C7A3C" strokeDasharray="2,4" />
          </svg>
          <div ref={containerRef} className="relative z-10 w-[220px] h-[220px]" />
        </div>
      </div>

      {quizFeedback && (
        <p className="text-center text-xs text-[#9C7A3C] font-medium my-2 min-h-[1.25rem]">
          {quizFeedback}
        </p>
      )}

      <div className="grid grid-cols-3 gap-2 mt-4">
        <button
          type="button"
          onClick={handleAnimate}
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#3B596A]/15 hover:bg-[#3B596A]/25 border border-[#3B596A]/40 text-[#3B596A] text-xs font-semibold transition"
        >
          <Play className="w-3.5 h-3.5" />
          Animar
        </button>
        <button
          type="button"
          onClick={handleStartQuiz}
          className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition ${
            quizActive
              ? "bg-[#9C7A3C] text-[#F5F2E9] border-[#9C7A3C]"
              : "bg-[#3A6B59]/15 hover:bg-[#3A6B59]/25 border-[#3A6B59]/40 text-[#3A6B59]"
          }`}
        >
          <Edit3 className="w-3.5 h-3.5" />
          Praticar Traços
        </button>
        <button
          type="button"
          onClick={() => {
            writerRef.current?.showCharacter();
            setQuizActive(false);
            setQuizFeedback("Caractere reiniciado.");
          }}
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-xuan-bg hover:bg-xuan-subtle border border-xuan-border text-xuan-muted text-xs font-semibold transition"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Resetar
        </button>
      </div>
    </div>
  );

  if (inline) return content;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      {content}
    </div>
  );
}
