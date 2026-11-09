---
trigger: model_decision
description: "Regras estritas de validação fonética, nomenclatura Pinyin Tone3, verificação de F0 e proibição de dados sintéticos não verificados."
---

# Regras de Integridade de Dados Fonéticos e Áudio (TīngLì Lab)

1. **Proibição de Dados Não Verificados**:
   - Todo par mínimo deve ser derivado de entradas reais do dicionário **CC-CEDICT** e/ou listas oficiais **HSK**, garantindo que o Hanzi (Simplificado e Tradicional), o Pinyin com marcas tonais, o Pinyin numérico (Tone3) e a transcrição IPA correspondam exatamente à pronúncia padrão de Pequim (Putonghua).
   - Nunca invente combinações de caracteres inexistentes para forçar um par mínimo.

2. **Padrão de Nomenclatura Pinyin Tone3 (ASCII)**:
   - Arquivos de áudio de sílabas devem seguir o padrão `{pinyin_ascii}{tone_1_to_5}.mp3` em letras minúsculas.
   - Conversão obrigatória de `ü` para `v` em nomes de arquivos (`lv1..lv4`, `nv1..nv4`, `lve4`, `nve4`). Quando precedido por `j`, `q`, `x`, `y`, o Pinyin padrão escreve `u` (`ju`, `qu`, `xu`, `yu`), mantendo `u` no nome do arquivo, mas registrando a vogal `/y/` nos metadados fonéticos e guias de som.

3. **Controle de Polifônicos (多音字 *Duōyīnzì*)**:
   - Antes de sintetizar sílabas ou palavras via TTS neural (`edge-tts`), valide a leitura canônica via `pypinyin`.
   - Para sílabas isoladas, escolha sempre um caractere representante **monofônico** de alta frequência para evitar que o modelo neural escolha uma leitura alternativa (ex.: usar 妈 `mā`, 麻 `má`, 马 `mǎ`, 骂 `mà`; evitar caracteres ambíguos isolados como 行, 长, 重, 还, 得, 觉).

4. **Extração e Validação Acústica ($F_0$)**:
   - Nenhum arquivo de áudio com tamanho zero ou duração inferior a `0.15s` é permitido no manifesto.
   - Os vetores de contorno $F_0$ em `public/data/audio_manifest.json` devem conter valores normalizados na escala tonal de Yuen Ren Chao (`1.0` a `5.0`, com `30` pontos temporais uniformemente amostrados sobre o segmento sonoro da sílaba/palavra).
