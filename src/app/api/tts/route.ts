import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const runtime = "nodejs";

const NEURAL_VOICE_MAP: Record<string, string> = {
  xiaoxiao: "zh-CN-XiaoxiaoNeural",
  yunxi: "zh-CN-YunxiNeural",
  xiaoyi: "zh-CN-XiaoyiNeural",
  yunjian: "zh-CN-YunjianNeural",
  xiaobei: "zh-CN-liaoning-XiaobeiNeural",
  hsiaochen: "zh-TW-HsiaoChenNeural",
  human_female: "zh-CN-XiaoxiaoNeural",
  human_male: "zh-CN-YunxiNeural",
};

const SPEED_RATE_MAP: Record<string, string> = {
  classroom: "-25%",
  conversational: "+0%",
};

// Monophonic disambiguation for single-character polyphonic syllables (多音字)
const MONOPHONIC_SYLLABLE_HANZI: Record<string, string> = {
  ma1: "妈", ma2: "麻", ma3: "马", ma4: "骂", ma5: "吗",
  ba1: "八", ba2: "拔", ba3: "靶", ba4: "爸", ba5: "吧",
  pa1: "趴", pa2: "爬", pa4: "怕",
  da1: "搭", da2: "答", da3: "打", da4: "大",
  ta1: "他", ta3: "塔", ta4: "踏",
  na1: "拿", na2: "拿", na3: "哪", na4: "那",
  la1: "拉", la2: "旯", la3: "喇", la4: "辣",
  ga1: "咖", ga2: "嘎", ga3: "尬", ga4: "尬",
  ka1: "咖", ka3: "卡",
  ha1: "哈", ha2: "蛤", ha3: "哈", ha4: "哈",
  za1: "扎", za2: "杂", za3: "咋",
  ca1: "擦", ca3: "礤",
  sa1: "仨", sa3: "洒", sa4: "飒",
  zha1: "渣", zha2: "闸", zha3: "眨", zha4: "炸",
  cha1: "插", cha2: "茶", cha3: "叉", cha4: "岔",
  sha1: "沙", sha2: "啥", sha3: "傻", sha4: "厦",
  ra2: "然", ra3: "染",
  ji1: "机", ji2: "及", ji3: "挤", ji4: "记",
  qi1: "七", qi2: "齐", qi3: "起", qi4: "气",
  xi1: "西", xi2: "习", xi3: "洗", xi4: "戏",
  zhi1: "知", zhi2: "直", zhi3: "纸", zhi4: "志",
  chi1: "吃", chi2: "池", chi3: "尺", chi4: "赤",
  shi1: "师", shi2: "十", shi3: "史", shi4: "四",
  ri4: "日",
  zi1: "资", zi2: "词", zi3: "紫", zi4: "字",
  ci1: "疵", ci2: "词", ci3: "此", ci4: "次",
  si1: "丝", si3: "死", si4: "四",
  yi1: "衣", yi2: "移", yi3: "椅", yi4: "意",
  wu1: "屋", wu2: "无", wu3: "五", wu4: "物",
  yu1: "淤", yu2: "鱼", yu3: "雨", yu4: "玉",
  lv2: "驴", lv3: "旅", lv4: "绿",
  nv3: "女", nv4: "恧",
  nu2: "奴", nu3: "努", nu4: "怒",
  lu1: "", lu2: "炉", lu3: "鲁", lu4: "路",
  mai2: "埋", mai3: "买", mai4: "卖",
  shui3: "水", shui4: "税",
  jiao1: "交", jiao2: "嚼", jiao3: "脚", jiao4: "叫",
  jue1: "撅", jue2: "绝", jue3: "崛", jue4: "倔",
  hang2: "航", xing2: "形",
  zhang3: "掌", chang2: "尝",
  zhong1: "钟", zhong3: "肿", zhong4: "众", chong2: "虫",
  hai2: "孩", huan2: "环",
  le4: "乐", yue4: "月",
  de5: "的", dei3: "得", de2: "德",
};

function normalizeAsciiKey(pinyin: string): string {
  return pinyin
    .trim()
    .toLowerCase()
    .replace(/ü/g, "v")
    .replace(/u:/g, "v")
    .replace(/\s+/g, "_")
    .replace(/[^a-zv1-5_]/g, "");
}

function getSafeTtsText(text: string, pinyin: string): string {
  const cleanText = (text || "").trim();
  const asciiKey = normalizeAsciiKey(pinyin);

  if (cleanText.length <= 1 && asciiKey && MONOPHONIC_SYLLABLE_HANZI[asciiKey]) {
    return MONOPHONIC_SYLLABLE_HANZI[asciiKey];
  }
  if (!cleanText || cleanText === "□" || cleanText === "■") {
    return MONOPHONIC_SYLLABLE_HANZI[asciiKey] || "啊";
  }
  return cleanText;
}

function buildAudioResponse(buffer: Buffer, sourceTag: string): NextResponse {
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": String(buffer.length),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Audio-Source": sourceTag,
    },
  });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const text = (searchParams.get("text") || "").trim();
  const pinyin = (searchParams.get("pinyin") || "").trim();
  const voiceRaw = (searchParams.get("voice") || "xiaoxiao").trim().toLowerCase();
  const speedRaw = (searchParams.get("speed") || "conversational").trim().toLowerCase();
  const directKey = (searchParams.get("key") || "").trim();

  if (!text && !pinyin && !directKey) {
    return NextResponse.json(
      { error: "Missing required parameter: text, pinyin, or key" },
      { status: 400 }
    );
  }

  const voiceId = NEURAL_VOICE_MAP[voiceRaw] ? voiceRaw : "xiaoxiao";
  const speed = speedRaw === "classroom" ? "classroom" : "conversational";
  const asciiKey = normalizeAsciiKey(pinyin);

  const publicAudioDir = path.join(process.cwd(), "public", "audio");
  const generatedDir = path.join(publicAudioDir, "generated");
  const cacheDir = path.join(publicAudioDir, "cache");

  // Compute deterministic hashes
  const normKey = `${text}|${pinyin.toLowerCase()}`;
  const fullMd5 = crypto.createHash("md5").update(normKey, "utf8").digest("hex");
  const shortMd5 = fullMd5.slice(0, 12);
  const textOnlyMd5 = crypto.createHash("md5").update(text, "utf8").digest("hex").slice(0, 12);

  const generatedPath = path.join(generatedDir, `${voiceId}_${speed}_${fullMd5}.mp3`);
  const cachePath = path.join(cacheDir, `${voiceId}_${speed}_${fullMd5}.mp3`);

  // Candidate paths on disk (ordered from most specific speed-matched to general pre-generated)
  const candidates: Array<{ filePath: string; minBytes: number; tag: string }> = [
    { filePath: generatedPath, minBytes: 1800, tag: "generated-cache" },
    { filePath: cachePath, minBytes: 1800, tag: "audio-cache" },
  ];

  if (directKey) {
    const cleanRel = directKey.replace(/^\/+/, "").replace(/^audio\//, "");
    const hasExplicitSpeedDir = /\/(classroom|conversational)\//.test(cleanRel);
    const voiceSubstituted = cleanRel
      .replace(
        /\/(human_female|human_male|xiaoxiao|yunxi|xiaoyi|yunjian|xiaobei|hsiaochen)\//,
        `/${voiceId}/`
      )
      .replace(/\/(classroom|conversational)\//, `/${speed}/`);

    if (
      hasExplicitSpeedDir ||
      speed === "conversational" ||
      voiceId === "human_female" ||
      voiceId === "human_male"
    ) {
      candidates.push({
        filePath: path.join(publicAudioDir, voiceSubstituted),
        minBytes: 1500,
        tag: "direct-key-voice",
      });
    }
  }

  // If 1-syllable and human voice requested (or neural voice in conversational speed)
  if (asciiKey && !asciiKey.includes("_") && /^[a-zv]+[1-5]$/.test(asciiKey)) {
    if (voiceId === "human_female" || voiceId === "human_male") {
      candidates.unshift({
        filePath: path.join(publicAudioDir, "syllables", voiceId, `${asciiKey}.mp3`),
        minBytes: 1500,
        tag: `syllable-${voiceId}`,
      });
    } else if (speed === "conversational") {
      candidates.push({
        filePath: path.join(publicAudioDir, "syllables", voiceId, `${asciiKey}.mp3`),
        minBytes: 1500,
        tag: `syllable-${voiceId}`,
      });
    }
  }

  // If multi-syllable word (speed-segregated on disk)
  if (asciiKey && asciiKey.includes("_")) {
    candidates.push({
      filePath: path.join(publicAudioDir, "words", voiceId, speed, `${asciiKey}.mp3`),
      minBytes: 2048,
      tag: `words-${voiceId}-${speed}`,
    });
  }

  // If sentence
  if (text.length >= 3) {
    candidates.push(
      {
        filePath: path.join(publicAudioDir, "sentences", voiceId, speed, `sent_${textOnlyMd5}.mp3`),
        minBytes: 2048,
        tag: `sentence-${voiceId}-${speed}`,
      },
      {
        filePath: path.join(publicAudioDir, "sentences", voiceId, speed, `sent_${shortMd5}.mp3`),
        minBytes: 2048,
        tag: `sentence-${voiceId}-${speed}`,
      }
    );
    if (speed === "conversational") {
      candidates.push(
        {
          filePath: path.join(publicAudioDir, "sentences", voiceId, `sent_${textOnlyMd5}.mp3`),
          minBytes: 2048,
          tag: `sentence-${voiceId}`,
        },
        {
          filePath: path.join(publicAudioDir, "sentences", voiceId, `sent_${shortMd5}.mp3`),
          minBytes: 2048,
          tag: `sentence-${voiceId}`,
        }
      );
    }
  }

  // 1. Check existing valid speed-matched files on disk
  for (const cand of candidates) {
    try {
      if (fs.existsSync(/*turbopackIgnore: true*/ cand.filePath)) {
        const stat = fs.statSync(/*turbopackIgnore: true*/ cand.filePath);
        if (stat.isFile() && stat.size >= cand.minBytes) {
          const buf = fs.readFileSync(/*turbopackIgnore: true*/ cand.filePath);
          return buildAudioResponse(buf, cand.tag);
        }
      }
    } catch {
      // ignore and continue
    }
  }

  // 2. Self-Healing Real-Time Synthesis via edge-tts
  const safeText = getSafeTtsText(text, pinyin);
  const neuralVoice = NEURAL_VOICE_MAP[voiceId] || "zh-CN-XiaoxiaoNeural";
  const rate = SPEED_RATE_MAP[speed] || "+0%";

  try {
    fs.mkdirSync(generatedDir, { recursive: true });
    fs.mkdirSync(cacheDir, { recursive: true });

    await execFileAsync(
      "python",
      [
        "-m",
        "edge_tts",
        "--voice",
        neuralVoice,
        `--rate=${rate}`,
        "--text",
        safeText,
        "--write-media",
        generatedPath,
      ],
      { timeout: 12000 }
    );

    if (fs.existsSync(generatedPath) && fs.statSync(generatedPath).size > 1500) {
      const buf = fs.readFileSync(generatedPath);
      try {
        fs.copyFileSync(generatedPath, cachePath);
      } catch {
        // non-fatal
      }
      return buildAudioResponse(buf, `synthesized-${voiceId}-${speed}`);
    }
  } catch (err) {
    console.error("[/api/tts] Self-healing synthesis error:", err);
  }

  // 3. Offline / Fallback lookup across any available voice/speed on disk
  const fallbackFiles: string[] = [];
  if (asciiKey && !asciiKey.includes("_")) {
    fallbackFiles.push(
      path.join(publicAudioDir, "syllables", voiceId, `${asciiKey}.mp3`),
      path.join(publicAudioDir, "syllables", "human_female", `${asciiKey}.mp3`),
      path.join(publicAudioDir, "syllables", "human_male", `${asciiKey}.mp3`),
      path.join(publicAudioDir, "syllables", "xiaoxiao", `${asciiKey}.mp3`)
    );
  } else if (asciiKey && asciiKey.includes("_")) {
    fallbackFiles.push(
      path.join(publicAudioDir, "words", voiceId, speed, `${asciiKey}.mp3`),
      path.join(publicAudioDir, "words", "xiaoxiao", speed, `${asciiKey}.mp3`),
      path.join(publicAudioDir, "words", "xiaoxiao", "classroom", `${asciiKey}.mp3`),
      path.join(publicAudioDir, "words", "xiaoxiao", "conversational", `${asciiKey}.mp3`)
    );
  }
  if (text.length >= 3) {
    fallbackFiles.push(
      path.join(publicAudioDir, "sentences", voiceId, `sent_${textOnlyMd5}.mp3`),
      path.join(publicAudioDir, "sentences", voiceId, `sent_${shortMd5}.mp3`),
      path.join(publicAudioDir, "sentences", "xiaoxiao", `sent_${textOnlyMd5}.mp3`),
      path.join(publicAudioDir, "sentences", "xiaoxiao", `sent_${shortMd5}.mp3`)
    );
  }
  if (directKey) {
    const cleanRel = directKey.replace(/^\/+/, "").replace(/^audio\//, "");
    fallbackFiles.push(path.join(publicAudioDir, cleanRel));
  }

  for (const fb of fallbackFiles) {
    try {
      if (fs.existsSync(/*turbopackIgnore: true*/ fb) && fs.statSync(/*turbopackIgnore: true*/ fb).size > 1500) {
        const buf = fs.readFileSync(/*turbopackIgnore: true*/ fb);
        return buildAudioResponse(buf, "local-fallback");
      }
    } catch {
      // continue
    }
  }

  return NextResponse.json(
    { error: "Audio not available and synthesis failed", text: safeText, voice: voiceId },
    { status: 404 }
  );
}
