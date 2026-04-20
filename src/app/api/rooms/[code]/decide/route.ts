import { NextResponse } from "next/server";
import { clearDecision, decideMovie } from "@/lib/rooms";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ code: string }> },
) {
  const { code } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    userId?: string;
    movieId?: string;
  };
  if (!body.userId || !body.movieId) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const result = await decideMovie(code, body.userId, body.movieId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ decision: result.decision });
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ code: string }> },
) {
  const { code } = await ctx.params;
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
  const ok = await clearDecision(code, userId);
  if (!ok) return NextResponse.json({ error: "Not in room" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
