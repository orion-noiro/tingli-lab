"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Award,
  CheckCircle2,
  Eye,
  EyeOff,
  Mic,
  MicOff,
  Play,
  RefreshCw,
  Sparkles,
  Users,
  Volume2,
  XCircle,
} from "lucide-react";
import { SharedModuleProps } from "@/types/ui-props";
import {
  detectPitchYIN,
  evaluatePitchContoursDTW,
  generateTheoreticalChaoContour,
  normalizeHzSeriesToChao,
  PitchEvaluationResult,
  playLexicalItemAudio,
  TONE_COLORS,
} from "@/lib/audio-engine";
import { selectAdaptiveMinimalPairs } from "@/lib/fsrs-engine";
import { LexicalItem, MinimalPairCategory, MinimalPairEntry } from "@/types/phonetics";
import PitchContourCanvas from "./PitchContourCanvas";

export default function OralProductionTab(props: SharedModuleProps) {
  const {
    profile,
    pairs,
    audioManifest,
    activeVoice,
    activeSpeed,
    onRecordAttempt,
  } = props;

  const [subMode, setSubMode] = useState<"solo_ai_pitch" | "partner_blind">(
    "solo_ai_pitch"
  );
  const [selectedCategory, setSelectedCategory] = useState<
    MinimalPairCategory | "all"
  >("all");
  const [currentPair, setCurrentPair] = useState<MinimalPairEntry | null>(null);
  const [targetSide, setTargetSide] = useState<"A" | "B">("A");

  // Solo Microphone Recording & Pitch State
  const [isRecording, setIsRecording] = useState(false);
  const [liveHzVal, setLiveHzVal] = useState<number | null>(null);
  const [userContour, setUserContour] = useState<number[]>([]);
  const [evalResult, setEvalResult] = useState<PitchEvaluationResult | null>(
    null
  );
  const [micError, setMicError] = useState<string | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const recordedHzRef = useRef<number[]>([]);
  const recordStartMsRef = useRef<number>(0);

  // Partner Blind Mode (Feynman Mode) State
  const [speakerSecretVisible, setSpeakerSecretVisible] = useState(true);
  const [partnerChoice, setPartnerChoice] = useState<"A" | "B" | null>(null);

  const pickNextPair = useCallback(() => {
    if (pairs.length === 0) return;
    const pool = selectAdaptiveMinimalPairs(
      pairs,
      profile,
      12,
      selectedCategory
    );
    const chosen =
      pool[Math.floor(Math.random() * pool.length)] || pairs[0];
    const side: "A" | "B" = Math.random() < 0.5 ? "A" : "B";
    setCurrentPair(chosen);
    setTargetSide(side);
    setUserContour([]);
    setEvalResult(null);
    setMicError(null);
    setPartnerChoice(null);
    setSpeakerSecretVisible(true);
  }, [pairs, profile, selectedCategory]);

  useEffect(() => {
    if (pairs.length > 0 && !currentPair) {
      pickNextPair();
    }
  }, [pairs, currentPair, pickNextPair]);

  const targetItem: LexicalItem | null = useMemo(() => {
    if (!currentPair) return null;
    return targetSide === "A" ? currentPair.itemA : currentPair.itemB;
  }, [currentPair, targetSide]);

  const foilItem: LexicalItem | null = useMemo(() => {
    if (!currentPair) return null;
    return targetSide === "A" ? currentPair.itemB : currentPair.itemA;
  }, [currentPair, targetSide]);

  const nativeTargetContour = useMemo(() => {
    if (!targetItem) return [];
    return (
      audioManifest?.items?.[targetItem.audioKey]?.f0Chao ||
      generateTheoreticalChaoContour(targetItem.tones, true)
    );
  }, [targetItem, audioManifest]);

  const stopRecordingAndEvaluate = useCallback(() => {
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    setIsRecording(false);
    setLiveHzVal(null);

    if (!targetItem || !currentPair) return;
    const hzList = recordedHzRef.current;
    if (hzList.length < 4) {
      setMicError(
        "Sinal de voz muito curto ou silencioso. Segure para gravar e pronuncie a palavra em voz clara."
      );
      return;
    }

    const normalizedUser = normalizeHzSeriesToChao(hzList, 30);
    setUserContour(normalizedUser);

    const res = evaluatePitchContoursDTW(
      normalizedUser,
      nativeTargetContour,
      targetItem.tones
    );
    setEvalResult(res);

    const durationMs = Math.max(400, Date.now() - recordStartMsRef.current);
    onRecordAttempt(
      {
        mode: "oral_ai_pitch",
        category: currentPair.category,
        subCategory: currentPair.subCategory,
        targetId: currentPair.id,
        expectedToneOrLabel: `${targetItem.pinyin} (${targetItem.hanzi})`,
        userSelectedToneOrLabel: `Pitch Score ${res.overallScore}%`,
        correct: res.overallScore >= 70,
        reactionTimeMs: durationMs,
        speedUsed: activeSpeed,
        voiceUsed: activeVoice,
        pitchScore: res.overallScore,
      },
      targetItem.tones,
      targetItem.tones
    );
  }, [
    targetItem,
    currentPair,
    nativeTargetContour,
    onRecordAttempt,
    activeSpeed,
    activeVoice,
  ]);

  const startMicrophoneRecording = async () => {
    setMicError(null);
    setEvalResult(null);
    recordedHzRef.current = [];
    recordStartMsRef.current = Date.now();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
        },
      });
      mediaStreamRef.current = stream;

      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      analyserRef.current = analyser;

      const buffer = new Float32Array(analyser.fftSize);
      setIsRecording(true);

      const loop = () => {
        if (!analyserRef.current || !audioCtxRef.current) return;
        analyserRef.current.getFloatTimeDomainData(buffer);
        const hz = detectPitchYIN(buffer, audioCtxRef.current.sampleRate);
        if (hz !== null) {
          setLiveHzVal(Math.round(hz));
          recordedHzRef.current.push(hz);
          if (recordedHzRef.current.length >= 4) {
            setUserContour(
              normalizeHzSeriesToChao(recordedHzRef.current, 30)
            );
          }
        }
        // Auto-stop after 3.2 seconds of recording
        if (Date.now() - recordStartMsRef.current > 3200) {
          stopRecordingAndEvaluate();
          return;
        }
        rafIdRef.current = requestAnimationFrame(loop);
      };

      rafIdRef.current = requestAnimationFrame(loop);
    } catch {
      setMicError(
        "Permissão de microfone não concedida ou dispositivo indisponível. Use o botão 'Simular Pronúncia (Demo DSP)' abaixo para testar o avaliador DTW!"
      );
    }
  };

  // Simulated voice contour for instant testing without mic hardware
  const simulateVoiceAttempt = (quality: "accurate" | "confused") => {
    if (!targetItem || !currentPair || !foilItem) return;
    setMicError(null);

    const baseCurve =
      quality === "accurate"
        ? nativeTargetContour
        : generateTheoreticalChaoContour(foilItem.tones, true);

    const simulated = baseCurve.map((val, idx) => {
      const jitter =
        Math.sin(idx * 0.7) * (quality === "accurate" ? 0.14 : 0.25);
      return Number(Math.min(5, Math.max(1, val + jitter)).toFixed(2));
    });

    setUserContour(simulated);
    const res = evaluatePitchContoursDTW(
      simulated,
      nativeTargetContour,
      targetItem.tones
    );
    setEvalResult(res);

    onRecordAttempt(
      {
        mode: "oral_ai_pitch",
        category: currentPair.category,
        subCategory: currentPair.subCategory,
        targetId: currentPair.id,
        expectedToneOrLabel: `${targetItem.pinyin} (${targetItem.hanzi})`,
        userSelectedToneOrLabel: `Pitch Score ${res.overallScore}%`,
        correct: res.overallScore >= 70,
        reactionTimeMs: 1150,
        speedUsed: activeSpeed,
        voiceUsed: activeVoice,
        pitchScore: res.overallScore,
      },
      targetItem.tones,
      quality === "accurate" ? targetItem.tones : foilItem.tones
    );
  };

  // Partner Blind Mode Selection
  const handlePartnerSelect = (side: "A" | "B") => {
    if (partnerChoice || !currentPair || !targetItem) return;
    setPartnerChoice(side);
    const isCorrect = side === targetSide;
    const chosenItem = side === "A" ? currentPair.itemA : currentPair.itemB;

    onRecordAttempt(
      {
        mode: "oral_partner",
        category: currentPair.category,
        subCategory: currentPair.subCategory,
        targetId: currentPair.id,
        expectedToneOrLabel: `${targetItem.pinyin} (${targetItem.hanzi})`,
        userSelectedToneOrLabel: `${chosenItem.pinyin} (${chosenItem.hanzi})`,
        correct: isCorrect,
        reactionTimeMs: 1400,
        speedUsed: activeSpeed,
        voiceUsed: activeVoice,
      },
      targetItem.tones,
      chosenItem.tones
    );
  };

  useEffect(() => {
    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  if (!currentPair || !targetItem || !foilItem) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Submode Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSubMode("solo_ai_pitch")}
            className={`px-4 py-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition ${
              subMode === "solo_ai_pitch"
                ? "bg-[#9E2A2B] border-[#9E2A2B] text-[#F5F2E9] shadow-sm"
                : "bg-xuan-bg border-xuan-border text-xuan-muted hover:text-xuan-ink"
            }`}
          >
            <Activity className="w-4 h-4" />
            Submodo A: Analisador Acústico F0 em Tempo Real (Solo YIN + DTW)
          </button>

          <button
            type="button"
            onClick={() => setSubMode("partner_blind")}
            className={`px-4 py-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition ${
              subMode === "partner_blind"
                ? "bg-[#3A6B59] border-[#3A6B59] text-[#F5F2E9] shadow-sm"
                : "bg-xuan-bg border-xuan-border text-xuan-muted hover:text-xuan-ink"
            }`}
          >
            <Users className="w-4 h-4" />
            Submodo B: Produção Cega com Amigo / Professor (Método Feynman)
          </button>
        </div>

        <button
          type="button"
          onClick={pickNextPair}
          className="px-4 py-2 rounded-xl bg-xuan-bg hover:bg-xuan-subtle border border-xuan-border text-xuan-ink text-xs font-semibold flex items-center gap-1.5 self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Sortear Nova Palavra
        </button>
      </div>

      {subMode === "solo_ai_pitch" ? (
        <div className="bg-xuan-card border border-xuan-border rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-xuan-border pb-5">
            <div>
              <span className="text-xs font-mono text-[#9E2A2B] uppercase tracking-wider font-semibold">
                Alvo de Pronúncia • {currentPair.subCategory}
              </span>
              <div className="flex items-baseline gap-4 mt-1">
                <span className="text-4xl font-bold font-hanzi text-xuan-ink">
                  {profile.preferredScript === "traditional"
                    ? targetItem.traditional
                    : targetItem.hanzi}
                </span>
                <span
                  className="text-3xl font-extrabold font-pinyin"
                  style={{ color: TONE_COLORS[targetItem.tones[0] || 1] }}
                >
                  {targetItem.pinyin}
                </span>
                <span className="text-sm font-mono text-xuan-muted">
                  {targetItem.ipa} • Chao [{targetItem.chaoContour}]
                </span>
              </div>
              <p className="text-sm text-xuan-muted mt-1">
                Significado: <strong className="text-xuan-ink">{targetItem.meaningPt}</strong> (Não
                confundir com {foilItem.pinyin} {foilItem.hanzi} — “
                {foilItem.meaningPt}”)
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  playLexicalItemAudio(
                    targetItem,
                    activeVoice,
                    activeSpeed,
                    audioManifest
                  )
                }
                className="px-4 py-2.5 rounded-xl bg-xuan-bg hover:bg-xuan-subtle border border-xuan-border text-xuan-ink text-xs font-bold flex items-center gap-2 transition"
              >
                <Volume2 className="w-4 h-4 text-[#3B596A]" />
                Ouvir Modelo Nativo
              </button>

              {!isRecording ? (
                <button
                  type="button"
                  onClick={startMicrophoneRecording}
                  className="px-5 py-2.5 rounded-xl bg-[#9E2A2B] hover:bg-[#7D2021] text-[#F5F2E9] font-bold text-xs flex items-center gap-2 shadow-sm transition"
                >
                  <Mic className="w-4 h-4" />
                  Gravar Minha Voz (Microfone)
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopRecordingAndEvaluate}
                  className="px-5 py-2.5 rounded-xl bg-[#9C7A3C] text-[#F5F2E9] font-bold text-xs flex items-center gap-2 animate-pulse transition"
                >
                  <MicOff className="w-4 h-4" />
                  Parar & Avaliar ({liveHzVal ? `${liveHzVal} Hz` : "Ouvindo..."})
                </button>
              )}
            </div>
          </div>

          {micError && (
            <div className="p-3.5 rounded-xl bg-[#9C7A3C]/15 border border-[#9C7A3C]/40 text-[#9C7A3C] text-xs">
              {micError}
            </div>
          )}

          {/* Pitch Contour Canvas with Native Target + Foil + User Curve */}
          <PitchContourCanvas
            primaryContour={nativeTargetContour}
            primaryLabel={`Alvo Nativo: ${targetItem.pinyin} [${targetItem.chaoContour}]`}
            primaryTone={targetItem.tones[0] || 1}
            secondaryContour={generateTheoreticalChaoContour(
              foilItem.tones,
              true
            )}
            secondaryLabel={`Contraste: ${foilItem.pinyin} [${foilItem.chaoContour}]`}
            secondaryTone={foilItem.tones[0] || 4}
            secondaryDashed={true}
            userContour={userContour.length > 1 ? userContour : undefined}
            userLabel="Sua Curva F0 (Microfone)"
            syllableCount={targetItem.tones.length}
            height={230}
          />

          {/* Quick Demo Buttons for Testing DTW Grader without Mic */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-xuan-muted">
            <span>
              Dica: O algoritmo <strong>YIN + Dynamic Time Warping (DTW)</strong>{" "}
              normaliza automaticamente o timbre grave/agudo da sua voz para a
              escala tonal de Chao (1–5).
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => simulateVoiceAttempt("accurate")}
                className="px-3 py-1.5 rounded-xl bg-xuan-bg hover:bg-xuan-subtle border border-xuan-border text-[#3A6B59] font-semibold transition"
              >
                Simular Curva Correta (Teste DSP)
              </button>
              <button
                type="button"
                onClick={() => simulateVoiceAttempt("confused")}
                className="px-3 py-1.5 rounded-xl bg-xuan-bg hover:bg-xuan-subtle border border-xuan-border text-[#9C7A3C] font-semibold transition"
              >
                Simular Tom Trocado
              </button>
            </div>
          </div>

          {/* DTW Score & Diagnostic Feedback */}
          {evalResult && (
            <div
              className={`p-5 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-4 ${
                evalResult.overallScore >= 75
                  ? "bg-[#3A6B59]/10 border-[#3A6B59]/40"
                  : "bg-[#9C7A3C]/10 border-[#9C7A3C]/40"
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Award
                    className={`w-5 h-5 ${
                      evalResult.overallScore >= 75
                        ? "text-[#3A6B59]"
                        : "text-[#9C7A3C]"
                    }`}
                  />
                  <span className="text-lg font-serif font-bold text-xuan-ink">
                    Similaridade de Contorno Tonal:{" "}
                    <span
                      className={
                        evalResult.overallScore >= 75
                          ? "text-[#3A6B59]"
                          : "text-[#9C7A3C]"
                      }
                    >
                      {evalResult.overallScore}%
                    </span>
                  </span>
                  <span className="text-xs font-mono text-xuan-muted">
                    (DTW dist: {evalResult.dtwDistance} • Inclinação:{" "}
                    {evalResult.slopeCorrelation})
                  </span>
                </div>
                <p className="text-xs text-xuan-ink leading-relaxed">
                  {evalResult.feedbackPt}
                </p>
              </div>

              <button
                type="button"
                onClick={pickNextPair}
                className="px-5 py-2.5 rounded-xl bg-[#9E2A2B] hover:bg-[#7D2021] text-[#F5F2E9] font-bold text-xs shrink-0 transition"
              >
                Próxima Palavra →
              </button>
            </div>
          )}
        </div>
      ) : (
        /* SUBMODO B: Partner / Teacher Blind Evaluation Mode (Richard Feynman Method) */
        <div className="bg-xuan-card border border-xuan-border rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="border-b border-xuan-border pb-4">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#3A6B59] bg-[#3A6B59]/10 border border-[#3A6B59]/30 px-3 py-1 rounded-full">
              <Users className="w-3.5 h-3.5" />
              Modo Produção Oral Cega com Amigo / Professor (Inspirado no MaOrMa)
            </span>
            <h2 className="text-xl font-serif font-bold text-xuan-ink mt-2">
              Será que seu amigo entende qual par mínimo você disse sem contexto?
            </h2>
            <p className="text-xs text-xuan-muted mt-1">
              <strong>Passo 1:</strong> O falante olha a palavra secreta abaixo,
              depois clica em <em>“Ocultar Segredo”</em> e pronuncia a palavra em
              voz alta. <strong>Passo 2:</strong> O amigo/professor clica no card
              que ouviu!
            </p>
          </div>

          {/* Step 1: Secret Prompt Card for the Speaker */}
          <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            {speakerSecretVisible ? (
              <div className="space-y-1">
                <div className="text-xs text-amber-400 font-bold uppercase tracking-wider">
                  Segredo do Falante (Não mostre ao ouvinte!):
                </div>
                <div className="flex items-baseline gap-3">
                  <span className="text-3xl font-bold font-hanzi text-white">
                    {targetItem.hanzi}
                  </span>
                  <span className="text-2xl font-extrabold font-pinyin text-sky-400">
                    {targetItem.pinyin}
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    ({targetItem.meaningPt})
                  </span>
                </div>
              </div>
            ) : (
              <div className="py-2 text-sm text-emerald-300 font-semibold flex items-center gap-2">
                <EyeOff className="w-4 h-4" />
                Palavra-alvo oculta! Agora pronuncie em voz alta e peça para seu
                amigo clicar abaixo.
              </div>
            )}

            <div className="flex items-center gap-2">
              {speakerSecretVisible && (
                <button
                  type="button"
                  onClick={() =>
                    playLexicalItemAudio(
                      targetItem,
                      activeVoice,
                      activeSpeed,
                      audioManifest
                    )
                  }
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-300 text-xs font-semibold flex items-center gap-1.5"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  Ouvir Cola (Com Fone)
                </button>
              )}
              <button
                type="button"
                onClick={() => setSpeakerSecretVisible((v) => !v)}
                className="px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center gap-1.5"
              >
                {speakerSecretVisible ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5" />
                    Ocultar Segredo p/ Amigo
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5" />
                    Espiar Segredo
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Step 2: Listener Choice Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(["A", "B"] as const).map((side) => {
              const item =
                side === "A" ? currentPair.itemA : currentPair.itemB;
              const isTarget = partnerChoice && targetSide === side;
              const isWrong =
                partnerChoice && partnerChoice === side && targetSide !== side;

              return (
                <button
                  key={side}
                  type="button"
                  disabled={Boolean(partnerChoice)}
                  onClick={() => handlePartnerSelect(side)}
                  className={`p-6 rounded-2xl border-2 text-left transition ${
                    isTarget
                      ? "border-emerald-400 bg-emerald-500/15"
                      : isWrong
                      ? "border-rose-400 bg-rose-500/15"
                      : "border-slate-800 bg-slate-950/70 hover:border-sky-500/60"
                  }`}
                >
                  <div className="text-xs text-slate-400 font-mono mb-1">
                    Ouvinte: Clique se você ouviu a Opção {side}
                  </div>
                  <div className="text-3xl font-extrabold font-pinyin text-white">
                    {item.pinyin}
                  </div>
                  <div className="text-3xl font-hanzi text-sky-400 mt-1">
                    {item.hanzi}
                  </div>
                  <div className="text-xs text-slate-300 mt-2">
                    {item.meaningPt}
                  </div>
                </button>
              );
            })}
          </div>

          {partnerChoice && (
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div className="text-sm font-bold">
                {partnerChoice === targetSide ? (
                  <span className="text-emerald-400 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5" /> Comunicação Perfeita!
                    Seu amigo identificou exatamente {targetItem.pinyin} (
                    {targetItem.hanzi})!
                  </span>
                ) : (
                  <span className="text-rose-400 flex items-center gap-2">
                    <XCircle className="w-5 h-5" /> Mal-entendido Fonético! Você
                    tentou dizer {targetItem.pinyin}, mas seu amigo ouviu{" "}
                    {foilItem.pinyin}.
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={pickNextPair}
                className="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs"
              >
                Próxima Rodada →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
