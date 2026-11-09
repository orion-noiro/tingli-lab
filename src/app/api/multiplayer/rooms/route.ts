import { NextRequest, NextResponse } from "next/server";
import { computeScholarRank, getImperialDb } from "@/lib/imperial-db";

export const runtime = "nodejs";

function generateRoomCode(): string {
  const prefixes = ["龍", "鳳", "墨", "玉", "竹", "琴", "剣", "詩"];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const num = Math.floor(100 + Math.random() * 900);
  return `${prefix}-${num}`;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const code = (searchParams.get("code") || "").trim().toUpperCase();
  const db = getImperialDb();

  if (code) {
    // Allow matching with or without prefix if user typed only digits
    let roomRow = db
      .prepare("SELECT * FROM sync_rooms WHERE UPPER(code) = ?")
      .get(code);
    if (!roomRow && /^\d{3,4}$/.test(code)) {
      roomRow = db
        .prepare("SELECT * FROM sync_rooms WHERE code LIKE ?")
        .get(`%-${code}`);
    }
    if (!roomRow) {
      return NextResponse.json(
        { error: "Sala não encontrada no Pavilhão de Duelos." },
        { status: 404 }
      );
    }

    const actualCode = String(roomRow.code);
    const playerRows = db
      .prepare(
        "SELECT * FROM sync_room_players WHERE room_code = ? ORDER BY score DESC, total_reaction_ms ASC"
      )
      .all(actualCode);

    return NextResponse.json({
      room: {
        code: actualCode,
        title: String(roomRow.title),
        hostUserId: Number(roomRow.host_user_id),
        hostName: String(roomRow.host_name),
        roomMode: String(roomRow.room_mode),
        focusCategory: String(roomRow.focus_category),
        totalRounds: Number(roomRow.total_rounds),
        speed: String(roomRow.speed),
        status: String(roomRow.status),
        currentRound: Number(roomRow.current_round),
        roundStartedAt: Number(roomRow.round_started_at),
        questions: JSON.parse(String(roomRow.questions_json || "[]")),
        createdAt: String(roomRow.created_at),
        updatedAt: Number(roomRow.updated_at),
      },
      players: playerRows.map((p) => ({
        userId: Number(p.user_id),
        username: String(p.username),
        displayName: String(p.display_name),
        scholarRank: String(p.scholar_rank),
        eloRating: Number(p.elo_rating),
        isReady: Boolean(p.is_ready),
        score: Number(p.score),
        combo: Number(p.combo),
        correctCount: Number(p.correct_count),
        totalReactionMs: Number(p.total_reaction_ms),
        answers: JSON.parse(String(p.answers_json || "{}")),
        partnerHints: JSON.parse(String(p.partner_hint_json || "{}")),
      })),
    });
  }

  // Return open lobby rooms
  const rooms = db
    .prepare(
      "SELECT * FROM sync_rooms WHERE status IN ('lobby', 'playing') ORDER BY updated_at DESC LIMIT 20"
    )
    .all()
    .map((r) => {
      const pCount = db
        .prepare("SELECT COUNT(*) as cnt FROM sync_room_players WHERE room_code = ?")
        .get(String(r.code));
      return {
        code: String(r.code),
        title: String(r.title),
        hostName: String(r.host_name),
        roomMode: String(r.room_mode),
        focusCategory: String(r.focus_category),
        totalRounds: Number(r.total_rounds),
        speed: String(r.speed),
        status: String(r.status),
        currentRound: Number(r.current_round),
        playerCount: Number(pCount?.cnt || 1),
        createdAt: String(r.created_at),
      };
    });

  return NextResponse.json({ rooms });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const action = String(body.action || "");
    const db = getImperialDb();
    const nowIso = new Date().toISOString();
    const nowMs = Date.now();

    const userId = Number(body.userId || Math.floor(10000 + Math.random() * 90000));
    const username = String(body.username || `scholar_${userId}`);
    const displayName = String(body.displayName || "Estudante Hànlín");
    const scholarRank = String(body.scholarRank || "童生 Tóngshēng");
    const eloRating = Number(body.eloRating || 1000);

    if (action === "create" || action === "create_room") {
      const code = generateRoomCode();
      const title = String(body.title || `Salão de ${displayName}`);
      const roomMode = String(body.roomMode || body.mode || "duel_1v1");
      const focusCategory = String(body.focusCategory || body.category || "dissyllable_tone_matrix");
      const totalRounds = Number(body.totalRounds || 10);
      const speed = String(body.speed || "conversational");
      const questions = Array.isArray(body.questions) ? body.questions : [];

      db.prepare(
        `INSERT INTO sync_rooms (
          code, title, host_user_id, host_name, room_mode, focus_category,
          total_rounds, speed, status, current_round, round_started_at,
          questions_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'lobby', 0, ?, ?, ?, ?)`
      ).run(
        code,
        title,
        userId,
        displayName,
        roomMode,
        focusCategory,
        totalRounds,
        speed,
        nowMs,
        JSON.stringify(questions),
        nowIso,
        nowMs
      );

      db.prepare(
        `INSERT OR REPLACE INTO sync_room_players (
          room_code, user_id, username, display_name, scholar_rank, elo_rating,
          is_ready, score, combo, correct_count, total_reaction_ms, answers_json, partner_hint_json
        ) VALUES (?, ?, ?, ?, ?, ?, 1, 0, 0, 0, 0, '{}', '{}')`
      ).run(code, userId, username, displayName, scholarRank, eloRating);

      return NextResponse.json({ ok: true, code });
    }

    if (action === "join" || action === "join_room") {
      const rawCode = String(body.code || body.roomCode || "").trim().toUpperCase();
      let roomRow = db
        .prepare("SELECT * FROM sync_rooms WHERE UPPER(code) = ?")
        .get(rawCode);
      if (!roomRow && /^\d{3,4}$/.test(rawCode)) {
        roomRow = db
          .prepare("SELECT * FROM sync_rooms WHERE code LIKE ?")
          .get(`%-${rawCode}`);
      }
      if (!roomRow) {
        return NextResponse.json(
          { error: "Código de sala inválido ou sala encerrada." },
          { status: 404 }
        );
      }
      const actualCode = String(roomRow.code);

      const existingPlayer = db
        .prepare("SELECT * FROM sync_room_players WHERE room_code = ? AND user_id = ?")
        .get(actualCode, userId);

      if (!existingPlayer) {
        db.prepare(
          `INSERT INTO sync_room_players (
            room_code, user_id, username, display_name, scholar_rank, elo_rating,
            is_ready, score, combo, correct_count, total_reaction_ms, answers_json, partner_hint_json
          ) VALUES (?, ?, ?, ?, ?, ?, 1, 0, 0, 0, 0, '{}', '{}')`
        ).run(actualCode, userId, username, displayName, scholarRank, eloRating);
      }

      db.prepare("UPDATE sync_rooms SET updated_at = ? WHERE code = ?").run(
        nowMs,
        actualCode
      );
      return NextResponse.json({ ok: true, code: actualCode });
    }

    if (action === "start" || action === "start_round") {
      const code = String(body.code || body.roomCode || "");
      db.prepare(
        "UPDATE sync_rooms SET status = 'playing', current_round = 0, round_started_at = ?, updated_at = ? WHERE code = ?"
      ).run(nowMs, nowMs, code);
      return NextResponse.json({ ok: true });
    }

    if (action === "answer" || action === "submit_answer") {
      const code = String(body.code || body.roomCode || "");
      const roundIndex = Number(body.roundIndex || 0);
      const choice = String(body.choice || body.chosenLabel || "A");
      const correct = Boolean(body.correct);
      const reactionMs = Math.max(150, Math.min(15000, Number(body.reactionMs || body.reactionTimeMs || 2000)));

      const pRow = db
        .prepare("SELECT * FROM sync_room_players WHERE room_code = ? AND user_id = ?")
        .get(code, userId);
      if (!pRow) {
        return NextResponse.json({ error: "Jogador não está na sala." }, { status: 404 });
      }

      const answers = JSON.parse(String(pRow.answers_json || "{}")) as Record<
        string,
        unknown
      >;
      if (answers[String(roundIndex)]) {
        return NextResponse.json({ ok: true, alreadyAnswered: true });
      }

      const prevCombo = Number(pRow.combo || 0);
      const nextCombo = correct ? prevCombo + 1 : 0;

      // Pontuação Imperial: +100 base + bônus de velocidade acústica (até +50) + combo
      const speedBonus = correct
        ? Math.max(0, Math.round(((6000 - Math.min(6000, reactionMs)) / 6000) * 50))
        : 0;
      const comboBonus = correct ? Math.min(40, (nextCombo - 1) * 10) : 0;
      const pointsGained = correct ? 100 + speedBonus + comboBonus : 0;

      answers[String(roundIndex)] = {
        choice,
        correct,
        reactionMs,
        pointsGained,
        timestamp: nowMs,
      };

      db.prepare(
        `UPDATE sync_room_players SET
          score = score + ?,
          combo = ?,
          correct_count = correct_count + ?,
          total_reaction_ms = total_reaction_ms + ?,
          answers_json = ?
        WHERE room_code = ? AND user_id = ?`
      ).run(
        pointsGained,
        nextCombo,
        correct ? 1 : 0,
        reactionMs,
        JSON.stringify(answers),
        code,
        userId
      );

      db.prepare("UPDATE sync_rooms SET updated_at = ? WHERE code = ?").run(
        nowMs,
        code
      );

      return NextResponse.json({
        ok: true,
        pointsGained,
        nextCombo,
      });
    }

    if (action === "partner_dispatch") {
      // Modo Cooperativo Síncrono ("Parceiro de Escuta Cega")
      const code = String(body.code || "");
      const roundIndex = Number(body.roundIndex || 0);
      const hintNote = String(body.hintNote || "Pronunciado ao vivo pelo parceiro");
      const pRow = db
        .prepare("SELECT * FROM sync_room_players WHERE room_code = ? AND user_id = ?")
        .get(code, userId);
      if (pRow) {
        const hints = JSON.parse(String(pRow.partner_hint_json || "{}")) as Record<
          string,
          unknown
        >;
        hints[String(roundIndex)] = {
          dispatchedBy: displayName,
          note: hintNote,
          dispatchedAt: nowMs,
        };
        db.prepare(
          "UPDATE sync_room_players SET partner_hint_json = ? WHERE room_code = ? AND user_id = ?"
        ).run(JSON.stringify(hints), code, userId);
        db.prepare("UPDATE sync_rooms SET updated_at = ? WHERE code = ?").run(
          nowMs,
          code
        );
      }
      return NextResponse.json({ ok: true });
    }

    if (action === "next_round") {
      const code = String(body.code || "");
      const roomRow = db
        .prepare("SELECT * FROM sync_rooms WHERE code = ?")
        .get(code);
      if (!roomRow) {
        return NextResponse.json({ error: "Sala não encontrada." }, { status: 404 });
      }
      const cur = Number(roomRow.current_round);
      const total = Number(roomRow.total_rounds);

      if (cur + 1 >= total) {
        db.prepare(
          "UPDATE sync_rooms SET status = 'finished', updated_at = ? WHERE code = ?"
        ).run(nowMs, code);

        // Atualizar ELO Rating dos jogadores cadastrados ao final da partida!
        const players = db
          .prepare(
            "SELECT * FROM sync_room_players WHERE room_code = ? ORDER BY score DESC, total_reaction_ms ASC"
          )
          .all(code);

        players.forEach((p, idx) => {
          const pid = Number(p.user_id);
          const uRow = db.prepare("SELECT * FROM users WHERE id = ?").get(pid);
          if (uRow) {
            const delta = idx === 0 ? 18 : idx === 1 && players.length > 2 ? 6 : -6;
            const newElo = Math.max(800, Number(uRow.elo_rating) + delta);
            const newRank = computeScholarRank(newElo);
            db.prepare(
              "UPDATE users SET elo_rating = ?, scholar_rank = ?, xp = xp + ? WHERE id = ?"
            ).run(newElo, newRank, Math.max(20, Math.round(Number(p.score) / 10)), pid);
          }
        });
      } else {
        db.prepare(
          "UPDATE sync_rooms SET current_round = current_round + 1, round_started_at = ?, updated_at = ? WHERE code = ?"
        ).run(nowMs, nowMs, code);
      }

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Ação desconhecida." }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: `Erro na sala multiplayer: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}
