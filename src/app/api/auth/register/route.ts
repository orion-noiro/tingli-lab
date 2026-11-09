import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import {
  computeScholarRank,
  hashPassword,
  mapRowToAuthUser,
  dbFindUserByUsername,
  dbCreateUser,
  dbCreateSession,
} from "@/lib/cloud-db";

export const runtime = "nodejs";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const username = String(body.username || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_.-]/g, "");
    const displayName = String(body.displayName || body.username || "").trim();
    const password = String(body.password || "");
    const migratedProfile = body.migratedProfile
      ? JSON.stringify(body.migratedProfile)
      : "{}";
    const initialXp = Number(body.migratedProfile?.xp || 0);

    if (username.length < 3) {
      return NextResponse.json(
        { error: "O nome de usuário deve ter pelo menos 3 caracteres alfanuméricos." },
        { status: 400 }
      );
    }
    if (password.length < 4) {
      return NextResponse.json(
        { error: "A senha deve ter pelo menos 4 caracteres." },
        { status: 400 }
      );
    }

    const existing = await dbFindUserByUsername(username);
    if (existing) {
      return NextResponse.json(
        { error: "Este nome de usuário já está registrado na Academia Hànlín." },
        { status: 409 }
      );
    }

    const passHash = hashPassword(password);
    const initialElo = 1000;
    const rank = computeScholarRank(initialElo);

    const userRow = await dbCreateUser({
      username,
      displayName: displayName || username,
      passwordHash: passHash,
      scholarRank: rank,
      eloRating: initialElo,
      streakDays: 1,
      xp: initialXp,
      profileJson: migratedProfile,
    });

    const userId = Number(userRow.id);
    const token = crypto.randomBytes(24).toString("hex");
    const expiresAt = Date.now() + 1000 * 60 * 60 * 24 * 30; // 30 days

    await dbCreateSession(token, userId, expiresAt);

    const user = userRow ? mapRowToAuthUser(userRow) : null;
    const res = NextResponse.json({ ok: true, user });
    res.cookies.set("tingli_session", token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  } catch (err) {
    return NextResponse.json(
      { error: `Erro ao registrar conta: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}
