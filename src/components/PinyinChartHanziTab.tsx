"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Search,
  Volume2,
  Play,
  RotateCw,
  Sparkles,
  Layers,
  Sliders,
  ExternalLink,
  ChevronRight,
  BookOpen,
  X,
  Flame,
  Check,
  Grid,
  LayoutGrid,
} from "lucide-react";
import { SharedModuleProps } from "@/types/ui-props";
import {
  SyllableCell,
  SyllableToneVariant,
  ToneNumber,
  VoiceId,
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
// CANONICAL SYLLABLES REPOSITORY (Comprehensive Fallback & Augmentation)
// ============================================================================

const CANONICAL_INITIAL_GROUPS = [
  { id: "all", label: "Todas as Iniciais" },
  { id: "bilabial_labiodental", label: "Labiais (b, p, m, f)" },
  { id: "alveolar", label: "Alveolares (d, t, n, l)" },
  { id: "velar", label: "Velares (g, k, h)" },
  { id: "alveolo_palatal", label: "Alveolopalatais (j, q, x)" },
  { id: "retroflex", label: "Retroflexas (zh, ch, sh, r)" },
  { id: "dental_sibilant", label: "Dentais (z, c, s)" },
  { id: "zero_initial", label: "Inicial Zero (Ø / y / w)" },
];

const CANONICAL_FINAL_GROUPS = [
  { id: "all", label: "Todas as Finais" },
  { id: "simple", label: "Simples (a, o, e, i, u, ü)" },
  { id: "diphthong", label: "Ditongos (ai, ei, ao, ou)" },
  { id: "nasal_n", label: "Nasais -n (an, en, in, un)" },
  { id: "nasal_ng", label: "Nasais -ng (ang, eng, ing, ong)" },
  { id: "medial_i", label: "Mediais i (ia, iao, ian, iang)" },
  { id: "medial_u", label: "Mediais u (ua, uo, uai, uan)" },
  { id: "medial_v", label: "Mediais ü (üe, üan, ün)" },
];

// Fallback high-utility canonical syllables dictionary
const FALLBACK_SYLLABLES: Record<string, SyllableCell> = {
  ma: {
    basePinyin: "ma",
    asciiBase: "ma",
    initial: "m",
    final: "a",
    initialGroup: "bilabial_labiodental",
    finalGroup: "simple",
    ipaBase: "/ma/",
    tones: {
      1: {
        tone: 1,
        pinyin: "mā",
        pinyinTone3: "ma1",
        asciiFilename: "ma1.mp3",
        ipa: "/ma˥˥/",
        chao: "55",
        representativeHanzi: "妈",
        representativeTrad: "媽",
        meaningPt: "Mãe / Mamãe",
        meaningEn: "Mother / Mom",
        examples: [{ hanzi: "妈妈", traditional: "媽媽", pinyin: "māma", meaningPt: "Mamãe", meaningEn: "Mom", hsk: 1 }],
        hasHumanFemale: true,
        hasHumanMale: true,
        audioUrls: {},
      },
      2: {
        tone: 2,
        pinyin: "má",
        pinyinTone3: "ma2",
        asciiFilename: "ma2.mp3",
        ipa: "/ma˧˥/",
        chao: "35",
        representativeHanzi: "麻",
        representativeTrad: "麻",
        meaningPt: "Cânhamo / Dormente",
        meaningEn: "Hemp / Numb",
        examples: [{ hanzi: "麻烦", traditional: "麻煩", pinyin: "máfan", meaningPt: "Incômodo / Trabalhoso", meaningEn: "Troublesome", hsk: 2 }],
        hasHumanFemale: true,
        hasHumanMale: true,
        audioUrls: {},
      },
      3: {
        tone: 3,
        pinyin: "mǎ",
        pinyinTone3: "ma3",
        asciiFilename: "ma3.mp3",
        ipa: "/ma˨˩˦/",
        chao: "214",
        representativeHanzi: "马",
        representativeTrad: "馬",
        meaningPt: "Cavalo",
        meaningEn: "Horse",
        examples: [{ hanzi: "马上", traditional: "馬上", pinyin: "mǎshàng", meaningPt: "Imediatamente / Já", meaningEn: "Immediately", hsk: 2 }],
        hasHumanFemale: true,
        hasHumanMale: true,
        audioUrls: {},
      },
      4: {
        tone: 4,
        pinyin: "mà",
        pinyinTone3: "ma4",
        asciiFilename: "ma4.mp3",
        ipa: "/ma˥˩/",
        chao: "51",
        representativeHanzi: "骂",
        representativeTrad: "罵",
        meaningPt: "Xingar / Repreender",
        meaningEn: "To scold / curse",
        examples: [{ hanzi: "责骂", traditional: "責罵", pinyin: "zémà", meaningPt: "Repreender com rigor", meaningEn: "To reprimand", hsk: 4 }],
        hasHumanFemale: true,
        hasHumanMale: true,
        audioUrls: {},
      },
      5: {
        tone: 5,
        pinyin: "ma",
        pinyinTone3: "ma5",
        asciiFilename: "ma5.mp3",
        ipa: "/ma/",
        chao: "~2",
        representativeHanzi: "吗",
        representativeTrad: "嗎",
        meaningPt: "Partícula interrogativa (sim/não)",
        meaningEn: "Question particle",
        examples: [{ hanzi: "你好吗", traditional: "你好嗎", pinyin: "nǐ hǎo ma", meaningPt: "Tudo bem?", meaningEn: "How are you?", hsk: 1 }],
        hasHumanFemale: true,
        hasHumanMale: true,
        audioUrls: {},
      },
    },
  },
  ba: {
    basePinyin: "ba",
    asciiBase: "ba",
    initial: "b",
    final: "a",
    initialGroup: "bilabial_labiodental",
    finalGroup: "simple",
    ipaBase: "/pa/",
    tones: {
      1: {
        tone: 1,
        pinyin: "bā",
        pinyinTone3: "ba1",
        asciiFilename: "ba1.mp3",
        ipa: "/pa˥˥/",
        chao: "55",
        representativeHanzi: "八",
        representativeTrad: "八",
        meaningPt: "Oito (8)",
        meaningEn: "Eight (8)",
        examples: [{ hanzi: "八月", traditional: "八月", pinyin: "bā yuè", meaningPt: "Agosto", meaningEn: "August", hsk: 1 }],
        hasHumanFemale: true,
        hasHumanMale: true,
        audioUrls: {},
      },
      2: {
        tone: 2,
        pinyin: "bá",
        pinyinTone3: "ba2",
        asciiFilename: "ba2.mp3",
        ipa: "/pa˧˥/",
        chao: "35",
        representativeHanzi: "拔",
        representativeTrad: "拔",
        meaningPt: "Puxar / Arrancar",
        meaningEn: "To pull out / uproot",
        examples: [{ hanzi: "拔河", traditional: "拔河", pinyin: "báhé", meaningPt: "Cabo de guerra", meaningEn: "Tug-of-war", hsk: 4 }],
        hasHumanFemale: true,
        hasHumanMale: true,
        audioUrls: {},
      },
      3: {
        tone: 3,
        pinyin: "bǎ",
        pinyinTone3: "ba3",
        asciiFilename: "ba3.mp3",
        ipa: "/pa˨˩˦/",
        chao: "214",
        representativeHanzi: "把",
        representativeTrad: "把",
        meaningPt: "Segurar / Partícula de objeto direto",
        meaningEn: "To hold / target marker",
        examples: [{ hanzi: "握把", traditional: "握把", pinyin: "wòbǎ", meaningPt: "Guidão / Maçaneta", meaningEn: "Handle", hsk: 3 }],
        hasHumanFemale: true,
        hasHumanMale: true,
        audioUrls: {},
      },
      4: {
        tone: 4,
        pinyin: "bà",
        pinyinTone3: "ba4",
        asciiFilename: "ba4.mp3",
        ipa: "/pa˥˩/",
        chao: "51",
        representativeHanzi: "爸",
        representativeTrad: "爸",
        meaningPt: "Pai / Papai",
        meaningEn: "Father / Dad",
        examples: [{ hanzi: "爸爸", traditional: "爸爸", pinyin: "bàba", meaningPt: "Papai", meaningEn: "Dad", hsk: 1 }],
        hasHumanFemale: true,
        hasHumanMale: true,
        audioUrls: {},
      },
    },
  },
  pa: {
    basePinyin: "pa",
    asciiBase: "pa",
    initial: "p",
    final: "a",
    initialGroup: "bilabial_labiodental",
    finalGroup: "simple",
    ipaBase: "/pʰa/",
    tones: {
      1: {
        tone: 1,
        pinyin: "pā",
        pinyinTone3: "pa1",
        asciiFilename: "pa1.mp3",
        ipa: "/pʰa˥˥/",
        chao: "55",
        representativeHanzi: "趴",
        representativeTrad: "趴",
        meaningPt: "Deitar de bruços",
        meaningEn: "To lie on stomach",
        examples: [{ hanzi: "趴着", traditional: "趴著", pinyin: "pāzhe", meaningPt: "De bruços", meaningEn: "Prone", hsk: 3 }],
        hasHumanFemale: true,
        hasHumanMale: true,
        audioUrls: {},
      },
      2: {
        tone: 2,
        pinyin: "pá",
        pinyinTone3: "pa2",
        asciiFilename: "pa2.mp3",
        ipa: "/pʰa˧˥/",
        chao: "35",
        representativeHanzi: "爬",
        representativeTrad: "爬",
        meaningPt: "Rastejar / Escalar",
        meaningEn: "To crawl / climb",
        examples: [{ hanzi: "爬山", traditional: "爬山", pinyin: "páshān", meaningPt: "Fazer trilha / Escalar montanha", meaningEn: "Climb mountain", hsk: 2 }],
        hasHumanFemale: true,
        hasHumanMale: true,
        audioUrls: {},
      },
      4: {
        tone: 4,
        pinyin: "pà",
        pinyinTone3: "pa4",
        asciiFilename: "pa4.mp3",
        ipa: "/pʰa˥˩/",
        chao: "51",
        representativeHanzi: "怕",
        representativeTrad: "怕",
        meaningPt: "Ter medo / Temer",
        meaningEn: "To fear / afraid",
        examples: [{ hanzi: "害怕", traditional: "害怕", pinyin: "hàipà", meaningPt: "Estar com medo", meaningEn: "Afraid", hsk: 2 }],
        hasHumanFemale: true,
        hasHumanMale: true,
        audioUrls: {},
      },
    },
  },
  shi: {
    basePinyin: "shi",
    asciiBase: "shi",
    initial: "sh",
    final: "i",
    initialGroup: "retroflex",
    finalGroup: "simple",
    ipaBase: "/ʂʐ̩/",
    tones: {
      1: {
        tone: 1,
        pinyin: "shī",
        pinyinTone3: "shi1",
        asciiFilename: "shi1.mp3",
        ipa: "/ʂʐ̩˥˥/",
        chao: "55",
        representativeHanzi: "师",
        representativeTrad: "師",
        meaningPt: "Professor / Mestre",
        meaningEn: "Teacher / Master",
        examples: [{ hanzi: "老师", traditional: "老師", pinyin: "lǎoshī", meaningPt: "Professor(a)", meaningEn: "Teacher", hsk: 1 }],
        hasHumanFemale: true,
        hasHumanMale: true,
        audioUrls: {},
      },
      2: {
        tone: 2,
        pinyin: "shí",
        pinyinTone3: "shi2",
        asciiFilename: "shi2.mp3",
        ipa: "/ʂʐ̩˧˥/",
        chao: "35",
        representativeHanzi: "十",
        representativeTrad: "十",
        meaningPt: "Dez (10) / Tempo",
        meaningEn: "Ten (10) / Time",
        examples: [{ hanzi: "时间", traditional: "時間", pinyin: "shíjiān", meaningPt: "Tempo (cronológico)", meaningEn: "Time", hsk: 1 }],
        hasHumanFemale: true,
        hasHumanMale: true,
        audioUrls: {},
      },
      3: {
        tone: 3,
        pinyin: "shǐ",
        pinyinTone3: "shi3",
        asciiFilename: "shi3.mp3",
        ipa: "/ʂʐ̩˨˩˦/",
        chao: "214",
        representativeHanzi: "使",
        representativeTrad: "使",
        meaningPt: "Fazer com que / Usar / História",
        meaningEn: "To make / cause / history",
        examples: [{ hanzi: "历史", traditional: "歷史", pinyin: "lìshǐ", meaningPt: "História", meaningEn: "History", hsk: 3 }],
        hasHumanFemale: true,
        hasHumanMale: true,
        audioUrls: {},
      },
      4: {
        tone: 4,
        pinyin: "shì",
        pinyinTone3: "shi4",
        asciiFilename: "shi4.mp3",
        ipa: "/ʂʐ̩˥˩/",
        chao: "51",
        representativeHanzi: "是",
        representativeTrad: "是",
        meaningPt: "Ser / Sim / Correto",
        meaningEn: "To be / yes",
        examples: [{ hanzi: "不是", traditional: "不是", pinyin: "bú shì", meaningPt: "Não é", meaningEn: "Is not", hsk: 1 }],
        hasHumanFemale: true,
        hasHumanMale: true,
        audioUrls: {},
      },
    },
  },
  xi: {
    basePinyin: "xi",
    asciiBase: "xi",
    initial: "x",
    final: "i",
    initialGroup: "alveolo_palatal",
    finalGroup: "simple",
    ipaBase: "/ɕi/",
    tones: {
      1: {
        tone: 1,
        pinyin: "xī",
        pinyinTone3: "xi1",
        asciiFilename: "xi1.mp3",
        ipa: "/ɕi˥˥/",
        chao: "55",
        representativeHanzi: "西",
        representativeTrad: "西",
        meaningPt: "Oeste / Ocidente",
        meaningEn: "West",
        examples: [{ hanzi: "东西", traditional: "東西", pinyin: "dōngxi", meaningPt: "Coisa / Objeto", meaningEn: "Thing", hsk: 1 }],
        hasHumanFemale: true,
        hasHumanMale: true,
        audioUrls: {},
      },
      2: {
        tone: 2,
        pinyin: "xí",
        pinyinTone3: "xi2",
        asciiFilename: "xi2.mp3",
        ipa: "/ɕi˧˥/",
        chao: "35",
        representativeHanzi: "习",
        representativeTrad: "習",
        meaningPt: "Praticar / Hábito",
        meaningEn: "To practice",
        examples: [{ hanzi: "学习", traditional: "學習", pinyin: "xuéxí", meaningPt: "Estudar", meaningEn: "To study", hsk: 1 }],
        hasHumanFemale: true,
        hasHumanMale: true,
        audioUrls: {},
      },
      3: {
        tone: 3,
        pinyin: "xǐ",
        pinyinTone3: "xi3",
        asciiFilename: "xi3.mp3",
        ipa: "/ɕi˨˩˦/",
        chao: "214",
        representativeHanzi: "喜",
        representativeTrad: "喜",
        meaningPt: "Gostar / Alegria / Lavar",
        meaningEn: "Joy / To wash",
        examples: [{ hanzi: "喜欢", traditional: "喜歡", pinyin: "xǐhuan", meaningPt: "Gostar de", meaningEn: "To like", hsk: 1 }],
        hasHumanFemale: true,
        hasHumanMale: true,
        audioUrls: {},
      },
      4: {
        tone: 4,
        pinyin: "xì",
        pinyinTone3: "xi4",
        asciiFilename: "xi4.mp3",
        ipa: "/ɕi˥˩/",
        chao: "51",
        representativeHanzi: "细",
        representativeTrad: "細",
        meaningPt: "Fino / Minucioso / Sistema",
        meaningEn: "Fine / Detail / System",
        examples: [{ hanzi: "仔细", traditional: "仔細", pinyin: "zǐxì", meaningPt: "Cuidadoso / Atento", meaningEn: "Careful", hsk: 3 }],
        hasHumanFemale: true,
        hasHumanMale: true,
        audioUrls: {},
      },
    },
  },
  lü: {
    basePinyin: "lü",
    asciiBase: "lv",
    initial: "l",
    final: "ü",
    initialGroup: "alveolar",
    finalGroup: "simple",
    ipaBase: "/ly/",
    tones: {
      3: {
        tone: 3,
        pinyin: "lǚ",
        pinyinTone3: "lv3",
        asciiFilename: "lv3.mp3",
        ipa: "/ly˨˩˦/",
        chao: "214",
        representativeHanzi: "旅",
        representativeTrad: "旅",
        meaningPt: "Viagem / Viajar",
        meaningEn: "Trip / Travel",
        examples: [{ hanzi: "旅游", traditional: "旅遊", pinyin: "lǚyóu", meaningPt: "Fazer turismo", meaningEn: "Tourism", hsk: 2 }],
        hasHumanFemale: true,
        hasHumanMale: true,
        audioUrls: {},
      },
      4: {
        tone: 4,
        pinyin: "lǜ",
        pinyinTone3: "lv4",
        asciiFilename: "lv4.mp3",
        ipa: "/ly˥˩/",
        chao: "51",
        representativeHanzi: "绿",
        representativeTrad: "綠",
        meaningPt: "Verde (cor)",
        meaningEn: "Green",
        examples: [{ hanzi: "绿茶", traditional: "綠茶", pinyin: "lǜchá", meaningPt: "Chá verde", meaningEn: "Green tea", hsk: 2 }],
        hasHumanFemale: true,
        hasHumanMale: true,
        audioUrls: {},
      },
    },
  },
  lu: {
    basePinyin: "lu",
    asciiBase: "lu",
    initial: "l",
    final: "u",
    initialGroup: "alveolar",
    finalGroup: "simple",
    ipaBase: "/lu/",
    tones: {
      4: {
        tone: 4,
        pinyin: "lù",
        pinyinTone3: "lu4",
        asciiFilename: "lu4.mp3",
        ipa: "/lu˥˩/",
        chao: "51",
        representativeHanzi: "路",
        representativeTrad: "路",
        meaningPt: "Rua / Estrada",
        meaningEn: "Road / Street",
        examples: [{ hanzi: "走路", traditional: "走路", pinyin: "zǒulù", meaningPt: "Caminhar a pé", meaningEn: "Walk", hsk: 2 }],
        hasHumanFemale: true,
        hasHumanMale: true,
        audioUrls: {},
      },
    },
  },
  zhong: {
    basePinyin: "zhong",
    asciiBase: "zhong",
    initial: "zh",
    final: "ong",
    initialGroup: "retroflex",
    finalGroup: "nasal_ng",
    ipaBase: "/ʈ͡ʂʊŋ/",
    tones: {
      1: {
        tone: 1,
        pinyin: "zhōng",
        pinyinTone3: "zhong1",
        asciiFilename: "zhong1.mp3",
        ipa: "/ʈ͡ʂʊŋ˥˥/",
        chao: "55",
        representativeHanzi: "中",
        representativeTrad: "中",
        meaningPt: "Centro / Meio / China",
        meaningEn: "Middle / China",
        examples: [{ hanzi: "中国", traditional: "中國", pinyin: "zhōngguó", meaningPt: "China", meaningEn: "China", hsk: 1 }],
        hasHumanFemale: true,
        hasHumanMale: true,
        audioUrls: {},
      },
      3: {
        tone: 3,
        pinyin: "zhǒng",
        pinyinTone3: "zhong3",
        asciiFilename: "zhong3.mp3",
        ipa: "/ʈ͡ʂʊŋ˨˩˦/",
        chao: "214",
        representativeHanzi: "种",
        representativeTrad: "種",
        meaningPt: "Tipo / Semente",
        meaningEn: "Kind / Seed",
        examples: [{ hanzi: "各种", traditional: "各種", pinyin: "gèzhǒng", meaningPt: "Vários tipos", meaningEn: "Various", hsk: 3 }],
        hasHumanFemale: true,
        hasHumanMale: true,
        audioUrls: {},
      },
      4: {
        tone: 4,
        pinyin: "zhòng",
        pinyinTone3: "zhong4",
        asciiFilename: "zhong4.mp3",
        ipa: "/ʈ͡ʂʊŋ˥˩/",
        chao: "51",
        representativeHanzi: "重",
        representativeTrad: "重",
        meaningPt: "Pesado / Importante",
        meaningEn: "Heavy / Important",
        examples: [{ hanzi: "重要", traditional: "重要", pinyin: "zhòngyào", meaningPt: "Importante", meaningEn: "Important", hsk: 2 }],
        hasHumanFemale: true,
        hasHumanMale: true,
        audioUrls: {},
      },
    },
  },
};

// ============================================================================
// COMPONENT: PinyinChartHanziTab
// ============================================================================

export default function PinyinChartHanziTab(props: SharedModuleProps) {
  // Filters
  const [initialGroupFilter, setInitialGroupFilter] = useState<string>("all");
  const [finalGroupFilter, setFinalGroupFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [viewLayout, setViewLayout] = useState<"cards" | "dense">("cards");

  // Selected Syllable for the X-Ray Drawer
  const [selectedKey, setSelectedKey] = useState<string>("ma");
  const [focusedTone, setFocusedTone] = useState<ToneNumber>(1);
  const [isSequencing, setIsSequencing] = useState<boolean>(false);

  // Combine database syllables with fallback dictionary
  const syllablesMap = useMemo(() => {
    const raw = props.syllablesChart?.syllables;
    if (raw && Object.keys(raw).length > 0) {
      return { ...FALLBACK_SYLLABLES, ...raw };
    }
    return FALLBACK_SYLLABLES;
  }, [props.syllablesChart]);

  // Filtered Syllables List
  const filteredSyllables = useMemo(() => {
    return Object.entries(syllablesMap).filter(([key, syl]) => {
      // Search filter
      const q = searchQuery.toLowerCase().trim();
      if (q) {
        const matchesBase = syl.basePinyin.toLowerCase().includes(q);
        const matchesAscii = syl.asciiBase.toLowerCase().includes(q);
        const matchesTones = Object.values(syl.tones).some((v) =>
          v.pinyin.toLowerCase().includes(q) ||
          v.representativeHanzi.includes(q) ||
          v.meaningPt.toLowerCase().includes(q)
        );
        if (!matchesBase && !matchesAscii && !matchesTones) return false;
      }

      // Initial Group filter
      if (
        initialGroupFilter !== "all" &&
        syl.initialGroup !== initialGroupFilter
      ) {
        return false;
      }

      // Final Group filter
      if (
        finalGroupFilter !== "all" &&
        syl.finalGroup !== finalGroupFilter
      ) {
        return false;
      }

      return true;
    });
  }, [syllablesMap, searchQuery, initialGroupFilter, finalGroupFilter]);

  const selectedSyllable: SyllableCell =
    syllablesMap[selectedKey] || Object.values(syllablesMap)[0];

  // Set default focused tone whenever selected syllable changes
  useEffect(() => {
    if (selectedSyllable) {
      const availableTones = Object.keys(selectedSyllable.tones).map(Number) as ToneNumber[];
      if (availableTones.length > 0 && !availableTones.includes(focusedTone)) {
        setFocusedTone(availableTones[0]);
      }
    }
  }, [selectedKey, selectedSyllable, focusedTone]);

  // Handle single tone playback
  const handlePlayTone = async (toneVar: SyllableToneVariant) => {
    setFocusedTone(toneVar.tone);
    await playLexicalItemAudio(
      {
        hanzi: toneVar.representativeHanzi,
        pinyinTone3: toneVar.pinyinTone3,
        asciiKey: toneVar.asciiFilename.replace(".mp3", ""),
        tones: [toneVar.tone],
      },
      props.activeVoice,
      props.activeSpeed,
      props.audioManifest
    );
  };

  // Play Full Tone Sequence T1 -> T2 -> T3 -> T4
  const handlePlaySequence = async () => {
    if (!selectedSyllable || isSequencing) return;
    setIsSequencing(true);
    stopAllAudio();

    const sequenceTones: ToneNumber[] = [1, 2, 3, 4];
    for (const t of sequenceTones) {
      const variant = selectedSyllable.tones[t];
      if (variant) {
        setFocusedTone(t);
        await playLexicalItemAudio(
          {
            hanzi: variant.representativeHanzi,
            pinyinTone3: variant.pinyinTone3,
            asciiKey: variant.asciiFilename.replace(".mp3", ""),
            tones: [t],
          },
          props.activeVoice,
          "classroom",
          props.audioManifest
        );
        // Small interval between tones
        await new Promise((r) => setTimeout(r, 420));
      }
    }
    setIsSequencing(false);
  };

  const focusedVariant: SyllableToneVariant | undefined =
    selectedSyllable?.tones[focusedTone] ||
    Object.values(selectedSyllable?.tones || {})[0];

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      {/* Top Header Banner */}
      <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <Layers className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Tabela Pinyin & Raio-X Fonético Hanzi
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Matriz completa de sílabas do Mandarim Padrão, análise dos 5 tons acústicos e traços canônicos em 米字格.
          </p>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800">
            <button
              type="button"
              onClick={() => setViewLayout("cards")}
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                viewLayout === "cards"
                  ? "bg-sky-500 text-slate-950"
                  : "text-slate-400 hover:text-white"
              }`}
              title="Cards Agrupados"
            >
              <LayoutGrid className="w-4 h-4" />
              Cards
            </button>
            <button
              type="button"
              onClick={() => setViewLayout("dense")}
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                viewLayout === "dense"
                  ? "bg-sky-500 text-slate-950"
                  : "text-slate-400 hover:text-white"
              }`}
              title="Grade Densa"
            >
              <Grid className="w-4 h-4" />
              Densa
            </button>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 flex flex-wrap items-center gap-3 text-xs">
        {/* Search */}
        <div className="relative min-w-[200px] flex-1 sm:flex-initial">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar sílaba (ex: ma, shi, lü, de)..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500 transition"
          />
        </div>

        {/* Initial Group Filter */}
        <select
          value={initialGroupFilter}
          onChange={(e) => setInitialGroupFilter(e.target.value)}
          className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 font-medium focus:outline-none focus:border-sky-500"
        >
          {CANONICAL_INITIAL_GROUPS.map((ig) => (
            <option key={ig.id} value={ig.id}>
              {ig.label}
            </option>
          ))}
        </select>

        {/* Final Group Filter */}
        <select
          value={finalGroupFilter}
          onChange={(e) => setFinalGroupFilter(e.target.value)}
          className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 font-medium focus:outline-none focus:border-sky-500"
        >
          {CANONICAL_FINAL_GROUPS.map((fg) => (
            <option key={fg.id} value={fg.id}>
              {fg.label}
            </option>
          ))}
        </select>

        <span className="text-slate-500 font-mono ml-auto">
          {filteredSyllables.length} sílabas encontradas
        </span>
      </div>

      {/* Main Grid & Drawer Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT / CENTER: Syllables Matrix / Cards Grid (7 Cols on desktop) */}
        <div className="lg:col-span-7 space-y-4">
          <div
            className={`grid gap-2.5 max-h-[750px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-800 ${
              viewLayout === "dense"
                ? "grid-cols-3 sm:grid-cols-4 md:grid-cols-5"
                : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4"
            }`}
          >
            {filteredSyllables.map(([key, syl]) => {
              const isSelected = key === selectedKey;
              const tonesList = Object.keys(syl.tones).map(Number) as ToneNumber[];

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedKey(key)}
                  className={`p-3 rounded-2xl border text-left transition group shadow-md flex flex-col justify-between ${
                    isSelected
                      ? "bg-sky-500/15 border-sky-400 ring-2 ring-sky-500/20"
                      : "bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-900"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xl font-bold font-pinyin tracking-wide transition ${
                        isSelected
                          ? "text-sky-300"
                          : "text-white group-hover:text-sky-400"
                      }`}
                    >
                      {syl.basePinyin}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      {syl.ipaBase}
                    </span>
                  </div>

                  {/* Tone presence indicator dots */}
                  <div className="flex items-center gap-1.5 mt-2.5">
                    {([1, 2, 3, 4, 5] as ToneNumber[]).map((t) => {
                      const hasTone = tonesList.includes(t);
                      return (
                        <span
                          key={t}
                          className="w-2.5 h-2.5 rounded-full transition"
                          style={{
                            backgroundColor: hasTone
                              ? TONE_COLORS[t]
                              : "var(--border-color)",
                          }}
                          title={hasTone ? TONE_LABELS_PT[t] : `Sem ${t}º tom`}
                        />
                      );
                    })}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* RIGHT: Phonetic X-Ray Drawer Panel (5 Cols on desktop) */}
        <div className="lg:col-span-5 space-y-5 sticky top-4">
          {selectedSyllable && (
            <div className="bg-xuan-card border-2 border-xuan-border rounded-2xl p-5 sm:p-6 shadow-sm space-y-5">
              {/* Drawer Header */}
              <div className="flex items-start justify-between border-b border-xuan-border pb-4">
                <div>
                  <span className="text-xs uppercase font-bold tracking-wider text-[#9E2A2B]">
                    Raio-X Fonético da Sílaba
                  </span>
                  <div className="flex items-baseline gap-3 mt-1">
                    <h2 className="text-4xl font-extrabold font-pinyin text-xuan-ink">
                      {selectedSyllable.basePinyin}
                    </h2>
                    <span className="text-sm font-mono text-xuan-muted">
                      IPA: {selectedSyllable.ipaBase}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handlePlaySequence}
                  disabled={isSequencing}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#9E2A2B] hover:bg-[#7D2021] text-[#F5F2E9] text-xs font-bold transition shadow-sm active:scale-95 disabled:opacity-50"
                  title="Tocar T1 ➔ T2 ➔ T3 ➔ T4 em sequência"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {isSequencing ? "Tocando..." : "Escala T1➔T4"}
                </button>
              </div>

              {/* Tone Variants Selector Pills */}
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-xuan-muted block">
                  Tons Disponíveis
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {([1, 2, 3, 4, 5] as ToneNumber[]).map((t) => {
                    const variant = selectedSyllable.tones[t];
                    const isFocused = focusedTone === t;
                    if (!variant) return null;

                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => handlePlayTone(variant)}
                        className={`p-2.5 rounded-xl border text-center transition ${
                          isFocused
                            ? "ring-1"
                            : "bg-xuan-bg border-xuan-border hover:border-[#9E2A2B]"
                        }`}
                        style={{
                          borderColor: isFocused ? TONE_COLORS[t] : undefined,
                          backgroundColor: isFocused ? `${TONE_COLORS[t]}18` : undefined,
                          color: isFocused ? TONE_COLORS[t] : "var(--text-primary)",
                        }}
                      >
                        <span className="text-lg font-bold font-pinyin block">
                          {variant.pinyin}
                        </span>
                        <span className="text-xs font-hanzi block text-xuan-ink font-semibold">
                          {variant.representativeHanzi}
                        </span>
                        <span className="text-[10px] font-mono text-xuan-muted block">
                          {variant.chao}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Pitch Contour Canvas of Focused Tone */}
              {focusedVariant && (
                <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-4 shadow-inner">
                  <PitchContourCanvas
                    primaryContour={generateTheoreticalChaoContour([focusedVariant.tone], false)}
                    primaryLabel={`${focusedVariant.pinyin} (${TONE_LABELS_PT[focusedVariant.tone]})`}
                    primaryTone={focusedVariant.tone}
                    height={160}
                  />
                  <div className="flex items-center justify-between text-xs text-slate-400 mt-2 px-1">
                    <span>IPA: {focusedVariant.ipa}</span>
                    <span>Significado: {focusedVariant.meaningPt}</span>
                  </div>
                </div>
              )}

              {/* HSK Example Words (if any) */}
              {focusedVariant?.examples && focusedVariant.examples.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                    Vocabulário Exemplo (HSK)
                  </span>
                  <div className="space-y-1.5">
                    {focusedVariant.examples.map((ex, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800/60 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-base font-bold font-hanzi text-sky-300">
                            {props.profile.preferredScript === "traditional" &&
                            ex.traditional
                              ? ex.traditional
                              : ex.hanzi}
                          </span>
                          <span className="font-pinyin font-medium text-slate-300">
                            {ex.pinyin}
                          </span>
                          {ex.hsk && (
                            <span className="px-1.5 py-0.2 rounded bg-slate-800 text-[10px] text-slate-400">
                              HSK {ex.hsk}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 text-right">
                            {ex.meaningPt}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              playLexicalItemAudio(
                                { hanzi: ex.hanzi },
                                props.activeVoice,
                                props.activeSpeed,
                                props.audioManifest
                              )
                            }
                            className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                            title="Ouvir palavra"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Hanzi Stroke Practice Modal Inline */}
              {focusedVariant && (
                <div className="border-t border-slate-800 pt-4 space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                    Treinador de Traços Calligráficos (米字格)
                  </span>
                  <div className="flex justify-center">
                    <HanziStrokeModal
                      inline={true}
                      hanziSimplified={focusedVariant.representativeHanzi}
                      hanziTraditional={focusedVariant.representativeTrad}
                      pinyin={focusedVariant.pinyin}
                      meaningPt={focusedVariant.meaningPt}
                    />
                  </div>
                </div>
              )}

              {/* Action Button: Train Minimal Pairs in Arena */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() =>
                    props.onNavigateTab("arena", {
                      initialSyllable: selectedSyllable.basePinyin,
                      filterSubCategory: "all",
                    })
                  }
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs sm:text-sm transition shadow-lg shadow-sky-500/20 active:scale-95"
                >
                  Treinar Pares Mínimos de &quot;{selectedSyllable.basePinyin}&quot; na Arena
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
