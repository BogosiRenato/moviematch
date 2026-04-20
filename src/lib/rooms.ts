import { randomUUID } from "crypto";
import { Redis } from "@upstash/redis";

export type Swipe = "like" | "pass";

export type Member = {
  id: string;
  name: string;
  joinedAt: number;
  lastSeen: number;
  swipes: Record<string, Swipe>;
};

export type Decision = {
  movieId: string;
  decidedBy: string;
  decidedByName: string;
  at: number;
};

export type Room = {
  code: string;
  createdAt: number;
  members: Record<string, Member>;
  decision?: Decision;
};

const redis = Redis.fromEnv();

const ROOM_TTL_SECONDS = 24 * 60 * 60;
const roomKey = (code: string) => `room:${code.toUpperCase()}`;

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateCode(): string {
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return out;
}

// Concurrency: read-modify-write on a single JSON blob per room is
// last-write-wins. For small rooms with 2s polling, the race window is
// narrow; accepting it for now. Revisit if contention becomes real.
async function saveRoom(room: Room): Promise<void> {
  await redis.set(roomKey(room.code), room, { ex: ROOM_TTL_SECONDS });
}

export async function createRoom(): Promise<Room> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateCode();
    const room: Room = { code, createdAt: Date.now(), members: {} };
    const ok = await redis.set(roomKey(code), room, {
      ex: ROOM_TTL_SECONDS,
      nx: true,
    });
    if (ok) return room;
  }
  throw new Error("Failed to generate a unique room code after 10 attempts");
}

export async function getRoom(code: string): Promise<Room | undefined> {
  const room = await redis.get<Room>(roomKey(code));
  return room ?? undefined;
}

export async function joinRoom(
  code: string,
  name: string,
  existingUserId?: string,
): Promise<{ userId: string; room: Room } | null> {
  const room = await getRoom(code);
  if (!room) return null;

  if (existingUserId && room.members[existingUserId]) {
    const m = room.members[existingUserId];
    m.lastSeen = Date.now();
    if (name && name !== m.name) m.name = name;
    await saveRoom(room);
    return { userId: existingUserId, room };
  }

  const userId = randomUUID();
  room.members[userId] = {
    id: userId,
    name: name?.trim() || "Guest",
    joinedAt: Date.now(),
    lastSeen: Date.now(),
    swipes: {},
  };
  await saveRoom(room);
  return { userId, room };
}

export async function recordSwipe(
  code: string,
  userId: string,
  movieId: string,
  swipe: Swipe,
): Promise<boolean> {
  const room = await getRoom(code);
  if (!room) return false;
  const member = room.members[userId];
  if (!member) return false;
  member.swipes[movieId] = swipe;
  member.lastSeen = Date.now();
  await saveRoom(room);
  return true;
}

export async function decideMovie(
  code: string,
  userId: string,
  movieId: string,
): Promise<{ ok: true; decision: Decision } | { ok: false; error: string }> {
  const room = await getRoom(code);
  if (!room) return { ok: false, error: "Room not found" };
  const member = room.members[userId];
  if (!member) return { ok: false, error: "Not in room" };
  if (!getMatches(room).includes(movieId)) {
    return { ok: false, error: "Not a match" };
  }
  if (room.decision) return { ok: true, decision: room.decision };
  room.decision = {
    movieId,
    decidedBy: userId,
    decidedByName: member.name,
    at: Date.now(),
  };
  await saveRoom(room);
  return { ok: true, decision: room.decision };
}

export async function clearDecision(
  code: string,
  userId: string,
): Promise<boolean> {
  const room = await getRoom(code);
  if (!room) return false;
  if (!room.members[userId]) return false;
  delete room.decision;
  await saveRoom(room);
  return true;
}

export async function touchMember(code: string, userId: string): Promise<void> {
  const room = await getRoom(code);
  if (!room) return;
  const member = room.members[userId];
  if (!member) return;
  member.lastSeen = Date.now();
  await saveRoom(room);
}

export function getMatches(room: Room): string[] {
  const active = Object.values(room.members).filter(
    (m) => Object.keys(m.swipes).length > 0,
  );
  if (active.length < 2) return [];

  const candidates = new Set<string>();
  for (const m of active) {
    for (const movieId of Object.keys(m.swipes)) candidates.add(movieId);
  }

  const matches: string[] = [];
  for (const movieId of candidates) {
    const everyoneLiked = active.every((m) => m.swipes[movieId] === "like");
    if (everyoneLiked) matches.push(movieId);
  }
  return matches;
}

export type RoomStateView = {
  code: string;
  members: Array<{
    id: string;
    name: string;
    swipeCount: number;
    online: boolean;
  }>;
  matches: string[];
  decision?: Decision;
  you?: {
    id: string;
    swipes: Record<string, Swipe>;
  };
};

const ONLINE_WINDOW_MS = 15_000;

export async function getRoomState(
  code: string,
  userId?: string,
): Promise<RoomStateView | null> {
  const room = await getRoom(code);
  if (!room) return null;
  const now = Date.now();
  return {
    code: room.code,
    members: Object.values(room.members).map((m) => ({
      id: m.id,
      name: m.name,
      swipeCount: Object.keys(m.swipes).length,
      online: now - m.lastSeen < ONLINE_WINDOW_MS,
    })),
    matches: getMatches(room),
    decision: room.decision,
    you:
      userId && room.members[userId]
        ? { id: userId, swipes: room.members[userId].swipes }
        : undefined,
  };
}
