import {
  AttemptLog,
  AudioManifest,
  AuthUser,
  MinimalPairCategory,
  MinimalPairEntry,
  SentencesMinimalPairsDataset,
  SoundGuideSection,
  SpeechSpeed,
  SyllablesChartDataset,
  ToneSandhiRule,
  UserProfile,
  VoiceId,
} from "./phonetics";

/**
 * As 5 Abas Principais Limpas (Direção de Arte V2.0 — China Antiga Minimalista):
 * 1. listen_drill ("听音 · Escuta & Treino")
 * 2. sentences ("整句 · Frases em Contexto")
 * 3. compare_lab ("对比 · Laboratório de Comparação")
 * 4. multiplayer ("同窗 · Multiplayer & Duelos")
 * 5. my_record ("竹简 · Meu Registro")
 * Mantemos aliases legados para compatibilidade reversa com subcomponentes se necessário.
 */
export type AppTabId =
  | "listen_drill"
  | "sentences"
  | "compare_lab"
  | "multiplayer"
  | "my_record"
  | "dashboard"
  | "arena"
  | "oral"
  | "compare_sandhi"
  | "pinyin_chart"
  | "friends";

export interface SharedModuleProps {
  profile: UserProfile;
  authUser?: AuthUser | null;
  onAuthChange?: (user: AuthUser | null) => void;
  onOpenAuthModal?: () => void;
  onRecordAttempt: (
    attempt: Omit<AttemptLog, "id" | "profileId" | "timestamp">,
    expectedTones?: number[],
    chosenTones?: number[]
  ) => void;
  onUpdateProfile: (updated: UserProfile) => void;
  pairs: MinimalPairEntry[];
  sentencesDataset?: SentencesMinimalPairsDataset;
  syllablesChart: SyllablesChartDataset;
  toneSandhiRules: ToneSandhiRule[];
  soundGuides: SoundGuideSection[];
  audioManifest: AudioManifest | null;
  activeVoice: VoiceId;
  setActiveVoice: (v: VoiceId) => void;
  activeSpeed: SpeechSpeed;
  setActiveSpeed: (s: SpeechSpeed) => void;
  onNavigateTab: (
    tab: AppTabId,
    options?: {
      filterCategory?: MinimalPairCategory | "all";
      filterSubCategory?: string;
      initialSyllable?: string;
      challengeSeed?: string;
      roomCode?: string;
    }
  ) => void;
  navigationOptions?: {
    filterCategory?: MinimalPairCategory | "all";
    filterSubCategory?: string;
    initialSyllable?: string;
    challengeSeed?: string;
    roomCode?: string;
  };
}
