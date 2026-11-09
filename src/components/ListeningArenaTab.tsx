"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  HelpCircle,
  RotateCcw,
  Shuffle,
  Volume2,
  XCircle,
} from "lucide-react";
import { SharedModuleProps } from "@/types/ui-props";
import {
  LexicalItem,
  MinimalPairCategory,
  MinimalPairEntry,
  ToneNumber,
  VoiceId,
} from "@/types/phonetics";
import {
  getContrastingVoiceForHVPT,
  playLexicalItemAudio,
  TONE_COLORS,
  VOICE_OPTIONS,
} from "@/lib/audio-engine";

type DrillFormat = "ab_direct" | "abx_hvpt" | "tone_identify";

const FOCUS_CATEGORIES: Array<{
  id: MinimalPairCategory | "all";
  labelPt: string;
  descPt: string;
}> = [
  {
    id: "dissyllable_tone_matrix",
    labelPt: "Dissílabos (20 Combinações & Sandhi)",
    descPt: "Coarticulação tonal em palavras de 2 sílabas (ex.: 水饺 vs 睡觉, 买卖 vs 埋没)",
  },
  {
    id: "monosyllable_tone",
    labelPt: "Tons Monossilábicos (Mǎ or Mà)",
    descPt: "Discriminação de contorno F0 em sílabas isoladas (T1 55, T2 35, T3 214, T4 51)",
  },
  {
    id: "initial_aspiration",
    labelPt: "Aspiração VOT (b/p, d/t, g/k, z/c, zh/ch, j/q)",
    descPt: "Contraste de Voice Onset Time (sopro aspirado vs não-aspirado para lusófonos)",
  },
  {
    id: "initial_place",
    labelPt: "Sibilantes, Retroflexas & Palatais",
    descPt: "Centro de gravidade espectral: Alveolares (z/c/s) vs Retroflexas (zh/ch/sh) vs Palatais (j/q/x)",
  },
  {
    id: "final_nasal",
    labelPt: "Codas Nasais (-n vs -ng)",
    descPt: "Transição de formantes F2/F3 em -an/-ang, -en/-eng, -in/-ing, -ian/-iang, -uan/-uang",
  },
  {
    id: "final_vowel",
    labelPt: "Vogais & Ditongos (ü vs u, -ou vs -uo)",
    descPt: "Arredondamento labial anterior (/y/) vs posterior (/u/) e ditongos",
  },
  {
    id: "all",
    labelPt: "Revisão Adaptativa FSRS (Todos)",
    descPt: "Seleção inteligente priorizando seus pares com maior taxa de confusão",
  },
];

export default function ListeningArenaTab({
  profile,
  onRecordAttempt,
  pairs,
  audioManifest,
  activeVoice,
  setActiveVoice,
  activeSpeed,
  setActiveSpeed,
  navigationOptions,
}: SharedModuleProps) {
  const [selectedCategory, setSelectedCategory] = useState<
    MinimalPairCategory | "all"
  >(navigationOptions?.filterCategory || "dissyllable_tone_matrix");
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>(
    navigationOptions?.filterSubCategory || "all"
  );
  const [drillFormat, setDrillFormat] = useState<DrillFormat>("ab_direct");
  const [hvptEnabled, setHvptEnabled] = useState<boolean>(true);

  const [questionIndex, setQuestionIndex] = useState<number>(0);
  const [targetSide, setTargetSide] = useState<"A" | "B">("A");
  const [userChoice, setUserChoice] = useState<"A" | "B" | null>(null);
  const [selectedToneChoice, setSelectedToneChoice] = useState<ToneNumber | null>(null);
  const [showHint, setShowHint] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  const [sessionStats, setSessionStats] = useState({
    total: 0,
    correct: 0,
    streak: 0,
  });

  const questionStartRef = useRef<number>(Date.now());
  const useTraditional = profile.preferredScript === "traditional";

  useEffect(() => {
    if (navigationOptions?.filterCategory) {
      setSelectedCategory(navigationOptions.filterCategory);
    }
    if (navigationOptions?.filterSubCategory) {
      setSelectedSubCategory(navigationOptions.filterSubCategory);
    }
  }, [navigationOptions]);

  // Filter pairs by category and subcategory
  const filteredPairs = useMemo(() => {
    let list =
      selectedCategory === "all"
        ? pairs
        : pairs.filter((p) => p.category === selectedCategory);
    if (selectedSubCategory !== "all") {
      const subFiltered = list.filter((p) => p.subCategory === selectedSubCategory);
      if (subFiltered.length > 0) list = subFiltered;
    }
    return list.length > 0 ? list : pairs;
  }, [pairs, selectedCategory, selectedSubCategory]);

  const availableSubCategories = useMemo(() => {
    const base =
      selectedCategory === "all"
        ? pairs
        : pairs.filter((p) => p.category === selectedCategory);
    const set = new Set<string>();
    base.forEach((p) => set.add(p.subCategory));
    return Array.from(set);
  }, [pairs, selectedCategory]);

  const currentPair: MinimalPairEntry = useMemo(() => {
    return filteredPairs[questionIndex % filteredPairs.length];
  }, [filteredPairs, questionIndex]);

  const targetItem: LexicalItem =
    targetSide === "A" ? currentPair.itemA : currentPair.itemB;

  const hvptTestVoice: VoiceId = useMemo(
    () => (hvptEnabled ? getContrastingVoiceForHVPT(activeVoice) : activeVoice),
    [hvptEnabled, activeVoice]
  );

  const playCurrentStimulus = useCallback(async () => {
    if (!currentPair) return;
    setIsPlaying(true);
    try {
      if (drillFormat === "abx_hvpt") {
        // Estímulo A (Voz 1) -> pausa -> Estímulo B (Voz 1) -> pausa -> Estímulo X (Voz 2 contrastante!)
        await playLexicalItemAudio(
          currentPair.itemA,
          activeVoice,
          activeSpeed,
          audioManifest
        );
        await new Promise((r) => setTimeout(r, 320));
        await playLexicalItemAudio(
          currentPair.itemB,
          activeVoice,
          activeSpeed,
          audioManifest
        );
        await new Promise((r) => setTimeout(r, 380));
        await playLexicalItemAudio(
          targetItem,
          hvptTestVoice,
          activeSpeed,
          audioManifest
        );
      } else {
        await playLexicalItemAudio(
          targetItem,
          activeVoice,
          activeSpeed,
          audioManifest
        );
      }
    } finally {
      setIsPlaying(false);
    }
  }, [
    currentPair,
    drillFormat,
    activeVoice,
    activeSpeed,
    audioManifest,
    targetItem,
    hvptTestVoice,
  ]);

  // Auto-play when question changes
  useEffect(() => {
    questionStartRef.current = Date.now();
    const timer = setTimeout(() => {
      playCurrentStimulus();
    }, 120);
    return () => clearTimeout(timer);
  }, [questionIndex, selectedCategory, selectedSubCategory, drillFormat, playCurrentStimulus]);

  const handleSelectAnswer = useCallback(
    (choice: "A" | "B") => {
      if (userChoice !== null) return;
      const reactionMs = Math.max(180, Date.now() - questionStartRef.current);
      const isCorrect = choice === targetSide;
      setUserChoice(choice);

      setSessionStats((prev) => ({
        total: prev.total + 1,
        correct: prev.correct + (isCorrect ? 1 : 0),
        streak: isCorrect ? prev.streak + 1 : 0,
      }));

      const chosenItem = choice === "A" ? currentPair.itemA : currentPair.itemB;
      onRecordAttempt(
        {
          mode:
            drillFormat === "abx_hvpt"
              ? "abx_minimal_pairs"
              : currentPair.category === "dissyllable_tone_matrix"
              ? "maorma_2syl_matrix"
              : "maorma_1syl",
          category: currentPair.category,
          subCategory: currentPair.subCategory,
          targetId: currentPair.id,
          expectedToneOrLabel: targetItem.pinyin,
          userSelectedToneOrLabel: chosenItem.pinyin,
          correct: isCorrect,
          reactionTimeMs: reactionMs,
          speedUsed: activeSpeed,
          voiceUsed: drillFormat === "abx_hvpt" ? hvptTestVoice : activeVoice,
        },
        targetItem.tones,
        chosenItem.tones
      );
    },
    [
      userChoice,
      targetSide,
      currentPair,
      onRecordAttempt,
      drillFormat,
      targetItem,
      activeSpeed,
      hvptTestVoice,
      activeVoice,
    ]
  );

  const handleSelectToneNumber = useCallback(
    (tone: ToneNumber) => {
      if (userChoice !== null) return;
      const expectedFirstTone = (targetItem.tones[0] || 1) as ToneNumber;
      const reactionMs = Math.max(180, Date.now() - questionStartRef.current);
      const isCorrect = tone === expectedFirstTone;
      setSelectedToneChoice(tone);
      setUserChoice(isCorrect ? targetSide : targetSide === "A" ? "B" : "A");

      setSessionStats((prev) => ({
        total: prev.total + 1,
        correct: prev.correct + (isCorrect ? 1 : 0),
        streak: isCorrect ? prev.streak + 1 : 0,
      }));

      onRecordAttempt(
        {
          mode: "maorma_1syl",
          category: currentPair.category,
          subCategory: currentPair.subCategory,
          targetId: currentPair.id,
          expectedToneOrLabel: `T${expectedFirstTone}`,
          userSelectedToneOrLabel: `T${tone}`,
          correct: isCorrect,
          reactionTimeMs: reactionMs,
          speedUsed: activeSpeed,
          voiceUsed: activeVoice,
        },
        [expectedFirstTone],
        [tone]
      );
    },
    [userChoice, targetItem, targetSide, currentPair, onRecordAttempt, activeSpeed, activeVoice]
  );

  const handleNextQuestion = useCallback(() => {
    setUserChoice(null);
    setSelectedToneChoice(null);
    setShowHint(false);
    setTargetSide(Math.random() < 0.5 ? "A" : "B");
    setQuestionIndex((prev) => prev + 1);
  }, []);

  // Keyboard-First Ergonomics (R/Space, S, V, A/B, 1-5, H, Enter)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const key = e.key.toLowerCase();
      if (key === "r" || key === " ") {
        e.preventDefault();
        playCurrentStimulus();
      } else if (key === "s") {
        e.preventDefault();
        setActiveSpeed(activeSpeed === "classroom" ? "conversational" : "classroom");
      } else if (key === "v") {
        e.preventDefault();
        const idx = VOICE_OPTIONS.findIndex((v) => v.id === activeVoice);
        const nextV = VOICE_OPTIONS[(idx + 1) % VOICE_OPTIONS.length].id;
        setActiveVoice(nextV);
      } else if (key === "h") {
        e.preventDefault();
        setShowHint((prev) => !prev);
      } else if (key === "a" || key === "1") {
        if (drillFormat === "tone_identify") {
          handleSelectToneNumber(1);
        } else {
          handleSelectAnswer("A");
        }
      } else if (key === "b" || key === "2") {
        if (drillFormat === "tone_identify") {
          handleSelectToneNumber(2);
        } else {
          handleSelectAnswer("B");
        }
      } else if (
        drillFormat === "tone_identify" &&
        (key === "3" || key === "4" || key === "5")
      ) {
        handleSelectToneNumber(Number(key) as ToneNumber);
      } else if (e.key === "Enter" && userChoice !== null) {
        e.preventDefault();
        handleNextQuestion();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    playCurrentStimulus,
    activeSpeed,
    setActiveSpeed,
    activeVoice,
    setActiveVoice,
    drillFormat,
    handleSelectAnswer,
    handleSelectToneNumber,
    userChoice,
    handleNextQuestion,
  ]);

  const isAnswered = userChoice !== null;
  const isCorrect = userChoice === targetSide;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Barra Minimalista de Configuração de Escuta */}
      <section className="p-4 rounded-xl bg-xuan-card border border-xuan-border space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Seletor de Foco Fonético */}
          <div className="flex-1 min-w-[240px]">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-xuan-muted mb-1">
              Foco Acústico & Linguístico
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value as MinimalPairCategory | "all");
                setSelectedSubCategory("all");
                setUserChoice(null);
                setQuestionIndex(0);
              }}
              className="w-full px-3 py-2 rounded-lg bg-xuan-bg border border-xuan-border text-xs font-semibold text-xuan-ink focus:outline-none focus:border-[#9E2A2B]"
            >
              {FOCUS_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.labelPt}
                </option>
              ))}
            </select>
          </div>

          {/* Subcategoria específica */}
          <div className="min-w-[170px]">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-xuan-muted mb-1">
              Contraste Específico
            </label>
            <select
              value={selectedSubCategory}
              onChange={(e) => {
                setSelectedSubCategory(e.target.value);
                setUserChoice(null);
                setQuestionIndex(0);
              }}
              className="w-full px-3 py-2 rounded-lg bg-xuan-bg border border-xuan-border text-xs font-semibold text-xuan-ink focus:outline-none focus:border-[#9E2A2B]"
            >
              <option value="all">Todos ({filteredPairs.length} pares)</option>
              {availableSubCategories.map((sub) => (
                <option key={sub} value={sub}>
                  {sub}
                </option>
              ))}
            </select>
          </div>

          {/* Modo de Treino */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-xuan-muted mb-1">
              Método de Escuta
            </label>
            <div className="inline-flex rounded-lg bg-xuan-bg border border-xuan-border p-0.5 text-xs">
              <button
                type="button"
                onClick={() => {
                  setDrillFormat("ab_direct");
                  setUserChoice(null);
                }}
                className={`px-2.5 py-1.5 rounded-md font-semibold transition ${
                  drillFormat === "ab_direct"
                    ? "bg-[#9E2A2B] text-[#F5F2E9]"
                    : "text-xuan-muted hover:text-xuan-ink"
                }`}
              >
                Par Mínimo (A/B)
              </button>
              <button
                type="button"
                onClick={() => {
                  setDrillFormat("abx_hvpt");
                  setUserChoice(null);
                }}
                className={`px-2.5 py-1.5 rounded-md font-semibold transition ${
                  drillFormat === "abx_hvpt"
                    ? "bg-[#9E2A2B] text-[#F5F2E9]"
                    : "text-xuan-muted hover:text-xuan-ink"
                }`}
              >
                ABX · HVPT
              </button>
              <button
                type="button"
                onClick={() => {
                  setDrillFormat("tone_identify");
                  setUserChoice(null);
                }}
                className={`px-2.5 py-1.5 rounded-md font-semibold transition ${
                  drillFormat === "tone_identify"
                    ? "bg-[#9E2A2B] text-[#F5F2E9]"
                    : "text-xuan-muted hover:text-xuan-ink"
                }`}
              >
                Matriz T1–T5
              </button>
            </div>
          </div>
        </div>

        {/* Barra de Status Discreta & Toggle HVPT */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-xuan-border text-xs text-xuan-muted">
          <div className="flex items-center gap-3">
            <span>
              Contraste:{" "}
              <strong className="text-xuan-ink">{currentPair.contrastLabelPt}</strong>
            </span>
            {drillFormat === "abx_hvpt" && (
              <button
                type="button"
                onClick={() => setHvptEnabled((v) => !v)}
                className={`px-2 py-0.5 rounded border text-[11px] font-semibold flex items-center gap-1 transition ${
                  hvptEnabled
                    ? "border-[#3A6B59] bg-[#3A6B59]/10 text-[#3A6B59]"
                    : "border-xuan-border text-xuan-muted"
                }`}
                title="High Variability Phonetic Training: A e B são falados na Voz 1, enquanto X é falado em uma Voz Contrastante (F0 distinta)"
              >
                <Shuffle className="w-3 h-3" />
                HVPT Multi-Voz: {activeVoice} → {hvptTestVoice}
              </button>
            )}
          </div>

          <div className="flex items-center gap-4 font-mono text-[11px]">
            <span>
              Acertos:{" "}
              <strong className="text-[#3A6B59]">
                {sessionStats.correct}/{sessionStats.total}
              </strong>
            </span>
            <span>
              Sequência: <strong className="text-[#9C7A3C]">{sessionStats.streak}</strong>
            </span>
          </div>
        </div>
      </section>

      {/* ARENA ZEN DE ESCUTA — Máximo 1 Foco Cognitivo */}
      <section className="p-8 sm:p-10 rounded-xl bg-xuan-card border border-xuan-border text-center space-y-8 shadow-xs">
        {/* Botão Central de Áudio em Formato de Círculo de Tinta / Selo Chinês */}
        <div className="flex flex-col items-center justify-center space-y-3">
          <button
            type="button"
            onClick={playCurrentStimulus}
            className={`w-28 h-28 rounded-full border-2 flex flex-col items-center justify-center transition-all cursor-pointer shadow-sm ${
              isPlaying
                ? "border-[#9E2A2B] bg-[#9E2A2B] text-[#F5F2E9] scale-105"
                : "border-[#9E2A2B] bg-xuan-bg hover:bg-[#9E2A2B]/10 text-[#9E2A2B]"
            }`}
            title="Clique ou pressione Espaço / R para ouvir novamente"
          >
            <span className="font-serif text-2xl font-bold tracking-widest">听</span>
            <Volume2 className="w-5 h-5 mt-1" />
            <span className="text-[10px] font-medium mt-0.5 uppercase tracking-wider">
              {drillFormat === "abx_hvpt" ? "Ouvir A · B · X" : "Ouvir [Espaço]"}
            </span>
          </button>

          <div className="flex items-center gap-3 text-xs text-xuan-muted">
            <span>
              Voz:{" "}
              <strong className="text-xuan-ink">
                {VOICE_OPTIONS.find((v) => v.id === activeVoice)?.name}
              </strong>
            </span>
            <span>·</span>
            <span>
              Ritmo:{" "}
              <strong className="text-xuan-ink">
                {activeSpeed === "classroom" ? "Classroom (-25%)" : "Nativo (100%)"}
              </strong>
            </span>
            <button
              type="button"
              onClick={() => setShowHint((h) => !h)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-xuan-border hover:bg-xuan-subtle text-[11px]"
              title="Tecla H"
            >
              <HelpCircle className="w-3 h-3" />
              {showHint ? "Ocultar Dica" : "Dica [H]"}
            </button>
          </div>

          {showHint && !isAnswered && (
            <p className="max-w-lg text-xs text-[#9C7A3C] bg-xuan-bg px-4 py-2 rounded-lg border border-[#9C7A3C]/40">
              {currentPair.articulatoryTipPt}
            </p>
          )}
        </div>

        {/* Cartões de Escolha Limpos (Sem Hanzi/Tradução Antes da Resposta para Evitar Poluição Visual!) */}
        {drillFormat !== "tone_identify" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl mx-auto">
            {(["A", "B"] as const).map((side) => {
              const item = side === "A" ? currentPair.itemA : currentPair.itemB;
              const isSelected = userChoice === side;
              const isTarget = targetSide === side;

              let borderStyle = "border-xuan-border bg-xuan-bg hover:border-[#9E2A2B]";
              if (isAnswered) {
                if (isTarget) {
                  borderStyle = "border-2 border-[#3A6B59] bg-[#3A6B59]/10";
                } else if (isSelected && !isTarget) {
                  borderStyle = "border-2 border-[#9E2A2B] bg-[#9E2A2B]/10";
                } else {
                  borderStyle = "border-xuan-border bg-xuan-bg opacity-65";
                }
              }

              return (
                <button
                  key={side}
                  type="button"
                  disabled={isAnswered}
                  onClick={() => handleSelectAnswer(side)}
                  className={`p-6 rounded-xl border text-center transition flex flex-col items-center justify-center space-y-2 ${borderStyle}`}
                >
                  <span className="text-[11px] font-mono uppercase tracking-widest text-xuan-muted">
                    Opção [{side}]
                  </span>

                  {/* Foco exclusivo no Pinyin e Contorno Tonal antes de responder */}
                  <span className="font-pinyin text-2xl sm:text-3xl font-bold text-xuan-ink tracking-wide">
                    {item.pinyin}
                  </span>

                  <span className="text-xs font-mono text-xuan-muted">
                    {item.ipa} · Chao [{item.chaoContour}]
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          /* Matriz Tonal Discreta (T1..T5) */
          <div className="grid grid-cols-5 gap-2.5 max-w-xl mx-auto">
            {([1, 2, 3, 4, 5] as ToneNumber[]).map((t) => {
              const expectedT = (targetItem.tones[0] || 1) as ToneNumber;
              const isSelected = selectedToneChoice === t;
              let btnStyle = "border-xuan-border bg-xuan-bg hover:border-[#9E2A2B]";
              if (isAnswered) {
                if (t === expectedT) {
                  btnStyle = "border-2 border-[#3A6B59] bg-[#3A6B59]/15";
                } else if (isSelected) {
                  btnStyle = "border-2 border-[#9E2A2B] bg-[#9E2A2B]/15";
                }
              }
              return (
                <button
                  key={t}
                  type="button"
                  disabled={isAnswered}
                  onClick={() => handleSelectToneNumber(t)}
                  className={`p-4 rounded-xl border text-center transition flex flex-col items-center space-y-1 ${btnStyle}`}
                >
                  <span
                    className="text-xs font-bold font-mono"
                    style={{ color: TONE_COLORS[t] }}
                  >
                    {t === 5 ? "Neutro" : `${t}º Tom`}
                  </span>
                  <span className="text-lg font-serif font-bold text-xuan-ink">
                    {t === 1
                      ? "55 ¯"
                      : t === 2
                      ? "35 ´"
                      : t === 3
                      ? "214 ˇ"
                      : t === 4
                      ? "51 `"
                      : "·"}
                  </span>
                  <span className="text-[10px] font-mono text-xuan-muted">Tecla {t}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* REVELAÇÃO PÓS-RESPOSTA (Regra Anti-Poluição: Aparece suavemente SOMENTE após responder!) */}
        {isAnswered && (
          <div className="pt-4 border-t border-xuan-border text-left space-y-4 animate-fadeIn">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {isCorrect ? (
                  <CheckCircle2 className="w-5 h-5 text-[#3A6B59]" />
                ) : (
                  <XCircle className="w-5 h-5 text-[#9E2A2B]" />
                )}
                <span
                  className={`font-serif font-bold text-base ${
                    isCorrect ? "text-[#3A6B59]" : "text-[#9E2A2B]"
                  }`}
                >
                  {isCorrect
                    ? "Discriminação Acústica Exata!"
                    : `Resposta esperada: [${targetSide}] ${targetItem.pinyin}`}
                </span>
              </div>

              <button
                type="button"
                onClick={handleNextQuestion}
                className="px-5 py-2 rounded-lg bg-[#9E2A2B] hover:bg-[#7D2021] text-[#F5F2E9] font-serif font-bold text-xs flex items-center gap-2 transition"
              >
                <span>Próxima Questão [Enter]</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Cartões Comparativos Limpos A vs B para Reouvir */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { side: "A" as const, item: currentPair.itemA },
                { side: "B" as const, item: currentPair.itemB },
              ].map(({ side, item }) => (
                <div
                  key={side}
                  className={`p-4 rounded-lg border flex items-center justify-between ${
                    side === targetSide
                      ? "border-[#3A6B59] bg-xuan-bg"
                      : "border-xuan-border bg-xuan-bg/70"
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-hanzi text-2xl font-bold text-xuan-ink">
                        {useTraditional ? item.traditional : item.hanzi}
                      </span>
                      <span className="font-pinyin text-base font-bold text-[#9E2A2B]">
                        {item.pinyin}
                      </span>
                      <span className="text-xs font-mono text-xuan-muted">
                        {item.ipa}
                      </span>
                    </div>
                    <p className="text-xs text-xuan-muted">{item.meaningPt}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      playLexicalItemAudio(
                        item,
                        activeVoice,
                        activeSpeed,
                        audioManifest
                      )
                    }
                    className="px-3 py-1.5 rounded-md border border-xuan-border hover:border-[#9E2A2B] text-xs font-semibold flex items-center gap-1.5 shrink-0"
                  >
                    <Volume2 className="w-3.5 h-3.5 text-[#9E2A2B]" />
                    Ouvir {side}
                  </button>
                </div>
              ))}
            </div>

            {/* Explicação Fonética Curta de 1 Linha */}
            <div className="p-3 rounded-lg bg-xuan-bg border border-xuan-border text-xs text-xuan-muted">
              <strong className="text-xuan-ink font-serif">Nota Acústica: </strong>
              {currentPair.articulatoryTipPt}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
