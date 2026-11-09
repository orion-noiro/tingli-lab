---
trigger: glob
globs: "*.tsx, *.ts, *.css"
description: "Padrões de UI/UX didática, tipografia clássica (Noto Serif SC / Andika / Inter), Web Audio API e acessibilidade de atalhos de teclado."
---

# Padrões de Frontend, Tipografia Fonética e Web Audio (TīngLì Lab V2.0)

1. **Tipografia Clássica e Pedagógica**:
   - Cabeçalhos e caracteres chineses (Simplificado e Tradicional) devem utilizar serifadas clássicas elegantes: `"Noto Serif SC"`, `"Songti SC"`, `"EB Garamond"`, `serif`.
   - Textos em Pinyin e transcrições IPA devem usar fontes sans-serif limpas com suporte completo a diacríticos combinantes (`"Andika"`, `"Inter"`, `sans-serif`: `ā á ǎ à ē é ě è ī í ǐ ì ō ó ǒ ò ū ú ǔ ù ǖ ǘ ǚ ǜ`).

2. **Semântica Visual de Tons Clássica (Chao 1–5, Zero Neon)**:
   - Mantenha consistência absoluta de cores minerais tradicionais em todos os botões, selos, matrizes e curvas $F_0$:
     - **Tom 1 (`55` Alto Nivelado)**: `#3B596A` (Azul Índigo Mineral 花青 *Huāqīng*)
     - **Tom 2 (`35` Ascendente)**: `#3A6B59` (Jade Imperial 翡翠 *Fěicuì*)
     - **Tom 3 (`214` Baixo / Curvo)**: `#9C7A3C` (Ocre Bronze Antigo 青铜 *Qīngtóng*)
     - **Tom 4 (`51` Descendente Brusco)**: `#9E2A2B` (Vermelho Cinábrio Imperial 朱砂 *Zhūshā*)
     - **Tom 5 (Neutro / Leve)**: `#7A756C` (Cinza Pedra)

3. **Ergonomia Keyboard-First (Zero Mouse Friction)**:
   - Todos os modos de treino devem registrar listeners de teclado globais seguros (ignorando quando o foco estiver em um `<input>` ou `<textarea>`):
     - `R` ou `Space`: Replay do áudio atual
     - `S`: Alternar velocidade (`classroom` ↔ `conversational`)
     - `V`: Alternar voz nativa (6 vozes neurais + vozes humanas)
     - `1..5` ou `A / B`: Responder imediatamente
     - `H`: Revelar/Ocultar dicas visuais
     - `Enter`: Avançar para o próximo item

4. **Pipeline de Áudio Self-Healing & Web Audio API**:
   - Todo áudio deve usar o motor unificado que consulta arquivos locais verificados e a rota Self-Healing `/api/tts`, além de fallback de concatenação com crossfade de `40ms` via Web Audio API para dissílabos. Nenhum botão de áudio pode falhar jamais.
