import { NextResponse } from "next/server";
import { recordSwipe, type Swipe } from "@/lib/rooms";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ code: string }> },
) {
  const { code } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    userId?: string;
    movieId?: string;
    swipe?: Swipe;
  };
  if (!body.userId || !body.movieId || (body.swipe !== "like" && body.swipe !== "pass")) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const ok = recordSwipe(code, body.userId, body.movieId, body.swipe);
  if (!ok) return NextResponse.json({ error: "Not in room" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
