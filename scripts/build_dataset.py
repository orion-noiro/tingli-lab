"""
build_dataset.py
Processamento do dicionário CC-CEDICT, geração de syllables_chart.json,
tone_sandhi.json e sound_guides_pt.json seguindo os contratos estritos
de src/types/phonetics.ts.
"""

import os
import gzip
import json
import re
import urllib.request
import pypinyin
from pypinyin import pinyin, Style

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
CACHE_DIR = os.path.join(ROOT_DIR, "scripts", "cache")
PUBLIC_DATA_DIR = os.path.join(ROOT_DIR, "public", "data")
PUBLIC_AUDIO_DIR = os.path.join(ROOT_DIR, "public", "audio")

CEDICT_URL = "https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz"
CEDICT_GZ_PATH = os.path.join(CACHE_DIR, "cedict_1_0_ts_utf-8_mdbg.txt.gz")
CEDICT_TXT_PATH = os.path.join(CACHE_DIR, "cedict.txt")

os.makedirs(CACHE_DIR, exist_ok=True)
os.makedirs(PUBLIC_DATA_DIR, exist_ok=True)

# Tonal diacritics mapping
PINYIN_TONE_MARKS = {
    'a': ['ā', 'á', 'ǎ', 'à', 'a'],
    'e': ['ē', 'é', 'ě', 'è', 'e'],
    'i': ['ī', 'í', 'ǐ', 'ì', 'i'],
    'o': ['ō', 'ó', 'ǒ', 'ò', 'o'],
    'u': ['ū', 'ú', 'ǔ', 'ù', 'u'],
    'v': ['ǖ', 'ǘ', 'ǚ', 'ǜ', 'ü'],
    'ü': ['ǖ', 'ǘ', 'ǚ', 'ǜ', 'ü'],
}

CHAO_MAP = {
    1: "55",
    2: "35",
    3: "214",
    4: "51",
    5: "2"
}

CHAO_IPA_TONE = {
    1: "˥˥",
    2: "˧˥",
    3: "˨˩˦",
    4: "˥˩",
    5: ""
}

# Iniciais e Grupos
INITIALS = ["b", "p", "m", "f", "d", "t", "n", "l", "g", "k", "h", "j", "q", "x", "zh", "ch", "sh", "r", "z", "c", "s", "Ø"]

INITIAL_GROUPS = {
    "b": "bilabial_labiodental", "p": "bilabial_labiodental", "m": "bilabial_labiodental", "f": "bilabial_labiodental",
    "d": "alveolar", "t": "alveolar", "n": "alveolar", "l": "alveolar",
    "g": "velar", "k": "velar", "h": "velar",
    "j": "alveolo_palatal", "q": "alveolo_palatal", "x": "alveolo_palatal",
    "zh": "retroflex", "ch": "retroflex", "sh": "retroflex", "r": "retroflex",
    "z": "dental_sibilant", "c": "dental_sibilant", "s": "dental_sibilant",
    "Ø": "zero_initial"
}

FINALS = [
    "a", "o", "e", "ai", "ei", "ao", "ou", "an", "en", "ang", "eng", "er",
    "i", "ia", "iao", "ie", "iu", "ian", "in", "iang", "ing", "iong",
    "u", "ua", "uo", "uai", "ui", "uan", "un", "uang", "ong",
    "ü", "üe", "üan", "ün"
]

FINAL_GROUPS = {
    "a": "simple", "o": "simple", "e": "simple", "er": "simple",
    "ai": "diphthong", "ei": "diphthong", "ao": "diphthong", "ou": "diphthong",
    "an": "nasal_n", "en": "nasal_n",
    "ang": "nasal_ng", "eng": "nasal_ng",
    "i": "simple", "ia": "medial_i", "iao": "medial_i", "ie": "medial_i", "iu": "medial_i",
    "ian": "medial_i", "in": "medial_i", "iang": "medial_i", "ing": "medial_i", "iong": "medial_i",
    "u": "simple", "ua": "medial_u", "uo": "medial_u", "uai": "medial_u", "ui": "medial_u",
    "uan": "medial_u", "un": "medial_u", "uang": "medial_u", "ong": "medial_u",
    "ü": "medial_v", "üe": "medial_v", "üan": "medial_v", "ün": "medial_v"
}

INITIAL_IPA = {
    "b": "p", "p": "pʰ", "m": "m", "f": "f",
    "d": "t", "t": "tʰ", "n": "n", "l": "l",
    "g": "k", "k": "kʰ", "h": "x",
    "j": "tɕ", "q": "tɕʰ", "x": "ɕ",
    "zh": "ʈʂ", "ch": "ʈʂʰ", "sh": "ʂ", "r": "ʐ",
    "z": "ts", "c": "tsʰ", "s": "s",
    "Ø": ""
}

FINAL_IPA = {
    "a": "a", "o": "o", "e": "ɤ", "er": "aɚ",
    "ai": "aɪ", "ei": "eɪ", "ao": "aʊ", "ou": "oʊ",
    "an": "an", "en": "ən", "ang": "ɑŋ", "eng": "ɤŋ",
    "i": "i", "ia": "ja", "iao": "jaʊ", "ie": "jɛ", "iu": "joʊ",
    "ian": "jɛn", "in": "in", "iang": "jɑŋ", "ing": "iŋ", "iong": "jʊŋ",
    "u": "u", "ua": "wa", "uo": "wo", "uai": "waɪ", "ui": "weɪ",
    "uan": "wan", "un": "wən", "uang": "wɑŋ", "ong": "ʊŋ",
    "ü": "y", "üe": "yɛ", "üan": "ɥɛn", "ün": "yn"
}

def download_cedict():
    if not os.path.exists(CEDICT_TXT_PATH):
        if not os.path.exists(CEDICT_GZ_PATH):
            print(f"[build_dataset] Baixando CC-CEDICT de {CEDICT_URL}...")
            urllib.request.urlretrieve(CEDICT_URL, CEDICT_GZ_PATH)
            print("[build_dataset] Download concluído.")
        
        print("[build_dataset] Descompactando CC-CEDICT...")
        with gzip.open(CEDICT_GZ_PATH, 'rb') as f_in:
            with open(CEDICT_TXT_PATH, 'wb') as f_out:
                f_out.write(f_in.read())
        print("[build_dataset] CC-CEDICT pronto.")

def parse_cedict():
    """
    Parseia o CC-CEDICT e retorna:
    - entries_by_syl: dict { 'ma1': [entry, ...], 'ma2': [...] }
    - words_by_hanzi: dict { '你好': entry, ... }
    - all_entries: list
    """
    download_cedict()
    print("[build_dataset] Parseando entradas do CC-CEDICT...")
    
    entries_by_syl = {}
    words_by_hanzi = {}
    all_entries = []
    
    line_regex = re.compile(r"^(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+/(.+)/$")
    
    with open(CEDICT_TXT_PATH, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            m = line_regex.match(line)
            if not m:
                continue
            trad, simp, pinyin_raw, defs = m.groups()
            
            # Normalizar pinyin_raw: e.g. "lu:3" -> "lv3", "ma1"
            pinyin_clean = pinyin_raw.lower().replace("u:", "v").replace("5", "5")
            syllables_list = pinyin_clean.split()
            
            entry = {
                "traditional": trad,
                "simplified": simp,
                "pinyin_raw": pinyin_raw,
                "pinyin_clean": pinyin_clean,
                "syllables": syllables_list,
                "definitions": defs.split("/"),
                "is_single_char": len(simp) == 1
            }
            all_entries.append(entry)
            if simp not in words_by_hanzi:
                words_by_hanzi[simp] = entry
                
            if entry["is_single_char"] and len(syllables_list) == 1:
                syl_key = syllables_list[0]
                if syl_key not in entries_by_syl:
                    entries_by_syl[syl_key] = []
                entries_by_syl[syl_key].append(entry)
                
    print(f"[build_dataset] Total de entradas CC-CEDICT: {len(all_entries)}")
    print(f"[build_dataset] Sílabas monossilábicas mapeadas: {len(entries_by_syl)}")
    return entries_by_syl, words_by_hanzi, all_entries

# Pequeno dicionário de tradução PT para os termos mais frequentes
EN_TO_PT_LEXICON = {
    "hello": "olá", "hi": "olá", "how are you": "como vai",
    "horse": "cavalo", "mother": "mãe", "mom": "mãe",
    "he": "ele", "she": "ela", "it": "isto",
    "good": "bom", "bad": "mau / ruim",
    "water": "água", "fire": "fogo", "mountain": "montanha", "earth": "terra",
    "sun": "sol", "moon": "lua", "tree": "árvore", "wood": "madeira",
    "to eat": "comer", "to drink": "beber", "to go": "ir", "to come": "vir",
    "to see": "ver", "to look": "olhar", "to listen": "ouvir", "to speak": "falar",
    "one": "um", "two": "dois", "three": "três", "four": "quatro", "five": "cinco",
    "six": "seis", "seven": "sete", "eight": "oito", "nine": "nove", "ten": "dez",
    "big": "grande", "small": "pequeno", "much": "muito", "few": "pouco",
    "day": "dia", "year": "ano", "month": "mês", "time": "tempo / hora",
    "to scold": "repreender / xingar", "hemp": "cânhamo", "numb": "dormente",
    "question particle": "partícula de pergunta",
    "to buy": "comprar", "to sell": "vender", "dumpling": "pastel chinês (jiaozi)",
    "to sleep": "dormir", "panda": "urso panda", "boss": "chefe / patrão",
    "spouse": "cônjuge", "thing": "coisa", "east and west": "leste e oeste",
    "to practice": "praticar / exercício", "to contact": "contatar",
    "rain": "chuva", "fish": "peixe", "book": "livro", "tea": "chá",
    "friend": "amigo", "teacher": "professor", "student": "aluno",
    "China": "China", "Brazil": "Brasil", "Portuguese": "Português",
    "Chinese language": "Língua Chinesa", "door": "porta", "car": "carro",
    "airplane": "avião", "train": "trem", "money": "dinheiro", "cat": "gato",
    "dog": "cachorro", "bird": "pássaro", "flower": "flor", "grass": "grama",
    "sky": "céu", "cloud": "nuvem", "wind": "vento", "snow": "neve",
    "hot": "quente", "cold": "frio", "warm": "morno", "cool": "fresco",
    "father": "pai", "older brother": "irmão mais velho", "older sister": "irmã mais velha",
    "younger brother": "irmão mais novo", "younger sister": "irmã mais nova",
    "son": "filho", "daughter": "filha", "grandpa": "avô", "grandma": "avó",
    "rice": "arroz", "noodle": "macarrão", "bread": "pão", "meat": "carne",
    "apple": "maçã", "banana": "banana", "fruit": "fruta", "vegetable": "vegetal",
    "table": "mesa", "chair": "cadeira", "bed": "cama", "room": "quarto",
    "house": "casa", "school": "escola", "hospital": "hospital", "store": "loja",
    "road": "rua / estrada", "city": "cidade", "country": "país",
    "red": "vermelho", "blue": "azul", "yellow": "amarelo", "green": "verde",
    "white": "branco", "black": "preto",
}

# Mapa canônico de caracteres representativos HSK monofônicos de alta frequência
CANONICAL_SYLLABLE_HANZI = {
    "ma1": ("妈", "mãe", "mother"), "ma2": ("麻", "cânhamo / dormente", "hemp / numb"), "ma3": ("马", "cavalo", "horse"), "ma4": ("骂", "xingar / repreender", "to scold"), "ma5": ("吗", "partícula interrogativa", "question particle"),
    "ba1": ("八", "oito", "eight"), "ba2": ("拔", "arrancar / puxar", "to pull out"), "ba3": ("把", "segurar / classificador", "to hold"), "ba4": ("爸", "pai / papai", "father / dad"), "ba5": ("吧", "partícula modal", "modal particle"),
    "pa1": ("趴", "deitar de bruços", "to lie on stomach"), "pa2": ("爬", "escalar / subir", "to climb"), "pa4": ("怕", "temer / ter medo", "to fear"),
    "bi1": ("逼", "forçar / compelir", "to compel"), "bi2": ("鼻", "nariz", "nose"), "bi3": ("笔", "caneta / pincel", "pen / brush"), "bi4": ("必", "certamente / dever", "must / certainly"),
    "pi1": ("批", "lote / criticar", "batch / to criticize"), "pi2": ("皮", "pele / couro", "skin / leather"), "pi3": ("匹", "classificador para cavalos", "classifier for horses"), "pi4": ("屁", "gás / bobagem", "flatulence"),
    "bo1": ("波", "onda", "wave"), "po1": ("坡", "encosta / ladeira", "slope"), "mo1": ("摸", "tocar / apalpar", "to touch"), "fo2": ("佛", "Buda", "Buddha"),
    "da1": ("搭", "montar / pegar carona", "to put up / take"), "da2": ("答", "responder", "to answer"), "da3": ("打", "bater / jogar", "to hit / to play"), "da4": ("大", "grande", "big / large"),
    "ta1": ("他", "ele", "he / him"), "ta3": ("塔", "torre / pagode", "tower / pagoda"), "ta4": ("踏", "pisar", "to step on"),
    "na1": ("那", "aquele", "that"), "na2": ("拿", "pegar / segurar", "to hold / to take"), "na3": ("哪", "qual / onde", "which / where"), "na4": ("那", "aquele / então", "that / then"),
    "la1": ("拉", "puxar", "to pull"), "la3": ("喇叭", "trombeta", "horn"), "la4": ("辣", "apimentado / picante", "hot / spicy"),
    "ga1": ("咖", "café (fonético)", "coffee"), "ka3": ("卡", "cartão / caminhão", "card / truck"), "ha1": ("哈", "expirar / rir", "haha"),
    "ge1": ("哥", "irmão mais velho", "older brother"), "ge2": ("格", "grade / padrão", "grid / standard"), "ge3": ("葛", "trepadeira", "kudzu"), "ge4": ("个", "classificador geral", "general classifier"),
    "ke1": ("科", "ciência / departamento", "branch of study"), "ke2": ("咳", "tossir", "to cough"), "ke3": ("渴", "com sede", "thirsty"), "ke4": ("课", "aula / lição", "class / lesson"),
    "he1": ("喝", "beber", "to drink"), "he2": ("河", "rio", "river"), "he4": ("贺", "parabenizar", "to congratulate"),
    "ji1": ("鸡", "frango / galinha", "chicken"), "ji2": ("急", "urgente / ansioso", "urgent"), "ji3": ("几", "quantos / alguns", "how many"), "ji4": ("记", "lembrar / anotar", "to remember"),
    "qi1": ("七", "sete", "seven"), "qi2": ("骑", "montar / cavalgar", "to ride"), "qi3": ("起", "levantar / começar", "to rise"), "qi4": ("气", "ar / energia", "air / anger"),
    "xi1": ("西", "oeste", "west"), "xi2": ("习", "praticar / hábito", "to practice"), "xi3": ("洗", "lavar", "to wash"), "xi4": ("细", "fino / detalhado", "thin / fine"),
    "zhi1": ("知", "saber / conhecer", "to know"), "zhi2": ("直", "reto / direto", "straight"), "zhi3": ("纸", "papel", "paper"), "zhi4": ("治", "governar / tratar", "to treat / govern"),
    "chi1": ("吃", "comer", "to eat"), "chi2": ("迟", "atrasado / tarde", "late"), "chi3": ("尺", "régua", "ruler"), "chi4": ("翅", "asa", "wing"),
    "shi1": ("诗", "poema / poesia", "poem"), "shi2": ("十", "dez", "ten"), "shi3": ("史", "história", "history"), "shi4": ("是", "ser / sim", "to be / yes"),
    "ri4": ("日", "sol / dia", "sun / day"),
    "zi1": ("资", "recursos / capital", "resources"), "zi3": ("紫", "roxo / púrpura", "purple"), "zi4": ("字", "caractere / letra", "character / word"),
    "ci1": ("疵", "defeito", "flaw"), "ci2": ("词", "palavra / termo", "word"), "ci3": ("此", "este / aqui", "this"), "ci4": ("次", "vez / ordem", "time / order"),
    "si1": ("丝", "seda / fio", "silk"), "si3": ("死", "morrer", "to die"), "si4": ("四", "quatro", "four"),
    "zhu1": ("猪", "porco", "pig"), "zhu2": ("竹", "bambu", "bamboo"), "zhu3": ("主", "dono / principal", "master / main"), "zhu4": ("住", "morar / viver", "to live / stay"),
    "chu1": ("出", "sair", "to go out"), "chu2": ("厨", "cozinha", "kitchen"), "chu3": ("处", "lidar / lugar", "to deal with"), "chu4": ("触", "tocar", "to touch"),
    "shu1": ("书", "livro", "book"), "shu2": ("熟", "maduro / cozido", "ripe / familiar"), "shu3": ("鼠", "rato", "mouse / rat"), "shu4": ("树", "árvore", "tree"),
    "ru2": ("如", "como / se", "as if"), "ru3": ("乳", "leite", "milk"), "ru4": ("入", "entrar", "to enter"),
    "ju1": ("居", "residir", "to reside"), "ju2": ("菊", "crisântemo", "chrysanthemum"), "ju3": ("举", "levantar / erguer", "to lift"), "ju4": ("句", "frase / sentença", "sentence"),
    "qu1": ("区", "área / distrito", "area / district"), "qu2": ("渠", "canal", "canal"), "qu3": ("取", "pegar / obter", "to fetch"), "qu4": ("去", "ir", "to go"),
    "xu1": ("需", "precisar", "to need"), "xu2": ("徐", "lento / suave", "slowly"), "xu3": ("许", "permitir / prometer", "to allow"), "xu4": ("续", "continuar", "to continue"),
    "lv2": ("驴", "burro", "donkey"), "lv3": ("旅", "viagem / viajar", "trip / travel"), "lv4": ("绿", "verde", "green"),
    "lu1": ("撸", "arregaçar", "to roll up"), "lu2": ("炉", "fogão / forno", "stove"), "lu3": ("鲁", "rude / Shandong", "rash"), "lu4": ("路", "estrada / caminho", "road / path"),
    "nv3": ("女", "mulher / feminino", "female / woman"), "nv4": ("恧", "envergonhado", "ashamed"),
    "nu2": ("奴", "escravo", "slave"), "nu3": ("努", "esforçar-se", "to exert"), "nu4": ("怒", "raiva / fúria", "anger / fury"),
    "mai2": ("埋", "enterrar", "to bury"), "mai3": ("买", "comprar", "to buy"), "mai4": ("卖", "vender", "to sell"),
    "bao1": ("包", "bolsa / pacote", "bag / wrap"), "bao3": ("饱", "satisfeito / cheio", "full (from eating)"), "bao4": ("报", "jornal / relatar", "newspaper"),
    "pao1": ("抛", "lançar / arremessar", "to toss"), "pao2": ("袍", "manto / túnica", "robe"), "pao3": ("跑", "correr", "to run"), "pao4": ("泡", "bolha / infundir", "bubble / soak"),
    "dao1": ("刀", "faca", "knife"), "dao3": ("岛", "ilha", "island"), "dao4": ("到", "chegar", "to arrive"),
    "tao1": ("掏", "tirar do bolso", "to scoop out"), "tao2": ("桃", "pêssego", "peach"), "tao3": ("讨", "pedir / discutir", "to ask for"), "tao4": ("套", "conjunto / capa", "cover / set"),
    "zao3": ("早", "cedo / bom dia", "early / morning"), "zao4": ("造", "fabricar / criar", "to make / build"),
    "cao3": ("草", "grama / capim", "grass"), "cao4": ("操", "exercitar", "to drill"),
    "zhao3": ("找", "procurar", "to look for"), "chao3": ("吵", "barulhento / brigar", "noisy / quarrel"),
    "san1": ("三", "três", "three"), "shan1": ("山", "montanha", "mountain"),
    "ban1": ("班", "turma / turno", "class / shift"), "bang1": ("帮", "ajudar / grupo", "to help"),
    "fan4": ("饭", "arroz cozido / refeição", "cooked rice / meal"), "fang4": ("放", "colocar / soltar", "to put / release"),
    "chen2": ("陈", "expor / antigo", "to display"), "cheng2": ("程", "jornada / regra", "journey / rule"),
    "zhen1": ("真", "verdadeiro / real", "true / real"), "zheng1": ("争", "disputar / lutar", "to strive"),
    "yin1": ("音", "som / música", "sound"), "ying1": ("英", "herói / britânico", "hero / brave"),
    "xin1": ("心", "coração / mente", "heart"), "xin4": ("信", "carta / acreditar", "letter / believe"),
    "xing1": ("星", "estrela", "star"), "xing4": ("姓", "sobrenome", "family name"),
    "lian2": ("连", "conectar / ligar", "to link"), "liang2": ("凉", "fresco / frio", "cool / cold"),
    "guan1": ("关", "fechar / barreira", "to close"), "guang1": ("光", "luz / brilho", "light / ray"),
    "chuan2": ("船", "barco / navio", "boat / ship"), "chuang2": ("床", "cama", "bed"),
    "zou3": ("走", "andar / caminhar", "to walk"), "zuo3": ("左", "esquerda", "left"),
}

def select_best_entry(syl_key: str, elist: list) -> dict:
    if not elist:
        return {"simplified": "□", "traditional": "□", "definitions": [""]}
    if syl_key in CANONICAL_SYLLABLE_HANZI:
        target_hz, pt_m, en_m = CANONICAL_SYLLABLE_HANZI[syl_key]
        for e in elist:
            if e["simplified"] == target_hz:
                return {**e, "definitions": [en_m], "pt_override": pt_m}
        return {"simplified": target_hz, "traditional": target_hz, "definitions": [en_m], "pt_override": pt_m}

    def score_entry(e):
        d = (e["definitions"][0] if e["definitions"] else "").lower()
        pen = 0
        if "variant of" in d or "old variant" in d or "archaic" in d or "see " in d or "surname" in d:
            pen += 500
        if len(e["simplified"]) == 1 and ord(e["simplified"][0]) > 0x9fa0:
            pen += 200
        for k in EN_TO_PT_LEXICON:
            if k == d or k in d.split(";")[0]:
                pen -= 150
                break
        return pen + len(d)

    return min(elist, key=score_entry)

def translate_en_to_pt(def_en: str) -> str:
    cleaned = def_en.strip().lower()
    for en, pt in EN_TO_PT_LEXICON.items():
        if en == cleaned or en in cleaned.split(", "):
            return pt
    # Heurística rápida para pequenos termos
    first_part = def_en.split("/")[0].split(";")[0].strip()
    for en, pt in EN_TO_PT_LEXICON.items():
        if en in first_part.lower():
            return pt
    return first_part

def pinyin_with_diacritics(pinyin_tone3: str) -> str:
    """Converte Tone3 e.g. 'shui3' -> 'shuǐ', 'lv4' -> 'lǜ'"""
    m = re.match(r"^([a-z:]+)([1-5]?)$", pinyin_tone3.lower())
    if not m:
        return pinyin_tone3
    base, tone_str = m.groups()
    tone = int(tone_str) if tone_str else 5
    if tone == 5:
        return base.replace("v", "ü").replace("u:", "ü")
    
    # Regra oficial de aposição de tom em Mandarim:
    # 1. Se tem 'a' ou 'e', leva o acento.
    # 2. Se tem 'ou', o 'o' leva o acento.
    # 3. Caso contrário, a última vogal leva o acento.
    base_chars = list(base.replace("u:", "v"))
    target_idx = -1
    for i, c in enumerate(base_chars):
        if c in ('a', 'e'):
            target_idx = i
            break
    if target_idx == -1:
        if "ou" in "".join(base_chars):
            target_idx = "".join(base_chars).index("o")
        else:
            for i in range(len(base_chars) - 1, -1, -1):
                if base_chars[i] in ('i', 'u', 'v', 'o'):
                    target_idx = i
                    break
    
    if target_idx != -1:
        vowel = base_chars[target_idx]
        if vowel in PINYIN_TONE_MARKS:
            base_chars[target_idx] = PINYIN_TONE_MARKS[vowel][tone - 1]
    
    res = "".join(base_chars).replace("v", "ü")
    return res

def decompose_syllable(syl: str):
    """Separa inicial e final de uma sílaba ASCII (e.g. 'zhuang' -> 'zh', 'uang')"""
    syl = syl.lower().replace("u:", "v")
    # Checar iniciais de 2 letras
    for init in ["zh", "ch", "sh"]:
        if syl.startswith(init):
            return init, syl[len(init):]
    for init in ["b", "p", "m", "f", "d", "t", "n", "l", "g", "k", "h", "j", "q", "x", "r", "z", "c", "s"]:
        if syl.startswith(init):
            return init, syl[len(init):]
    # Iniciais zero (w -> u, y -> i/ü)
    return "Ø", syl

def get_syllable_ipa(initial: str, final: str, tone: int) -> str:
    i_ipa = INITIAL_IPA.get(initial, "")
    # Se final tem 'i' depois de z,c,s é [z̩], depois de zh,ch,sh,r é [ʐ̩]
    f_ipa = FINAL_IPA.get(final, final)
    if final == "i":
        if initial in ("z", "c", "s"):
            f_ipa = "z̩"
        elif initial in ("zh", "ch", "sh", "r"):
            f_ipa = "ʐ̩"
    t_chao = CHAO_IPA_TONE.get(tone, "")
    return f"/{i_ipa}{f_ipa}{t_chao}/"

def build_syllables_chart(entries_by_syl):
    print("[build_dataset] Gerando syllables_chart.json...")
    female_files = set(os.listdir(os.path.join(PUBLIC_AUDIO_DIR, "syllables", "human_female"))) if os.path.exists(os.path.join(PUBLIC_AUDIO_DIR, "syllables", "human_female")) else set()
    male_files = set(os.listdir(os.path.join(PUBLIC_AUDIO_DIR, "syllables", "human_male"))) if os.path.exists(os.path.join(PUBLIC_AUDIO_DIR, "syllables", "human_male")) else set()

    # Coletar todas as sílabas base conhecidas
    base_syllables_set = set()
    for syl_key in entries_by_syl.keys():
        m = re.match(r"^([a-z]+)[1-5]$", syl_key)
        if m:
            base_syllables_set.add(m.group(1))

    # Adicionar base syllables do Pinyin padrão
    syllables_dataset = {
        "version": "1.0.0",
        "initialsOrder": INITIALS,
        "finalsOrder": FINALS,
        "totalBaseSyllables": 0,
        "totalTonalSyllables": 0,
        "syllables": {}
    }

    total_tonal = 0

    for base in sorted(list(base_syllables_set)):
        init, fin = decompose_syllable(base)
        # Normalizar fin para exibição
        fin_display = fin.replace("v", "ü")
        base_pinyin = base.replace("v", "ü")
        
        init_group = INITIAL_GROUPS.get(init, "zero_initial")
        fin_group = FINAL_GROUPS.get(fin_display, "simple")
        ipa_base = f"/{INITIAL_IPA.get(init, '')}{FINAL_IPA.get(fin_display, fin_display)}/"

        cell = {
            "basePinyin": base_pinyin,
            "asciiBase": base,
            "initial": init,
            "final": fin_display,
            "initialGroup": init_group,
            "finalGroup": fin_group,
            "ipaBase": ipa_base,
            "tones": {}
        }

        for t in range(1, 6):
            syl_key = f"{base}{t}"
            entries = entries_by_syl.get(syl_key, [])
            filename = f"{base}{t}.mp3"
            has_female = filename in female_files
            has_male = filename in male_files

            if not entries and not has_female and not has_male:
                continue

            # Representante monofônico
            rep_hanzi = ""
            rep_trad = ""
            meaning_en = ""
            meaning_pt = ""
            examples = []

            if entries:
                first_entry = select_best_entry(syl_key, entries)
                rep_hanzi = first_entry["simplified"]
                rep_trad = first_entry["traditional"]
                meaning_en = first_entry["definitions"][0] if first_entry["definitions"] else ""
                meaning_pt = first_entry.get("pt_override") or translate_en_to_pt(meaning_en)

                for e in entries[:4]:
                    ex_def_en = e["definitions"][0] if e["definitions"] else ""
                    examples.append({
                        "hanzi": e["simplified"],
                        "traditional": e["traditional"],
                        "pinyin": pinyin_with_diacritics(syl_key),
                        "meaningPt": translate_en_to_pt(ex_def_en),
                        "meaningEn": ex_def_en,
                        "hsk": 1
                    })

            pinyin_diacritic = pinyin_with_diacritics(syl_key)
            ipa_tonal = get_syllable_ipa(init, fin_display, t)
            chao = CHAO_MAP.get(t, "55")

            audio_urls = {}
            if has_female:
                audio_urls["human_female"] = f"/audio/syllables/human_female/{filename}"
            if has_male:
                audio_urls["human_male"] = f"/audio/syllables/human_male/{filename}"

            variant = {
                "tone": t,
                "pinyin": pinyin_diacritic,
                "pinyinTone3": syl_key,
                "asciiFilename": filename,
                "ipa": ipa_tonal,
                "chao": chao,
                "representativeHanzi": rep_hanzi,
                "representativeTrad": rep_trad,
                "meaningPt": meaning_pt,
                "meaningEn": meaning_en,
                "examples": examples,
                "hasHumanFemale": has_female,
                "hasHumanMale": has_male,
                "audioUrls": audio_urls
            }
            cell["tones"][str(t)] = variant
            total_tonal += 1

        if cell["tones"]:
            syllables_dataset["syllables"][base] = cell

    syllables_dataset["totalBaseSyllables"] = len(syllables_dataset["syllables"])
    syllables_dataset["totalTonalSyllables"] = total_tonal

    out_path = os.path.join(PUBLIC_DATA_DIR, "syllables_chart.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(syllables_dataset, f, ensure_ascii=False, indent=2)
    print(f"[build_dataset] syllables_chart.json salvo com {syllables_dataset['totalBaseSyllables']} sílabas base e {total_tonal} variantes tonais.")
    return syllables_dataset

def build_tone_sandhi():
    print("[build_dataset] Gerando tone_sandhi.json...")
    
    rules = [
        {
            "id": "rule_t3_t3",
            "titlePt": "变调: Dois Terceiros Tons Consecutivos (T3 + T3 → T2 + T3)",
            "titleEn": "Tone Sandhi: Two Consecutive Third Tones (T3 + T3 → T2 + T3)",
            "formula": "T3 (214) + T3 (214) → T2 (35) + T3 (214)",
            "category": "third_tone_sandhi",
            "summaryPt": "Quando duas sílabas do 3º Tom ocorrem juntas, a primeira muda automaticamente para o 2º Tom ascendente (35), facilitando a transição vocal.",
            "summaryEn": "When two third-tone syllables appear consecutively, the first changes into a second tone (35) to facilitate smooth vocal pitch transition.",
            "acousticMechanicPt": "O 3º tom completo exige baixar até a frequência fundamental mínima (1) e depois subir (4). Dois 3º tons seguidos exigiriam um duplo mergulho glotal cansativo; por economia articulatória, a laringe transforma a primeira descida numa subida direta de Tom 2 [35].",
            "acousticMechanicEn": "A full third tone dips to pitch level 1 and rises. Two dips in succession cause vocal fatigue; the vocal tract economizes by turning the first into a rising second tone [35].",
            "examples": [
                {
                    "id": "sandhi_nihao",
                    "hanzi": "你好",
                    "traditional": "你好",
                    "underlyingPinyin": "nǐ hǎo",
                    "surfacePinyin": "ní hǎo",
                    "underlyingTones": [3, 3],
                    "surfaceTones": "T2 (35) + T3 (214)",
                    "underlyingChao": "214 + 214",
                    "surfaceChao": "35 + 214",
                    "ipaSurface": "/ni˧˥ xaʊ˨˩˦/",
                    "meaningPt": "olá / como vai",
                    "meaningEn": "hello",
                    "explanationPt": "Originalmente nǐ (3) + hǎo (3), pronuncia-se ní hǎo.",
                    "explanationEn": "Underlying nǐ (3) + hǎo (3), pronounced ní hǎo.",
                    "audioKeyClassroom": "words/xiaoxiao/classroom/ni3_hao3.mp3",
                    "audioKeyConversational": "words/xiaoxiao/conversational/ni3_hao3.mp3",
                    "f0ContourUnderlying": [2.1, 1.8, 1.4, 1.2, 1.1, 1.5, 2.3, 3.4, 4.0, 4.0, 2.1, 1.8, 1.4, 1.2, 1.1, 1.5, 2.3, 3.4, 4.0, 4.0, 2.1, 1.8, 1.4, 1.2, 1.1, 1.5, 2.3, 3.4, 4.0, 4.0],
                    "f0ContourSurface": [3.0, 3.2, 3.4, 3.7, 4.1, 4.5, 4.8, 5.0, 4.9, 4.8, 2.1, 1.8, 1.4, 1.2, 1.1, 1.3, 1.6, 2.2, 3.1, 4.0, 2.1, 1.8, 1.4, 1.2, 1.1, 1.3, 1.6, 2.2, 3.1, 4.0]
                },
                {
                    "id": "sandhi_keyi",
                    "hanzi": "可以",
                    "traditional": "可以",
                    "underlyingPinyin": "kě yǐ",
                    "surfacePinyin": "ké yǐ",
                    "underlyingTones": [3, 3],
                    "surfaceTones": "T2 (35) + T3 (214)",
                    "underlyingChao": "214 + 214",
                    "surfaceChao": "35 + 214",
                    "ipaSurface": "/kʰɤ˧˥ i˨˩˦/",
                    "meaningPt": "poder / ser possível",
                    "meaningEn": "can / may",
                    "explanationPt": "kě (3) + yǐ (3) torna-se ké yǐ (2+3).",
                    "explanationEn": "kě (3) + yǐ (3) becomes ké yǐ.",
                    "audioKeyClassroom": "words/xiaoxiao/classroom/ke3_yi3.mp3",
                    "audioKeyConversational": "words/xiaoxiao/conversational/ke3_yi3.mp3",
                    "f0ContourUnderlying": [2.0, 1.7, 1.3, 1.1, 1.0, 1.6, 2.5, 3.5, 4.0, 3.9, 2.0, 1.7, 1.3, 1.1, 1.0, 1.6, 2.5, 3.5, 4.0, 3.9, 2.0, 1.7, 1.3, 1.1, 1.0, 1.6, 2.5, 3.5, 4.0, 3.9],
                    "f0ContourSurface": [3.1, 3.3, 3.6, 4.0, 4.4, 4.7, 4.9, 5.0, 4.8, 4.5, 2.0, 1.7, 1.3, 1.1, 1.0, 1.4, 2.0, 2.8, 3.6, 4.0, 2.0, 1.7, 1.3, 1.1, 1.0, 1.4, 2.0, 2.8, 3.6, 4.0]
                },
                {
                    "id": "sandhi_shuiguo",
                    "hanzi": "水果",
                    "traditional": "水果",
                    "underlyingPinyin": "shuǐ guǒ",
                    "surfacePinyin": "shuí guǒ",
                    "underlyingTones": [3, 3],
                    "surfaceTones": "T2 (35) + T3 (214)",
                    "underlyingChao": "214 + 214",
                    "surfaceChao": "35 + 214",
                    "ipaSurface": "/ʂweɪ˧˥ kwɔ˨˩˦/",
                    "meaningPt": "fruta",
                    "meaningEn": "fruit",
                    "explanationPt": "shuǐ (3) + guǒ (3) torna-se shuí guǒ.",
                    "explanationEn": "shuǐ (3) + guǒ (3) becomes shuí guǒ.",
                    "audioKeyClassroom": "words/xiaoxiao/classroom/shui3_guo3.mp3",
                    "audioKeyConversational": "words/xiaoxiao/conversational/shui3_guo3.mp3",
                    "f0ContourUnderlying": [2.1, 1.8, 1.4, 1.1, 1.0, 1.5, 2.4, 3.5, 4.0, 3.9, 2.1, 1.8, 1.4, 1.1, 1.0, 1.5, 2.4, 3.5, 4.0, 3.9, 2.1, 1.8, 1.4, 1.1, 1.0, 1.5, 2.4, 3.5, 4.0, 3.9],
                    "f0ContourSurface": [3.0, 3.2, 3.5, 3.9, 4.3, 4.7, 4.9, 5.0, 4.8, 4.6, 2.1, 1.8, 1.3, 1.1, 1.0, 1.4, 2.1, 2.9, 3.7, 4.0, 2.1, 1.8, 1.3, 1.1, 1.0, 1.4, 2.1, 2.9, 3.7, 4.0]
                },
                {
                    "id": "sandhi_laohu",
                    "hanzi": "老虎",
                    "traditional": "老虎",
                    "underlyingPinyin": "lǎo hǔ",
                    "surfacePinyin": "láo hǔ",
                    "underlyingTones": [3, 3],
                    "surfaceTones": "T2 (35) + T3 (214)",
                    "underlyingChao": "214 + 214",
                    "surfaceChao": "35 + 214",
                    "ipaSurface": "/laʊ˧˥ xu˨˩˦/",
                    "meaningPt": "tigre",
                    "meaningEn": "tiger",
                    "explanationPt": "lǎo (3) + hǔ (3) vira láo hǔ.",
                    "explanationEn": "lǎo (3) + hǔ (3) becomes láo hǔ.",
                    "audioKeyClassroom": "words/xiaoxiao/classroom/lao3_hu3.mp3",
                    "audioKeyConversational": "words/xiaoxiao/conversational/lao3_hu3.mp3",
                    "f0ContourUnderlying": [2.1, 1.8, 1.4, 1.1, 1.0, 1.5, 2.4, 3.5, 4.0, 3.9, 2.1, 1.8, 1.4, 1.1, 1.0, 1.5, 2.4, 3.5, 4.0, 3.9, 2.1, 1.8, 1.4, 1.1, 1.0, 1.5, 2.4, 3.5, 4.0, 3.9],
                    "f0ContourSurface": [3.1, 3.3, 3.6, 4.0, 4.4, 4.8, 5.0, 4.9, 4.7, 4.5, 2.1, 1.7, 1.3, 1.1, 1.0, 1.4, 2.0, 2.9, 3.7, 4.0, 2.1, 1.7, 1.3, 1.1, 1.0, 1.4, 2.0, 2.9, 3.7, 4.0]
                },
                {
                    "id": "sandhi_shoubiao",
                    "hanzi": "手表",
                    "traditional": "手錶",
                    "underlyingPinyin": "shǒu biǎo",
                    "surfacePinyin": "shóu biǎo",
                    "underlyingTones": [3, 3],
                    "surfaceTones": "T2 (35) + T3 (214)",
                    "underlyingChao": "214 + 214",
                    "surfaceChao": "35 + 214",
                    "ipaSurface": "/ʂoʊ˧˥ bjaʊ˨˩˦/",
                    "meaningPt": "relógio de pulso",
                    "meaningEn": "wristwatch",
                    "explanationPt": "shǒu (3) + biǎo (3) soa shóu biǎo.",
                    "explanationEn": "shǒu (3) + biǎo (3) becomes shóu biǎo.",
                    "audioKeyClassroom": "words/xiaoxiao/classroom/shou3_biao3.mp3",
                    "audioKeyConversational": "words/xiaoxiao/conversational/shou3_biao3.mp3",
                    "f0ContourUnderlying": [2.0, 1.7, 1.3, 1.1, 1.0, 1.5, 2.4, 3.5, 4.0, 3.9, 2.0, 1.7, 1.3, 1.1, 1.0, 1.5, 2.4, 3.5, 4.0, 3.9, 2.0, 1.7, 1.3, 1.1, 1.0, 1.5, 2.4, 3.5, 4.0, 3.9],
                    "f0ContourSurface": [3.0, 3.3, 3.6, 4.0, 4.4, 4.8, 5.0, 4.9, 4.7, 4.4, 2.1, 1.7, 1.2, 1.0, 1.0, 1.4, 2.1, 2.9, 3.7, 4.0, 2.1, 1.7, 1.2, 1.0, 1.0, 1.4, 2.1, 2.9, 3.7, 4.0]
                }
            ]
        },
        {
            "id": "rule_half_t3",
            "titlePt": "半三声: Meio Terceiro Tom (Half-Third Tone [21] antes de T1, T2, T4 e Neutro)",
            "titleEn": "Half-Third Tone: Low Falling Pitch [21] before T1, T2, T4, and Neutral",
            "formula": "T3 (214) + [T1, T2, T4, T5] → Half-T3 (21) + [T1, T2, T4, T5]",
            "category": "half_third_tone",
            "summaryPt": "O 3º tom só sobe no final quando isolado ou no fim de uma frase! Antes de qualquer outro tom (exceto outro T3), ele apenas desce de 2 para 1 e NÃO sobe.",
            "summaryEn": "The third tone only completes its rising tail when spoken in isolation or at the end of a phrase. Before T1, T2, T4 or neutral, it simply drops from 2 to 1 without rising.",
            "acousticMechanicPt": "A subida final (1→4) do terceiro tom é acústicamente suprimida para conectar rapidamente à frequência fundamental do tom seguinte, reduzindo o esforço laríngeo.",
            "acousticMechanicEn": "The final rise (1->4) is truncated before non-third tones to bridge directly into the following tone's target pitch.",
            "examples": [
                {
                    "id": "half_t3_laoshi",
                    "hanzi": "老师",
                    "traditional": "老師",
                    "underlyingPinyin": "lǎo shī",
                    "surfacePinyin": "lǎo(半) shī",
                    "underlyingTones": [3, 1],
                    "surfaceTones": "Half-T3 (21) + T1 (55)",
                    "underlyingChao": "214 + 55",
                    "surfaceChao": "21 + 55",
                    "ipaSurface": "/laʊ˨˩ ʂʐ̩˥˥/",
                    "meaningPt": "professor / mestre",
                    "meaningEn": "teacher",
                    "explanationPt": "lǎo desce até 1 e salta imediatamente para o tom alto 5 de shī.",
                    "explanationEn": "lǎo drops to pitch 1 and leaps directly into the level high 5 of shī.",
                    "audioKeyClassroom": "words/xiaoxiao/classroom/lao3_shi1.mp3",
                    "audioKeyConversational": "words/xiaoxiao/conversational/lao3_shi1.mp3",
                    "f0ContourUnderlying": [2.2, 1.8, 1.4, 1.1, 1.0, 1.5, 2.3, 3.4, 4.0, 3.9, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0],
                    "f0ContourSurface": [2.2, 2.0, 1.8, 1.5, 1.3, 1.1, 1.0, 1.0, 1.0, 1.1, 4.9, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 4.9, 4.8, 4.9, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 4.9, 4.8]
                },
                {
                    "id": "half_t3_meiguo",
                    "hanzi": "美国",
                    "traditional": "美國",
                    "underlyingPinyin": "Měi guó",
                    "surfacePinyin": "Měi(半) guó",
                    "underlyingTones": [3, 2],
                    "surfaceTones": "Half-T3 (21) + T2 (35)",
                    "underlyingChao": "214 + 35",
                    "surfaceChao": "21 + 35",
                    "ipaSurface": "/meɪ˨˩ kwɔ˧˥/",
                    "meaningPt": "Estados Unidos / América",
                    "meaningEn": "United States",
                    "explanationPt": "Měi faz a descida baixa 21 e guó sobe de 3 para 5.",
                    "explanationEn": "Měi executes low drop 21, and guó rises from 3 to 5.",
                    "audioKeyClassroom": "words/xiaoxiao/classroom/mei3_guo2.mp3",
                    "audioKeyConversational": "words/xiaoxiao/conversational/mei3_guo2.mp3",
                    "f0ContourUnderlying": [2.2, 1.8, 1.4, 1.1, 1.0, 1.5, 2.3, 3.4, 4.0, 3.9, 3.1, 3.3, 3.6, 4.0, 4.4, 4.7, 4.9, 5.0, 4.9, 4.8, 3.1, 3.3, 3.6, 4.0, 4.4, 4.7, 4.9, 5.0, 4.9, 4.8],
                    "f0ContourSurface": [2.2, 1.9, 1.6, 1.4, 1.2, 1.1, 1.0, 1.0, 1.0, 1.1, 3.0, 3.2, 3.5, 3.9, 4.3, 4.6, 4.9, 5.0, 4.9, 4.7, 3.0, 3.2, 3.5, 3.9, 4.3, 4.6, 4.9, 5.0, 4.9, 4.7]
                },
                {
                    "id": "half_t3_xihuan",
                    "hanzi": "喜欢",
                    "traditional": "喜歡",
                    "underlyingPinyin": "xǐ huan",
                    "surfacePinyin": "xǐ(半) huan",
                    "underlyingTones": [3, 5],
                    "surfaceTones": "Half-T3 (21) + Neutro (4)",
                    "underlyingChao": "214 + 2",
                    "surfaceChao": "21 + 4",
                    "ipaSurface": "/ɕi˨˩ xwan/",
                    "meaningPt": "gostar de",
                    "meaningEn": "to like",
                    "explanationPt": "xǐ fica na base grave e huan soa no tom neutro médio-alto (4).",
                    "explanationEn": "xǐ stays at lowest pitch, huan sounds at mid-high neutral pitch (4).",
                    "audioKeyClassroom": "words/xiaoxiao/classroom/xi3_huan5.mp3",
                    "audioKeyConversational": "words/xiaoxiao/conversational/xi3_huan5.mp3",
                    "f0ContourUnderlying": [2.2, 1.8, 1.3, 1.0, 1.0, 1.6, 2.4, 3.4, 4.0, 3.8, 2.2, 2.1, 2.0, 1.9, 1.8, 1.7, 1.6, 1.5, 1.4, 1.3, 2.2, 2.1, 2.0, 1.9, 1.8, 1.7, 1.6, 1.5, 1.4, 1.3],
                    "f0ContourSurface": [2.1, 1.8, 1.5, 1.3, 1.1, 1.0, 1.0, 1.0, 1.0, 1.1, 3.8, 3.6, 3.4, 3.1, 2.8, 2.5, 2.2, 2.0, 1.8, 1.6, 3.8, 3.6, 3.4, 3.1, 2.8, 2.5, 2.2, 2.0, 1.8, 1.6]
                }
            ]
        },
        {
            "id": "rule_triple_t3",
            "titlePt": "三三连读: Cadeias de Três Terceiros Tons (T3 + T3 + T3)",
            "titleEn": "Triple Third Tone Sequences (T3 + T3 + T3)",
            "formula": "T3 + T3 + T3 → (T2 + T2 + T3) ou (T3 + T2 + T3) segundo agrupamento sintático",
            "category": "triple_third_tone",
            "summaryPt": "Em sequências de três 3ºs tons, o padrão depende da estrutura gramatical: [2+1] (ex: 展览馆 -> zhán lán guǎn) gera T2+T2+T3; [1+2] (ex: 我也想 -> wǒ yé xiǎng) gera T3(meio)+T2+T3.",
            "summaryEn": "In 3-syllable third-tone chains, syntax determines sandhi: left-branching [2+1] yields T2+T2+T3; right-branching [1+2] yields Half-T3+T2+T3.",
            "acousticMechanicPt": "O agrupamento prosódico dita os domínios de sandhi. Sílabas dentro do mesmo pé métrico (metrical foot) sofrem sandhi primeiro.",
            "acousticMechanicEn": "Prosodic phrasing determines sandhi domains: syllables bound within the same lexical foot assimilate tone first.",
            "examples": [
                {
                    "id": "triple_zhanlanguan",
                    "hanzi": "展览馆",
                    "traditional": "展覽館",
                    "underlyingPinyin": "zhǎn lǎn guǎn",
                    "surfacePinyin": "zhán lán guǎn",
                    "underlyingTones": [3, 3, 3],
                    "surfaceTones": "T2 (35) + T2 (35) + T3 (214)",
                    "underlyingChao": "214 + 214 + 214",
                    "surfaceChao": "35 + 35 + 214",
                    "ipaSurface": "/ʈʂan˧˥ lan˧˥ kwan˨˩˦/",
                    "meaningPt": "galeria de exposições",
                    "meaningEn": "exhibition hall",
                    "explanationPt": "[展览] + [馆] (estrutura 2+1): zhǎn lǎn vira zhán lán, e guǎn mantém T3.",
                    "explanationEn": "[展览] + [馆] (2+1 structure): zhǎn lǎn assimilates to zhán lán, guǎn stays T3.",
                    "audioKeyClassroom": "words/xiaoxiao/classroom/zhan3_lan3_guan3.mp3",
                    "audioKeyConversational": "words/xiaoxiao/conversational/zhan3_lan3_guan3.mp3",
                    "f0ContourUnderlying": [2.0, 1.4, 1.0, 2.5, 4.0, 2.0, 1.4, 1.0, 2.5, 4.0, 2.0, 1.4, 1.0, 2.5, 4.0, 2.0, 1.4, 1.0, 2.5, 4.0, 2.0, 1.4, 1.0, 2.5, 4.0, 2.0, 1.4, 1.0, 2.5, 4.0],
                    "f0ContourSurface": [3.0, 3.4, 3.9, 4.5, 4.9, 3.1, 3.5, 4.0, 4.6, 5.0, 2.1, 1.6, 1.1, 1.0, 1.4, 2.2, 3.2, 4.0, 3.8, 3.5, 2.1, 1.6, 1.1, 1.0, 1.4, 2.2, 3.2, 4.0, 3.8, 3.5]
                },
                {
                    "id": "triple_woyexiang",
                    "hanzi": "我也想",
                    "traditional": "我也想",
                    "underlyingPinyin": "wǒ yě xiǎng",
                    "surfacePinyin": "wǒ(半) yé xiǎng",
                    "underlyingTones": [3, 3, 3],
                    "surfaceTones": "Half-T3 (21) + T2 (35) + T3 (214)",
                    "underlyingChao": "214 + 214 + 214",
                    "surfaceChao": "21 + 35 + 214",
                    "ipaSurface": "/wɔ˨˩ jɛ˧˥ ɕjaŋ˨˩˦/",
                    "meaningPt": "eu também quero / também acho",
                    "meaningEn": "I also want to",
                    "explanationPt": "[我] + [也想] (estrutura 1+2): wǒ faz meio tom 3, e yě xiǎng faz T2+T3.",
                    "explanationEn": "[我] + [也想] (1+2 structure): wǒ stays low, yě assimilates to T2 before xiǎng.",
                    "audioKeyClassroom": "words/xiaoxiao/classroom/wo3_ye3_xiang3.mp3",
                    "audioKeyConversational": "words/xiaoxiao/conversational/wo3_ye3_xiang3.mp3",
                    "f0ContourUnderlying": [2.0, 1.4, 1.0, 2.5, 4.0, 2.0, 1.4, 1.0, 2.5, 4.0, 2.0, 1.4, 1.0, 2.5, 4.0, 2.0, 1.4, 1.0, 2.5, 4.0, 2.0, 1.4, 1.0, 2.5, 4.0, 2.0, 1.4, 1.0, 2.5, 4.0],
                    "f0ContourSurface": [2.1, 1.8, 1.4, 1.1, 1.0, 3.1, 3.5, 4.0, 4.6, 5.0, 2.1, 1.6, 1.1, 1.0, 1.4, 2.2, 3.2, 4.0, 3.8, 3.5, 2.1, 1.6, 1.1, 1.0, 1.4, 2.2, 3.2, 4.0, 3.8, 3.5]
                }
            ]
        },
        {
            "id": "rule_bu_sandhi",
            "titlePt": "“不”的变调: Sandhi da Partícula Negativa “不” (bù → bú antes de T4)",
            "titleEn": "Tone Sandhi of “不” (bù → bú before Fourth Tone)",
            "formula": "不 bù (51) + T4 (51) → bú (35) + T4 (51)",
            "category": "bu_sandhi",
            "summaryPt": "O caractere “不” tem tom canônico de 4º Tom (bù [51]). Mas antes de outro 4º Tom, muda obrigatoriamente para o 2º Tom ascendente (bú [35]).",
            "summaryEn": "The negative marker “不” is inherently 4th tone (bù [51]). When followed by another 4th tone, it changes into a 2nd tone (bú [35]).",
            "acousticMechanicPt": "Evita o choque abrupto de duas quedas fortes consecutivas [51 + 51] na laringe, transformando a primeira em rampa ascendente suave [35].",
            "acousticMechanicEn": "Prevents two harsh successive pitch drops [51 + 51] by converting the first into a smooth rising slope [35].",
            "examples": [
                {
                    "id": "bu_bushi",
                    "hanzi": "不是",
                    "traditional": "不是",
                    "underlyingPinyin": "bù shì",
                    "surfacePinyin": "bú shì",
                    "underlyingTones": [4, 4],
                    "surfaceTones": "T2 (35) + T4 (51)",
                    "underlyingChao": "51 + 51",
                    "surfaceChao": "35 + 51",
                    "ipaSurface": "/pu˧˥ ʂʐ̩˥˩/",
                    "meaningPt": "não ser / não é",
                    "meaningEn": "is not / no",
                    "explanationPt": "bù + shì (ambos 4º tom) transforma-se em bú shì.",
                    "explanationEn": "bù + shì (both 4th tone) becomes bú shì.",
                    "audioKeyClassroom": "words/xiaoxiao/classroom/bu4_shi4.mp3",
                    "audioKeyConversational": "words/xiaoxiao/conversational/bu4_shi4.mp3",
                    "f0ContourUnderlying": [5.0, 4.5, 3.8, 2.9, 1.8, 1.2, 1.0, 5.0, 4.5, 3.8, 2.9, 1.8, 1.2, 1.0, 5.0, 4.5, 3.8, 2.9, 1.8, 1.2, 1.0, 5.0, 4.5, 3.8, 2.9, 1.8, 1.2, 1.0, 5.0, 4.5],
                    "f0ContourSurface": [3.0, 3.2, 3.6, 4.0, 4.4, 4.8, 5.0, 4.9, 4.8, 5.0, 4.6, 4.0, 3.2, 2.4, 1.7, 1.2, 1.0, 1.0, 1.0, 1.0, 5.0, 4.6, 4.0, 3.2, 2.4, 1.7, 1.2, 1.0, 1.0, 1.0]
                },
                {
                    "id": "bu_buqu",
                    "hanzi": "不去",
                    "traditional": "不去",
                    "underlyingPinyin": "bù qù",
                    "surfacePinyin": "bú qù",
                    "underlyingTones": [4, 4],
                    "surfaceTones": "T2 (35) + T4 (51)",
                    "underlyingChao": "51 + 51",
                    "surfaceChao": "35 + 51",
                    "ipaSurface": "/pu˧˥ tɕʰy˥˩/",
                    "meaningPt": "não ir",
                    "meaningEn": "not going",
                    "explanationPt": "qù é 4º tom, logo bù vira bú.",
                    "explanationEn": "qù is 4th tone, so bù becomes bú.",
                    "audioKeyClassroom": "words/xiaoxiao/classroom/bu4_qu4.mp3",
                    "audioKeyConversational": "words/xiaoxiao/conversational/bu4_qu4.mp3",
                    "f0ContourUnderlying": [5.0, 4.5, 3.8, 2.9, 1.8, 1.2, 1.0, 5.0, 4.5, 3.8, 2.9, 1.8, 1.2, 1.0, 5.0, 4.5, 3.8, 2.9, 1.8, 1.2, 1.0, 5.0, 4.5, 3.8, 2.9, 1.8, 1.2, 1.0, 5.0, 4.5],
                    "f0ContourSurface": [3.0, 3.3, 3.7, 4.1, 4.5, 4.9, 5.0, 4.9, 4.8, 5.0, 4.6, 4.0, 3.2, 2.3, 1.6, 1.2, 1.0, 1.0, 1.0, 1.0, 5.0, 4.6, 4.0, 3.2, 2.3, 1.6, 1.2, 1.0, 1.0, 1.0]
                },
                {
                    "id": "bu_buchi",
                    "hanzi": "不吃",
                    "traditional": "不吃",
                    "underlyingPinyin": "bù chī",
                    "surfacePinyin": "bù chī",
                    "underlyingTones": [4, 1],
                    "surfaceTones": "T4 (51) + T1 (55)",
                    "underlyingChao": "51 + 55",
                    "surfaceChao": "51 + 55",
                    "ipaSurface": "/pu˥˩ ʈʂʰʐ̩˥˥/",
                    "meaningPt": "não comer",
                    "meaningEn": "not eat",
                    "explanationPt": "chī é 1º tom, logo bù MANTÉM seu 4º tom original [51].",
                    "explanationEn": "chī is 1st tone, so bù preserves its underlying 4th tone [51].",
                    "audioKeyClassroom": "words/xiaoxiao/classroom/bu4_chi1.mp3",
                    "audioKeyConversational": "words/xiaoxiao/conversational/bu4_chi1.mp3",
                    "f0ContourUnderlying": [5.0, 4.5, 3.8, 2.9, 1.8, 1.2, 1.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0],
                    "f0ContourSurface": [5.0, 4.6, 4.0, 3.2, 2.4, 1.6, 1.2, 1.0, 1.0, 4.9, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 4.9, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 4.9]
                }
            ]
        },
        {
            "id": "rule_yi_sandhi",
            "titlePt": "“一”的变调: Sandhi do Numeral “一” (yī → yí antes de T4; yì antes de T1, T2, T3)",
            "titleEn": "Tone Sandhi of “一” (yī → yí before T4; yì before T1, T2, T3)",
            "formula": "一 (yī [55]) → yí (35) antes de T4 | yì (51) antes de T1, T2, T3 | yī (55) isolado / ordinal",
            "category": "yi_sandhi",
            "summaryPt": "O número '1' é originalmente 1º Tom (yī). Antes de um 4º Tom vira 2º Tom (yí). Antes de 1º, 2º ou 3º Tom vira 4º Tom (yì). Só soa yī ao contar ou em ordinais (第一).",
            "summaryEn": "The numeral '1' is inherently 1st tone (yī). Before 4th tone it becomes 2nd tone (yí). Before 1st, 2nd, or 3rd tones it becomes 4th tone (yì).",
            "acousticMechanicPt": "O numeral mais frequente da língua equilibra dinamicamente a melodia oracional criando contraste tonal oposto com a sílaba seguinte.",
            "acousticMechanicEn": "Maximizes acoustic salience by polarity switching against the pitch contour of the adjacent syllable.",
            "examples": [
                {
                    "id": "yi_yige",
                    "hanzi": "一个",
                    "traditional": "一個",
                    "underlyingPinyin": "yī gè",
                    "surfacePinyin": "yí gè",
                    "underlyingTones": [1, 4],
                    "surfaceTones": "T2 (35) + T4 (51)",
                    "underlyingChao": "55 + 51",
                    "surfaceChao": "35 + 51",
                    "ipaSurface": "/i˧˥ kɤ˥˩/",
                    "meaningPt": "um / uma unidade",
                    "meaningEn": "one / a piece",
                    "explanationPt": "gè é 4º tom, logo yī vira yí (2º tom).",
                    "explanationEn": "gè is 4th tone, so yī becomes yí (2nd tone).",
                    "audioKeyClassroom": "words/xiaoxiao/classroom/yi1_ge4.mp3",
                    "audioKeyConversational": "words/xiaoxiao/conversational/yi1_ge4.mp3",
                    "f0ContourUnderlying": [5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 4.4, 3.6, 2.7, 1.8, 1.2, 1.0, 1.0, 1.0, 1.0, 5.0, 4.4, 3.6, 2.7, 1.8, 1.2, 1.0, 1.0, 1.0, 1.0],
                    "f0ContourSurface": [3.1, 3.4, 3.8, 4.2, 4.6, 4.9, 5.0, 4.9, 4.8, 5.0, 4.5, 3.8, 3.0, 2.1, 1.5, 1.1, 1.0, 1.0, 1.0, 1.0, 5.0, 4.5, 3.8, 3.0, 2.1, 1.5, 1.1, 1.0, 1.0, 1.0]
                },
                {
                    "id": "yi_yiban",
                    "hanzi": "一般",
                    "traditional": "一般",
                    "underlyingPinyin": "yī bān",
                    "surfacePinyin": "yì bān",
                    "underlyingTones": [1, 1],
                    "surfaceTones": "T4 (51) + T1 (55)",
                    "underlyingChao": "55 + 55",
                    "surfaceChao": "51 + 55",
                    "ipaSurface": "/i˥˩ pan˥˥/",
                    "meaningPt": "comum / geralmente",
                    "meaningEn": "general / ordinary",
                    "explanationPt": "bān é 1º tom, logo yī vira yì (4º tom descendente).",
                    "explanationEn": "bān is 1st tone, so yī becomes yì (4th tone falling).",
                    "audioKeyClassroom": "words/xiaoxiao/classroom/yi1_ban1.mp3",
                    "audioKeyConversational": "words/xiaoxiao/conversational/yi1_ban1.mp3",
                    "f0ContourUnderlying": [5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0],
                    "f0ContourSurface": [5.0, 4.6, 4.1, 3.3, 2.5, 1.7, 1.2, 1.0, 1.0, 4.9, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 4.9, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 4.9]
                },
                {
                    "id": "yi_yiqi",
                    "hanzi": "一起",
                    "traditional": "一起",
                    "underlyingPinyin": "yī qǐ",
                    "surfacePinyin": "yì qǐ",
                    "underlyingTones": [1, 3],
                    "surfaceTones": "T4 (51) + T3 (214)",
                    "underlyingChao": "55 + 214",
                    "surfaceChao": "51 + 214",
                    "ipaSurface": "/i˥˩ tɕʰi˨˩˦/",
                    "meaningPt": "juntos",
                    "meaningEn": "together",
                    "explanationPt": "qǐ é 3º tom, logo yī vira yì (4º tom).",
                    "explanationEn": "qǐ is 3rd tone, so yī becomes yì (4th tone).",
                    "audioKeyClassroom": "words/xiaoxiao/classroom/yi1_qi3.mp3",
                    "audioKeyConversational": "words/xiaoxiao/conversational/yi1_qi3.mp3",
                    "f0ContourUnderlying": [5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 2.1, 1.7, 1.3, 1.1, 1.0, 1.4, 2.1, 2.9, 3.7, 4.0, 2.1, 1.7, 1.3, 1.1, 1.0, 1.4, 2.1, 2.9, 3.7, 4.0],
                    "f0ContourSurface": [5.0, 4.6, 4.1, 3.3, 2.4, 1.6, 1.1, 1.0, 1.0, 2.1, 1.7, 1.3, 1.1, 1.0, 1.4, 2.1, 2.9, 3.7, 4.0, 3.8, 2.1, 1.7, 1.3, 1.1, 1.0, 1.4, 2.1, 2.9, 3.7, 4.0]
                }
            ]
        },
        {
            "id": "rule_neutral_tone",
            "titlePt": "轻声音高: Altura Acústica do Tom Neutro (轻声) conforme o Tom Precedente",
            "titleEn": "Acoustic Pitch Level of the Neutral Tone according to Preceding Tone",
            "formula": "T1 + Neutro → [55 + 2] | T2 + Neutro → [35 + 3] | T3 + Neutro → [21 + 4] | T4 + Neutro → [51 + 1]",
            "category": "neutral_tone",
            "summaryPt": "O Tom Neutro NÃO tem altura fixa! Sua altura relativa varia previsivelmente conforme a física acústica do tom anterior: após T1 é baixo [2], após T2 é médio [3], após T3 é o mais alto [4], e após T4 é o mais baixo [1].",
            "summaryEn": "The Neutral tone has no static pitch contour! Its pitch is conditioned by the offset of the previous tone: after T1 it's low [2], after T2 mid [3], after T3 high [4], and after T4 lowest [1].",
            "acousticMechanicPt": "O tom neutro é curto e desprovido de estresse léxico; as cordas vocais relaxam após o esforço do tom anterior, descendo naturalmente por inércia.",
            "acousticMechanicEn": "Neutral tone lacks lexical stress; vocal folds relax following preceding target pitch, falling according to mechanical inertia.",
            "examples": [
                {
                    "id": "neutral_mama",
                    "hanzi": "妈妈",
                    "traditional": "媽媽",
                    "underlyingPinyin": "mā ma",
                    "surfacePinyin": "mā ma",
                    "underlyingTones": [1, 5],
                    "surfaceTones": "T1 (55) + Neutro Baixo (2)",
                    "underlyingChao": "55 + 2",
                    "surfaceChao": "55 + 2",
                    "ipaSurface": "/ma˥˥ ma/",
                    "meaningPt": "mãe / mamãe",
                    "meaningEn": "mother / mom",
                    "explanationPt": "Após o 1º tom alto [55], o tom neutro soa como um eco baixo no tom 2.",
                    "explanationEn": "After high tone 1 [55], the neutral syllable drops like a low echo at level 2.",
                    "audioKeyClassroom": "words/xiaoxiao/classroom/ma1_ma5.mp3",
                    "audioKeyConversational": "words/xiaoxiao/conversational/ma1_ma5.mp3",
                    "f0ContourUnderlying": [5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 2.2, 2.1, 2.0, 1.9, 1.8, 1.7, 1.6, 1.5, 1.4, 1.3, 2.2, 2.1, 2.0, 1.9, 1.8, 1.7, 1.6, 1.5, 1.4, 1.3],
                    "f0ContourSurface": [5.0, 5.0, 5.0, 5.0, 5.0, 4.9, 4.8, 4.7, 4.5, 2.2, 2.1, 2.0, 1.9, 1.8, 1.7, 1.6, 1.5, 1.4, 1.3, 1.2, 2.2, 2.1, 2.0, 1.9, 1.8, 1.7, 1.6, 1.5, 1.4, 1.3]
                },
                {
                    "id": "neutral_yeye",
                    "hanzi": "爷爷",
                    "traditional": "爺爺",
                    "underlyingPinyin": "yé ye",
                    "surfacePinyin": "yé ye",
                    "underlyingTones": [2, 5],
                    "surfaceTones": "T2 (35) + Neutro Médio (3)",
                    "underlyingChao": "35 + 3",
                    "surfaceChao": "35 + 3",
                    "ipaSurface": "/jɛ˧˥ jɛ/",
                    "meaningPt": "avô paterno",
                    "meaningEn": "grandfather (paternal)",
                    "explanationPt": "Após o 2º tom ascendente [35], o tom neutro cai para a metade da escala [3].",
                    "explanationEn": "After rising tone 2 [35], the neutral syllable settles at mid pitch [3].",
                    "audioKeyClassroom": "words/xiaoxiao/classroom/ye2_ye5.mp3",
                    "audioKeyConversational": "words/xiaoxiao/conversational/ye2_ye5.mp3",
                    "f0ContourUnderlying": [3.1, 3.4, 3.8, 4.2, 4.6, 4.9, 5.0, 4.9, 4.8, 4.7, 3.0, 2.8, 2.6, 2.4, 2.2, 2.0, 1.8, 1.6, 1.5, 1.4, 3.0, 2.8, 2.6, 2.4, 2.2, 2.0, 1.8, 1.6, 1.5, 1.4],
                    "f0ContourSurface": [3.1, 3.4, 3.8, 4.2, 4.6, 4.9, 5.0, 4.9, 4.8, 3.2, 3.0, 2.8, 2.6, 2.4, 2.2, 2.0, 1.8, 1.6, 1.5, 1.4, 3.0, 2.8, 2.6, 2.4, 2.2, 2.0, 1.8, 1.6, 1.5, 1.4]
                },
                {
                    "id": "neutral_nainai",
                    "hanzi": "奶奶",
                    "traditional": "奶奶",
                    "underlyingPinyin": "nǎi nai",
                    "surfacePinyin": "nǎi(半) nai",
                    "underlyingTones": [3, 5],
                    "surfaceTones": "Half-T3 (21) + Neutro Alto (4)",
                    "underlyingChao": "21 + 4",
                    "surfaceChao": "21 + 4",
                    "ipaSurface": "/naɪ˨˩ naɪ/",
                    "meaningPt": "avó paterna",
                    "meaningEn": "grandmother (paternal)",
                    "explanationPt": "Após o 3º tom baixo [21], o tom neutro soa surpreendentemente alto no tom 4!",
                    "explanationEn": "After low 3rd tone [21], the neutral syllable rebounds surprisingly high at pitch 4!",
                    "audioKeyClassroom": "words/xiaoxiao/classroom/nai3_nai5.mp3",
                    "audioKeyConversational": "words/xiaoxiao/conversational/nai3_nai5.mp3",
                    "f0ContourUnderlying": [2.2, 1.8, 1.4, 1.1, 1.0, 1.0, 1.0, 1.0, 1.1, 1.2, 4.0, 3.8, 3.5, 3.2, 2.9, 2.5, 2.2, 2.0, 1.8, 1.6, 4.0, 3.8, 3.5, 3.2, 2.9, 2.5, 2.2, 2.0, 1.8, 1.6],
                    "f0ContourSurface": [2.2, 1.8, 1.4, 1.1, 1.0, 1.0, 1.0, 1.0, 1.1, 1.2, 4.0, 3.8, 3.5, 3.2, 2.8, 2.5, 2.2, 1.9, 1.7, 1.5, 4.0, 3.8, 3.5, 3.2, 2.8, 2.5, 2.2, 1.9, 1.7, 1.5]
                },
                {
                    "id": "neutral_baba",
                    "hanzi": "爸爸",
                    "traditional": "爸爸",
                    "underlyingPinyin": "bà ba",
                    "surfacePinyin": "bà ba",
                    "underlyingTones": [4, 5],
                    "surfaceTones": "T4 (51) + Neutro Mais Baixo (1)",
                    "underlyingChao": "51 + 1",
                    "surfaceChao": "51 + 1",
                    "ipaSurface": "/pa˥˩ pa/",
                    "meaningPt": "pai / papai",
                    "meaningEn": "father / dad",
                    "explanationPt": "Após o tom 4 cair abruptamente até 1, o tom neutro permanece no piso mais baixo [1].",
                    "explanationEn": "After 4th tone crashes to 1, the neutral tone stays at the absolute bottom floor [1].",
                    "audioKeyClassroom": "words/xiaoxiao/classroom/ba4_ba5.mp3",
                    "audioKeyConversational": "words/xiaoxiao/conversational/ba4_ba5.mp3",
                    "f0ContourUnderlying": [5.0, 4.6, 4.0, 3.2, 2.3, 1.6, 1.2, 1.0, 1.0, 1.0, 1.3, 1.2, 1.1, 1.1, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.3, 1.2, 1.1, 1.1, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
                    "f0ContourSurface": [5.0, 4.6, 4.0, 3.2, 2.3, 1.6, 1.2, 1.0, 1.0, 1.0, 1.4, 1.3, 1.2, 1.1, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.4, 1.3, 1.2, 1.1, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0]
                }
            ]
        }
    ]

    out_path = os.path.join(PUBLIC_DATA_DIR, "tone_sandhi.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(rules, f, ensure_ascii=False, indent=2)
    print(f"[build_dataset] tone_sandhi.json salvo com {len(rules)} regras completas e seus exemplos.")

def build_sound_guides():
    print("[build_dataset] Gerando sound_guides_pt.json...")
    guides = [
        {
            "id": "guide_tones",
            "slug": "tones_overview",
            "category": "tones",
            "titlePt": "A Arquitetura dos 4 Tons e do Tom Neutro",
            "titleEn": "Architecture of the 4 Tones and Neutral Tone",
            "subtitlePt": "Como dominar as alturas Chao (1–5) e evitar a entonação interrogativa do Português",
            "subtitleEn": "Master Chao pitch levels (1–5) and avoid English/Portuguese question intonation bias",
            "ipaSymbols": ["/˥˥/", "/˧˥/", "/˨˩˦/", "/˥˩/", "/·/"],
            "chaoNotation": ["55", "35", "214", "51", "2"],
            "tonguePositionPt": "Os tons são gerados pela tensão e relaxamento das pregas vocais na laringe, não pela posição da língua! O Tom 1 exige pregas esticadas no registro agudo estável (55); o Tom 2 uma rampa ascendente constante (35); o Tom 3 relaxamento máximo até o registro basal (214/21); o Tom 4 um comando de término brusco (51).",
            "tonguePositionEn": "Tones are regulated strictly by vocal fold tension in the larynx, not tongue position. Tone 1 requires high sustained tension (55); Tone 2 continuous rise (35); Tone 3 lowest possible vocal register (214/21); Tone 4 abrupt dropping release (51).",
            "brazilianTrapPt": "A Maior Armadilha Brasileira: Em português, subimos o tom apenas para fazer perguntas ('Você vai?'). Por isso, lusófonos tendem a hesitar ou 'perguntar' sempre que tentam fazer o 2º tom (35). Além disso, falantes de português confundem a descida do 4º tom com estresse de raiva ou exclamação, quando na verdade é apenas uma descida curta e limpa.",
            "brazilianTrapEn": "Portuguese/English speakers instinctively associate rising pitch with questions. In Mandarin, Tone 2 (35) is an affirmative lexical tone. Tone 4 (51) is often mistaken for shouting rather than a controlled downward pitch glide.",
            "paperTestOrTrickPt": "O Truque do Dó-Ré-Mi: Imagine uma escala musical de 5 notas: 1 (grave), 3 (médio), 5 (agudo). O Tom 1 é sustentar a nota 5 ('lááá'). O Tom 2 é deslizar de 3 para 5 (como quem diz 'hã?!'). O Tom 3 é a voz de bocejo grave (nota 1). O Tom 4 é como dizer 'Não!' resoluto da nota 5 direto para a nota 1.",
            "paperTestOrTrickEn": "The 5-Step Musical Scale Trick: Step 5 is high pitch, step 1 is lowest bass. T1 sustains note 5; T2 glides 3->5 like 'Huh?!'; T3 hits bottom register note 1; T4 drops sharply from 5 to 1 like a definitive 'No!'.",
            "svgDiagramType": "pitch_chao_5",
            "keyPairsIds": ["pair_m_tone_1_4", "pair_m_tone_2_3", "pair_m_tone_1_2"],
            "demoSyllables": [
                {"label": "1º Tom (55)", "hanzi": "妈", "pinyin": "mā", "ipa": "/ma˥˥/", "audioKey": "syllables/human_female/ma1.mp3"},
                {"label": "2º Tom (35)", "hanzi": "麻", "pinyin": "má", "ipa": "/ma˧˥/", "audioKey": "syllables/human_female/ma2.mp3"},
                {"label": "3º Tom (214)", "hanzi": "马", "pinyin": "mǎ", "ipa": "/ma˨˩˦/", "audioKey": "syllables/human_female/ma3.mp3"},
                {"label": "4º Tom (51)", "hanzi": "骂", "pinyin": "mà", "ipa": "/ma˥˩/", "audioKey": "syllables/human_female/ma4.mp3"}
            ]
        },
        {
            "id": "guide_aspiration",
            "slug": "aspiration_contrast",
            "category": "aspiration",
            "titlePt": "Oclusivas e Africadas: O Contraste Crítico de Aspiração",
            "titleEn": "Stops and Affricates: The Crucial Aspiration Contrast",
            "subtitlePt": "Por que o 'b' chinês parece 'p' e o 'p' chinês solta um sopro explosivo",
            "subtitleEn": "Why Chinese 'b' sounds like 'p' and Chinese 'p' emits an explosive puff",
            "ipaSymbols": ["/p/", "/pʰ/", "/t/", "/tʰ/", "/k/", "/kʰ/", "/ts/", "/tsʰ/", "/ʈʂ/", "/ʈʂʰ/", "/tɕ/", "/tɕʰ/"],
            "tonguePositionPt": "No Mandarim Padrão, a oposição fonológica NÃO é sonora vs surda (como em português: bola vs pola). Todas as oclusivas iniciais chinesas são SURDAS (sem vibração de cordas vocais no início). A diferença é o Voice Onset Time (VOT): 'b, d, g' não soltam ar (/p, t, k/), enquanto 'p, t, k' liberam uma forte rajada de ar pós-soltura (/pʰ, tʰ, kʰ/).",
            "tonguePositionEn": "In Putonghua, phonological opposition is not voiced vs voiceless. All initial stops are voiceless; the contrast lies entirely in aspiration (VOT). Unaspirated (b, d, g) release zero air; aspirated (p, t, k) release an intense burst.",
            "brazilianTrapPt": "A Armadilha do 'B' e 'D' Sonoros: Brasileiros tendem a vibrar as cordas vocais logo no início ao falar 'b' e 'd' (como em 'bom' e 'dia'). Em chinês, se você disser 'bā' com as cordas vibrando antes da soltura labial, soará estrangeiro. Deve ser uma soltura seca de lábios sem sopro e sem vibração precoce.",
            "brazilianTrapEn": "Speakers of Romance languages voice initial 'b' and 'd' immediately. In Mandarin, 'b' is completely voiceless unaspirated [p], while 'p' is heavily aspirated [pʰ].",
            "paperTestOrTrickPt": "O Teste da Folha de Papel (Tissue Test): Segure uma folha fina de papel sulfite ou papel higiênico a 5 cm da boca. Ao dizer 'bā' (八), a folha NÃO DEVE SE MOVER em absoluto. Ao dizer 'pā' (趴), a folha DEVE DOBRAR COM FORÇA para frente pelo sopro de ar!",
            "paperTestOrTrickEn": "The Tissue Paper Test: Hold a sheet of paper 5cm from your lips. Pronouncing 'bā' (八) must NOT move the paper at all. Pronouncing 'pā' (趴) must vigorously blow the sheet forward!",
            "svgDiagramType": "sagittal_bilabial_aspiration",
            "keyPairsIds": ["pair_asp_b_p_ba", "pair_asp_d_t_da", "pair_asp_g_k_ge"],
            "demoSyllables": [
                {"label": "Não-aspirado (b)", "hanzi": "八", "pinyin": "bā", "ipa": "/pa˥˥/", "audioKey": "syllables/human_female/ba1.mp3"},
                {"label": "Aspirado (p)", "hanzi": "趴", "pinyin": "pā", "ipa": "/pʰa˥˥/", "audioKey": "syllables/human_female/pa1.mp3"},
                {"label": "Não-aspirado (d)", "hanzi": "答", "pinyin": "dā", "ipa": "/ta˥˥/", "audioKey": "syllables/human_female/da1.mp3"},
                {"label": "Aspirado (t)", "hanzi": "他", "pinyin": "tā", "ipa": "/tʰa˥˥/", "audioKey": "syllables/human_female/ta1.mp3"}
            ]
        },
        {
            "id": "guide_retroflex_palatal",
            "slug": "retroflex_palatal_dental",
            "category": "retroflex_palatal_dental",
            "titlePt": "As Três Séries Sibilantes: Dentais (z/c/s), Retroflexas (zh/ch/sh/r) e Palatais (j/q/x)",
            "titleEn": "The 3 Sibilant Series: Dentals (z/c/s), Retroflex (zh/ch/sh/r), Palatals (j/q/x)",
            "subtitlePt": "Domine a ponta curvada para trás (舌尖后音) e o dorso elevado (舌面前音)",
            "subtitleEn": "Master tongue tip curled back (retroflex) versus flattened tongue blade (alveolo-palatal)",
            "ipaSymbols": ["/ts/", "/tsʰ/", "/s/", "/ʈʂ/", "/ʈʂʰ/", "/ʂ/", "/ʐ/", "/tɕ/", "/tɕʰ/", "/ɕ/"],
            "tonguePositionPt": "1) Dentais (z, c, s): A ponta da língua toca os dentes incisivos superiores/alvéolos anteriores.\n2) Retroflexas (zh, ch, sh, r): A ponta da língua curva-se para cima e para trás, tocando a transição entre os alvéolos e o palato duro. Os lábios ficam levemente projetados.\n3) Alvéolo-palatais (j, q, x): A ponta da língua fica ABAIXO, atrás dos dentes inferiores, enquanto o CORPO/DORSO da língua sobe plano contra o céu da boca anterior.",
            "tonguePositionEn": "1) Dentals (z, c, s): Tip at upper teeth/alveolar ridge.\n2) Retroflex (zh, ch, sh, r): Tip curled upward and back against hard palate ridge.\n3) Alveolo-palatals (j, q, x): Tip rests DOWN behind lower incisors while tongue body arches flatly against the hard palate.",
            "brazilianTrapPt": "A Confusão Carioca e Nordestina com 'ch' e 'x': No Brasil, 'x' e 'ch' soam como [ʃ] (postalveolar relaxado). Ao tentar falar 'xī' ou 'shī', o brasileiro mistura os dois! Atenção máxima: 'j, q, x' SÓ se combinam com as vogais 'i' e 'ü' (/y/). Já 'zh, ch, sh' NUNCA se combinam com /i/ verdadeiro (o 'i' de 'zhi, chi, shi' é na verdade uma vogal retroflexa apical [ʐ̩]).",
            "brazilianTrapEn": "Learners often collapse 'x' [ɕ] and 'sh' [ʂ] into a generic English/Portuguese 'sh' [ʃ]. Critical rule: j/q/x only pair with /i/ and /y/; zh/ch/sh pair with the apical vowel [ʐ̩], never true [i].",
            "paperTestOrTrickPt": "O Truque do Sorriso vs Bico: Para 'x' (西), dê um sorriso bem largo e encoste a ponta da língua nos dentes de baixo. Para 'sh' (诗), faça um leve bico com os lábios e dobre a ponta da língua para trás em concha.",
            "paperTestOrTrickEn": "The Smile vs Pout Trick: For 'x' [ɕ], spread lips into a wide grin with tip pressed behind lower teeth. For 'sh' [ʂ], slightly round lips and curl tip back.",
            "svgDiagramType": "sagittal_retroflex_vs_palatal",
            "keyPairsIds": ["pair_place_s_sh_si_shi", "pair_place_x_sh_xi_shi", "pair_place_z_zh_zi_zhi"],
            "demoSyllables": [
                {"label": "Dental (s)", "hanzi": "四", "pinyin": "sì", "ipa": "/sz̩˥˩/", "audioKey": "syllables/human_female/si4.mp3"},
                {"label": "Retroflexa (sh)", "hanzi": "十", "pinyin": "shí", "ipa": "/ʂʐ̩˧˥/", "audioKey": "syllables/human_female/shi2.mp3"},
                {"label": "Alvéolo-palatal (x)", "hanzi": "西", "pinyin": "xī", "ipa": "/ɕi˥˥/", "audioKey": "syllables/human_female/xi1.mp3"}
            ]
        },
        {
            "id": "guide_nasal_codas",
            "slug": "nasal_codas_contrast",
            "category": "nasal_codas",
            "titlePt": "Finais Nasais: Alveolar (-n) vs Velar (-ng)",
            "titleEn": "Nasal Codas: Alveolar (-n) vs Velar (-ng)",
            "subtitlePt": "A armadilha da nasalização vocálica brasileira vs o selamento articulatório do Mandarim",
            "subtitleEn": "Overcoming Portuguese nasal vowel blending: mandatory tongue closure in Mandarin",
            "ipaSymbols": ["/an/", "/ɑŋ/", "/ən/", "/ɤŋ/", "/in/", "/iŋ/"],
            "tonguePositionPt": "1) Final -n (Alveolar): No final da emissão, a ponta da língua é OBRIGADA a subir e selar firmemente a gengiva superior (alvéolos), interrompendo a saída de ar pela boca e forçando 100% do ar pelo nariz.\n2) Final -ng (Velar): A ponta da língua permanece embaixo, e a PARTE POSTERIOR (dorso) sobe para selar o véu palatino (palato mole / campainha). A vogal anterior torna-se mais posterior e aberta (/ɑ/ em vez de /a/).",
            "tonguePositionEn": "1) -n (Alveolar): Tongue tip must physically seal against the alveolar ridge, completely shutting oral airflow.\n2) -ng (Velar): Tip remains down while tongue back seals against the soft velum, backing the preceding vowel (/ɑŋ/).",
            "brazilianTrapPt": "O Hábito de Não Tocar a Língua: No português (como em 'irmã', 'pão', 'canto'), não encostamos a língua no céu da boca para nasalizar — simplesmente soltamos ar pelo nariz enquanto mantemos a vogal aberta! Se você fizer isso em chinês, os nativos NÃO saberão se você disse 'shān' (montanha) ou 'shāng' (ferimento).",
            "brazilianTrapEn": "Portuguese nasal vowels are produced without tongue contact. In Mandarin, omitting the physical lingual seal renders -n and -ng indistinguishable.",
            "paperTestOrTrickPt": "O Teste da Trava na Língua: Ao pronunciar 'ān' (安), congele a boca no final: sinta a ponta da língua colada nos dentes de cima como num 'N' do inglês. Ao pronunciar 'āng' (昂), congele com a boca aberta e a garganta travada como no final de 'ping-pong'.",
            "paperTestOrTrickEn": "The Freeze Trick: For 'ān', freeze speech at the end: confirm tongue tip is firmly glued to upper ridge. For 'āng', freeze with mouth open and back of throat closed like 'sing'.",
            "svgDiagramType": "sagittal_alveolar_vs_velar_nasal",
            "keyPairsIds": ["pair_nasal_an_ang_shan", "pair_nasal_en_eng_chen", "pair_nasal_in_ing_bin"],
            "demoSyllables": [
                {"label": "Alveolar (-an)", "hanzi": "山", "pinyin": "shān", "ipa": "/ʂan˥˥/", "audioKey": "syllables/human_female/shan1.mp3"},
                {"label": "Velar (-ang)", "hanzi": "伤", "pinyin": "shāng", "ipa": "/ʂɑŋ˥˥/", "audioKey": "syllables/human_female/shang1.mp3"},
                {"label": "Alveolar (-in)", "hanzi": "金", "pinyin": "jīn", "ipa": "/tɕin˥˥/", "audioKey": "syllables/human_female/jin1.mp3"},
                {"label": "Velar (-ing)", "hanzi": "京", "pinyin": "jīng", "ipa": "/tɕiŋ˥˥/", "audioKey": "syllables/human_female/jing1.mp3"}
            ]
        },
        {
            "id": "guide_umlaut_vowels",
            "slug": "umlaut_rounded_vowel",
            "category": "vowels_umlaut",
            "titlePt": "A Vogal Arredondada Anterior: 'ü' (/y/) vs 'u' (/u/)",
            "titleEn": "Anterior Rounded Vowel: 'ü' (/y/) vs 'u' (/u/)",
            "subtitlePt": "Como emitir perfeitamente o som 'ü' (como em lǜ, nǚ, qù, xué)",
            "subtitleEn": "How to execute the high front rounded vowel 'ü' (/y/) flawlessly",
            "ipaSymbols": ["/y/", "/u/"],
            "tonguePositionPt": "A vogal 'ü' (/y/) é acusticamente fascinante: o corpo e a ponta da sua língua ficam exatamente na posição de um 'i' alto anterior (/i/), mas os lábios ficam rigidamente arredondados e projetados para a frente em um bico estreito (como em /u/)!",
            "tonguePositionEn": "'ü' (/y/) shares the exact high-front tongue posture of /i/, but paired with tight pursed lip-rounding like /u/.",
            "brazilianTrapPt": "A Pronúncia como 'U' ou Ditongo 'IU': Brasileiros sem treino tendem a pronunciar 'lǜ' como 'lu' ou como 'liu'. Isso altera completamente a palavra ('lù' é estrada, 'lǜ' é verde; 'nù' é fúria, 'nǚ' é mulher!). Lembre-se também da regra ortográfica: após j, q, x, y, os dois pontinhos são omitidos na grafia (ju, qu, xu, yu), mas o som é 100% 'ü' (/y/)!",
            "brazilianTrapEn": "Learners often substitute /u/ or diphthong /iu/. In Mandarin, 'lù' (road) and 'lǜ' (green) are completely different morphemes. After j, q, x, y, the umlaut dots are omitted orthographically but pronounced /y/.",
            "paperTestOrTrickPt": "O Truque do Apito sem Mexer a Língua: Diga um 'iiii' longo e contínuo. Enquanto sustenta o som, NÃO MOVA A LÍNGUA DE MODO ALGUM; apenas feche e arredonde os lábios para a frente em forma de canudinho ou biquinho. O som instantaneamente se transformará no 'ü' puro!",
            "paperTestOrTrickEn": "The Continuous Whistle Transition: Sustain a continuous 'eeee' (/i/). Without moving your tongue an millimeter, purse your lips forward into a tight circular trumpet. The sound effortlessly shifts into pure /y/!",
            "svgDiagramType": "vowel_trapezoid_u_vs_v",
            "keyPairsIds": ["pair_vowel_u_v_lu_lv", "pair_vowel_u_v_nu_nv", "pair_vowel_u_v_zhu_ju"],
            "demoSyllables": [
                {"label": "Vogal Posterior (u)", "hanzi": "路", "pinyin": "lù", "ipa": "/lu˥˩/", "audioKey": "syllables/human_female/lu4.mp3"},
                {"label": "Vogal Anterior (ü)", "hanzi": "绿", "pinyin": "lǜ", "ipa": "/ly˥˩/", "audioKey": "syllables/human_female/lv4.mp3"},
                {"label": "Vogal Posterior (nu)", "hanzi": "怒", "pinyin": "nù", "ipa": "/nu˥˩/", "audioKey": "syllables/human_female/nu4.mp3"},
                {"label": "Vogal Anterior (nü)", "hanzi": "女", "pinyin": "nǚ", "ipa": "/ny˨˩˦/", "audioKey": "syllables/human_female/nv3.mp3"}
            ]
        }
    ]

    out_path = os.path.join(PUBLIC_DATA_DIR, "sound_guides_pt.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(guides, f, ensure_ascii=False, indent=2)
    print(f"[build_dataset] sound_guides_pt.json salvo com {len(guides)} seções articulatórias ricas.")

def main():
    entries_by_syl, words_by_hanzi, all_entries = parse_cedict()
    build_syllables_chart(entries_by_syl)
    build_tone_sandhi()
    build_sound_guides()
    print("[build_dataset] Todos os datasets base construídos com sucesso!")

if __name__ == "__main__":
    main()
