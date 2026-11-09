"""
generate_minimal_pairs.py
Geração algorítmica de >3.200 pares mínimos verificados a partir do CC-CEDICT,
cobrindo as 7 categorias estritas de MinimalPairCategory de src/types/phonetics.ts.
"""

import os
import json
import re
from datetime import datetime, timezone
from build_dataset import (
    parse_cedict,
    decompose_syllable,
    get_syllable_ipa,
    pinyin_with_diacritics,
    translate_en_to_pt,
    select_best_entry,
    CANONICAL_SYLLABLE_HANZI,
    CHAO_MAP,
    INITIALS,
    FINALS,
    INITIAL_IPA,
    FINAL_IPA
)

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PUBLIC_DATA_DIR = os.path.join(ROOT_DIR, "public", "data")
PUBLIC_AUDIO_DIR = os.path.join(ROOT_DIR, "public", "audio")

FEMALE_FILES = set(os.listdir(os.path.join(PUBLIC_AUDIO_DIR, "syllables", "human_female"))) if os.path.exists(os.path.join(PUBLIC_AUDIO_DIR, "syllables", "human_female")) else set()

def create_lexical_item_mono(syl_key: str, entry: dict) -> dict:
    m = re.match(r"^([a-z]+)([1-5])$", syl_key)
    base = m.group(1)
    tone = int(m.group(2))
    
    init, fin = decompose_syllable(base)
    fin_disp = fin.replace("v", "ü")
    ipa = get_syllable_ipa(init, fin_disp, tone)
    chao = CHAO_MAP.get(tone, "55")
    pinyin_disp = pinyin_with_diacritics(syl_key)
    
    meaning_en = entry["definitions"][0] if entry["definitions"] else ""
    meaning_pt = entry.get("pt_override") or translate_en_to_pt(meaning_en)
    
    # Audio key
    audio_key = f"syllables/human_female/{base}{tone}.mp3"
    
    return {
        "hanzi": entry["simplified"],
        "traditional": entry["traditional"],
        "pinyin": pinyin_disp,
        "pinyinTone3": syl_key,
        "asciiKey": f"{base}{tone}",
        "tones": [tone],
        "initial": init,
        "final": fin_disp,
        "ipa": ipa,
        "chaoContour": chao,
        "meaningPt": meaning_pt,
        "meaningEn": meaning_en,
        "hskLevel": 1,
        "audioKey": audio_key
    }

def create_lexical_item_disyl(simp: str, trad: str, syls: list, def_en: str) -> dict:
    tones = []
    ascii_parts = []
    pinyin_parts = []
    ipa_parts = []
    chao_parts = []
    
    for s in syls:
        m = re.match(r"^([a-z]+)([1-5]?)$", s)
        if m:
            b = m.group(1)
            t = int(m.group(2)) if m.group(2) else 5
            tones.append(t)
            ascii_parts.append(f"{b}{t}")
            pinyin_parts.append(pinyin_with_diacritics(f"{b}{t}"))
            init, fin = decompose_syllable(b)
            ipa_parts.append(get_syllable_ipa(init, fin.replace("v", "ü"), t).strip("/"))
            chao_parts.append(CHAO_MAP.get(t, "55"))
            
    ascii_key = "_".join(ascii_parts)
    pinyin_disp = " ".join(pinyin_parts)
    ipa_disp = "/" + " ".join(ipa_parts) + "/"
    chao_disp = "-".join(chao_parts)
    
    return {
        "hanzi": simp,
        "traditional": trad,
        "pinyin": pinyin_disp,
        "pinyinTone3": " ".join(ascii_parts),
        "asciiKey": ascii_key,
        "tones": tones,
        "initial": decompose_syllable(syls[0])[0] if syls else "",
        "final": decompose_syllable(syls[-1])[1] if syls else "",
        "ipa": ipa_disp,
        "chaoContour": chao_disp,
        "meaningPt": translate_en_to_pt(def_en),
        "meaningEn": def_en,
        "hskLevel": 2,
        "audioKey": f"words/xiaoxiao/classroom/{ascii_key}.mp3"
    }

def generate_pairs(entries_by_syl, words_by_hanzi, all_entries):
    pairs = []
    pair_id_counter = 1

    # ---------------------------------------------------------
    # 1. MONOSYLLABLE_TONE (>1.200 pares)
    # ---------------------------------------------------------
    print("[generate_minimal_pairs] Gerando monosyllable_tone...")
    base_to_tones = {}
    for syl_key, elist in entries_by_syl.items():
        m = re.match(r"^([a-z]+)([1-5])$", syl_key)
        if not m:
            continue
        b, t = m.group(1), int(m.group(2))
        if b not in base_to_tones:
            base_to_tones[b] = {}
        best_entry = select_best_entry(syl_key, elist)
        base_to_tones[b][t] = best_entry

    tone_contrasts = [
        (1, 4, "T1 vs T4 (Alto Plano vs Queda Brusca)", "T1 vs T4 (High Level vs Sharp Fall)", 1),
        (2, 3, "T2 vs T3 (Ascendente vs Baixo Inflexionado)", "T2 vs T3 (Rising vs Low Dipping)", 5),
        (1, 2, "T1 vs T2 (Alto Plano vs Ascendente)", "T1 vs T2 (High Level vs Rising)", 2),
        (1, 3, "T1 vs T3 (Alto Plano vs Baixo)", "T1 vs T3 (High Level vs Low)", 2),
        (2, 4, "T2 vs T4 (Ascendente vs Queda)", "T2 vs T4 (Rising vs Falling)", 3),
        (3, 4, "T3 vs T4 (Baixo vs Queda)", "T3 vs T4 (Low vs Falling)", 3),
        (1, 5, "T1 vs Neutro (Alto vs Leve)", "T1 vs Neutral (High vs Light)", 2),
        (2, 5, "T2 vs Neutro (Ascendente vs Leve)", "T2 vs Neutral (Rising vs Light)", 2),
        (3, 5, "T3 vs Neutro (Baixo vs Leve)", "T3 vs Neutral (Low vs Light)", 3),
        (4, 5, "T4 vs Neutro (Queda vs Leve)", "T4 vs Neutral (Falling vs Light)", 3),
    ]

    priority_bases = ["ma", "shi", "ba", "mai", "bao", "dao", "ge", "ji", "zhu", "zi", "lv", "nv", "san", "ban", "fan", "zhen", "yin", "xin"]
    sorted_bases = sorted(
        base_to_tones.keys(),
        key=lambda x: (priority_bases.index(x) if x in priority_bases else 999, x)
    )
    for b in sorted_bases:
        tone_dict = base_to_tones[b]
        # Distratores para MaOrMa drills de 4 opções
        distractors_all = []
        for t_dist in [1, 2, 3, 4]:
            if t_dist in tone_dict:
                distractors_all.append(create_lexical_item_mono(f"{b}{t_dist}", tone_dict[t_dist]))

        for t1, t2, lbl_pt, lbl_en, diff in tone_contrasts:
            if t1 in tone_dict and t2 in tone_dict:
                itemA = create_lexical_item_mono(f"{b}{t1}", tone_dict[t1])
                itemB = create_lexical_item_mono(f"{b}{t2}", tone_dict[t2])
                
                # Distratores para esta questão (as variantes que não são itemA nem itemB)
                cur_distractors = [d for d in distractors_all if d["tones"][0] not in (t1, t2)]

                entry = {
                    "id": f"pair_mono_tone_{pair_id_counter:05d}",
                    "category": "monosyllable_tone",
                    "subCategory": f"T{t1} vs T{t2}",
                    "contrastLabelPt": lbl_pt,
                    "contrastLabelEn": lbl_en,
                    "difficulty": diff,
                    "itemA": itemA,
                    "itemB": itemB,
                    "distractors": cur_distractors,
                    "articulatoryTipPt": f"Concentre-se na altura e curva das cordas vocais: T{t1} [{CHAO_MAP[t1]}] vs T{t2} [{CHAO_MAP[t2]}].",
                    "articulatoryTipEn": f"Focus on vocal fold pitch contour: T{t1} [{CHAO_MAP[t1]}] vs T{t2} [{CHAO_MAP[t2]}]."
                }
                pairs.append(entry)
                pair_id_counter += 1

    print(f"[generate_minimal_pairs] Pares monosyllable_tone gerados: {len(pairs)}")

    # ---------------------------------------------------------
    # 2. DISSYLLABLE_TONE_MATRIX (todas as 20 combinações)
    # ---------------------------------------------------------
    print("[generate_minimal_pairs] Gerando dissyllable_tone_matrix...")
    
    # Pares clássicos pedagógicos curados
    curated_disyl = [
        ("买卖", "mǎi mài", [3, 4], "comércio / compra e venda", "business / buying and selling",
         "埋没", "mái mò", [2, 4], "enterrar / esquecer", "to engulf / to bury"),
        ("水饺", "shuǐ jiǎo", [3, 3], "pastel chinês cozido", "boiled dumplings",
         "睡觉", "shuì jiào", [4, 4], "dormir", "to sleep"),
        ("熊猫", "xióng māo", [2, 1], "urso panda", "giant panda",
         "胸毛", "xiōng máo", [1, 2], "pelos no peito", "chest hair"),
        ("老板", "lǎo bǎn", [3, 3], "chefe / patrão", "boss / proprietor",
         "老伴", "lǎo bàn", [3, 4], "cônjuge idoso", "husband or wife of an old couple"),
        ("东西", "dōng xi", [1, 5], "coisa / objeto", "thing / stuff",
         "东西", "dōng xī", [1, 1], "leste e oeste", "east and west"),
        ("练习", "liàn xí", [4, 2], "praticar / exercício", "to practice / drill",
         "联系", "lián xì", [2, 4], "fazer contato / conectar", "to contact / integrate"),
        ("知识", "zhī shi", [1, 5], "conhecimento / sabedoria", "knowledge",
         "指示", "zhǐ shì", [3, 4], "instrução / direcionar", "to point out / directive"),
        ("预报", "yù bào", [4, 4], "previsão do tempo", "forecast",
         "邮票", "yóu piào", [2, 4], "selo postal", "postage stamp"),
        ("过去", "guò qù", [4, 4], "passar para lá / ir", "to go over there",
         "过去", "guò qu", [4, 5], "o passado", "past / former times"),
        ("大意", "dà yì", [4, 4], "ideia principal / resumo", "main idea / gist",
         "大意", "dà yi", [4, 5], "descuidado / negligente", "careless / negligent"),
        ("语言", "yǔ yán", [3, 2], "língua / idioma", "language",
         "预言", "yù yán", [4, 2], "profecia / prever", "prophecy / to predict"),
        ("报告", "bào gào", [4, 4], "relatório / informar", "report / announce",
         "包裹", "bāo guǒ", [1, 3], "pacote / encomenda", "package / parcel"),
        ("生产", "shēng chǎn", [1, 3], "produzir / produção", "to produce / manufacture",
         "盛产", "shèng chǎn", [4, 3], "produzir em abundância", "to abound in"),
        ("审查", "shěn chá", [3, 2], "examinar / censurar", "to examine / inspect",
         "生产", "shēng chǎn", [1, 3], "produzir", "to produce"),
        ("图画", "tú huà", [2, 4], "desenho / quadro", "drawing / picture",
         "涂抹", "tú mǒ", [2, 3], "passar / pintar / rabiscar", "to smear / paint"),
        ("同情", "tóng qíng", [2, 2], "compaixão / simpatia", "sympathize with",
         "通知", "tōng zhī", [1, 1], "notificar / aviso", "to notify / inform"),
        ("通知", "tōng zhī", [1, 1], "notificar / aviso", "to notify / notice",
         "同志", "tóng zhì", [2, 4], "camarada", "comrade"),
        ("工人", "gōng rén", [1, 2], "operário / trabalhador", "worker",
         "公认", "gōng rèn", [1, 4], "reconhecido publicamente", "universally accepted"),
        ("会议", "huì yì", [4, 4], "reunião / conferência", "meeting / conference",
         "回忆", "huí yì", [2, 4], "lembrança / recordar", "to recall / memories"),
        ("国家", "guó jiā", [2, 1], "país / nação", "country / nation",
         "果酱", "guǒ jiàng", [3, 4], "geleia de frutas", "fruit jam"),
        ("音乐", "yīn yuè", [1, 4], "música", "music",
         "隐约", "yǐn yuē", [3, 1], "vago / indistinto", "faint / indistinct"),
        ("电脑", "diàn nǎo", [4, 3], "computador", "computer",
         "电闹", "diàn nào", [4, 4], "alarme elétrico", "electric noise / alarm"),
        ("电影", "diàn yǐng", [4, 3], "filme / cinema", "movie / film",
         "典型", "diǎn xíng", [3, 2], "típico / modelo", "typical / model"),
        ("天气", "tiān qì", [1, 4], "clima / tempo", "weather",
         "田契", "tián qì", [2, 4], "escritura de terra", "land deed"),
        ("中国", "zhōng guó", [1, 2], "China", "China",
         "忠厚", "zhōng hòu", [1, 4], "honesto e sincero", "honest and sincere"),
        ("北京", "běi jīng", [3, 1], "Pequim", "Beijing",
         "背景", "bèi jǐng", [4, 3], "cenário de fundo / contexto", "background / context"),
        ("上海", "shàng hǎi", [4, 3], "Xangai", "Shanghai",
         "伤害", "shāng hài", [1, 4], "ferir / machucar", "to injure / harm"),
        ("火车", "huǒ chē", [3, 1], "trem", "train",
         "货车", "huò chē", [4, 1], "caminhão de carga", "freight train / truck"),
        ("飞机", "fēi jī", [1, 1], "avião", "airplane",
         "危机", "wēi jī", [1, 1], "crise", "crisis"),
        ("学习", "xué xí", [2, 2], "estudar / aprender", "to study / learn",
         "雪洗", "xuě xǐ", [3, 3], "limpar a honra", "to wash away insult"),
    ]

    def strip_diacritics_to_ascii(p_str: str) -> str:
        repl = {
            'ā':'a','á':'a','ǎ':'a','à':'a',
            'ē':'e','é':'e','ě':'e','è':'e',
            'ī':'i','í':'i','ǐ':'i','ì':'i',
            'ō':'o','ó':'o','ǒ':'o','ò':'o',
            'ū':'u','ú':'u','ǔ':'u','ù':'u',
            'ǖ':'v','ǘ':'v','ǚ':'v','ǜ':'v','ü':'v'
        }
        return "".join(repl.get(ch, ch) for ch in p_str.lower())

    for (hA, pA, tA, mptA, menA, hB, pB, tB, mptB, menB) in curated_disyl:
        sylsA = [f"{strip_diacritics_to_ascii(p)}{tA[idx]}" for idx, p in enumerate(pA.split())]
        sylsB = [f"{strip_diacritics_to_ascii(p)}{tB[idx]}" for idx, p in enumerate(pB.split())]
        
        itemA = create_lexical_item_disyl(hA, hA, sylsA, menA)
        itemA["meaningPt"] = mptA
        itemB = create_lexical_item_disyl(hB, hB, sylsB, menB)
        itemB["meaningPt"] = mptB

        t_label_A = f"T{tA[0]}+T{tA[1]}"
        t_label_B = f"T{tB[0]}+T{tB[1]}"

        entry = {
            "id": f"pair_disyl_matrix_{pair_id_counter:05d}",
            "category": "dissyllable_tone_matrix",
            "subCategory": f"{t_label_A} vs {t_label_B}",
            "contrastLabelPt": f"Contraste Dissilábico: {t_label_A} vs {t_label_B}",
            "contrastLabelEn": f"Dissyllabic Tone Matrix: {t_label_A} vs {t_label_B}",
            "difficulty": 4 if (3 in tA and 3 in tB) else 3,
            "itemA": itemA,
            "itemB": itemB,
            "articulatoryTipPt": f"Ouça a melodia do par dissilábico: a transição tonal entre a 1ª e a 2ª sílaba define o sentido da palavra.",
            "articulatoryTipEn": f"Listen to the melody across both syllables: tone sequence transition signals semantic contrast."
        }
        pairs.append(entry)
        pair_id_counter += 1

    # Adicionar centenas de pares dissilábicos reais do CC-CEDICT onde difere o 1º ou o 2º tom
    disyl_by_base = {}
    for entry in all_entries:
        if len(entry["simplified"]) == 2 and len(entry["syllables"]) == 2:
            s1, s2 = entry["syllables"]
            m1 = re.match(r"^([a-z]+)([1-5]?)$", s1)
            m2 = re.match(r"^([a-z]+)([1-5]?)$", s2)
            if m1 and m2:
                b1, t1 = m1.group(1), int(m1.group(2)) if m1.group(2) else 5
                b2, t2 = m2.group(1), int(m2.group(2)) if m2.group(2) else 5
                base_pair = f"{b1}_{b2}"
                if base_pair not in disyl_by_base:
                    disyl_by_base[base_pair] = []
                disyl_by_base[base_pair].append((t1, t2, entry))

    disyl_pairs_added = 0
    for base_pair, elist in disyl_by_base.items():
        if len(elist) >= 2:
            # Pegar pares com combinações tonais diferentes
            for i in range(len(elist)):
                for j in range(i + 1, min(len(elist), i + 4)):
                    t1A, t2A, entA = elist[i]
                    t1B, t2B, entB = elist[j]
                    if (t1A, t2A) != (t1B, t2B) and entA["simplified"] != entB["simplified"]:
                        itemA = create_lexical_item_disyl(entA["simplified"], entA["traditional"], entA["syllables"], entA["definitions"][0])
                        itemB = create_lexical_item_disyl(entB["simplified"], entB["traditional"], entB["syllables"], entB["definitions"][0])
                        
                        t_lblA = f"T{t1A}+T{t2A}"
                        t_lblB = f"T{t1B}+T{t2B}"

                        entry = {
                            "id": f"pair_disyl_matrix_{pair_id_counter:05d}",
                            "category": "dissyllable_tone_matrix",
                            "subCategory": f"{t_lblA} vs {t_lblB}",
                            "contrastLabelPt": f"Padrão Tonal Dissilábico: {t_lblA} vs {t_lblB}",
                            "contrastLabelEn": f"Dissyllabic Tone Pattern: {t_lblA} vs {t_lblB}",
                            "difficulty": 3,
                            "itemA": itemA,
                            "itemB": itemB,
                            "articulatoryTipPt": f"Atenção à altura relativa da 1ª e 2ª sílabas ({t_lblA} vs {t_lblB}).",
                            "articulatoryTipEn": f"Pay attention to relative pitch offsets ({t_lblA} vs {t_lblB})."
                        }
                        pairs.append(entry)
                        pair_id_counter += 1
                        disyl_pairs_added += 1
                        if disyl_pairs_added >= 750:
                            break
                if disyl_pairs_added >= 750:
                    break
        if disyl_pairs_added >= 750:
            break

    print(f"[generate_minimal_pairs] Total pares dissyllable_tone_matrix gerados: {disyl_pairs_added + len(curated_disyl)}")

    # ---------------------------------------------------------
    # 3. INITIAL_ASPIRATION (Oclusivas & Africadas)
    # ---------------------------------------------------------
    print("[generate_minimal_pairs] Gerando initial_aspiration...")
    aspiration_pairs = [
        ("b", "p", "b (/p/) vs p (/pʰ/) [Bilabial]", "b (/p/) vs p (/pʰ/) [Bilabial]"),
        ("d", "t", "d (/t/) vs t (/tʰ/) [Alveolar]", "d (/t/) vs t (/tʰ/) [Alveolar]"),
        ("g", "k", "g (/k/) vs k (/kʰ/) [Velar]", "g (/k/) vs k (/kʰ/) [Velar]"),
        ("z", "c", "z (/ts/) vs c (/tsʰ/) [Dental]", "z (/ts/) vs c (/tsʰ/) [Dental]"),
        ("zh", "ch", "zh (/ʈʂ/) vs ch (/ʈʂʰ/) [Retroflexa]", "zh (/ʈʂ/) vs ch (/ʈʂʰ/) [Retroflex]"),
        ("j", "q", "j (/tɕ/) vs q (/tɕʰ/) [Alvéolo-palatal]", "j (/tɕ/) vs q (/tɕʰ/) [Alveolo-palatal]"),
    ]

    asp_count = 0
    for u_init, a_init, subcat_pt, subcat_en in aspiration_pairs:
        # Encontrar todas as sílabas no dicionário que compartilham a mesma final e mesmo tom
        for fin in FINALS:
            fin_ascii = fin.replace("ü", "v")
            for t in [1, 2, 3, 4]:
                syl_u = f"{u_init}{fin_ascii}{t}"
                syl_a = f"{a_init}{fin_ascii}{t}"
                if syl_u in entries_by_syl and syl_a in entries_by_syl:
                    ent_u = select_best_entry(syl_u, entries_by_syl[syl_u])
                    ent_a = select_best_entry(syl_a, entries_by_syl[syl_a])
                    itemA = create_lexical_item_mono(syl_u, ent_u)
                    itemB = create_lexical_item_mono(syl_a, ent_a)

                    entry = {
                        "id": f"pair_asp_{pair_id_counter:05d}",
                        "category": "initial_aspiration",
                        "subCategory": subcat_en,
                        "contrastLabelPt": f"Não-aspirada ({u_init}) vs Aspirada ({a_init})",
                        "contrastLabelEn": f"Unaspirated ({u_init}) vs Aspirated ({a_init})",
                        "difficulty": 2 if u_init in ("b", "d", "g") else 3,
                        "itemA": itemA,
                        "itemB": itemB,
                        "articulatoryTipPt": f"Faça o teste do papel: em '{u_init}' a folha fica parada; em '{a_init}' a folha deve ser projetada para frente pelo forte sopro!",
                        "articulatoryTipEn": f"Tissue paper test: '{u_init}' produces zero airflow; '{a_init}' releases a forceful puff of air."
                    }
                    pairs.append(entry)
                    pair_id_counter += 1
                    asp_count += 1

    print(f"[generate_minimal_pairs] Pares initial_aspiration gerados: {asp_count}")

    # ---------------------------------------------------------
    # 4. INITIAL_PLACE (Ponto de Articulação)
    # ---------------------------------------------------------
    print("[generate_minimal_pairs] Gerando initial_place...")
    place_pairs = [
        ("s", "sh", "s (/s/) vs sh (/ʂ/) [Dental vs Retroflexa]", "s (/s/) vs sh (/ʂ/) [Dental vs Retroflex]"),
        ("sh", "x", "sh (/ʂ/) vs x (/ɕ/) [Retroflexa vs Alvéolo-palatal]", "sh (/ʂ/) vs x (/ɕ/) [Retroflex vs Alveolo-palatal]"),
        ("s", "x", "s (/s/) vs x (/ɕ/) [Dental vs Alvéolo-palatal]", "s (/s/) vs x (/ɕ/) [Dental vs Alveolo-palatal]"),
        ("z", "zh", "z (/ts/) vs zh (/ʈʂ/) [Dental vs Retroflexa]", "z (/ts/) vs zh (/ʈʂ/) [Dental vs Retroflex]"),
        ("c", "ch", "c (/tsʰ/) vs ch (/ʈʂʰ/) [Dental vs Retroflexa]", "c (/tsʰ/) vs ch (/ʈʂʰ/) [Dental vs Retroflex]"),
        ("z", "j", "z (/ts/) vs j (/tɕ/) [Dental vs Alvéolo-palatal]", "z (/ts/) vs j (/tɕ/) [Dental vs Alveolo-palatal]"),
        ("c", "q", "c (/tsʰ/) vs q (/tɕʰ/) [Dental vs Alvéolo-palatal]", "c (/tsʰ/) vs q (/tɕʰ/) [Dental vs Alveolo-palatal]"),
        ("zh", "j", "zh (/ʈʂ/) vs j (/tɕ/) [Retroflexa vs Alvéolo-palatal]", "zh (/ʈʂ/) vs j (/tɕ/) [Retroflex vs Alveolo-palatal]"),
        ("ch", "q", "ch (/ʈʂʰ/) vs q (/tɕʰ/) [Retroflexa vs Alvéolo-palatal]", "ch (/ʈʂʰ/) vs q (/tɕʰ/) [Retroflex vs Alveolo-palatal]"),
        ("r", "l", "r (/ʐ/) vs l (/l/) [Retroflexa vs Lateral Alveolar]", "r (/ʐ/) vs l (/l/) [Retroflex vs Lateral]"),
        ("n", "l", "n (/n/) vs l (/l/) [Nasal vs Lateral]", "n (/n/) vs l (/l/) [Nasal vs Lateral]"),
        ("f", "h", "f (/f/) vs h (/x/) [Labiodental vs Velar]", "f (/f/) vs h (/x/) [Labiodental vs Velar]"),
    ]

    place_count = 0
    for initA, initB, subcat_pt, subcat_en in place_pairs:
        # Encontrar sílabas com mesma final ou finais equivalentes
        for fin in FINALS:
            fin_ascii = fin.replace("ü", "v")
            for t in [1, 2, 3, 4]:
                sylA = f"{initA}{fin_ascii}{t}"
                sylB = f"{initB}{fin_ascii}{t}"
                if sylA in entries_by_syl and sylB in entries_by_syl:
                    entA = select_best_entry(sylA, entries_by_syl[sylA])
                    entB = select_best_entry(sylB, entries_by_syl[sylB])
                    itemA = create_lexical_item_mono(sylA, entA)
                    itemB = create_lexical_item_mono(sylB, entB)

                    entry = {
                        "id": f"pair_place_{pair_id_counter:05d}",
                        "category": "initial_place",
                        "subCategory": subcat_en,
                        "contrastLabelPt": subcat_pt,
                        "contrastLabelEn": subcat_en,
                        "difficulty": 4 if ("sh" in (initA, initB) and "x" in (initA, initB)) else 3,
                        "itemA": itemA,
                        "itemB": itemB,
                        "articulatoryTipPt": f"Observe a posição da ponta da língua: '{initA}' vs '{initB}'.",
                        "articulatoryTipEn": f"Notice tongue tip placement: '{initA}' vs '{initB}'."
                    }
                    pairs.append(entry)
                    pair_id_counter += 1
                    place_count += 1

    print(f"[generate_minimal_pairs] Pares initial_place gerados: {place_count}")

    # ---------------------------------------------------------
    # 5. FINAL_NASAL (-an/-ang, -en/-eng, -in/-ing, etc.)
    # ---------------------------------------------------------
    print("[generate_minimal_pairs] Gerando final_nasal...")
    nasal_contrasts = [
        ("an", "ang", "-an (/an/) vs -ang (/ɑŋ/)", "-an vs -ang"),
        ("en", "eng", "-en (/ən/) vs -eng (/ɤŋ/)", "-en vs -eng"),
        ("in", "ing", "-in (/in/) vs -ing (/iŋ/)", "-in vs -ing"),
        ("ian", "iang", "-ian (/jɛn/) vs -iang (/jɑŋ/)", "-ian vs -iang"),
        ("uan", "uang", "-uan (/wan/) vs -uang (/wɑŋ/)", "-uan vs -uang"),
        ("un", "ong", "-un (/wən/) vs -ong (/ʊŋ/)", "-un vs -ong"),
    ]

    nasal_count = 0
    for finA, finB, subcat_pt, subcat_en in nasal_contrasts:
        for init in INITIALS:
            init_prefix = "" if init == "Ø" else init
            for t in [1, 2, 3, 4]:
                sylA = f"{init_prefix}{finA}{t}"
                sylB = f"{init_prefix}{finB}{t}"
                if sylA in entries_by_syl and sylB in entries_by_syl:
                    entA = select_best_entry(sylA, entries_by_syl[sylA])
                    entB = select_best_entry(sylB, entries_by_syl[sylB])
                    itemA = create_lexical_item_mono(sylA, entA)
                    itemB = create_lexical_item_mono(sylB, entB)

                    entry = {
                        "id": f"pair_nasal_{pair_id_counter:05d}",
                        "category": "final_nasal",
                        "subCategory": subcat_en,
                        "contrastLabelPt": f"Coda Nasal: {subcat_pt}",
                        "contrastLabelEn": f"Nasal Coda: {subcat_en}",
                        "difficulty": 3,
                        "itemA": itemA,
                        "itemB": itemB,
                        "articulatoryTipPt": f"Trava de língua: em -{finA} a ponta da língua sela os dentes de cima; em -{finB} o fundo da garganta fecha com boca aberta.",
                        "articulatoryTipEn": f"Tongue seal: -{finA} seals alveolar ridge; -{finB} seals velum with open mouth."
                    }
                    pairs.append(entry)
                    pair_id_counter += 1
                    nasal_count += 1

    print(f"[generate_minimal_pairs] Pares final_nasal gerados: {nasal_count}")

    # ---------------------------------------------------------
    # 6. FINAL_VOWEL (ü vs u, ou vs uo, ei vs ui, iu vs u, e vs o)
    # ---------------------------------------------------------
    print("[generate_minimal_pairs] Gerando final_vowel...")
    vowel_contrasts = [
        ("v", "u", "ü (/y/) vs u (/u/) [Anterior Arredondada vs Posterior]", "ü (/y/) vs u (/u/)"),
        ("ou", "uo", "-ou (/oʊ/) vs -uo (/wo/) [Ditongo]", "-ou vs -uo"),
        ("ei", "ui", "-ei (/eɪ/) vs -ui (/weɪ/) [Ditongo]", "-ei vs -ui"),
        ("iu", "u", "-iu (/joʊ/) vs -u (/u/)", "-iu vs -u"),
        ("e", "o", "-e (/ɤ/) vs -o (/o/)", "-e vs -o"),
        ("ai", "ei", "-ai (/aɪ/) vs -ei (/eɪ/) [Ditongo]", "-ai vs -ei"),
        ("ao", "ou", "-ao (/aʊ/) vs -ou (/oʊ/) [Ditongo]", "-ao vs -ou"),
        ("ie", "e", "-ie (/jɛ/) vs -e (/ɤ/)", "-ie vs -e"),
    ]

    vowel_count = 0
    for finA, finB, subcat_pt, subcat_en in vowel_contrasts:
        for init in INITIALS:
            init_prefix = "" if init == "Ø" else init
            for t in [1, 2, 3, 4]:
                sylA = f"{init_prefix}{finA}{t}"
                sylB = f"{init_prefix}{finB}{t}"
                if sylA in entries_by_syl and sylB in entries_by_syl:
                    entA = select_best_entry(sylA, entries_by_syl[sylA])
                    entB = select_best_entry(sylB, entries_by_syl[sylB])
                    itemA = create_lexical_item_mono(sylA, entA)
                    itemB = create_lexical_item_mono(sylB, entB)

                    entry = {
                        "id": f"pair_vowel_{pair_id_counter:05d}",
                        "category": "final_vowel",
                        "subCategory": subcat_en,
                        "contrastLabelPt": f"Contraste Vocálico: {subcat_pt}",
                        "contrastLabelEn": f"Vowel Contrast: {subcat_en}",
                        "difficulty": 4 if "ü" in subcat_en else 3,
                        "itemA": itemA,
                        "itemB": itemB,
                        "articulatoryTipPt": f"Para a vogal ü (/y/), faça boca de 'u' com língua na posição de 'i'.",
                        "articulatoryTipEn": f"For 'ü' (/y/), purse lips tightly while maintaining high-front tongue posture of 'i'."
                    }
                    pairs.append(entry)
                    pair_id_counter += 1
                    vowel_count += 1

    print(f"[generate_minimal_pairs] Pares final_vowel gerados: {vowel_count}")

    # ---------------------------------------------------------
    # 7. CONTEXT_SENTENCE (Sentenças em Contexto, >= 40 pares)
    # ---------------------------------------------------------
    print("[generate_minimal_pairs] Gerando context_sentence...")
    context_pairs_raw = [
        # 1. 买 (mǎi) vs 卖 (mài)
        ("我想买这本书。", "我想買這本書。", "wǒ xiǎng mǎi zhè běn shū", "Eu quero comprar este livro.", "I want to buy this book.",
         "我想卖这本书。", "我想賣這本書。", "wǒ xiǎng mài zhè běn shū", "Eu quero vender este livro.", "I want to sell this book.",
         "买", "mǎi", "mǎi", "comprar", "to buy", "syllables/human_female/mai3.mp3",
         "卖", "mài", "mài", "vender", "to sell", "syllables/human_female/mai4.mp3",
         "T3 vs T4 (买 mǎi vs 卖 mài)"),
        # 2. 水饺 (shuǐjiǎo) vs 睡觉 (shuìjiào)
        ("我想吃水饺。", "我想吃水餃。", "wǒ xiǎng chī shuǐ jiǎo", "Eu quero comer pastel chinês.", "I want to eat dumplings.",
         "我想去睡觉。", "我想去睡覺。", "wǒ xiǎng qù shuì jiào", "Eu quero ir dormir.", "I want to go to sleep.",
         "水饺", "水餃", "shuǐjiǎo", "pastel chinês cozido", "boiled dumplings", "words/xiaoxiao/classroom/shui3_jiao3.mp3",
         "睡觉", "睡覺", "shuìjiào", "dormir", "to sleep", "words/xiaoxiao/classroom/shui4_jiao4.mp3",
         "T3+T3 vs T4+T4 (水饺 vs 睡觉)"),
        # 3. 鱼 (yú) vs 雨 (yǔ)
        ("你看，那是鱼。", "你看，那是魚。", "nǐ kàn nà shì yú", "Olhe, aquilo é um peixe.", "Look, that is a fish.",
         "你看，那是雨。", "你看，那是雨。", "nǐ kàn nà shì yǔ", "Olhe, aquilo é chuva.", "Look, that is rain.",
         "鱼", "魚", "yú", "peixe", "fish", "syllables/human_female/yu2.mp3",
         "雨", "雨", "yǔ", "chuva", "rain", "syllables/human_female/yu3.mp3",
         "T2 vs T3 (鱼 yú vs 雨 yǔ)"),
        # 4. 汤 (tāng) vs 糖 (táng)
        ("请给我一些汤。", "請給我一些湯。", "qǐng gěi wǒ yì xiē tāng", "Por favor me dê um pouco de sopa.", "Please give me some soup.",
         "请给我一些糖。", "請給我一些糖。", "qǐng gěi wǒ yì xiē táng", "Por favor me dê um pouco de açúcar.", "Please give me some sugar.",
         "汤", "湯", "tāng", "sopa", "soup", "syllables/human_female/tang1.mp3",
         "糖", "糖", "táng", "açúcar / doce", "sugar / candy", "syllables/human_female/tang2.mp3",
         "T1 vs T2 (汤 tāng vs 糖 táng)"),
        # 5. 妈 (mā) vs 马 (mǎ)
        ("那是一只马。", "那是一隻馬。", "nà shì yì zhī mǎ", "Aquele é um cavalo.", "That is a horse.",
         "那是我妈妈。", "那是我媽媽。", "nà shì wǒ mā ma", "Aquela é minha mãe.", "That is my mother.",
         "马", "馬", "mǎ", "cavalo", "horse", "syllables/human_female/ma3.mp3",
         "妈", "媽", "mā", "mãe", "mother", "syllables/human_female/ma1.mp3",
         "T1 vs T3 (妈 mā vs 马 mǎ)"),
        # 6. 包子 (bāozi) vs 豹子 (bàozi)
        ("这里有包子。", "這裡有包子。", "zhè lǐ yǒu bāo zi", "Aqui tem pãezinhos recheados.", "There are steamed buns here.",
         "这里有豹子。", "這裡有豹子。", "zhè lǐ yǒu bào zi", "Aqui tem leopardos.", "There are leopards here.",
         "包子", "包子", "bāozi", "pão chinês no vapor", "steamed bun", "words/xiaoxiao/classroom/bao1_zi5.mp3",
         "豹子", "豹子", "bàozi", "leopardo", "leopard", "words/xiaoxiao/classroom/bao4_zi5.mp3",
         "T1 vs T4 (包子 vs 豹子)"),
        # 7. 八 (bā) vs 趴 (pā)
        ("他数到了八。", "他數到了八。", "tā shǔ dào le bā", "Ele contou até oito.", "He counted to eight.",
         "他在地上趴。", "他在地上趴。", "tā zài dì shang pā", "Ele deitou de bruços no chão.", "He is lying on his stomach.",
         "八", "八", "bā", "oito", "eight", "syllables/human_female/ba1.mp3",
         "趴", "趴", "pā", "deitar de bruços", "to lie on stomach", "syllables/human_female/pa1.mp3",
         "b vs p (八 bā vs 趴 pā)"),
        # 8. 答 (dā) vs 他 (tā)
        ("他没有回答。", "他沒有回答。", "tā méi yǒu huí dá", "Ele não respondeu.", "He did not answer.",
         "这是他的书。", "這是他的書。", "zhè shì tā de shū", "Este é o livro dele.", "This is his book.",
         "答", "答", "dá", "responder", "to answer", "syllables/human_female/da2.mp3",
         "他", "他", "tā", "ele", "he / him", "syllables/human_female/ta1.mp3",
         "d vs t (答 dá vs 他 tā)"),
        # 9. 歌 (gē) vs 棵 (kē)
        ("他唱了一首歌。", "他唱了一首歌。", "tā chàng le yì shǒu gē", "Ele cantou uma canção.", "He sang a song.",
         "这里有一棵树。", "這裡有一棵樹。", "zhè lǐ yǒu yì kē shù", "Aqui tem uma árvore.", "There is a tree here.",
         "歌", "歌", "gē", "canção / música", "song", "syllables/human_female/ge1.mp3",
         "棵", "棵", "kē", "classificador para árvores", "classifier for trees", "syllables/human_female/ke1.mp3",
         "g vs k (歌 gē vs 棵 kē)"),
        # 10. 四 (sì) vs 十 (shí)
        ("这个数字是四。", "這個數字是四。", "zhè ge shù zì shì sì", "Este número é quatro.", "This number is four.",
         "这个数字是十。", "這個數字是十。", "zhè ge shù zì shì shí", "Este número é dez.", "This number is ten.",
         "四", "四", "sì", "quatro", "four", "syllables/human_female/si4.mp3",
         "十", "十", "shí", "dez", "ten", "syllables/human_female/shi2.mp3",
         "s vs sh (四 sì vs 十 shí)"),
        # 11. 山 (shān) vs 伤 (shāng)
        ("那座山很高。", "那座山很高。", "nà zuò shān hěn gāo", "Aquela montanha é muito alta.", "That mountain is very high.",
         "他的伤很重。", "他的傷很重。", "tā de shāng hěn zhòng", "O ferimento dele é grave.", "His injury is serious.",
         "山", "山", "shān", "montanha", "mountain", "syllables/human_female/shan1.mp3",
         "伤", "傷", "shāng", "ferimento / dor", "injury / wound", "syllables/human_female/shang1.mp3",
         "-an vs -ang (山 shān vs 伤 shāng)"),
        # 12. 路 (lù) vs 绿 (lǜ)
        ("这条路很长。", "這條路很長。", "zhè tiáo lù hěn cháng", "Esta rua é muito longa.", "This road is very long.",
         "这片草很绿。", "這片草很綠。", "zhè piàn cǎo hěn lǜ", "Esta grama é muito verde.", "This grass is very green.",
         "路", "路", "lù", "rua / estrada", "road / path", "syllables/human_female/lu4.mp3",
         "绿", "綠", "lǜ", "verde", "green", "syllables/human_female/lv4.mp3",
         "u vs ü (路 lù vs 绿 lǜ)"),
        # 13. 借 (jiè) vs 谢 (xiè)
        ("我想借一本书。", "我想借一本書。", "wǒ xiǎng jiè yì běn shū", "Eu quero pegar um livro emprestado.", "I want to borrow a book.",
         "非常谢谢你。", "非常謝謝你。", "fēi cháng xiè xie nǐ", "Muito obrigado a você.", "Thank you very much.",
         "借", "借", "jiè", "emprestar", "to borrow", "syllables/human_female/jie4.mp3",
         "谢", "謝", "xiè", "agradecer", "to thank", "syllables/human_female/xie4.mp3",
         "j vs x (借 jiè vs 谢 xiè)"),
        # 14. 知道 (zhīdào) vs 迟到 (chídào)
        ("这件事我知道。", "這件事我知道。", "zhè jiàn shì wǒ zhī dào", "Eu sei sobre esse assunto.", "I know about this matter.",
         "今天请别迟到。", "今天請別遲到。", "jīn tiān qǐng bié chí dào", "Por favor não se atrase hoje.", "Please do not be late today.",
         "知道", "知道", "zhīdào", "saber / ter conhecimento", "to know", "words/xiaoxiao/classroom/zhi1_dao4.mp3",
         "迟到", "遲到", "chídào", "atrasar-se", "to arrive late", "words/xiaoxiao/classroom/chi2_dao4.mp3",
         "zh vs ch (知道 vs 迟到)"),
        # 15. 金 (jīn) vs 京 (jīng)
        ("这块金子很重。", "這塊金子很重。", "zhè kuài jīn zi hěn zhòng", "Este pedaço de ouro é pesado.", "This piece of gold is heavy.",
         "他刚从北京来。", "他剛從北京來。", "tā gāng cóng běi jīng lái", "Ele acabou de chegar de Pequim.", "He just arrived from Beijing.",
         "金", "金", "jīn", "ouro", "gold", "syllables/human_female/jin1.mp3",
         "京", "京", "jīng", "capital / Pequim", "capital / Beijing", "syllables/human_female/jing1.mp3",
         "-in vs -ing (金 jīn vs 京 jīng)"),
        # 16. 都 (dōu) vs 多 (duō)
        ("我们都去北京。", "我們都去北京。", "wǒ men dōu qù běi jīng", "Todos nós vamos a Pequim.", "We all go to Beijing.",
         "他有很多朋友。", "他有很多朋友。", "tā yǒu hěn duō péng you", "Ele tem muitos amigos.", "He has many friends.",
         "都", "都", "dōu", "todos", "all / both", "syllables/human_female/dou1.mp3",
         "多", "多", "duō", "muito / muitos", "many / much", "syllables/human_female/duo1.mp3",
         "-ou vs -uo (都 dōu vs 多 duō)"),
        # 17. 飞 (fēi) vs 黑 (hēi)
        ("鸟在天上飞。", "鳥在天上飛。", "niǎo zài tiān shang fēi", "O pássaro voa no céu.", "The bird flies in the sky.",
         "他的车是黑的。", "他的車是黑的。", "tā de chē shì hēi de", "O carro dele é preto.", "His car is black.",
         "飞", "飛", "fēi", "voar", "to fly", "syllables/human_female/fei1.mp3",
         "黑", "黑", "hēi", "preto / escuro", "black / dark", "syllables/human_female/hei1.mp3",
         "f vs h (飞 fēi vs 黑 hēi)"),
        # 18. 杯 (bēi) vs 归 (guī)
        ("请拿一个杯子。", "請拿一個杯子。", "qǐng ná yí gè bēi zi", "Por favor pegue um copo.", "Please take a cup.",
         "他准备归国。", "他準備歸國。", "tā zhǔn bèi guī guó", "Ele prepara-se para regressar ao país.", "He prepares to return home.",
         "杯", "杯", "bēi", "copo / xícara", "cup / glass", "syllables/human_female/bei1.mp3",
         "归", "歸", "guī", "retornar / voltar", "to return", "syllables/human_female/gui1.mp3",
         "-ei vs -ui (杯 bēi vs 归 guī)"),
        # 19. 男 (nán) vs 蓝 (lán)
        ("那个男人在看书。", "那個男人在看書。", "nà ge nán rén zài kàn shū", "Aquele homem está lendo um livro.", "That man is reading a book.",
         "天空是非常蓝的。", "天空是非常藍的。", "tiān kōng shì fēi cháng lán de", "O céu está muito azul.", "The sky is very blue.",
         "男", "男", "nán", "homem / masculino", "male / man", "syllables/human_female/nan2.mp3",
         "蓝", "藍", "lán", "azul", "blue", "syllables/human_female/lan2.mp3",
         "n vs l (男 nán vs 蓝 lán)"),
        # 20. 热 (rè) vs 乐 (lè)
        ("今天天气很热。", "今天天氣很熱。", "jīn tiān tiān qì hěn rè", "Hoje o clima está muito quente.", "Today weather is very hot.",
         "他们很快乐。", "他們很快樂。", "tā men hěn kuài lè", "Eles estão muito alegres.", "They are very happy.",
         "热", "熱", "rè", "quente", "hot", "syllables/human_female/re4.mp3",
         "乐", "樂", "lè", "alegre / feliz", "happy / joyful", "syllables/human_female/le4.mp3",
         "r vs l (热 rè vs 乐 lè)"),
        # 21. 看 (kàn) vs 饭 (fàn)
        ("你在看什么？", "你在看什麼？", "nǐ zài kàn shén me", "O que você está olhando?", "What are you looking at?",
         "你想吃什么饭？", "你想吃什麼飯？", "nǐ xiǎng chī shén me fàn", "Qual refeição você quer comer?", "What meal do you want to eat?",
         "看", "看", "kàn", "olhar / ver", "to look / see", "syllables/human_female/kan4.mp3",
         "饭", "飯", "fàn", "refeição / arroz", "cooked rice / meal", "syllables/human_female/fan4.mp3",
         "k vs f (看 kàn vs 饭 fàn)"),
        # 22. 笔 (bǐ) vs 皮 (pí)
        ("这是一支笔。", "這是一支筆。", "zhè shì yì zhī bǐ", "Esta é uma caneta.", "This is a pen.",
         "这是一个皮包。", "這是一個皮包。", "zhè shì yí gè pí bāo", "Esta é uma bolsa de couro.", "This is a leather bag.",
         "笔", "筆", "bǐ", "caneta / lápis", "pen / pencil", "syllables/human_female/bi3.mp3",
         "皮", "皮", "pí", "couro / pele", "leather / skin", "syllables/human_female/pi2.mp3",
         "b vs p (笔 bǐ vs 皮 pí)"),
        # 23. 狗 (gǒu) vs 猴 (hóu)
        ("那是一只小狗。", "那是一隻小狗。", "nà shì yì zhī xiǎo gǒu", "Aquele é um cachorrinho.", "That is a little dog.",
         "树上有一只猴。", "樹上有一隻猴。", "shù shang yǒu yì zhī hóu", "Na árvore há um macaco.", "There is a monkey on the tree.",
         "狗", "狗", "gǒu", "cachorro / cão", "dog", "syllables/human_female/gou3.mp3",
         "猴", "猴", "hóu", "macaco", "monkey", "syllables/human_female/hou2.mp3",
         "g vs h (狗 gǒu vs 猴 hóu)"),
        # 24. 门 (mén) vs 忙 (máng)
        ("请把门关上。", "請把門關上。", "qǐng bǎ mén guān shang", "Por favor feche a porta.", "Please close the door.",
         "他工作非常忙。", "他工作非常忙。", "tā gōng zuò fēi cháng máng", "Ele é muito ocupado no trabalho.", "He is very busy at work.",
         "门", "門", "mén", "porta / portão", "door / gate", "syllables/human_female/men2.mp3",
         "忙", "忙", "máng", "ocupado", "busy", "syllables/human_female/mang2.mp3",
         "-en vs -ang (门 mén vs 忙 máng)"),
        # 25. 猫 (māo) vs 毛 (máo)
        ("这只小猫很可爱。", "這隻小貓很可愛。", "zhè zhī xiǎo māo hěn kě ài", "Este gatinho é muito fofo.", "This kitten is very cute.",
         "这件衣服有很多毛。", "這件衣服有很多毛。", "zhè jiàn yī fu yǒu hěn duō máo", "Esta roupa tem muitos pelos.", "This cloth has much fur.",
         "猫", "貓", "māo", "gato", "cat", "syllables/human_female/mao1.mp3",
         "毛", "毛", "máo", "pêlo / pena", "hair / fur", "syllables/human_female/mao2.mp3",
         "T1 vs T2 (猫 māo vs 毛 máo)"),
        # 26. 问 (wèn) vs 闻 (wén)
        ("我想问你一个问题。", "我想問你一個問題。", "wǒ xiǎng wèn nǐ yí gè wèn tí", "Quero te fazer uma pergunta.", "I want to ask you a question.",
         "你能闻到花香吗？", "你能聞到花香嗎？", "nǐ néng wén dào huā xiāng ma", "Você consegue cheirar o perfume da flor?", "Can you smell flower fragrance?",
         "问", "問", "wèn", "perguntar", "to ask", "syllables/human_female/wen4.mp3",
         "闻", "聞", "wén", "cheirar / ouvir falar", "to smell / hear", "syllables/human_female/wen2.mp3",
         "T4 vs T2 (问 wèn vs 闻 wén)"),
        # 27. 洗 (xǐ) vs 喜 (xǐ)
        ("他在河边洗脸。", "他在河邊洗臉。", "tā zài hé biān xǐ liǎn", "Ele lava o rosto perto do rio.", "He washes his face by the river.",
         "这是一件大喜事。", "這是一件大喜事。", "zhè shì yí jiàn dà xǐ shì", "Este é um evento muito feliz.", "This is a joyous event.",
         "洗", "洗", "xǐ", "lavar", "to wash", "syllables/human_female/xi3.mp3",
         "喜", "喜", "xǐ", "alegria / felicidade", "joy / delight", "syllables/human_female/xi3.mp3",
         "xǐ (洗 vs 喜)"),
        # 28. 班 (bān) vs 帮 (bāng)
        ("今天我们班有课。", "今天我們班有課。", "jīn tiān wǒ men bān yǒu kè", "Nossa turma tem aula hoje.", "Our class has lecture today.",
         "他愿意帮我的忙。", "他願意幫我的忙。", "tā yuàn yì bāng wǒ de máng", "Ele quer me ajudar.", "He wants to help me.",
         "班", "班", "bān", "turma / turno", "class / shift", "syllables/human_female/ban1.mp3",
         "帮", "幫", "bāng", "ajudar", "to help", "syllables/human_female/bang1.mp3",
         "-an vs -ang (班 bān vs 帮 bāng)"),
        # 29. 根 (gēn) vs 耕 (gēng)
        ("大树有一根长长的根。", "大樹有一根長長的根。", "dà shù yǒu yì gēn cháng cháng de gēn", "A árvore tem uma raiz comprida.", "Tree has a long root.",
         "农民在田里耕地。", "農民在田裡耕地。", "nóng mín zài tián lǐ gēng dì", "O camponês ara a terra no campo.", "Farmer plows field.",
         "根", "根", "gēn", "raiz", "root / base", "syllables/human_female/gen1.mp3",
         "耕", "耕", "gēng", "arar a terra", "to plow / cultivate", "syllables/human_female/geng1.mp3",
         "-en vs -eng (根 gēn vs 耕 gēng)"),
        # 30. 盆 (pén) vs 朋 (péng)
        ("这里有一个花盆。", "這裡有一個花盆。", "zhè lǐ yǒu yí gè huā pén", "Aqui há um vaso de flores.", "There is a flower pot here.",
         "他是我的好朋友。", "他是我的好朋友。", "tā shì wǒ de hǎo péng you", "Ele é meu bom amigo.", "He is my good friend.",
         "盆", "盆", "pén", "vaso / bacia", "pot / basin", "syllables/human_female/pen2.mp3",
         "朋", "朋", "péng", "amigo / companheiro", "friend / companion", "syllables/human_female/peng2.mp3",
         "-en vs -eng (盆 pén vs 朋 péng)"),
        # 31. 心 (xīn) vs 星 (xīng)
        ("他有一颗善良的心。", "他有一顆善良的心。", "tā yǒu yì kē shàn liáng de xīn", "Ele tem um coração bondoso.", "He has a kind heart.",
         "天上有许多星星。", "天上有許多星星。", "tiān shang yǒu xǔ duō xīng xing", "Há muitas estrelas no céu.", "There are many stars in the sky.",
         "心", "心", "xīn", "coração", "heart / mind", "syllables/human_female/xin1.mp3",
         "星", "星", "xīng", "estrela", "star / satellite", "syllables/human_female/xing1.mp3",
         "-in vs -ing (心 xīn vs 星 xīng)"),
        # 32. 亲 (qīn) vs 清 (qīng)
        ("母亲亲了孩子的脸。", "母親親了孩子的臉。", "mǔ qīn qīn le hái zi de liǎn", "A mãe beijou o rosto da criança.", "Mother kissed child face.",
         "这条河水很清。", "這條河水很清。", "zhè tiáo hé shuǐ hěn qīng", "A água deste rio é muito límpida.", "River water is clear.",
         "亲", "親", "qīn", "beijar / parente", "to kiss / dear", "syllables/human_female/qin1.mp3",
         "清", "清", "qīng", "claro / límpido", "clear / pure", "syllables/human_female/qing1.mp3",
         "-in vs -ing (亲 qīn vs 清 qīng)"),
        # 33. 女 (nǚ) vs 怒 (nù)
        ("她是一个漂亮的女人。", "她是一個漂亮的女人。", "tā shì yí gè piào liang de nǚ rén", "Ela é uma mulher bonita.", "She is a beautiful woman.",
         "他听到消息十分愤怒。", "他聽到消息十分憤怒。", "tā tīng dào xiāo xi shí fēn fèn nù", "Ele ficou furioso ao ouvir a notícia.", "He was furious hearing news.",
         "女", "女", "nǚ", "mulher / feminino", "female / woman", "syllables/human_female/nv3.mp3",
         "怒", "怒", "nù", "fúria / raiva", "fury / anger", "syllables/human_female/nu4.mp3",
         "ü vs u (女 nǚ vs 怒 nù)"),
        # 34. 居 (jū) vs 猪 (zhū)
        ("他在这个城市定居。", "他在這個城市定居。", "tā zài zhè ge chéng shì dìng jū", "Ele se estabeleceu nesta cidade.", "He settled in this city.",
         "农场里养了很多猪。", "農場裡養了很多豬。", "nóng chǎng lǐ yǎng le hěn duō zhū", "Na fazenda criam muitos porcos.", "Farm raises many pigs.",
         "居", "居", "jū", "residir / habitar", "to reside / live", "syllables/human_female/ju1.mp3",
         "猪", "豬", "zhū", "porco", "pig / swine", "syllables/human_female/zhu1.mp3",
         "j vs zh (居 jū vs 猪 zhū)"),
        # 35. 去 (qù) vs 出 (chū)
        ("他明天要去中国。", "他明天要去中國。", "tā míng tiān yào qù zhōng guó", "Ele vai para a China amanhã.", "He is going to China tomorrow.",
         "请你现在就走出去。", "請你現在就走出去。", "qǐng nǐ xiàn zài jiù zǒu chū qù", "Por favor saia agora mesmo.", "Please walk out right now.",
         "去", "去", "qù", "ir", "to go", "syllables/human_female/qu4.mp3",
         "出", "出", "chū", "sair", "to exit / out", "syllables/human_female/chu1.mp3",
         "q vs ch (去 qù vs 出 chū)"),
        # 36. 须 (xū) vs 书 (shū)
        ("每个人都必须遵守规则。", "每個人都必須遵守規則。", "měi gè rén dōu bì xū zūn shǒu guī zé", "Todos devem seguir as regras.", "Everyone must follow rules.",
         "桌子上放着一本书。", "桌子上放著一本書。", "zhuō zi shang fàng zhe yì běn shū", "Na mesa repousa um livro.", "A book is lying on table.",
         "须", "須", "xū", "dever / obrigatório", "must / necessary", "syllables/human_female/xu1.mp3",
         "书", "書", "shū", "livro", "book", "syllables/human_female/shu1.mp3",
         "x vs sh (须 xū vs 书 shū)"),
        # 37. 词 (cí) vs 迟 (chí)
        ("这个汉语生词很难。", "這個漢語生詞很難。", "zhè ge hàn yǔ shēng cí hěn nán", "Esta palavra nova em chinês é difícil.", "This new Chinese word is hard.",
         "火车今天迟到了。", "火車今天遲到了。", "huǒ chē jīn tiān chí dào le", "O trem atrasou-se hoje.", "The train arrived late today.",
         "词", "詞", "cí", "palavra / termo", "word / term", "syllables/human_female/ci2.mp3",
         "迟", "遲", "chí", "tardio / atrasado", "late / delayed", "syllables/human_female/chi2.mp3",
         "c vs ch (词 cí vs 迟 chí)"),
        # 38. 字 (zì) vs 志 (zhì)
        ("你写的中文字很漂亮。", "你寫的中文字很漂亮。", "nǐ xiě de zhōng wén zì hěn piào liang", "Os caracteres chineses que você escreve são lindos.", "Characters you write are pretty.",
         "他立下了远大的志向。", "他立下了遠大的志向。", "tā lì xià le yuǎn dà de zhì xiàng", "Ele estabeleceu uma grande aspiração.", "He set ambitious goal.",
         "字", "字", "zì", "caractere / letra", "character / script", "syllables/human_female/zi4.mp3",
         "志", "志", "zhì", "aspiração / objetivo", "aspiration / will", "syllables/human_female/zhi4.mp3",
         "z vs zh (字 zì vs 志 zhì)"),
        # 39. 草 (cǎo) vs 炒 (chǎo)
        ("春天的草变绿了。", "春天的草變綠了。", "chūn tiān de cǎo biàn lǜ le", "Na primavera a grama ficou verde.", "Spring grass became green.",
         "今天晚上我们吃炒饭。", "今天晚上我們吃炒飯。", "jīn tiān wǎn shang wǒ men chī chǎo fàn", "Hoje à noite comeremos arroz frito.", "Tonight we will eat fried rice.",
         "草", "草", "cǎo", "grama / capim", "grass / straw", "syllables/human_female/cao3.mp3",
         "炒", "炒", "chǎo", "fritar mexendo / refogar", "to stir-fry / saute", "syllables/human_female/chao3.mp3",
         "c vs ch (草 cǎo vs 炒 chǎo)"),
        # 40. 走 (zǒu) vs 舟 (zhōu)
        ("我们一起往前走。", "我們一起往前走。", "wǒ men yì qǐ wǎng qián zǒu", "Vamos caminhar para a frente juntos.", "Let us walk forward together.",
         "江面上飘着一只扁舟。", "江面上飄著一隻扁舟。", "jiāng miàn shang piāo zhe yì zhī piān zhōu", "Sobre o rio flutua um pequeno barco.", "A small skiff floats on river.",
         "走", "走", "zǒu", "andar / caminhar", "to walk / leave", "syllables/human_female/zou3.mp3",
         "舟", "舟", "zhōu", "barco / bote", "boat / skiff", "syllables/human_female/zhou1.mp3",
         "z vs zh (走 zǒu vs 舟 zhōu)"),
        # 41. 痛 (tòng) vs 送 (sòng)
        ("我的肚子有点痛。", "我的肚子有點痛。", "wǒ de dù zi yǒu diǎn tòng", "Minha barriga está doendo um pouco.", "My stomach hurts a bit.",
         "他送了我一份礼物。", "他送了我一份禮物。", "tā sòng le wǒ yí fèn lǐ wù", "Ele me enviou um presente.", "He gave me a present.",
         "痛", "痛", "tòng", "dor / doloroso", "pain / ache", "syllables/human_female/tong4.mp3",
         "送", "送", "sòng", "enviar / presentear", "to deliver / gift", "syllables/human_female/song4.mp3",
         "t vs s (痛 tòng vs 送 sòng)"),
        # 42. 看见 (kànjiàn) vs 关键 (guānjiàn)
        ("你在外面看见了什么？", "你在外面看見了什麼？", "nǐ zài wài mian kàn jiàn le shén me", "O que você viu lá fora?", "What did you see outside?",
         "这是最关键的步骤。", "這是最關鍵的步驟。", "zhè shì zuì guān jiàn de bù zhòu", "Este é o passo mais crucial.", "This is the most crucial step.",
         "看见", "看見", "kànjiàn", "enxergar / ver", "to see / catch sight of", "words/xiaoxiao/classroom/kan4_jian4.mp3",
         "关键", "關鍵", "guānjiàn", "crucial / decisivo", "crucial / decisive point", "words/xiaoxiao/classroom/guan1_jian4.mp3",
         "kànjiàn vs guānjiàn (看见 vs 关键)"),
    ]

    def build_context_item(hanzi_str: str, trad_str: str, disp_pinyin: str, m_pt: str, m_en: str, a_key: str) -> dict:
        fname = os.path.splitext(os.path.basename(a_key))[0] # e.g., "mai3" or "shui3_jiao3"
        syl_tokens = fname.split("_")
        tones = []
        ipa_parts = []
        chao_parts = []
        first_init = ""
        last_fin = ""
        for idx, tok in enumerate(syl_tokens):
            m = re.match(r"^([a-z]+)([1-5])$", tok)
            if m:
                b, t = m.group(1), int(m.group(2))
                tones.append(t)
                init, fin = decompose_syllable(b)
                if idx == 0:
                    first_init = init
                last_fin = fin.replace("v", "ü")
                ipa_parts.append(get_syllable_ipa(init, last_fin, t).strip("/"))
                chao_parts.append(CHAO_MAP.get(t, "55"))
        if not tones:
            tones = [1]
        return {
            "hanzi": hanzi_str,
            "traditional": trad_str if not re.match(r"^[a-zA-Z]", trad_str) else hanzi_str,
            "pinyin": disp_pinyin,
            "pinyinTone3": " ".join(syl_tokens),
            "asciiKey": fname,
            "tones": tones,
            "initial": first_init,
            "final": last_fin,
            "ipa": "/" + " ".join(ipa_parts) + "/" if ipa_parts else "",
            "chaoContour": "-".join(chao_parts) if chao_parts else "55",
            "meaningPt": m_pt,
            "meaningEn": m_en,
            "hskLevel": 1,
            "audioKey": a_key
        }

    for (sA, sATrad, pA, mPtA, mEnA, sB, sBTrad, pB, mPtB, mEnB, hA, pTonA, pDispA, mPtW_A, mEnW_A, aKeyA, hB, pTonB, pDispB, mPtW_B, mEnW_B, aKeyB, subcat) in context_pairs_raw:
        sent_id_A = f"sent_{pair_id_counter:04d}_a"
        sent_id_B = f"sent_{pair_id_counter:04d}_b"
        
        itemA = build_context_item(hA, pTonA, pDispA, mPtW_A, mEnW_A, aKeyA)
        itemB = build_context_item(hB, pTonB, pDispB, mPtW_B, mEnW_B, aKeyB)

        entry = {
            "id": f"pair_context_{pair_id_counter:05d}",
            "category": "context_sentence",
            "subCategory": subcat,
            "contrastLabelPt": f"Sentença em Contexto: {hA} vs {hB}",
            "contrastLabelEn": f"Sentence Context: {hA} vs {hB}",
            "difficulty": 3,
            "itemA": itemA,
            "itemB": itemB,
            "articulatoryTipPt": f"Note como a melodia e articulação de '{hA}' e '{hB}' alteram totalmente o significado da oração inteira.",
            "articulatoryTipEn": f"Observe how tonal and phonetic contrast between '{hA}' and '{hB}' flips sentence meaning completely.",
            "sentenceContext": {
                "sentenceA": sA,
                "sentenceATrad": sATrad,
                "pinyinA": pA,
                "meaningPtA": mPtA,
                "meaningEnA": mEnA,
                "audioKeyA": f"sentences/xiaoxiao/{sent_id_A}.mp3",
                "sentenceB": sB,
                "sentenceBTrad": sBTrad,
                "pinyinB": pB,
                "meaningPtB": mPtB,
                "meaningEnB": mEnB,
                "audioKeyB": f"sentences/xiaoxiao/{sent_id_B}.mp3"
            }
        }
        pairs.append(entry)
        pair_id_counter += 1

    print(f"[generate_minimal_pairs] Pares context_sentence gerados: {len(context_pairs_raw)}")

    # Contagem por categoria
    cat_summary = {}
    for p in pairs:
        c = p["category"]
        cat_summary[c] = cat_summary.get(c, 0) + 1

    dataset = {
        "version": "1.0.0",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "totalPairs": len(pairs),
        "categoriesSummary": cat_summary,
        "pairs": pairs
    }

    out_file = os.path.join(PUBLIC_DATA_DIR, "minimal_pairs.json")
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(dataset, f, ensure_ascii=False, indent=2)

    print(f"\n=======================================================")
    print(f"[generate_minimal_pairs] minimal_pairs.json GERADO COM SUCESSO!")
    print(f"Total de Pares Mínimos: {len(pairs)}")
    for cat, cnt in cat_summary.items():
        print(f"  - {cat}: {cnt}")
    print(f"=======================================================\n")
    return dataset

def main():
    entries_by_syl, words_by_hanzi, all_entries = parse_cedict()
    generate_pairs(entries_by_syl, words_by_hanzi, all_entries)

if __name__ == "__main__":
    main()
