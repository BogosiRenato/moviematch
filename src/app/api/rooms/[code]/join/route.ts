import { NextResponse } from "next/server";
import { joinRoom } from "@/lib/rooms";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ code: string }> },
) {
  const { code } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    userId?: string;
  };
  const result = joinRoom(code, body.name ?? "", body.userId);
  if (!result) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }
  return NextResponse.json({ userId: result.userId, code: result.room.code });
}
