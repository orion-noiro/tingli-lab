---
trigger: glob
globs: "*.ts, *.tsx, *.sql, package.json, scripts/*"
description: "Governança estrita de deploy em produção (Vercel + Supabase), migrações aditivas sem perda de dados, testes automatizados e proibição de secrets no git."
---

# Governança de Produção & Automação Contínua (TīngLì Lab V2.0)

Esta regra é obrigatória e deve ser seguida em todas as modificações, correções e atualizações do sistema para garantir disponibilidade 24/7, zero perda de dados e deploys sem fricção.

### 1. Invariante de Dados Zero-Loss (Supabase PostgreSQL)
- **PROIBIDO** executar `DROP TABLE`, `TRUNCATE` ou remoções destrutivas de colunas em produção (`data/tingli_imperial.db` ou Supabase remoto).
- **OBRIGATÓRIO** utilizar migrações exclusivamente **aditivas e idempotentes**:
  - `CREATE TABLE IF NOT EXISTS ...`
  - `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...`
  - `CREATE INDEX IF NOT EXISTS ...`
- Dados de usuários (`users`), histórico de estudo (`study_logs`), salas e duelos (`sync_rooms`, `async_challenges`, `daily_exams`) devem ser preservados em qualquer atualização estrutural.

### 2. Camada Dual-Mode (`src/lib/cloud-db.ts`)
- Todas as rotas de backend e APIs devem operar através do adaptador unificado `src/lib/cloud-db.ts`.
- Em produção na nuvem, as consultas devem utilizar a API REST/Data API HTTPS do `@supabase/supabase-js` (`supabaseAdmin`), contornando restrições de portas TCP 5432/IPv6 de ISPs locais.
- Fallback para SQLite local (`getImperialDb()`) ocorre apenas em desenvolvimento offline quando as variáveis de ambiente do Supabase não estiverem presentes.

### 3. Sanitização e Invariante Zero-Secrets
- **NUNCA** incluir tokens, service role keys ou senhas diretamente no código fonte rastreado pelo Git.
- Chaves devem residir estritamente em `.env.local` (ignorado pelo `.gitignore`) e nas Variáveis de Ambiente da Vercel.
- O Git Push Protection do GitHub está ativo e bloqueará qualquer commit com padrões de chave exposta.

### 4. Build & Compatibilidade Vercel Serverless
- A versão do Next.js deve permanecer na branch estável não vulnerável (`16.4.5` ou superior).
- Chamadas de sistema de arquivos dinâmico no App Router devem incluir a anotação `/*turbopackIgnore: true*/` para evitar o empacotamento acidental de milhares de arquivos estáticos nas serverless functions.
- Qualquer novo endpoint dinâmico deve exportar `export const runtime = "nodejs";`.

### 5. Ciclo de Deploy Autônomo
- Todo update de funcionalidade ou correção deve ser validado localmente via `npm run build` antes do envio.
- O envio via `git push origin main` aciona automaticamente o build e deploy na Vercel.
- Após o deploy, deve-se rodar o script de verificação `node scripts/test_deployment_integrity.js` para garantir status 200 em todas as rotas e persistência remota íntegra.
