"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  BookOpen,
  Compass,
  Download,
  FileText,
  Gauge,
  Grid,
  Headphones,
  Keyboard,
  Mic,
  Moon,
  Plus,
  ScrollText,
  ShieldCheck,
  Sun,
  Upload,
  Users,
  Volume2,
  X,
} from "lucide-react";
import { AppTabId, SharedModuleProps } from "@/types/ui-props";
import {
  AttemptLog,
  AuthUser,
  MinimalPairCategory,
  SpeechSpeed,
  ToneNumber,
  UserProfile,
  VoiceId,
} from "@/types/phonetics";
import { fetchAllDatasets, TingLiDatasetBundle } from "@/lib/data-loader";
import {
  createDefaultProfile,
  exportUserDataJSON,
  importUserDataJSON,
  loadProfilesSync,
  logAttemptToStorage,
  saveProfileState,
} from "@/lib/storage-db";
import { updateConfusionAndRadar, updateFSRSCard } from "@/lib/fsrs-engine";
import { VOICE_OPTIONS } from "@/lib/audio-engine";

import DashboardDiagnosticTab from "@/components/DashboardDiagnosticTab";
import ListeningArenaTab from "@/components/ListeningArenaTab";
import SentencesContextTab from "@/components/SentencesContextTab";
import OralProductionTab from "@/components/OralProductionTab";
import CompareSandhiGuidesTab from "@/components/CompareSandhiGuidesTab";
import PinyinChartHanziTab from "@/components/PinyinChartHanziTab";
import FriendsArenaTab from "@/components/FriendsArenaTab";
import HanlinAuthModal from "@/components/HanlinAuthModal";

export default function TingLiLabApp() {
  const [bundle, setBundle] = useState<TingLiDatasetBundle | null>(null);
  const [loadingError, setLoadingError] = useState<string | null>(null);

  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [activeProfile, setActiveProfile] = useState<UserProfile | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [scholarsList, setScholarsList] = useState<AuthUser[]>([]);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // As 5 Abas Principais Limpas (V2.0)
  const [activeTab, setActiveTab] = useState<AppTabId>("listen_drill");
  const [compareSubView, setCompareSubView] = useState<"sandhi" | "pinyin">(
    "sandhi"
  );
  const [recordSubView, setRecordSubView] = useState<"diagnostic" | "oral">(
    "diagnostic"
  );

  const [navOptions, setNavOptions] = useState<
    SharedModuleProps["navigationOptions"]
  >(undefined);

  const [activeVoice, setActiveVoice] = useState<VoiceId>("xiaoxiao");
  const [activeSpeed, setActiveSpeed] = useState<SpeechSpeed>("conversational");
  const [nightInkMode, setNightInkMode] = useState(false);

  // Modals for Local Profile Creation & Backup Import/Export
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");
  const [importJsonText, setImportJsonText] = useState("");
  const [backupMessage, setBackupMessage] = useState<string | null>(null);

  useEffect(() => {
    const { profiles: loadedProfiles, activeProfile: loadedActive } =
      loadProfilesSync();
    setProfiles(loadedProfiles);
    setActiveProfile(loadedActive);

    // Check URL for ?challenge=TL-... or ?room=...
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const challengeParam = params.get("challenge");
      const roomParam = params.get("room");
      if (challengeParam || roomParam) {
        setActiveTab("multiplayer");
        setNavOptions({
          challengeSeed: challengeParam || undefined,
          roomCode: roomParam || undefined,
        });
      }
    }

    // Load Datasets
    fetchAllDatasets()
      .then((data) => setBundle(data))
      .catch((err) =>
        setLoadingError(
          `Erro ao carregar acervo fonético: ${(err as Error).message}`
        )
      );

    // Check Authenticated Scholar Session (SQLite)
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data?.authenticated && data?.user) {
          setAuthUser(data.user);
        }
        if (Array.isArray(data?.scholars)) {
          setScholarsList(data.scholars);
        }
      })
      .catch(() => {
        // Offline / Guest mode
      });
  }, []);

  const toggleNightInkMode = () => {
    const next = !nightInkMode;
    setNightInkMode(next);
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", next);
    }
  };

  const handleNavigateTab = useCallback(
    (
      tab: AppTabId,
      options?: {
        filterCategory?: MinimalPairCategory | "all";
        filterSubCategory?: string;
        initialSyllable?: string;
        challengeSeed?: string;
        roomCode?: string;
      }
    ) => {
      setNavOptions(options);

      // Normalize legacy aliases into the 5 Clean Tabs
      if (tab === "arena") {
        setActiveTab("listen_drill");
      } else if (tab === "compare_sandhi") {
        setCompareSubView("sandhi");
        setActiveTab("compare_lab");
      } else if (tab === "pinyin_chart") {
        setCompareSubView("pinyin");
        setActiveTab("compare_lab");
      } else if (tab === "friends") {
        setActiveTab("multiplayer");
      } else if (tab === "dashboard") {
        setRecordSubView("diagnostic");
        setActiveTab("my_record");
      } else if (tab === "oral") {
        setRecordSubView("oral");
        setActiveTab("my_record");
      } else {
        setActiveTab(tab);
      }

      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    },
    []
  );

  const handleUpdateProfile = useCallback(
    async (updated: UserProfile) => {
      setActiveProfile(updated);
      const nextList = await saveProfileState(updated, profiles);
      setProfiles(nextList);
    },
    [profiles]
  );

  const handleRecordAttempt = useCallback(
    async (
      attemptPartial: Omit<AttemptLog, "id" | "profileId" | "timestamp">,
      expectedTones?: number[],
      chosenTones?: number[]
    ) => {
      if (!activeProfile) return;

      const attempt: AttemptLog = {
        ...attemptPartial,
        id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        profileId: activeProfile.id,
        timestamp: Date.now(),
      };

      await logAttemptToStorage(attempt);

      // Update FSRS card for targetId
      const existingCard = activeProfile.fsrsCards[attempt.targetId];
      const updatedCard = updateFSRSCard(
        existingCard,
        attempt.targetId,
        (attempt.category as MinimalPairCategory) || "monosyllable_tone",
        attempt.correct,
        attempt.reactionTimeMs
      );

      // Update Bayesian Confusion Matrix & Radar Scores
      const { confusion, radarScores } = updateConfusionAndRadar(
        activeProfile,
        attempt,
        expectedTones as ToneNumber[] | undefined,
        chosenTones as ToneNumber[] | undefined
      );

      const xpGain = attempt.correct
        ? attempt.reactionTimeMs < 1400
          ? 18
          : 12
        : 4;

      const updatedProfile: UserProfile = {
        ...activeProfile,
        xp: activeProfile.xp + xpGain,
        lastActiveDate: new Date().toISOString().slice(0, 10),
        confusion,
        radarScores,
        fsrsCards: {
          ...activeProfile.fsrsCards,
          [attempt.targetId]: updatedCard,
        },
      };

      await handleUpdateProfile(updatedProfile);

      // Sync with SQLite Backend (records study_logs, confusion_matrix, ELO/XP & collective brotherhood goals)
      fetch("/api/auth/me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attempt,
          profile: updatedProfile,
          contributorName: authUser?.displayName || updatedProfile.name,
        }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data?.user) {
            setAuthUser(data.user);
          }
        })
        .catch(() => {
          // Silent fallback if offline
        });
    },
    [activeProfile, authUser, handleUpdateProfile]
  );

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProfileName.trim()) return;
    const colors = ["#3B596A", "#3A6B59", "#9C7A3C", "#9E2A2B", "#7A756C"];
    const color = colors[profiles.length % colors.length];
    const created = createDefaultProfile(newProfileName.trim(), color);
    const nextList = await saveProfileState(created, [...profiles, created]);
    setProfiles(nextList);
    setActiveProfile(created);
    setNewProfileName("");
    setShowProfileModal(false);
  };

  const handleExportDownload = () => {
    const json = exportUserDataJSON();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tingli-lab-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportSubmit = () => {
    if (!importJsonText.trim()) return;
    const res = importUserDataJSON(importJsonText);
    setBackupMessage(res.message);
    if (res.ok && res.profiles) {
      setProfiles(res.profiles);
      setActiveProfile(res.profiles[0]);
      setImportJsonText("");
    }
  };

  if (loadingError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-xuan-bg text-[#9E2A2B]">
        <div className="max-w-md p-6 rounded-xl bg-xuan-card border border-[#9E2A2B]/40 text-center space-y-3">
          <h1 className="text-lg font-serif font-bold">
            Falha ao inicializar acervo fonético
          </h1>
          <p className="text-xs text-xuan-muted">{loadingError}</p>
        </div>
      </div>
    );
  }

  if (!bundle || !activeProfile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-xuan-bg text-xuan-ink">
        <div className="w-12 h-12 rounded-lg imperial-seal flex items-center justify-center font-serif text-xl font-bold mb-4">
          听
        </div>
        <div className="text-lg font-serif font-bold text-xuan-ink">
          TīngLì Lab · 听力实验室
        </div>
        <p className="text-xs text-xuan-muted mt-1">
          Preparando pergaminho fonético, pares mínimos, sentenças e 6 vozes nativas...
        </p>
      </div>
    );
  }

  const sharedProps: SharedModuleProps = {
    profile: activeProfile,
    authUser,
    onAuthChange: setAuthUser,
    onOpenAuthModal: () => setShowAuthModal(true),
    onRecordAttempt: handleRecordAttempt,
    onUpdateProfile: handleUpdateProfile,
    pairs: bundle.minimalPairs.pairs,
    sentencesDataset: bundle.sentencesDataset,
    syllablesChart: bundle.syllablesChart,
    toneSandhiRules: bundle.toneSandhi,
    soundGuides: bundle.soundGuides,
    audioManifest: bundle.audioManifest,
    activeVoice,
    setActiveVoice,
    activeSpeed,
    setActiveSpeed,
    onNavigateTab: handleNavigateTab,
    navigationOptions: navOptions,
  };

  // As 5 Abas Principais Limpas (Estética Clássica Dinastia Song)
  const NAV_ITEMS: Array<{
    id: AppTabId;
    hanziBadge: string;
    label: string;
    shortLabel: string;
    icon: React.ReactNode;
  }> = [
    {
      id: "listen_drill",
      hanziBadge: "听音",
      label: "Escuta & Treino",
      shortLabel: "Escuta",
      icon: <Headphones className="w-4 h-4" />,
    },
    {
      id: "sentences",
      hanziBadge: "整句",
      label: "Frases em Contexto",
      shortLabel: "Frases",
      icon: <FileText className="w-4 h-4" />,
    },
    {
      id: "compare_lab",
      hanziBadge: "对比",
      label: "Laboratório de Comparação",
      shortLabel: "Comparação",
      icon: <BookOpen className="w-4 h-4" />,
    },
    {
      id: "multiplayer",
      hanziBadge: "同窗",
      label: "Multiplayer & Duelos",
      shortLabel: "Duelos",
      icon: <Users className="w-4 h-4" />,
    },
    {
      id: "my_record",
      hanziBadge: "竹简",
      label: "Meu Registro",
      shortLabel: "Registro",
      icon: <ScrollText className="w-4 h-4" />,
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-xuan-bg text-xuan-ink transition-colors duration-200">
      {/* Cabeçalho Clássico Minimalista (Papel Xuan & Selo Cinábrio) */}
      <header className="sticky top-0 z-40 bg-xuan-bg/95 backdrop-blur-sm border-b border-xuan-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          {/* Selo Imperial & Marca */}
          <div
            onClick={() => handleNavigateTab("listen_drill")}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-lg imperial-seal flex items-center justify-center font-serif font-bold text-lg bg-xuan-card group-hover:bg-[#9E2A2B] group-hover:text-[#F5F2E9] transition">
              听
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-serif font-bold text-lg tracking-tight text-xuan-ink">
                  TīngLì Lab
                </span>
                <span className="text-xs font-serif text-[#9E2A2B] font-bold px-1.5 py-0.5 rounded bg-[#9E2A2B]/10 border border-[#9E2A2B]/30">
                  听力实验室
                </span>
              </div>
              <p className="text-[11px] text-xuan-muted hidden sm:block">
                Academia Fonética Clássica · Pares Mínimos, Prosódia & Curvas F0
              </p>
            </div>
          </div>

          {/* Controles Globais: 6 Vozes Nativas, Velocidade, Escrita, Tema e Conta Hànlín */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Seletor das 6 Vozes Neurais + Vozes Humanas */}
            <div className="flex items-center gap-1.5 bg-xuan-card border border-xuan-border rounded-lg px-2.5 py-1.5">
              <Volume2 className="w-3.5 h-3.5 text-[#9E2A2B]" />
              <select
                value={activeVoice}
                onChange={(e) => setActiveVoice(e.target.value as VoiceId)}
                className="bg-transparent text-xuan-ink font-medium focus:outline-none cursor-pointer"
                title="Atalho: Tecla V (6 vozes nativas + estúdio)"
              >
                {VOICE_OPTIONS.map((v) => (
                  <option
                    key={v.id}
                    value={v.id}
                    className="bg-xuan-card text-xuan-ink"
                  >
                    {v.name} [{v.badge}]
                  </option>
                ))}
              </select>
            </div>

            {/* Alternador de Velocidade */}
            <button
              type="button"
              onClick={() =>
                setActiveSpeed(
                  activeSpeed === "classroom" ? "conversational" : "classroom"
                )
              }
              className={`px-2.5 py-1.5 rounded-lg border font-medium flex items-center gap-1.5 transition ${
                activeSpeed === "classroom"
                  ? "bg-[#9C7A3C]/15 border-[#9C7A3C] text-[#9C7A3C]"
                  : "bg-xuan-card border-xuan-border text-xuan-ink"
              }`}
              title="Alternar velocidade Classroom (-25%) vs Conversacional (100%) — Tecla S"
            >
              <Gauge className="w-3.5 h-3.5" />
              {activeSpeed === "classroom" ? "Lenta (-25%)" : "Natural (100%)"}
            </button>

            {/* Alternador Simplificado / Tradicional */}
            <button
              type="button"
              onClick={() =>
                handleUpdateProfile({
                  ...activeProfile,
                  preferredScript:
                    activeProfile.preferredScript === "simplified"
                      ? "traditional"
                      : "simplified",
                })
              }
              className="px-2.5 py-1.5 rounded-lg bg-xuan-card hover:bg-xuan-subtle border border-xuan-border text-xuan-ink font-serif font-bold transition"
              title="Alternar entre caracteres Simplificados (简体) e Tradicionais (繁體)"
            >
              {activeProfile.preferredScript === "simplified" ? "简体" : "繁體"}
            </button>

            {/* Alternador Papel Xuan / Estudo Noturno (Pedra de Tinta) */}
            <button
              type="button"
              onClick={toggleNightInkMode}
              className="p-1.5 rounded-lg bg-xuan-card hover:bg-xuan-subtle border border-xuan-border text-xuan-ink transition"
              title={
                nightInkMode
                  ? "Mudar para Modo Papel Xuan (#F5F2E9)"
                  : "Mudar para Modo Estudo Noturno (#181715)"
              }
            >
              {nightInkMode ? (
                <Sun className="w-3.5 h-3.5 text-[#9C7A3C]" />
              ) : (
                <Moon className="w-3.5 h-3.5 text-xuan-muted" />
              )}
            </button>

            {/* Conta Imperial Hànlín (SQLite Login / Senha) */}
            <button
              type="button"
              onClick={() => setShowAuthModal(true)}
              className={`px-3 py-1.5 rounded-lg border font-medium flex items-center gap-1.5 transition ${
                authUser
                  ? "bg-[#3A6B59]/15 border-[#3A6B59] text-[#3A6B59]"
                  : "bg-[#9E2A2B] border-[#9E2A2B] text-[#F5F2E9] hover:bg-[#7D2021]"
              }`}
              title="Passaporte Imperial Hànlín (Login / Senha persistente em SQLite)"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              {authUser ? (
                <span>
                  {authUser.displayName} ·{" "}
                  <strong className="font-serif">
                    {(authUser.imperialRank || authUser.scholarRank || "童生").split(" ")[0]}
                  </strong>
                </span>
              ) : (
                <span>Conta Hànlín (Entrar)</span>
              )}
            </button>

            {/* Perfil Local / Backup */}
            <button
              type="button"
              onClick={() => setShowProfileModal(true)}
              className="p-1.5 rounded-lg bg-xuan-card hover:bg-xuan-subtle border border-xuan-border text-xuan-muted transition"
              title="Perfis Locais & Backup JSON"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Barra das 5 Abas Principais Limpas */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center gap-2 overflow-x-auto py-2 border-t border-xuan-border">
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigateTab(item.id)}
                className={`px-3.5 py-2 rounded-lg text-xs font-medium flex items-center gap-2 shrink-0 transition border ${
                  isActive
                    ? "bg-[#9E2A2B] text-[#F5F2E9] border-[#9E2A2B] shadow-sm"
                    : "bg-xuan-card text-xuan-muted border-xuan-border hover:text-xuan-ink hover:bg-xuan-subtle"
                }`}
              >
                {item.icon}
                <span className="font-serif font-bold">{item.hanziBadge}</span>
                <span className="hidden md:inline">· {item.label}</span>
                <span className="md:hidden">· {item.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Área Principal de Estudo */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6">
        {/* ABA 1: 听音 · Escuta & Treino */}
        {activeTab === "listen_drill" && <ListeningArenaTab {...sharedProps} />}

        {/* ABA 2: 整句 · Frases em Contexto */}
        {activeTab === "sentences" && <SentencesContextTab {...sharedProps} />}

        {/* ABA 3: 对比 · Laboratório de Comparação */}
        {activeTab === "compare_lab" && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-xuan-card border border-xuan-border rounded-xl p-3">
              <div className="text-xs text-xuan-muted">
                <strong className="font-serif text-xuan-ink">
                  对比 · Laboratório de Comparação Fonética:
                </strong>{" "}
                Alterne entre o Comparador Acústico / Regras de Tone Sandhi e a
                Tabela Completa de 410+ Sílabas Pinyin com Ordem de Traços.
              </div>
              <div className="flex rounded-lg bg-xuan-bg p-1 border border-xuan-border text-xs">
                <button
                  type="button"
                  onClick={() => setCompareSubView("sandhi")}
                  className={`px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition ${
                    compareSubView === "sandhi"
                      ? "bg-[#9E2A2B] text-[#F5F2E9]"
                      : "text-xuan-muted hover:text-xuan-ink"
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  Comparador, Sandhi & Guias PT
                </button>
                <button
                  type="button"
                  onClick={() => setCompareSubView("pinyin")}
                  className={`px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition ${
                    compareSubView === "pinyin"
                      ? "bg-[#9E2A2B] text-[#F5F2E9]"
                      : "text-xuan-muted hover:text-xuan-ink"
                  }`}
                >
                  <Grid className="w-3.5 h-3.5" />
                  Tabela Pinyin 410+ & Traços Hanzi
                </button>
              </div>
            </div>

            {compareSubView === "sandhi" ? (
              <CompareSandhiGuidesTab {...sharedProps} />
            ) : (
              <PinyinChartHanziTab {...sharedProps} />
            )}
          </div>
        )}

        {/* ABA 4: 同窗 · Multiplayer & Duelos */}
        {activeTab === "multiplayer" && <FriendsArenaTab {...sharedProps} />}

        {/* ABA 5: 竹简 · Meu Registro */}
        {activeTab === "my_record" && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-xuan-card border border-xuan-border rounded-xl p-3">
              <div className="text-xs text-xuan-muted">
                <strong className="font-serif text-xuan-ink">
                  竹简 · Meu Registro Imperial & Laboratório de Voz:
                </strong>{" "}
                Consulte sua Matriz de Confusão Tonal $5 \times 5$, Cartões FSRS
                ou pratique pronúncia no microfone com extração de curva $F_0$.
              </div>
              <div className="flex rounded-lg bg-xuan-bg p-1 border border-xuan-border text-xs">
                <button
                  type="button"
                  onClick={() => setRecordSubView("diagnostic")}
                  className={`px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition ${
                    recordSubView === "diagnostic"
                      ? "bg-[#9E2A2B] text-[#F5F2E9]"
                      : "text-xuan-muted hover:text-xuan-ink"
                  }`}
                >
                  <Compass className="w-3.5 h-3.5" />
                  Matriz Tonal & Diagnóstico FSRS
                </button>
                <button
                  type="button"
                  onClick={() => setRecordSubView("oral")}
                  className={`px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition ${
                    recordSubView === "oral"
                      ? "bg-[#9E2A2B] text-[#F5F2E9]"
                      : "text-xuan-muted hover:text-xuan-ink"
                  }`}
                >
                  <Mic className="w-3.5 h-3.5" />
                  Produção Oral & Curva Pitch F0
                </button>
              </div>
            </div>

            {recordSubView === "diagnostic" ? (
              <DashboardDiagnosticTab {...sharedProps} />
            ) : (
              <OralProductionTab {...sharedProps} />
            )}
          </div>
        )}
      </main>

      {/* Rodapé Clássico de Atalhos e Pigmentos Tonais */}
      <footer className="border-t border-xuan-border bg-xuan-card py-3 px-4 text-[11px] text-xuan-muted">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-semibold text-xuan-ink flex items-center gap-1">
              <Keyboard className="w-3.5 h-3.5 text-[#9E2A2B]" />
              Atalhos de Estudo:
            </span>
            <span>
              <kbd className="kbd-badge">R</kbd> /{" "}
              <kbd className="kbd-badge">Espaço</kbd> Ouvir
            </span>
            <span>
              <kbd className="kbd-badge">S</kbd> Velocidade
            </span>
            <span>
              <kbd className="kbd-badge">V</kbd> Trocar Voz (6 Nativas)
            </span>
            <span>
              <kbd className="kbd-badge">1–5</kbd> /{" "}
              <kbd className="kbd-badge">A/B</kbd> Responder
            </span>
            <span>
              <kbd className="kbd-badge">H</kbd> Revelar Nota
            </span>
            <span>
              <kbd className="kbd-badge">Enter</kbd> Próxima
            </span>
          </div>

          <div className="flex items-center gap-3 font-medium">
            <span style={{ color: "#3B596A" }}>● T1 Índigo (55)</span>
            <span style={{ color: "#3A6B59" }}>● T2 Jade (35)</span>
            <span style={{ color: "#9C7A3C" }}>● T3 Bronze (214)</span>
            <span style={{ color: "#9E2A2B" }}>● T4 Cinábrio (51)</span>
            <span style={{ color: "#7A756C" }}>● T5 Pedra</span>
          </div>
        </div>
      </footer>

      {/* Modal de Autenticação Imperial Hànlín (SQLite Login / Registro) */}
      <HanlinAuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        currentUser={authUser}
        localProfile={activeProfile}
        scholarsList={scholarsList}
        onAuthSuccess={(u, restoredProfile) => {
          setAuthUser(u);
          if (restoredProfile) {
            handleUpdateProfile(restoredProfile);
          }
        }}
        onLogout={() => setAuthUser(null)}
      />

      {/* Modal de Perfis Locais & Backup JSON */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-xuan-bg border-2 border-xuan-border rounded-xl p-6 max-w-lg w-full space-y-5 shadow-xl text-xuan-ink">
            <div className="flex items-center justify-between border-b border-xuan-border pb-3">
              <h3 className="text-base font-serif font-bold flex items-center gap-2">
                <Users className="w-5 h-5 text-[#9E2A2B]" />
                Perfis Locais & Backup de Progresso (.JSON)
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowProfileModal(false);
                  setBackupMessage(null);
                }}
                className="p-1.5 rounded-lg bg-xuan-card hover:bg-xuan-subtle text-xuan-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateProfile} className="space-y-2">
              <label className="block text-xs font-semibold text-xuan-muted">
                Alternar ou Criar Perfil Local:
              </label>
              <div className="flex gap-2 mb-2">
                <select
                  value={activeProfile.id}
                  onChange={(e) => {
                    const found = profiles.find((p) => p.id === e.target.value);
                    if (found) handleUpdateProfile(found);
                  }}
                  className="w-full bg-xuan-card border border-xuan-border rounded-lg px-3 py-2 text-xs font-medium text-xuan-ink"
                >
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id} className="bg-xuan-card text-xuan-ink">
                      📜 {p.name} ({p.xp} XP)
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                  placeholder="Nome do novo perfil local..."
                  className="flex-1 bg-xuan-card border border-xuan-border rounded-lg px-3 py-2 text-xs text-xuan-ink focus:outline-none focus:border-[#9E2A2B]"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#9E2A2B] text-[#F5F2E9] font-bold text-xs"
                >
                  Criar
                </button>
              </div>
            </form>

            <div className="space-y-3 pt-3 border-t border-xuan-border">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-xuan-muted">
                  Exportar Cartões FSRS Locais:
                </span>
                <button
                  type="button"
                  onClick={handleExportDownload}
                  className="px-3.5 py-2 rounded-lg bg-[#3A6B59] text-[#F5F2E9] text-xs font-bold flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  Baixar Backup (.json)
                </button>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-xuan-muted">
                  Importar Backup JSON:
                </label>
                <textarea
                  rows={3}
                  value={importJsonText}
                  onChange={(e) => setImportJsonText(e.target.value)}
                  placeholder="Cole aqui o conteúdo do arquivo tingli-lab-backup.json..."
                  className="w-full bg-xuan-card border border-xuan-border rounded-lg p-3 text-xs font-mono text-xuan-ink focus:outline-none focus:border-[#9E2A2B]"
                />
                <button
                  type="button"
                  onClick={handleImportSubmit}
                  className="w-full py-2 rounded-lg bg-xuan-card hover:bg-xuan-subtle border border-xuan-border text-xuan-ink text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Restaurar Progresso do JSON
                </button>
              </div>

              {backupMessage && (
                <p className="text-xs text-[#9C7A3C] font-medium text-center">
                  {backupMessage}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
