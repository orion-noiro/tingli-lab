import { NextRequest, NextResponse } from "next/server";
import {
  computeScholarRank,
  getImperialDb,
  mapRowToAuthUser,
} from "@/lib/imperial-db";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  const todayKey = `daily_${new Date().toISOString().slice(0, 10)}`;

  // Mode A: Supabase
  if (supabaseAdmin) {
    // 1. Ghost Duels
    const { data: ghostRows } = await supabaseAdmin
      .from("async_challenges")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(25);

    const ghostChallenges = (ghostRows || []).map((r: any) => ({
      id: String(r.id),
      challengerId: Number(r.challenger_id),
      challengerName: String(r.challenger_name),
      challengerRank: String(r.challenger_rank),
      targetUsername: String(r.target_username || ""),
      focusCategory: String(r.focus_category),
      seed: String(r.seed),
      questions: typeof r.questions_json === "string" ? JSON.parse(r.questions_json) : (r.questions_json || []),
      ghostLog: typeof r.ghost_log_json === "string" ? JSON.parse(r.ghost_log_json) : (r.ghost_log_json || []),
      challengerScore: Number(r.challenger_score),
      challengerAccuracy: Number(r.challenger_accuracy),
      challengerAvgMs: Number(r.challenger_avg_ms),
      attempts: typeof r.attempts_json === "string" ? JSON.parse(r.attempts_json) : (r.attempts_json || []),
      createdAt: String(r.created_at),
    }));

    // 2. Collective Goals
    const { data: goalRows } = await supabaseAdmin
      .from("collective_goals")
      .select("*");

    const collectiveGoals = (goalRows || []).map((g: any) => ({
      id: String(g.id),
      titlePt: String(g.title_pt),
      descriptionPt: String(g.description_pt),
      goalType: String(g.goal_type),
      targetValue: Number(g.target_value),
      currentValue: Number(g.current_value),
      contributors: typeof g.contributors_json === "string" ? JSON.parse(g.contributors_json) : (g.contributors_json || {}),
      updatedAt: String(g.updated_at),
    }));

    // 3. Daily Imperial Exam (Jinbang)
    let { data: jinbangRows } = await supabaseAdmin
      .from("daily_exams")
      .select("*")
      .eq("exam_key", todayKey)
      .order("score", { ascending: false })
      .order("avg_reaction_ms", { ascending: true })
      .limit(30);

    if (!jinbangRows || jinbangRows.length === 0) {
      const nowIso = new Date().toISOString();
      const seedScholars = [
        { uid: 1, u: "li_qingzhao", d: "李清照 · Lǐ Qīngzhào", r: "进士 Jìnshì", s: 2480, acc: 95, ms: 1320 },
        { uid: 2, u: "su_dongpo", d: "苏东坡 · Sū Dōngpō", r: "贡士 Gòngshì", s: 2290, acc: 90, ms: 1460 },
        { uid: 3, u: "ouyang_xiu", d: "欧阳修 · Ōuyáng Xiū", r: "举人 Jǔrén", s: 2050, acc: 85, ms: 1580 },
      ];
      for (const sc of seedScholars) {
        await supabaseAdmin.from("daily_exams").insert({
          exam_key: todayKey,
          user_id: sc.uid,
          username: sc.u,
          display_name: sc.d,
          scholar_rank: sc.r,
          score: sc.s,
          accuracy: sc.acc,
          avg_reaction_ms: sc.ms,
          details_json: {},
          completed_at: nowIso,
        });
      }
      const { data: refetched } = await supabaseAdmin
        .from("daily_exams")
        .select("*")
        .eq("exam_key", todayKey)
        .order("score", { ascending: false })
        .order("avg_reaction_ms", { ascending: true })
        .limit(30);
      jinbangRows = refetched || [];
    }

    const finalJinbang = (jinbangRows || []).map((e: any) => ({
      examKey: String(e.exam_key),
      userId: Number(e.user_id),
      username: String(e.username),
      displayName: String(e.display_name),
      scholarRank: String(e.scholar_rank),
      score: Number(e.score),
      accuracy: Number(e.accuracy),
      avgReactionMs: Number(e.avg_reaction_ms),
      completedAt: String(e.completed_at),
    }));

    // 4. Leaderboard Geral
    const { data: scholars } = await supabaseAdmin
      .from("users")
      .select("*")
      .order("elo_rating", { ascending: false })
      .order("xp", { ascending: false })
      .limit(30);

    const leaderboard = (scholars || []).map(mapRowToAuthUser);

    return NextResponse.json({
      todayExamKey: todayKey,
      ghostChallenges,
      collectiveGoals,
      jinbang: finalJinbang,
      leaderboard,
    });
  }

  // Mode B: SQLite
  const db = getImperialDb();

  // 1. Ghost Duels
  const ghostRows = db
    .prepare("SELECT * FROM async_challenges ORDER BY created_at DESC LIMIT 25")
    .all();

  const ghostChallenges = ghostRows.map((r) => ({
    id: String(r.id),
    challengerId: Number(r.challenger_id),
    challengerName: String(r.challenger_name),
    challengerRank: String(r.challenger_rank),
    targetUsername: String(r.target_username || ""),
    focusCategory: String(r.focus_category),
    seed: String(r.seed),
    questions: JSON.parse(String(r.questions_json || "[]")),
    ghostLog: JSON.parse(String(r.ghost_log_json || "[]")),
    challengerScore: Number(r.challenger_score),
    challengerAccuracy: Number(r.challenger_accuracy),
    challengerAvgMs: Number(r.challenger_avg_ms),
    attempts: JSON.parse(String(r.attempts_json || "[]")),
    createdAt: String(r.created_at),
  }));

  // 2. Collective Goals
  const goalRows = db.prepare("SELECT * FROM collective_goals").all();
  const collectiveGoals = goalRows.map((g) => ({
    id: String(g.id),
    titlePt: String(g.title_pt),
    descriptionPt: String(g.description_pt),
    goalType: String(g.goal_type),
    targetValue: Number(g.target_value),
    currentValue: Number(g.current_value),
    contributors: JSON.parse(String(g.contributors_json || "{}")),
    updatedAt: String(g.updated_at),
  }));

  // 3. Daily Imperial Exam
  const jinbangRows = db
    .prepare(
      "SELECT * FROM daily_exams WHERE exam_key = ? ORDER BY score DESC, avg_reaction_ms ASC LIMIT 30"
    )
    .all(todayKey);

  if (jinbangRows.length === 0) {
    const nowIso = new Date().toISOString();
    const seedScholars = [
      { uid: 1, u: "li_qingzhao", d: "李清照 · Lǐ Qīngzhào", r: "进士 Jìnshì", s: 2480, acc: 95, ms: 1320 },
      { uid: 2, u: "su_dongpo", d: "苏东坡 · Sū Dōngpō", r: "贡士 Gòngshì", s: 2290, acc: 90, ms: 1460 },
      { uid: 3, u: "ouyang_xiu", d: "欧阳修 · Ōuyáng Xiū", r: "举人 Jǔrén", s: 2050, acc: 85, ms: 1580 },
    ];
    const ins = db.prepare(
      `INSERT OR IGNORE INTO daily_exams (
        exam_key, user_id, username, display_name, scholar_rank, score, accuracy, avg_reaction_ms, details_json, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '{}', ?)`
    );
    for (const sc of seedScholars) {
      ins.run(todayKey, sc.uid, sc.u, sc.d, sc.r, sc.s, sc.acc, sc.ms, nowIso);
    }
  }

  const finalJinbang = db
    .prepare(
      "SELECT * FROM daily_exams WHERE exam_key = ? ORDER BY score DESC, avg_reaction_ms ASC LIMIT 30"
    )
    .all(todayKey)
    .map((e) => ({
      examKey: String(e.exam_key),
      userId: Number(e.user_id),
      username: String(e.username),
      displayName: String(e.display_name),
      scholarRank: String(e.scholar_rank),
      score: Number(e.score),
      accuracy: Number(e.accuracy),
      avgReactionMs: Number(e.avg_reaction_ms),
      completedAt: String(e.completed_at),
    }));

  // 4. Leaderboard Geral
  const leaderboard = db
    .prepare("SELECT * FROM users ORDER BY elo_rating DESC, xp DESC LIMIT 30")
    .all()
    .map(mapRowToAuthUser);

  return NextResponse.json({
    todayExamKey: todayKey,
    ghostChallenges,
    collectiveGoals,
    jinbang: finalJinbang,
    leaderboard,
  });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const action = String(body.action || "");
    const nowIso = new Date().toISOString();

    // Mode A: Supabase
    if (supabaseAdmin) {
      if (action === "create_ghost") {
        const id = `ghost_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const challengerId = Number(body.challengerId || 0);
        const challengerName = String(body.challengerName || "Estudante Hànlín");
        const challengerRank = String(body.challengerRank || "童生 Tóngshēng");
        const targetUsername = String(body.targetUsername || "").trim();
        const focusCategory = String(body.focusCategory || "dissyllable_tone_matrix");
        const seed = String(body.seed || `GHOST-${Date.now().toString(36).toUpperCase()}`);
        const questions = Array.isArray(body.questions) ? body.questions : [];
        const ghostLog = Array.isArray(body.ghostLog) ? body.ghostLog : [];
        const challengerScore = Number(body.challengerScore || 0);
        const challengerAccuracy = Number(body.challengerAccuracy || 0);
        const challengerAvgMs = Number(body.challengerAvgMs || 1500);

        await supabaseAdmin.from("async_challenges").insert({
          id,
          challenger_id: challengerId,
          challenger_name: challengerName,
          challenger_rank: challengerRank,
          target_username: targetUsername,
          focus_category: focusCategory,
          seed,
          questions_json: questions,
          ghost_log_json: ghostLog,
          challenger_score: challengerScore,
          challenger_accuracy: challengerAccuracy,
          challenger_avg_ms: challengerAvgMs,
          attempts_json: [],
          created_at: nowIso,
        });

        return NextResponse.json({ ok: true, id });
      }

      if (action === "complete_ghost_duel") {
        const challengeId = String(body.challengeId || "");
        const { data: row } = await supabaseAdmin
          .from("async_challenges")
          .select("*")
          .eq("id", challengeId)
          .maybeSingle();

        if (!row) {
          return NextResponse.json({ error: "Desafio Fantasma não encontrado." }, { status: 404 });
        }

        const attempts = (typeof row.attempts_json === "string"
          ? JSON.parse(row.attempts_json)
          : row.attempts_json) || [];

        const playerScore = Number(body.score || 0);
        const challengerScore = Number(row.challenger_score || 0);
        const won = playerScore > challengerScore;

        attempts.unshift({
          playerName: String(body.playerName || "Amigo Desafiante"),
          playerRank: String(body.playerRank || "童生 Tóngshēng"),
          score: playerScore,
          accuracy: Number(body.accuracy || 0),
          avgMs: Number(body.avgMs || 1500),
          won,
          completedAt: nowIso,
        });

        await supabaseAdmin
          .from("async_challenges")
          .update({ attempts_json: attempts.slice(0, 30) })
          .eq("id", challengeId);

        if (body.userId) {
          const uid = Number(body.userId);
          const { data: uRow } = await supabaseAdmin
            .from("users")
            .select("*")
            .eq("id", uid)
            .maybeSingle();

          if (uRow) {
            const delta = won ? 16 : -5;
            const nextElo = Math.max(800, Number(uRow.elo_rating) + delta);
            const nextRank = computeScholarRank(nextElo);
            await supabaseAdmin
              .from("users")
              .update({
                elo_rating: nextElo,
                scholar_rank: nextRank,
                xp: Number(uRow.xp || 0) + (won ? 60 : 25),
              })
              .eq("id", uid);
          }
        }

        return NextResponse.json({ ok: true, won });
      }

      if (action === "submit_imperial_exam") {
        const todayKey = `daily_${new Date().toISOString().slice(0, 10)}`;
        const userId = Number(body.userId || Math.floor(50000 + Math.random() * 40000));
        const username = String(body.username || `scholar_${userId}`);
        const displayName = String(body.displayName || "Candidato Imperial");
        const scholarRank = String(body.scholarRank || "童生 Tóngshēng");
        const score = Number(body.score || 0);
        const accuracy = Number(body.accuracy || 0);
        const avgReactionMs = Number(body.avgReactionMs || 1500);

        const { data: existingEntry } = await supabaseAdmin
          .from("daily_exams")
          .select("score, accuracy, avg_reaction_ms")
          .eq("exam_key", todayKey)
          .eq("user_id", userId)
          .maybeSingle();

        let alreadyCompleted = false;
        if (existingEntry) {
          alreadyCompleted = true;
          if (body.userId) {
            const { data: u } = await supabaseAdmin.from("users").select("xp").eq("id", userId).maybeSingle();
            if (u) {
              await supabaseAdmin.from("users").update({ xp: Number(u.xp || 0) + 25 }).eq("id", userId);
            }
          }
        } else {
          await supabaseAdmin.from("daily_exams").insert({
            exam_key: todayKey,
            user_id: userId,
            username,
            display_name: displayName,
            scholar_rank: scholarRank,
            score,
            accuracy,
            avg_reaction_ms: avgReactionMs,
            details_json: body.details || {},
            completed_at: nowIso,
          });

          if (body.userId) {
            const { data: uRow } = await supabaseAdmin.from("users").select("*").eq("id", userId).maybeSingle();
            if (uRow) {
              const bonusElo = accuracy >= 85 ? 20 : accuracy >= 70 ? 10 : 2;
              const nextElo = Number(uRow.elo_rating) + bonusElo;
              const nextRank = computeScholarRank(nextElo);
              await supabaseAdmin.from("users").update({
                elo_rating: nextElo,
                scholar_rank: nextRank,
                xp: Number(uRow.xp || 0) + 100,
              }).eq("id", userId);
            }
          }
        }

        return NextResponse.json({
          ok: true,
          examKey: todayKey,
          alreadyCompleted,
        });
      }

      return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
    }

    // Mode B: SQLite
    const db = getImperialDb();

    if (action === "create_ghost") {
      const id = `ghost_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const challengerId = Number(body.challengerId || 0);
      const challengerName = String(body.challengerName || "Estudante Hànlín");
      const challengerRank = String(body.challengerRank || "童生 Tóngshēng");
      const targetUsername = String(body.targetUsername || "").trim();
      const focusCategory = String(body.focusCategory || "dissyllable_tone_matrix");
      const seed = String(body.seed || `GHOST-${Date.now().toString(36).toUpperCase()}`);
      const questions = Array.isArray(body.questions) ? body.questions : [];
      const ghostLog = Array.isArray(body.ghostLog) ? body.ghostLog : [];
      const challengerScore = Number(body.challengerScore || 0);
      const challengerAccuracy = Number(body.challengerAccuracy || 0);
      const challengerAvgMs = Number(body.challengerAvgMs || 1500);

      db.prepare(
        `INSERT INTO async_challenges (
          id, challenger_id, challenger_name, challenger_rank, target_username,
          focus_category, seed, questions_json, ghost_log_json,
          challenger_score, challenger_accuracy, challenger_avg_ms, attempts_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?)`
      ).run(
        id,
        challengerId,
        challengerName,
        challengerRank,
        targetUsername,
        focusCategory,
        seed,
        JSON.stringify(questions),
        JSON.stringify(ghostLog),
        challengerScore,
        challengerAccuracy,
        challengerAvgMs,
        nowIso
      );

      return NextResponse.json({ ok: true, id });
    }

    if (action === "complete_ghost_duel") {
      const challengeId = String(body.challengeId || "");
      const row = db
        .prepare("SELECT * FROM async_challenges WHERE id = ?")
        .get(challengeId);
      if (!row) {
        return NextResponse.json({ error: "Desafio Fantasma não encontrado." }, { status: 404 });
      }

      const attempts = JSON.parse(String(row.attempts_json || "[]")) as Array<
        Record<string, unknown>
      >;
      const playerScore = Number(body.score || 0);
      const challengerScore = Number(row.challenger_score || 0);
      const won = playerScore > challengerScore;

      attempts.unshift({
        playerName: String(body.playerName || "Amigo Desafiante"),
        playerRank: String(body.playerRank || "童生 Tóngshēng"),
        score: playerScore,
        accuracy: Number(body.accuracy || 0),
        avgMs: Number(body.avgMs || 1500),
        won,
        completedAt: nowIso,
      });

      db.prepare("UPDATE async_challenges SET attempts_json = ? WHERE id = ?").run(
        JSON.stringify(attempts.slice(0, 30)),
        challengeId
      );

      if (body.userId) {
        const uid = Number(body.userId);
        const uRow = db.prepare("SELECT * FROM users WHERE id = ?").get(uid);
        if (uRow) {
          const delta = won ? 16 : -5;
          const nextElo = Math.max(800, Number(uRow.elo_rating) + delta);
          const nextRank = computeScholarRank(nextElo);
          db.prepare(
            "UPDATE users SET elo_rating = ?, scholar_rank = ?, xp = xp + ? WHERE id = ?"
          ).run(nextElo, nextRank, won ? 60 : 25, uid);
        }
      }

      return NextResponse.json({ ok: true, won });
    }

    if (action === "submit_imperial_exam") {
      const todayKey = `daily_${new Date().toISOString().slice(0, 10)}`;
      const userId = Number(body.userId || Math.floor(50000 + Math.random() * 40000));
      const username = String(body.username || `scholar_${userId}`);
      const displayName = String(body.displayName || "Candidato Imperial");
      const scholarRank = String(body.scholarRank || "童生 Tóngshēng");
      const score = Number(body.score || 0);
      const accuracy = Number(body.accuracy || 0);
      const avgReactionMs = Number(body.avgReactionMs || 1500);

      const existingEntry = db
        .prepare("SELECT score, accuracy, avg_reaction_ms FROM daily_exams WHERE exam_key = ? AND user_id = ?")
        .get(todayKey, userId);

      let alreadyCompleted = false;
      if (existingEntry) {
        alreadyCompleted = true;
        if (body.userId) {
          db.prepare("UPDATE users SET xp = xp + 25 WHERE id = ?").run(userId);
        }
      } else {
        db.prepare(
          `INSERT INTO daily_exams (
            exam_key, user_id, username, display_name, scholar_rank,
            score, accuracy, avg_reaction_ms, details_json, completed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          todayKey,
          userId,
          username,
          displayName,
          scholarRank,
          score,
          accuracy,
          avgReactionMs,
          JSON.stringify(body.details || {}),
          nowIso
        );

        if (body.userId) {
          const uRow = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
          if (uRow) {
            const bonusElo = accuracy >= 85 ? 20 : accuracy >= 70 ? 10 : 2;
            const nextElo = Number(uRow.elo_rating) + bonusElo;
            const nextRank = computeScholarRank(nextElo);
            db.prepare(
              "UPDATE users SET elo_rating = ?, scholar_rank = ?, xp = xp + 100 WHERE id = ?"
            ).run(nextElo, nextRank, userId);
          }
        }
      }

      return NextResponse.json({
        ok: true,
        examKey: todayKey,
        alreadyCompleted,
      });
    }

    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: `Erro no multiplayer assíncrono: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}
