import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import {
  computeScholarRank,
  getImperialDb,
  hashPassword,
  mapRowToAuthUser,
  verifyPassword,
} from "@/lib/imperial-db";
import { AuthUser, ScholarRank } from "@/types/phonetics";

export { computeScholarRank, hashPassword, verifyPassword, mapRowToAuthUser };

export async function dbFindUserByUsername(username: string) {
  if (supabaseAdmin) {
    const { data } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("username", username.toLowerCase().trim())
      .maybeSingle();
    return data || null;
  }
  const db = getImperialDb();
  return db.prepare("SELECT * FROM users WHERE username = ?").get(username) || null;
}

export async function dbFindUserById(id: number) {
  if (supabaseAdmin) {
    const { data } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    return data || null;
  }
  const db = getImperialDb();
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id) || null;
}

export async function dbCreateUser(params: {
  username: string;
  displayName: string;
  passwordHash: string;
  scholarRank: string;
  eloRating: number;
  streakDays: number;
  xp: number;
  profileJson: string;
}) {
  const nowIso = new Date().toISOString();
  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from("users")
      .insert({
        username: params.username,
        display_name: params.displayName,
        password_hash: params.passwordHash,
        scholar_rank: params.scholarRank,
        elo_rating: params.eloRating,
        streak_days: params.streakDays,
        xp: params.xp,
        profile_json: JSON.parse(params.profileJson || "{}"),
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }
  const db = getImperialDb();
  const info = db
    .prepare(
      `INSERT INTO users (
        username, display_name, password_hash, scholar_rank, elo_rating,
        streak_days, xp, profile_json, created_at
      ) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)`
    )
    .run(
      params.username,
      params.displayName,
      params.passwordHash,
      params.scholarRank,
      params.eloRating,
      params.xp,
      params.profileJson,
      nowIso
    );
  return db.prepare("SELECT * FROM users WHERE id = ?").get(Number(info.lastInsertRowid));
}

export async function dbCreateSession(token: string, userId: number, expiresAt: number) {
  const nowIso = new Date().toISOString();
  if (supabaseAdmin) {
    await supabaseAdmin.from("sessions").insert({
      token,
      user_id: userId,
      expires_at: expiresAt,
    });
    return;
  }
  const db = getImperialDb();
  db.prepare("INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)").run(
    token,
    userId,
    expiresAt,
    nowIso
  );
}

export async function dbGetSession(token: string) {
  if (supabaseAdmin) {
    const { data: sess } = await supabaseAdmin
      .from("sessions")
      .select("user_id, expires_at")
      .eq("token", token)
      .maybeSingle();
    if (!sess || Number(sess.expires_at) < Date.now()) return null;
    return sess;
  }
  const db = getImperialDb();
  const sess = db.prepare("SELECT user_id, expires_at FROM sessions WHERE token = ?").get(token);
  if (!sess || Number(sess.expires_at) < Date.now()) return null;
  return sess;
}

export async function dbDeleteSession(token: string) {
  if (supabaseAdmin) {
    await supabaseAdmin.from("sessions").delete().eq("token", token);
    return;
  }
  const db = getImperialDb();
  db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

export async function dbGetAuthenticatedUser(req: NextRequest) {
  const token = req.cookies.get("tingli_session")?.value;
  if (!token) return null;
  const sess = await dbGetSession(token);
  if (!sess) return null;
  return await dbFindUserById(Number(sess.user_id));
}

export async function dbGetTopScholars(limit: number = 20): Promise<AuthUser[]> {
  if (supabaseAdmin) {
    const { data } = await supabaseAdmin
      .from("users")
      .select("*")
      .order("elo_rating", { ascending: false })
      .limit(limit);
    return (data || []).map(mapRowToAuthUser);
  }
  const db = getImperialDb();
  return db
    .prepare(
      "SELECT * FROM users ORDER BY elo_rating DESC LIMIT ?"
    )
    .all(limit)
    .map(mapRowToAuthUser);
}

export async function dbRecordStudyAttempt(
  userRow: Record<string, unknown> | null,
  body: any,
  contributorName: string
) {
  const nowIso = new Date().toISOString();
  const att = body.attempt || (body.action === "sync_attempt" ? body : null);

  if (att) {
    const isCorrect = Boolean(att.correct);
    const isDissyl =
      att.category === "dissyllable_tone_matrix" || att.mode === "maorma_2syl_matrix";
    const isSentence =
      att.category === "context_sentence" ||
      att.mode === "context_sentences" ||
      att.mode === "prosody_spotting" ||
      att.mode === "sentence_reconstruction";

    // 1. Atualizar Metas Coletivas
    if (isCorrect) {
      const goalIds: string[] = ["goal_total_attempts_5000"];
      if (isDissyl) goalIds.push("goal_dissyllables_1000");
      if (isSentence) goalIds.push("goal_sentences_300");

      if (supabaseAdmin) {
        for (const gid of goalIds) {
          const { data: g } = await supabaseAdmin
            .from("collective_goals")
            .select("current_value, contributors_json")
            .eq("id", gid)
            .maybeSingle();
          if (g) {
            const contribs = (g.contributors_json || {}) as Record<string, number>;
            contribs[contributorName] = (contribs[contributorName] || 0) + 1;
            await supabaseAdmin
              .from("collective_goals")
              .update({
                current_value: Number(g.current_value || 0) + 1,
                contributors_json: contribs,
                updated_at: nowIso,
              })
              .eq("id", gid);
          }
        }
      } else {
        const db = getImperialDb();
        for (const gid of goalIds) {
          const gRow = db
            .prepare("SELECT current_value, contributors_json FROM collective_goals WHERE id = ?")
            .get(gid);
          if (gRow) {
            const contribs = JSON.parse(String(gRow.contributors_json || "{}")) as Record<string, number>;
            contribs[contributorName] = (contribs[contributorName] || 0) + 1;
            db.prepare(
              "UPDATE collective_goals SET current_value = current_value + 1, contributors_json = ?, updated_at = ? WHERE id = ?"
            ).run(JSON.stringify(contribs), nowIso, gid);
          }
        }
      }
    }

    // 2. Atualizar Usuário
    if (userRow) {
      const uid = Number(userRow.id);
      const eloDelta = isCorrect ? (Number(att.reactionTimeMs || 2000) < 1500 ? 3 : 2) : -1;
      const nextElo = Math.max(800, Number(userRow.elo_rating) + eloDelta);
      const nextRank = computeScholarRank(nextElo);
      const xpGain = isCorrect ? 15 : 4;

      if (supabaseAdmin) {
        await supabaseAdmin.from("study_logs").insert({
          user_id: uid,
          mode: String(att.mode || "listen"),
          category: String(att.category || "monosyllable_tone"),
          sub_category: String(att.subCategory || ""),
          target_id: String(att.targetId || ""),
          correct: isCorrect ? 1 : 0,
          reaction_ms: Number(att.reactionTimeMs || 1500),
          voice_used: String(att.voiceUsed || "xiaoxiao"),
          speed_used: String(att.speedUsed || "conversational"),
        });

        await supabaseAdmin
          .from("users")
          .update({
            elo_rating: nextElo,
            scholar_rank: nextRank,
            xp: Number(userRow.xp || 0) + xpGain,
            dissyllable_correct: Number(userRow.dissyllable_correct || 0) + (isDissyl && isCorrect ? 1 : 0),
            dissyllable_total: Number(userRow.dissyllable_total || 0) + (isDissyl ? 1 : 0),
            sentence_correct: Number(userRow.sentence_correct || 0) + (isSentence && isCorrect ? 1 : 0),
            sentence_total: Number(userRow.sentence_total || 0) + (isSentence ? 1 : 0),
            total_reaction_ms: Number(userRow.total_reaction_ms || 0) + Number(att.reactionTimeMs || 1500),
            total_attempts: Number(userRow.total_attempts || 0) + 1,
            profile_json: body.profile || userRow.profile_json || {},
          })
          .eq("id", uid);
      } else {
        const db = getImperialDb();
        db.prepare(
          `INSERT INTO study_logs (
            user_id, mode, category, sub_category, target_id, correct, reaction_ms, voice_used, speed_used, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          uid,
          String(att.mode || "listen"),
          String(att.category || "monosyllable_tone"),
          String(att.subCategory || ""),
          String(att.targetId || ""),
          isCorrect ? 1 : 0,
          Number(att.reactionTimeMs || 1500),
          String(att.voiceUsed || "xiaoxiao"),
          String(att.speedUsed || "conversational"),
          nowIso
        );

        db.prepare(
          `UPDATE users SET
            elo_rating = ?,
            scholar_rank = ?,
            xp = xp + ?,
            dissyllable_correct = dissyllable_correct + ?,
            dissyllable_total = dissyllable_total + ?,
            sentence_correct = sentence_correct + ?,
            sentence_total = sentence_total + ?,
            total_reaction_ms = total_reaction_ms + ?,
            total_attempts = total_attempts + 1,
            profile_json = COALESCE(?, profile_json)
          WHERE id = ?`
        ).run(
          nextElo,
          nextRank,
          xpGain,
          isDissyl && isCorrect ? 1 : 0,
          isDissyl ? 1 : 0,
          isSentence && isCorrect ? 1 : 0,
          isSentence ? 1 : 0,
          Number(att.reactionTimeMs || 1500),
          body.profile ? JSON.stringify(body.profile) : null,
          uid
        );
      }
    }
  } else if (userRow && body.profile) {
    const uid = Number(userRow.id);
    if (supabaseAdmin) {
      await supabaseAdmin.from("users").update({ profile_json: body.profile }).eq("id", uid);
    } else {
      const db = getImperialDb();
      db.prepare("UPDATE users SET profile_json = ? WHERE id = ?").run(
        JSON.stringify(body.profile),
        uid
      );
    }
  }

  return userRow ? await dbFindUserById(Number(userRow.id)) : null;
}
