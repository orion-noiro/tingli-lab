"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Award,
  CheckCircle2,
  Clock,
  Crown,
  Flame,
  Ghost,
  Play,
  Plus,
  RefreshCw,
  Scroll,
  Send,
  Shield,
  Swords,
  Trophy,
  Users,
  Volume2,
  XCircle,
} from "lucide-react";
import { SharedModuleProps } from "@/types/ui-props";
import { AuthUser, SpeechSpeed, VoiceId } from "@/types/phonetics";
import { playLexicalItemAudio, VOICE_OPTIONS } from "@/lib/audio-engine";

interface SyncQuestion {
  index: number;
  promptPt: string;
  hanziA: string;
  pinyinA: string;
  meaningA: string;
  asciiKeyA: string;
  audioKeyA?: string;
  hanziB: string;
  pinyinB: string;
  meaningB: string;
  asciiKeyB: string;
  audioKeyB?: string;
  correctSide: "A" | "B";
  voice: VoiceId;
}

interface SyncRoomPlayer {
  userId: number;
  username: string;
  displayName: string;
  scholarRank: string;
  eloRating: number;
  isReady: boolean;
  score: number;
  combo: number;
  correctCount: number;
  totalReactionMs: number;
  answers: Record<
    string,
    {
      choice: "A" | "B";
      correct: boolean;
      reactionMs: number;
      pointsGained: number;
    }
  >;
  partnerHints: Record<string, { dispatchedBy: string; note: string }>;
}

interface SyncRoomData {
  code: string;
  title: string;
  hostUserId: number;
  hostName: string;
  roomMode: "duel_1v1" | "group_arena" | "coop_blind_partner";
  focusCategory: string;
  totalRounds: number;
  speed: SpeechSpeed;
  status: "lobby" | "playing" | "finished";
  currentRound: number;
  roundStartedAt: number;
  questions: SyncQuestion[];
}

interface GhostChallengeItem {
  id: string;
  challengerId: number;
  challengerName: string;
  challengerRank: string;
  targetUsername: string;
  focusCategory: string;
  seed: string;
  questions: SyncQuestion[];
  ghostLog: Array<{
    roundIndex: number;
    choice: "A" | "B";
    correct: boolean;
    reactionMs: number;
  }>;
  challengerScore: number;
  challengerAccuracy: number;
  challengerAvgMs: number;
  attempts: Array<{
    playerName: string;
    playerRank: string;
    score: number;
    accuracy: number;
    avgMs: number;
    won: boolean;
    completedAt: string;
  }>;
  createdAt: string;
}

interface CollectiveGoalItem {
  id: string;
  titlePt: string;
  descriptionPt: string;
  goalType: string;
  targetValue: number;
  currentValue: number;
  contributors: Record<string, number>;
}

interface JinbangEntry {
  examKey: string;
  userId: number;
  username: string;
  displayName: string;
  scholarRank: string;
  score: number;
  accuracy: number;
  avgReactionMs: number;
  completedAt: string;
}

type MultiplayerSection =
  | "sync_arena"
  | "ghost_duels"
  | "keju_exam"
  | "leaderboard";

export default function FriendsArenaTab({
  profile,
  authUser,
  onOpenAuthModal,
  pairs,
  sentencesDataset,
}: SharedModuleProps) {
  const [section, setSection] = useState<MultiplayerSection>("sync_arena");

  // Open Lobby & Active Synchronous Room
  const [lobbyRooms, setLobbyRooms] = useState<
    Array<{
      code: string;
      title: string;
      hostName: string;
      roomMode: string;
      focusCategory: string;
      totalRounds: number;
      speed: string;
      status: string;
      playerCount: number;
    }>
  >([]);
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [roomMode, setRoomMode] = useState<
    "duel_1v1" | "group_arena" | "coop_blind_partner"
  >("duel_1v1");
  const [focusCategory, setFocusCategory] = useState<string>(
    "dissyllable_tone_matrix"
  );
  const [totalRounds, setTotalRounds] = useState<number>(10);
  const [roomSpeed, setRoomSpeed] = useState<SpeechSpeed>("conversational");

  const [activeRoomCode, setActiveRoomCode] = useState<string | null>(null);
  const [roomData, setRoomData] = useState<SyncRoomData | null>(null);
  const [roomPlayers, setRoomPlayers] = useState<SyncRoomPlayer[]>([]);
  const [partnerHintText, setPartnerHintText] = useState<string>("");

  // Async Data (Ghost Challenges, Collective Goals, Jinbang, Leaderboard)
  const [ghostChallenges, setGhostChallenges] = useState<GhostChallengeItem[]>([]);
  const [collectiveGoals, setCollectiveGoals] = useState<CollectiveGoalItem[]>([]);
  const [jinbang, setJinbang] = useState<JinbangEntry[]>([]);
  const [leaderboard, setLeaderboard] = useState<AuthUser[]>([]);
  const [leaderboardSort, setLeaderboardSort] = useState<
    "elo" | "dissyl" | "sentence" | "speed"
  >("elo");
  const [inspectedScholar, setInspectedScholar] = useState<AuthUser | null>(null);

  // Active Ghost Duel / Create Ghost Run / Imperial Exam Run state
  const [activeSoloRun, setActiveSoloRun] = useState<{
    type: "play_ghost" | "create_ghost" | "imperial_exam";
    ghostChallenge?: GhostChallengeItem;
    targetFriend?: string;
    questions: SyncQuestion[];
    currentIndex: number;
    myLog: Array<{
      roundIndex: number;
      choice: "A" | "B";
      correct: boolean;
      reactionMs: number;
      points: number;
    }>;
    currentChoice: "A" | "B" | null;
    finished: boolean;
  } | null>(null);

  const roundStartMsRef = useRef<number>(Date.now());
  const lastPlayedSyncRoundRef = useRef<number>(-1);

  const effectiveUser = useMemo(
    () => ({
      userId: authUser?.id || 9001,
      username: authUser?.username || "estudante_local",
      displayName: authUser?.displayName || profile.name,
      scholarRank: authUser?.scholarRank || "童生 Tóngshēng",
      eloRating: authUser?.eloRating || 1000,
    }),
    [authUser, profile.name]
  );

  // Build deterministic deck of questions for synchronous room, ghost challenge or imperial exam
  const buildQuestionsDeck = useCallback(
    (cat: string, count: number, seedStr: string): SyncQuestion[] => {
      const voices: VoiceId[] = [
        "xiaoxiao",
        "yunxi",
        "xiaoyi",
        "yunjian",
        "xiaobei",
        "hsiaochen",
      ];
      let pool = pairs;
      if (cat === "monosyllable_tone") {
        pool = pairs.filter((p) => p.category === "monosyllable_tone");
      } else if (cat === "dissyllable_tone_matrix") {
        pool = pairs.filter((p) => p.category === "dissyllable_tone_matrix");
      } else if (cat === "initial_final") {
        pool = pairs.filter((p) =>
          ["initial_aspiration", "initial_place", "final_nasal", "final_vowel"].includes(
            p.category
          )
        );
      } else if (cat === "full_sentences" && sentencesDataset?.contextualPairs?.length) {
        return sentencesDataset.contextualPairs.slice(0, count).map((cp, idx) => ({
          index: idx,
          promptPt: "Qual frase completa foi pronunciada?",
          hanziA: cp.sentenceA,
          pinyinA: cp.pinyinA,
          meaningA: cp.meaningPtA,
          asciiKeyA: "",
          audioKeyA: cp.audioKeyA,
          hanziB: cp.sentenceB,
          pinyinB: cp.pinyinB,
          meaningB: cp.meaningPtB,
          asciiKeyB: "",
          audioKeyB: cp.audioKeyB,
          correctSide: (idx + seedStr.length) % 2 === 0 ? "A" : "B",
          voice: voices[idx % voices.length],
        }));
      }

      if (pool.length === 0) pool = pairs;
      const deck: SyncQuestion[] = [];
      let hash = 0;
      for (let i = 0; i < seedStr.length; i++) {
        hash = (hash * 31 + seedStr.charCodeAt(i)) % 100000;
      }

      for (let i = 0; i < count; i++) {
        const p = pool[(hash + i * 17) % pool.length];
        deck.push({
          index: i,
          promptPt:
            p.category === "dissyllable_tone_matrix"
              ? "Qual palavra dissilábica foi pronunciada?"
              : "Qual estímulo fonético foi pronunciado?",
          hanziA: p.itemA.hanzi,
          pinyinA: p.itemA.pinyin,
          meaningA: p.itemA.meaningPt,
          asciiKeyA: p.itemA.asciiKey,
          hanziB: p.itemB.hanzi,
          pinyinB: p.itemB.pinyin,
          meaningB: p.itemB.meaningPt,
          asciiKeyB: p.itemB.asciiKey,
          correctSide: (hash + i) % 2 === 0 ? "A" : "B",
          voice: voices[(hash + i) % voices.length],
        });
      }
      return deck;
    },
    [pairs, sentencesDataset]
  );

  const fetchAsyncHub = useCallback(async () => {
    try {
      const [roomsRes, asyncRes] = await Promise.all([
        fetch("/api/multiplayer/rooms"),
        fetch("/api/multiplayer/async"),
      ]);
      if (roomsRes.ok) {
        const rData = await roomsRes.json();
        setLobbyRooms(rData.rooms || []);
      }
      if (asyncRes.ok) {
        const aData = await asyncRes.json();
        setGhostChallenges(aData.ghostChallenges || []);
        setCollectiveGoals(aData.collectiveGoals || []);
        setJinbang(aData.jinbang || []);
        setLeaderboard(aData.leaderboard || []);
      }
    } catch {
      // ignore offline
    }
  }, []);

  useEffect(() => {
    fetchAsyncHub();
  }, [fetchAsyncHub]);

  // Fast 350ms polling when inside a synchronous room
  useEffect(() => {
    if (!activeRoomCode) return;
    let active = true;

    const pollRoom = async () => {
      try {
        const res = await fetch(
          `/api/multiplayer/rooms?code=${encodeURIComponent(activeRoomCode)}`
        );
        if (!res.ok || !active) return;
        const data = await res.json();
        setRoomData(data.room);
        setRoomPlayers(data.players || []);

        // Auto-play audio when round starts or advances!
        if (
          data.room.status === "playing" &&
          data.room.currentRound !== lastPlayedSyncRoundRef.current
        ) {
          lastPlayedSyncRoundRef.current = data.room.currentRound;
          roundStartMsRef.current = Date.now();
          const q: SyncQuestion | undefined =
            data.room.questions[data.room.currentRound];
          if (q) {
            const targetHanzi = q.correctSide === "A" ? q.hanziA : q.hanziB;
            const targetKey = q.correctSide === "A" ? q.asciiKeyA : q.asciiKeyB;
            const targetAudioKey = q.correctSide === "A" ? q.audioKeyA : q.audioKeyB;
            playLexicalItemAudio(
              { hanzi: targetHanzi, asciiKey: targetKey, audioKey: targetAudioKey },
              q.voice,
              data.room.speed
            );
          }
        }
      } catch {
        // ignore
      }
    };

    pollRoom();
    const timer = setInterval(pollRoom, 350);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [activeRoomCode]);

  const handleCreateRoom = async () => {
    const questions = buildQuestionsDeck(
      focusCategory,
      totalRounds,
      `ROOM-${Date.now()}`
    );
    const res = await fetch("/api/multiplayer/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        ...effectiveUser,
        title: `Arena de ${effectiveUser.displayName}`,
        roomMode,
        focusCategory,
        totalRounds,
        speed: roomSpeed,
        questions,
      }),
    });
    const data = await res.json();
    if (res.ok && data.code) {
      lastPlayedSyncRoundRef.current = -1;
      setActiveRoomCode(data.code);
    }
  };

  const handleJoinRoom = async (codeToJoin: string) => {
    if (!codeToJoin.trim()) return;
    const res = await fetch("/api/multiplayer/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "join",
        code: codeToJoin.trim(),
        ...effectiveUser,
      }),
    });
    const data = await res.json();
    if (res.ok && data.code) {
      lastPlayedSyncRoundRef.current = -1;
      setActiveRoomCode(data.code);
    }
  };

  const handleStartSyncRoom = async () => {
    if (!activeRoomCode) return;
    await fetch("/api/multiplayer/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "start",
        code: activeRoomCode,
        ...effectiveUser,
      }),
    });
  };

  const handleAnswerSyncRound = async (choice: "A" | "B") => {
    if (!roomData || !activeRoomCode) return;
    const q = roomData.questions[roomData.currentRound];
    if (!q) return;
    const reactionMs = Math.max(180, Date.now() - roundStartMsRef.current);
    const correct = choice === q.correctSide;

    await fetch("/api/multiplayer/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "answer",
        code: activeRoomCode,
        roundIndex: roomData.currentRound,
        choice,
        correct,
        reactionMs,
        ...effectiveUser,
      }),
    });
  };

  const handleNextSyncRound = async () => {
    if (!activeRoomCode) return;
    await fetch("/api/multiplayer/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "next_round",
        code: activeRoomCode,
        ...effectiveUser,
      }),
    });
  };

  const handleDispatchPartnerHint = async () => {
    if (!activeRoomCode || !roomData) return;
    await fetch("/api/multiplayer/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "partner_dispatch",
        code: activeRoomCode,
        roundIndex: roomData.currentRound,
        hintNote: partnerHintText || "Estímulo emitido pelo parceiro!",
        ...effectiveUser,
      }),
    });
    setPartnerHintText("");
  };

  // Start Solo Run (Play against Friend's Ghost, Create New Ghost Challenge, or Official Daily Imperial Exam)
  const startSoloChallengeRun = (
    type: "play_ghost" | "create_ghost" | "imperial_exam",
    ghost?: GhostChallengeItem,
    targetFriend: string = ""
  ) => {
    let questions: SyncQuestion[] = [];
    if (type === "play_ghost" && ghost) {
      questions = ghost.questions;
    } else if (type === "imperial_exam") {
      // Exame Imperial Diário Oficial (Seed Fixa Diária: 20 questões variadas)
      const todaySeed = `KEJU-${new Date().toISOString().slice(0, 10)}`;
      const qMono = buildQuestionsDeck("monosyllable_tone", 5, todaySeed + "-M");
      const qDisyl = buildQuestionsDeck("dissyllable_tone_matrix", 5, todaySeed + "-D");
      const qSeg = buildQuestionsDeck("initial_final", 5, todaySeed + "-S");
      const qSent = buildQuestionsDeck("full_sentences", 5, todaySeed + "-F");
      questions = [...qMono, ...qDisyl, ...qSeg, ...qSent].map((q, idx) => ({
        ...q,
        index: idx,
      }));
    } else {
      questions = buildQuestionsDeck(
        focusCategory,
        15,
        `GHOST-${Date.now()}`
      );
    }

    setActiveSoloRun({
      type,
      ghostChallenge: ghost,
      targetFriend,
      questions,
      currentIndex: 0,
      myLog: [],
      currentChoice: null,
      finished: false,
    });

    roundStartMsRef.current = Date.now();
    const firstQ = questions[0];
    if (firstQ) {
      setTimeout(() => {
        playLexicalItemAudio(
          {
            hanzi: firstQ.correctSide === "A" ? firstQ.hanziA : firstQ.hanziB,
            asciiKey: firstQ.correctSide === "A" ? firstQ.asciiKeyA : firstQ.asciiKeyB,
            audioKey: firstQ.correctSide === "A" ? firstQ.audioKeyA : firstQ.audioKeyB,
          },
          firstQ.voice,
          "conversational"
        );
      }, 150);
    }
  };

  const handleAnswerSoloRun = (choice: "A" | "B") => {
    if (!activeSoloRun || activeSoloRun.currentChoice !== null) return;
    const q = activeSoloRun.questions[activeSoloRun.currentIndex];
    const reactionMs = Math.max(180, Date.now() - roundStartMsRef.current);
    const correct = choice === q.correctSide;
    const speedBonus = correct
      ? Math.max(0, Math.round(((5000 - Math.min(5000, reactionMs)) / 5000) * 50))
      : 0;
    const points = correct ? 100 + speedBonus : 0;

    setActiveSoloRun({
      ...activeSoloRun,
      currentChoice: choice,
      myLog: [
        ...activeSoloRun.myLog,
        {
          roundIndex: activeSoloRun.currentIndex,
          choice,
          correct,
          reactionMs,
          points,
        },
      ],
    });
  };

  const handleNextSoloRun = async () => {
    if (!activeSoloRun) return;
    const nextIdx = activeSoloRun.currentIndex + 1;
    if (nextIdx >= activeSoloRun.questions.length) {
      // Concluir e enviar ao backend SQLite
      const totalScore = activeSoloRun.myLog.reduce((a, b) => a + b.points, 0);
      const correctCount = activeSoloRun.myLog.filter((x) => x.correct).length;
      const accuracy = Math.round(
        (correctCount / Math.max(1, activeSoloRun.questions.length)) * 100
      );
      const avgMs = Math.round(
        activeSoloRun.myLog.reduce((a, b) => a + b.reactionMs, 0) /
          Math.max(1, activeSoloRun.myLog.length)
      );

      if (activeSoloRun.type === "create_ghost") {
        await fetch("/api/multiplayer/async", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "create_ghost",
            challengerId: effectiveUser.userId,
            challengerName: effectiveUser.displayName,
            challengerRank: effectiveUser.scholarRank,
            targetUsername: activeSoloRun.targetFriend || "",
            focusCategory,
            questions: activeSoloRun.questions,
            ghostLog: activeSoloRun.myLog,
            challengerScore: totalScore,
            challengerAccuracy: accuracy,
            challengerAvgMs: avgMs,
          }),
        });
      } else if (
        activeSoloRun.type === "play_ghost" &&
        activeSoloRun.ghostChallenge
      ) {
        await fetch("/api/multiplayer/async", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "complete_ghost_duel",
            challengeId: activeSoloRun.ghostChallenge.id,
            userId: authUser?.id,
            playerName: effectiveUser.displayName,
            playerRank: effectiveUser.scholarRank,
            score: totalScore,
            accuracy,
            avgMs,
          }),
        });
      } else if (activeSoloRun.type === "imperial_exam") {
        await fetch("/api/multiplayer/async", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "submit_imperial_exam",
            userId: effectiveUser.userId,
            username: effectiveUser.username,
            displayName: effectiveUser.displayName,
            scholarRank: effectiveUser.scholarRank,
            score: totalScore,
            accuracy,
            avgReactionMs: avgMs,
          }),
        });
      }

      setActiveSoloRun({ ...activeSoloRun, finished: true });
      fetchAsyncHub();
      return;
    }

    const nextQ = activeSoloRun.questions[nextIdx];
    setActiveSoloRun({
      ...activeSoloRun,
      currentIndex: nextIdx,
      currentChoice: null,
    });
    roundStartMsRef.current = Date.now();
    if (nextQ) {
      playLexicalItemAudio(
        {
          hanzi: nextQ.correctSide === "A" ? nextQ.hanziA : nextQ.hanziB,
          asciiKey: nextQ.correctSide === "A" ? nextQ.asciiKeyA : nextQ.asciiKeyB,
          audioKey: nextQ.correctSide === "A" ? nextQ.audioKeyA : nextQ.audioKeyB,
        },
        nextQ.voice,
        "conversational"
      );
    }
  };

  const sortedLeaderboard = useMemo(() => {
    const copy = [...leaderboard];
    if (leaderboardSort === "dissyl") {
      return copy.sort((a, b) => b.dissyllableAccuracy - a.dissyllableAccuracy);
    }
    if (leaderboardSort === "sentence") {
      return copy.sort((a, b) => b.sentenceAccuracy - a.sentenceAccuracy);
    }
    if (leaderboardSort === "speed") {
      return copy.sort((a, b) => a.avgReactionMs - b.avgReactionMs);
    }
    return copy.sort((a, b) => b.eloRating - a.eloRating);
  }, [leaderboard, leaderboardSort]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Barra Superior de Identidade Hànlín & Sub-Abas do Pavilhão Multiplayer */}
      <section className="p-4 rounded-xl bg-xuan-card border border-xuan-border flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => {
              setSection("sync_arena");
              setActiveSoloRun(null);
            }}
            className={`px-3.5 py-2 rounded-lg text-xs font-serif font-bold flex items-center gap-1.5 transition ${
              section === "sync_arena"
                ? "bg-[#9E2A2B] text-[#F5F2E9]"
                : "bg-xuan-bg text-xuan-muted hover:text-xuan-ink border border-xuan-border"
            }`}
          >
            <Swords className="w-3.5 h-3.5" />
            Salas Ao Vivo (Síncrono 1v1 / Grupo)
          </button>

          <button
            type="button"
            onClick={() => {
              setSection("ghost_duels");
              setActiveRoomCode(null);
            }}
            className={`px-3.5 py-2 rounded-lg text-xs font-serif font-bold flex items-center gap-1.5 transition ${
              section === "ghost_duels"
                ? "bg-[#9E2A2B] text-[#F5F2E9]"
                : "bg-xuan-bg text-xuan-muted hover:text-xuan-ink border border-xuan-border"
            }`}
          >
            <Ghost className="w-3.5 h-3.5" />
            Duelos Fantasma & Irmandade (Assíncrono)
          </button>

          <button
            type="button"
            onClick={() => {
              setSection("keju_exam");
              setActiveRoomCode(null);
            }}
            className={`px-3.5 py-2 rounded-lg text-xs font-serif font-bold flex items-center gap-1.5 transition ${
              section === "keju_exam"
                ? "bg-[#9E2A2B] text-[#F5F2E9]"
                : "bg-xuan-bg text-xuan-muted hover:text-xuan-ink border border-xuan-border"
            }`}
          >
            <Scroll className="w-3.5 h-3.5" />
            Exame Imperial 科举 · Quadro 金榜
          </button>

          <button
            type="button"
            onClick={() => {
              setSection("leaderboard");
              setActiveRoomCode(null);
            }}
            className={`px-3.5 py-2 rounded-lg text-xs font-serif font-bold flex items-center gap-1.5 transition ${
              section === "leaderboard"
                ? "bg-[#9E2A2B] text-[#F5F2E9]"
                : "bg-xuan-bg text-xuan-muted hover:text-xuan-ink border border-xuan-border"
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            Ranking ELO dos Amigos
          </button>
        </div>

        {/* Status da Conta */}
        <div className="flex items-center gap-2 text-xs">
          <span className="px-2.5 py-1 rounded bg-xuan-bg border border-xuan-border font-serif font-semibold">
            {effectiveUser.displayName} ·{" "}
            <strong className="text-[#9E2A2B]">{effectiveUser.scholarRank}</strong> (ELO{" "}
            {effectiveUser.eloRating})
          </span>
          {onOpenAuthModal && (
            <button
              type="button"
              onClick={onOpenAuthModal}
              className="px-3 py-1 rounded bg-[#9E2A2B]/10 border border-[#9E2A2B]/40 text-[#9E2A2B] font-bold hover:bg-[#9E2A2B] hover:text-[#F5F2E9] transition"
            >
              {authUser ? "Trocar Conta" : "Entrar / Cadastrar"}
            </button>
          )}
        </div>
      </section>

      {/* ===================================================================== */}
      {/* MODO EXECUÇÃO DE DESAFIO FANTASMA OU EXAME IMPERIAL (SOLO RUN)        */}
      {/* ===================================================================== */}
      {activeSoloRun && (
        <section className="p-8 rounded-xl bg-xuan-card border-2 border-[#9E2A2B] space-y-6 text-center">
          <div className="flex items-center justify-between border-b border-xuan-border pb-3">
            <div className="text-left">
              <span className="text-[11px] font-mono uppercase text-[#9E2A2B] font-bold">
                {activeSoloRun.type === "play_ghost"
                  ? `Duelo contra o Fantasma de ${activeSoloRun.ghostChallenge?.challengerName}`
                  : activeSoloRun.type === "imperial_exam"
                  ? "Exame Imperial Oficial (科举 Kējǔ — 20 Questões)"
                  : "Gravando Novo Desafio Fantasma para os Amigos"}
              </span>
              <h3 className="font-serif text-lg font-bold text-xuan-ink">
                Questão {activeSoloRun.currentIndex + 1} de{" "}
                {activeSoloRun.questions.length}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setActiveSoloRun(null)}
              className="px-3 py-1 rounded border border-xuan-border text-xs text-xuan-muted hover:text-xuan-ink"
            >
              Encerrar
            </button>
          </div>

          {!activeSoloRun.finished ? (
            (() => {
              const q = activeSoloRun.questions[activeSoloRun.currentIndex];
              const ghostMove =
                activeSoloRun.type === "play_ghost"
                  ? activeSoloRun.ghostChallenge?.ghostLog?.[
                      activeSoloRun.currentIndex
                    ]
                  : undefined;

              return (
                <div className="space-y-6">
                  <div className="flex flex-col items-center space-y-2">
                    <button
                      type="button"
                      onClick={() =>
                        playLexicalItemAudio(
                          {
                            hanzi:
                              q.correctSide === "A" ? q.hanziA : q.hanziB,
                            asciiKey:
                              q.correctSide === "A" ? q.asciiKeyA : q.asciiKeyB,
                            audioKey:
                              q.correctSide === "A" ? q.audioKeyA : q.audioKeyB,
                          },
                          q.voice,
                          "conversational"
                        )
                      }
                      className="w-24 h-24 rounded-full border-2 border-[#9E2A2B] bg-xuan-bg hover:bg-[#9E2A2B] text-[#9E2A2B] hover:text-[#F5F2E9] flex flex-col items-center justify-center transition cursor-pointer"
                    >
                      <span className="font-serif text-xl font-bold">听</span>
                      <Volume2 className="w-5 h-5 mt-1" />
                    </button>
                    <span className="text-xs text-xuan-muted">
                      Voz Sorteada: <strong>{q.voice}</strong> · {q.promptPt}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl mx-auto">
                    {(["A", "B"] as const).map((side) => {
                      const isTarget = q.correctSide === side;
                      const isSelected = activeSoloRun.currentChoice === side;
                      let st = "border-xuan-border bg-xuan-bg hover:border-[#9E2A2B]";
                      if (activeSoloRun.currentChoice !== null) {
                        if (isTarget)
                          st = "border-2 border-[#3A6B59] bg-[#3A6B59]/10";
                        else if (isSelected)
                          st = "border-2 border-[#9E2A2B] bg-[#9E2A2B]/10";
                      }
                      return (
                        <button
                          key={side}
                          type="button"
                          disabled={activeSoloRun.currentChoice !== null}
                          onClick={() => handleAnswerSoloRun(side)}
                          className={`p-5 rounded-xl border text-center space-y-1.5 transition ${st}`}
                        >
                          <div className="text-xs font-mono text-xuan-muted">
                            Opção [{side}]
                          </div>
                          <div className="font-pinyin text-2xl font-bold text-xuan-ink">
                            {side === "A" ? q.pinyinA : q.pinyinB}
                          </div>
                          {activeSoloRun.currentChoice !== null && (
                            <div className="text-xs text-xuan-muted pt-1">
                              {side === "A" ? q.hanziA : q.hanziB} —{" "}
                              {side === "A" ? q.meaningA : q.meaningB}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Indicador Discreto do Fantasma do Amigo após clicar! */}
                  {activeSoloRun.currentChoice !== null && (
                    <div className="max-w-xl mx-auto p-4 rounded-xl bg-xuan-bg border border-xuan-border flex flex-wrap items-center justify-between gap-3">
                      <div className="text-left text-xs space-y-1">
                        <div className="font-bold text-xuan-ink">
                          {activeSoloRun.currentChoice === q.correctSide
                            ? "✓ Você acertou esta rodada!"
                            : `✗ Resposta correta: [${q.correctSide}]`}
                        </div>
                        {ghostMove && (
                          <div className="text-[#9C7A3C] flex items-center gap-1.5 font-medium">
                            <Ghost className="w-3.5 h-3.5" />
                            <span>
                              Fantasma de{" "}
                              {activeSoloRun.ghostChallenge?.challengerName}: respondeu em{" "}
                              <strong>{(ghostMove.reactionMs / 1000).toFixed(1)}s</strong> e{" "}
                              <strong>
                                {ghostMove.correct ? "acertou" : "errou"}
                              </strong>
                            </span>
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={handleNextSoloRun}
                        className="px-5 py-2 rounded-lg bg-[#9E2A2B] text-[#F5F2E9] text-xs font-serif font-bold"
                      >
                        Próxima Questão →
                      </button>
                    </div>
                  )}
                </div>
              );
            })()
          ) : (
            <div className="space-y-4 py-4">
              <Trophy className="w-10 h-10 text-[#9C7A3C] mx-auto" />
              <h4 className="font-serif text-xl font-bold text-xuan-ink">
                Desafio Concluído e Registrado no SQLite!
              </h4>
              <p className="text-sm text-xuan-muted">
                Sua pontuação:{" "}
                <strong className="text-[#9E2A2B]">
                  {activeSoloRun.myLog.reduce((a, b) => a + b.points, 0)} pts
                </strong>{" "}
                ({activeSoloRun.myLog.filter((x) => x.correct).length}/
                {activeSoloRun.questions.length} acertos)
              </p>
              <button
                type="button"
                onClick={() => setActiveSoloRun(null)}
                className="px-6 py-2.5 rounded-lg bg-[#9E2A2B] text-[#F5F2E9] font-serif font-bold text-xs"
              >
                Voltar ao Pavilhão Multiplayer
              </button>
            </div>
          )}
        </section>
      )}

      {/* ===================================================================== */}
      {/* SEÇÃO 1: SALAS AO VIVO SÍNCRONAS (1v1, GRUPO ATÉ 8 & COOPERATIVO)     */}
      {/* ===================================================================== */}
      {section === "sync_arena" && !activeSoloRun && (
        <>
          {!activeRoomCode ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Criar Sala Síncrona */}
              <div className="p-6 rounded-xl bg-xuan-card border border-xuan-border space-y-4">
                <div className="flex items-center gap-2 border-b border-xuan-border pb-3">
                  <Swords className="w-5 h-5 text-[#9E2A2B]" />
                  <h3 className="font-serif text-base font-bold">
                    Criar Sala de Duelo Ao Vivo
                  </h3>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block font-semibold text-xuan-muted mb-1">
                      Modalidade da Sala:
                    </label>
                    <select
                      value={roomMode}
                      onChange={(e) =>
                        setRoomMode(
                          e.target.value as
                            | "duel_1v1"
                            | "group_arena"
                            | "coop_blind_partner"
                        )
                      }
                      className="w-full px-3 py-2 rounded-lg bg-xuan-bg border border-xuan-border font-semibold text-xuan-ink"
                    >
                      <option value="duel_1v1">
                        Duelo Imperial 1v1 (Tempo Real & Velocidade ms)
                      </option>
                      <option value="group_arena">
                        Arena de Grupo (Até 8 Amigos Simultâneos)
                      </option>
                      <option value="coop_blind_partner">
                        Modo Cooperativo ("Parceiro de Escuta Cega")
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-xuan-muted mb-1">
                      Foco Fonético da Partida:
                    </label>
                    <select
                      value={focusCategory}
                      onChange={(e) => setFocusCategory(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-xuan-bg border border-xuan-border font-semibold text-xuan-ink"
                    >
                      <option value="dissyllable_tone_matrix">
                        Dissílabos (20 Combinações & Tone Sandhi)
                      </option>
                      <option value="monosyllable_tone">
                        Tons de 1 Sílaba (Mǎ or Mà)
                      </option>
                      <option value="initial_final">
                        Iniciais & Finais Difíceis (VOT, Retroflexas, -n/-ng)
                      </option>
                      <option value="full_sentences">
                        Frases Inteiras em Contexto
                      </option>
                      <option value="chaotic_mix">
                        Misto Caótico (Todas as Categorias + 6 Vozes)
                      </option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-xuan-muted mb-1">
                        Número de Rodadas:
                      </label>
                      <select
                        value={totalRounds}
                        onChange={(e) => setTotalRounds(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-lg bg-xuan-bg border border-xuan-border font-semibold text-xuan-ink"
                      >
                        <option value={10}>10 Rodadas</option>
                        <option value={15}>15 Rodadas</option>
                        <option value={20}>20 Rodadas</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold text-xuan-muted mb-1">
                        Velocidade da Fala:
                      </label>
                      <select
                        value={roomSpeed}
                        onChange={(e) => setRoomSpeed(e.target.value as SpeechSpeed)}
                        className="w-full px-3 py-2 rounded-lg bg-xuan-bg border border-xuan-border font-semibold text-xuan-ink"
                      >
                        <option value="classroom">Classroom (-25%)</option>
                        <option value="conversational">Conversational (100%)</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleCreateRoom}
                    className="w-full py-2.5 rounded-lg bg-[#9E2A2B] hover:bg-[#7D2021] text-[#F5F2E9] font-serif font-bold text-sm transition flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Abrir Sala & Gerar Código de 4 Caracteres
                  </button>
                </div>
              </div>

              {/* Entrar por Código ou Lobby Aberto */}
              <div className="p-6 rounded-xl bg-xuan-card border border-xuan-border space-y-4">
                <div className="flex items-center justify-between border-b border-xuan-border pb-3">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-[#3A6B59]" />
                    <h3 className="font-serif text-base font-bold">
                      Lobby Aberto & Código de Sala
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={fetchAsyncHub}
                    className="p-1.5 rounded border border-xuan-border hover:bg-xuan-subtle text-xuan-muted"
                    title="Atualizar Lobby"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={joinCodeInput}
                    onChange={(e) => setJoinCodeInput(e.target.value)}
                    placeholder="Código da sala (ex.: 龍-842 ou 842)"
                    className="flex-1 px-3 py-2 rounded-lg bg-xuan-bg border border-xuan-border text-xs font-mono text-xuan-ink"
                  />
                  <button
                    type="button"
                    onClick={() => handleJoinRoom(joinCodeInput)}
                    className="px-4 py-2 rounded-lg bg-[#3A6B59] text-[#F5F2E9] text-xs font-serif font-bold"
                  >
                    Entrar na Sala
                  </button>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {lobbyRooms.length === 0 ? (
                    <p className="text-xs text-xuan-muted italic py-6 text-center">
                      Nenhuma sala aberta no momento. Crie uma sala ao lado para jogar com seus amigos!
                    </p>
                  ) : (
                    lobbyRooms.map((r) => (
                      <div
                        key={r.code}
                        className="p-3 rounded-lg bg-xuan-bg border border-xuan-border flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-serif font-bold text-xuan-ink">
                            [{r.code}] {r.title}
                          </div>
                          <div className="text-[11px] text-xuan-muted">
                            Anfitrião: {r.hostName} · {r.playerCount} jogador(es) ·{" "}
                            {r.totalRounds} rodadas
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleJoinRoom(r.code)}
                          className="px-3 py-1.5 rounded bg-[#9E2A2B] text-[#F5F2E9] font-bold"
                        >
                          Entrar
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* DENTRO DA SALA AO VIVO SÍNCRONA */
            <div className="p-6 rounded-xl bg-xuan-card border-2 border-[#9E2A2B] space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-xuan-border pb-4">
                <div>
                  <span className="px-2.5 py-0.5 rounded bg-[#9E2A2B] text-[#F5F2E9] font-mono text-xs font-bold">
                    CÓDIGO DA SALA: {roomData?.code || activeRoomCode}
                  </span>
                  <h3 className="font-serif text-lg font-bold mt-1">
                    {roomData?.title || "Salão de Duelo Síncrono"}
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  {roomData?.status === "lobby" && (
                    <button
                      type="button"
                      onClick={handleStartSyncRoom}
                      className="px-5 py-2 rounded-lg bg-[#3A6B59] text-[#F5F2E9] font-serif font-bold text-xs flex items-center gap-1.5"
                    >
                      <Play className="w-4 h-4" />
                      Iniciar Partida Ao Vivo Agora
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveRoomCode(null);
                      setRoomData(null);
                      fetchAsyncHub();
                    }}
                    className="px-3 py-2 rounded-lg border border-xuan-border text-xs font-semibold text-xuan-muted hover:text-xuan-ink"
                  >
                    Sair da Sala
                  </button>
                </div>
              </div>

              {/* Placar Ao Vivo dos Jogadores Conectados */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {roomPlayers.map((p, idx) => {
                  const curAns =
                    roomData && p.answers?.[String(roomData.currentRound)];
                  return (
                    <div
                      key={p.userId}
                      className="p-3.5 rounded-lg bg-xuan-bg border border-xuan-border space-y-1"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-serif font-bold truncate">
                          #{idx + 1} {p.displayName}
                        </span>
                        <span className="font-mono font-bold text-[#9E2A2B]">
                          {p.score} pts
                        </span>
                      </div>
                      <div className="text-[11px] text-xuan-muted flex items-center justify-between">
                        <span>{p.scholarRank}</span>
                        <span>Combo {p.combo}x</span>
                      </div>
                      {roomData?.status === "playing" && (
                        <div className="text-[11px] pt-1 border-t border-xuan-border font-mono">
                          {curAns ? (
                            <span
                              className={
                                curAns.correct ? "text-[#3A6B59]" : "text-[#9E2A2B]"
                              }
                            >
                              {curAns.correct ? "✓ Acertou" : "✗ Errou"} em{" "}
                              {(curAns.reactionMs / 1000).toFixed(2)}s (+
                              {curAns.pointsGained})
                            </span>
                          ) : (
                            <span className="text-xuan-muted">Ouvindo...</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Estado da Partida: Lobby / Playing / Finished */}
              {roomData?.status === "lobby" && (
                <div className="p-8 rounded-xl bg-xuan-bg border border-xuan-border text-center space-y-3">
                  <p className="font-serif text-base font-bold">
                    Aguardando os amigos entrarem com o código{" "}
                    <span className="text-[#9E2A2B] font-mono">{roomData.code}</span>
                  </p>
                  <p className="text-xs text-xuan-muted">
                    Quando todos estiverem prontos, clique em “Iniciar Partida Ao Vivo Agora”. Todas as telas tocarão o mesmo áudio simultaneamente!
                  </p>
                </div>
              )}

              {roomData?.status === "playing" &&
                roomData.questions[roomData.currentRound] &&
                (() => {
                  const q = roomData.questions[roomData.currentRound];
                  const myPlayerIdx = Math.max(
                    0,
                    roomPlayers.findIndex((p) => p.userId === effectiveUser.userId)
                  );
                  const myPlayer = roomPlayers[myPlayerIdx];
                  const myAnswer =
                    myPlayer?.answers?.[String(roomData.currentRound)];
                  const isCoopSpeaker =
                    roomData.roomMode === "coop_blind_partner" &&
                    roomData.currentRound % 2 === myPlayerIdx % 2;
                  const activeRoundHints = roomPlayers
                    .map((p) => p.partnerHints?.[String(roomData.currentRound)])
                    .filter(Boolean);

                  return (
                    <div className="p-6 rounded-xl bg-xuan-bg border border-xuan-border text-center space-y-6">
                      <div className="flex items-center justify-between text-xs text-xuan-muted">
                        <span>
                          Rodada{" "}
                          <strong className="text-xuan-ink">
                            {roomData.currentRound + 1} / {roomData.totalRounds}
                          </strong>
                        </span>
                        <span>
                          Voz Sincronizada:{" "}
                          <strong className="text-xuan-ink">{q.voice}</strong>
                        </span>
                      </div>

                      {roomData.roomMode === "coop_blind_partner" && (
                        <div className="p-3 rounded-lg bg-xuan-card border border-[#9C7A3C]/40 text-xs text-left space-y-2">
                          <div className="font-serif font-bold text-[#9C7A3C]">
                            Modo Cooperativo · Parceiro de Escuta Cega ({isCoopSpeaker ? "Seu Turno: Emissor" : "Seu Turno: Ouvinte"}):
                          </div>
                          {isCoopSpeaker ? (
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span>
                                Palavra Secreta para pronunciar ao seu parceiro:{" "}
                                <strong className="text-xuan-ink font-hanzi text-base">
                                  {q.correctSide === "A" ? q.hanziA : q.hanziB} (
                                  {q.correctSide === "A" ? q.pinyinA : q.pinyinB})
                                </strong>
                              </span>
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={partnerHintText}
                                  onChange={(e) => setPartnerHintText(e.target.value)}
                                  placeholder="Dica fonética p/ parceiro..."
                                  className="px-2 py-1 rounded bg-xuan-bg border border-xuan-border text-xuan-ink text-xs"
                                />
                                <button
                                  type="button"
                                  onClick={handleDispatchPartnerHint}
                                  className="px-3 py-1 rounded bg-[#9E2A2B] text-[#F5F2E9] font-bold flex items-center gap-1"
                                >
                                  <Send className="w-3 h-3" />
                                  Notificar Parceiro
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <div>
                                Ouça a pronúncia do seu parceiro (ou o áudio de referência) e marque abaixo o que ouviu!
                              </div>
                              {activeRoundHints.map((h, hIdx) => (
                                <div
                                  key={hIdx}
                                  className="px-2.5 py-1 rounded bg-xuan-bg border border-[#9C7A3C]/40 text-[#9C7A3C] font-semibold"
                                >
                                  Sinal de {h?.dispatchedBy}: “{h?.note}”
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex flex-col items-center space-y-2">
                        <button
                          type="button"
                          onClick={() =>
                            playLexicalItemAudio(
                              {
                                hanzi:
                                  q.correctSide === "A" ? q.hanziA : q.hanziB,
                                asciiKey:
                                  q.correctSide === "A"
                                    ? q.asciiKeyA
                                    : q.asciiKeyB,
                                audioKey:
                                  q.correctSide === "A"
                                    ? q.audioKeyA
                                    : q.audioKeyB,
                              },
                              q.voice,
                              roomData.speed
                            )
                          }
                          className="w-20 h-20 rounded-full border-2 border-[#9E2A2B] bg-xuan-card hover:bg-[#9E2A2B] text-[#9E2A2B] hover:text-[#F5F2E9] flex flex-col items-center justify-center transition"
                        >
                          <Volume2 className="w-6 h-6" />
                          <span className="text-[10px] font-bold mt-0.5">
                            Ouvir
                          </span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl mx-auto">
                        {(["A", "B"] as const).map((side) => {
                          const isTarget = q.correctSide === side;
                          const isChosen = myAnswer?.choice === side;
                          let st =
                            "border-xuan-border bg-xuan-card hover:border-[#9E2A2B]";
                          if (myAnswer) {
                            if (isTarget)
                              st = "border-2 border-[#3A6B59] bg-[#3A6B59]/10";
                            else if (isChosen)
                              st = "border-2 border-[#9E2A2B] bg-[#9E2A2B]/10";
                          }
                          return (
                            <button
                              key={side}
                              type="button"
                              disabled={Boolean(myAnswer)}
                              onClick={() => handleAnswerSyncRound(side)}
                              className={`p-5 rounded-xl border text-center space-y-1 transition ${st}`}
                            >
                              <div className="text-xs font-mono text-xuan-muted">
                                [{side}]
                              </div>
                              <div className="font-pinyin text-2xl font-bold text-xuan-ink">
                                {side === "A" ? q.pinyinA : q.pinyinB}
                              </div>
                              {myAnswer && (
                                <div className="text-xs text-xuan-muted">
                                  {side === "A" ? q.hanziA : q.hanziB} —{" "}
                                  {side === "A" ? q.meaningA : q.meaningB}
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {myAnswer && (
                        <div className="pt-3 flex items-center justify-between max-w-xl mx-auto">
                          <span className="text-xs font-serif font-bold">
                            Seu tempo:{" "}
                            <strong>
                              {(myAnswer.reactionMs / 1000).toFixed(2)}s
                            </strong>{" "}
                            (+{myAnswer.pointsGained} pts)
                          </span>
                          <button
                            type="button"
                            onClick={handleNextSyncRound}
                            className="px-5 py-2 rounded-lg bg-[#9E2A2B] text-[#F5F2E9] text-xs font-serif font-bold"
                          >
                            Avançar Rodada para a Sala →
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}

              {roomData?.status === "finished" && (
                <div className="p-8 rounded-xl bg-xuan-bg border border-xuan-border text-center space-y-4">
                  <Crown className="w-10 h-10 text-[#9C7A3C] mx-auto" />
                  <h4 className="font-serif text-xl font-bold">
                    Partida Encerrada · ELO Atualizado!
                  </h4>
                  <p className="text-xs text-xuan-muted">
                    Vencedor da Sala:{" "}
                    <strong className="text-[#9E2A2B]">
                      {roomPlayers[0]?.displayName} ({roomPlayers[0]?.score} pts)
                    </strong>
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ===================================================================== */}
      {/* SEÇÃO 2: DUELOS ASSÍNCRONOS CONTRA FANTASMA & METAS DA IRMANDADE      */}
      {/* ===================================================================== */}
      {section === "ghost_duels" && !activeSoloRun && (
        <div className="space-y-6">
          {/* Metas Coletivas da Irmandade (Clã de Estudos) */}
          <div className="p-6 rounded-xl bg-xuan-card border border-xuan-border space-y-4">
            <div className="flex items-center justify-between border-b border-xuan-border pb-3">
              <div>
                <h3 className="font-serif text-base font-bold text-xuan-ink">
                  Metas Coletivas da Irmandade · 同窗共修
                </h3>
                <p className="text-xs text-xuan-muted">
                  Todos os usuários cadastrados somam esforços para bater as metas acústicas da semana
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {collectiveGoals.map((g) => {
                const pct = Math.min(
                  100,
                  Math.round((g.currentValue / Math.max(1, g.targetValue)) * 100)
                );
                return (
                  <div
                    key={g.id}
                    className="p-4 rounded-lg bg-xuan-bg border border-xuan-border space-y-2.5 flex flex-col justify-between"
                  >
                    <div className="space-y-1">
                      <div className="font-serif font-bold text-xs text-xuan-ink">
                        {g.titlePt}
                      </div>
                      <p className="text-[11px] text-xuan-muted">{g.descriptionPt}</p>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[11px] font-mono">
                        <span className="text-[#3A6B59] font-bold">
                          {g.currentValue} / {g.targetValue}
                        </span>
                        <span>{pct}%</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-xuan-card overflow-hidden border border-xuan-border">
                        <div
                          className="h-full bg-[#3A6B59]"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-xuan-muted pt-1 truncate">
                        Contribuidores:{" "}
                        {Object.entries(g.contributors)
                          .map(([name, val]) => `${name.split(" ")[0]} (${val})`)
                          .join(", ")}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mural de Desafios contra o Fantasma de um Amigo */}
          <div className="p-6 rounded-xl bg-xuan-card border border-xuan-border space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-xuan-border pb-3">
              <div>
                <h3 className="font-serif text-base font-bold text-xuan-ink flex items-center gap-2">
                  <Ghost className="w-4 h-4 text-[#9E2A2B]" />
                  Duelos Assíncronos contra o “Fantasma” de um Amigo
                </h3>
                <p className="text-xs text-xuan-muted">
                  Jogue exatamente a mesma seed de questões e compare seu tempo em milissegundos questão por questão!
                </p>
              </div>

              <button
                type="button"
                onClick={() => startSoloChallengeRun("create_ghost")}
                className="px-4 py-2 rounded-lg bg-[#9E2A2B] hover:bg-[#7D2021] text-[#F5F2E9] text-xs font-serif font-bold flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Gravar & Publicar Meu Fantasma (15 Questões)
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ghostChallenges.map((gc) => (
                <div
                  key={gc.id}
                  className="p-4 rounded-xl bg-xuan-bg border border-xuan-border space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-serif font-bold text-sm text-xuan-ink">
                        Fantasma de {gc.challengerName}
                      </span>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-xuan-card border border-xuan-border text-[#9E2A2B]">
                        {gc.challengerScore} pts · {gc.challengerAccuracy}%
                      </span>
                    </div>
                    <div className="text-xs text-xuan-muted">
                      Patente: {gc.challengerRank} · Tempo médio:{" "}
                      <strong>{(gc.challengerAvgMs / 1000).toFixed(2)}s</strong> · Seed:{" "}
                      <span className="font-mono">{gc.seed}</span>
                    </div>
                  </div>

                  {gc.attempts.length > 0 && (
                    <div className="text-[11px] text-xuan-muted border-t border-xuan-border pt-2">
                      Última revanche: <strong>{gc.attempts[0].playerName}</strong> fez{" "}
                      {gc.attempts[0].score} pts (
                      {gc.attempts[0].won ? "Venceu o Fantasma!" : "Fantasma defendeu!"})
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => startSoloChallengeRun("play_ghost", gc)}
                    className="w-full py-2 rounded-lg bg-[#3A6B59] hover:opacity-95 text-[#F5F2E9] text-xs font-serif font-bold flex items-center justify-center gap-1.5"
                  >
                    <Swords className="w-3.5 h-3.5" />
                    Desafiar Fantasma Agora ({gc.questions.length} Questões)
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SEÇÃO 3: EXAME IMPERIAL DIÁRIO/SEMANAL (科举 KĒJǓ — QUADRO 金榜)       */}
      {/* ===================================================================== */}
      {section === "keju_exam" && !activeSoloRun && (
        <div className="space-y-6">
          <div className="p-6 rounded-xl bg-xuan-card border border-xuan-border flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1 max-w-xl">
              <div className="inline-flex items-center gap-1.5 text-xs font-serif font-bold text-[#9E2A2B]">
                <Scroll className="w-4 h-4" />
                Exame Imperial Oficial de Hoje · 科举殿试
              </div>
              <h3 className="font-serif text-lg font-bold text-xuan-ink">
                Prova Oficial de 20 Questões (Seed Fixa Diária)
              </h3>
              <p className="text-xs text-xuan-muted">
                Composta por 5 monossílabos, 5 dissílabos (matriz tonal), 5 contrastes de iniciais/finais e 5 frases inteiras nas 6 vozes nativas. Crave sua nota no Quadro de Honra Imperial (金榜 Jīnbǎng)!
              </p>
            </div>

            <button
              type="button"
              onClick={() => startSoloChallengeRun("imperial_exam")}
              className="px-6 py-3 rounded-xl bg-[#9E2A2B] hover:bg-[#7D2021] text-[#F5F2E9] font-serif font-bold text-sm shadow-sm flex items-center gap-2"
            >
              <Award className="w-4 h-4" />
              Iniciar Exame Imperial (20 Questões)
            </button>
          </div>

          {/* Quadro de Honra Imperial (金榜 Jīnbǎng) */}
          <div className="p-6 rounded-xl bg-xuan-card border border-xuan-border space-y-4">
            <h4 className="font-serif text-base font-bold text-xuan-ink flex items-center gap-2">
              <Crown className="w-4 h-4 text-[#9C7A3C]" />
              Quadro de Honra Imperial · 金榜题名
            </h4>

            <div className="space-y-2">
              {jinbang.map((entry, idx) => (
                <div
                  key={`${entry.examKey}_${entry.userId}`}
                  className="p-3.5 rounded-lg bg-xuan-bg border border-xuan-border flex flex-wrap items-center justify-between gap-2 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-[#9E2A2B]/15 text-[#9E2A2B] font-serif font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <div>
                      <span className="font-serif font-bold text-sm text-xuan-ink">
                        {entry.displayName}
                      </span>
                      <span className="ml-2 text-xuan-muted">
                        [{entry.scholarRank}]
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 font-mono">
                    <span className="text-[#3A6B59] font-bold">
                      Precisão: {entry.accuracy}%
                    </span>
                    <span className="text-xuan-muted">
                      Reação: {(entry.avgReactionMs / 1000).toFixed(2)}s
                    </span>
                    <span className="text-[#9E2A2B] font-bold text-sm">
                      {entry.score} pts
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SEÇÃO 4: MURAL DE ATIVIDADES & RANKING GERAL DOS AMIGOS (LEADERBOARD) */}
      {/* ===================================================================== */}
      {section === "leaderboard" && !activeSoloRun && (
        <div className="p-6 rounded-xl bg-xuan-card border border-xuan-border space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-xuan-border pb-3">
            <div>
              <h3 className="font-serif text-base font-bold text-xuan-ink">
                Ranking Geral da Academia · 翰林同窗榜
              </h3>
              <p className="text-xs text-xuan-muted">
                Ordene por ELO, Precisão em Dissílabos, Precisão em Frases ou Velocidade Acústica, inspecione o perfil de um colega e envie um desafio direto
              </p>
            </div>

            <div className="inline-flex rounded-lg bg-xuan-bg border border-xuan-border p-0.5 text-xs">
              {[
                { id: "elo" as const, label: "Por ELO" },
                { id: "dissyl" as const, label: "Dissílabos %" },
                { id: "sentence" as const, label: "Frases %" },
                { id: "speed" as const, label: "Reação (ms)" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setLeaderboardSort(tab.id)}
                  className={`px-3 py-1.5 rounded-md font-semibold transition ${
                    leaderboardSort === tab.id
                      ? "bg-[#9E2A2B] text-[#F5F2E9]"
                      : "text-xuan-muted hover:text-xuan-ink"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {inspectedScholar && (
            <div className="p-5 rounded-xl bg-xuan-bg border-2 border-[#9E2A2B] space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-xuan-border pb-3">
                <div>
                  <span className="text-[11px] font-mono uppercase text-[#9E2A2B] font-bold">
                    Ficha Acústica do Acadêmico · 同窗档案
                  </span>
                  <h4 className="font-serif text-lg font-bold text-xuan-ink">
                    {inspectedScholar.displayName}{" "}
                    <span className="text-xs font-normal text-[#9E2A2B]">
                      ({inspectedScholar.scholarRank})
                    </span>
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectedScholar(null)}
                  className="px-3 py-1 rounded border border-xuan-border text-xs text-xuan-muted hover:text-xuan-ink"
                >
                  Fechar Ficha
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-xuan-card border border-xuan-border">
                  <div className="text-xuan-muted">Rating ELO</div>
                  <div className="font-mono text-base font-bold text-xuan-ink">
                    {inspectedScholar.eloRating}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-xuan-card border border-xuan-border">
                  <div className="text-xuan-muted">Precisão Dissilábica</div>
                  <div className="font-mono text-base font-bold text-[#3A6B59]">
                    {inspectedScholar.dissyllableAccuracy}%
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-xuan-card border border-xuan-border">
                  <div className="text-xuan-muted">Compreensão em Frases</div>
                  <div className="font-mono text-base font-bold text-[#3B596A]">
                    {inspectedScholar.sentenceAccuracy}%
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-xuan-card border border-xuan-border">
                  <div className="text-xuan-muted">Velocidade Acústica</div>
                  <div className="font-mono text-base font-bold text-[#9C7A3C]">
                    {(inspectedScholar.avgReactionMs / 1000).toFixed(2)}s
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs">
                <span className="text-xuan-muted">
                  Ponto forte:{" "}
                  <strong className="text-xuan-ink">
                    {inspectedScholar.dissyllableAccuracy >= inspectedScholar.sentenceAccuracy
                      ? "Matriz Tonal Dissilábica & Coarticulação"
                      : "Prosódia em Frases Contextuais"}
                  </strong>{" "}
                  · Ponto vulnerável para duelo:{" "}
                  <strong className="text-[#9E2A2B]">
                    {inspectedScholar.dissyllableAccuracy < inspectedScholar.sentenceAccuracy
                      ? "Dissílabos (T2 vs T3)"
                      : "Frases Longas Contínuas"}
                  </strong>
                </span>
                <button
                  type="button"
                  onClick={() =>
                    startSoloChallengeRun(
                      "create_ghost",
                      undefined,
                      inspectedScholar.username
                    )
                  }
                  className="px-4 py-1.5 rounded bg-[#9E2A2B] text-[#F5F2E9] font-serif font-bold"
                >
                  Lançar Desafio de 15 Questões para @{inspectedScholar.username}
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {sortedLeaderboard.map((scholar, idx) => (
              <div
                key={scholar.id}
                className="p-4 rounded-lg bg-xuan-bg border border-xuan-border flex flex-wrap items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg imperial-seal flex items-center justify-center font-serif font-bold">
                    {idx + 1}
                  </span>
                  <div>
                    <div className="font-serif font-bold text-sm text-xuan-ink">
                      {scholar.displayName}{" "}
                      <span className="text-xs font-normal text-[#9E2A2B]">
                        · {scholar.scholarRank}
                      </span>
                    </div>
                    <div className="text-[11px] text-xuan-muted font-mono">
                      @{scholar.username} · {scholar.xp} XP · Ofensiva:{" "}
                      {scholar.streakDays} dias
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 font-mono">
                  <div>
                    <span className="text-xuan-muted">ELO: </span>
                    <strong className="text-xuan-ink">{scholar.eloRating}</strong>
                  </div>
                  <div>
                    <span className="text-xuan-muted">Dissílabos: </span>
                    <strong className="text-[#3A6B59]">
                      {scholar.dissyllableAccuracy}%
                    </strong>
                  </div>
                  <div>
                    <span className="text-xuan-muted">Frases: </span>
                    <strong className="text-[#3B596A]">
                      {scholar.sentenceAccuracy}%
                    </strong>
                  </div>
                  <div>
                    <span className="text-xuan-muted">Reação: </span>
                    <strong className="text-[#9C7A3C]">
                      {(scholar.avgReactionMs / 1000).toFixed(2)}s
                    </strong>
                  </div>

                  <div className="flex items-center gap-1.5 font-sans">
                    <button
                      type="button"
                      onClick={() => setInspectedScholar(scholar)}
                      className="px-2.5 py-1.5 rounded border border-xuan-border bg-xuan-card text-xuan-ink hover:border-[#9E2A2B] font-serif font-semibold"
                    >
                      Ver Ficha
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        startSoloChallengeRun("create_ghost", undefined, scholar.username)
                      }
                      className="px-3 py-1.5 rounded bg-[#9E2A2B] text-[#F5F2E9] font-serif font-bold"
                    >
                      Desafiar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
