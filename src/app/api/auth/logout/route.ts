import { NextRequest, NextResponse } from "next/server";
import { dbDeleteSession } from "@/lib/cloud-db";

export const runtime = "nodejs";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const token = req.cookies.get("tingli_session")?.value;
  if (token) {
    await dbDeleteSession(token);
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.delete("tingli_session");
  return res;
}
