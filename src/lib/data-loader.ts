import {
  AudioManifest,
  MinimalPairEntry,
  MinimalPairsDataset,
  SentencesMinimalPairsDataset,
  SoundGuideSection,
  SyllablesChartDataset,
  ToneSandhiRule,
} from "@/types/phonetics";

export interface TingLiDatasetBundle {
  minimalPairs: MinimalPairsDataset;
  sentencesDataset: SentencesMinimalPairsDataset;
  syllablesChart: SyllablesChartDataset;
  toneSandhi: ToneSandhiRule[];
  soundGuides: SoundGuideSection[];
  audioManifest: AudioManifest | null;
}

let cachedBundle: TingLiDatasetBundle | null = null;

export async function fetchAllDatasets(): Promise<TingLiDatasetBundle> {
  if (cachedBundle) return cachedBundle;

  const [mpRes, sentRes, scRes, tsRes, sgRes, amRes] = await Promise.all([
    fetch("/data/minimal_pairs.json"),
    fetch("/data/sentences_minimal_pairs.json"),
    fetch("/data/syllables_chart.json"),
    fetch("/data/tone_sandhi.json"),
    fetch("/data/sound_guides_pt.json"),
    fetch("/data/audio_manifest.json").catch(() => null),
  ]);

  const minimalPairs: MinimalPairsDataset = await mpRes.json();
  const sentencesDataset: SentencesMinimalPairsDataset = await sentRes.json();
  const syllablesChart: SyllablesChartDataset = await scRes.json();
  const toneSandhi: ToneSandhiRule[] = await tsRes.json();
  const soundGuides: SoundGuideSection[] = await sgRes.json();
  const audioManifest: AudioManifest | null =
    amRes && amRes.ok ? await amRes.json() : null;

  cachedBundle = {
    minimalPairs,
    sentencesDataset,
    syllablesChart,
    toneSandhi,
    soundGuides,
    audioManifest,
  };
  return cachedBundle;
}

export function buildDiagnosticDeck(pairs: MinimalPairEntry[]): MinimalPairEntry[] {
  const categories = [
    "monosyllable_tone",
    "dissyllable_tone_matrix",
    "initial_aspiration",
    "initial_place",
    "final_nasal",
    "final_vowel",
  ] as const;

  const deck: MinimalPairEntry[] = [];
  for (const cat of categories) {
    const catPairs = pairs.filter((p) => p.category === cat);
    const bySub = new Map<string, MinimalPairEntry[]>();
    catPairs.forEach((p) => {
      const list = bySub.get(p.subCategory) || [];
      list.push(p);
      bySub.set(p.subCategory, list);
    });
    const subKeys = Array.from(bySub.keys());
    for (let i = 0; i < 5 && subKeys.length > 0; i++) {
      const sub = subKeys[i % subKeys.length];
      const candidates = bySub.get(sub) || [];
      const pick = candidates[Math.floor(i / subKeys.length) % candidates.length];
      if (pick && !deck.some((d) => d.id === pick.id)) {
        deck.push(pick);
      }
    }
  }
  return deck.slice(0, 30);
}
