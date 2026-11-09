import { NextRequest } from "next/server";
import { getImperialDb } from "@/lib/imperial-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const code = (searchParams.get("code") || "").trim().toUpperCase();

  const encoder = new TextEncoder();
  let intervalId: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const sendSnapshot = () => {
        try {
          const db = getImperialDb();
          const roomRow = db
            .prepare("SELECT * FROM sync_rooms WHERE UPPER(code) = ?")
            .get(code);
          if (!roomRow) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ error: "not_found" })}\n\n`)
            );
            return;
          }
          const players = db
            .prepare(
              "SELECT * FROM sync_room_players WHERE room_code = ? ORDER BY score DESC, total_reaction_ms ASC"
            )
            .all(String(roomRow.code));

          const payload = {
            room: {
              code: String(roomRow.code),
              title: String(roomRow.title),
              status: String(roomRow.status),
              currentRound: Number(roomRow.current_round),
              roundStartedAt: Number(roomRow.round_started_at),
              updatedAt: Number(roomRow.updated_at),
            },
            players: players.map((p) => ({
              userId: Number(p.user_id),
              displayName: String(p.display_name),
              scholarRank: String(p.scholar_rank),
              score: Number(p.score),
              combo: Number(p.combo),
              correctCount: Number(p.correct_count),
              answers: JSON.parse(String(p.answers_json || "{}")),
            })),
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch {
          // ignore stream close errors
        }
      };

      sendSnapshot();
      intervalId = setInterval(sendSnapshot, 400);
    },
    cancel() {
      if (intervalId) clearInterval(intervalId);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
