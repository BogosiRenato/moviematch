import { NextResponse } from "next/server";
import { getRoomState, touchMember } from "@/lib/rooms";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ code: string }> },
) {
  const { code } = await ctx.params;
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId") ?? undefined;
  if (userId) await touchMember(code, userId);
  const state = await getRoomState(code, userId);
  if (!state) return NextResponse.json({ error: "Room not found" }, { status: 404 });
  return NextResponse.json(state);
}
