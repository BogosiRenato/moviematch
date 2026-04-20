import { NextResponse } from "next/server";
import { createRoom } from "@/lib/rooms";

export async function POST() {
  const room = await createRoom();
  return NextResponse.json({ code: room.code });
}
