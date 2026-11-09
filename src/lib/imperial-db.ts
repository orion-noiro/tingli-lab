import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { AuthUser, ScholarRank } from "@/types/phonetics";

const requireNative = createRequire(import.meta.url);

// Compute Scholar Rank (Patente da Academia Imperial) from ELO Rating
export function computeScholarRank(elo: number): ScholarRank {
  if (elo >= 1650) return "状元 Zhuàngyuán";
  if (elo >= 1450) return "进士 Jìnshì";
  if (elo >= 1300) return "贡士 Gòngshì";
  if (elo >= 1150) return "举人 Jǔrén";
  if (elo >= 1030) return "秀才 Xiùcái";
  return "童生 Tóngshēng";
}

export function hashPassword(password: string, salt?: string): string {
  const useSalt = salt || crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, useSalt, 64).toString("hex");
  return `${useSalt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(":");
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(keyHex, "hex");
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

// Singleton SQLite Database instance in globalThis for Next.js hot reload safety
interface SqliteStatement {
  run: (...params: unknown[]) => { changes: number; lastInsertRowid: number | bigint };
  get: (...params: unknown[]) => Record<string, unknown> | undefined;
  all: (...params: unknown[]) => Array<Record<string, unknown>>;
}

interface SqliteDatabase {
  exec: (sql: string) => void;
  prepare: (sql: string) => SqliteStatement;
}

const globalForDb = globalThis as unknown as {
  __tingliImperialDb?: SqliteDatabase;
};

export function getImperialDb(): SqliteDatabase {
  if (globalForDb.__tingliImperialDb) {
    return globalForDb.__tingliImperialDb;
  }

  const dataDir = path.join(process.cwd(), "data");
  fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = path.join(dataDir, "tingli_imperial.db");

  const { DatabaseSync } = requireNative("node:sqlite") as {
    DatabaseSync: new (filename: string) => SqliteDatabase;
  };
  const db = new DatabaseSync(dbPath);

  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA busy_timeout = 5000;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      scholar_rank TEXT NOT NULL DEFAULT '童生 Tóngshēng',
      elo_rating INTEGER NOT NULL DEFAULT 1000,
      streak_days INTEGER NOT NULL DEFAULT 1,
      xp INTEGER NOT NULL DEFAULT 0,
      dissyllable_correct INTEGER NOT NULL DEFAULT 0,
      dissyllable_total INTEGER NOT NULL DEFAULT 0,
      sentence_correct INTEGER NOT NULL DEFAULT 0,
      sentence_total INTEGER NOT NULL DEFAULT 0,
      total_reaction_ms INTEGER NOT NULL DEFAULT 0,
      total_attempts INTEGER NOT NULL DEFAULT 0,
      profile_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS study_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      mode TEXT NOT NULL,
      category TEXT NOT NULL,
      sub_category TEXT NOT NULL,
      target_id TEXT NOT NULL,
      correct INTEGER NOT NULL,
      reaction_ms INTEGER NOT NULL,
      voice_used TEXT NOT NULL,
      speed_used TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS confusion_matrix (
      user_id INTEGER NOT NULL,
      matrix_type TEXT NOT NULL,
      pair_key TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, matrix_type, pair_key)
    );

    CREATE TABLE IF NOT EXISTS sync_rooms (
      code TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      host_user_id INTEGER NOT NULL,
      host_name TEXT NOT NULL,
      room_mode TEXT NOT NULL DEFAULT 'duel_1v1',
      focus_category TEXT NOT NULL DEFAULT 'dissyllable_tone_matrix',
      total_rounds INTEGER NOT NULL DEFAULT 10,
      speed TEXT NOT NULL DEFAULT 'conversational',
      status TEXT NOT NULL DEFAULT 'lobby',
      current_round INTEGER NOT NULL DEFAULT 0,
      round_started_at INTEGER NOT NULL DEFAULT 0,
      questions_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_room_players (
      room_code TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      username TEXT NOT NULL,
      display_name TEXT NOT NULL,
      scholar_rank TEXT NOT NULL,
      elo_rating INTEGER NOT NULL,
      is_ready INTEGER NOT NULL DEFAULT 1,
      score INTEGER NOT NULL DEFAULT 0,
      combo INTEGER NOT NULL DEFAULT 0,
      correct_count INTEGER NOT NULL DEFAULT 0,
      total_reaction_ms INTEGER NOT NULL DEFAULT 0,
      answers_json TEXT NOT NULL DEFAULT '{}',
      partner_hint_json TEXT NOT NULL DEFAULT '{}',
      PRIMARY KEY (room_code, user_id)
    );

    CREATE TABLE IF NOT EXISTS async_challenges (
      id TEXT PRIMARY KEY,
      challenger_id INTEGER NOT NULL,
      challenger_name TEXT NOT NULL,
      challenger_rank TEXT NOT NULL,
      target_username TEXT NOT NULL DEFAULT '',
      focus_category TEXT NOT NULL,
      seed TEXT NOT NULL,
      questions_json TEXT NOT NULL,
      ghost_log_json TEXT NOT NULL,
      challenger_score INTEGER NOT NULL,
      challenger_accuracy INTEGER NOT NULL,
      challenger_avg_ms INTEGER NOT NULL,
      attempts_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS collective_goals (
      id TEXT PRIMARY KEY,
      title_pt TEXT NOT NULL,
      description_pt TEXT NOT NULL,
      goal_type TEXT NOT NULL,
      target_value INTEGER NOT NULL,
      current_value INTEGER NOT NULL DEFAULT 0,
      contributors_json TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS daily_exams (
      exam_key TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      username TEXT NOT NULL,
      display_name TEXT NOT NULL,
      scholar_rank TEXT NOT NULL,
      score INTEGER NOT NULL,
      accuracy INTEGER NOT NULL,
      avg_reaction_ms INTEGER NOT NULL,
      details_json TEXT NOT NULL DEFAULT '{}',
      completed_at TEXT NOT NULL,
      PRIMARY KEY (exam_key, user_id)
    );
  `);

  seedInitialImperialData(db);
  globalForDb.__tingliImperialDb = db;
  return db;
}

function seedInitialImperialData(db: SqliteDatabase): void {
  const countRow = db.prepare("SELECT COUNT(*) as cnt FROM users").get();
  const userCount = Number(countRow?.cnt || 0);
  const nowIso = new Date().toISOString();

  if (userCount === 0) {
    const defaultPass = hashPassword("hanlin123");
    const scholars = [
      {
        username: "li_qingzhao",
        displayName: "李清照 · Lǐ Qīngzhào",
        elo: 1520,
        streak: 14,
        xp: 4850,
        disC: 210,
        disT: 228,
        sentC: 145,
        sentT: 155,
        reactMs: 285000,
        attempts: 250,
      },
      {
        username: "su_dongpo",
        displayName: "苏东坡 · Sū Dōngpō",
        elo: 1390,
        streak: 9,
        xp: 3620,
        disC: 175,
        disT: 200,
        sentC: 118,
        sentT: 135,
        reactMs: 276000,
        attempts: 210,
      },
      {
        username: "ouyang_xiu",
        displayName: "欧阳修 · Ōuyáng Xiū",
        elo: 1240,
        streak: 6,
        xp: 2490,
        disC: 130,
        disT: 160,
        sentC: 92,
        sentT: 112,
        reactMs: 265000,
        attempts: 175,
      },
      {
        username: "wang_anshi",
        displayName: "王安石 · Wáng Ānshí",
        elo: 1120,
        streak: 4,
        xp: 1680,
        disC: 95,
        disT: 125,
        sentC: 68,
        sentT: 88,
        reactMs: 240000,
        attempts: 140,
      },
    ];

    const insertUser = db.prepare(`
      INSERT INTO users (
        username, display_name, password_hash, scholar_rank, elo_rating,
        streak_days, xp, dissyllable_correct, dissyllable_total,
        sentence_correct, sentence_total, total_reaction_ms, total_attempts, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const s of scholars) {
      insertUser.run(
        s.username,
        s.displayName,
        defaultPass,
        computeScholarRank(s.elo),
        s.elo,
        s.streak,
        s.xp,
        s.disC,
        s.disT,
        s.sentC,
        s.sentT,
        s.reactMs,
        s.attempts,
        nowIso
      );
    }
  }

  // Seed Collective Goals (Metas da Irmandade)
  const goalCount = Number(db.prepare("SELECT COUNT(*) as cnt FROM collective_goals").get()?.cnt || 0);
  if (goalCount === 0) {
    const insertGoal = db.prepare(`
      INSERT INTO collective_goals (
        id, title_pt, description_pt, goal_type, target_value, current_value, contributors_json, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertGoal.run(
      "goal_dissyllables_1000",
      "Meta da Irmandade I · 1.000 Pares Dissilábicos Dominados",
      "Domínio coletivo das 20 combinações tonais dissilábicas e Tone Sandhi com precisão acústica.",
      "dissyllables_mastered",
      1000,
      612,
      JSON.stringify({
        "李清照 · Lǐ Qīngzhào": 210,
        "苏东坡 · Sū Dōngpō": 175,
        "欧阳修 · Ōuyáng Xiū": 132,
        "王安石 · Wáng Ānshí": 95,
      }),
      nowIso
    );

    insertGoal.run(
      "goal_sentences_300",
      "Meta da Irmandade II · 300 Frases Inteiras em Contexto",
      "Escuta e discriminação prosódica de sentenças completas e pares mínimos contextuais nas 6 vozes.",
      "sentences_heard",
      300,
      184,
      JSON.stringify({
        "李清照 · Lǐ Qīngzhào": 68,
        "苏东坡 · Sū Dōngpō": 52,
        "欧阳修 · Ōuyáng Xiū": 38,
        "王安石 · Wáng Ānshí": 26,
      }),
      nowIso
    );

    insertGoal.run(
      "goal_hvpt_500",
      "Meta da Irmandade III · 500 Desafios de Alta Variabilidade (HVPT)",
      "Treino auditivo cruzando timbres masculinos graves (Yunjian) e femininos agudos (Xiaoxiao/Xiaoyi).",
      "total_correct",
      500,
      340,
      JSON.stringify({
        "李清照 · Lǐ Qīngzhào": 120,
        "苏东坡 · Sū Dōngpō": 95,
        "欧阳修 · Ōuyáng Xiū": 75,
        "王安石 · Wáng Ānshí": 50,
      }),
      nowIso
    );
  }

  // Seed Sample Ghost Duel Challenge (15 questions) if empty or < 15 questions
  const existingSeedGhost = db
    .prepare("SELECT questions_json FROM async_challenges WHERE id = 'ghost_imperial_001'")
    .get();
  let needsSeedGhost = !existingSeedGhost;
  if (existingSeedGhost?.questions_json) {
    try {
      const parsed = JSON.parse(String(existingSeedGhost.questions_json));
      if (!Array.isArray(parsed) || parsed.length < 15) {
        needsSeedGhost = true;
      }
    } catch {
      needsSeedGhost = true;
    }
  }

  if (needsSeedGhost) {
    const sampleGhostQuestions = [
      {
        index: 0,
        promptPt: "Qual palavra dissilábica foi pronunciada?",
        hanziA: "水饺",
        pinyinA: "shuǐ jiǎo",
        meaningA: "guioza cozido",
        hanziB: "睡觉",
        pinyinB: "shuì jiào",
        meaningB: "dormir",
        asciiKeyA: "shui3_jiao3",
        asciiKeyB: "shui4_jiao4",
        correctSide: "A",
        voice: "xiaoxiao",
      },
      {
        index: 1,
        promptPt: "Qual palavra dissilábica foi pronunciada?",
        hanziA: "买卖",
        pinyinA: "mǎi mài",
        meaningA: "comércio",
        hanziB: "埋没",
        pinyinB: "mái mò",
        meaningB: "enterrar",
        asciiKeyA: "mai3_mai4",
        asciiKeyB: "mai2_mo4",
        correctSide: "B",
        voice: "yunxi",
      },
      {
        index: 2,
        promptPt: "Qual palavra dissilábica foi pronunciada?",
        hanziA: "熊猫",
        pinyinA: "xióng māo",
        meaningA: "urso panda",
        hanziB: "胸毛",
        pinyinB: "xiōng máo",
        meaningB: "pelos no peito",
        asciiKeyA: "xiong2_mao1",
        asciiKeyB: "xiong1_mao2",
        correctSide: "A",
        voice: "yunjian",
      },
      {
        index: 3,
        promptPt: "Qual palavra dissilábica foi pronunciada?",
        hanziA: "老板",
        pinyinA: "lǎo bǎn",
        meaningA: "chefe / patrão",
        hanziB: "老伴",
        pinyinB: "lǎo bàn",
        meaningB: "cônjuge idoso",
        asciiKeyA: "lao3_ban3",
        asciiKeyB: "lao3_ban4",
        correctSide: "B",
        voice: "xiaoyi",
      },
      {
        index: 4,
        promptPt: "Qual palavra dissilábica foi pronunciada?",
        hanziA: "练习",
        pinyinA: "liàn xí",
        meaningA: "praticar",
        hanziB: "联系",
        pinyinB: "lián xì",
        meaningB: "contatar",
        asciiKeyA: "lian4_xi2",
        asciiKeyB: "lian2_xi4",
        correctSide: "A",
        voice: "xiaobei",
      },
      {
        index: 5,
        promptPt: "Qual palavra dissilábica foi pronunciada?",
        hanziA: "北京",
        pinyinA: "běi jīng",
        meaningA: "Pequim",
        hanziB: "背景",
        pinyinB: "bèi jǐng",
        meaningB: "contexto / fundo",
        asciiKeyA: "bei3_jing1",
        asciiKeyB: "bei4_jing3",
        correctSide: "B",
        voice: "hsiaochen",
      },
      {
        index: 6,
        promptPt: "Qual palavra dissilábica foi pronunciada?",
        hanziA: "上海",
        pinyinA: "shàng hǎi",
        meaningA: "Xangai",
        hanziB: "伤害",
        pinyinB: "shāng hài",
        meaningB: "ferir / magoar",
        asciiKeyA: "shang4_hai3",
        asciiKeyB: "shang1_hai4",
        correctSide: "A",
        voice: "yunxi",
      },
      {
        index: 7,
        promptPt: "Qual palavra dissilábica foi pronunciada?",
        hanziA: "会议",
        pinyinA: "huì yì",
        meaningA: "reunião",
        hanziB: "回忆",
        pinyinB: "huí yì",
        meaningB: "recordação",
        asciiKeyA: "hui4_yi4",
        asciiKeyB: "hui2_yi4",
        correctSide: "B",
        voice: "xiaoxiao",
      },
      {
        index: 8,
        promptPt: "Qual palavra dissilábica foi pronunciada?",
        hanziA: "语言",
        pinyinA: "yǔ yán",
        meaningA: "idioma",
        hanziB: "预言",
        pinyinB: "yù yán",
        meaningB: "profecia",
        asciiKeyA: "yu3_yan2",
        asciiKeyB: "yu4_yan2",
        correctSide: "A",
        voice: "yunjian",
      },
      {
        index: 9,
        promptPt: "Qual palavra dissilábica foi pronunciada?",
        hanziA: "火车",
        pinyinA: "huǒ chē",
        meaningA: "trem",
        hanziB: "货车",
        pinyinB: "huò chē",
        meaningB: "caminhão de carga",
        asciiKeyA: "huo3_che1",
        asciiKeyB: "huo4_che1",
        correctSide: "B",
        voice: "xiaoyi",
      },
      {
        index: 10,
        promptPt: "Qual palavra dissilábica foi pronunciada?",
        hanziA: "四十四",
        pinyinA: "sì shí sì",
        meaningA: "quarenta e quatro",
        hanziB: "十四",
        pinyinB: "shí sì",
        meaningB: "quatorze",
        asciiKeyA: "si4_shi2_si4",
        asciiKeyB: "shi2_si4",
        correctSide: "A",
        voice: "xiaoxiao",
      },
      {
        index: 11,
        promptPt: "Qual palavra dissilábica foi pronunciada?",
        hanziA: "诗人",
        pinyinA: "shī rén",
        meaningA: "poeta",
        hanziB: "私人",
        pinyinB: "sī rén",
        meaningB: "privado / pessoal",
        asciiKeyA: "shi1_ren2",
        asciiKeyB: "si1_ren2",
        correctSide: "B",
        voice: "yunxi",
      },
      {
        index: 12,
        promptPt: "Qual palavra dissilábica foi pronunciada?",
        hanziA: "吃糖",
        pinyinA: "chī táng",
        meaningA: "comer doce",
        hanziB: "池塘",
        pinyinB: "chí táng",
        meaningB: "lagoa",
        asciiKeyA: "chi1_tang2",
        asciiKeyB: "chi2_tang2",
        correctSide: "A",
        voice: "xiaobei",
      },
      {
        index: 13,
        promptPt: "Qual palavra dissilábica foi pronunciada?",
        hanziA: "大娘",
        pinyinA: "dà niáng",
        meaningA: "tia mais velha",
        hanziB: "大梁",
        pinyinB: "dà liáng",
        meaningB: "viga mestra",
        asciiKeyA: "da4_niang2",
        asciiKeyB: "da4_liang2",
        correctSide: "B",
        voice: "yunjian",
      },
      {
        index: 14,
        promptPt: "Qual palavra dissilábica foi pronunciada?",
        hanziA: "蜜蜂",
        pinyinA: "mì fēng",
        meaningA: "abelha",
        hanziB: "密封",
        pinyinB: "mì fēng (fèng)",
        meaningB: "vedar / selar",
        asciiKeyA: "mi4_feng1",
        asciiKeyB: "mi4_feng4",
        correctSide: "A",
        voice: "hsiaochen",
      },
    ];

    const sampleGhostLog = sampleGhostQuestions.map((q, i) => ({
      roundIndex: i,
      choice: i === 5 || i === 11 ? (q.correctSide === "A" ? "B" : "A") : q.correctSide,
      correct: i !== 5 && i !== 11,
      reactionMs: 1180 + (i * 170) % 750,
    }));

    db.prepare(`
      INSERT OR REPLACE INTO async_challenges (
        id, challenger_id, challenger_name, challenger_rank, target_username,
        focus_category, seed, questions_json, ghost_log_json,
        challenger_score, challenger_accuracy, challenger_avg_ms, attempts_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      "ghost_imperial_001",
      1,
      "李清照 · Lǐ Qīngzhào",
      "进士 Jìnshì",
      "",
      "dissyllable_tone_matrix",
      "HANLIN-2026-DISSYL",
      JSON.stringify(sampleGhostQuestions),
      JSON.stringify(sampleGhostLog),
      1820,
      87,
      1420,
      JSON.stringify([]),
      nowIso
    );
  }
}

export function mapRowToAuthUser(row: Record<string, unknown>): AuthUser {
  const disT = Number(row.dissyllable_total || 0);
  const disC = Number(row.dissyllable_correct || 0);
  const sentT = Number(row.sentence_total || 0);
  const sentC = Number(row.sentence_correct || 0);
  const att = Number(row.total_attempts || 0);
  const react = Number(row.total_reaction_ms || 0);

  return {
    id: Number(row.id),
    username: String(row.username),
    displayName: String(row.display_name),
    scholarRank: String(row.scholar_rank) as ScholarRank,
    eloRating: Number(row.elo_rating),
    streakDays: Number(row.streak_days),
    xp: Number(row.xp),
    dissyllableAccuracy: disT > 0 ? Math.round((disC / disT) * 100) : 85,
    sentenceAccuracy: sentT > 0 ? Math.round((sentC / sentT) * 100) : 85,
    avgReactionMs: att > 0 ? Math.round(react / att) : 1450,
    createdAt: String(row.created_at),
  };
}
