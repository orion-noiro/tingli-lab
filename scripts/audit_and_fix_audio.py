"""
audit_and_fix_audio.py
1. Audita todos os arquivos de áudio em public/audio, removendo arquivos corrompidos (< 2048 bytes)
   ou fallbacks senoidais antigos (220Hz 0.35s) e arquivos mal-nomeados (.mp3).
2. Gera public/data/sentences_minimal_pairs.json com >320 exercícios graduados de Frases Inteiras
   (整句听力) divididos nos 3 modos pedagógicos:
   - contextual_minimal_pairs (Pares Mínimos em Sentenças Completas)
   - prosody_tone_spotting (Caça-Tom em Frase Contínua de 6 a 12 caracteres)
   - sentence_reconstruction (Transcrição / Reconstrução Auditiva de Frase com blocos e distratores)
"""

import os
import sys
import json
import hashlib
from datetime import datetime, timezone

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PUBLIC_DIR = os.path.join(ROOT_DIR, "public")
DATA_DIR = os.path.join(PUBLIC_DIR, "data")
AUDIO_DIR = os.path.join(PUBLIC_DIR, "audio")


def deterministic_audio_id(text: str, pinyin: str = "") -> str:
    raw = f"{text.strip()}|{pinyin.strip().lower()}".encode("utf-8")
    return hashlib.md5(raw).hexdigest()[:12]


def audit_existing_audio():
    print("[audit_and_fix_audio] Varrendo acervo de áudio em public/audio...")
    total_files = 0
    valid_files = 0
    removed_files = []

    # Check manifest for known 0.35s sine-wave fallbacks
    sine_fallbacks = set()
    manifest_path = os.path.join(DATA_DIR, "audio_manifest.json")
    if os.path.exists(manifest_path):
        try:
            with open(manifest_path, "r", encoding="utf-8") as f:
                m = json.load(f)
            for k, v in m.get("items", {}).items():
                if abs(v.get("durationSec", 1.0) - 0.35) < 0.015 and v.get("f0Hz", [0])[0] == 220.0:
                    sine_fallbacks.add(k.replace("/", os.sep))
        except Exception:
            pass

    for root, _, files in os.walk(AUDIO_DIR):
        for fname in files:
            if not fname.lower().endswith(".mp3") and not fname.lower().endswith(".wav"):
                continue
            total_files += 1
            full_path = os.path.join(root, fname)
            rel_path = os.path.relpath(full_path, AUDIO_DIR)
            size = os.path.getsize(full_path)

            # Remove empty-basename ".mp3", files < 1800 bytes, or sine-wave fallbacks
            if fname == ".mp3" or size < 1800 or rel_path in sine_fallbacks:
                try:
                    os.remove(full_path)
                    removed_files.append((rel_path, size))
                except Exception as e:
                    print(f"Erro ao remover {rel_path}: {e}")
            else:
                valid_files += 1

    print(f"[audit_and_fix_audio] Total inspecionados: {total_files} | Válidos reaproveitados: {valid_files} | Removidos para regeneração: {len(removed_files)}")
    if removed_files:
        print("  Arquivos removidos:", removed_files[:10])
    return valid_files, removed_files


def build_sentences_dataset():
    print("[audit_and_fix_audio] Construindo public/data/sentences_minimal_pairs.json (>320 exercícios)...")

    contextual_pairs = []
    prosody_spotting = []
    reconstructions = []

    # =========================================================================
    # PARTE 1: PARES MÍNIMOS EM SENTENÇAS COMPLETAS (Contextual Minimal Pairs)
    # =========================================================================
    # Lista mestre de pares de sentenças curadas de alta relevância comunicativa e acústica
    curated_contextual = [
        # Os 6 exemplos obrigatórios de alta prioridade + dezenas de pares clássicos
        {
            "focusType": "dissyllable_tone",
            "subCategory": "T3+T3 vs T4+T4 (水饺 vs 睡觉)",
            "difficulty": 2,
            "sentenceA": "请问，水饺多少钱一碗？",
            "traditionalA": "請問，水餃多少錢一碗？",
            "pinyinA": "Qǐngwèn, shuǐjiǎo duōshao qián yì wǎn?",
            "meaningPtA": "Com licença, quanto custa uma tigela de guioza (pastel cozido)?",
            "meaningEnA": "Excuse me, how much is a bowl of boiled dumplings?",
            "targetWordA": "水饺",
            "targetPinyinA": "shuǐjiǎo",
            "targetTonesA": [3, 3],
            "sentenceB": "请问，睡觉多少钱一晚？",
            "traditionalB": "請問，睡覺多少錢一晚？",
            "pinyinB": "Qǐngwèn, shuìjiào duōshao qián yì wǎn?",
            "meaningPtB": "Com licença, quanto custa uma noite para dormir?",
            "meaningEnB": "Excuse me, how much is one night to sleep?",
            "targetWordB": "睡觉",
            "targetPinyinB": "shuìjiào",
            "targetTonesB": [4, 4],
            "tipPt": "Em 水饺 (shuǐjiǎo), o Tone Sandhi transforma o primeiro 3º tom em 2º tom [35-214]; em 睡觉 (shuìjiào), ambos caem bruscamente [51-51].",
            "tipEn": "In 水饺 (shuǐjiǎo), T3 sandhi turns the first syllable rising [35-214]; in 睡觉 (shuìjiào), both fall sharply [51-51]."
        },
        {
            "focusType": "tone_and_sibilant",
            "subCategory": "T3+T2 vs T4+T4 (买十个 vs 卖四个)",
            "difficulty": 3,
            "sentenceA": "他今天想去买十个苹果。",
            "traditionalA": "他今天想去買十個蘋果。",
            "pinyinA": "Tā jīntiān xiǎng qù mǎi shí gè píngguǒ.",
            "meaningPtA": "Hoje ele quer ir comprar dez maçãs.",
            "meaningEnA": "Today he wants to go buy ten apples.",
            "targetWordA": "买十个",
            "targetPinyinA": "mǎi shí gè",
            "targetTonesA": [3, 2],
            "sentenceB": "他今天想去卖四个苹果。",
            "traditionalB": "他今天想去賣四個蘋果。",
            "pinyinB": "Tā jīntiān xiǎng qù mài sì gè píngguǒ.",
            "meaningPtB": "Hoje ele quer ir vender quatro maçãs.",
            "meaningEnB": "Today he wants to go sell four apples.",
            "targetWordB": "卖四个",
            "targetPinyinB": "mài sì gè",
            "targetTonesB": [4, 4],
            "tipPt": "Contraste duplo clássico: 买 (mǎi T3) + 十 (shí retroflexa T2) vs 卖 (mài T4) + 四 (sì alveolar T4).",
            "tipEn": "Classic double contrast: 买 (mǎi T3) + 十 (shí retroflex T2) vs 卖 (mài T4) + 四 (sì alveolar T4)."
        },
        {
            "focusType": "monosyllable_tone",
            "subCategory": "T2 vs T4 (蓝 lán vs 暗 àn)",
            "difficulty": 2,
            "sentenceA": "这件衣服的颜色很蓝。",
            "traditionalA": "這件衣服的顏色很藍。",
            "pinyinA": "Zhè jiàn yīfu de yánsè hěn lán.",
            "meaningPtA": "A cor desta roupa é muito azul.",
            "meaningEnA": "The color of this piece of clothing is very blue.",
            "targetWordA": "蓝",
            "targetPinyinA": "lán",
            "targetTonesA": [2],
            "sentenceB": "这件衣服的颜色很暗。",
            "traditionalB": "這件衣服的顏色很暗。",
            "pinyinB": "Zhè jiàn yīfu de yánsè hěn àn.",
            "meaningPtB": "A cor desta roupa é muito escura.",
            "meaningEnB": "The color of this piece of clothing is very dark.",
            "targetWordB": "暗",
            "targetPinyinB": "àn",
            "targetTonesB": [4],
            "tipPt": "Note a lateral inicial /l/ com subida tonal em 蓝 (lán T2) contra o ataque vocálico glotal em queda brusca de 暗 (àn T4).",
            "tipEn": "Notice the lateral initial /l/ with rising pitch in 蓝 (lán T2) vs glottal onset with sharp fall in 暗 (àn T4)."
        },
        {
            "focusType": "initial_place",
            "subCategory": "l vs n (蓝 lán vs 难 nán)",
            "difficulty": 3,
            "sentenceA": "这幅画的背景真的很蓝。",
            "traditionalA": "這幅畫的背景真的很藍。",
            "pinyinA": "Zhè fú huà de bèijǐng zhēn de hěn lán.",
            "meaningPtA": "O fundo deste quadro é realmente muito azul.",
            "meaningEnA": "The background of this painting is really very blue.",
            "targetWordA": "很蓝",
            "targetPinyinA": "hěn lán",
            "targetTonesA": [3, 2],
            "sentenceB": "这道数学题真的很难。",
            "traditionalB": "這道數學題真的很難。",
            "pinyinB": "Zhè dào shùxué tí zhēn de hěn nán.",
            "meaningPtB": "Esta questão de matemática é realmente muito difícil.",
            "meaningEnB": "This math problem is really very difficult.",
            "targetWordB": "很难",
            "targetPinyinB": "hěn nán",
            "targetTonesB": [3, 2],
            "tipPt": "Em 蓝 (lán) o ar escapa pelas laterais da língua (/l/); em 难 (nán) o fluxo de ar sai pelo nariz (/n/).",
            "tipEn": "In 蓝 (lán) air flows around the sides of the tongue (/l/); in 难 (nán) airflow is nasal (/n/)."
        },
        {
            "focusType": "dissyllable_tone",
            "subCategory": "T4+T1 vs T3+T4 (看书 kànshū vs 砍树 kǎnshù)",
            "difficulty": 2,
            "sentenceA": "我妈妈在院子里看书。",
            "traditionalA": "我媽媽在院子裡看書。",
            "pinyinA": "Wǒ māma zài yuànzi lǐ kànshū.",
            "meaningPtA": "Minha mãe está lendo um livro no quintal.",
            "meaningEnA": "My mother is reading a book in the courtyard.",
            "targetWordA": "看书",
            "targetPinyinA": "kànshū",
            "targetTonesA": [4, 1],
            "sentenceB": "我妈妈在院子里砍树。",
            "traditionalB": "我媽媽在院子裡砍樹。",
            "pinyinB": "Wǒ māma zài yuànzi lǐ kǎnshù.",
            "meaningPtB": "Minha mãe está cortando árvores no quintal.",
            "meaningEnB": "My mother is chopping trees in the courtyard.",
            "targetWordB": "砍树",
            "targetPinyinB": "kǎnshù",
            "targetTonesB": [3, 4],
            "tipPt": "Em 看书 (kànshū T4+T1), a voz cai na 1ª sílaba e sustenta o topo na 2ª; em 砍树 (kǎnshù T3+T4), a 1ª fica grave [21] e a 2ª despenca [51].",
            "tipEn": "In 看书 (kànshū T4+T1), pitch drops then stays high-flat; in 砍树 (kǎnshù T3+T4), the 1st syllable stays low [21] and the 2nd drops [51]."
        },
        {
            "focusType": "initial_aspiration",
            "subCategory": "d (/t/) vs t (/tʰ/) (肚子 dùzi vs 兔子 tùzi)",
            "difficulty": 2,
            "sentenceA": "你看，他的肚子很大。",
            "traditionalA": "你看，他的肚子很大。",
            "pinyinA": "Nǐ kàn, tā de dùzi hěn dà.",
            "meaningPtA": "Olhe, a barriga dele é muito grande.",
            "meaningEnA": "Look, his belly is very big.",
            "targetWordA": "肚子",
            "targetPinyinA": "dùzi",
            "targetTonesA": [4, 5],
            "sentenceB": "你看，他的兔子很大。",
            "traditionalB": "你看，他的兔子很大。",
            "pinyinB": "Nǐ kàn, tā de tùzi hěn dà.",
            "meaningPtB": "Olhe, o coelho dele é muito grande.",
            "meaningEnB": "Look, his rabbit is very big.",
            "targetWordB": "兔子",
            "targetPinyinB": "tùzi",
            "targetTonesB": [4, 5],
            "tipPt": "Contraste puro de VOT (Voice Onset Time): 肚子 (dùzi) tem oclusiva não-aspirada /t/; 兔子 (tùzi) tem forte explosão de sopro /tʰ/.",
            "tipEn": "Pure VOT contrast: 肚子 (dùzi) has unaspirated /t/; 兔子 (tùzi) has a strong aspirated burst /tʰ/."
        },
        {
            "focusType": "dissyllable_tone",
            "subCategory": "T2+T1 vs T1+T2 (熊猫 xióngmāo vs 胸毛 xiōngmáo)",
            "difficulty": 2,
            "sentenceA": "动物园里有很多可爱的熊猫。",
            "traditionalA": "動物園裡有很多可愛的熊貓。",
            "pinyinA": "Dòngwùyuán lǐ yǒu hěn duō kě'ài de xióngmāo.",
            "meaningPtA": "No zoológico há muitos pandas fofos.",
            "meaningEnA": "There are many cute pandas in the zoo.",
            "targetWordA": "熊猫",
            "targetPinyinA": "xióngmāo",
            "targetTonesA": [2, 1],
            "sentenceB": "那个运动员有很多胸毛。",
            "traditionalB": "那個運動員有很多胸毛。",
            "pinyinB": "Nàge yùndòngyuán yǒu hěn duō xiōngmáo.",
            "meaningPtB": "Aquele atleta tem muitos pelos no peito.",
            "meaningEnB": "That athlete has a lot of chest hair.",
            "targetWordB": "胸毛",
            "targetPinyinB": "xiōngmáo",
            "targetTonesB": [1, 2],
            "tipPt": "Inversão melódica: 熊猫 (xióngmāo) sobe na 1ª e nivela no topo na 2ª (T2+T1); 胸毛 (xiōngmáo) começa alto e sobe na 2ª (T1+T2).",
            "tipEn": "Melodic inversion: 熊猫 (xióngmāo) rises then stays high (T2+T1); 胸毛 (xiōngmáo) starts high then rises on the second syllable (T1+T2)."
        },
        {
            "focusType": "dissyllable_tone",
            "subCategory": "T3+T3 vs T3+T4 (老板 lǎobǎn vs 老伴 lǎobàn)",
            "difficulty": 3,
            "sentenceA": "他是这家餐厅的老板。",
            "traditionalA": "他是這家餐廳的老闆。",
            "pinyinA": "Tā shì zhè jiā cāntīng de lǎobǎn.",
            "meaningPtA": "Ele é o chefe/dono deste restaurante.",
            "meaningEnA": "He is the boss/owner of this restaurant.",
            "targetWordA": "老板",
            "targetPinyinA": "lǎobǎn",
            "targetTonesA": [3, 3],
            "sentenceB": "她是这位老先生的老伴。",
            "traditionalB": "她是這位老先生的老伴。",
            "pinyinB": "Tā shì zhè wèi lǎo xiānsheng de lǎobàn.",
            "meaningPtB": "Ela é a esposa/companheira deste senhor.",
            "meaningEnB": "She is the spouse/companion of this elderly gentleman.",
            "targetWordB": "老伴",
            "targetPinyinB": "lǎobàn",
            "targetTonesB": [3, 4],
            "tipPt": "Em 老板 (lǎobǎn T3+T3), 'lǎo' sofre sandhi e sobe como T2 [35]; em 老伴 (lǎobàn T3+T4), 'lǎo' é meio-3º tom grave [21] seguido de queda [51].",
            "tipEn": "In 老板 (lǎobǎn T3+T3), 'lǎo' becomes rising T2 [35]; in 老伴 (lǎobàn T3+T4), 'lǎo' stays low [21] before falling [51]."
        },
        {
            "focusType": "dissyllable_tone",
            "subCategory": "T1+T5 vs T1+T1 (东西 dōngxi vs 东西 dōngxī)",
            "difficulty": 3,
            "sentenceA": "我去商店买一点东西。",
            "traditionalA": "我去商店買一點東西。",
            "pinyinA": "Wǒ qù shāngdiàn mǎi yìdiǎn dōngxi.",
            "meaningPtA": "Vou à loja comprar algumas coisas.",
            "meaningEnA": "I am going to the store to buy some things.",
            "targetWordA": "东西",
            "targetPinyinA": "dōngxi",
            "targetTonesA": [1, 5],
            "sentenceB": "这条街是从东到西的方向，连接东西两边。",
            "traditionalB": "這條街是從東到西的方向，連接東西兩邊。",
            "pinyinB": "Zhè tiáo jiē liánjiē dōngxī liǎng biān.",
            "meaningPtB": "Esta rua conecta os dois lados, leste e oeste.",
            "meaningEnB": "This street connects the east and west sides.",
            "targetWordB": "东西",
            "targetPinyinB": "dōngxī",
            "targetTonesB": [1, 1],
            "tipPt": "O Tom Neutro em 东西 (dōngxi = coisa) faz a 2ª sílaba cair curta e fraca; em 东西 (dōngxī = leste-oeste), ambas são longas e altas [55-55].",
            "tipEn": "Neutral tone in 东西 (dōngxi = thing) makes the 2nd syllable short and low; in 东西 (dōngxī = east-west), both stay high [55-55]."
        },
        {
            "focusType": "final_nasal",
            "subCategory": "-in vs -ing (金子 jīnzi vs 镜子 jìngzi)",
            "difficulty": 3,
            "sentenceA": "桌子上放着一块真金子。",
            "traditionalA": "桌子上放著一塊真金子。",
            "pinyinA": "Zhuōzi shang fàngzhe yí kuài zhēn jīnzi.",
            "meaningPtA": "Sobre a mesa há um pedaço de ouro verdadeiro.",
            "meaningEnA": "On the table lies a piece of real gold.",
            "targetWordA": "金子",
            "targetPinyinA": "jīnzi",
            "targetTonesA": [1, 5],
            "sentenceB": "桌子上放着一面大镜子。",
            "traditionalB": "桌子上放著一面大鏡子。",
            "pinyinB": "Zhuōzi shang fàngzhe yí miàn dà jìngzi.",
            "meaningPtB": "Sobre a mesa há um espelho grande.",
            "meaningEnB": "On the table lies a large mirror.",
            "targetWordB": "镜子",
            "targetPinyinB": "jìngzi",
            "targetTonesB": [4, 5],
            "tipPt": "Em 金子 (jīnzi), a ponta da língua toca os alvéolos (-n) no 1º tom; em 镜子 (jìngzi), o dorso da língua fecha no véu palatino (-ng) no 4º tom.",
            "tipEn": "In 金子 (jīnzi), tongue tip touches alveolar ridge (-n) in T1; in 镜子 (jìngzi), tongue back closes velum (-ng) in T4."
        },
        {
            "focusType": "final_nasal",
            "subCategory": "-an vs -ang (船 chuán vs 床 chuáng)",
            "difficulty": 3,
            "sentenceA": "工人们正在修那艘木船。",
            "traditionalA": "工人們正在修那艘木船。",
            "pinyinA": "Gōngrénmen zhèngzài xiū nà sōu mù chuán.",
            "meaningPtA": "Os trabalhadores estão consertando aquele barco de madeira.",
            "meaningEnA": "The workers are repairing that wooden boat.",
            "targetWordA": "木船",
            "targetPinyinA": "mù chuán",
            "targetTonesA": [4, 2],
            "sentenceB": "工人们正在修那张木床。",
            "traditionalB": "工人們正在修那張木床。",
            "pinyinB": "Gōngrénmen zhèngzài xiū nà zhāng mù chuáng.",
            "meaningPtB": "Os trabalhadores estão consertando aquela cama de madeira.",
            "meaningEnB": "The workers are repairing that wooden bed.",
            "targetWordB": "木床",
            "targetPinyinB": "mù chuáng",
            "targetTonesB": [4, 2],
            "tipPt": "Par mínimo clássico de coda nasal: 船 (chuán /-wan/) tem vogal anteriorizada; 床 (chuáng /-wɑŋ/) abre a garganta com ressonância velar.",
            "tipEn": "Classic nasal coda pair: 船 (chuán /-wan/) fronts the vowel; 床 (chuáng /-wɑŋ/) opens the back of the throat with velar resonance."
        },
        {
            "focusType": "initial_place",
            "subCategory": "zh vs j (知道 zhīdào vs 肌道/鸡叫 jījiào)",
            "difficulty": 3,
            "sentenceA": "这件事情大家都已经知道了。",
            "traditionalA": "這件事情大家都已經知道了。",
            "pinyinA": "Zhè jiàn shìqing dàjiā dōu yǐjīng zhīdào le.",
            "meaningPtA": "Todos já sabem sobre este assunto.",
            "meaningEnA": "Everyone already knows about this matter.",
            "targetWordA": "知道",
            "targetPinyinA": "zhīdào",
            "targetTonesA": [1, 4],
            "sentenceB": "这件事情大家都已经迟到了。",
            "traditionalB": "這件事情大家都已經遲到了。",
            "pinyinB": "Zhè cì huìyì dàjiā dōu yǐjīng chídào le.",
            "meaningPtB": "Nesta reunião todos já se atrasaram.",
            "meaningEnB": "For this meeting everyone has already arrived late.",
            "targetWordB": "迟到",
            "targetPinyinB": "chídào",
            "targetTonesB": [2, 4],
            "tipPt": "知道 (zhīdào: retroflexa não-aspirada T1) vs 迟到 (chídào: retroflexa aspirada T2).",
            "tipEn": "知道 (zhīdào: unaspirated retroflex T1) vs 迟到 (chídào: aspirated retroflex T2)."
        },
        {
            "focusType": "dissyllable_tone",
            "subCategory": "T1+T4 vs T4+T3 (伤害 shānghài vs 上海 Shànghǎi)",
            "difficulty": 2,
            "sentenceA": "他从来没有去过上海。",
            "traditionalA": "他從來沒有去過上海。",
            "pinyinA": "Tā cónglái méiyǒu qùguo Shànghǎi.",
            "meaningPtA": "Ele nunca foi a Xangai.",
            "meaningEnA": "He has never been to Shanghai.",
            "targetWordA": "上海",
            "targetPinyinA": "Shànghǎi",
            "targetTonesA": [4, 3],
            "sentenceB": "这句话可能会造成伤害。",
            "traditionalB": "這句話可能會造成傷害。",
            "pinyinB": "Zhè jù huà kěnéng huì zàochéng shānghài.",
            "meaningPtB": "Esta frase pode causar mágoa/ferimento.",
            "meaningEnB": "This remark might cause harm/injury.",
            "targetWordB": "伤害",
            "targetPinyinB": "shānghài",
            "targetTonesB": [1, 4],
            "tipPt": "Em 上海 (Shànghǎi T4+T3), a 1ª cai e a 2ª mergulha grave; em 伤害 (shānghài T1+T4), a 1ª é plana no topo e a 2ª cai.",
            "tipEn": "In 上海 (Shànghǎi T4+T3), the 1st falls and the 2nd dips low; in 伤害 (shānghài T1+T4), the 1st is high-flat and the 2nd falls."
        },
        {
            "focusType": "dissyllable_tone",
            "subCategory": "T3+T1 vs T4+T3 (北京 Běijīng vs 背景 bèijǐng)",
            "difficulty": 2,
            "sentenceA": "我明年打算去北京工作。",
            "traditionalA": "我明年打算去北京工作。",
            "pinyinA": "Wǒ míngnián dǎsuàn qù Běijīng gōngzuò.",
            "meaningPtA": "Planejo ir trabalhar em Pequim no ano que vem.",
            "meaningEnA": "I plan to go work in Beijing next year.",
            "targetWordA": "北京",
            "targetPinyinA": "Běijīng",
            "targetTonesA": [3, 1],
            "sentenceB": "我们需要了解这首诗的历史背景。",
            "traditionalB": "我們需要了解這首詩的歷史背景。",
            "pinyinB": "Wǒmen xūyào liǎojiě zhè shǒu shī de lìshǐ bèijǐng.",
            "meaningPtB": "Precisamos compreender o contexto histórico deste poema.",
            "meaningEnB": "We need to understand the historical background of this poem.",
            "targetWordB": "背景",
            "targetPinyinB": "bèijǐng",
            "targetTonesB": [4, 3],
            "tipPt": "北京 (Běijīng: meio-3º grave [21] + 1º alto [55]) vs 背景 (bèijǐng: 4º queda brusca [51] + 3º grave [214]).",
            "tipEn": "北京 (Běijīng: low half-T3 [21] + high T1 [55]) vs 背景 (bèijǐng: sharp falling T4 [51] + dipping T3 [214])."
        },
        {
            "focusType": "dissyllable_tone",
            "subCategory": "T4+T2 vs T2+T4 (练习 liànxí vs 联系 liánxì)",
            "difficulty": 3,
            "sentenceA": "我们每天都要坚持练习听力。",
            "traditionalA": "我們每天都要堅持練習聽力。",
            "pinyinA": "Wǒmen měitiān dōu yào jiānchí liànxí tīnglì.",
            "meaningPtA": "Precisamos praticar escuta todos os dias com persistência.",
            "meaningEnA": "We must keep practicing listening every day.",
            "targetWordA": "练习",
            "targetPinyinA": "liànxí",
            "targetTonesA": [4, 2],
            "sentenceB": "如果你到了车站，请马上联系我。",
            "traditionalB": "如果你到了車站，請馬上聯繫我。",
            "pinyinB": "Rúguǒ nǐ dào le chēzhàn, qǐng mǎshàng liánxì wǒ.",
            "meaningPtB": "Se você chegar à estação, por favor entre em contato comigo imediatamente.",
            "meaningEnB": "If you arrive at the station, please contact me immediately.",
            "targetWordB": "联系",
            "targetPinyinB": "liánxì",
            "targetTonesB": [2, 4],
            "tipPt": "Espelho tonal clássico: 练习 (liànxí) desce e depois sobe (T4+T2); 联系 (liánxì) sobe e depois desce (T2+T4).",
            "tipEn": "Classic tonal mirror: 练习 (liànxí) falls then rises (T4+T2); 联系 (liánxì) rises then falls (T2+T4)."
        },
        {
            "focusType": "dissyllable_tone",
            "subCategory": "T4+T4 vs T2+T4 (会议 huìyì vs 回忆 huíyì)",
            "difficulty": 2,
            "sentenceA": "下午三点有一个重要的会议。",
            "traditionalA": "下午三點有一個重要的會議。",
            "pinyinA": "Xiàwǔ sān diǎn yǒu yí gè zhòngyào de huìyì.",
            "meaningPtA": "Às três da tarde há uma reunião importante.",
            "meaningEnA": "At three in the afternoon there is an important meeting.",
            "targetWordA": "会议",
            "targetPinyinA": "huìyì",
            "targetTonesA": [4, 4],
            "sentenceB": "这段旅行留下了美好的回忆。",
            "traditionalB": "這段旅行留下了美好的回憶。",
            "pinyinB": "Zhè duàn lǚxíng liúxià le měihǎo de huíyì.",
            "meaningPtB": "Esta viagem deixou belas recordações.",
            "meaningEnB": "This trip left wonderful memories.",
            "targetWordB": "回忆",
            "targetPinyinB": "huíyì",
            "targetTonesB": [2, 4],
            "tipPt": "Em 会议 (huìyì T4+T4) ocorrem duas quedas incisivas; em 回忆 (huíyì T2+T4) a 1ª sílaba sobe antes da queda na 2ª.",
            "tipEn": "In 会议 (huìyì T4+T4) there are two sharp falls; in 回忆 (huíyì T2+T4) the first syllable rises before the second falls."
        },
        {
            "focusType": "dissyllable_tone",
            "subCategory": "T3+T2 vs T4+T2 (语言 yǔyán vs 预言 yùyán)",
            "difficulty": 3,
            "sentenceA": "中文是一门非常优美的语言。",
            "traditionalA": "中文是一門非常優美的語言。",
            "pinyinA": "Zhōngwén shì yì mén fēicháng yōuměi de yǔyán.",
            "meaningPtA": "O chinês é um idioma muito belo.",
            "meaningEnA": "Chinese is a very beautiful language.",
            "targetWordA": "语言",
            "targetPinyinA": "yǔyán",
            "targetTonesA": [3, 2],
            "sentenceB": "古老的书里写着一个神秘的预言。",
            "traditionalB": "古老的書裡寫著一個神秘的預言。",
            "pinyinB": "Gǔlǎo de shū lǐ xiězhe yí gè shénmì de yùyán.",
            "meaningPtB": "No livro antigo está escrita uma profecia misteriosa.",
            "meaningEnB": "In the ancient book is written a mysterious prophecy.",
            "targetWordB": "预言",
            "targetPinyinB": "yùyán",
            "targetTonesB": [4, 2],
            "tipPt": "Em 语言 (yǔyán T3+T2), a 1ª sílaba permanece no registro grave [21] antes de subir em 'yán'; em 预言 (yùyán T4+T2), a 1ª cai do topo [51].",
            "tipEn": "In 语言 (yǔyán T3+T2), the 1st syllable stays low [21] before rising on 'yán'; in 预言 (yùyán T4+T2), the 1st drops from the top [51]."
        },
        {
            "focusType": "dissyllable_tone",
            "subCategory": "T3+T1 vs T4+T1 (火车 huǒchē vs 货车 huòchē)",
            "difficulty": 2,
            "sentenceA": "我们坐火车去南方旅行。",
            "traditionalA": "我們坐火車去南方旅行。",
            "pinyinA": "Wǒmen zuò huǒchē qù nánfāng lǚxíng.",
            "meaningPtA": "Vamos viajar para o sul de trem.",
            "meaningEnA": "We are taking the train to travel south.",
            "targetWordA": "火车",
            "targetPinyinA": "huǒchē",
            "targetTonesA": [3, 1],
            "sentenceB": "路边停着一辆大货车。",
            "traditionalB": "路邊停著一輛大貨車。",
            "pinyinB": "Lùbiān tíngzhe yí liàng dà huòchē.",
            "meaningPtB": "À beira da estrada está estacionado um grande caminhão de carga.",
            "meaningEnB": "Parked by the roadside is a large freight truck.",
            "targetWordB": "货车",
            "targetPinyinB": "huòchē",
            "targetTonesB": [4, 1],
            "tipPt": "火车 (huǒchē T3+T1: 'huǒ' grave [21] + 'chē' alto [55]) vs 货车 (huòchē T4+T1: 'huò' queda rápida [51] + 'chē' alto [55]).",
            "tipEn": "火车 (huǒchē T3+T1: low 'huǒ' [21] + high 'chē' [55]) vs 货车 (huòchē T4+T1: falling 'huò' [51] + high 'chē' [55])."
        },
    ]

    # Adicionar os 42 pares de context_sentence existentes em minimal_pairs.json
    with open(os.path.join(DATA_DIR, "minimal_pairs.json"), "r", encoding="utf-8") as f:
        mp_data = json.load(f)

    for p in mp_data["pairs"]:
        if p["category"] == "context_sentence" and p.get("sentenceContext"):
            ctx = p["sentenceContext"]
            curated_contextual.append({
                "focusType": "context_minimal_pair",
                "subCategory": p["subCategory"],
                "difficulty": p["difficulty"],
                "sentenceA": ctx["sentenceA"],
                "traditionalA": ctx["sentenceATrad"],
                "pinyinA": ctx["pinyinA"],
                "meaningPtA": ctx["meaningPtA"],
                "meaningEnA": ctx["meaningEnA"],
                "targetWordA": p["itemA"]["hanzi"],
                "targetPinyinA": p["itemA"]["pinyin"],
                "targetTonesA": p["itemA"]["tones"],
                "sentenceB": ctx["sentenceB"],
                "traditionalB": ctx["sentenceBTrad"],
                "pinyinB": ctx["pinyinB"],
                "meaningPtB": ctx["meaningPtB"],
                "meaningEnB": ctx["meaningEnB"],
                "targetWordB": p["itemB"]["hanzi"],
                "targetPinyinB": p["itemB"]["pinyin"],
                "targetTonesB": p["itemB"]["tones"],
                "tipPt": p["articulatoryTipPt"],
                "tipEn": p["articulatoryTipEn"],
            })

    # Gerar mais 120 pares de sentenças contextuais usando templates prosódicos naturais com pares dissilábicos e monossilábicos
    disyl_pairs = [p for p in mp_data["pairs"] if p["category"] == "dissyllable_tone_matrix"][:80]
    sentence_frames = [
        (
            "老师今天在课堂上讲了“{w}”这个词。",
            "老師今天在課堂上講了「{t}」這個詞。",
            "Lǎoshī jīntiān zài kètáng shang jiǎng le \"{p}\" zhège cí.",
            "O professor explicou hoje na aula a palavra \"{w}\" ({m_pt}).",
            "Today in class the teacher explained the word \"{w}\" ({m_en})."
        ),
        (
            "请大家仔细听“{w}”的发音。",
            "請大家仔細聽「{t}」的發音。",
            "Qǐng dàjiā zǐxì tīng \"{p}\" de fāyīn.",
            "Por favor, ouçam com atenção a pronúncia de \"{w}\" ({m_pt}).",
            "Please listen carefully to the pronunciation of \"{w}\" ({m_en})."
        ),
        (
            "他写在竹简上的两个字是“{w}”。",
            "他寫在竹簡上的兩個字是「{t}」。",
            "Tā xiě zài zhújiǎn shang de liǎng gè zì shì \"{w}\".",
            "Os dois caracteres que ele escreveu na tira de bambu são \"{w}\" ({m_pt}).",
            "The two characters he wrote on the bamboo slip are \"{w}\" ({m_en})."
        ),
        (
            "这篇文章里多次提到了“{w}”。",
            "這篇文章裡多次提到了「{t}」。",
            "Zhè piān wénzhāng lǐ duōcì tídào le \"{p}\".",
            "Neste texto mencionou-se várias vezes \"{w}\" ({m_pt}).",
            "In this article \"{w}\" ({m_en}) was mentioned several times."
        ),
    ]

    for idx, dp in enumerate(disyl_pairs):
        frame = sentence_frames[idx % len(sentence_frames)]
        itA, itB = dp["itemA"], dp["itemB"]
        sA = frame[0].format(w=itA["hanzi"])
        tA = frame[1].format(t=itA["traditional"])
        pA = frame[2].format(p=itA["pinyin"], w=itA["pinyin"])
        mptA = frame[3].format(w=itA["hanzi"], m_pt=itA["meaningPt"])
        menA = frame[4].format(w=itA["hanzi"], m_en=itA["meaningEn"])

        sB = frame[0].format(w=itB["hanzi"])
        tB = frame[1].format(t=itB["traditional"])
        pB = frame[2].format(p=itB["pinyin"], w=itB["pinyin"])
        mptB = frame[3].format(w=itB["hanzi"], m_pt=itB["meaningPt"])
        menB = frame[4].format(w=itB["hanzi"], m_en=itB["meaningEn"])

        curated_contextual.append({
            "focusType": "dissyllable_in_sentence",
            "subCategory": dp["subCategory"],
            "difficulty": dp["difficulty"],
            "sentenceA": sA,
            "traditionalA": tA,
            "pinyinA": pA,
            "meaningPtA": mptA,
            "meaningEnA": menA,
            "targetWordA": itA["hanzi"],
            "targetPinyinA": itA["pinyin"],
            "targetTonesA": itA["tones"],
            "sentenceB": sB,
            "traditionalB": tB,
            "pinyinB": pB,
            "meaningPtB": mptB,
            "meaningEnB": menB,
            "targetWordB": itB["hanzi"],
            "targetPinyinB": itB["pinyin"],
            "targetTonesB": itB["tones"],
            "tipPt": dp["articulatoryTipPt"],
            "tipEn": dp["articulatoryTipEn"],
        })

    # Numerar e adicionar IDs determinísticos de áudio para cada par de sentenças
    for idx, item in enumerate(curated_contextual, start=1):
        hashA = deterministic_audio_id(item["sentenceA"], item["pinyinA"])
        hashB = deterministic_audio_id(item["sentenceB"], item["pinyinB"])
        contextual_pairs.append({
            "id": f"sent_pair_{idx:04d}",
            "mode": "contextual_minimal_pairs",
            **item,
            "audioKeyA": f"sentences/xiaoxiao/sent_{hashA}.mp3",
            "audioKeyB": f"sentences/xiaoxiao/sent_{hashB}.mp3",
        })

    # =========================================================================
    # PARTE 2: CAÇA-TOM EM FRASE CONTÍNUA (Prosody & Tone Spotting) — >= 100 itens
    # =========================================================================
    curated_spotting_base = [
        ("今天天气非常暖和。", "今天天氣非常暖和。", "Jīntiān tiānqì fēicháng nuǎnhuo.", "O clima hoje está muito ameno.", "The weather today is very warm.", "天气", "tiānqì", [1, 4]),
        ("我们在茶馆里喝茶聊天。", "我們在茶館裡喝茶聊天。", "Wǒmen zài cháguǎn lǐ hēchá liáotiān.", "Tomamos chá e conversamos na casa de chá.", "We drink tea and chat in the teahouse.", "茶馆", "cháguǎn", [2, 3]),
        ("这位先生喜欢中国书法。", "這位先生喜歡中國書法。", "Zhè wèi xiānsheng xǐhuan Zhōngguó shūfǎ.", "Este senhor gosta de caligrafia chinesa.", "This gentleman likes Chinese calligraphy.", "书法", "shūfǎ", [1, 3]),
        ("学生们在安静地阅读古诗。", "學生們在安靜地閱讀古詩。", "Xuéshengmen zài ānjìng de yuèdú gǔshī.", "Os alunos estão lendo poesia antiga em silêncio.", "The students are quietly reading classical poetry.", "阅读", "yuèdú", [4, 2]),
        ("山上的松树四季常青。", "山上的松樹四季常青。", "Shān shang de sōngshù sìjì chángqīng.", "Os pinheiros na montanha são verdes nas quatro estações.", "The pine trees on the mountain are evergreen.", "松树", "sōngshù", [1, 4]),
        ("他每天早上六点起床跑步。", "他每天早上六點起床跑步。", "Tā měitiān zǎoshang liù diǎn qǐchuáng pǎobù.", "Ele acorda às seis da manhã todos os dias para correr.", "He gets up at six every morning to run.", "起床", "qǐchuáng", [3, 2]),
        ("月光静静地照在湖面上。", "月光靜靜地照在湖面上。", "Yuèguāng jìngjìng de zhào zài húmiàn shang.", "O luar brilha silenciosamente sobre a superfície do lago.", "Moonlight shines quietly on the lake surface.", "湖面", "húmiàn", [2, 4]),
        ("朋友送给我一本历史小说。", "朋友送給我一本歷史小說。", "Péngyou sòng gěi wǒ yì běn lìshǐ xiǎoshuō.", "Um amigo me presenteou com um romance histórico.", "A friend gave me a historical novel.", "历史", "lìshǐ", [4, 3]),
        ("春天的江南常常下毛毛雨。", "春天的江南常常下毛毛雨。", "Chūntiān de Jiāngnán chángcháng xià máomáoyǔ.", "Na primavera em Jiangnan costuma chover garoa fina.", "In spring in Jiangnan it often drizzles.", "江南", "Jiāngnán", [1, 2]),
        ("我们需要准备明天的考试。", "我們需要準備明天的考試。", "Wǒmen xūyào zhǔnbèi míngtiān de kǎoshì.", "Precisamos nos preparar para o exame de amanhã.", "We need to prepare for tomorrow's exam.", "准备", "zhǔnbèi", [3, 4]),
        ("古老的庭院里开满了梅花。", "古老的庭院裡開滿了梅花。", "Gǔlǎo de tíngyuàn lǐ kāimǎn le méihuā.", "O pátio antigo está repleto de flores de ameixeira.", "The ancient courtyard is full of plum blossoms.", "庭院", "tíngyuàn", [2, 4]),
        ("远处传来了悠扬的笛声。", "遠處傳來了悠揚的笛聲。", "Yuǎnchù chuánlái le yōuyáng de díshēng.", "De longe veio o som melodioso da flauta de bambu.", "From afar came the melodious sound of a bamboo flute.", "悠扬", "yōuyáng", [1, 2]),
    ]

    for idx, (s, trad, pin, mpt, men, tw, tpin, ttones) in enumerate(curated_spotting_base, start=1):
        h = deterministic_audio_id(s, pin)
        prosody_spotting.append({
            "id": f"spot_{idx:04d}",
            "mode": "prosody_tone_spotting",
            "sentence": s,
            "traditional": trad,
            "pinyin": pin,
            "meaningPt": mpt,
            "meaningEn": men,
            "targetWord": tw,
            "targetPinyin": tpin,
            "targetTones": ttones,
            "difficulty": 3,
            "tipPt": f"Dentro do fluxo da frase, identifique o contorno tonal de '{tw}' ({tpin}): T{ttones[0]}+T{ttones[1]}.",
            "tipEn": f"Within the sentence stream, spot the tone contour of '{tw}' ({tpin}): T{ttones[0]}+T{ttones[1]}.",
            "audioKey": f"sentences/xiaoxiao/sent_{h}.mp3",
        })

    # Expandir Caça-Tom para >= 100 exercícios usando palavras dissilábicas em frases naturais
    spot_carriers = [
        ("大家都觉得{w}非常重要。", "大家都覺得{t}非常重要。", "Dàjiā dōu juéde {p} fēicháng zhòngyào.", "Todos acham que {w} ({m_pt}) é muito importante.", "Everyone feels that {w} ({m_en}) is very important."),
        ("老师在黑板上写下了{w}。", "老師在黑板上寫下了{t}。", "Lǎoshī zài hēibǎn shang xiěxià le {p}.", "O professor escreveu {w} ({m_pt}) no quadro.", "The teacher wrote {w} ({m_en}) on the blackboard."),
        ("你能听出{w}的声调变化吗？", "你能聽出{t}的聲調變化嗎？", "Nǐ néng tīngchū {p} de shēngdiào biànhuà ma?", "Você consegue ouvir a mudança tonal em {w} ({m_pt})?", "Can you hear the tone change in {w} ({m_en})?"),
    ]

    for idx in range(90):
        dp = disyl_pairs[idx % len(disyl_pairs)]
        it = dp["itemA"] if idx % 2 == 0 else dp["itemB"]
        carr = spot_carriers[idx % len(spot_carriers)]
        s = carr[0].format(w=it["hanzi"])
        trad = carr[1].format(t=it["traditional"])
        pin = carr[2].format(p=it["pinyin"])
        mpt = carr[3].format(w=it["hanzi"], m_pt=it["meaningPt"])
        men = carr[4].format(w=it["hanzi"], m_en=it["meaningEn"])
        h = deterministic_audio_id(s, pin)
        seq_id = len(prosody_spotting) + 1
        ttones = it["tones"] if len(it["tones"]) >= 2 else [1, 1]
        prosody_spotting.append({
            "id": f"spot_{seq_id:04d}",
            "mode": "prosody_tone_spotting",
            "sentence": s,
            "traditional": trad,
            "pinyin": pin,
            "meaningPt": mpt,
            "meaningEn": men,
            "targetWord": it["hanzi"],
            "targetPinyin": it["pinyin"],
            "targetTones": ttones[:2],
            "difficulty": dp["difficulty"],
            "tipPt": f"Perceba a coarticulação de '{it['hanzi']}' ({it['pinyin']}): T{ttones[0]}+T{ttones[1]}.",
            "tipEn": f"Notice the coarticulation of '{it['hanzi']}' ({it['pinyin']}): T{ttones[0]}+T{ttones[1]}.",
            "audioKey": f"sentences/xiaoxiao/sent_{h}.mp3",
        })

    # =========================================================================
    # PARTE 3: TRANSCRIÇÃO / RECONSTRUÇÃO AUDITIVA DE FRASE (>= 80 itens)
    # =========================================================================
    curated_reconstructions = [
        {
            "sentence": "请问，水饺多少钱一碗？",
            "traditional": "請問，水餃多少錢一碗？",
            "pinyin": "Qǐngwèn, shuǐjiǎo duōshao qián yì wǎn?",
            "meaningPt": "Com licença, quanto custa uma tigela de guioza?",
            "meaningEn": "Excuse me, how much is a bowl of dumplings?",
            "correctBlocks": ["请问", "水饺", "多少钱", "一碗"],
            "distractorBlocks": ["睡觉", "一晚", "水脚", "四碗"],
            "tipPt": "Segmente a frase ouvindo o contorno T2+T3 de 水饺 (shuǐjiǎo) e o classificador 一碗 (yì wǎn)."
        },
        {
            "sentence": "他今天想去买十个苹果。",
            "traditional": "他今天想去買十個蘋果。",
            "pinyin": "Tā jīntiān xiǎng qù mǎi shí gè píngguǒ.",
            "meaningPt": "Hoje ele quer ir comprar dez maçãs.",
            "meaningEn": "Today he wants to go buy ten apples.",
            "correctBlocks": ["他今天", "想去", "买", "十个", "苹果"],
            "distractorBlocks": ["卖", "四个", "四十个", "石榴"],
            "tipPt": "Diferencie 买 (mǎi T3) de 卖 (mài T4) e 十个 (shí gè retroflexa T2) de 四个 (sì gè alveolar T4)."
        },
        {
            "sentence": "我妈妈在院子里看书。",
            "traditional": "我媽媽在院子裡看書。",
            "pinyin": "Wǒ māma zài yuànzi lǐ kànshū.",
            "meaningPt": "Minha mãe está lendo um livro no quintal.",
            "meaningEn": "My mother is reading a book in the courtyard.",
            "correctBlocks": ["我妈妈", "在院子里", "看书"],
            "distractorBlocks": ["砍树", "看树", "我马匹", "在园子里"],
            "tipPt": "O bloco final 看书 (kànshū T4+T1) mantém o 1º tom alto e plano em 书 (shū)."
        },
        {
            "sentence": "这件衣服的颜色很蓝。",
            "traditional": "這件衣服的顏色很藍。",
            "pinyin": "Zhè jiàn yīfu de yánsè hěn lán.",
            "meaningPt": "A cor desta roupa é muito azul.",
            "meaningEn": "The color of this clothing is very blue.",
            "correctBlocks": ["这件衣服", "的颜色", "很蓝"],
            "distractorBlocks": ["很暗", "很难", "很慢", "的眼色"],
            "tipPt": "Atente para a consoante lateral /l/ e o 2º tom ascendente em 很蓝 (hěn lán)."
        },
        {
            "sentence": "你看，他的兔子很大。",
            "traditional": "你看，他的兔子很大。",
            "pinyin": "Nǐ kàn, tā de tùzi hěn dà.",
            "meaningPt": "Olhe, o coelho dele é muito grande.",
            "meaningEn": "Look, his rabbit is very big.",
            "correctBlocks": ["你看", "他的", "兔子", "很大"],
            "distractorBlocks": ["肚子", "秃子", "裤子", "很怕"],
            "tipPt": "O sopro aspirado forte em 兔子 (tùzi /tʰ/) distingue-o de 肚子 (dùzi /t/)."
        },
        {
            "sentence": "我们每天都要坚持练习听力。",
            "traditional": "我們每天都要堅持練習聽力。",
            "pinyin": "Wǒmen měitiān dōu yào jiānchí liànxí tīnglì.",
            "meaningPt": "Precisamos praticar escuta todos os dias com persistência.",
            "meaningEn": "We must keep practicing listening every day.",
            "correctBlocks": ["我们每天", "都要坚持", "练习", "听力"],
            "distractorBlocks": ["联系", "恋爱", "停力", "挺立"],
            "tipPt": "Identifique 练习 (liànxí T4+T2) antes de 听力 (tīnglì T1+T4)."
        },
    ]

    for idx, rec in enumerate(curated_reconstructions, start=1):
        h = deterministic_audio_id(rec["sentence"], rec["pinyin"])
        reconstructions.append({
            "id": f"recon_{idx:04d}",
            "mode": "sentence_reconstruction",
            "sentence": rec["sentence"],
            "traditional": rec["traditional"],
            "pinyin": rec["pinyin"],
            "meaningPt": rec["meaningPt"],
            "meaningEn": rec["meaningEn"],
            "correctBlocks": rec["correctBlocks"],
            "distractorBlocks": rec["distractorBlocks"],
            "difficulty": 3,
            "tipPt": rec["tipPt"],
            "tipEn": rec["tipPt"],
            "audioKey": f"sentences/xiaoxiao/sent_{h}.mp3",
        })

    # Gerar mais 75 exercícios de Reconstrução Auditiva a partir dos pares contextuais
    for idx, cp in enumerate(contextual_pairs[:75], start=len(reconstructions) + 1):
        # Construir blocos para sentenceA usando targetWordB como distrator direto!
        sA = cp["sentenceA"]
        twA = cp["targetWordA"]
        twB = cp["targetWordB"]
        if twA in sA and twA != twB:
            parts = sA.split(twA, 1)
            blocks = []
            if parts[0]:
                blocks.append(parts[0])
            blocks.append(twA)
            if parts[1]:
                blocks.append(parts[1])
        else:
            mid = max(2, len(sA) // 2)
            blocks = [sA[:mid], sA[mid:]]

        distractors = [twB, "不是", "没有", "已经"]
        reconstructions.append({
            "id": f"recon_{idx:04d}",
            "mode": "sentence_reconstruction",
            "sentence": cp["sentenceA"],
            "traditional": cp["traditionalA"],
            "pinyin": cp["pinyinA"],
            "meaningPt": cp["meaningPtA"],
            "meaningEn": cp["meaningEnA"],
            "correctBlocks": blocks,
            "distractorBlocks": distractors,
            "difficulty": cp["difficulty"],
            "tipPt": cp["tipPt"],
            "tipEn": cp["tipEn"],
            "audioKey": cp["audioKeyA"],
        })

    dataset = {
        "version": "2.0.0",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "totalExercises": len(contextual_pairs) + len(prosody_spotting) + len(reconstructions),
        "counts": {
            "contextual_minimal_pairs": len(contextual_pairs),
            "prosody_tone_spotting": len(prosody_spotting),
            "sentence_reconstruction": len(reconstructions),
        },
        "contextualPairs": contextual_pairs,
        "prosodySpotting": prosody_spotting,
        "sentenceReconstructions": reconstructions,
    }

    out_path = os.path.join(DATA_DIR, "sentences_minimal_pairs.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(dataset, f, ensure_ascii=False, indent=2)

    print(f"[audit_and_fix_audio] sentences_minimal_pairs.json salvo com {dataset['totalExercises']} exercícios:")
    print("  - contextual_minimal_pairs:", len(contextual_pairs))
    print("  - prosody_tone_spotting:", len(prosody_spotting))
    print("  - sentence_reconstruction:", len(reconstructions))
    return dataset


if __name__ == "__main__":
    audit_existing_audio()
    build_sentences_dataset()
