# TīngLì Lab (听力实验室) V2.0 — Architecture & Agent Governance

## 1. Visão Geral do Projeto
**TīngLì Lab (听力实验室) — Mandarin Phonetic, Prosody & Minimal Pairs Mastery** é uma plataforma web científica de treinamento auditivo, percepção tonal, pares mínimos dissilábicos, compreensão prosódica em frases inteiras e multiplayer competitivo/cooperativo do Chinês Mandarim Padrão (Putonghua), projetada especialmente para falantes de Português Brasileiro (PT-BR / EN).

Na **Versão 2.0**, o sistema adota:
- **Estética Minimalista Clássica da China Antiga (Dinastia Song / Pintura *Shuǐmòhuà* 水墨画 e Papel Xuan 宣纸)**: Zero cores neon, zero poluição visual, máximo 1 foco cognitivo por seção para otimizar o processamento no córtex auditivo.
- **Motor de Áudio Híbrido Multi-Voz + Self-Healing TTS (`/api/tts`)**: Suporte garantido a **6 vozes neurais nativas (`edge-tts`) + gravações humanas de estúdio** em **2 velocidades** (`classroom` `-25%` e `conversational` `+0%`), com cache permanente em disco (`public/audio/generated/`) e fallback de concatenação Web Audio API.
- **Metodologia de Linguística Aplicada (HVPT, PAM/SLM, Coarticulação Prosódica)**: Treino de Alta Variabilidade Fonética (estímulo X em voz distinta de A/B), contrastes de VOT/aspiração, sibilantes/retroflexas/alvéolo-palatais, codas nasais (`-n` vs `-ng`), matriz de 20 combinações dissilábicas e **Módulo Completo de Frases Inteiras (`sentences_minimal_pairs.json`)**.
- **Contas Reais (Login e Senha em SQLite) & Multiplayer Síncrono e Assíncrono**: Autenticação persistida em `data/tingli_imperial.db`, Duelos 1v1 e Salas Ao Vivo em tempo real, Desafios contra o "Fantasma" de Amigos (Ghost Duel), Metas Coletivas da Irmandade e Exames Imperiais Diários/Semanais (科举 *Kējǔ*).

## 2. Regra de Ouro: "Code-Over-Tokens"
- **PROIBIDO** gerar dicionários extensos, listas massivas de pares mínimos ou JSONs gigantes diretamente via texto do LLM.
- **OBRIGATÓRIO** utilizar scripts Python determinísticos em `scripts/` para auditar, corrigir e expandir os datasets (`minimal_pairs.json`, `sentences_minimal_pairs.json`, `syllables_chart.json`, `tone_sandhi.json`, `sound_guides_pt.json`) e pré-gerar áudios verificados (`> 2048 bytes`).

## 3. Estrutura de Diretórios V2.0
```text
/
├── AGENTS.md                          # Governança principal do workspace (sem frontmatter)
├── .agents/
│   ├── rules/                         # Regras modulares planas (com YAML frontmatter)
│   │   ├── audio-data-integrity.md
│   │   ├── classical-ui-minimalism.md
│   │   └── frontend-standards.md
│   └── agents/                        # Definições de subagentes especializados (model: flash)
│       ├── audio-repair-agent.md
│       ├── backend-multiplayer-agent.md
│       ├── classical-ui-agent.md
│       ├── data-audio-pipeline.md
│       └── ui-builder.md
├── data/
│   └── tingli_imperial.db             # Banco SQLite real (usuários, sessões, salas síncronas, duelos fantasma, exames)
├── scripts/                           # Pipeline determinístico Python (Code-Over-Tokens)
│   ├── audit_and_fix_audio.py         # Auditoria do acervo, correção de chaves dissilábicas e geração de sentences_minimal_pairs.json
│   ├── pregenerate_all_multisyl.py    # Pré-geração assíncrona multi-voz/velocidade com Semaphore(5) e validação >2KB
│   ├── build_dataset.py               # Ingestão CC-CEDICT/HSK, matriz de sílabas, Tone Sandhi e Guias PT-BR
│   ├── generate_minimal_pairs.py      # Geração algorítmica de >3.400 pares mínimos verificados
│   ├── build_audio.py                 # Ingestão de sílabas humanas + síntese Neural multi-voz/velocidade
│   └── verify_and_extract_f0.py       # Validação de integridade de áudio + extração F0 (Chao 1-5)
├── public/
│   ├── audio/
│   │   ├── syllables/{voice_id}/      # Sílabas canônicas normalizadas (ex.: ba1.mp3, lv3.mp3)
│   │   ├── words/{voice_id}/{speed}/  # Palavras dissilábicas (classroom & conversational)
│   │   ├── sentences/{voice_id}/      # Sentenças contextuais de pares mínimos
│   │   └── generated/                 # Cache permanente do Self-Healing TTS (/api/tts)
│   └── data/
│       ├── minimal_pairs.json         # >3.400 pares mínimos categorizados e verificados (PT-BR & EN)
│       ├── sentences_minimal_pairs.json # >300 pares de frases inteiras, caça-tom prosódico e reconstrução
│       ├── syllables_chart.json       # Tabela Pinyin completa (410+ sílabas × 5 tons + IPA + exemplos)
│       ├── tone_sandhi.json           # Regras e exercícios de Tone Sandhi (T3+T3, Half-T3, 不, 一, Tom Neutro)
│       ├── sound_guides_pt.json       # Guias articulatórios detalhados para lusófonos
│       └── audio_manifest.json        # Manifesto verificado de todos os áudios com vetores F0 reais
└── src/
    ├── app/
    │   ├── api/
    │   │   ├── tts/route.ts           # Self-Healing TTS Backend API (6 vozes + 2 velocidades + cache em disco)
    │   │   ├── auth/                  # Rotas de autenticação (register, login, logout, me)
    │   │   └── multiplayer/           # Rotas de salas síncronas, duelos fantasma, exames imperiais e leaderboard
    │   ├── globals.css                # Sistema de design Papel Xuan & Tinta Sumi
    │   ├── layout.tsx                 # Fontes clássicas (Noto Serif SC, EB Garamond, Andika, Inter)
    │   └── page.tsx                   # Arquitetura limpa em 5 Abas Principais
    ├── components/                    # Componentes modulares das 5 Abas e Modal de Autenticação Hànlín Yuàn
    ├── lib/                           # Banco SQLite, Auth, Áudio Player Híbrido, FSRS e DSP
    └── types/                         # Contratos TypeScript estritos
```

## 4. Direção de Arte e Paleta Semântica Clássica (Zero Neon)
- **Modo Papel Xuan (Padrão)**:
  - Fundo Principal: `#F5F2E9` (Papel Xuan envelhecido suave)
  - Fundo de Cartões: `#EBE6D8` (Seda crua / Pergaminho secundário)
  - Fundo de Destaque: `#E0D9C8` (Pedra clara)
  - Texto Principal: `#1E1D1B` (Tinta Sumi *Mò* 墨)
  - Texto Secundário: `#5C5852` (Cinza carvão suave)
  - Bordas Finas: `#D2CBB8` (`1px solid`)
- **Modo Estudo Noturno (Pedra de Tinta *Yàntái* 砚台)**:
  - Fundo Principal: `#181715` | Cartões: `#22201D` | Texto: `#DCD6C8` | Secundário: `#8C857B` | Bordas: `#33302B`
- **Acentos Tradicionais e Semântica Tonal**:
  - **Tom 1 (`55` `/˥/` — Azul Índigo Mineral 花青 *Huāqīng*)**: `#3B596A`
  - **Tom 2 (`35` `/˧˥/` — Jade Imperial 翡翠 *Fěicuì*)**: `#3A6B59`
  - **Tom 3 (`214` `/˨˩˦/` — Ocre Bronze Antigo 青铜 *Qīngtóng*)**: `#9C7A3C`
  - **Tom 4 (`51` `/˥˩/` — Vermelho Cinábrio Imperial 朱砂 *Zhūshā*)**: `#9E2A2B`
  - **Tom 5 (`Neutro` — Cinza Pedra)**: `#7A756C`

## 5. Navegação Limpa em 5 Abas e Regra Anti-Poluição
1. **听音 · Escuta & Treino**: Tela Zen com apenas o botão central de áudio (selo/círculo de tinta), controles discretos (Modo, Voz, Velocidade, HVPT) e cartões de resposta. Nenhum gráfico ou texto longo é exibido antes da resposta!
2. **整句 · Frases em Contexto**: Pares mínimos em sentenças completas, Caça-Tom em Frase Contínua e Reconstrução Auditiva de Frase.
3. **对比 · Laboratório de Comparação**: Comparador lado a lado de sílabas, dissílabos, Tone Sandhi, Guias Articulatórios PT-BR e Tabela Pinyin 410+.
4. **同窗 · Multiplayer & Duelos**: Salas Síncronas Ao Vivo (1v1, Arena de Grupo e Parceiro de Escuta Cega), Duelos Assíncronos contra Fantasma, Metas Coletivas da Irmandade e Exames Imperiais (科举 *Kējǔ*).
5. **竹简 · Meu Registro**: Estatísticas acústicas, matriz de confusão, radar diagnóstico, treino de produção oral $F_0$ e histórico de partidas.
