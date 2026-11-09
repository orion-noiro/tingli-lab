"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Volume2,
  RotateCw,
  Repeat,
  ArrowRightLeft,
  Sparkles,
  BookOpen,
  HelpCircle,
  Play,
  Pause,
  ExternalLink,
  ChevronRight,
  Info,
  Sliders,
  CheckCircle2,
  XCircle,
  Lightbulb,
  Headphones,
  Search,
} from "lucide-react";
import { SharedModuleProps } from "@/types/ui-props";
import {
  LexicalItem,
  MinimalPairEntry,
  ToneSandhiRule,
  ToneSandhiExample,
  SoundGuideSection,
  SpeechSpeed,
  VoiceId,
  ToneNumber,
  MinimalPairCategory,
} from "@/types/phonetics";
import {
  TONE_COLORS,
  TONE_LABELS_PT,
  VOICE_OPTIONS,
  playLexicalItemAudio,
  stopAllAudio,
  generateTheoreticalChaoContour,
} from "@/lib/audio-engine";
import PitchContourCanvas from "./PitchContourCanvas";
import HanziStrokeModal from "./HanziStrokeModal";

// ============================================================================
// CANONICAL FALLBACK DATA (Guarantees full functionality even before ingestion)
// ============================================================================

const DEFAULT_SANDHI_RULES: ToneSandhiRule[] = [
  {
    id: "sandhi_t3_t3",
    category: "third_tone_sandhi",
    titlePt: "Regra T3 + T3 → T2 + T3 (Dois Terceiros Tons Consecutivos)",
    titleEn: "T3 + T3 → T2 + T3 Sandhi (Two Consecutive Third Tones)",
    formula: "T3 (214) + T3 (214)  ➔  T2 (35) + T3 (214)",
    summaryPt:
      "Quando duas sílabas em 3º Tom ocorrem em sequência, a primeira muda automaticamente para 2º Tom (35 ascendente), enquanto a segunda mantém o 3º Tom completo ou baixo.",
    summaryEn:
      "When two 3rd tones appear consecutively, the first changes to a 2nd tone (35 rising), while the second keeps its 3rd tone.",
    acousticMechanicPt:
      "O 3º Tom original exige descida extrema à laringe [214]. Pronunciar dois mergulhos seguidos exige tempo excessivo e gera cansaço muscular. O aparelho fonador suaviza o primeiro para um tom ascendente fluido [35]. No Pinyin de dicionário a grafia é mantida com diacrítico de 3º tom, mas o som real de superfície é sempre 2º tom!",
    acousticMechanicEn:
      "The full 3rd tone requires dipping deep into the vocal fry [214]. Two dips back-to-back causes muscular fatigue. The vocal tract smooths the first into a rising 2nd tone [35]. Dictionaries keep the underlying 3rd tone mark, but surface speech is 2nd tone.",
    examples: [
      {
        id: "nihao",
        hanzi: "你好",
        traditional: "你好",
        underlyingPinyin: "nǐ hǎo [214 + 214]",
        surfacePinyin: "ní hǎo [35 + 214]",
        underlyingTones: [3, 3],
        surfaceTones: "T2 (35) + T3 (214)",
        underlyingChao: "214-214",
        surfaceChao: "35-214",
        ipaSurface: "/ni˧˥ xaʊ˨˩˦/",
        meaningPt: "Olá / Tudo bem?",
        meaningEn: "Hello / How are you?",
        explanationPt:
          "O clássico 'Nǐ hǎo'! Você nunca diz nǐ...hǎo mergulhando duas vezes. A fala natural sempre produz 'Ní hǎo'.",
        explanationEn: "The classic 'Nǐ hǎo'! Native speech always produces 'Ní hǎo'.",
        audioKeyClassroom: "/audio/words/xiaoxiao/classroom/ni3_hao3.mp3",
        audioKeyConversational: "/audio/words/xiaoxiao/conversational/ni3_hao3.mp3",
        f0ContourUnderlying: generateTheoreticalChaoContour([3, 3], false),
        f0ContourSurface: generateTheoreticalChaoContour([3, 3], true),
      },
      {
        id: "shuiguo",
        hanzi: "水果",
        traditional: "水果",
        underlyingPinyin: "shuǐ guǒ [214 + 214]",
        surfacePinyin: "shuí guǒ [35 + 214]",
        underlyingTones: [3, 3],
        surfaceTones: "T2 (35) + T3 (214)",
        underlyingChao: "214-214",
        surfaceChao: "35-214",
        ipaSurface: "/ʂweɪ˧˥ kwɔ˨˩˦/",
        meaningPt: "Fruta",
        meaningEn: "Fruit",
        explanationPt:
          "Tanto shuǐ quanto guǒ são 3º Tom isolados. Juntos, soa exatamente idêntico a 'shuí' (quem) + 'guǒ'.",
        explanationEn: "Both are 3rd tones in isolation. Together it sounds like 'shuí' + 'guǒ'.",
        audioKeyClassroom: "/audio/words/xiaoxiao/classroom/shui3_guo3.mp3",
        audioKeyConversational: "/audio/words/xiaoxiao/conversational/shui3_guo3.mp3",
        f0ContourUnderlying: generateTheoreticalChaoContour([3, 3], false),
        f0ContourSurface: generateTheoreticalChaoContour([3, 3], true),
      },
      {
        id: "kaorou",
        hanzi: "手表",
        traditional: "手錶",
        underlyingPinyin: "shǒu biǎo [214 + 214]",
        surfacePinyin: "shóu biǎo [35 + 214]",
        underlyingTones: [3, 3],
        surfaceTones: "T2 (35) + T3 (214)",
        underlyingChao: "214-214",
        surfaceChao: "35-214",
        ipaSurface: "/ʂoʊ˧˥ bjaʊ˨˩˦/",
        meaningPt: "Relógio de pulso",
        meaningEn: "Wristwatch",
        explanationPt: "shǒu (mão) + biǎo (medidor). shǒu sobe suavemente em 35.",
        explanationEn: "shǒu (hand) + biǎo (meter). shǒu rises smoothly in 35.",
        audioKeyClassroom: "/audio/words/xiaoxiao/classroom/shou3_biao3.mp3",
        audioKeyConversational: "/audio/words/xiaoxiao/conversational/shou3_biao3.mp3",
        f0ContourUnderlying: generateTheoreticalChaoContour([3, 3], false),
        f0ContourSurface: generateTheoreticalChaoContour([3, 3], true),
      },
    ],
  },
  {
    id: "sandhi_half_t3",
    category: "half_third_tone",
    titlePt: "Meio 3º Tom (Half-Third Tone [21]) Diante de T1, T2, T4 e Neutro",
    titleEn: "Half-Third Tone [21] before T1, T2, T4 and Neutral",
    formula: "T3 (214) + [T1 / T2 / T4 / Neutro]  ➔  Meio-T3 (21) + Outro Tom",
    summaryPt:
      "Na vida real, mais de 80% dos 3º tons NÃO sobem no final! Se um 3º Tom for seguido de qualquer outro tom (exceto outro T3), ele apenas mergulha para a faixa grave [21] e não sobe.",
    summaryEn:
      "In real speech, over 80% of 3rd tones do NOT rise at the end! They merely drop to low pitch [21].",
    acousticMechanicPt:
      "O 'rabo' ascendente do 3º Tom [..4] só ocorre quando a sílaba é dita isolada ou no final absoluto da frase. Quando há outra sílaba em seguida, a corda vocal se prepara para a próxima altura sem gastar tempo subindo.",
    acousticMechanicEn:
      "The rising tail [..4] only appears when spoken in isolation or at phrase end. In connected speech, it stays low [21].",
    examples: [
      {
        id: "beijing",
        hanzi: "北京",
        traditional: "北京",
        underlyingPinyin: "běi jīng [214 + 55]",
        surfacePinyin: "běi jīng [21 + 55]",
        underlyingTones: [3, 1],
        surfaceTones: "Half-T3 (21) + T1 (55)",
        underlyingChao: "214-55",
        surfaceChao: "21-55",
        ipaSurface: "/beɪ˨˩ t͡ɕiŋ˥˥/",
        meaningPt: "Pequim (Capital da China)",
        meaningEn: "Beijing (Capital)",
        explanationPt: "Běi não faz a curva para cima; ele mergulha bem grave e joga direto no agudo 55 de Jīng.",
        explanationEn: "Běi dips low [21] and jumps straight to the high level 55 of Jīng.",
        audioKeyClassroom: "/audio/words/xiaoxiao/classroom/bei3_jing1.mp3",
        audioKeyConversational: "/audio/words/xiaoxiao/conversational/bei3_jing1.mp3",
        f0ContourUnderlying: generateTheoreticalChaoContour([3, 1], false),
        f0ContourSurface: generateTheoreticalChaoContour([3, 1], true),
      },
      {
        id: "jiandan",
        hanzi: "简单",
        traditional: "簡單",
        underlyingPinyin: "jiǎn dān [214 + 55]",
        surfacePinyin: "jiǎn dān [21 + 55]",
        underlyingTones: [3, 1],
        surfaceTones: "Half-T3 (21) + T1 (55)",
        underlyingChao: "214-55",
        surfaceChao: "21-55",
        ipaSurface: "/t͡ɕjɛn˨˩ tan˥˥/",
        meaningPt: "Simples / Fácil",
        meaningEn: "Simple / Easy",
        explanationPt: "jiǎn fica firme no registro grave antes de soltar dān no tom alto nivelado.",
        explanationEn: "jiǎn stays in the low register before launching dān high.",
        audioKeyClassroom: "/audio/words/xiaoxiao/classroom/jian3_dan1.mp3",
        audioKeyConversational: "/audio/words/xiaoxiao/conversational/jian3_dan1.mp3",
        f0ContourUnderlying: generateTheoreticalChaoContour([3, 1], false),
        f0ContourSurface: generateTheoreticalChaoContour([3, 1], true),
      },
    ],
  },
  {
    id: "sandhi_bu",
    category: "bu_sandhi",
    titlePt: "Sandhi da Negação 不 (bù → bú diante de 4º Tom)",
    titleEn: "Sandhi of Negative 不 (bù → bú before 4th Tone)",
    formula: "不 bù (51) + 4º Tom (51)  ➔  bú (35) + 4º Tom (51)",
    summaryPt:
      "A palavra 不 (bù) tem 4º Tom (51) original. Porém, quando vem imediatamente antes de outro 4º Tom, ela se transforma obrigatoriamente no 2º Tom ascendente (bú).",
    summaryEn:
      "不 (bù) is inherently 4th tone (51). When followed by another 4th tone, it changes to 2nd tone bú (35).",
    acousticMechanicPt:
      "Pronunciar dois 4º tons rápidos seguidos [51 + 51] soaria excessivamente cortado e abrupto. A transformação em [35 + 51] cria um balanço acústico natural de subida e descida harmônica.",
    acousticMechanicEn:
      "Two consecutive 51 drops sound jarring. Converting to 35 + 51 creates a melodic rise-then-fall cadence.",
    examples: [
      {
        id: "bushi",
        hanzi: "不是",
        traditional: "不是",
        underlyingPinyin: "bù shì [51 + 51]",
        surfacePinyin: "bú shì [35 + 51]",
        underlyingTones: [4, 4],
        surfaceTones: "T2 (35) + T4 (51)",
        underlyingChao: "51-51",
        surfaceChao: "35-51",
        ipaSurface: "/pu˧˥ ʂʐ̩˥˩/",
        meaningPt: "Não é / Não ser",
        meaningEn: "Is not / No",
        explanationPt: "shì é 4º Tom. Portanto, 不 muda para o 2º tom ascendente bú!",
        explanationEn: "shì is 4th tone, so bù becomes 2nd tone bú!",
        audioKeyClassroom: "/audio/words/xiaoxiao/classroom/bu4_shi4.mp3",
        audioKeyConversational: "/audio/words/xiaoxiao/conversational/bu4_shi4.mp3",
        f0ContourUnderlying: generateTheoreticalChaoContour([4, 4], false),
        f0ContourSurface: generateTheoreticalChaoContour([2, 4], false),
      },
      {
        id: "budui",
        hanzi: "不对",
        traditional: "不對",
        underlyingPinyin: "bù duì [51 + 51]",
        surfacePinyin: "bú duì [35 + 51]",
        underlyingTones: [4, 4],
        surfaceTones: "T2 (35) + T4 (51)",
        underlyingChao: "51-51",
        surfaceChao: "35-51",
        ipaSurface: "/pu˧˥ tweɪ˥˩/",
        meaningPt: "Incorreto / Errado",
        meaningEn: "Incorrect / Wrong",
        explanationPt: "duì é 4º tom. 'Bú duì' soa fluido e natural.",
        explanationEn: "duì is 4th tone, yielding 'bú duì'.",
        audioKeyClassroom: "/audio/words/xiaoxiao/classroom/bu4_dui4.mp3",
        audioKeyConversational: "/audio/words/xiaoxiao/conversational/bu4_dui4.mp3",
        f0ContourUnderlying: generateTheoreticalChaoContour([4, 4], false),
        f0ContourSurface: generateTheoreticalChaoContour([2, 4], false),
      },
    ],
  },
  {
    id: "sandhi_yi",
    category: "yi_sandhi",
    titlePt: "Sandhi do Numeral 一 (yī → yí diante de T4 / yì diante de T1, T2, T3)",
    titleEn: "Sandhi of Numeral 一 (yī → yí before T4 / yì before T1, T2, T3)",
    formula: "一 yī (55) ➔ yí (35) antes de T4 | yì (51) antes de T1, T2, T3",
    summaryPt:
      "O número 一 isolado ou ao contar é 1º Tom (yī 55). Diante de 4º Tom vira 2º Tom (yí). Diante de 1º, 2º ou 3º Tom vira 4º Tom (yì)!",
    summaryEn:
      "一 alone is 1st tone (yī 55). Before 4th tone it becomes yí (35). Before 1st, 2nd, or 3rd tone it becomes yì (51).",
    acousticMechanicPt:
      "Este é o camaleão tonal do mandarim! O tom 1 alto nivelado é o que mais sofre efeito de dissimilação com o tom da palavra seguinte.",
    acousticMechanicEn:
      "The ultimate tonal chameleon of Mandarin, maximizing acoustic contrast with the subsequent syllable.",
    examples: [
      {
        id: "yige",
        hanzi: "一个",
        traditional: "一個",
        underlyingPinyin: "yī gè [55 + 51]",
        surfacePinyin: "yí gè [35 + 51]",
        underlyingTones: [1, 4],
        surfaceTones: "T2 (35) + T4 (51)",
        underlyingChao: "55-51",
        surfaceChao: "35-51",
        ipaSurface: "/i˧˥ kɤ˥˩/",
        meaningPt: "Um (com classificador gè)",
        meaningEn: "One (with classifier gè)",
        explanationPt: "Diante do 4º Tom gè, 一 se transforma em yí (35)!",
        explanationEn: "Before 4th tone gè, 一 becomes yí (35)!",
        audioKeyClassroom: "/audio/words/xiaoxiao/classroom/yi1_ge4.mp3",
        audioKeyConversational: "/audio/words/xiaoxiao/conversational/yi1_ge4.mp3",
        f0ContourUnderlying: generateTheoreticalChaoContour([1, 4], false),
        f0ContourSurface: generateTheoreticalChaoContour([2, 4], false),
      },
      {
        id: "yitian",
        hanzi: "一天",
        traditional: "一天",
        underlyingPinyin: "yī tiān [55 + 55]",
        surfacePinyin: "yì tiān [51 + 55]",
        underlyingTones: [1, 1],
        surfaceTones: "T4 (51) + T1 (55)",
        underlyingChao: "55-55",
        surfaceChao: "51-55",
        ipaSurface: "/i˥˩ tʰjɛn˥˥/",
        meaningPt: "Um dia",
        meaningEn: "One day",
        explanationPt: "Diante do 1º Tom tiān, 一 se transforma no 4º Tom descendente yì!",
        explanationEn: "Before 1st tone tiān, 一 becomes high-falling 4th tone yì!",
        audioKeyClassroom: "/audio/words/xiaoxiao/classroom/yi1_tian1.mp3",
        audioKeyConversational: "/audio/words/xiaoxiao/conversational/yi1_tian1.mp3",
        f0ContourUnderlying: generateTheoreticalChaoContour([1, 1], false),
        f0ContourSurface: generateTheoreticalChaoContour([4, 1], false),
      },
    ],
  },
  {
    id: "sandhi_neutral",
    category: "neutral_tone",
    titlePt: "Altura Acústica do Tom Neutro (轻声 Qīngshēng)",
    titleEn: "Acoustic Pitch Height of the Neutral Tone (Qīngshēng)",
    formula: "T1+Neutro [~2] | T2+Neutro [~3] | T3+Neutro [~4] | T4+Neutro [~1.5]",
    summaryPt:
      "O Tom Neutro NÃO tem uma altura fixa! Sua frequência fundamental (F0) depende estritamente do ponto onde terminou a sílaba anterior.",
    summaryEn:
      "The Neutral Tone has no fixed pitch! Its F0 height depends entirely on where the preceding tone ended.",
    acousticMechanicPt:
      "Curiosidade acústica marcante: após o 3º Tom (que mergulhou em 21), o Tom Neutro soa ALTO (nível 4, ex.: 奶奶 nǎinai)! Já após o 1º Tom (55), o tom neutro soa BAIXO (nível 2, ex.: 妈妈 māma).",
    acousticMechanicEn:
      "Fascinating acoustic fact: after a 3rd tone (dipped to 21), the neutral tone sounds HIGH (level 4, e.g. 奶奶 nǎinai)! After a 1st tone (55), it falls LOW (level 2, e.g. 妈妈 māma).",
    examples: [
      {
        id: "mama",
        hanzi: "妈妈",
        traditional: "媽媽",
        underlyingPinyin: "mā ma [55 + 5]",
        surfacePinyin: "mā ma [55 + 2]",
        underlyingTones: [1, 5],
        surfaceTones: "T1 (55) + Neutro Baixo (~2)",
        underlyingChao: "55-2",
        surfaceChao: "55-2",
        ipaSurface: "/ma˥˥ ma˨/",
        meaningPt: "Mamãe",
        meaningEn: "Mom",
        explanationPt: "A segunda sílaba 'ma' cai suavemente para a faixa média-baixa relaxada.",
        explanationEn: "The second 'ma' falls softly into the lower-mid register.",
        audioKeyClassroom: "/audio/words/xiaoxiao/classroom/ma1_ma5.mp3",
        audioKeyConversational: "/audio/words/xiaoxiao/conversational/ma1_ma5.mp3",
        f0ContourUnderlying: generateTheoreticalChaoContour([1, 5], false),
        f0ContourSurface: generateTheoreticalChaoContour([1, 5], true),
      },
      {
        id: "nainai",
        hanzi: "奶奶",
        traditional: "奶奶",
        underlyingPinyin: "nǎi nai [214 + 5]",
        surfacePinyin: "nǎi nai [21 + 4]",
        underlyingTones: [3, 5],
        surfaceTones: "Half-T3 (21) + Neutro Alto (~4)",
        underlyingChao: "21-4",
        surfaceChao: "21-4",
        ipaSurface: "/naɪ˨˩ naɪ˦/",
        meaningPt: "Vovó (paterna)",
        meaningEn: "Paternal Grandma",
        explanationPt: "O primeiro nǎi fica baixo (21) e o segundo nai sobe acústicamente para nível 4!",
        explanationEn: "First nǎi stays low (21) and the second nai bounces up to level 4!",
        audioKeyClassroom: "/audio/words/xiaoxiao/classroom/nai3_nai5.mp3",
        audioKeyConversational: "/audio/words/xiaoxiao/conversational/nai3_nai5.mp3",
        f0ContourUnderlying: generateTheoreticalChaoContour([3, 5], false),
        f0ContourSurface: generateTheoreticalChaoContour([3, 5], true),
      },
    ],
  },
];

const DEFAULT_SOUND_GUIDES: SoundGuideSection[] = [
  {
    id: "guide_aspiration",
    slug: "aspiration",
    category: "aspiration",
    titlePt: "Consoantes Aspiradas vs Não-Aspiradas: O Teste da Folha de Papel",
    titleEn: "Aspirated vs Unaspirated Consonants: The Paper Sheet Test",
    subtitlePt: "b/p, d/t, g/k, z/c, zh/ch, j/q",
    subtitleEn: "b/p, d/t, g/k, z/c, zh/ch, j/q",
    ipaSymbols: ["[p] vs [pʰ]", "[t] vs [tʰ]", "[k] vs [kʰ]", "[t͡s] vs [t͡sʰ]"],
    chaoNotation: ["Explosão de ar em ms"],
    tonguePositionPt:
      "No chinês, a diferença crucial não é 'voz ligada' (sonora) vs 'voz desligada' (surda) como no português, mas sim a QUANTIDADE DE AR EXPELIDA (VOT - Voice Onset Time).",
    tonguePositionEn:
      "In Mandarin, the contrast is not voicing but aspiration burst (Voice Onset Time).",
    brazilianTrapPt:
      "⚠️ ARMADILHA PARA BRASILEIROS: No português, o 'B' é sonoro (as cordas vocais vibram antes do som sair). No Mandarim, a letra 'B' soa como um 'P' suave SEM ar soprado (/p/)! Se você disser 'bàba' com o 'B' do português, os chineses vão achar seu sotaque pesado. Já a letra 'P' tem um sopro explosivo de ar (/pʰ/).",
    brazilianTrapEn:
      "Portuguese speakers voice B/D/G. In Mandarin they are voiceless unaspirated /p, t, k/.",
    paperTestOrTrickPt:
      "📄 TRUQUE PRÁTICO: Segure uma folha de papel de caderno a 5 cm da sua boca. Ao dizer 'bà' a folha deve ficar QUASE PARADA. Ao dizer 'pà', a rajada de ar deve empurrar a folha visivelmente para a frente!",
    paperTestOrTrickEn:
      "Hold a sheet of paper 5cm from your lips. Saying 'bà' leaves it still; saying 'pà' blasts it forward!",
    svgDiagramType: "sagittal_bilabial_aspiration",
    keyPairsIds: ["pair_ba4_pa4"],
    demoSyllables: [
      { label: "bà (Não-Aspirado)", hanzi: "爸", pinyin: "bà", ipa: "/pa˥˩/", audioKey: "/audio/syllables/human_female/ba4.mp3" },
      { label: "pà (Aspirado!)", hanzi: "怕", pinyin: "pà", ipa: "/pʰa˥˩/", audioKey: "/audio/syllables/human_female/pa4.mp3" },
      { label: "dà (Não-Aspirado)", hanzi: "大", pinyin: "dà", ipa: "/ta˥˩/", audioKey: "/audio/syllables/human_female/da4.mp3" },
      { label: "tà (Aspirado!)", hanzi: "踏", pinyin: "tà", ipa: "/tʰa˥˩/", audioKey: "/audio/syllables/human_female/ta4.mp3" },
    ],
  },
  {
    id: "guide_retroflex_palatal",
    slug: "retroflex_palatal",
    category: "retroflex_palatal_dental",
    titlePt: "Retroflexas (zh/ch/sh/r) vs Alveolopalatais (j/q/x) vs Dentais (z/c/s)",
    titleEn: "Retroflex (zh/ch/sh/r) vs Palatal (j/q/x) vs Dental (z/c/s)",
    subtitlePt: "A Batalha das 3 Fileiras de Consoantes",
    subtitleEn: "The 3-Row Sibilant Contrast",
    ipaSymbols: ["[ʈ͡ʂ, ʈ͡ʂʰ, ʂ, ʐ]", "[t͡ɕ, t͡ɕʰ, ɕ]", "[t͡s, t͡sʰ, s]"],
    tonguePositionPt:
      "1. zh/ch/sh/r: Ponta da língua curvada para trás em direção ao céu da boca (palato pós-alveolar).\n2. j/q/x: Ponta da língua descansa colada atrás dos dentes INFERIORES, enquanto o dorso sobe contra o palato duro.\n3. z/c/s: Ponta da língua toca diretamente a parte de trás dos dentes superiores.",
    tonguePositionEn:
      "1. zh/ch/sh/r: Tongue tip curled back. 2. j/q/x: Tongue tip parked behind LOWER teeth. 3. z/c/s: Tongue tip against upper teeth.",
    brazilianTrapPt:
      "⚠️ ARMADILHA PARA BRASILEIROS: Cariocas e nordestinos tendem a chiar o 'S' transformando tudo em 'ch'. Se você fizer isso, 'sì' (quatro) vai virar 'shì' (ser/é), ou 'xī' vai virar 'shī'! Lembre-se: 'j/q/x' NUNCA combinam com vogais 'a/o/u' puras, apenas com 'i' e 'ü'.",
    brazilianTrapEn:
      "Brazilians tend to merge all sibilants into a generic 'sh'. Keep j/q/x strictly sharp and forward.",
    paperTestOrTrickPt:
      "👅 TRUQUE PRÁTICO: Para fazer j/q/x perfeitos, dê um sorriso largo e prense a ponta da língua contra a raiz dos dentes inferiores da frente. Diga 'xī' sem descolar a ponta!",
    paperTestOrTrickEn:
      "Smile wide and anchor tongue tip behind lower teeth. Pronounce 'xī' without lifting the tip!",
    svgDiagramType: "sagittal_retroflex_vs_palatal",
    keyPairsIds: ["pair_shi4_xi1"],
    demoSyllables: [
      { label: "zhī (Retroflexa)", hanzi: "知", pinyin: "zhī", ipa: "/ʈ͡ʂʐ̩˥˥/", audioKey: "/audio/syllables/human_female/zhi1.mp3" },
      { label: "jī (Palatal)", hanzi: "鸡", pinyin: "jī", ipa: "/t͡ɕi˥˥/", audioKey: "/audio/syllables/human_female/ji1.mp3" },
      { label: "zī (Dental)", hanzi: "姿", pinyin: "zī", ipa: "/t͡sz̩˥˥/", audioKey: "/audio/syllables/human_female/zi1.mp3" },
      { label: "shī (Retroflexa)", hanzi: "师", pinyin: "shī", ipa: "/ʂʐ̩˥˥/", audioKey: "/audio/syllables/human_female/shi1.mp3" },
      { label: "xī (Palatal)", hanzi: "西", pinyin: "xī", ipa: "/ɕi˥˥/", audioKey: "/audio/syllables/human_female/xi1.mp3" },
      { label: "sī (Dental)", hanzi: "思", pinyin: "sī", ipa: "/sz̩˥˥/", audioKey: "/audio/syllables/human_female/si1.mp3" },
    ],
  },
  {
    id: "guide_nasal_codas",
    slug: "nasal_codas",
    category: "nasal_codas",
    titlePt: "Finais Nasais: -n Alveolar Frontal vs -ng Velar Posterior",
    titleEn: "Nasal Codas: Alveolar -n vs Velar -ng",
    subtitlePt: "-an vs -ang, -en vs -eng, -in vs -ing",
    subtitleEn: "-an vs -ang, -en vs -eng, -in vs -ing",
    ipaSymbols: ["[-n] frontal", "[-ŋ] posterior"],
    tonguePositionPt:
      "No '-n', a ponta da língua sela os alvéolos superiores (atrás dos dentes da frente). No '-ng', o dorso da língua encosta no palato mole (véu palatino) lá atrás na garganta.",
    tonguePositionEn:
      "For -n, tongue tip seals alveolar ridge. For -ng, back of tongue seals soft palate.",
    brazilianTrapPt:
      "⚠️ ARMADILHA PARA BRASILEIROS: O português NÃO tem consoante nasal final fechada! Em palavras como 'canto' ou 'pão', nós apenas nasalizamos a vogal [kɐ̃tu]. Se você fizer isso em chinês, 'shān' (montanha) e 'shāng' (ferida) soarão IDÊNTICOS para um nativo!",
    brazilianTrapEn:
      "Portuguese nasalizes vowels without sealing final codas. Mandarin requires a crisp consonant closure.",
    paperTestOrTrickPt:
      "🚪 TRUQUE PRÁTICO: Ao pronunciar '-n', imagine que a ponta da língua é uma porta que bate no teto da boca ('an!'). Ao pronunciar '-ng', abra a boca um pouco mais e sinta a ressonância vibrar no fundo do crânio como no inglês 'sing'.",
    paperTestOrTrickEn:
      "For -n snap tongue tip to upper roof. For -ng drop jaw slightly and resonate back like English 'sing'.",
    svgDiagramType: "sagittal_alveolar_vs_velar_nasal",
    keyPairsIds: ["pair_shan1_shang1"],
    demoSyllables: [
      { label: "shān (-n Frontal)", hanzi: "山", pinyin: "shān", ipa: "/ʂan˥˥/", audioKey: "/audio/syllables/human_female/shan1.mp3" },
      { label: "shāng (-ng Posterior)", hanzi: "伤", pinyin: "shāng", ipa: "/ʂaŋ˥˥/", audioKey: "/audio/syllables/human_female/shang1.mp3" },
      { label: "chén (-n)", hanzi: "陈", pinyin: "chén", ipa: "/ʈ͡ʂʰən˧˥/", audioKey: "/audio/syllables/human_female/chen2.mp3" },
      { label: "chéng (-ng)", hanzi: "成", pinyin: "chéng", ipa: "/ʈ͡ʂʰəŋ˧˥/", audioKey: "/audio/syllables/human_female/cheng2.mp3" },
    ],
  },
  {
    id: "guide_vowels_umlaut",
    slug: "vowels_umlaut",
    category: "vowels_umlaut",
    titlePt: "A Vogal com Trema 'ü' (/y/): Segredo Articulatório Francês/Alemão",
    titleEn: "Umlaut Vowel 'ü' (/y/): The Articulatory Secret",
    subtitlePt: "u [/u/] vs ü [/y/] (lu vs lü, nu vs nü, yu, qu, xu, ju)",
    subtitleEn: "u [/u/] vs ü [/y/]",
    ipaSymbols: ["/u/ (posterior)", "/y/ (anterior arredondada)"],
    tonguePositionPt:
      "A vogal /y/ tem exatamente a MESMA posição de língua da vogal 'i' (alta e anterior), mas com os LÁBIOS bem arredondados e projetados para a frente como no 'u'.",
    tonguePositionEn:
      "Vowel /y/ uses the EXACT tongue position of /i/, but with tightly rounded lips like /u/.",
    brazilianTrapPt:
      "⚠️ ARMADILHA PARA BRASILEIROS: Como o português brasileiro não possui a vogal /y/, nossos ouvidos ouvem como um simples 'u'. Dizer 'lù' (estrada) em vez de 'lǜ' (verde) causa incompreensão imediata!",
    brazilianTrapEn:
      "Brazilian Portuguese lacks /y/, so speakers substitute /u/. Saying 'lù' instead of 'lǜ' changes meaning entirely.",
    paperTestOrTrickPt:
      "💋 TRUQUE INFALÍVEL: Comece emitindo um som contínuo de 'iiiiiiii' bem agudo. SEM mexer a língua em nenhum milímetro, projete seus lábios para a frente fazendo um 'biquinho' de beijo! O som que sai automaticamente é o 'ü' chinês perfeito!",
    paperTestOrTrickEn:
      "Sustain an 'eeee' sound. Without moving your tongue, round your lips forward for a kiss. That is the perfect 'ü'!",
    svgDiagramType: "vowel_trapezoid_u_vs_v",
    keyPairsIds: ["pair_lu4_lv4"],
    demoSyllables: [
      { label: "lù (/u/ Normal)", hanzi: "路", pinyin: "lù", ipa: "/lu˥˩/", audioKey: "/audio/syllables/human_female/lu4.mp3" },
      { label: "lǜ (/y/ Biquinho)", hanzi: "绿", pinyin: "lǜ", ipa: "/ly˥˩/", audioKey: "/audio/syllables/human_female/lv4.mp3" },
      { label: "nǔ (/u/)", hanzi: "弩", pinyin: "nǔ", ipa: "/nu˨˩˦/", audioKey: "/audio/syllables/human_female/nu3.mp3" },
      { label: "nǚ (/y/ Mulher)", hanzi: "女", pinyin: "nǚ", ipa: "/ny˨˩˦/", audioKey: "/audio/syllables/human_female/nv3.mp3" },
    ],
  },
];

// Fallback pairs for Compare tool if pairs array is empty
const FALLBACK_PAIRS: MinimalPairEntry[] = [
  {
    id: "pair_ma1_ma4",
    category: "monosyllable_tone",
    subCategory: "T1 vs T4",
    contrastLabelPt: "mā (1º Tom 55) vs mà (4º Tom 51)",
    contrastLabelEn: "mā (1st Tone 55) vs mà (4th Tone 51)",
    difficulty: 1,
    itemA: {
      hanzi: "妈",
      traditional: "媽",
      pinyin: "mā",
      pinyinTone3: "ma1",
      asciiKey: "ma1",
      tones: [1],
      initial: "m",
      final: "a",
      ipa: "/ma˥˥/",
      chaoContour: "55",
      meaningPt: "Mãe / Mamãe",
      meaningEn: "Mother / Mom",
      audioKey: "/audio/syllables/human_female/ma1.mp3",
    },
    itemB: {
      hanzi: "骂",
      traditional: "罵",
      pinyin: "mà",
      pinyinTone3: "ma4",
      asciiKey: "ma4",
      tones: [4],
      initial: "m",
      final: "a",
      ipa: "/ma˥˩/",
      chaoContour: "51",
      meaningPt: "Xingar / Repreender",
      meaningEn: "To scold / curse",
      audioKey: "/audio/syllables/human_female/ma4.mp3",
    },
    articulatoryTipPt:
      "O 1º Tom (55) mantém a laringe relaxada no registro superior sem oscilar. Já o 4º Tom (51) contrai rapidamente as cordas vocais em um golpe descendente decidido.",
    articulatoryTipEn:
      "1st Tone (55) sustains high level pitch. 4th Tone (51) drops sharply like an exclamation.",
  },
  {
    id: "pair_ba4_pa4",
    category: "initial_aspiration",
    subCategory: "b vs p (Aspiração)",
    contrastLabelPt: "bà ([p] Não-Aspirado) vs pà ([pʰ] Aspirado)",
    contrastLabelEn: "bà ([p] Unaspirated) vs pà ([pʰ] Aspirated)",
    difficulty: 2,
    itemA: {
      hanzi: "爸",
      traditional: "爸",
      pinyin: "bà",
      pinyinTone3: "ba4",
      asciiKey: "ba4",
      tones: [4],
      initial: "b",
      final: "a",
      ipa: "/pa˥˩/",
      chaoContour: "51",
      meaningPt: "Pai / Papai",
      meaningEn: "Father / Dad",
      audioKey: "/audio/syllables/human_female/ba4.mp3",
    },
    itemB: {
      hanzi: "怕",
      traditional: "怕",
      pinyin: "pà",
      pinyinTone3: "pa4",
      asciiKey: "pa4",
      tones: [4],
      initial: "p",
      final: "a",
      ipa: "/pʰa˥˩/",
      chaoContour: "51",
      meaningPt: "Ter medo / Temer",
      meaningEn: "To fear / afraid",
      audioKey: "/audio/syllables/human_female/pa4.mp3",
    },
    articulatoryTipPt:
      "Atenção lusófonos: 'bà' não tem o som sonoro do B português! É pronunciado como um P seco sem ar expelido. Já 'pà' joga uma rajada de vento na mão.",
    articulatoryTipEn:
      "bà is voiceless unaspirated [p]; pà has a strong acoustic air burst [pʰ].",
  },
];

// ============================================================================
// MAIN COMPONENT: CompareSandhiGuidesTab
// ============================================================================

export default function CompareSandhiGuidesTab(props: SharedModuleProps) {
  // Navigation sub-tabs: 'compare' | 'sandhi' | 'guides'
  const [subTab, setSubTab] = useState<"compare" | "sandhi" | "guides">("compare");

  // Pairs pool
  const allPairs = props.pairs && props.pairs.length > 0 ? props.pairs : FALLBACK_PAIRS;
  const [selectedPairIndex, setSelectedPairIndex] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterCat, setFilterCat] = useState<string>("all");

  // Playback state
  const [isPlayingA, setIsPlayingA] = useState(false);
  const [isPlayingB, setIsPlayingB] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [loopIntervalMs, setLoopIntervalMs] = useState<number>(1000);
  const [loopCurrentItem, setLoopCurrentItem] = useState<"A" | "B" | null>(null);

  // Stroke Modal
  const [modalHanzi, setModalHanzi] = useState<{
    simplified: string;
    traditional?: string;
    pinyin: string;
    meaningPt: string;
  } | null>(null);

  // Sandhi Rules state
  const sandhiRules =
    props.toneSandhiRules && props.toneSandhiRules.length > 0
      ? props.toneSandhiRules
      : DEFAULT_SANDHI_RULES;
  const [selectedRuleId, setSelectedRuleId] = useState<string>(sandhiRules[0]?.id || "sandhi_t3_t3");

  // Sandhi Mini-Quiz state
  const [quizQuestionIndex, setQuizQuestionIndex] = useState<number>(0);
  const [quizSelectedOption, setQuizSelectedOption] = useState<number | null>(null);
  const [quizScore, setQuizScore] = useState<{ correct: number; total: number }>({
    correct: 0,
    total: 0,
  });

  // Sound Guides state
  const soundGuides =
    props.soundGuides && props.soundGuides.length > 0
      ? props.soundGuides
      : DEFAULT_SOUND_GUIDES;
  const [selectedGuideIndex, setSelectedGuideIndex] = useState<number>(0);

  // Filtered pairs for the compare selector
  const filteredPairs = useMemo(() => {
    return allPairs.filter((p) => {
      const matchesCat = filterCat === "all" || p.category === filterCat;
      const q = searchQuery.toLowerCase().trim();
      if (!q) return matchesCat;
      const matchesText =
        p.contrastLabelPt.toLowerCase().includes(q) ||
        p.contrastLabelEn.toLowerCase().includes(q) ||
        p.subCategory.toLowerCase().includes(q) ||
        p.itemA.pinyin.toLowerCase().includes(q) ||
        p.itemB.pinyin.toLowerCase().includes(q) ||
        p.itemA.hanzi.includes(q) ||
        p.itemB.hanzi.includes(q);
      return matchesCat && matchesText;
    });
  }, [allPairs, filterCat, searchQuery]);

  const currentPair = filteredPairs[selectedPairIndex] || allPairs[0];

  // Helper to extract or generate F0 contour for items
  const getItemContour = useCallback(
    (item: LexicalItem): number[] => {
      if (props.audioManifest?.items?.[item.audioKey]?.f0Chao) {
        return props.audioManifest.items[item.audioKey].f0Chao;
      }
      return generateTheoreticalChaoContour(item.tones, true, 30);
    },
    [props.audioManifest]
  );

  // Play audio handlers
  const handlePlayItem = async (side: "A" | "B") => {
    if (!currentPair) return;
    const item = side === "A" ? currentPair.itemA : currentPair.itemB;
    if (side === "A") setIsPlayingA(true);
    else setIsPlayingB(true);

    try {
      await playLexicalItemAudio(item, props.activeVoice, props.activeSpeed, props.audioManifest);
    } finally {
      if (side === "A") setIsPlayingA(false);
      else setIsPlayingB(false);
    }
  };

  // Loop A <-> B logic
  const loopRef = useRef<boolean>(false);
  loopRef.current = isLooping;

  useEffect(() => {
    if (!isLooping || !currentPair) return;
    let cancelled = false;

    const runLoop = async () => {
      while (loopRef.current && !cancelled) {
        setLoopCurrentItem("A");
        await playLexicalItemAudio(
          currentPair.itemA,
          props.activeVoice,
          props.activeSpeed,
          props.audioManifest
        );
        if (!loopRef.current || cancelled) break;

        await new Promise((r) => setTimeout(r, loopIntervalMs));
        if (!loopRef.current || cancelled) break;

        setLoopCurrentItem("B");
        await playLexicalItemAudio(
          currentPair.itemB,
          props.activeVoice,
          props.activeSpeed,
          props.audioManifest
        );
        if (!loopRef.current || cancelled) break;

        await new Promise((r) => setTimeout(r, loopIntervalMs));
      }
      setLoopCurrentItem(null);
    };

    runLoop();

    return () => {
      cancelled = true;
      stopAllAudio();
    };
  }, [isLooping, currentPair, loopIntervalMs, props.activeVoice, props.activeSpeed, props.audioManifest]);

  // Global Keyboard Shortcuts (R/Space for Play/Toggle, 1 for A, 2 for B, S for Speed, V for Voice)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.getAttribute("contenteditable") === "true")
      ) {
        return;
      }

      if (e.key === "1" || e.key.toLowerCase() === "a") {
        e.preventDefault();
        handlePlayItem("A");
      } else if (e.key === "2" || e.key.toLowerCase() === "b") {
        e.preventDefault();
        handlePlayItem("B");
      } else if (e.key.toLowerCase() === "r" || e.code === "Space") {
        e.preventDefault();
        setIsLooping((prev) => !prev);
      } else if (e.key.toLowerCase() === "s") {
        e.preventDefault();
        props.setActiveSpeed(
          props.activeSpeed === "classroom" ? "conversational" : "classroom"
        );
      } else if (e.key.toLowerCase() === "v") {
        e.preventDefault();
        const curIdx = VOICE_OPTIONS.findIndex((v) => v.id === props.activeVoice);
        const nextVoice = VOICE_OPTIONS[(curIdx + 1) % VOICE_OPTIONS.length].id;
        props.setActiveVoice(nextVoice);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [props, currentPair]);

  // Mini-Quiz setup for Sandhi
  const quizItems = useMemo(() => {
    const items: Array<{
      prompt: string;
      word: string;
      pinyinUnderlying: string;
      options: string[];
      correctIndex: number;
      explanation: string;
      item: { hanzi: string; pinyinTone3?: string };
    }> = [
      {
        prompt: "Qual é a realização do tom da sílaba '你' (nǐ) em '你好' (nǐhǎo)?",
        word: "你好",
        pinyinUnderlying: "nǐ hǎo (3º Tom + 3º Tom)",
        options: [
          "2º Tom ascendente [35] (ní hǎo)",
          "3º Tom completo [214] (nǐ hǎo)",
          "1º Tom nivelado [55] (nī hǎo)",
          "Tom Neutro leve [~3]",
        ],
        correctIndex: 0,
        explanation:
          "Regra T3 + T3 ➔ T2 + T3! O primeiro 3º Tom se transforma no 2º Tom ascendente [35] para poupar esforço vocal.",
        item: { hanzi: "你好", pinyinTone3: "ni3hao3" },
      },
      {
        prompt: "Como se pronuncia a negação '不' (bù) na palavra '不是' (bù + shì)?",
        word: "不是",
        pinyinUnderlying: "bù shì (4º Tom + 4º Tom)",
        options: [
          "Mantém o 4º Tom [51] (bù shì)",
          "Muda para 2º Tom ascendente [35] (bú shì)",
          "Vira tom neutro curto [2]",
          "Muda para 3º Tom [214] (bǔ shì)",
        ],
        correctIndex: 1,
        explanation:
          "Regra de 不: diante de outro 4º Tom (shì), 不 transforma-se obrigatoriamente no 2º Tom ascendente (bú)!",
        item: { hanzi: "不是", pinyinTone3: "bu4shi4" },
      },
      {
        prompt: "Em '一天' (yī + tiān), como soa o numeral '一'?",
        word: "一天",
        pinyinUnderlying: "yī tiān (1º Tom + 1º Tom)",
        options: [
          "Continua 1º Tom [55] (yī tiān)",
          "Muda para 4º Tom descendente [51] (yì tiān)",
          "Muda para 2º Tom [35] (yí tiān)",
          "Fica mudo",
        ],
        correctIndex: 1,
        explanation:
          "Regra de 一: diante de 1º, 2º ou 3º tons, o numeral 一 dissimila para o 4º Tom descendente (yì)!",
        item: { hanzi: "一天", pinyinTone3: "yi1tian1" },
      },
      {
        prompt: "Na palavra '北京' (běijīng), o que acontece com o 3º Tom de 'běi'?",
        word: "北京",
        pinyinUnderlying: "běi jīng (3º Tom + 1º Tom)",
        options: [
          "Vira Meio 3º Tom [21] (só desce e não sobe)",
          "Vira 2º Tom ascendente [35]",
          "Faz a curva completa [214] subindo no final",
          "Vira tom neutro",
        ],
        correctIndex: 0,
        explanation:
          "Regra do Half-Third Tone: antes de qualquer tom que não seja outro T3, o 3º Tom apenas desce [21] sem subir a cauda!",
        item: { hanzi: "北京", pinyinTone3: "bei3jing1" },
      },
    ];
    return items;
  }, []);

  const currentQuiz = quizItems[quizQuestionIndex % quizItems.length];

  const handleQuizAnswer = (optIndex: number) => {
    if (quizSelectedOption !== null) return;
    setQuizSelectedOption(optIndex);
    const isCorrect = optIndex === currentQuiz.correctIndex;
    setQuizScore((prev) => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      total: prev.total + 1,
    }));

    // Record attempt for profile tracking
    props.onRecordAttempt({
      mode: "abx_minimal_pairs",
      category: "sandhi",
      subCategory: "tone_sandhi_rule",
      targetId: currentQuiz.word,
      expectedToneOrLabel: currentQuiz.options[currentQuiz.correctIndex],
      userSelectedToneOrLabel: currentQuiz.options[optIndex],
      correct: isCorrect,
      reactionTimeMs: 1200,
      speedUsed: props.activeSpeed,
      voiceUsed: props.activeVoice,
    });
  };

  const handleNextQuiz = () => {
    setQuizSelectedOption(null);
    setQuizQuestionIndex((prev) => (prev + 1) % quizItems.length);
  };

  const activeRule =
    sandhiRules.find((r) => r.id === selectedRuleId) || sandhiRules[0];
  const activeGuide = soundGuides[selectedGuideIndex] || soundGuides[0];

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Top Header & Sub-Tabs Navigation */}
      <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
                <ArrowRightLeft className="w-5 h-5" />
              </span>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Estúdio Fonético & Tone Sandhi
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Comparação acústica em tempo real ($F_0$), regras de mutação tonal (变调) e guias anatômicos para lusófonos.
            </p>
          </div>

          {/* Sub-tab pills */}
          <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800/80">
            <button
              type="button"
              onClick={() => {
                setIsLooping(false);
                setSubTab("compare");
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition ${
                subTab === "compare"
                  ? "bg-sky-500 text-slate-950 shadow-md"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <ArrowRightLeft className="w-4 h-4" />
              Comparador Lado a Lado
            </button>
            <button
              type="button"
              onClick={() => {
                setIsLooping(false);
                setSubTab("sandhi");
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition ${
                subTab === "sandhi"
                  ? "bg-amber-500 text-slate-950 shadow-md"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Sparkles className="w-4 h-4" />
              Tone Sandhi (变调)
            </button>
            <button
              type="button"
              onClick={() => {
                setIsLooping(false);
                setSubTab("guides");
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition ${
                subTab === "guides"
                  ? "bg-emerald-500 text-slate-950 shadow-md"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <BookOpen className="w-4 h-4" />
              Guias de Sons (PT-BR)
            </button>
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* SUB-ABA A: FERRAMENTA "COMPARE" (COMPARADOR LADO A LADO) */}
      {/* ==================================================================== */}
      {subTab === "compare" && currentPair && (
        <div className="space-y-6">
          {/* Controls Bar: Search, Category Filter, Voice & Speed */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
              {/* Search input */}
              <div className="relative min-w-[200px] flex-1 sm:flex-initial">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSelectedPairIndex(0);
                  }}
                  placeholder="Buscar par mínimo (ex: ma, shi, an)..."
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500 transition"
                />
              </div>

              {/* Category Filter */}
              <select
                value={filterCat}
                onChange={(e) => {
                  setFilterCat(e.target.value);
                  setSelectedPairIndex(0);
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 focus:outline-none focus:border-sky-500 transition"
              >
                <option value="all">Todas Categorias</option>
                <option value="monosyllable_tone">Tons Monossilábicos</option>
                <option value="dissyllable_tone_matrix">Matriz Dissilábica</option>
                <option value="initial_aspiration">Aspiração (b/p, d/t, g/k)</option>
                <option value="initial_place">Ponto Articulatório (zh/j/z)</option>
                <option value="final_nasal">Finais Nasais (-n vs -ng)</option>
                <option value="final_vowel">Vogais & Trema (u vs ü)</option>
              </select>

              {/* Pair Selector Dropdown */}
              <select
                value={selectedPairIndex}
                onChange={(e) => setSelectedPairIndex(Number(e.target.value))}
                className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-medium focus:outline-none focus:border-sky-500 max-w-xs truncate transition"
              >
                {filteredPairs.map((p, idx) => (
                  <option key={p.id || idx} value={idx}>
                    {p.contrastLabelPt}
                  </option>
                ))}
              </select>
            </div>

            {/* Voice & Speed controls */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={props.activeVoice}
                onChange={(e) => props.setActiveVoice(e.target.value as VoiceId)}
                className="px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 font-medium"
              >
                {VOICE_OPTIONS.map((vo) => (
                  <option key={vo.id} value={vo.id}>
                    {vo.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() =>
                  props.setActiveSpeed(
                    props.activeSpeed === "classroom"
                      ? "conversational"
                      : "classroom"
                  )
                }
                className={`px-3 py-1.5 rounded-xl border font-semibold transition ${
                  props.activeSpeed === "classroom"
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                    : "bg-sky-500/20 text-sky-300 border-sky-500/40"
                }`}
                title="Atalho: tecla S"
              >
                {props.activeSpeed === "classroom"
                  ? "0.75x Classroom"
                  : "1.0x Natural"}
              </button>
            </div>
          </div>

          {/* Cards Lado a Lado: Item A vs Item B */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Card Item A */}
            <div
              className={`relative bg-slate-900/90 border-2 rounded-2xl p-6 transition shadow-xl ${
                loopCurrentItem === "A" || isPlayingA
                  ? "border-sky-400 ring-4 ring-sky-500/20 bg-sky-950/20"
                  : "border-slate-800 hover:border-slate-700"
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase bg-sky-500/20 text-sky-300 border border-sky-500/30">
                  Item A (Atalho: 1 ou A)
                </span>
                <span
                  className="px-2.5 py-0.5 rounded-md text-xs font-semibold"
                  style={{
                    backgroundColor: `${TONE_COLORS[currentPair.itemA.tones[0]] || "#3B596A"}25`,
                    color: TONE_COLORS[currentPair.itemA.tones[0]] || "#3B596A",
                  }}
                >
                  {TONE_LABELS_PT[currentPair.itemA.tones[0]] || `Tom ${currentPair.itemA.tones[0]}`}
                </span>
              </div>

              <div className="flex items-baseline justify-between mb-2">
                <div>
                  <h2 className="text-4xl sm:text-5xl font-extrabold font-hanzi text-white tracking-wide">
                    {props.profile.preferredScript === "traditional" &&
                    currentPair.itemA.traditional
                      ? currentPair.itemA.traditional
                      : currentPair.itemA.hanzi}
                  </h2>
                  <p className="text-2xl font-bold font-pinyin text-sky-400 mt-1">
                    {currentPair.itemA.pinyin}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-sm font-mono text-slate-400 block">
                    IPA: {currentPair.itemA.ipa}
                  </span>
                  <span className="text-xs font-mono text-slate-500 block">
                    Chao: {currentPair.itemA.chaoContour} ({currentPair.itemA.pinyinTone3})
                  </span>
                </div>
              </div>

              <div className="bg-slate-950/60 rounded-xl p-3 my-4 border border-slate-800/60">
                <p className="text-sm text-slate-200 font-medium">
                  {currentPair.itemA.meaningPt}
                </p>
                {currentPair.itemA.meaningEn && (
                  <p className="text-xs text-slate-400 mt-0.5">
                    {currentPair.itemA.meaningEn}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => handlePlayItem("A")}
                  disabled={isPlayingA}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold transition shadow-lg shadow-sky-500/20 active:scale-95 disabled:opacity-50"
                >
                  <Volume2 className="w-5 h-5" />
                  Ouvir A
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setModalHanzi({
                      simplified: currentPair.itemA.hanzi,
                      traditional: currentPair.itemA.traditional,
                      pinyin: currentPair.itemA.pinyin,
                      meaningPt: currentPair.itemA.meaningPt,
                    })
                  }
                  className="px-3.5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition border border-slate-700"
                  title="Ordem dos Traços (Hanzi Writer)"
                >
                  Traços
                </button>
              </div>
            </div>

            {/* Card Item B */}
            <div
              className={`relative bg-slate-900/90 border-2 rounded-2xl p-6 transition shadow-xl ${
                loopCurrentItem === "B" || isPlayingB
                  ? "border-rose-400 ring-4 ring-rose-500/20 bg-rose-950/20"
                  : "border-slate-800 hover:border-slate-700"
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  Item B (Atalho: 2 ou B)
                </span>
                <span
                  className="px-2.5 py-0.5 rounded-md text-xs font-semibold"
                  style={{
                    backgroundColor: `${TONE_COLORS[currentPair.itemB.tones[0]] || "#9E2A2B"}25`,
                    color: TONE_COLORS[currentPair.itemB.tones[0]] || "#9E2A2B",
                  }}
                >
                  {TONE_LABELS_PT[currentPair.itemB.tones[0]] || `Tom ${currentPair.itemB.tones[0]}`}
                </span>
              </div>

              <div className="flex items-baseline justify-between mb-2">
                <div>
                  <h2 className="text-4xl sm:text-5xl font-extrabold font-hanzi text-white tracking-wide">
                    {props.profile.preferredScript === "traditional" &&
                    currentPair.itemB.traditional
                      ? currentPair.itemB.traditional
                      : currentPair.itemB.hanzi}
                  </h2>
                  <p className="text-2xl font-bold font-pinyin text-rose-400 mt-1">
                    {currentPair.itemB.pinyin}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-sm font-mono text-slate-400 block">
                    IPA: {currentPair.itemB.ipa}
                  </span>
                  <span className="text-xs font-mono text-slate-500 block">
                    Chao: {currentPair.itemB.chaoContour} ({currentPair.itemB.pinyinTone3})
                  </span>
                </div>
              </div>

              <div className="bg-slate-950/60 rounded-xl p-3 my-4 border border-slate-800/60">
                <p className="text-sm text-slate-200 font-medium">
                  {currentPair.itemB.meaningPt}
                </p>
                {currentPair.itemB.meaningEn && (
                  <p className="text-xs text-slate-400 mt-0.5">
                    {currentPair.itemB.meaningEn}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => handlePlayItem("B")}
                  disabled={isPlayingB}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-rose-500 hover:bg-rose-400 text-slate-950 font-bold transition shadow-lg shadow-rose-500/20 active:scale-95 disabled:opacity-50"
                >
                  <Volume2 className="w-5 h-5" />
                  Ouvir B
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setModalHanzi({
                      simplified: currentPair.itemB.hanzi,
                      traditional: currentPair.itemB.traditional,
                      pinyin: currentPair.itemB.pinyin,
                      meaningPt: currentPair.itemB.meaningPt,
                    })
                  }
                  className="px-3.5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition border border-slate-700"
                  title="Ordem dos Traços (Hanzi Writer)"
                >
                  Traços
                </button>
              </div>
            </div>
          </div>

          {/* Loop Alternado Automático A ⇄ B */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsLooping(!isLooping)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition shadow-md active:scale-95 ${
                  isLooping
                    ? "bg-amber-500 text-slate-950 ring-2 ring-amber-400"
                    : "bg-slate-800 hover:bg-slate-700 text-slate-200"
                }`}
                title="Atalho: R ou Barra de Espaço"
              >
                {isLooping ? <Pause className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
                {isLooping ? "Parar Loop A ⇄ B" : "Loop Automático A ⇄ B"}
              </button>
              {isLooping && (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-300 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  Tocando agora: {loopCurrentItem || "..."}
                </span>
              )}
            </div>

            {/* Intervalo do loop */}
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>Intervalo:</span>
              {[600, 1000, 1600].map((ms) => (
                <button
                  key={ms}
                  type="button"
                  onClick={() => setLoopIntervalMs(ms)}
                  className={`px-2.5 py-1 rounded-lg border font-semibold transition ${
                    loopIntervalMs === ms
                      ? "bg-sky-500/20 text-sky-300 border-sky-400"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  {ms}ms
                </button>
              ))}
            </div>
          </div>

          {/* Canvas de Pitch Contour Sobreposto F0: Item A vs Item B */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <PitchContourCanvas
              primaryContour={getItemContour(currentPair.itemA)}
              primaryLabel={`Item A (${currentPair.itemA.pinyin})`}
              primaryTone={currentPair.itemA.tones[0] || 1}
              secondaryContour={getItemContour(currentPair.itemB)}
              secondaryLabel={`Item B (${currentPair.itemB.pinyin})`}
              secondaryTone={currentPair.itemB.tones[0] || 4}
              secondaryDashed={false}
              syllableCount={currentPair.itemA.tones.length}
              height={230}
            />
          </div>

          {/* Dica Articulatória & Explicação Fonética */}
          <div className="bg-slate-900/80 border border-sky-950/60 rounded-2xl p-5 flex items-start gap-4 shadow-lg">
            <span className="p-2.5 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20 shrink-0 mt-0.5">
              <Lightbulb className="w-5 h-5" />
            </span>
            <div className="space-y-1.5">
              <h3 className="text-sm font-bold text-sky-300 uppercase tracking-wide">
                Dica Articulatória & Contraste Acústico
              </h3>
              <p className="text-sm text-slate-200 leading-relaxed">
                {props.profile.preferredLang === "en"
                  ? currentPair.articulatoryTipEn
                  : currentPair.articulatoryTipPt}
              </p>
            </div>
          </div>

          {/* Sentenças de Contexto (se houver) */}
          {currentPair.sentenceContext && (
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wide flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-emerald-400" />
                Sentenças de Contraste no Contexto
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1">
                  <p className="text-base font-hanzi font-bold text-sky-300">
                    {currentPair.sentenceContext.sentenceA}
                  </p>
                  <p className="font-pinyin text-slate-400">
                    {currentPair.sentenceContext.pinyinA}
                  </p>
                  <p className="text-slate-300">
                    {currentPair.sentenceContext.meaningPtA}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1">
                  <p className="text-base font-hanzi font-bold text-rose-300">
                    {currentPair.sentenceContext.sentenceB}
                  </p>
                  <p className="font-pinyin text-slate-400">
                    {currentPair.sentenceContext.pinyinB}
                  </p>
                  <p className="text-slate-300">
                    {currentPair.sentenceContext.meaningPtB}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* SUB-ABA B: LABORATÓRIO DE TONE SANDHI (变调 BIÀNDIÀO) */}
      {/* ==================================================================== */}
      {subTab === "sandhi" && (
        <div className="space-y-6">
          {/* Rules Selector Pills */}
          <div className="flex flex-wrap gap-2">
            {sandhiRules.map((rule) => (
              <button
                key={rule.id}
                type="button"
                onClick={() => setSelectedRuleId(rule.id)}
                className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition border ${
                  rule.id === selectedRuleId
                    ? "bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20"
                    : "bg-slate-900/80 text-slate-300 border-slate-800 hover:border-slate-700"
                }`}
              >
                {rule.titlePt.split(" (")[0]}
              </button>
            ))}
          </div>

          {/* Active Rule Details Banner */}
          <div className="bg-slate-900/90 border border-amber-500/30 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  Regra Fonológica Ativa
                </span>
                <h2 className="text-lg sm:text-xl font-bold text-white mt-0.5">
                  {activeRule.titlePt}
                </h2>
              </div>
              <div className="px-3.5 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono text-xs sm:text-sm font-bold">
                {activeRule.formula}
              </div>
            </div>

            <p className="text-sm text-slate-200 leading-relaxed">
              {activeRule.summaryPt}
            </p>

            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 flex items-start gap-3 text-xs sm:text-sm text-slate-300">
              <Info className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold text-sky-300 uppercase tracking-wide text-xs">
                  Mecânica Acústica & Fisiologia Vocal
                </span>
                <p className="leading-relaxed">{activeRule.acousticMechanicPt}</p>
              </div>
            </div>
          </div>

          {/* Exemplos Interativos da Regra */}
          <div className="space-y-5">
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              Exemplos com Contorno Acústico Real vs Subjacente
            </h3>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {activeRule.examples.map((ex) => (
                <div
                  key={ex.id}
                  className="bg-slate-900/85 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-3xl font-extrabold font-hanzi text-white">
                        {ex.hanzi}
                      </h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-mono text-slate-500 line-through">
                          {ex.underlyingPinyin}
                        </span>
                        <span className="text-xs text-slate-400">➔</span>
                        <span className="text-sm font-bold font-pinyin text-emerald-400">
                          {ex.surfacePinyin}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-xs font-mono font-bold">
                        {ex.surfaceTones}
                      </span>
                      <p className="text-xs text-slate-400 mt-1">{ex.meaningPt}</p>
                    </div>
                  </div>

                  {/* Canvas de Pitch Contour comparando Superfície (sólido) vs Subjacente (tracejado) */}
                  <PitchContourCanvas
                    primaryContour={
                      ex.f0ContourSurface && ex.f0ContourSurface.length > 1
                        ? ex.f0ContourSurface
                        : generateTheoreticalChaoContour(ex.underlyingTones, true)
                    }
                    primaryLabel="Pronúncia Real de Superfície"
                    primaryTone={ex.underlyingTones[0] === 3 ? 2 : 1}
                    secondaryContour={
                      ex.f0ContourUnderlying && ex.f0ContourUnderlying.length > 1
                        ? ex.f0ContourUnderlying
                        : generateTheoreticalChaoContour(ex.underlyingTones, false)
                    }
                    secondaryLabel="Teórico do Dicionário (Subjacente)"
                    secondaryTone={ex.underlyingTones[0]}
                    secondaryDashed={true}
                    syllableCount={ex.underlyingTones.length}
                    height={180}
                  />

                  <p className="text-xs text-slate-300 italic bg-slate-950/50 p-2.5 rounded-xl border border-slate-800/60">
                    💡 {ex.explanationPt}
                  </p>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() =>
                        playLexicalItemAudio(
                          { hanzi: ex.hanzi, audioKey: ex.audioKeyClassroom, tones: ex.underlyingTones },
                          props.activeVoice,
                          "classroom",
                          props.audioManifest
                        )
                      }
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
                    >
                      <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                      Ouvir 0.75x Lento
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        playLexicalItemAudio(
                          { hanzi: ex.hanzi, audioKey: ex.audioKeyConversational, tones: ex.underlyingTones },
                          props.activeVoice,
                          "conversational",
                          props.audioManifest
                        )
                      }
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition shadow-md shadow-amber-500/20"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      Ouvir 1.0x Natural
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Mini-Quiz Interativo de Tone Sandhi */}
          <div className="bg-xuan-card border border-[#9C7A3C]/50 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-xuan-border pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-[#9C7A3C]/20 text-[#9C7A3C]">
                  <Headphones className="w-4 h-4" />
                </span>
                <h3 className="text-base font-serif font-bold text-xuan-ink">
                  Desafio Auditivo: Reconheça a Mudança Tonal
                </h3>
              </div>
              <span className="text-xs font-semibold text-xuan-muted">
                Acertos: {quizScore.correct} / {quizScore.total}
              </span>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-xuan-ink">
                {currentQuiz.prompt}
              </p>
              <div className="flex items-center gap-4 py-2">
                <span className="text-3xl font-extrabold font-hanzi text-[#9C7A3C]">
                  {currentQuiz.word}
                </span>
                <span className="text-xs font-mono text-xuan-muted">
                  Subjacente: {currentQuiz.pinyinUnderlying}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    playLexicalItemAudio(
                      currentQuiz.item,
                      props.activeVoice,
                      props.activeSpeed,
                      props.audioManifest
                    )
                  }
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#9E2A2B] text-[#F5F2E9] hover:bg-[#7D2021] text-xs font-semibold transition"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  Ouvir Pronúncia
                </button>
              </div>
            </div>

            {/* Alternativas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              {currentQuiz.options.map((opt, idx) => {
                const isSelected = quizSelectedOption === idx;
                const isCorrect = idx === currentQuiz.correctIndex;
                let btnStyle =
                  "bg-xuan-bg border-xuan-border text-xuan-ink hover:border-[#9E2A2B]";

                if (quizSelectedOption !== null) {
                  if (isCorrect) {
                    btnStyle =
                      "bg-[#3A6B59]/15 border-[#3A6B59] text-xuan-ink font-bold";
                  } else if (isSelected) {
                    btnStyle =
                      "bg-[#9E2A2B]/15 border-[#9E2A2B] text-xuan-ink";
                  } else {
                    btnStyle = "bg-xuan-bg/50 border-xuan-border text-xuan-muted";
                  }
                }

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleQuizAnswer(idx)}
                    disabled={quizSelectedOption !== null}
                    className={`flex items-center justify-between p-3.5 rounded-xl border text-xs sm:text-sm font-medium transition text-left ${btnStyle}`}
                  >
                    <span>{opt}</span>
                    {quizSelectedOption !== null && isCorrect && (
                      <CheckCircle2 className="w-4 h-4 text-[#3A6B59] shrink-0" />
                    )}
                    {quizSelectedOption !== null && isSelected && !isCorrect && (
                      <XCircle className="w-4 h-4 text-[#9E2A2B] shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Feedback & Próxima Questão */}
            {quizSelectedOption !== null && (
              <div className="p-3.5 rounded-xl bg-xuan-bg border border-xuan-border flex items-center justify-between gap-3 text-xs">
                <p className="text-xuan-ink">
                  <span className="font-bold text-[#9C7A3C] mr-1">
                    {quizSelectedOption === currentQuiz.correctIndex
                      ? "Correto!"
                      : "Atenção:"}
                  </span>
                  {currentQuiz.explanation}
                </p>
                <button
                  type="button"
                  onClick={handleNextQuiz}
                  className="px-4 py-2 rounded-xl bg-[#9E2A2B] hover:bg-[#7D2021] text-[#F5F2E9] font-bold transition shrink-0"
                >
                  Próxima Questão
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* SUB-ABA C: GUIAS DE SONS INTERATIVOS EM PORTUGUÊS */}
      {/* ==================================================================== */}
      {subTab === "guides" && (
        <div className="space-y-6">
          {/* Seletor de Seção do Guia */}
          <div className="flex flex-wrap gap-2">
            {soundGuides.map((guide, idx) => (
              <button
                key={guide.id || idx}
                type="button"
                onClick={() => setSelectedGuideIndex(idx)}
                className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition border ${
                  idx === selectedGuideIndex
                    ? "bg-[#9E2A2B] text-[#F5F2E9] border-[#9E2A2B] shadow-sm"
                    : "bg-xuan-card text-xuan-muted border-xuan-border hover:text-xuan-ink"
                }`}
              >
                {guide.titlePt.split(":")[0]}
              </button>
            ))}
          </div>

          {/* Guia Ativo Card */}
          <div className="bg-xuan-card border border-xuan-border rounded-2xl p-6 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-xuan-border pb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#3A6B59]">
                  {activeGuide.subtitlePt}
                </span>
                <h2 className="text-xl sm:text-2xl font-serif font-bold text-xuan-ink mt-0.5">
                  {activeGuide.titlePt}
                </h2>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {activeGuide.ipaSymbols.map((sym, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 rounded-lg bg-[#3A6B59]/15 text-[#3A6B59] font-mono text-xs font-semibold border border-[#3A6B59]/30"
                  >
                    {sym}
                  </span>
                ))}
              </div>
            </div>

            {/* Diagrama SVG Anatômico Vetorial Didático — Papel Xuan & Tinta Sumi (Zero Neon) */}
            <div className="bg-xuan-bg border border-xuan-border rounded-2xl p-6 flex flex-col items-center justify-center">
              <span className="text-xs uppercase font-serif font-bold tracking-wider text-xuan-muted mb-3">
                Diagrama Anatômico Vetorial do Trato Vocal (Gravura Clássica)
              </span>

              {/* Renderização condicional por svgDiagramType */}
              {activeGuide.svgDiagramType === "sagittal_bilabial_aspiration" && (
                <svg
                  className="w-full max-w-lg h-56"
                  viewBox="0 0 460 200"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <rect width="460" height="200" rx="16" style={{ fill: "var(--bg-card)" }} />
                  {/* Left Side: Unaspirated (b) */}
                  <g transform="translate(10, 10)">
                    <text x="100" y="25" fill="#3B596A" fontSize="13" fontWeight="bold" textAnchor="middle">
                      b ([p] Não-Aspirado)
                    </text>
                    {/* Lips */}
                    <path d="M 60 70 Q 75 70 85 85 Q 75 100 60 100" stroke="#7A756C" strokeWidth="4" fill="none" />
                    <path d="M 60 130 Q 75 130 85 115 Q 75 100 60 100" stroke="#7A756C" strokeWidth="4" fill="none" />
                    {/* Paper Sheet vertical */}
                    <line x1="130" y1="50" x2="130" y2="150" stroke="#5C5852" strokeWidth="3" />
                    <text x="130" y="170" fill="#7A756C" fontSize="10" textAnchor="middle">
                      Folha de papel estática
                    </text>
                    {/* Tiny gentle breath */}
                    <path d="M 90 100 L 115 100" stroke="#3B596A" strokeWidth="2" strokeDasharray="3 3" />
                  </g>

                  {/* Divider */}
                  <line x1="230" y1="20" x2="230" y2="180" stroke="#7A756C" strokeOpacity="0.4" strokeWidth="2" strokeDasharray="4 4" />

                  {/* Right Side: Aspirated (p) */}
                  <g transform="translate(240, 10)">
                    <text x="100" y="25" fill="#9E2A2B" fontSize="13" fontWeight="bold" textAnchor="middle">
                      p ([pʰ] ASPIRADO FORTE!)
                    </text>
                    {/* Lips */}
                    <path d="M 60 70 Q 75 70 85 85 Q 75 100 60 100" stroke="#7A756C" strokeWidth="4" fill="none" />
                    <path d="M 60 130 Q 75 130 85 115 Q 75 100 60 100" stroke="#7A756C" strokeWidth="4" fill="none" />
                    {/* Strong air blast waves */}
                    <path d="M 95 90 Q 120 75 150 70" stroke="#9E2A2B" strokeWidth="3" fill="none" />
                    <path d="M 95 100 Q 125 100 160 100" stroke="#9E2A2B" strokeWidth="4" fill="none" />
                    <path d="M 95 110 Q 120 125 150 130" stroke="#9E2A2B" strokeWidth="3" fill="none" />
                    {/* Blasted bent paper sheet */}
                    <path d="M 140 50 Q 170 100 185 145" stroke="#5C5852" strokeWidth="3" fill="none" />
                    <text x="165" y="170" fill="#9E2A2B" fontSize="10" fontWeight="bold" textAnchor="middle">
                      Folha inclina com o sopro!
                    </text>
                  </g>
                </svg>
              )}

              {activeGuide.svgDiagramType === "sagittal_retroflex_vs_palatal" && (
                <svg
                  className="w-full max-w-lg h-56"
                  viewBox="0 0 460 200"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <rect width="460" height="200" rx="16" style={{ fill: "var(--bg-card)" }} />
                  {/* Left: zh/ch/sh/r retroflex */}
                  <g transform="translate(10, 10)">
                    <text x="100" y="25" fill="#9C7A3C" fontSize="13" fontWeight="bold" textAnchor="middle">
                      zh / ch / sh / r (Retroflexa)
                    </text>
                    {/* Palate roof */}
                    <path d="M 50 60 Q 90 50 150 70" stroke="#7A756C" strokeWidth="3" fill="none" />
                    {/* Curled back tongue tip */}
                    <path d="M 50 140 Q 80 130 100 95 Q 95 72 85 75" stroke="#9C7A3C" strokeWidth="4" fill="none" />
                    <circle cx="85" cy="75" r="4" fill="#9C7A3C" />
                    <text x="100" y="170" fill="#9C7A3C" fontSize="10" textAnchor="middle">
                      Ponta da língua curva para trás ⤴
                    </text>
                  </g>

                  {/* Divider */}
                  <line x1="230" y1="20" x2="230" y2="180" stroke="#7A756C" strokeOpacity="0.4" strokeWidth="2" strokeDasharray="4 4" />

                  {/* Right: j/q/x alveolopalatal */}
                  <g transform="translate(240, 10)">
                    <text x="100" y="25" fill="#3A6B59" fontSize="13" fontWeight="bold" textAnchor="middle">
                      j / q / x (Alvéolo-Palatal)
                    </text>
                    {/* Palate roof */}
                    <path d="M 50 60 Q 90 50 150 70" stroke="#7A756C" strokeWidth="3" fill="none" />
                    {/* Flat tongue body raised to hard palate with tip resting down */}
                    <path d="M 50 140 Q 75 140 70 120 Q 95 65 130 85" stroke="#3A6B59" strokeWidth="4" fill="none" />
                    <circle cx="70" cy="120" r="4" fill="#3A6B59" />
                    <text x="100" y="170" fill="#3A6B59" fontSize="10" textAnchor="middle">
                      Ponta colada nos dentes INFERIORES ⤵
                    </text>
                  </g>
                </svg>
              )}

              {activeGuide.svgDiagramType === "sagittal_alveolar_vs_velar_nasal" && (
                <svg
                  className="w-full max-w-lg h-56"
                  viewBox="0 0 460 200"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <rect width="460" height="200" rx="16" style={{ fill: "var(--bg-card)" }} />
                  {/* Left: -n alveolar */}
                  <g transform="translate(10, 10)">
                    <text x="100" y="25" fill="#3B596A" fontSize="13" fontWeight="bold" textAnchor="middle">
                      -n (Alveolar Frontal)
                    </text>
                    <path d="M 40 60 Q 80 50 150 70" stroke="#7A756C" strokeWidth="3" fill="none" />
                    {/* Tongue tip seals at front alveolar ridge */}
                    <path d="M 40 140 Q 60 130 65 65" stroke="#3B596A" strokeWidth="4" fill="none" />
                    <circle cx="65" cy="65" r="4" fill="#3B596A" />
                    <text x="100" y="170" fill="#3B596A" fontSize="10" textAnchor="middle">
                      Ponta da língua sela atrás dos dentes!
                    </text>
                  </g>

                  {/* Divider */}
                  <line x1="230" y1="20" x2="230" y2="180" stroke="#7A756C" strokeOpacity="0.4" strokeWidth="2" strokeDasharray="4 4" />

                  {/* Right: -ng velar */}
                  <g transform="translate(240, 10)">
                    <text x="100" y="25" fill="#9E2A2B" fontSize="13" fontWeight="bold" textAnchor="middle">
                      -ng (Velar Posterior)
                    </text>
                    <path d="M 40 60 Q 80 50 150 70" stroke="#7A756C" strokeWidth="3" fill="none" />
                    {/* Tongue back seals against soft palate */}
                    <path d="M 40 140 Q 90 135 130 72" stroke="#9E2A2B" strokeWidth="4" fill="none" />
                    <circle cx="130" cy="72" r="4" fill="#9E2A2B" />
                    <text x="100" y="170" fill="#9E2A2B" fontSize="10" textAnchor="middle">
                      Dorso sela no véu palatino (fundo)
                    </text>
                  </g>
                </svg>
              )}

              {activeGuide.svgDiagramType === "vowel_trapezoid_u_vs_v" && (
                <svg
                  className="w-full max-w-lg h-56"
                  viewBox="0 0 460 200"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <rect width="460" height="200" rx="16" style={{ fill: "var(--bg-card)" }} />
                  {/* Trapezoid of Vowels */}
                  <polygon
                    points="60,50 380,50 320,150 140,150"
                    stroke="#7A756C"
                    strokeWidth="2"
                    fill="rgba(156, 122, 60, 0.08)"
                  />
                  {/* [i] point */}
                  <circle cx="80" cy="65" r="6" fill="#3B596A" />
                  <text x="75" y="45" fill="#3B596A" fontSize="12" fontWeight="bold">
                    [i] (anterior)
                  </text>
                  {/* [y] ü point (same position, rounded lips) */}
                  <circle cx="120" cy="65" r="8" fill="#3A6B59" />
                  <text x="110" y="95" fill="#3A6B59" fontSize="13" fontWeight="bold">
                    ü [y] (Língua de i + Lábios de u!)
                  </text>
                  {/* [u] point */}
                  <circle cx="360" cy="65" r="6" fill="#9E2A2B" />
                  <text x="350" y="45" fill="#9E2A2B" fontSize="12" fontWeight="bold">
                    [u] (posterior)
                  </text>
                  {/* Guidance Arrow from i to y */}
                  <path d="M 90 65 L 110 65" stroke="#9C7A3C" strokeWidth="3" />
                  <text x="230" y="175" fill="#7A756C" fontSize="11" textAnchor="middle">
                    Língua no mesmo lugar do &apos;i&apos;; apenas arredonde os lábios em &apos;u&apos;!
                  </text>
                </svg>
              )}

              {activeGuide.svgDiagramType === "pitch_chao_5" && (
                <div className="w-full">
                  <PitchContourCanvas
                    primaryContour={generateTheoreticalChaoContour([1], false)}
                    primaryLabel="1º Tom (55)"
                    primaryTone={1}
                    secondaryContour={generateTheoreticalChaoContour([4], false)}
                    secondaryLabel="4º Tom (51)"
                    secondaryTone={4}
                    height={180}
                  />
                </div>
              )}
            </div>

            {/* Armadilha para Brasileiros & Truque Prático */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30 space-y-1.5">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wide">
                  Armadilha Acústica para Lusófonos
                </span>
                <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                  {activeGuide.brazilianTrapPt}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 space-y-1.5">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wide">
                  O Truque Prático Infalível
                </span>
                <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                  {activeGuide.paperTestOrTrickPt}
                </p>
              </div>
            </div>

            {/* Sílabas de Demonstração */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Sílabas Canônicas de Demonstração
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {activeGuide.demoSyllables.map((syl, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() =>
                      playLexicalItemAudio(
                        { hanzi: syl.hanzi, audioKey: syl.audioKey },
                        props.activeVoice,
                        props.activeSpeed,
                        props.audioManifest
                      )
                    }
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-emerald-500 text-left transition group shadow-md"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xl font-bold font-hanzi text-white group-hover:text-emerald-400 transition">
                        {syl.hanzi}
                      </span>
                      <Volume2 className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition" />
                    </div>
                    <p className="text-sm font-bold font-pinyin text-emerald-300 mt-1">
                      {syl.pinyin}
                    </p>
                    <p className="text-xs text-slate-400 font-mono">{syl.ipa}</p>
                    <p className="text-[11px] text-slate-500 mt-1 truncate">
                      {syl.label}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Ação Direta: Treinar na Arena */}
            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() =>
                  props.onNavigateTab("arena", {
                    filterCategory:
                      activeGuide.category === "aspiration"
                        ? "initial_aspiration"
                        : activeGuide.category === "retroflex_palatal_dental"
                        ? "initial_place"
                        : activeGuide.category === "nasal_codas"
                        ? "final_nasal"
                        : activeGuide.category === "vowels_umlaut"
                        ? "final_vowel"
                        : "all",
                  })
                }
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs sm:text-sm transition shadow-lg shadow-emerald-500/20 active:scale-95"
              >
                Treinar Pares Mínimos desta Categoria na Arena
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Ordem dos Traços (Hanzi Writer) */}
      {modalHanzi && (
        <HanziStrokeModal
          hanziSimplified={modalHanzi.simplified}
          hanziTraditional={modalHanzi.traditional}
          pinyin={modalHanzi.pinyin}
          meaningPt={modalHanzi.meaningPt}
          onClose={() => setModalHanzi(null)}
        />
      )}
    </div>
  );
}
