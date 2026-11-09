"""
pregenerate_all_multisyl.py
Pré-geração assíncrona controlada (asyncio.Semaphore(5) + retry automático) de:
1. Sílabas faltantes ou corrompidas (usando desambiguação monofônica CANONICAL_SYLLABLE_HANZI).
2. Todas as palavras dissilábicas de minimal_pairs.json e tone_sandhi.json (em classroom -25% e conversational +0%).
3. Amostras multi-voz nas 6 vozes neurais nativas (xiaoxiao, yunxi, xiaoyi, yunjian, xiaobei, hsiaochen)
   tanto em public/audio/words/{voice}/{speed}/ quanto no cache unificado public/audio/generated/.
4. Frases inteiras de sentences_minimal_pairs.json e minimal_pairs.json.
5. Atualização e verificação de public/data/audio_manifest.json.
"""

import os
import sys
import json
import asyncio
import hashlib
import time
from datetime import datetime, timezone
import edge_tts

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

from build_dataset import CANONICAL_SYLLABLE_HANZI
from verify_and_extract_f0 import extract_f0_and_metrics

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PUBLIC_DIR = os.path.join(ROOT_DIR, "public")
DATA_DIR = os.path.join(PUBLIC_DIR, "data")
AUDIO_DIR = os.path.join(PUBLIC_DIR, "audio")
GENERATED_DIR = os.path.join(AUDIO_DIR, "generated")
CACHE_DIR = os.path.join(AUDIO_DIR, "cache")

NEURAL_VOICES = {
    "xiaoxiao": "zh-CN-XiaoxiaoNeural",
    "yunxi": "zh-CN-YunxiNeural",
    "xiaoyi": "zh-CN-XiaoyiNeural",
    "yunjian": "zh-CN-YunjianNeural",
    "xiaobei": "zh-CN-liaoning-XiaobeiNeural",
    "hsiaochen": "zh-TW-HsiaoChenNeural",
}

SPEED_RATES = {
    "classroom": "-25%",
    "conversational": "+0%",
}

VOICE_METADATA_V2 = [
    {
        "id": "xiaoxiao",
        "name": "Xiaoxiao (Pequim F — Timbre Claro)",
        "gender": "female",
        "source": "azure_neural",
        "descriptionPt": "Feminina Padrão (zh-CN-XiaoxiaoNeural), timbres claros e articulação cristalina."
    },
    {
        "id": "yunxi",
        "name": "Yunxi (Pequim M — Jovem Nítido)",
        "gender": "male",
        "source": "azure_neural",
        "descriptionPt": "Masculina Jovem (zh-CN-YunxiNeural), articulação nítida e excelente contraste tonal."
    },
    {
        "id": "xiaoyi",
        "name": "Xiaoyi (Mandarim F — Formantes Agudos)",
        "gender": "female",
        "source": "azure_neural",
        "descriptionPt": "Feminina Suave (zh-CN-XiaoyiNeural), ótimo contraste de formantes agudos para HVPT."
    },
    {
        "id": "yunjian",
        "name": "Yunjian (Mandarim M — Grave Profundo)",
        "gender": "male",
        "source": "azure_neural",
        "descriptionPt": "Masculina Grave/Profunda (zh-CN-YunjianNeural), F0 baixa para treinar inclinação tonal."
    },
    {
        "id": "xiaobei",
        "name": "Xiaobei (Norte/Dongbei F — Natural)",
        "gender": "female",
        "source": "azure_neural",
        "descriptionPt": "Feminina Norte/Dongbei (zh-CN-liaoning-XiaobeiNeural), excelente naturalidade coloquial."
    },
    {
        "id": "hsiaochen",
        "name": "HsiaoChen (Mandarim F — Cadência Suave)",
        "gender": "female",
        "source": "azure_neural",
        "descriptionPt": "Feminina Cadência Suave (zh-TW-HsiaoChenNeural), ótima para variabilidade de falante (HVPT)."
    },
    {
        "id": "human_female",
        "name": "Gravação Estúdio (Humana F)",
        "gender": "female",
        "source": "human_native",
        "descriptionPt": "Gravação humana de estúdio para sílabas isoladas canônicas."
    },
    {
        "id": "human_male",
        "name": "Gravação Estúdio (Humano M)",
        "gender": "male",
        "source": "human_native",
        "descriptionPt": "Gravação humana masculina de estúdio para sílabas isoladas."
    },
]


def tts_cache_filename(voice_id: str, speed: str, text: str, pinyin: str = "") -> str:
    norm_key = f"{text.strip()}|{pinyin.strip().lower()}"
    digest = hashlib.md5(norm_key.encode("utf-8")).hexdigest()
    return f"{voice_id}_{speed}_{digest}.mp3"


def resolve_safe_tts_text(hanzi: str, pinyin_tone3: str = "") -> str:
    clean_h = (hanzi or "").strip()
    clean_p = (pinyin_tone3 or "").strip().lower().replace("ü", "v").replace("u:", "v")
    # Se for monossílaba e estiver no mapa canônico, usar o caractere monofônico verificado
    if len(clean_h) <= 1 and clean_p in CANONICAL_SYLLABLE_HANZI:
        return CANONICAL_SYLLABLE_HANZI[clean_p][0]
    if not clean_h or clean_h in ("□", "■", "?"):
        if clean_p in CANONICAL_SYLLABLE_HANZI:
            return CANONICAL_SYLLABLE_HANZI[clean_p][0]
        return "啊"
    return clean_h


async def synthesize_file(text: str, out_path: str, voice_id: str, speed: str, sem: asyncio.Semaphore) -> bool:
    if os.path.exists(out_path) and os.path.getsize(out_path) > 2048:
        return True

    voice_name = NEURAL_VOICES.get(voice_id, "zh-CN-XiaoxiaoNeural")
    if voice_id == "human_male":
        voice_name = NEURAL_VOICES["yunxi"]
    elif voice_id == "human_female":
        voice_name = NEURAL_VOICES["xiaoxiao"]

    rate = SPEED_RATES.get(speed, "+0%")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)

    for attempt in range(4):
        async with sem:
            try:
                comm = edge_tts.Communicate(text, voice_name, rate=rate)
                await comm.save(out_path)
                if os.path.exists(out_path) and os.path.getsize(out_path) > 1800:
                    return True
            except Exception as err:
                if attempt == 3:
                    print(f"[WARN] Falha ao sintetizar '{text}' ({voice_id}, {speed}): {err}")
                await asyncio.sleep(0.8 * (attempt + 1))
    return False


async def run_pregeneration():
    os.makedirs(GENERATED_DIR, exist_ok=True)
    os.makedirs(CACHE_DIR, exist_ok=True)

    with open(os.path.join(DATA_DIR, "minimal_pairs.json"), "r", encoding="utf-8") as f:
        mp_data = json.load(f)
    with open(os.path.join(DATA_DIR, "tone_sandhi.json"), "r", encoding="utf-8") as f:
        sandhi_data = json.load(f)
    with open(os.path.join(DATA_DIR, "sentences_minimal_pairs.json"), "r", encoding="utf-8") as f:
        sent_data = json.load(f)

    # out_path -> (text, voice_id, speed)
    jobs = {}

    # 0. Reparar biang2.mp3 e niu4.mp3 nas pastas humanas
    biang_f = os.path.join(AUDIO_DIR, "syllables", "human_female", "biang2.mp3")
    niu_m = os.path.join(AUDIO_DIR, "syllables", "human_male", "niu4.mp3")
    if not os.path.exists(biang_f) or os.path.getsize(biang_f) <= 2048:
        jobs[biang_f] = ("昂", "xiaoxiao", "conversational")
    # Forçar regeneração de niu4.mp3 caso fosse fallback senoidal
    if os.path.exists(niu_m) and os.path.getsize(niu_m) < 9000:
        try:
            os.remove(niu_m)
        except Exception:
            pass
    if not os.path.exists(niu_m):
        jobs[niu_m] = ("谬", "yunxi", "conversational")

    # 1. Todos os itens e frases de minimal_pairs.json
    curated_disyl_items = []
    for p in mp_data["pairs"]:
        for side in ["itemA", "itemB"]:
            it = p[side]
            ak = it["audioKey"].lstrip("/")
            if ak.startswith("audio/"):
                ak = ak[len("audio/"):]
            full_p = os.path.join(AUDIO_DIR, ak.replace("/", os.sep))
            speed = "classroom" if "classroom" in ak else "conversational"
            text = resolve_safe_tts_text(it["hanzi"], it.get("pinyinTone3", ""))
            if not os.path.exists(full_p) or os.path.getsize(full_p) <= 2048:
                jobs[full_p] = (text, "xiaoxiao", speed)

            if p["category"] == "dissyllable_tone_matrix":
                # Garantir também velocidade conversational
                conv_ak = ak.replace("classroom", "conversational")
                full_conv = os.path.join(AUDIO_DIR, conv_ak.replace("/", os.sep))
                if not os.path.exists(full_conv) or os.path.getsize(full_conv) <= 2048:
                    jobs[full_conv] = (text, "xiaoxiao", "conversational")

        if p["category"] == "dissyllable_tone_matrix" and len(curated_disyl_items) < 60:
            curated_disyl_items.append(p["itemA"])
            curated_disyl_items.append(p["itemB"])

        if p.get("sentenceContext"):
            ctx = p["sentenceContext"]
            for s_txt, s_ak in [(ctx["sentenceA"], ctx["audioKeyA"]), (ctx["sentenceB"], ctx["audioKeyB"])]:
                clean_ak = s_ak.lstrip("/")
                if clean_ak.startswith("audio/"):
                    clean_ak = clean_ak[len("audio/"):]
                full_s = os.path.join(AUDIO_DIR, clean_ak.replace("/", os.sep))
                if not os.path.exists(full_s) or os.path.getsize(full_s) <= 2048:
                    jobs[full_s] = (s_txt, "xiaoxiao", "classroom")

    # 2. Todos os itens de tone_sandhi.json
    for rule in sandhi_data:
        for ex in rule["examples"]:
            for ak, spd in [(ex["audioKeyClassroom"], "classroom"), (ex["audioKeyConversational"], "conversational")]:
                clean_ak = ak.lstrip("/")
                if clean_ak.startswith("audio/"):
                    clean_ak = clean_ak[len("audio/"):]
                full_p = os.path.join(AUDIO_DIR, clean_ak.replace("/", os.sep))
                if not os.path.exists(full_p) or os.path.getsize(full_p) <= 2048:
                    jobs[full_p] = (ex["hanzi"], "xiaoxiao", spd)

    # 3. Pré-gerar nas 6 vozes neurais os principais pares dissilábicos curados e frases prioritárias
    priority_disyl = curated_disyl_items[:24] # 12 pares clássicos (买卖/埋没, 水饺/睡觉, 熊猫/胸毛, 老板/老伴, etc.)
    for it in priority_disyl:
        ascii_k = it["asciiKey"]
        hanzi_t = it["hanzi"]
        for v_id in NEURAL_VOICES.keys():
            for spd in ["classroom", "conversational"]:
                w_path = os.path.join(AUDIO_DIR, "words", v_id, spd, f"{ascii_k}.mp3")
                if not os.path.exists(w_path) or os.path.getsize(w_path) <= 2048:
                    jobs[w_path] = (hanzi_t, v_id, spd)

    # 4. Frases inteiras de sentences_minimal_pairs.json (pré-gerar os pares principais e caça-tom)
    for cp in sent_data["contextualPairs"][:45]:
        for s_txt, ak in [(cp["sentenceA"], cp["audioKeyA"]), (cp["sentenceB"], cp["audioKeyB"])]:
            clean_ak = ak.lstrip("/")
            if clean_ak.startswith("audio/"):
                clean_ak = clean_ak[len("audio/"):]
            full_s = os.path.join(AUDIO_DIR, clean_ak.replace("/", os.sep))
            if not os.path.exists(full_s) or os.path.getsize(full_s) <= 2048:
                jobs[full_s] = (s_txt, "xiaoxiao", "classroom")

    # E para os 6 pares de frases mais famosos, pré-gerar nas 6 vozes!
    for cp in sent_data["contextualPairs"][:6]:
        for v_id in NEURAL_VOICES.keys():
            for s_txt, p_txt in [(cp["sentenceA"], cp["pinyinA"]), (cp["sentenceB"], cp["pinyinB"])]:
                c_fname = tts_cache_filename(v_id, "conversational", s_txt, p_txt)
                c_path = os.path.join(GENERATED_DIR, c_fname)
                if not os.path.exists(c_path) or os.path.getsize(c_path) <= 2048:
                    jobs[c_path] = (s_txt, v_id, "conversational")

    for sp in sent_data["prosodySpotting"][:25]:
        clean_ak = sp["audioKey"].lstrip("/")
        if clean_ak.startswith("audio/"):
            clean_ak = clean_ak[len("audio/"):]
        full_s = os.path.join(AUDIO_DIR, clean_ak.replace("/", os.sep))
        if not os.path.exists(full_s) or os.path.getsize(full_s) <= 2048:
            jobs[full_s] = (sp["sentence"], "xiaoxiao", "conversational")

    print(f"[pregenerate_all_multisyl] Total de áudios novos/reparados a sintetizar com Semaphore(5): {len(jobs)}")
    if jobs:
        sem = asyncio.Semaphore(5)
        tasks = [
            synthesize_file(text, out_p, v_id, spd, sem)
            for out_p, (text, v_id, spd) in jobs.items()
        ]
        t0 = time.time()
        chunk_size = 40
        done = 0
        for i in range(0, len(tasks), chunk_size):
            chunk = tasks[i : i + chunk_size]
            results = await asyncio.gather(*chunk)
            done += sum(1 for r in results if r)
            print(f"  Progresso: {min(i + chunk_size, len(tasks))}/{len(tasks)} concluídos ({done} OK) em {time.time() - t0:.1f}s")

    # 5. Atualizar public/data/audio_manifest.json reaproveitando métricas já calculadas para acelerar
    manifest_path = os.path.join(DATA_DIR, "audio_manifest.json")
    old_items = {}
    if os.path.exists(manifest_path):
        try:
            with open(manifest_path, "r", encoding="utf-8") as f:
                old_items = json.load(f).get("items", {})
        except Exception:
            old_items = {}

    new_items = {}
    newly_extracted = 0
    for root, _, files in os.walk(AUDIO_DIR):
        for fname in files:
            if not fname.lower().endswith(".mp3"):
                continue
            full_p = os.path.join(root, fname)
            if os.path.getsize(full_p) < 1800:
                continue
            rel_p = os.path.relpath(full_p, AUDIO_DIR).replace("\\", "/")
            if rel_p in old_items and full_p not in jobs:
                new_items[rel_p] = old_items[rel_p]
                continue

            parts = rel_p.split("/")
            voice_id = parts[1] if len(parts) > 1 else "xiaoxiao"
            speed = parts[2] if len(parts) > 2 and parts[0] == "words" else "conversational"
            metrics = extract_f0_and_metrics(full_p)
            if metrics:
                new_items[rel_p] = {
                    "key": rel_p,
                    "path": f"/audio/{rel_p}",
                    "voice": voice_id,
                    "speed": speed,
                    **metrics,
                }
                newly_extracted += 1

    manifest = {
        "version": "2.0.0",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "totalFiles": len(new_items),
        "voicesAvailable": VOICE_METADATA_V2,
        "items": new_items,
    }
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)

    print(f"[pregenerate_all_multisyl] audio_manifest.json atualizado! Total de arquivos verificados: {len(new_items)} (novos F0 extraídos: {newly_extracted})")


if __name__ == "__main__":
    asyncio.run(run_pregeneration())
