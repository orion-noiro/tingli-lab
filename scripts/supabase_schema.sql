-- TīngLì Lab (听力实验室) — Supabase PostgreSQL Schema
-- Cole este script no SQL Editor do Supabase e clique em "Run".

-- 1. Tabela de Usuários
CREATE TABLE IF NOT EXISTS public.users (
  id BIGSERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  scholar_rank TEXT NOT NULL DEFAULT '童生 Tóngshēng',
  elo_rating INTEGER NOT NULL DEFAULT 1000,
  streak_days INTEGER NOT NULL DEFAULT 1,
  xp INTEGER NOT NULL DEFAULT 0,
  dissyllable_correct INTEGER NOT NULL DEFAULT 0,
  dissyllable_total INTEGER NOT NULL DEFAULT 0,
  sentence_correct INTEGER NOT NULL DEFAULT 0,
  sentence_total INTEGER NOT NULL DEFAULT 0,
  total_reaction_ms BIGINT NOT NULL DEFAULT 0,
  total_attempts INTEGER NOT NULL DEFAULT 0,
  profile_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Tabela de Sessões
CREATE TABLE IF NOT EXISTS public.sessions (
  token TEXT PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  expires_at BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Tabela de Logs de Estudo
CREATE TABLE IF NOT EXISTS public.study_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL,
  category TEXT NOT NULL,
  sub_category TEXT NOT NULL,
  target_id TEXT NOT NULL,
  correct INTEGER NOT NULL,
  reaction_ms INTEGER NOT NULL,
  voice_used TEXT NOT NULL,
  speed_used TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. Matriz de Confusão
CREATE TABLE IF NOT EXISTS public.confusion_matrix (
  user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  matrix_type TEXT NOT NULL,
  pair_key TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, matrix_type, pair_key)
);

-- 5. Salas de Duelo Síncrono (Ao Vivo)
CREATE TABLE IF NOT EXISTS public.sync_rooms (
  code TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  host_user_id BIGINT NOT NULL,
  host_name TEXT NOT NULL,
  room_mode TEXT NOT NULL DEFAULT 'duel_1v1',
  focus_category TEXT NOT NULL DEFAULT 'dissyllable_tone_matrix',
  total_rounds INTEGER NOT NULL DEFAULT 10,
  speed TEXT NOT NULL DEFAULT 'conversational',
  status TEXT NOT NULL DEFAULT 'lobby',
  current_round INTEGER NOT NULL DEFAULT 0,
  round_started_at BIGINT NOT NULL DEFAULT 0,
  questions_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint
);

-- 6. Jogadores na Sala
CREATE TABLE IF NOT EXISTS public.sync_room_players (
  room_code TEXT NOT NULL REFERENCES public.sync_rooms(code) ON DELETE CASCADE,
  user_id BIGINT NOT NULL,
  username TEXT NOT NULL,
  display_name TEXT NOT NULL,
  scholar_rank TEXT NOT NULL,
  elo_rating INTEGER NOT NULL,
  is_ready INTEGER NOT NULL DEFAULT 1,
  score INTEGER NOT NULL DEFAULT 0,
  combo INTEGER NOT NULL DEFAULT 0,
  correct_count INTEGER NOT NULL DEFAULT 0,
  total_reaction_ms BIGINT NOT NULL DEFAULT 0,
  answers_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  partner_hint_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (room_code, user_id)
);

-- 7. Desafios Assíncronos (Ghost Duel)
CREATE TABLE IF NOT EXISTS public.async_challenges (
  id TEXT PRIMARY KEY,
  challenger_id BIGINT NOT NULL,
  challenger_name TEXT NOT NULL,
  challenger_rank TEXT NOT NULL,
  target_username TEXT NOT NULL DEFAULT '',
  focus_category TEXT NOT NULL,
  seed TEXT NOT NULL,
  questions_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  ghost_log_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  challenger_score INTEGER NOT NULL,
  challenger_accuracy INTEGER NOT NULL,
  challenger_avg_ms INTEGER NOT NULL,
  attempts_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 8. Metas Coletivas da Irmandade
CREATE TABLE IF NOT EXISTS public.collective_goals (
  id TEXT PRIMARY KEY,
  title_pt TEXT NOT NULL,
  description_pt TEXT NOT NULL,
  goal_type TEXT NOT NULL,
  target_value INTEGER NOT NULL,
  current_value INTEGER NOT NULL DEFAULT 0,
  contributors_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 9. Exames Imperiais Diários
CREATE TABLE IF NOT EXISTS public.daily_exams (
  exam_key TEXT NOT NULL,
  user_id BIGINT NOT NULL,
  username TEXT NOT NULL,
  display_name TEXT NOT NULL,
  scholar_rank TEXT NOT NULL,
  score INTEGER NOT NULL,
  accuracy INTEGER NOT NULL,
  avg_reaction_ms INTEGER NOT NULL,
  details_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (exam_key, user_id)
);

-- Inserir Metas Coletivas Iniciais se não existirem
INSERT INTO public.collective_goals (id, title_pt, description_pt, goal_type, target_value, current_value)
VALUES 
  ('goal_dissyllables_1000', '1.000 Dissílabos Dominados', 'A Irmandade deve acertar 1.000 palavras de 2 sílabas nas 20 combinações tonais.', 'dissyllable', 1000, 185),
  ('goal_sentences_300', '300 Frases em Contexto', 'A Irmandade deve completar 300 exercícios com sentenças inteiras em mandarim natural.', 'sentence', 300, 72),
  ('goal_total_attempts_5000', '5.000 Escutas Ativas', 'Acumular 5.000 exercícios de treino auditivo realizados por todos os membros.', 'total_attempts', 5000, 890)
ON CONFLICT (id) DO NOTHING;

-- Ativar Realtime para as salas de duelo ao vivo (instantâneo via WebSockets)
ALTER PUBLICATION supabase_realtime ADD TABLE public.sync_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sync_room_players;
