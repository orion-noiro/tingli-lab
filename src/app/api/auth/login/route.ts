import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import {
  mapRowToAuthUser,
  verifyPassword,
  dbFindUserByUsername,
  dbCreateSession,
} from "@/lib/cloud-db";

export const runtime = "nodejs";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const username = String(body.username || "")
      .trim()
      .toLowerCase();
    const password = String(body.password || "");

    const userRow = await dbFindUserByUsername(username);

    if (!userRow || !verifyPassword(password, String(userRow.password_hash))) {
      return NextResponse.json(
        { error: "Usuário ou senha incorretos no registro da Academia Hànlín." },
        { status: 401 }
      );
    }

    const userId = Number(userRow.id);
    const token = crypto.randomBytes(24).toString("hex");
    const expiresAt = Date.now() + 1000 * 60 * 60 * 24 * 30;

    await dbCreateSession(token, userId, expiresAt);

    const user = mapRowToAuthUser(userRow);
    const res = NextResponse.json({
      ok: true,
      user,
      profileJson: userRow.profile_json ? (typeof userRow.profile_json === "string" ? JSON.parse(userRow.profile_json) : userRow.profile_json) : null,
    });
    res.cookies.set("tingli_session", token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  } catch (err) {
    return NextResponse.json(
      { error: `Erro no login: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}
