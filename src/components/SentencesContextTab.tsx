"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  HelpCircle,
  RotateCcw,
  Volume2,
  XCircle,
} from "lucide-react";
import { SharedModuleProps } from "@/types/ui-props";
import {
  ContextualSentencePair,
  ProsodyToneSpottingItem,
  SentenceReconstructionItem,
  ToneNumber,
} from "@/types/phonetics";
import { playSentenceAudio, TONE_COLORS, VOICE_OPTIONS } from "@/lib/audio-engine";

type SentenceExerciseMode =
  | "contextual_minimal_pairs"
  | "prosody_tone_spotting"
  | "sentence_reconstruction";

export default function SentencesContextTab({
  profile,
  onRecordAttempt,
  sentencesDataset,
  activeVoice,
  setActiveVoice,
  activeSpeed,
  setActiveSpeed,
}: SharedModuleProps) {
  const [subMode, setSubMode] = useState<SentenceExerciseMode>(
    "contextual_minimal_pairs"
  );
  const [index, setIndex] = useState<number>(0);

  // Mode 1: Contextual Minimal Pairs state
  const [targetSide, setTargetSide] = useState<"A" | "B">("A");
  const [pairChoice, setPairChoice] = useState<"A" | "B" | null>(null);

  // Mode 2: Prosody Tone Spotting state
  const [spotTone1, setSpotTone1] = useState<ToneNumber>(1);
  const [spotTone2, setSpotTone2] = useState<ToneNumber>(1);
  const [spotSubmitted, setSpotSubmitted] = useState<boolean>(false);

  // Mode 3: Sentence Reconstruction state
  const [selectedBlocks, setSelectedBlocks] = useState<string[]>([]);
  const [reconSubmitted, setReconSubmitted] = useState<boolean>(false);

  const [showHint, setShowHint] = useState<boolean>(false);
  const [stats, setStats] = useState({ total: 0, correct: 0 });
  const startTimeRef = useRef<number>(Date.now());
  const useTraditional = profile.preferredScript === "traditional";

  const contextualList: ContextualSentencePair[] = useMemo(
    () => sentencesDataset?.contextualPairs || [],
    [sentencesDataset]
  );
  const spottingList: ProsodyToneSpottingItem[] = useMemo(
    () => sentencesDataset?.prosodySpotting || [],
    [sentencesDataset]
  );
  const reconList: SentenceReconstructionItem[] = useMemo(
    () => sentencesDataset?.sentenceReconstructions || [],
    [sentencesDataset]
  );

  const currentContextual = contextualList[index % Math.max(1, contextualList.length)];
  const currentSpotting = spottingList[index % Math.max(1, spottingList.length)];
  const currentRecon = reconList[index % Math.max(1, reconList.length)];

  // Shuffled blocks for Mode 3
  const shuffledBlocks = useMemo(() => {
    if (!currentRecon) return [];
    const combined = [
      ...currentRecon.correctBlocks,
      ...currentRecon.distractorBlocks,
    ];
    // Deterministic shuffle per question id
    return combined
      .map((b, i) => ({
        b,
        sortKey: ((i + 1) * 37 + currentRecon.id.charCodeAt(currentRecon.id.length - 1)) % 101,
      }))
      .sort((a, b) => a.sortKey - b.sortKey)
      .map((x) => x.b);
  }, [currentRecon]);

  const playCurrentSentence = useCallback(async () => {
    if (subMode === "contextual_minimal_pairs" && currentContextual) {
      const sText =
        targetSide === "A"
          ? currentContextual.sentenceA
          : currentContextual.sentenceB;
      const sPin =
        targetSide === "A"
          ? currentContextual.pinyinA
          : currentContextual.pinyinB;
      const sKey =
        targetSide === "A"
          ? currentContextual.audioKeyA
          : currentContextual.audioKeyB;
      await playSentenceAudio(sText, sPin, activeVoice, activeSpeed, sKey);
    } else if (subMode === "prosody_tone_spotting" && currentSpotting) {
      await playSentenceAudio(
        currentSpotting.sentence,
        currentSpotting.pinyin,
        activeVoice,
        activeSpeed,
        currentSpotting.audioKey
      );
    } else if (subMode === "sentence_reconstruction" && currentRecon) {
      await playSentenceAudio(
        currentRecon.sentence,
        currentRecon.pinyin,
        activeVoice,
        activeSpeed,
        currentRecon.audioKey
      );
    }
  }, [
    subMode,
    currentContextual,
    targetSide,
    activeVoice,
    activeSpeed,
    currentSpotting,
    currentRecon,
  ]);

  useEffect(() => {
    startTimeRef.current = Date.now();
    const tid = setTimeout(() => {
      playCurrentSentence();
    }, 120);
    return () => clearTimeout(tid);
  }, [index, subMode, playCurrentSentence]);

  const handleNext = useCallback(() => {
    setPairChoice(null);
    setSpotSubmitted(false);
    setSelectedBlocks([]);
    setReconSubmitted(false);
    setShowHint(false);
    setTargetSide(Math.random() < 0.5 ? "A" : "B");
    setIndex((prev) => prev + 1);
  }, []);

  // Mode 1 Answer Handler
  const handleSelectPairChoice = (choice: "A" | "B") => {
    if (pairChoice !== null || !currentContextual) return;
    const reactionMs = Math.max(250, Date.now() - startTimeRef.current);
    const isCorrect = choice === targetSide;
    setPairChoice(choice);
    setStats((s) => ({ total: s.total + 1, correct: s.correct + (isCorrect ? 1 : 0) }));

    onRecordAttempt({
      mode: "context_sentences",
      category: "context_sentence",
      subCategory: currentContextual.subCategory,
      targetId: currentContextual.id,
      expectedToneOrLabel:
        targetSide === "A"
          ? currentContextual.targetWordA
          : currentContextual.targetWordB,
      userSelectedToneOrLabel:
        choice === "A"
          ? currentContextual.targetWordA
          : currentContextual.targetWordB,
      correct: isCorrect,
      reactionTimeMs: reactionMs,
      speedUsed: activeSpeed,
      voiceUsed: activeVoice,
    });
  };

  // Mode 2 Submit Handler
  const handleSubmitSpotTones = () => {
    if (spotSubmitted || !currentSpotting) return;
    const reactionMs = Math.max(300, Date.now() - startTimeRef.current);
    const exp1 = currentSpotting.targetTones[0] || 1;
    const exp2 = currentSpotting.targetTones[1] || 1;
    const isCorrect = spotTone1 === exp1 && spotTone2 === exp2;
    setSpotSubmitted(true);
    setStats((s) => ({ total: s.total + 1, correct: s.correct + (isCorrect ? 1 : 0) }));

    onRecordAttempt(
      {
        mode: "prosody_spotting",
        category: "context_sentence",
        subCategory: `T${exp1}+T${exp2}`,
        targetId: currentSpotting.id,
        expectedToneOrLabel: `T${exp1}+T${exp2}`,
        userSelectedToneOrLabel: `T${spotTone1}+T${spotTone2}`,
        correct: isCorrect,
        reactionTimeMs: reactionMs,
        speedUsed: activeSpeed,
        voiceUsed: activeVoice,
      },
      [exp1, exp2],
      [spotTone1, spotTone2]
    );
  };

  // Mode 3 Submit Handler
  const handleSubmitReconstruction = () => {
    if (reconSubmitted || !currentRecon) return;
    const reactionMs = Math.max(400, Date.now() - startTimeRef.current);
    const userJoined = selectedBlocks.join("");
    const expectedJoined = currentRecon.correctBlocks.join("");
    const isCorrect = userJoined === expectedJoined;
    setReconSubmitted(true);
    setStats((s) => ({ total: s.total + 1, correct: s.correct + (isCorrect ? 1 : 0) }));

    onRecordAttempt({
      mode: "sentence_reconstruction",
      category: "context_sentence",
      subCategory: "prosody_segmentation",
      targetId: currentRecon.id,
      expectedToneOrLabel: expectedJoined,
      userSelectedToneOrLabel: userJoined,
      correct: isCorrect,
      reactionTimeMs: reactionMs,
      speedUsed: activeSpeed,
      voiceUsed: activeVoice,
    });
  };

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const k = e.key.toLowerCase();
      if (k === "r" || k === " ") {
        e.preventDefault();
        playCurrentSentence();
      } else if (k === "s") {
        e.preventDefault();
        setActiveSpeed(activeSpeed === "classroom" ? "conversational" : "classroom");
      } else if (k === "v") {
        e.preventDefault();
        const idx = VOICE_OPTIONS.findIndex((v) => v.id === activeVoice);
        setActiveVoice(VOICE_OPTIONS[(idx + 1) % VOICE_OPTIONS.length].id);
      } else if (k === "h") {
        e.preventDefault();
        setShowHint((h) => !h);
      } else if (
        subMode === "contextual_minimal_pairs" &&
        pairChoice === null &&
        (k === "a" || k === "1")
      ) {
        handleSelectPairChoice("A");
      } else if (
        subMode === "contextual_minimal_pairs" &&
        pairChoice === null &&
        (k === "b" || k === "2")
      ) {
        handleSelectPairChoice("B");
      } else if (
        e.key === "Enter" &&
        (pairChoice !== null || spotSubmitted || reconSubmitted)
      ) {
        e.preventDefault();
        handleNext();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!sentencesDataset) {
    return (
      <div className="p-8 text-center text-sm text-xuan-muted">
        Carregando acervo de frases inteiras (整句听力)...
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Seletor Limpo dos 3 Modos de Frases Inteiras */}
      <section className="p-4 rounded-xl bg-xuan-card border border-xuan-border flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => {
              setSubMode("contextual_minimal_pairs");
              handleNext();
            }}
            className={`px-3.5 py-2 rounded-lg text-xs font-serif font-bold transition ${
              subMode === "contextual_minimal_pairs"
                ? "bg-[#9E2A2B] text-[#F5F2E9]"
                : "bg-xuan-bg text-xuan-muted hover:text-xuan-ink border border-xuan-border"
            }`}
          >
            1. Pares Mínimos em Sentenças ({contextualList.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setSubMode("prosody_tone_spotting");
              handleNext();
            }}
            className={`px-3.5 py-2 rounded-lg text-xs font-serif font-bold transition ${
              subMode === "prosody_tone_spotting"
                ? "bg-[#9E2A2B] text-[#F5F2E9]"
                : "bg-xuan-bg text-xuan-muted hover:text-xuan-ink border border-xuan-border"
            }`}
          >
            2. Caça-Tom em Frase Contínua ({spottingList.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setSubMode("sentence_reconstruction");
              handleNext();
            }}
            className={`px-3.5 py-2 rounded-lg text-xs font-serif font-bold transition ${
              subMode === "sentence_reconstruction"
                ? "bg-[#9E2A2B] text-[#F5F2E9]"
                : "bg-xuan-bg text-xuan-muted hover:text-xuan-ink border border-xuan-border"
            }`}
          >
            3. Reconstrução Auditiva ({reconList.length})
          </button>
        </div>

        <div className="text-xs font-mono text-xuan-muted">
          Precisão em Frases:{" "}
          <strong className="text-[#3A6B59]">
            {stats.correct}/{stats.total}
          </strong>
        </div>
      </section>

      {/* PAINEL CENTRAL DE ESCUTA DE FRASE INTEIRA */}
      <section className="p-8 rounded-xl bg-xuan-card border border-xuan-border text-center space-y-7">
        {/* Botão Selo Central para Ouvir a Frase */}
        <div className="flex flex-col items-center space-y-3">
          <button
            type="button"
            onClick={playCurrentSentence}
            className="w-24 h-24 rounded-full border-2 border-[#9E2A2B] bg-xuan-bg hover:bg-[#9E2A2B] text-[#9E2A2B] hover:text-[#F5F2E9] flex flex-col items-center justify-center transition shadow-xs cursor-pointer"
          >
            <span className="font-serif text-xl font-bold">整句</span>
            <Volume2 className="w-5 h-5 mt-0.5" />
            <span className="text-[10px] uppercase tracking-wider mt-0.5">
              Ouvir Frase
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
              Velocidade:{" "}
              <strong className="text-xuan-ink">
                {activeSpeed === "classroom" ? "Classroom (-25%)" : "Nativa (100%)"}
              </strong>
            </span>
            <button
              type="button"
              onClick={() => setShowHint((h) => !h)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-xuan-border hover:bg-xuan-subtle text-[11px]"
            >
              <HelpCircle className="w-3 h-3" />
              Dica [H]
            </button>
          </div>
        </div>

        {/* ================================================================= */}
        {/* MODO 1: PARES MÍNIMOS EM SENTENÇAS COMPLETAS                      */}
        {/* ================================================================= */}
        {subMode === "contextual_minimal_pairs" && currentContextual && (
          <div className="space-y-6">
            {showHint && pairChoice === null && (
              <p className="text-xs text-[#9C7A3C] bg-xuan-bg p-3 rounded-lg border border-[#9C7A3C]/40">
                {currentContextual.tipPt}
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(["A", "B"] as const).map((side) => {
                const isTarget = targetSide === side;
                const isChosen = pairChoice === side;
                const sentHanzi =
                  side === "A"
                    ? useTraditional
                      ? currentContextual.traditionalA
                      : currentContextual.sentenceA
                    : useTraditional
                    ? currentContextual.traditionalB
                    : currentContextual.sentenceB;
                const kwPinyin =
                  side === "A"
                    ? currentContextual.targetPinyinA
                    : currentContextual.targetPinyinB;
                const meaningPt =
                  side === "A"
                    ? currentContextual.meaningPtA
                    : currentContextual.meaningPtB;

                let style = "border-xuan-border bg-xuan-bg hover:border-[#9E2A2B]";
                if (pairChoice !== null) {
                  if (isTarget) style = "border-2 border-[#3A6B59] bg-[#3A6B59]/10";
                  else if (isChosen) style = "border-2 border-[#9E2A2B] bg-[#9E2A2B]/10";
                  else style = "border-xuan-border bg-xuan-bg opacity-65";
                }

                return (
                  <button
                    key={side}
                    type="button"
                    disabled={pairChoice !== null}
                    onClick={() => handleSelectPairChoice(side)}
                    className={`p-5 rounded-xl border text-left transition flex flex-col justify-between space-y-3 ${style}`}
                  >
                    <div className="flex items-center justify-between text-xs text-xuan-muted font-mono">
                      <span>Sentença [{side}]</span>
                      <span className="font-pinyin font-bold text-[#9E2A2B] text-sm">
                        {kwPinyin}
                      </span>
                    </div>

                    <p className="font-hanzi text-lg font-semibold text-xuan-ink leading-relaxed">
                      {sentHanzi}
                    </p>

                    <p className="text-xs text-xuan-muted">{meaningPt}</p>
                  </button>
                );
              })}
            </div>

            {pairChoice !== null && (
              <div className="pt-4 border-t border-xuan-border text-left space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {pairChoice === targetSide ? (
                      <CheckCircle2 className="w-5 h-5 text-[#3A6B59]" />
                    ) : (
                      <XCircle className="w-5 h-5 text-[#9E2A2B]" />
                    )}
                    <span className="font-serif font-bold text-sm">
                      {pairChoice === targetSide
                        ? "Sentença identificada com precisão!"
                        : `A sentença pronunciada foi a [${targetSide}].`}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleNext}
                    className="px-4 py-2 rounded-lg bg-[#9E2A2B] hover:bg-[#7D2021] text-[#F5F2E9] text-xs font-serif font-bold flex items-center gap-1.5"
                  >
                    <span>Próxima Frase [Enter]</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-xuan-bg border border-xuan-border flex items-center justify-between gap-2">
                    <div>
                      <div className="font-pinyin font-bold text-xuan-ink">
                        {currentContextual.pinyinA}
                      </div>
                      <div className="text-xuan-muted mt-0.5">
                        {currentContextual.meaningPtA}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        playSentenceAudio(
                          currentContextual.sentenceA,
                          currentContextual.pinyinA,
                          activeVoice,
                          activeSpeed,
                          currentContextual.audioKeyA
                        )
                      }
                      className="px-2.5 py-1.5 rounded border border-xuan-border hover:border-[#9E2A2B] shrink-0 font-semibold"
                    >
                      Ouvir A
                    </button>
                  </div>

                  <div className="p-3 rounded-lg bg-xuan-bg border border-xuan-border flex items-center justify-between gap-2">
                    <div>
                      <div className="font-pinyin font-bold text-xuan-ink">
                        {currentContextual.pinyinB}
                      </div>
                      <div className="text-xuan-muted mt-0.5">
                        {currentContextual.meaningPtB}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        playSentenceAudio(
                          currentContextual.sentenceB,
                          currentContextual.pinyinB,
                          activeVoice,
                          activeSpeed,
                          currentContextual.audioKeyB
                        )
                      }
                      className="px-2.5 py-1.5 rounded border border-xuan-border hover:border-[#9E2A2B] shrink-0 font-semibold"
                    >
                      Ouvir B
                    </button>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-xuan-bg border border-xuan-border text-xs text-xuan-muted">
                  <strong className="text-xuan-ink font-serif">Análise Prosódica: </strong>
                  {currentContextual.tipPt}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* MODO 2: CAÇA-TOM EM FRASE CONTÍNUA (Prosody & Tone Spotting)      */}
        {/* ================================================================= */}
        {subMode === "prosody_tone_spotting" && currentSpotting && (
          <div className="space-y-6">
            <div className="p-5 rounded-xl bg-xuan-bg border border-xuan-border space-y-2">
              <div className="text-xs text-xuan-muted">
                Ouça a frase inteira e identifique os tons exatos da palavra destacada:
              </div>
              <p className="font-hanzi text-2xl font-bold text-xuan-ink tracking-wide">
                {(useTraditional
                  ? currentSpotting.traditional
                  : currentSpotting.sentence
                )
                  .split(currentSpotting.targetWord)
                  .map((part, i, arr) => (
                    <React.Fragment key={i}>
                      {part}
                      {i < arr.length - 1 && (
                        <span className="px-2 py-0.5 mx-1 rounded bg-[#9E2A2B]/15 text-[#9E2A2B] underline decoration-2">
                          {currentSpotting.targetWord}
                        </span>
                      )}
                    </React.Fragment>
                  ))}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mx-auto">
              {/* 1ª Sílaba */}
              <div className="p-4 rounded-xl bg-xuan-bg border border-xuan-border space-y-2">
                <div className="text-xs font-semibold text-xuan-muted">
                  1ª Sílaba de “{currentSpotting.targetWord}”
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {([1, 2, 3, 4, 5] as ToneNumber[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      disabled={spotSubmitted}
                      onClick={() => setSpotTone1(t)}
                      className={`py-2 rounded-md border text-xs font-bold transition ${
                        spotTone1 === t
                          ? "bg-[#9E2A2B] text-[#F5F2E9] border-[#9E2A2B]"
                          : "bg-xuan-card border-xuan-border text-xuan-ink"
                      }`}
                    >
                      T{t}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2ª Sílaba */}
              <div className="p-4 rounded-xl bg-xuan-bg border border-xuan-border space-y-2">
                <div className="text-xs font-semibold text-xuan-muted">
                  2ª Sílaba de “{currentSpotting.targetWord}”
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {([1, 2, 3, 4, 5] as ToneNumber[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      disabled={spotSubmitted}
                      onClick={() => setSpotTone2(t)}
                      className={`py-2 rounded-md border text-xs font-bold transition ${
                        spotTone2 === t
                          ? "bg-[#9E2A2B] text-[#F5F2E9] border-[#9E2A2B]"
                          : "bg-xuan-card border-xuan-border text-xuan-ink"
                      }`}
                    >
                      T{t}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {!spotSubmitted ? (
              <button
                type="button"
                onClick={handleSubmitSpotTones}
                className="px-6 py-2.5 rounded-lg bg-[#9E2A2B] hover:bg-[#7D2021] text-[#F5F2E9] font-serif font-bold text-sm transition"
              >
                Confirmar Combinação T{spotTone1} + T{spotTone2}
              </button>
            ) : (
              <div className="pt-4 border-t border-xuan-border text-left space-y-3">
                <div className="flex items-center justify-between">
                  <span
                    className={`font-serif font-bold text-sm ${
                      spotTone1 === currentSpotting.targetTones[0] &&
                      spotTone2 === currentSpotting.targetTones[1]
                        ? "text-[#3A6B59]"
                        : "text-[#9E2A2B]"
                    }`}
                  >
                    Gabarito: {currentSpotting.targetWord} ({currentSpotting.targetPinyin}) = T
                    {currentSpotting.targetTones[0]}+T{currentSpotting.targetTones[1]}
                  </span>
                  <button
                    type="button"
                    onClick={handleNext}
                    className="px-4 py-2 rounded-lg bg-[#9E2A2B] text-[#F5F2E9] text-xs font-serif font-bold flex items-center gap-1.5"
                  >
                    <span>Próxima Frase</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="p-3 rounded-lg bg-xuan-bg border border-xuan-border text-xs space-y-1">
                  <div className="font-pinyin font-bold text-xuan-ink">
                    {currentSpotting.pinyin}
                  </div>
                  <div className="text-xuan-muted">{currentSpotting.meaningPt}</div>
                  <div className="text-[#9C7A3C] pt-1">{currentSpotting.tipPt}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* MODO 3: RECONSTRUÇÃO AUDITIVA DE FRASE                            */}
        {/* ================================================================= */}
        {subMode === "sentence_reconstruction" && currentRecon && (
          <div className="space-y-6">
            <div className="text-xs text-xuan-muted">
              Ouça a frase (sem texto) e clique nos blocos fonéticos na ordem exata em que foram ditos:
            </div>

            {/* Área de Montagem da Frase */}
            <div className="min-h-[64px] p-4 rounded-xl bg-xuan-bg border-2 border-dashed border-xuan-border flex flex-wrap items-center justify-center gap-2">
              {selectedBlocks.length === 0 ? (
                <span className="text-xs text-xuan-muted italic">
                  Clique nos blocos abaixo para reconstruir a frase ouvida...
                </span>
              ) : (
                selectedBlocks.map((blk, i) => (
                  <button
                    key={`${blk}_${i}`}
                    type="button"
                    disabled={reconSubmitted}
                    onClick={() =>
                      setSelectedBlocks((prev) => prev.filter((_, idx) => idx !== i))
                    }
                    className="px-3.5 py-2 rounded-lg bg-[#9E2A2B] text-[#F5F2E9] font-hanzi font-bold text-base shadow-xs"
                  >
                    {blk}
                  </button>
                ))
              )}
            </div>

            {/* Banco de Blocos com Distratores de Pares Mínimos */}
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              {shuffledBlocks.map((blk, i) => (
                <button
                  key={`${blk}_pool_${i}`}
                  type="button"
                  disabled={reconSubmitted}
                  onClick={() => setSelectedBlocks((prev) => [...prev, blk])}
                  className="px-4 py-2 rounded-lg bg-xuan-bg hover:bg-xuan-subtle border border-xuan-border font-hanzi text-base font-semibold text-xuan-ink transition"
                >
                  {blk}
                </button>
              ))}
            </div>

            {!reconSubmitted ? (
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedBlocks([])}
                  className="px-4 py-2 rounded-lg border border-xuan-border text-xs font-semibold text-xuan-muted hover:text-xuan-ink flex items-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Limpar
                </button>
                <button
                  type="button"
                  disabled={selectedBlocks.length === 0}
                  onClick={handleSubmitReconstruction}
                  className="px-6 py-2 rounded-lg bg-[#9E2A2B] hover:bg-[#7D2021] disabled:opacity-40 text-[#F5F2E9] font-serif font-bold text-xs transition"
                >
                  Verificar Transcrição
                </button>
              </div>
            ) : (
              <div className="pt-4 border-t border-xuan-border text-left space-y-3">
                <div className="flex items-center justify-between">
                  <span
                    className={`font-serif font-bold text-sm ${
                      selectedBlocks.join("") === currentRecon.correctBlocks.join("")
                        ? "text-[#3A6B59]"
                        : "text-[#9E2A2B]"
                    }`}
                  >
                    Frase Original: {currentRecon.sentence}
                  </span>
                  <button
                    type="button"
                    onClick={handleNext}
                    className="px-4 py-2 rounded-lg bg-[#9E2A2B] text-[#F5F2E9] text-xs font-serif font-bold flex items-center gap-1.5"
                  >
                    <span>Próxima Frase</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="p-3 rounded-lg bg-xuan-bg border border-xuan-border text-xs space-y-1">
                  <div className="font-pinyin font-bold text-xuan-ink">
                    {currentRecon.pinyin}
                  </div>
                  <div className="text-xuan-muted">{currentRecon.meaningPt}</div>
                  <div className="text-[#9C7A3C] pt-1">{currentRecon.tipPt}</div>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
