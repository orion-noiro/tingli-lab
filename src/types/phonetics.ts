export type ToneNumber = 1 | 2 | 3 | 4 | 5;

export type VoiceId =
  | "xiaoxiao"
  | "yunxi"
  | "xiaoyi"
  | "yunjian"
  | "xiaobei"
  | "hsiaochen"
  | "human_female"
  | "human_male";

export type SpeechSpeed = "classroom" | "conversational";

export type MinimalPairCategory =
  | "monosyllable_tone"
  | "dissyllable_tone_matrix"
  | "initial_aspiration"
  | "initial_place"
  | "final_nasal"
  | "final_vowel"
  | "context_sentence";

export interface LexicalItem {
  hanzi: string;
  traditional: string;
  pinyin: string; // e.g., "mǎ" or "shuǐjiǎo"
  pinyinTone3: string; // e.g., "ma3" or "shui3 jiao3"
  asciiKey: string; // e.g., "ma3" or "shui3_jiao3" (ü -> v)
  tones: ToneNumber[]; // [3] or [3, 3]
  initial: string; // e.g., "m", "sh", "zh", ""
  final: string; // e.g., "a", "ui", "ang"
  ipa: string; // e.g., "/ma˨˩˦/"
  chaoContour: string; // e.g., "214" or "21-214"
  meaningPt: string;
  meaningEn: string;
  hskLevel?: number;
  audioKey: string; // key into audio_manifest.json or relative path under /audio/
}

export interface MinimalPairEntry {
  id: string;
  category: MinimalPairCategory;
  subCategory: string;
  contrastLabelPt: string;
  contrastLabelEn: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  itemA: LexicalItem;
  itemB: LexicalItem;
  distractors?: LexicalItem[];
  articulatoryTipPt: string;
  articulatoryTipEn: string;
  sentenceContext?: {
    sentenceA: string;
    sentenceATrad: string;
    pinyinA: string;
    meaningPtA: string;
    meaningEnA: string;
    audioKeyA: string;
    sentenceB: string;
    sentenceBTrad: string;
    pinyinB: string;
    meaningPtB: string;
    meaningEnB: string;
    audioKeyB: string;
  };
}

export interface MinimalPairsDataset {
  version: string;
  generatedAt: string;
  totalPairs: number;
  categoriesSummary: Record<MinimalPairCategory, number>;
  pairs: MinimalPairEntry[];
}

// ============================================================================
// FULL SENTENCE TRAINING MODULE (整句听力)
// ============================================================================

export interface ContextualSentencePair {
  id: string;
  mode: "contextual_minimal_pairs";
  focusType: string;
  subCategory: string;
  difficulty: number;
  sentenceA: string;
  traditionalA: string;
  pinyinA: string;
  meaningPtA: string;
  meaningEnA: string;
  targetWordA: string;
  targetPinyinA: string;
  targetTonesA: ToneNumber[];
  audioKeyA: string;
  sentenceB: string;
  traditionalB: string;
  pinyinB: string;
  meaningPtB: string;
  meaningEnB: string;
  targetWordB: string;
  targetPinyinB: string;
  targetTonesB: ToneNumber[];
  audioKeyB: string;
  tipPt: string;
  tipEn: string;
}

export interface ProsodyToneSpottingItem {
  id: string;
  mode: "prosody_tone_spotting";
  sentence: string;
  traditional: string;
  pinyin: string;
  meaningPt: string;
  meaningEn: string;
  targetWord: string;
  targetPinyin: string;
  targetTones: ToneNumber[];
  difficulty: number;
  tipPt: string;
  tipEn: string;
  audioKey: string;
}

export interface SentenceReconstructionItem {
  id: string;
  mode: "sentence_reconstruction";
  sentence: string;
  traditional: string;
  pinyin: string;
  meaningPt: string;
  meaningEn: string;
  correctBlocks: string[];
  distractorBlocks: string[];
  difficulty: number;
  tipPt: string;
  tipEn: string;
  audioKey: string;
}

export interface SentencesMinimalPairsDataset {
  version: string;
  generatedAt: string;
  totalExercises: number;
  counts: {
    contextual_minimal_pairs: number;
    prosody_tone_spotting: number;
    sentence_reconstruction: number;
  };
  contextualPairs: ContextualSentencePair[];
  prosodySpotting: ProsodyToneSpottingItem[];
  sentenceReconstructions: SentenceReconstructionItem[];
}

// ============================================================================
// SYLLABLES, TONE SANDHI, SOUND GUIDES & AUDIO MANIFEST
// ============================================================================

export interface SyllableToneVariant {
  tone: ToneNumber;
  pinyin: string;
  pinyinTone3: string;
  asciiFilename: string;
  ipa: string;
  chao: string;
  representativeHanzi: string;
  representativeTrad: string;
  meaningPt: string;
  meaningEn: string;
  examples: Array<{
    hanzi: string;
    traditional: string;
    pinyin: string;
    meaningPt: string;
    meaningEn: string;
    hsk?: number;
  }>;
  hasHumanFemale: boolean;
  hasHumanMale: boolean;
  audioUrls: Partial<Record<VoiceId, string>>;
}

export interface SyllableCell {
  basePinyin: string;
  asciiBase: string;
  initial: string;
  final: string;
  initialGroup:
    | "bilabial_labiodental"
    | "alveolar"
    | "velar"
    | "alveolo_palatal"
    | "retroflex"
    | "dental_sibilant"
    | "zero_initial";
  finalGroup:
    | "simple"
    | "diphthong"
    | "nasal_n"
    | "nasal_ng"
    | "medial_i"
    | "medial_u"
    | "medial_v";
  ipaBase: string;
  tones: Partial<Record<ToneNumber, SyllableToneVariant>>;
}

export interface SyllablesChartDataset {
  version: string;
  initialsOrder: string[];
  finalsOrder: string[];
  totalBaseSyllables: number;
  totalTonalSyllables: number;
  syllables: Record<string, SyllableCell>;
}

export interface ToneSandhiExample {
  id: string;
  hanzi: string;
  traditional: string;
  underlyingPinyin: string;
  surfacePinyin: string;
  underlyingTones: ToneNumber[];
  surfaceTones: string;
  underlyingChao: string;
  surfaceChao: string;
  ipaSurface: string;
  meaningPt: string;
  meaningEn: string;
  explanationPt: string;
  explanationEn: string;
  audioKeyClassroom: string;
  audioKeyConversational: string;
  f0ContourUnderlying: number[];
  f0ContourSurface: number[];
}

export interface ToneSandhiRule {
  id: string;
  titlePt: string;
  titleEn: string;
  formula: string;
  category:
    | "third_tone_sandhi"
    | "half_third_tone"
    | "triple_third_tone"
    | "bu_sandhi"
    | "yi_sandhi"
    | "neutral_tone";
  summaryPt: string;
  summaryEn: string;
  acousticMechanicPt: string;
  acousticMechanicEn: string;
  examples: ToneSandhiExample[];
}

export interface SoundGuideSection {
  id: string;
  slug: string;
  category:
    | "tones"
    | "aspiration"
    | "retroflex_palatal_dental"
    | "nasal_codas"
    | "vowels_umlaut";
  titlePt: string;
  titleEn: string;
  subtitlePt: string;
  subtitleEn: string;
  ipaSymbols: string[];
  chaoNotation?: string[];
  tonguePositionPt: string;
  tonguePositionEn: string;
  brazilianTrapPt: string;
  brazilianTrapEn: string;
  paperTestOrTrickPt: string;
  paperTestOrTrickEn: string;
  svgDiagramType:
    | "pitch_chao_5"
    | "sagittal_bilabial_aspiration"
    | "sagittal_retroflex_vs_palatal"
    | "sagittal_alveolar_vs_velar_nasal"
    | "vowel_trapezoid_u_vs_v";
  keyPairsIds: string[];
  demoSyllables: Array<{
    label: string;
    hanzi: string;
    pinyin: string;
    ipa: string;
    audioKey: string;
  }>;
}

export interface AudioManifestItem {
  key: string;
  path: string;
  voice: VoiceId;
  speed: SpeechSpeed;
  durationSec: number;
  rmsDb: number;
  f0Chao: number[];
  f0Hz: number[];
  verified: boolean;
}

export interface AudioManifest {
  version: string;
  generatedAt: string;
  totalFiles: number;
  voicesAvailable: Array<{
    id: VoiceId;
    name: string;
    gender: "female" | "male";
    source: "human_native" | "azure_neural";
    descriptionPt: string;
  }>;
  items: Record<string, AudioManifestItem>;
}

// ============================================================================
// PEDAGOGICAL ENGINE, FSRS, CONFUSION MATRIX, ACCOUNTS & MULTIPLAYER
// ============================================================================

export type ScholarRank =
  | "童生 Tóngshēng"
  | "秀才 Xiùcái"
  | "举人 Jǔrén"
  | "贡士 Gòngshì"
  | "进士 Jìnshì"
  | "状元 Zhuàngyuán";

export interface AuthUser {
  id: number;
  username: string;
  displayName: string;
  scholarRank: ScholarRank;
  imperialRank?: string;
  eloRating: number;
  streakDays: number;
  xp: number;
  dissyllableAccuracy: number;
  sentenceAccuracy: number;
  avgReactionMs: number;
  createdAt: string;
}

export interface FSRSCardState {
  itemId: string;
  category: MinimalPairCategory | "tone_matrix_20" | "sandhi";
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
  lastReviewMs: number;
  nextDueMs: number;
  avgReactionMs: number;
  fastStreak: number;
}

export interface AttemptLog {
  id: string;
  profileId: string;
  timestamp: number;
  mode:
    | "maorma_1syl"
    | "maorma_2syl_matrix"
    | "abx_minimal_pairs"
    | "pinyin_dictation"
    | "context_sentences"
    | "prosody_spotting"
    | "sentence_reconstruction"
    | "oral_partner"
    | "oral_ai_pitch"
    | "diagnostic"
    | "party_duel"
    | "seed_challenge"
    | "imperial_exam";
  category: string;
  subCategory: string;
  targetId: string;
  expectedToneOrLabel: string;
  userSelectedToneOrLabel: string;
  correct: boolean;
  reactionTimeMs: number;
  speedUsed: SpeechSpeed;
  voiceUsed: VoiceId;
  pitchScore?: number;
}

export interface ConfusionMatrices {
  monosyllableTones: Record<string, number>;
  dissyllableTones: Record<string, number>;
  contrastStats: Record<
    string,
    {
      total: number;
      correct: number;
      slowCorrect: number;
      totalReactionMs: number;
    }
  >;
}

export interface RadarScores {
  tonesMonosyllable: number;
  tonesDissyllable: number;
  aspirationContrast: number;
  retroflexPalatal: number;
  nasalCodas: number;
  umlautVowels: number;
}

export interface UserProfile {
  id: string;
  name: string;
  avatarColor: string;
  preferredLang: "pt" | "en";
  preferredScript: "simplified" | "traditional";
  blindModeDefault: boolean;
  createdAt: number;
  xp: number;
  streakDays: number;
  lastActiveDate: string;
  diagnosticCompleted: boolean;
  radarScores: RadarScores;
  confusion: ConfusionMatrices;
  fsrsCards: Record<string, FSRSCardState>;
}
