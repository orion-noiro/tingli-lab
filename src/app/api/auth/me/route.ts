import { NextRequest, NextResponse } from "next/server";
import {
  mapRowToAuthUser,
  dbGetAuthenticatedUser,
  dbGetTopScholars,
  dbRecordStudyAttempt,
} from "@/lib/cloud-db";

export const runtime = "nodejs";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const userRow = await dbGetAuthenticatedUser(req);
  const allScholars = await dbGetTopScholars(20);

  if (!userRow) {
    return NextResponse.json({ authenticated: false, user: null, scholars: allScholars });
  }

  const profileJson = userRow.profile_json
    ? typeof userRow.profile_json === "string"
      ? JSON.parse(userRow.profile_json)
      : userRow.profile_json
    : null;

  return NextResponse.json({
    authenticated: true,
    user: mapRowToAuthUser(userRow),
    profileJson,
    scholars: allScholars,
  });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const userRow = await dbGetAuthenticatedUser(req);
    const body = await req.json();

    const contributorName = userRow
      ? String(userRow.display_name)
      : String(body.contributorName || "Estudante Convidado");

    const updatedRow = await dbRecordStudyAttempt(userRow, body, contributorName);

    return NextResponse.json({
      ok: true,
      user: updatedRow ? mapRowToAuthUser(updatedRow) : null,
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
