import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

try { process.loadEnvFile(".env.local"); } catch {}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseSecretKey);

function hashPassword(password, salt) {
  const useSalt = salt || crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, useSalt, 64).toString("hex");
  return `${useSalt}:${derived}`;
}

function computeScholarRank(elo) {
  if (elo >= 1650) return "状元 Zhuàngyuán";
  if (elo >= 1450) return "进士 Jìnshì";
  if (elo >= 1300) return "贡士 Gòngshì";
  if (elo >= 1150) return "举人 Jǔrén";
  if (elo >= 1030) return "秀才 Xiùcái";
  return "童生 Tóngshēng";
}

async function seed() {
  console.log("Verificando usuários no Supabase...");
  const { data: users, error } = await supabase.from("users").select("id");
  if (error) {
    console.error("Erro:", error);
    return;
  }

  if (users.length === 0) {
    console.log("Inserindo Eruditos Imperiais...");
    const defaultPass = hashPassword("hanlin123");
    const scholars = [
      {
        username: "li_qingzhao",
        display_name: "李清照 · Lǐ Qīngzhào",
        elo_rating: 1520,
        scholar_rank: computeScholarRank(1520),
        password_hash: defaultPass,
        streak_days: 14,
        xp: 4850,
        dissyllable_correct: 210,
        dissyllable_total: 228,
        sentence_correct: 145,
        sentence_total: 155,
        total_reaction_ms: 285000,
        total_attempts: 250,
      },
      {
        username: "su_dongpo",
        display_name: "苏东坡 · Sū Dōngpō",
        elo_rating: 1390,
        scholar_rank: computeScholarRank(1390),
        password_hash: defaultPass,
        streak_days: 9,
        xp: 3620,
        dissyllable_correct: 175,
        dissyllable_total: 200,
        sentence_correct: 118,
        sentence_total: 135,
        total_reaction_ms: 276000,
        total_attempts: 210,
      },
      {
        username: "ouyang_xiu",
        display_name: "欧阳修 · Ōuyáng Xiū",
        elo_rating: 1240,
        scholar_rank: computeScholarRank(1240),
        password_hash: defaultPass,
        streak_days: 6,
        xp: 2490,
        dissyllable_correct: 130,
        dissyllable_total: 160,
        sentence_correct: 92,
        sentence_total: 112,
        total_reaction_ms: 265000,
        total_attempts: 175,
      },
      {
        username: "wang_anshi",
        display_name: "王安石 · Wáng Ānshí",
        elo_rating: 1120,
        scholar_rank: computeScholarRank(1120),
        password_hash: defaultPass,
        streak_days: 4,
        xp: 1680,
        dissyllable_correct: 95,
        dissyllable_total: 125,
        sentence_correct: 68,
        sentence_total: 88,
        total_reaction_ms: 240000,
        total_attempts: 140,
      },
    ];

    const { error: insErr } = await supabase.from("users").insert(scholars);
    if (insErr) {
      console.error("Erro ao inserir:", insErr);
    } else {
      console.log("Eruditos inseridos com sucesso!");
    }
  } else {
    console.log("Usuários já existem:", users.length);
  }
}

seed();
