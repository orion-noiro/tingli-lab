"""
build_audio.py
Ingestão de gravações humanas nativas de Pinyin (Female & Male)
e infraestrutura de síntese neural multi-voz/multi-velocidade via edge-tts.
"""

import os
import shutil
import stat
import soundfile as sf
import asyncio
import edge_tts

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
TMP_AUDIO_DIR = os.path.join(ROOT_DIR, "_tmp_pinyin_audio")
PUBLIC_AUDIO_DIR = os.path.join(ROOT_DIR, "public", "audio")
FEMALE_DIR = os.path.join(PUBLIC_AUDIO_DIR, "syllables", "human_female")
MALE_DIR = os.path.join(PUBLIC_AUDIO_DIR, "syllables", "human_male")

VOICES = {
    "xiaoxiao": "zh-CN-XiaoxiaoNeural",
    "yunxi": "zh-CN-YunxiNeural",
    "xiaoyi": "zh-CN-XiaoyiNeural",
    "yunjian": "zh-CN-YunjianNeural",
}

SPEED_RATES = {
    "classroom": "-28%",
    "conversational": "+0%",
}

def remove_readonly(func, path, excinfo):
    """Trata arquivos somente leitura do Git no Windows."""
    try:
        os.chmod(path, stat.S_IWRITE)
        func(path)
    except Exception:
        pass

def copy_and_normalize_human_audio():
    os.makedirs(FEMALE_DIR, exist_ok=True)
    os.makedirs(MALE_DIR, exist_ok=True)

    copied_female = 0
    copied_male = 0

    # 1. Female (já estão em mp3)
    src_female = os.path.join(TMP_AUDIO_DIR, "Pinyin-Female")
    if os.path.exists(src_female):
        for fname in os.listdir(src_female):
            if fname.lower().endswith(".mp3"):
                norm_name = fname.lower().replace("u:", "v").replace("ü", "v")
                src = os.path.join(src_female, fname)
                dst = os.path.join(FEMALE_DIR, norm_name)
                shutil.copy2(src, dst)
                copied_female += 1

    # 2. Male (estão em wav, convertemos para mp3 com soundfile)
    src_male = os.path.join(TMP_AUDIO_DIR, "Pinyin-Male")
    if os.path.exists(src_male):
        male_files = [f for f in os.listdir(src_male) if f.lower().endswith(".wav") or f.lower().endswith(".mp3")]
        print(f"[build_audio] Convertendo {len(male_files)} arquivos masculinos...")
        for idx, fname in enumerate(male_files):
            base, ext = os.path.splitext(fname)
            norm_name = base.lower().replace("u:", "v").replace("ü", "v") + ".mp3"
            src = os.path.join(src_male, fname)
            dst = os.path.join(MALE_DIR, norm_name)
            
            if ext.lower() == ".wav":
                try:
                    data, sr = sf.read(src)
                    sf.write(dst, data, sr, format='MP3')
                    copied_male += 1
                except Exception as e:
                    print(f"Erro ao converter {fname}: {e}")
            else:
                shutil.copy2(src, dst)
                copied_male += 1

    print(f"[build_audio] Concluído: {copied_female} femininos e {copied_male} masculinos normalizados.")

    # Limpar a pasta temporária _tmp_pinyin_audio
    if os.path.exists(TMP_AUDIO_DIR):
        try:
            shutil.rmtree(TMP_AUDIO_DIR, onerror=remove_readonly)
            print("[build_audio] Diretório temporário _tmp_pinyin_audio removido com sucesso.")
        except Exception as e:
            print(f"[build_audio] Aviso ao remover _tmp_pinyin_audio: {e}")

async def synthesize_one(text: str, output_path: str, voice_key: str = "xiaoxiao", rate: str = "+0%", sem: asyncio.Semaphore = None):
    voice_name = VOICES.get(voice_key, "zh-CN-XiaoxiaoNeural")
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    if os.path.exists(output_path) and os.path.getsize(output_path) > 500:
        return True

    async def _do():
        communicate = edge_tts.Communicate(text, voice_name, rate=rate)
        await communicate.save(output_path)

    if sem:
        async with sem:
            await _do()
    else:
        await _do()
    return True

if __name__ == "__main__":
    copy_and_normalize_human_audio()
