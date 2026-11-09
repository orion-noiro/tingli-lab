import {
  AudioManifest,
  SpeechSpeed,
  ToneNumber,
  VoiceId,
} from "@/types/phonetics";

// Paleta Clássica da China Antiga (Pigmentos Minerais — Zero Neon)
export const TONE_COLORS: Record<ToneNumber, string> = {
  1: "#3B596A", // Azul Índigo Mineral (花青 Huāqīng — 55)
  2: "#3A6B59", // Jade Imperial (翡翠 Fěicuì — 35)
  3: "#9C7A3C", // Ocre Bronze Antigo (青铜 Qīngtóng — 214)
  4: "#9E2A2B", // Vermelho Cinábrio Imperial (朱砂 Zhūshā — 51)
  5: "#7A756C", // Cinza Pedra (Tom Neutro)
};

export const TONE_LABELS_PT: Record<ToneNumber, string> = {
  1: "1º Tom (55 · Alto Nivelado · 花青)",
  2: "2º Tom (35 · Ascendente · 翡翠)",
  3: "3º Tom (214 · Baixo/Curvo · 青铜)",
  4: "4º Tom (51 · Queda Incisiva · 朱砂)",
  5: "Tom Neutro (Leve · 轻声)",
};

export const VOICE_OPTIONS: Array<{
  id: VoiceId;
  name: string;
  gender: "female" | "male";
  badge: string;
  description: string;
}> = [
  {
    id: "xiaoxiao",
    name: "Xiaoxiao (Pequim F)",
    gender: "female",
    badge: "Timbre Claro",
    description: "zh-CN-XiaoxiaoNeural — Feminina padrão de Pequim",
  },
  {
    id: "yunxi",
    name: "Yunxi (Pequim M)",
    gender: "male",
    badge: "Jovem Nítido",
    description: "zh-CN-YunxiNeural — Masculina jovem com articulação nítida",
  },
  {
    id: "xiaoyi",
    name: "Xiaoyi (Suave F)",
    gender: "female",
    badge: "Formantes Agudos",
    description: "zh-CN-XiaoyiNeural — Feminina suave para contraste espectral",
  },
  {
    id: "yunjian",
    name: "Yunjian (Profunda M)",
    gender: "male",
    badge: "F0 Grave",
    description: "zh-CN-YunjianNeural — Masculina grave para treino HVPT",
  },
  {
    id: "xiaobei",
    name: "Xiaobei (Dongbei F)",
    gender: "female",
    badge: "Coloquial",
    description: "zh-CN-liaoning-XiaobeiNeural — Norte/Dongbei natural",
  },
  {
    id: "hsiaochen",
    name: "HsiaoChen (Cadência F)",
    gender: "female",
    badge: "Suave",
    description: "zh-TW-HsiaoChenNeural — Mandarim padrão com cadência suave",
  },
  {
    id: "human_female",
    name: "Estúdio (Humana F)",
    gender: "female",
    badge: "Acústico",
    description: "Gravação humana de estúdio (sílabas isoladas + fallback neural)",
  },
  {
    id: "human_male",
    name: "Estúdio (Humano M)",
    gender: "male",
    badge: "Acústico",
    description: "Gravação humana masculina de estúdio (sílabas isoladas + fallback neural)",
  },
];

/**
 * HVPT (High Variability Phonetic Training):
 * Retorna uma voz com registro fundamental (F0) e formantes contrastantes
 * (ex.: se A/B são masculinos graves, X é feminina aguda, e vice-versa),
 * obrigando o ouvinte a extrair a inclinação tonal (dF0/dt) em vez da altura absoluta.
 */
export function getContrastingVoiceForHVPT(primaryVoice: VoiceId): VoiceId {
  const contrastMap: Record<VoiceId, VoiceId> = {
    xiaoxiao: "yunjian",
    yunxi: "xiaoyi",
    xiaoyi: "yunjian",
    yunjian: "xiaoxiao",
    xiaobei: "yunxi",
    hsiaochen: "yunjian",
    human_female: "yunjian",
    human_male: "xiaoxiao",
  };
  return contrastMap[primaryVoice] || "yunjian";
}

// ============================================================================
// CANONICAL CHAO (1..5) F0 PITCH CONTOUR GENERATOR & LOOKUP
// ============================================================================

export function generateTheoreticalChaoContour(
  tones: ToneNumber[],
  applySandhi: boolean = true,
  points: number = 30
): number[] {
  if (!tones || tones.length === 0) return Array(points).fill(3.0);

  const singleToneCurve = (
    tone: ToneNumber,
    len: number,
    isHalfThird: boolean = false,
    precedingTone?: ToneNumber
  ): number[] => {
    const arr: number[] = [];
    for (let i = 0; i < len; i++) {
      const t = len <= 1 ? 0.5 : i / (len - 1);
      if (tone === 1) {
        arr.push(4.85 - 0.08 * Math.sin(t * Math.PI));
      } else if (tone === 2) {
        arr.push(2.85 - 0.15 * Math.sin(t * Math.PI) + 2.15 * Math.pow(t, 1.35));
      } else if (tone === 3) {
        if (isHalfThird) {
          arr.push(2.25 - 1.15 * Math.pow(t, 0.85));
        } else {
          if (t < 0.55) {
            const u = t / 0.55;
            arr.push(2.2 - 1.1 * Math.sin((u * Math.PI) / 2));
          } else {
            const u = (t - 0.55) / 0.45;
            arr.push(1.1 + 2.75 * Math.pow(u, 1.3));
          }
        }
      } else if (tone === 4) {
        arr.push(4.95 - 3.85 * Math.pow(t, 1.15));
      } else {
        const base =
          precedingTone === 1
            ? 2.2
            : precedingTone === 2
            ? 3.0
            : precedingTone === 3
            ? 3.8
            : precedingTone === 4
            ? 1.6
            : 2.5;
        arr.push(base - 0.35 * t);
      }
    }
    return arr.map((v) => Number(Math.min(5, Math.max(1, v)).toFixed(2)));
  };

  if (tones.length === 1) {
    return singleToneCurve(tones[0], points, false);
  }

  const effectiveTones = [...tones];
  const halfThirdFlags = effectiveTones.map(() => false);

  if (applySandhi) {
    for (let i = 0; i < effectiveTones.length - 1; i++) {
      if (effectiveTones[i] === 3 && effectiveTones[i + 1] === 3) {
        effectiveTones[i] = 2; // T3 + T3 -> T2 + T3
      } else if (effectiveTones[i] === 3 && effectiveTones[i + 1] !== 3) {
        halfThirdFlags[i] = true; // Half-T3 [21]
      }
    }
  }

  const sylPoints = Math.floor(points / effectiveTones.length);
  const combined: number[] = [];

  effectiveTones.forEach((t, idx) => {
    const len =
      idx === effectiveTones.length - 1
        ? points - combined.length
        : sylPoints;
    const curve = singleToneCurve(
      t,
      len,
      halfThirdFlags[idx],
      idx > 0 ? tones[idx - 1] : undefined
    );
    combined.push(...curve);
  });

  return combined;
}

// ============================================================================
// UNIFIED AUDIO PLAYER WITH SELF-HEALING /api/tts + 40ms CROSSFADE CONCATENATOR
// ============================================================================

let activeAudioElements: HTMLAudioElement[] = [];
let activeTimeoutIds: number[] = [];
let sharedAudioCtx: AudioContext | null = null;
let activeBufferSources: AudioBufferSourceNode[] = [];

export function stopAllAudio(): void {
  activeTimeoutIds.forEach((id) => window.clearTimeout(id));
  activeTimeoutIds = [];
  activeAudioElements.forEach((el) => {
    try {
      el.pause();
      el.currentTime = 0;
    } catch {
      // ignore
    }
  });
  activeAudioElements = [];
  activeBufferSources.forEach((src) => {
    try {
      src.stop();
    } catch {
      // ignore
    }
  });
  activeBufferSources = [];
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

function normalizeSyllableToken(token: string): string {
  const clean = token
    .toLowerCase()
    .trim()
    .replace(/ü/g, "v")
    .replace(/u:/g, "v")
    .replace(/[^a-zv1-5]/g, "");
  if (!clean) return "";
  if (/[1-5]$/.test(clean)) return clean;
  return `${clean}5`;
}

export function splitPinyinTone3ToSyllables(pinyinTone3: string): string[] {
  if (!pinyinTone3) return [];
  const matches = pinyinTone3
    .toLowerCase()
    .replace(/ü/g, "v")
    .replace(/u:/g, "v")
    .match(/[a-zv]+[1-5]?/g);
  if (!matches) return [];
  return matches.map(normalizeSyllableToken).filter(Boolean);
}

function playSingleUrl(url: string, playbackRate: number = 1.0): Promise<boolean> {
  return new Promise((resolve) => {
    const audio = new Audio(url);
    audio.playbackRate = playbackRate;
    activeAudioElements.push(audio);

    let settled = false;
    const finish = (ok: boolean) => {
      if (!settled) {
        settled = true;
        resolve(ok);
      }
    };

    audio.onended = () => finish(true);
    audio.onerror = () => finish(false);
    audio.play().catch(() => finish(false));
  });
}

/**
 * Fallback Duplo para Dissílabos Offline via Web Audio API com Crossfade de 40ms
 */
async function playConcatenatedSyllablesWithCrossfade(
  syllables: string[],
  voice: VoiceId,
  speed: SpeechSpeed
): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return false;
    if (!sharedAudioCtx || sharedAudioCtx.state === "closed") {
      sharedAudioCtx = new AudioCtx();
    }
    if (sharedAudioCtx.state === "suspended") {
      await sharedAudioCtx.resume();
    }

    const sandhiSyls = [...syllables];
    for (let i = 0; i < sandhiSyls.length - 1; i++) {
      if (sandhiSyls[i].endsWith("3") && sandhiSyls[i + 1].endsWith("3")) {
        sandhiSyls[i] = sandhiSyls[i].slice(0, -1) + "2";
      }
    }

    const decodedBuffers: AudioBuffer[] = [];
    for (const syl of sandhiSyls) {
      const urls = [
        `/audio/syllables/${voice}/${syl}.mp3`,
        `/audio/syllables/human_female/${syl}.mp3`,
        `/audio/syllables/human_male/${syl}.mp3`,
      ];
      let buf: AudioBuffer | null = null;
      for (const u of urls) {
        try {
          const res = await fetch(u);
          if (res.ok) {
            const arr = await res.arrayBuffer();
            if (arr.byteLength > 1000) {
              buf = await sharedAudioCtx.decodeAudioData(arr);
              break;
            }
          }
        } catch {
          // continue
        }
      }
      if (!buf) return false;
      decodedBuffers.push(buf);
    }

    const crossfadeSec = 0.04; // 40ms crossfade
    const rate = speed === "classroom" ? 0.82 : 1.0;
    let startTime = sharedAudioCtx.currentTime + 0.01;

    return await new Promise<boolean>((resolve) => {
      decodedBuffers.forEach((buffer, idx) => {
        if (!sharedAudioCtx) return;
        const source = sharedAudioCtx.createBufferSource();
        const gainNode = sharedAudioCtx.createGain();
        source.buffer = buffer;
        source.playbackRate.value = rate;

        const effectiveDur = buffer.duration / rate;
        if (idx > 0) {
          gainNode.gain.setValueAtTime(0.01, startTime);
          gainNode.gain.linearRampToValueAtTime(1.0, startTime + crossfadeSec);
        } else {
          gainNode.gain.setValueAtTime(1.0, startTime);
        }

        if (idx < decodedBuffers.length - 1) {
          const fadeOutStart = Math.max(startTime, startTime + effectiveDur - crossfadeSec);
          gainNode.gain.setValueAtTime(1.0, fadeOutStart);
          gainNode.gain.linearRampToValueAtTime(0.01, startTime + effectiveDur);
        }

        source.connect(gainNode);
        gainNode.connect(sharedAudioCtx.destination);
        activeBufferSources.push(source);
        source.start(startTime);

        if (idx === decodedBuffers.length - 1) {
          source.onended = () => resolve(true);
        }
        startTime += Math.max(0.12, effectiveDur - crossfadeSec);
      });
    });
  } catch {
    return false;
  }
}

function speakFallbackTTS(
  hanzi: string,
  speed: SpeechSpeed,
  voiceId: VoiceId
): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      resolve();
      return;
    }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(hanzi);
    utter.lang = "zh-CN";
    utter.rate = speed === "classroom" ? 0.75 : 1.0;
    utter.pitch = voiceId.includes("male") || voiceId.startsWith("yun") ? 0.88 : 1.08;
    utter.onend = () => resolve();
    utter.onerror = () => resolve();
    window.speechSynthesis.speak(utter);
  });
}

export async function playLexicalItemAudio(
  item: {
    hanzi: string;
    pinyinTone3?: string;
    asciiKey?: string;
    audioKey?: string;
    tones?: ToneNumber[];
  },
  voice: VoiceId = "xiaoxiao",
  speed: SpeechSpeed = "conversational",
  _manifest?: AudioManifest | null
): Promise<void> {
  stopAllAudio();

  const pinyinParam = item.asciiKey || item.pinyinTone3 || "";
  const syllables = splitPinyinTone3ToSyllables(item.pinyinTone3 || item.asciiKey || "");
  const isHumanStudioMonosyllable =
    (voice === "human_female" || voice === "human_male") &&
    syllables.length === 1 &&
    (item.hanzi || "").length <= 1;
  const ttsPlaybackRate =
    isHumanStudioMonosyllable && speed === "classroom" ? 0.78 : 1.0;

  const ttsUrl = `/api/tts?text=${encodeURIComponent(item.hanzi || "")}&pinyin=${encodeURIComponent(
    pinyinParam
  )}&voice=${encodeURIComponent(voice)}&speed=${encodeURIComponent(speed)}&key=${encodeURIComponent(
    item.audioKey || ""
  )}`;

  // 1. Primary: Self-Healing Backend API (/api/tts) with permanent disk cache & 6 neural voices
  const playedViaTtsApi = await playSingleUrl(ttsUrl, ttsPlaybackRate);
  if (playedViaTtsApi) return;

  // 2. Secondary: Direct static file candidates on disk
  const rateMultiplier = speed === "classroom" ? 0.78 : 1.0;
  const asciiKey = (item.asciiKey || item.pinyinTone3 || "")
    .toLowerCase()
    .replace(/ü/g, "v")
    .replace(/\s+/g, "_");

  if (syllables.length === 1) {
    const syl = syllables[0];
    const staticUrls = [
      `/audio/syllables/${voice}/${syl}.mp3`,
      `/audio/syllables/human_female/${syl}.mp3`,
      `/audio/syllables/human_male/${syl}.mp3`,
    ];
    for (const u of staticUrls) {
      if (await playSingleUrl(u, rateMultiplier)) return;
    }
  } else if (syllables.length >= 2 && asciiKey) {
    const wordUrls = [
      `/audio/words/${voice}/${speed}/${asciiKey}.mp3`,
      `/audio/words/xiaoxiao/${speed}/${asciiKey}.mp3`,
      `/audio/words/xiaoxiao/classroom/${asciiKey}.mp3`,
    ];
    for (const u of wordUrls) {
      if (await playSingleUrl(u, u.includes(`/${speed}/`) ? 1.0 : rateMultiplier)) return;
    }
    // 3. Double Fallback: Web Audio API concatenation with 40ms crossfade
    const crossfaded = await playConcatenatedSyllablesWithCrossfade(syllables, voice, speed);
    if (crossfaded) return;
  }

  // 4. Final emergency fallback: Browser SpeechSynthesis
  await speakFallbackTTS(item.hanzi, speed, voice);
}

export async function playSentenceAudio(
  sentenceHanzi: string,
  pinyin: string = "",
  voice: VoiceId = "xiaoxiao",
  speed: SpeechSpeed = "conversational",
  audioKey: string = ""
): Promise<void> {
  await playLexicalItemAudio(
    {
      hanzi: sentenceHanzi,
      pinyinTone3: pinyin,
      audioKey,
    },
    voice,
    speed
  );
}

// ============================================================================
// REAL-TIME MICROPHONE F0 PITCH EXTRACTOR (YIN / AUTOCORRELATION) & DTW GRADER
// ============================================================================

export function detectPitchYIN(buffer: Float32Array, sampleRate: number): number | null {
  let sumSq = 0;
  for (let i = 0; i < buffer.length; i++) {
    sumSq += buffer[i] * buffer[i];
  }
  const rms = Math.sqrt(sumSq / buffer.length);
  if (rms < 0.012) return null;

  const minFreq = 75;
  const maxFreq = 480;
  const minTau = Math.floor(sampleRate / maxFreq);
  const maxTau = Math.min(Math.floor(sampleRate / minFreq), Math.floor(buffer.length / 2));

  const yinBuffer = new Float32Array(maxTau);
  yinBuffer[0] = 1;
  let runningSum = 0;

  for (let tau = 1; tau < maxTau; tau++) {
    let diff = 0;
    for (let i = 0; i < maxTau; i++) {
      const delta = buffer[i] - buffer[i + tau];
      diff += delta * delta;
    }
    yinBuffer[tau] = diff;
    runningSum += diff;
    yinBuffer[tau] = runningSum > 0 ? (yinBuffer[tau] * tau) / runningSum : 1;
  }

  const threshold = 0.18;
  let bestTau = -1;

  for (let tau = minTau; tau < maxTau; tau++) {
    if (yinBuffer[tau] < threshold) {
      while (tau + 1 < maxTau && yinBuffer[tau + 1] < yinBuffer[tau]) {
        tau++;
      }
      bestTau = tau;
      break;
    }
  }

  if (bestTau === -1) {
    let minVal = 1.0;
    for (let tau = minTau; tau < maxTau; tau++) {
      if (yinBuffer[tau] < minVal) {
        minVal = yinBuffer[tau];
        bestTau = tau;
      }
    }
    if (minVal > 0.32) return null;
  }

  let refinedTau = bestTau;
  if (bestTau > 1 && bestTau < maxTau - 1) {
    const s0 = yinBuffer[bestTau - 1];
    const s1 = yinBuffer[bestTau];
    const s2 = yinBuffer[bestTau + 1];
    const denom = 2 * (2 * s1 - s2 - s0);
    if (Math.abs(denom) > 1e-6) {
      refinedTau = bestTau + (s2 - s0) / denom;
    }
  }

  const freq = sampleRate / refinedTau;
  if (freq < minFreq || freq > maxFreq) return null;
  return freq;
}

export function normalizeHzSeriesToChao(
  hzValues: number[],
  targetLength: number = 30
): number[] {
  const valid = hzValues.filter((v) => v >= 75 && v <= 480);
  if (valid.length < 3) return Array(targetLength).fill(3.0);

  const semitones = valid.map((hz) => 12 * Math.log2(hz / 100));

  const smoothed = semitones.map((val, idx, arr) => {
    if (idx === 0 || idx === arr.length - 1) return val;
    return (arr[idx - 1] + val + arr[idx + 1]) / 3;
  });

  const minSt = Math.min(...smoothed);
  const maxSt = Math.max(...smoothed);
  const span = maxSt - minSt;
  const meanSt = smoothed.reduce((a, b) => a + b, 0) / smoothed.length;

  const resampled: number[] = [];
  for (let i = 0; i < targetLength; i++) {
    const pos = (i / (targetLength - 1)) * (smoothed.length - 1);
    const lo = Math.floor(pos);
    const hi = Math.min(smoothed.length - 1, Math.ceil(pos));
    const frac = pos - lo;
    const st = smoothed[lo] * (1 - frac) + smoothed[hi] * frac;

    let chao: number;
    if (span < 2.2) {
      chao = 4.6 + (st - meanSt) * 0.25;
    } else {
      const effectiveSpan = Math.max(span, 5.5);
      const center = (minSt + maxSt) / 2;
      chao = 3.0 + ((st - center) / (effectiveSpan / 2)) * 1.9;
    }
    resampled.push(Number(Math.min(5.0, Math.max(1.0, chao)).toFixed(2)));
  }

  return resampled;
}

export interface PitchEvaluationResult {
  overallScore: number;
  dtwDistance: number;
  slopeCorrelation: number;
  userChaoContour: number[];
  feedbackPt: string;
  feedbackEn: string;
}

export function evaluatePitchContoursDTW(
  userChao: number[],
  targetChao: number[],
  expectedTones: ToneNumber[]
): PitchEvaluationResult {
  const n = userChao.length;
  const m = targetChao.length;
  if (n === 0 || m === 0) {
    return {
      overallScore: 0,
      dtwDistance: 99,
      slopeCorrelation: 0,
      userChaoContour: [],
      feedbackPt: "Nenhum sinal de voz claro detectado. Fale mais próximo do microfone.",
      feedbackEn: "No clear voice signal detected. Speak closer to the microphone.",
    };
  }

  const dtw: number[][] = Array.from({ length: n + 1 }, () =>
    Array(m + 1).fill(Infinity)
  );
  dtw[0][0] = 0;
  const band = Math.max(6, Math.abs(n - m) + 5);

  for (let i = 1; i <= n; i++) {
    for (let j = Math.max(1, i - band); j <= Math.min(m, i + band); j++) {
      const cost = Math.abs(userChao[i - 1] - targetChao[j - 1]);
      dtw[i][j] =
        cost + Math.min(dtw[i - 1][j], dtw[i][j - 1], dtw[i - 1][j - 1]);
    }
  }

  const normalizedDtw = dtw[n][m] / (n + m);

  let slopeDot = 0;
  let userSlopeNorm = 0;
  let targetSlopeNorm = 0;
  const minLen = Math.min(n, m);
  for (let i = 1; i < minLen; i++) {
    const du = userChao[i] - userChao[i - 1];
    const dt = targetChao[i] - targetChao[i - 1];
    slopeDot += du * dt;
    userSlopeNorm += du * du;
    targetSlopeNorm += dt * dt;
  }

  const userSpan = Math.max(...userChao) - Math.min(...userChao);
  const targetSpan = Math.max(...targetChao) - Math.min(...targetChao);

  let slopeCorr = 0;
  if (targetSpan < 0.6 && userSpan < 0.9) {
    slopeCorr = 0.95;
  } else if (userSlopeNorm > 1e-4 && targetSlopeNorm > 1e-4) {
    slopeCorr = slopeDot / (Math.sqrt(userSlopeNorm) * Math.sqrt(targetSlopeNorm));
  }

  const dtwScore = Math.max(0, 100 - normalizedDtw * 42);
  const slopeScore = Math.max(0, ((slopeCorr + 1) / 2) * 100);
  const overallScore = Math.round(
    Math.min(100, Math.max(10, dtwScore * 0.6 + slopeScore * 0.4))
  );

  const mainTone = expectedTones[0] || 1;
  const userStart = userChao[0];
  const userEnd = userChao[userChao.length - 1];
  const userMid = userChao[Math.floor(userChao.length / 2)];

  let feedbackPt = "";
  let feedbackEn = "";

  if (overallScore >= 82) {
    feedbackPt =
      "Contorno tonal excelente! Sua curva F0 acompanhou fielmente a trajetória nativa na escala de Chao.";
    feedbackEn =
      "Excellent tonal contour! Your F0 pitch curve closely matched the native Chao trajectory.";
  } else if (mainTone === 1) {
    if (userSpan > 1.3) {
      feedbackPt =
        "O 1º Tom (55) deve ser alto e constante como uma nota musical sustentada. Sua voz oscilou demais.";
      feedbackEn =
        "1st Tone (55) should stay high and flat like a sustained musical note. Your pitch fluctuated too much.";
    } else {
      feedbackPt =
        "Mantenha o 1º Tom (55) um pouco mais alto e estável do início ao fim da sílaba.";
      feedbackEn = "Keep the 1st Tone (55) high and steady from start to finish.";
    }
  } else if (mainTone === 2) {
    if (userEnd <= userStart + 0.4) {
      feedbackPt =
        "O 2º Tom (35) precisa subir com firmeza do registro médio (3) até o agudo (5), como ao perguntar 'Hã?!'.";
      feedbackEn =
        "2nd Tone (35) must rise decisively from mid (3) to high (5), like asking 'Huh?!'.";
    } else {
      feedbackPt = "Boa subida! Tente iniciar no nível médio (3) antes de subir ao (5).";
      feedbackEn = "Good rise! Try starting at mid level (3) before rising to (5).";
    }
  } else if (mainTone === 3) {
    if (userMid > 2.4) {
      feedbackPt =
        "O segredo do 3º Tom (214) é mergulhar fundo no registro mais grave da sua voz (2→1). Você manteve o meio muito alto.";
      feedbackEn =
        "The key to 3rd Tone (214) is dipping into your lowest vocal register (2→1). Your midpoint stayed too high.";
    } else {
      feedbackPt =
        "Mergulhe ao nível 1 no meio da sílaba e finalize subindo suavemente até o nível 4.";
      feedbackEn = "Dip down to level 1 in the middle and rise gently toward level 4.";
    }
  } else if (mainTone === 4) {
    if (userStart <= userEnd + 0.5) {
      feedbackPt =
        "O 4º Tom (51) exige uma queda rápida e incisiva do topo (5) ao grave (1), como um comando curto!";
      feedbackEn =
        "4th Tone (51) requires a sharp, decisive drop from high (5) to low (1)!";
    } else {
      feedbackPt =
        "Comece bem no topo (nível 5) e deixe o pitch cair rapidamente até o nível 1.";
      feedbackEn = "Start high at level 5 and drop rapidly down to level 1.";
    }
  } else {
    feedbackPt =
      "O Tom Neutro deve ser curto, leve e sem tensão nas pregas vocais.";
    feedbackEn = "The Neutral Tone should be short, light, and unstressed.";
  }

  return {
    overallScore,
    dtwDistance: Number(normalizedDtw.toFixed(3)),
    slopeCorrelation: Number(slopeCorr.toFixed(3)),
    userChaoContour: userChao,
    feedbackPt,
    feedbackEn,
  };
}
