import { createClient } from "@supabase/supabase-js";

try { process.loadEnvFile(".env.local"); } catch {}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseSecretKey);

async function seedGhost() {
  const { data: challenges } = await supabase.from("async_challenges").select("id").eq("id", "ghost_imperial_001");
  if (!challenges || challenges.length === 0) {
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
    ];

    const sampleGhostLog = sampleGhostQuestions.map((q, i) => ({
      roundIndex: i,
      choice: q.correctSide,
      correct: true,
      reactionMs: 1250 + (i * 120),
    }));

    await supabase.from("async_challenges").insert({
      id: "ghost_imperial_001",
      challenger_id: 1,
      challenger_name: "李清照 · Lǐ Qīngzhào",
      challenger_rank: "进士 Jìnshì",
      target_username: "",
      focus_category: "dissyllable_tone_matrix",
      seed: "HANLIN-2026-DISSYL",
      questions_json: sampleGhostQuestions,
      ghost_log_json: sampleGhostLog,
      challenger_score: 1820,
      challenger_accuracy: 92,
      challenger_avg_ms: 1350,
      attempts_json: [],
    });
    console.log("Ghost Challenge inserido!");
  } else {
    console.log("Ghost Challenge já existe!");
  }
}

seedGhost();
