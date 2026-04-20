import { randomUUID } from "crypto";

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

type GlobalWithRooms = typeof globalThis & {
  __moviematch_rooms?: Map<string, Room>;
};

const g = globalThis as GlobalWithRooms;
const rooms: Map<string, Room> = g.__moviematch_rooms ?? new Map();
g.__moviematch_rooms = rooms;

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateCode(): string {
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return out;
}

export function createRoom(): Room {
  let code = generateCode();
  while (rooms.has(code)) code = generateCode();
  const room: Room = { code, createdAt: Date.now(), members: {} };
  rooms.set(code, room);
  return room;
}

export function getRoom(code: string): Room | undefined {
  return rooms.get(code.toUpperCase());
}

export function joinRoom(
  code: string,
  name: string,
  existingUserId?: string,
): { userId: string; room: Room } | null {
  const room = getRoom(code);
  if (!room) return null;

  if (existingUserId && room.members[existingUserId]) {
    const m = room.members[existingUserId];
    m.lastSeen = Date.now();
    if (name && name !== m.name) m.name = name;
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
  return { userId, room };
}

export function recordSwipe(
  code: string,
  userId: string,
  movieId: string,
  swipe: Swipe,
): boolean {
  const room = getRoom(code);
  if (!room) return false;
  const member = room.members[userId];
  if (!member) return false;
  member.swipes[movieId] = swipe;
  member.lastSeen = Date.now();
  return true;
}

export function decideMovie(
  code: string,
  userId: string,
  movieId: string,
): { ok: true; decision: Decision } | { ok: false; error: string } {
  const room = getRoom(code);
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
  return { ok: true, decision: room.decision };
}

export function clearDecision(code: string, userId: string): boolean {
  const room = getRoom(code);
  if (!room) return false;
  if (!room.members[userId]) return false;
  delete room.decision;
  return true;
}

export function touchMember(code: string, userId: string): void {
  const room = getRoom(code);
  if (!room) return;
  const member = room.members[userId];
  if (member) member.lastSeen = Date.now();
}

export function getMatches(room: Room): string[] {
  const memberIds = Object.keys(room.members);
  if (memberIds.length < 2) return [];

  const candidates = new Set<string>();
  for (const mid of memberIds) {
    for (const movieId of Object.keys(room.members[mid].swipes)) {
      candidates.add(movieId);
    }
  }

  const matches: string[] = [];
  for (const movieId of candidates) {
    const everyoneLiked = memberIds.every(
      (mid) => room.members[mid].swipes[movieId] === "like",
    );
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

export function getRoomState(code: string, userId?: string): RoomStateView | null {
  const room = getRoom(code);
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
