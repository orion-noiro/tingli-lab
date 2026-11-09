"use client";

import React, { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Award,
  BarChart3,
  Brain,
  CheckCircle2,
  Clock,
  Compass,
  Flame,
  Play,
  Sparkles,
  Target,
  Volume2,
  Zap,
} from "lucide-react";
import { SharedModuleProps } from "@/types/ui-props";
import { buildDiagnosticDeck } from "@/lib/data-loader";
import { playLexicalItemAudio, TONE_COLORS } from "@/lib/audio-engine";
import { loadRecentAttemptsSync } from "@/lib/storage-db";
import { MinimalPairCategory, MinimalPairEntry, ToneNumber } from "@/types/phonetics";

const RADAR_AXES: Array<{
  key: keyof SharedModuleProps["profile"]["radarScores"];
  labelPt: string;
  shortPt: string;
  category: MinimalPairCategory;
}> = [
  {
    key: "tonesMonosyllable",
    labelPt: "Tons Isolados (T1–T5)",
    shortPt: "Tons 1-Síl",
    category: "monosyllable_tone",
  },
  {
    key: "tonesDissyllable",
    labelPt: "Matriz Dissilábica (20 Pares)",
    shortPt: "Matriz 2-Síl",
    category: "dissyllable_tone_matrix",
  },
  {
    key: "aspirationContrast",
    labelPt: "Aspiração (b/p, d/t, g/k, z/c, zh/ch, j/q)",
    shortPt: "Aspiração",
    category: "initial_aspiration",
  },
  {
    key: "retroflexPalatal",
    labelPt: "Retroflexas vs Palatais (zh/ch/sh vs j/q/x vs z/c/s)",
    shortPt: "Retroflex/Palat",
    category: "initial_place",
  },
  {
    key: "nasalCodas",
    labelPt: "Codas Nasais (-n /n/ vs -ng /ŋ/)",
    shortPt: "Nasais -n/-ng",
    category: "final_nasal",
  },
  {
    key: "umlautVowels",
    labelPt: "Vogal Anterior ü /y/ vs u /u/ & Ditongos",
    shortPt: "Vogal ü/u",
    category: "final_vowel",
  },
];

export default function DashboardDiagnosticTab(props: SharedModuleProps) {
  const {
    profile,
    pairs,
    activeVoice,
    activeSpeed,
    audioManifest,
    onRecordAttempt,
    onUpdateProfile,
    onNavigateTab,
  } = props;

  // Diagnostic Wizard State
  const [diagActive, setDiagActive] = useState(false);
  const [diagDeck, setDiagDeck] = useState<MinimalPairEntry[]>([]);
  const [diagIdx, setDiagIdx] = useState(0);
  const [diagTargetSide, setDiagTargetSide] = useState<"A" | "B">("A");
  const [diagStartTime, setDiagStartTime] = useState<number>(Date.now());
  const [diagFeedback, setDiagFeedback] = useState<{
    chosen: "A" | "B";
    correct: boolean;
    rtMs: number;
  } | null>(null);
  const [diagResults, setDiagResults] = useState<
    Array<{ category: MinimalPairCategory; correct: boolean; rtMs: number }>
  >([]);

  const recentAttempts = useMemo(
    () => loadRecentAttemptsSync(profile.id),
    [profile.id, profile.xp]
  );

  const dueCardsCount = useMemo(() => {
    const now = Date.now();
    return Object.values(profile.fsrsCards).filter((c) => c.nextDueMs <= now).length;
  }, [profile.fsrsCards]);

  const totalMasteredCount = useMemo(() => {
    return Object.values(profile.fsrsCards).filter((c) => c.stability >= 3.0).length;
  }, [profile.fsrsCards]);

  const avgReactionMs = useMemo(() => {
    if (recentAttempts.length === 0) return 0;
    const sum = recentAttempts
      .slice(0, 50)
      .reduce((acc, a) => acc + a.reactionTimeMs, 0);
    return Math.round(sum / Math.min(50, recentAttempts.length));
  }, [recentAttempts]);

  // Identify top blind spots from radarScores & confusion stats
  const blindSpots = useMemo(() => {
    const list = RADAR_AXES.map((ax) => ({
      ...ax,
      score: profile.radarScores[ax.key] || 60,
    })).sort((a, b) => a.score - b.score);
    return list.slice(0, 3);
  }, [profile.radarScores]);

  // Start 30-Question Diagnostic Test
  const startDiagnostic = () => {
    const deck = buildDiagnosticDeck(pairs);
    if (deck.length === 0) return;
    const side: "A" | "B" = Math.random() < 0.5 ? "A" : "B";
    setDiagDeck(deck);
    setDiagIdx(0);
    setDiagTargetSide(side);
    setDiagFeedback(null);
    setDiagResults([]);
    setDiagActive(true);
    setDiagStartTime(Date.now());

    const firstItem = side === "A" ? deck[0].itemA : deck[0].itemB;
    setTimeout(() => {
      playLexicalItemAudio(firstItem, activeVoice, activeSpeed, audioManifest);
    }, 180);
  };

  const handleDiagnosticAnswer = (choice: "A" | "B") => {
    if (diagFeedback || !diagDeck[diagIdx]) return;
    const rtMs = Math.max(180, Date.now() - diagStartTime);
    const currentPair = diagDeck[diagIdx];
    const correct = choice === diagTargetSide;
    const targetItem = diagTargetSide === "A" ? currentPair.itemA : currentPair.itemB;
    const chosenItem = choice === "A" ? currentPair.itemA : currentPair.itemB;

    setDiagFeedback({ chosen: choice, correct, rtMs });
    const nextResults = [
      ...diagResults,
      { category: currentPair.category, correct, rtMs },
    ];
    setDiagResults(nextResults);

    onRecordAttempt(
      {
        mode: "diagnostic",
        category: currentPair.category,
        subCategory: currentPair.subCategory,
        targetId: currentPair.id,
        expectedToneOrLabel: `${targetItem.pinyin} (${targetItem.hanzi})`,
        userSelectedToneOrLabel: `${chosenItem.pinyin} (${chosenItem.hanzi})`,
        correct,
        reactionTimeMs: rtMs,
        speedUsed: activeSpeed,
        voiceUsed: activeVoice,
      },
      targetItem.tones,
      chosenItem.tones
    );
  };

  const nextDiagnosticStep = () => {
    if (diagIdx + 1 >= diagDeck.length) {
      // Finish diagnostic and mark profile
      onUpdateProfile({
        ...profile,
        diagnosticCompleted: true,
        xp: profile.xp + 150,
      });
      setDiagActive(false);
      return;
    }
    const nextI = diagIdx + 1;
    const side: "A" | "B" = Math.random() < 0.5 ? "A" : "B";
    setDiagIdx(nextI);
    setDiagTargetSide(side);
    setDiagFeedback(null);
    setDiagStartTime(Date.now());

    const nextItem = side === "A" ? diagDeck[nextI].itemA : diagDeck[nextI].itemB;
    setTimeout(() => {
      playLexicalItemAudio(nextItem, activeVoice, activeSpeed, audioManifest);
    }, 150);
  };

  // Compute SVG Radar Hexagon coordinates
  const radarGeometry = useMemo(() => {
    const cx = 150;
    const cy = 150;
    const maxR = 105;

    const getPoint = (idx: number, radiusRatio: number) => {
      const angle = (Math.PI * 2 * idx) / 6 - Math.PI / 2;
      return {
        x: cx + Math.cos(angle) * maxR * radiusRatio,
        y: cy + Math.sin(angle) * maxR * radiusRatio,
      };
    };

    const rings = [0.25, 0.5, 0.75, 1.0].map((r) =>
      RADAR_AXES.map((_, idx) => {
        const pt = getPoint(idx, r);
        return `${pt.x},${pt.y}`;
      }).join(" ")
    );

    const dataPolygon = RADAR_AXES.map((ax, idx) => {
      const val = Math.min(100, Math.max(10, profile.radarScores[ax.key] || 60)) / 100;
      const pt = getPoint(idx, val);
      return `${pt.x},${pt.y}`;
    }).join(" ");

    const axesPoints = RADAR_AXES.map((ax, idx) => ({
      ...ax,
      end: getPoint(idx, 1.0),
      labelPos: getPoint(idx, 1.24),
      dotPos: getPoint(
        idx,
        Math.min(100, Math.max(10, profile.radarScores[ax.key] || 60)) / 100
      ),
      value: profile.radarScores[ax.key] || 60,
    }));

    return { cx, cy, rings, dataPolygon, axesPoints };
  }, [profile.radarScores]);

  // 5x5 Monosyllable Confusion Matrix helper
  const tonesList: ToneNumber[] = [1, 2, 3, 4, 5];

  if (diagActive && diagDeck[diagIdx]) {
    const currentPair = diagDeck[diagIdx];
    const currentTarget =
      diagTargetSide === "A" ? currentPair.itemA : currentPair.itemB;

    return (
      <div className="max-w-3xl mx-auto bg-xuan-card border border-xuan-border rounded-2xl p-6 sm:p-8 shadow-sm">
        <div className="flex items-center justify-between border-b border-xuan-border pb-4 mb-6">
          <div>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#9E2A2B] bg-[#9E2A2B]/10 border border-[#9E2A2B]/30 px-3 py-1 rounded-full">
              <Compass className="w-3.5 h-3.5" />
              Diagnóstico Auditivo Inicial • Questão {diagIdx + 1} de{" "}
              {diagDeck.length}
            </span>
            <h2 className="text-xl font-serif font-bold text-xuan-ink mt-2">
              {currentPair.contrastLabelPt}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setDiagActive(false)}
            className="text-xs text-xuan-muted hover:text-xuan-ink px-3 py-1.5 rounded-lg bg-xuan-bg border border-xuan-border"
          >
            Sair do Diagnóstico
          </button>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 bg-xuan-bg border border-xuan-border rounded-full overflow-hidden mb-6">
          <div
            className="h-full bg-[#9E2A2B] transition-all duration-300"
            style={{ width: `${((diagIdx + 1) / diagDeck.length) * 100}%` }}
          />
        </div>

        {/* Audio Trigger — Zen Focus */}
        <div className="flex flex-col items-center justify-center py-6 bg-xuan-bg rounded-xl border border-xuan-border mb-6">
          <button
            type="button"
            onClick={() =>
              playLexicalItemAudio(
                currentTarget,
                activeVoice,
                activeSpeed,
                audioManifest
              )
            }
            className="w-20 h-20 rounded-full bg-[#9E2A2B] hover:bg-[#7D2021] text-[#F5F2E9] flex items-center justify-center shadow-md transition transform hover:scale-105 active:scale-95"
          >
            <Volume2 className="w-9 h-9" />
          </button>
          <p className="text-sm text-xuan-ink mt-3 font-serif font-semibold">
            Ouça o estímulo e selecione qual pronúncia você ouviu
          </p>
          <span className="text-xs text-xuan-muted mt-1">
            Subcategoria avaliada: {currentPair.subCategory}
          </span>
        </div>

        {/* 2 Minimal Pair Choices — Regra Anti-Poluição: Hanzi e tradução ocultos antes da resposta */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(["A", "B"] as const).map((side) => {
            const item = side === "A" ? currentPair.itemA : currentPair.itemB;
            const isSelected = diagFeedback?.chosen === side;
            const isCorrectTarget = diagTargetSide === side;

            let borderStyle =
              "border-xuan-border bg-xuan-bg hover:border-[#9E2A2B]";
            if (diagFeedback) {
              if (isCorrectTarget) {
                borderStyle =
                  "border-[#3A6B59] bg-[#3A6B59]/15 text-xuan-ink";
              } else if (isSelected && !isCorrectTarget) {
                borderStyle = "border-[#9E2A2B] bg-[#9E2A2B]/15 text-xuan-ink";
              }
            }

            return (
              <button
                key={side}
                type="button"
                disabled={Boolean(diagFeedback)}
                onClick={() => handleDiagnosticAnswer(side)}
                className={`p-5 rounded-xl border-2 text-left transition flex flex-col justify-between ${borderStyle}`}
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <span className="kbd-badge">{side}</span>
                  <span className="text-xs font-mono text-xuan-muted">
                    {item.ipa} • Chao [{item.chaoContour}]
                  </span>
                </div>
                <div className="my-1">
                  <div className="text-2xl font-bold font-pinyin text-xuan-ink">
                    {item.pinyin}
                  </div>
                  {diagFeedback && (
                    <div className="text-2xl font-serif font-bold text-[#3B596A] mt-1">
                      {profile.preferredScript === "traditional"
                        ? item.traditional
                        : item.hanzi}
                    </div>
                  )}
                </div>
                {diagFeedback && (
                  <p className="text-xs text-xuan-muted mt-2">{item.meaningPt}</p>
                )}
              </button>
            );
          })}
        </div>

        {diagFeedback && (
          <div className="mt-6 p-4 rounded-xl bg-xuan-bg border border-xuan-border flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm">
              <div className="font-bold flex items-center gap-2">
                {diagFeedback.correct ? (
                  <span className="text-[#3A6B59] flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> Resposta Correta! (
                    {diagFeedback.rtMs} ms)
                  </span>
                ) : (
                  <span className="text-[#9E2A2B] flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" /> Ponto Cego Detectado (
                    {diagFeedback.rtMs} ms)
                  </span>
                )}
              </div>
              <p className="text-xs text-xuan-muted mt-1">
                {currentPair.articulatoryTipPt}
              </p>
            </div>
            <button
              type="button"
              onClick={nextDiagnosticStep}
              className="px-5 py-2.5 rounded-lg bg-[#9E2A2B] hover:bg-[#7D2021] text-[#F5F2E9] font-bold text-sm shrink-0 transition"
            >
              {diagIdx + 1 >= diagDeck.length
                ? "Concluir e Gerar Mapa Radar"
                : "Próxima Questão →"}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Hero Banner + Diagnostic CTA */}
      <div className="bg-xuan-card border border-xuan-border rounded-2xl p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#9E2A2B]/10 border border-[#9E2A2B]/30 text-[#9E2A2B] text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              Motor Adaptativo FSRS + Matriz de Confusão Bayesiana Ativos
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-xuan-ink tracking-tight">
              Registro Imperial de {profile.name} ·{" "}
              <span className="text-[#9E2A2B]">竹简 (Zhújiǎn)</span>
            </h1>
            <p className="text-sm text-xuan-muted leading-relaxed">
              Acompanhe sua precisão tonal (monossílabos e dissílabos), pares mínimos
              categoriais, Tone Sandhi e produção com análise acústica{" "}
              <span className="font-mono text-[#3B596A] font-semibold">F0</span> sobre{" "}
              <strong className="text-xuan-ink">{pairs.length.toLocaleString("pt-BR")}</strong>{" "}
              pares mínimos verificados.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={startDiagnostic}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#9E2A2B] hover:bg-[#7D2021] text-[#F5F2E9] font-bold text-xs shadow-sm transition"
            >
              <Compass className="w-4 h-4" />
              {profile.diagnosticCompleted
                ? "Refazer Diagnóstico (30 Questões)"
                : "Iniciar Diagnóstico Auditivo"}
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab("arena")}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#3A6B59]/15 hover:bg-[#3A6B59]/25 border border-[#3A6B59]/40 text-[#3A6B59] font-bold text-xs transition"
            >
              <Play className="w-4 h-4" />
              Ir para Escuta & Treino
            </button>
          </div>
        </div>

        {/* 4 Telemetry Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-6 pt-6 border-t border-xuan-border">
          <div className="bg-xuan-bg border border-xuan-border rounded-xl p-4">
            <div className="flex items-center justify-between text-xs text-xuan-muted">
              <span>XP Fonético & Ofensiva</span>
              <Flame className="w-4 h-4 text-[#9C7A3C]" />
            </div>
            <div className="text-2xl font-serif font-bold text-xuan-ink mt-1">
              {profile.xp.toLocaleString("pt-BR")} XP
            </div>
            <div className="text-xs text-[#9C7A3C] mt-0.5 font-medium">
              {profile.streakDays} dia(s) seguido(s)
            </div>
          </div>

          <div className="bg-xuan-bg border border-xuan-border rounded-xl p-4">
            <div className="flex items-center justify-between text-xs text-xuan-muted">
              <span>Revisões FSRS Hoje</span>
              <Brain className="w-4 h-4 text-[#3B596A]" />
            </div>
            <div className="text-2xl font-serif font-bold text-xuan-ink mt-1">
              {dueCardsCount} pendente(s)
            </div>
            <div className="text-xs text-[#3A6B59] mt-0.5 font-medium">
              {totalMasteredCount} par(es) estabilizados
            </div>
          </div>

          <div className="bg-xuan-bg border border-xuan-border rounded-xl p-4">
            <div className="flex items-center justify-between text-xs text-xuan-muted">
              <span>Tempo de Reação Médio</span>
              <Clock className="w-4 h-4 text-[#9E2A2B]" />
            </div>
            <div className="text-2xl font-serif font-bold text-xuan-ink mt-1">
              {avgReactionMs > 0 ? `${avgReactionMs} ms` : "— ms"}
            </div>
            <div className="text-xs text-xuan-muted mt-0.5">
              Meta automática: {"< 1.500 ms"}
            </div>
          </div>

          <div className="bg-xuan-bg border border-xuan-border rounded-xl p-4">
            <div className="flex items-center justify-between text-xs text-xuan-muted">
              <span>Banco Fonético Ativo</span>
              <Award className="w-4 h-4 text-[#3A6B59]" />
            </div>
            <div className="text-2xl font-serif font-bold text-xuan-ink mt-1">
              {pairs.length.toLocaleString("pt-BR")}
            </div>
            <div className="text-xs text-[#3B596A] mt-0.5">
              Pares mínimos + 6 vozes nativas
            </div>
          </div>
        </div>
      </div>

      {/* Middle Row: 6-Axis Phonetic Radar Map + Personalized Blind Spots Trail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Radar Map */}
        <div className="lg:col-span-6 bg-xuan-card border border-xuan-border rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-base font-serif font-bold text-xuan-ink flex items-center gap-2">
                <Target className="w-5 h-5 text-[#9E2A2B]" />
                Mapa de Radar Fonético (6 Eixos)
              </h2>
              <span className="text-xs text-xuan-muted font-mono">
                Precisão Ajustada por Latência
              </span>
            </div>
            <p className="text-xs text-xuan-muted mb-4">
              Visualização dos seus domínios auditivos em Mandarim Padrão.
              Acertos lentos ({"> 2500ms"}) reduzem a pontuação para estimular
              fluência perceptual automática.
            </p>
          </div>

          <div className="flex items-center justify-center my-2">
            <svg
              viewBox="0 0 300 300"
              className="w-full max-w-[320px] h-auto select-none overflow-visible"
            >
              {/* Concentric Hexagon Rings */}
              {radarGeometry.rings.map((pts, i) => (
                <polygon
                  key={i}
                  points={pts}
                  fill="none"
                  stroke="rgba(140, 133, 123, 0.35)"
                  strokeWidth="1"
                  strokeDasharray={i === 3 ? "none" : "3,3"}
                />
              ))}

              {/* Axis Spokes */}
              {radarGeometry.axesPoints.map((ax, i) => (
                <g key={i}>
                  <line
                    x1={radarGeometry.cx}
                    y1={radarGeometry.cy}
                    x2={ax.end.x}
                    y2={ax.end.y}
                    stroke="rgba(140, 133, 123, 0.4)"
                    strokeWidth="1"
                  />
                  <text
                    x={ax.labelPos.x}
                    y={ax.labelPos.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    style={{ fill: "var(--text-primary)" }}
                    className="text-[10px] font-semibold"
                  >
                    {ax.shortPt} ({ax.value}%)
                  </text>
                </g>
              ))}

              {/* User Data Polygon — Vermelho Cinábrio Clássico */}
              <polygon
                points={radarGeometry.dataPolygon}
                fill="rgba(158, 42, 43, 0.20)"
                stroke="#9E2A2B"
                strokeWidth="2.5"
              />

              {/* Vertex Dots */}
              {radarGeometry.axesPoints.map((ax, i) => (
                <circle
                  key={i}
                  cx={ax.dotPos.x}
                  cy={ax.dotPos.y}
                  r="4.5"
                  fill="#9E2A2B"
                  stroke="#F5F2E9"
                  strokeWidth="1.5"
                />
              ))}
            </svg>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4">
            {RADAR_AXES.map((ax) => {
              const score = profile.radarScores[ax.key] || 60;
              return (
                <button
                  key={ax.key}
                  type="button"
                  onClick={() =>
                    onNavigateTab("arena", { filterCategory: ax.category })
                  }
                  className="p-2.5 rounded-xl bg-xuan-bg hover:bg-xuan-subtle border border-xuan-border text-left transition"
                >
                  <div className="text-[11px] text-xuan-muted truncate">
                    {ax.shortPt}
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span
                      className={`text-sm font-bold ${
                        score >= 80
                          ? "text-[#3A6B59]"
                          : score >= 60
                          ? "text-[#3B596A]"
                          : "text-[#9C7A3C]"
                      }`}
                    >
                      {score}%
                    </span>
                    <span className="text-[10px] text-[#9E2A2B] font-semibold">
                      Treinar →
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Personalized Remediation Trail & Blind Spots */}
        <div className="lg:col-span-6 bg-xuan-card border border-xuan-border rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-base font-serif font-bold text-xuan-ink flex items-center gap-2">
                <Zap className="w-5 h-5 text-[#9C7A3C]" />
                Pontos Cegos Auditivos & Trilha Recomendada
              </h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#9C7A3C]/15 text-[#9C7A3C] border border-[#9C7A3C]/30 font-semibold">
                Foco Lusófono (PT-BR)
              </span>
            </div>
            <p className="text-xs text-xuan-muted mb-4">
              Prioridades calculadas pelo agendador FSRS com base nos seus erros
              de discriminação e tempo de resposta em milissegundos:
            </p>

            <div className="space-y-3">
              {blindSpots.map((spot, idx) => (
                <div
                  key={spot.key}
                  className="p-4 rounded-xl bg-xuan-bg border border-xuan-border flex items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-[#9C7A3C]/20 text-[#9C7A3C] text-xs font-bold flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <h3 className="text-sm font-bold text-xuan-ink">
                        {spot.labelPt}
                      </h3>
                    </div>
                    <p className="text-xs text-xuan-muted">
                      Domínio atual:{" "}
                      <strong className="text-[#9C7A3C]">{spot.score}%</strong> •
                      Clique para abrir sessão intensiva de pares mínimos.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onNavigateTab("arena", { filterCategory: spot.category })
                    }
                    className="px-3.5 py-2 rounded-lg bg-[#9E2A2B] hover:bg-[#7D2021] text-[#F5F2E9] text-xs font-bold shrink-0 transition"
                  >
                    Treinar Agora
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Module Launchers */}
          <div className="grid grid-cols-2 gap-3 mt-6 pt-4 border-t border-xuan-border">
            <button
              type="button"
              onClick={() => onNavigateTab("oral")}
              className="p-3.5 rounded-xl bg-xuan-bg hover:bg-xuan-subtle border border-xuan-border text-left transition"
            >
              <div className="text-xs font-bold text-[#9E2A2B] flex items-center gap-1.5">
                <Activity className="w-4 h-4" />
                Avaliador de Pitch F0
              </div>
              <p className="text-[11px] text-xuan-muted mt-1">
                Grave sua voz ou treine no Modo Cego com um amigo (Feynman Mode).
              </p>
            </button>

            <button
              type="button"
              onClick={() => onNavigateTab("compare_sandhi")}
              className="p-3.5 rounded-xl bg-xuan-bg hover:bg-xuan-subtle border border-xuan-border text-left transition"
            >
              <div className="text-xs font-bold text-[#3A6B59] flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4" />
                Tone Sandhi & Guias PT
              </div>
              <p className="text-[11px] text-xuan-muted mt-1">
                Domine T3+T3 → T2+T3, Meio 3º Tom [21], 不/一 e posição da língua.
              </p>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Row: 5x5 Tonal Confusion Matrix Heatmap + Recent Telemetry */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 5x5 Tonal Confusion Matrix */}
        <div className="lg:col-span-7 bg-xuan-card border border-xuan-border rounded-2xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-base font-serif font-bold text-xuan-ink">
                Matriz de Confusão Tonal 5 × 5 (Ouvido vs Respondido)
              </h2>
              <p className="text-xs text-xuan-muted">
                As linhas indicam o <strong>Tom Real Tocado</strong> e as colunas
                indicam <strong>O Que Você Respondeu</strong>. Células fora da
                diagonal principal revelam confusões sistemáticas (ex.: T2 ↔ T3).
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-center text-xs">
              <thead>
                <tr>
                  <th className="p-2 text-left text-xuan-muted font-semibold border-b border-xuan-border">
                    Real ↓ / Resp →
                  </th>
                  {tonesList.map((t) => (
                    <th
                      key={t}
                      className="p-2 font-bold border-b border-xuan-border"
                      style={{ color: TONE_COLORS[t] }}
                    >
                      Tom {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tonesList.map((expected) => {
                  const rowTotal = tonesList.reduce(
                    (acc, ch) =>
                      acc +
                      (profile.confusion.monosyllableTones[`${expected}_${ch}`] ||
                        0),
                    0
                  );

                  return (
                    <tr key={expected} className="border-b border-xuan-border/60">
                      <td
                        className="p-2.5 text-left font-bold"
                        style={{ color: TONE_COLORS[expected] }}
                      >
                        Tom {expected}{" "}
                        <span className="text-[10px] text-xuan-muted font-normal">
                          (n={rowTotal})
                        </span>
                      </td>
                      {tonesList.map((chosen) => {
                        const count =
                          profile.confusion.monosyllableTones[
                            `${expected}_${chosen}`
                          ] || 0;
                        const pct =
                          rowTotal > 0 ? Math.round((count / rowTotal) * 100) : 0;
                        const isDiag = expected === chosen;

                        let cellBg = "var(--bg-primary)";
                        if (count > 0) {
                          if (isDiag) {
                            cellBg = `rgba(58, 107, 89, ${Math.min(
                              0.45,
                              0.12 + (pct / 100) * 0.35
                            )})`;
                          } else {
                            cellBg = `rgba(158, 42, 43, ${Math.min(
                              0.45,
                              0.15 + (pct / 100) * 0.35
                            )})`;
                          }
                        }

                        return (
                          <td
                            key={chosen}
                            style={{ backgroundColor: cellBg }}
                            className="p-2.5 rounded-lg border border-xuan-border font-mono transition"
                          >
                            <div className="font-bold text-xuan-ink">
                              {rowTotal > 0 ? `${pct}%` : "—"}
                            </div>
                            <div className="text-[10px] text-xuan-muted">
                              {count > 0 ? `${count}x` : "0"}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Subcategory Accuracy & Latency Breakdown */}
        <div className="lg:col-span-5 bg-xuan-card border border-xuan-border rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-base font-serif font-bold text-xuan-ink mb-1">
              Histórico Recente & Latência (ms)
            </h2>
            <p className="text-xs text-xuan-muted mb-4">
              Últimas respostas registradas neste perfil com tempo de reação em
              milissegundos:
            </p>

            {recentAttempts.length === 0 ? (
              <div className="py-12 text-center text-xuan-muted text-xs border border-dashed border-xuan-border rounded-xl">
                Nenhuma resposta registrada ainda. Inicie o Diagnóstico ou faça
                alguns exercícios na Arena!
              </div>
            ) : (
              <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                {recentAttempts.slice(0, 12).map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center justify-between px-3 py-2 rounded-xl bg-xuan-bg border border-xuan-border text-xs"
                  >
                    <div className="truncate pr-2">
                      <span
                        className={`inline-block w-2 h-2 rounded-full mr-2 ${
                          att.correct ? "bg-[#3A6B59]" : "bg-[#9E2A2B]"
                        }`}
                      />
                      <span className="font-semibold text-xuan-ink">
                        {att.expectedToneOrLabel}
                      </span>
                      {!att.correct && (
                        <span className="text-[#9E2A2B] ml-1.5">
                          (Resp: {att.userSelectedToneOrLabel})
                        </span>
                      )}
                      <span className="text-xuan-muted ml-2">
                        [{att.subCategory}]
                      </span>
                    </div>
                    <span
                      className={`font-mono shrink-0 px-2 py-0.5 rounded ${
                        att.reactionTimeMs > 2500
                          ? "bg-[#9C7A3C]/15 text-[#9C7A3C]"
                          : "bg-xuan-subtle text-xuan-ink"
                      }`}
                    >
                      {att.reactionTimeMs} ms
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
