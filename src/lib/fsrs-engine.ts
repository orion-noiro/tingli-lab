import {
  AttemptLog,
  ConfusionMatrices,
  FSRSCardState,
  MinimalPairCategory,
  MinimalPairEntry,
  RadarScores,
  SpeechSpeed,
  ToneNumber,
  UserProfile,
} from "@/types/phonetics";

// FSRS v4.5 Default Weights (optimized for auditory phonetic discrimination)
const W = [
  0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05,
  0.34, 1.26, 0.29, 2.61,
];

export type FSRSRating = 1 | 2 | 3 | 4; // 1 = Again, 2 = Hard (Slow >2500ms), 3 = Good, 4 = Easy (<1200ms)

export function computeFSRSRating(correct: boolean, reactionTimeMs: number): FSRSRating {
  if (!correct) return 1;
  if (reactionTimeMs > 2500) return 2; // High cognitive effort -> reinforce sooner
  if (reactionTimeMs < 1200) return 4; // Automatic phonetic perception
  return 3;
}

export function updateFSRSCard(
  existing: FSRSCardState | undefined,
  itemId: string,
  category: MinimalPairCategory | "tone_matrix_20" | "sandhi",
  correct: boolean,
  reactionTimeMs: number,
  nowMs: number = Date.now()
): FSRSCardState {
  const rating = computeFSRSRating(correct, reactionTimeMs);
  const clampedRt = Math.min(Math.max(reactionTimeMs, 200), 15000);

  if (!existing) {
    const initialStability = W[rating - 1];
    const initialDifficulty = Math.min(
      10,
      Math.max(1, W[4] - Math.exp(W[5] * (rating - 1)) + 1)
    );
    const intervalDays =
      rating === 1 ? 0.005 : rating === 2 ? 0.25 : rating === 3 ? 1.0 : 3.0;

    return {
      itemId,
      category,
      stability: initialStability,
      difficulty: initialDifficulty,
      reps: 1,
      lapses: rating === 1 ? 1 : 0,
      lastReviewMs: nowMs,
      nextDueMs: nowMs + intervalDays * 86400 * 1000,
      avgReactionMs: clampedRt,
      fastStreak: rating >= 3 ? 1 : 0,
    };
  }

  const elapsedDays = Math.max(
    0.001,
    (nowMs - existing.lastReviewMs) / (86400 * 1000)
  );
  const retrievability = Math.pow(1 + elapsedDays / (9 * existing.stability), -1);

  // Update difficulty D in [1..10]
  const nextDUnclamped = existing.difficulty - W[6] * (rating - 3);
  const meanRevertedD = W[7] * W[4] + (1 - W[7]) * nextDUnclamped;
  const difficulty = Math.min(10, Math.max(1, meanRevertedD));

  let stability = existing.stability;
  let intervalDays = 1;

  if (rating === 1) {
    // Lapse formula
    stability = Math.max(
      0.1,
      W[11] *
        Math.pow(difficulty, -W[12]) *
        (Math.pow(existing.stability + 1, W[13]) - 1) *
        Math.exp(W[14] * (1 - retrievability))
    );
    intervalDays = 0.01; // ~15 minutes for immediate phonetic remediation
  } else {
    const hardPenalty = rating === 2 ? W[15] : 1;
    const easyBonus = rating === 4 ? W[16] : 1;
    stability =
      existing.stability *
      (1 +
        Math.exp(W[8]) *
          (11 - difficulty) *
          Math.pow(existing.stability, -W[9]) *
          (Math.exp(W[10] * (1 - retrievability)) - 1) *
          hardPenalty *
          easyBonus);
    intervalDays = Math.max(0.1, stability);
  }

  const avgReactionMs = Math.round(existing.avgReactionMs * 0.7 + clampedRt * 0.3);
  const fastStreak = rating >= 3 ? existing.fastStreak + 1 : 0;

  return {
    itemId,
    category,
    stability: Number(stability.toFixed(3)),
    difficulty: Number(difficulty.toFixed(3)),
    reps: existing.reps + 1,
    lapses: rating === 1 ? existing.lapses + 1 : existing.lapses,
    lastReviewMs: nowMs,
    nextDueMs: Math.round(nowMs + intervalDays * 86400 * 1000),
    avgReactionMs,
    fastStreak,
  };
}

export function updateConfusionAndRadar(
  profile: UserProfile,
  attempt: AttemptLog,
  expectedTones?: ToneNumber[],
  chosenTones?: ToneNumber[]
): { confusion: ConfusionMatrices; radarScores: RadarScores } {
  const confusion: ConfusionMatrices = {
    monosyllableTones: { ...profile.confusion.monosyllableTones },
    dissyllableTones: { ...profile.confusion.dissyllableTones },
    contrastStats: { ...profile.confusion.contrastStats },
  };

  // 1. Update Monosyllable 5x5 matrix if applicable
  if (expectedTones && chosenTones && expectedTones.length === 1 && chosenTones.length === 1) {
    const key = `${expectedTones[0]}_${chosenTones[0]}`;
    confusion.monosyllableTones[key] = (confusion.monosyllableTones[key] || 0) + 1;
  }

  // 2. Update Dissyllable 20x20 matrix if applicable
  if (expectedTones && chosenTones && expectedTones.length >= 2 && chosenTones.length >= 2) {
    const key = `${expectedTones[0]}${expectedTones[1]}_${chosenTones[0]}${chosenTones[1]}`;
    confusion.dissyllableTones[key] = (confusion.dissyllableTones[key] || 0) + 1;
    // Also feed individual syllable confusions into the 5x5 matrix
    const k1 = `${expectedTones[0]}_${chosenTones[0]}`;
    const k2 = `${expectedTones[1]}_${chosenTones[1]}`;
    confusion.monosyllableTones[k1] = (confusion.monosyllableTones[k1] || 0) + 1;
    confusion.monosyllableTones[k2] = (confusion.monosyllableTones[k2] || 0) + 1;
  }

  // 3. Update SubCategory contrast stats
  const subKey = attempt.subCategory || attempt.category;
  const prevStat = confusion.contrastStats[subKey] || {
    total: 0,
    correct: 0,
    slowCorrect: 0,
    totalReactionMs: 0,
  };
  confusion.contrastStats[subKey] = {
    total: prevStat.total + 1,
    correct: prevStat.correct + (attempt.correct ? 1 : 0),
    slowCorrect:
      prevStat.slowCorrect + (attempt.correct && attempt.reactionTimeMs > 2500 ? 1 : 0),
    totalReactionMs: prevStat.totalReactionMs + Math.min(attempt.reactionTimeMs, 10000),
  };

  // Also aggregate by top-level category
  const catKey = `__cat_${attempt.category}`;
  const prevCat = confusion.contrastStats[catKey] || {
    total: 0,
    correct: 0,
    slowCorrect: 0,
    totalReactionMs: 0,
  };
  confusion.contrastStats[catKey] = {
    total: prevCat.total + 1,
    correct: prevCat.correct + (attempt.correct ? 1 : 0),
    slowCorrect:
      prevCat.slowCorrect + (attempt.correct && attempt.reactionTimeMs > 2500 ? 1 : 0),
    totalReactionMs: prevCat.totalReactionMs + Math.min(attempt.reactionTimeMs, 10000),
  };

  // 4. Recompute Bayesian smoothed Radar Scores (prior = 65% with weight 4)
  const computeAxisScore = (catName: string, currentVal: number) => {
    const st = confusion.contrastStats[`__cat_${catName}`];
    if (!st || st.total === 0) return currentVal;
    const effectiveCorrect = st.correct - st.slowCorrect * 0.25;
    const bayesianAcc = ((effectiveCorrect + 2.6) / (st.total + 4)) * 100;
    return Math.round(Math.min(100, Math.max(15, bayesianAcc)));
  };

  const radarScores: RadarScores = {
    tonesMonosyllable: computeAxisScore(
      "monosyllable_tone",
      profile.radarScores.tonesMonosyllable
    ),
    tonesDissyllable: computeAxisScore(
      "dissyllable_tone_matrix",
      profile.radarScores.tonesDissyllable
    ),
    aspirationContrast: computeAxisScore(
      "initial_aspiration",
      profile.radarScores.aspirationContrast
    ),
    retroflexPalatal: computeAxisScore(
      "initial_place",
      profile.radarScores.retroflexPalatal
    ),
    nasalCodas: computeAxisScore("final_nasal", profile.radarScores.nasalCodas),
    umlautVowels: computeAxisScore("final_vowel", profile.radarScores.umlautVowels),
  };

  return { confusion, radarScores };
}

export function selectAdaptiveMinimalPairs(
  pairs: MinimalPairEntry[],
  profile: UserProfile,
  count: number = 15,
  filterCategory?: MinimalPairCategory | "all",
  filterSubCategory?: string
): MinimalPairEntry[] {
  let pool = pairs;
  if (filterCategory && filterCategory !== "all") {
    pool = pool.filter((p) => p.category === filterCategory);
  }
  if (filterSubCategory && filterSubCategory !== "all") {
    pool = pool.filter((p) => p.subCategory === filterSubCategory);
  }
  if (pool.length === 0) return [];

  const now = Date.now();

  // Score each candidate pair by pedagogical urgency
  const scored = pool.map((pair) => {
    const card = profile.fsrsCards[pair.id];
    const subStat = profile.confusion.contrastStats[pair.subCategory];

    let urgency = 0;

    if (card) {
      if (card.nextDueMs <= now) {
        // Overdue card! High priority
        const overdueHours = (now - card.nextDueMs) / (3600 * 1000);
        urgency += 50 + Math.min(40, overdueHours * 2) + card.difficulty * 3;
      } else {
        // Not yet due
        urgency += 5 + card.difficulty;
      }
      if (card.avgReactionMs > 2500) {
        urgency += 20; // Slow reaction latency reinforcement
      }
    } else {
      // Unseen item: prioritize foundational difficulty 1-3 + weak subcategories
      urgency += 30 + (4 - Math.min(3, pair.difficulty)) * 4;
    }

    if (subStat && subStat.total >= 2) {
      const errRate = 1 - subStat.correct / subStat.total;
      const slowRate = subStat.slowCorrect / subStat.total;
      urgency += errRate * 45 + slowRate * 20;
    }

    // Small random jitter for variety
    urgency += Math.random() * 12;

    return { pair, urgency };
  });

  scored.sort((a, b) => b.urgency - a.urgency);
  return scored.slice(0, count).map((s) => s.pair);
}

// ============================================================================
// DETERMINISTIC SEED CHALLENGE GENERATOR ("STUDY WITH FRIENDS")
// ============================================================================

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeedString(seedStr: string): number {
  let h = 2166136261 >>> 0;
  const clean = seedStr.trim().toUpperCase();
  for (let i = 0; i < clean.length; i++) {
    h ^= clean.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export interface ChallengeConfig {
  seedCode: string;
  category: MinimalPairCategory | "all";
  speed: SpeechSpeed;
  questionCount: number;
}

export function generateSeedCode(
  category: MinimalPairCategory | "all" = "all",
  speed: SpeechSpeed = "conversational",
  questionCount: number = 15
): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let randPart = "";
  for (let i = 0; i < 4; i++) {
    randPart += chars[Math.floor(Math.random() * chars.length)];
  }
  const catCode =
    category === "all"
      ? "MIX"
      : category === "monosyllable_tone"
      ? "T1S"
      : category === "dissyllable_tone_matrix"
      ? "T2S"
      : category === "initial_aspiration"
      ? "ASP"
      : category === "initial_place"
      ? "RET"
      : category === "final_nasal"
      ? "NAS"
      : category === "final_vowel"
      ? "VOW"
      : "CTX";
  const spdCode = speed === "conversational" ? "FAST" : "CLAS";
  return `TL-${catCode}-${spdCode}-${questionCount}-${randPart}`;
}

export function parseSeedCode(seedCode: string): ChallengeConfig {
  const parts = seedCode.trim().toUpperCase().split("-");
  const catMap: Record<string, MinimalPairCategory | "all"> = {
    MIX: "all",
    T1S: "monosyllable_tone",
    T2S: "dissyllable_tone_matrix",
    ASP: "initial_aspiration",
    RET: "initial_place",
    NAS: "final_nasal",
    VOW: "final_vowel",
    CTX: "context_sentence",
  };
  const category = parts.length >= 2 && catMap[parts[1]] ? catMap[parts[1]] : "all";
  const speed: SpeechSpeed =
    parts.length >= 3 && parts[2] === "CLAS" ? "classroom" : "conversational";
  const questionCount =
    parts.length >= 4 && !isNaN(Number(parts[3]))
      ? Math.min(40, Math.max(5, Number(parts[3])))
      : 15;
  return {
    seedCode: seedCode.trim().toUpperCase(),
    category,
    speed,
    questionCount,
  };
}

export function getSeedChallengeQuestions(
  allPairs: MinimalPairEntry[],
  seedCode: string
): Array<{
  pair: MinimalPairEntry;
  targetSide: "A" | "B";
}> {
  const cfg = parseSeedCode(seedCode);
  const pool =
    cfg.category === "all"
      ? allPairs
      : allPairs.filter((p) => p.category === cfg.category);
  if (pool.length === 0) return [];

  const rng = mulberry32(hashSeedString(cfg.seedCode));
  const indices = pool.map((_, i) => i);

  // Deterministic Fisher-Yates shuffle
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = indices[i];
    indices[i] = indices[j];
    indices[j] = tmp;
  }

  const chosen = indices.slice(0, cfg.questionCount);
  return chosen.map((idx) => ({
    pair: pool[idx],
    targetSide: rng() < 0.5 ? "A" : "B",
  }));
}
