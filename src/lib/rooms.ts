import { randomUUID } from "crypto";
import { Redis } from "@upstash/redis";
import { isMoodId, isServiceId } from "./selections";

export type Swipe = "like" | "pass";

export type Member = {
  id: string;
  name: string;
  joinedAt: number;
  lastSeen: number;
  swipes: Record<string, Swipe>;
  moods: string[];
  services: string[];
  servicesAny: boolean;
  selectionSubmittedAt: number | null;
  selectionSkipped: boolean;
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
  moodsRevealed: boolean;
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
    const room: Room = {
      code,
      createdAt: Date.now(),
      members: {},
      moodsRevealed: false,
    };
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
  if (!room) return undefined;
  // Back-compat for rooms created before the selection fields existed.
  if (typeof room.moodsRevealed !== "boolean") room.moodsRevealed = false;
  for (const m of Object.values(room.members)) {
    if (!Array.isArray(m.moods)) m.moods = [];
    if (!Array.isArray(m.services)) m.services = [];
    if (typeof m.servicesAny !== "boolean") m.servicesAny = false;
    if (m.selectionSubmittedAt === undefined) m.selectionSubmittedAt = null;
    if (typeof m.selectionSkipped !== "boolean") m.selectionSkipped = false;
  }
  return room;
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
    moods: [],
    services: [],
    servicesAny: false,
    selectionSubmittedAt: null,
    selectionSkipped: false,
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
  moodsRevealed: boolean;
  members: Array<{
    id: string;
    name: string;
    swipeCount: number;
    online: boolean;
    hasSubmitted: boolean;
    moods: string[]; // empty unless visible to the caller
  }>;
  matches: string[];
  decision?: Decision;
  you?: {
    id: string;
    swipes: Record<string, Swipe>;
    moods: string[];
    services: string[];
    servicesAny: boolean;
    selectionSubmittedAt: number | null;
    selectionSkipped: boolean;
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
  const you = userId ? room.members[userId] : undefined;
  return {
    code: room.code,
    moodsRevealed: room.moodsRevealed,
    members: Object.values(room.members).map((m) => {
      const submitted = m.selectionSubmittedAt !== null;
      // Caller sees their own moods always. Others' moods only when they've
      // submitted AND the room has flipped moodsRevealed (once latched, late
      // submitters reveal on submit — see moodsRevealed semantics).
      const moodsVisible =
        m.id === userId || (submitted && room.moodsRevealed);
      return {
        id: m.id,
        name: m.name,
        swipeCount: Object.keys(m.swipes).length,
        online: now - m.lastSeen < ONLINE_WINDOW_MS,
        hasSubmitted: submitted,
        moods: moodsVisible ? m.moods : [],
      };
    }),
    matches: getMatches(room),
    decision: room.decision,
    you: you
      ? {
          id: you.id,
          swipes: you.swipes,
          moods: you.moods,
          services: you.services,
          servicesAny: you.servicesAny,
          selectionSubmittedAt: you.selectionSubmittedAt,
          selectionSkipped: you.selectionSkipped,
        }
      : undefined,
  };
}

export type SelectionInput = {
  moods: string[];
  services: string[];
  servicesAny: boolean;
  skip?: boolean;
};

export type SubmitSelectionResult =
  | { ok: true; state: RoomStateView }
  | { ok: false; status: 400 | 403 | 404 | 409; error: string };

export async function submitSelection(
  code: string,
  userId: string,
  input: SelectionInput,
): Promise<SubmitSelectionResult> {
  const room = await getRoom(code);
  if (!room) return { ok: false, status: 404, error: "Room not found" };
  const member = room.members[userId];
  if (!member) return { ok: false, status: 403, error: "Not in room" };

  if (member.selectionSubmittedAt !== null) {
    return {
      ok: false,
      status: 409,
      error: "Selection already submitted for this session",
    };
  }

  if (input.skip) {
    member.moods = [];
    member.services = [];
    member.servicesAny = false;
    member.selectionSkipped = true;
  } else {
    if (!Array.isArray(input.moods) || !input.moods.every(isMoodId)) {
      return { ok: false, status: 400, error: "Invalid mood(s)" };
    }
    if (!Array.isArray(input.services) || !input.services.every(isServiceId)) {
      return { ok: false, status: 400, error: "Invalid service(s)" };
    }
    if (input.servicesAny && input.services.length > 0) {
      return {
        ok: false,
        status: 400,
        error: "Cannot pick 'Any' and specific services together",
      };
    }
    member.moods = Array.from(new Set(input.moods));
    member.services = Array.from(new Set(input.services));
    member.servicesAny = !!input.servicesAny;
    member.selectionSkipped = false;
  }

  member.selectionSubmittedAt = Date.now();
  member.lastSeen = Date.now();

  // moodsRevealed is a one-way latch: true once all current members have
  // submitted/skipped. Late joiners don't un-latch it; their moods just
  // become visible on submit.
  if (!room.moodsRevealed) {
    const all = Object.values(room.members).every(
      (m) => m.selectionSubmittedAt !== null,
    );
    if (all) room.moodsRevealed = true;
  }

  await saveRoom(room);
  const state = await getRoomState(code, userId);
  if (!state) return { ok: false, status: 404, error: "Room not found" };
  return { ok: true, state };
}
