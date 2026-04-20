"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Movie } from "@/lib/movies";
import type { RoomStateView, Swipe } from "@/lib/rooms";

type Props = {
  code: string;
  initialName: string;
  movies: Movie[];
};

const LS_KEY = (code: string) => `moviematch:${code}:userId`;

export default function RoomClient({ code, initialName, movies }: Props) {
  const [userId, setUserId] = useState<string | null>(null);
  const [state, setState] = useState<RoomStateView | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [matchQueue, setMatchQueue] = useState<string[]>([]);
  const seenMatches = useRef<Set<string>>(new Set());
  const joinStartedRef = useRef(false);
  const localSwipes = useRef<Record<string, Swipe>>({});

  const mergeLocal = useCallback((s: RoomStateView): RoomStateView => {
    if (!s.you) return s;
    return {
      ...s,
      you: { ...s.you, swipes: { ...s.you.swipes, ...localSwipes.current } },
    };
  }, []);

  useEffect(() => {
    if (!state) return;
    const fresh = state.matches.filter((id) => !seenMatches.current.has(id));
    if (fresh.length === 0) return;
    for (const id of fresh) seenMatches.current.add(id);
    setMatchQueue((q) => [...q, ...fresh]);
  }, [state]);

  const movieById = useMemo(() => {
    const m = new Map<string, Movie>();
    for (const movie of movies) m.set(movie.id, movie);
    return m;
  }, [movies]);

  const dismissTopMatch = useCallback(() => {
    setMatchQueue((q) => q.slice(1));
  }, []);

  const pickMovie = useCallback(
    async (movieId: string) => {
      if (!userId) return;
      try {
        await fetch(`/api/rooms/${code}/decide`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ userId, movieId }),
        });
      } catch {
        // ignore
      }
    },
    [code, userId],
  );

  const keepSwiping = useCallback(async () => {
    if (!userId) return;
    try {
      await fetch(`/api/rooms/${code}/decide?userId=${userId}`, {
        method: "DELETE",
      });
      setState((prev) => (prev ? { ...prev, decision: undefined } : prev));
    } catch {
      // ignore
    }
  }, [code, userId]);

  useEffect(() => {
    if (joinStartedRef.current) return;
    joinStartedRef.current = true;
    let cancelled = false;
    async function init() {
      const stored =
        typeof window !== "undefined" ? localStorage.getItem(LS_KEY(code)) : null;
      const name =
        initialName ||
        (typeof window !== "undefined" ? localStorage.getItem("moviematch:name") : "") ||
        "";
      try {
        const res = await fetch(`/api/rooms/${code}/join`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name, userId: stored ?? undefined }),
        });
        if (!res.ok) {
          setJoinError(res.status === 404 ? "Room not found" : "Failed to join");
          return;
        }
        const data = (await res.json()) as { userId: string };
        if (cancelled) return;
        localStorage.setItem(LS_KEY(code), data.userId);
        if (name) localStorage.setItem("moviematch:name", name);
        setUserId(data.userId);
      } catch {
        setJoinError("Network error");
      }
    }
    init();
    return () => {
      cancelled = true;
    };
  }, [code, initialName]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch(
          `/api/rooms/${code}/state?userId=${userId}`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const data = (await res.json()) as RoomStateView;
        if (!cancelled) setState(mergeLocal(data));
      } catch {
        // ignore transient errors
      }
    }
    poll();
    const iv = setInterval(poll, 2000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [code, userId, mergeLocal]);

  const mySwipes = state?.you?.swipes ?? {};
  const queue = useMemo(
    () => movies.filter((m) => !mySwipes[m.id]),
    [movies, mySwipes],
  );

  const handleSwipe = useCallback(
    async (movieId: string, swipe: Swipe) => {
      if (!userId) return;
      if (localSwipes.current[movieId]) return;
      localSwipes.current[movieId] = swipe;
      setState((prev) =>
        prev
          ? {
              ...prev,
              you: prev.you
                ? { ...prev.you, swipes: { ...prev.you.swipes, [movieId]: swipe } }
                : prev.you,
            }
          : prev,
      );
      try {
        await fetch(`/api/rooms/${code}/swipe`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ userId, movieId, swipe }),
        });
      } catch {
        // ignore
      }
    },
    [code, userId],
  );

  if (joinError) {
    return (
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="max-w-sm text-center space-y-3">
          <h1 className="text-2xl font-semibold">{joinError}</h1>
          <a href="/" className="inline-block text-pink-400 hover:underline">
            Back home
          </a>
        </div>
      </main>
    );
  }

  const decidedMovie = state?.decision
    ? movieById.get(state.decision.movieId)
    : undefined;
  const topMatchId = matchQueue[0];
  const topMatchMovie = topMatchId ? movieById.get(topMatchId) : undefined;
  const showMatchModal = !!topMatchMovie && !state?.decision;

  return (
    <main className="flex flex-1 flex-col px-4 py-6 max-w-2xl mx-auto w-full">
      <RoomHeader code={code} state={state} />
      {decidedMovie && state?.decision ? (
        <WatchScreen
          movie={decidedMovie}
          decidedByName={state.decision.decidedByName}
          onUndo={keepSwiping}
        />
      ) : !userId || !state?.you ? (
        <div className="flex-1 flex items-center justify-center py-8">
          <p className="text-neutral-500 text-sm animate-pulse">Joining room…</p>
        </div>
      ) : (
        <>
          <div className="flex-1 flex items-center justify-center py-8">
            <SwipeDeck queue={queue} onSwipe={handleSwipe} />
          </div>
          <MatchesBar matches={state?.matches ?? []} movies={movies} />
        </>
      )}
      {showMatchModal && topMatchMovie && (
        <MatchModal
          movie={topMatchMovie}
          members={state?.members ?? []}
          onDismiss={dismissTopMatch}
          onPick={async () => {
            await pickMovie(topMatchMovie.id);
            dismissTopMatch();
          }}
        />
      )}
    </main>
  );
}

function RoomHeader({ code, state }: { code: string; state: RoomStateView | null }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }
  return (
    <header className="flex items-center justify-between gap-4">
      <div>
        <p className="text-xs uppercase tracking-widest text-neutral-500">Room code</p>
        <button
          onClick={copy}
          className="text-2xl font-mono tracking-[0.4em] text-neutral-100 hover:text-pink-300 transition"
          title="Click to copy"
        >
          {code}
        </button>
        {copied && <span className="ml-2 text-xs text-pink-400">copied!</span>}
      </div>
      <div className="flex -space-x-2">
        {state?.members.map((m) => (
          <div
            key={m.id}
            title={`${m.name} — ${m.swipeCount} swipes${m.online ? "" : " (offline)"}`}
            className={`h-9 w-9 rounded-full flex items-center justify-center text-sm font-semibold border-2 border-neutral-950 ${
              m.online ? "bg-pink-500 text-white" : "bg-neutral-700 text-neutral-300"
            }`}
          >
            {m.name.slice(0, 1).toUpperCase()}
          </div>
        ))}
      </div>
    </header>
  );
}

function SwipeDeck({
  queue,
  onSwipe,
}: {
  queue: Movie[];
  onSwipe: (movieId: string, swipe: Swipe) => void;
}) {
  if (queue.length === 0) {
    return (
      <div className="text-center text-neutral-400 space-y-2">
        <p className="text-2xl">🎬</p>
        <p>You&rsquo;ve swiped through everything.</p>
        <p className="text-sm text-neutral-500">
          Waiting on your friends to catch up.
        </p>
      </div>
    );
  }

  const top = queue[0];
  const next = queue[1];

  return (
    <div className="relative w-full max-w-sm aspect-[2/3]">
      {next && <MovieCard key={next.id} movie={next} stacked />}
      <MovieCard
        key={top.id}
        movie={top}
        onLike={() => onSwipe(top.id, "like")}
        onPass={() => onSwipe(top.id, "pass")}
      />
    </div>
  );
}

function MovieCard({
  movie,
  onLike,
  onPass,
  stacked,
}: {
  movie: Movie;
  onLike?: () => void;
  onPass?: () => void;
  stacked?: boolean;
}) {
  const [dx, setDx] = useState(0);
  const [animating, setAnimating] = useState<"like" | "pass" | null>(null);
  const startX = useRef<number | null>(null);
  const active = !stacked && !animating;

  function handlePointerDown(e: React.PointerEvent) {
    if (!active) return;
    startX.current = e.clientX;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // ignore unsupported environments
    }
  }
  function handlePointerMove(e: React.PointerEvent) {
    if (startX.current == null) return;
    setDx(e.clientX - startX.current);
  }
  function handlePointerUp() {
    if (startX.current == null) return;
    const threshold = 55;
    if (dx > threshold && onLike) {
      setAnimating("like");
      setTimeout(() => onLike(), 180);
    } else if (dx < -threshold && onPass) {
      setAnimating("pass");
      setTimeout(() => onPass(), 180);
    } else {
      setDx(0);
    }
    startX.current = null;
  }

  const translate =
    animating === "like"
      ? "translateX(500px) rotate(20deg)"
      : animating === "pass"
        ? "translateX(-500px) rotate(-20deg)"
        : `translateX(${dx}px) rotate(${dx * 0.05}deg)`;

  const likeOpacity = Math.max(0, Math.min(1, dx / 100));
  const passOpacity = Math.max(0, Math.min(1, -dx / 100));

  return (
    <div
      className={`absolute inset-0 rounded-2xl overflow-hidden shadow-2xl bg-neutral-900 border border-neutral-800 ${
        stacked ? "scale-[0.95] translate-y-2 opacity-60 pointer-events-none" : ""
      }`}
      style={{
        transform: stacked ? undefined : translate,
        transition: startX.current == null ? "transform 200ms ease-out" : "none",
        touchAction: stacked ? undefined : "none",
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <Image
        src={movie.posterUrl}
        alt={movie.title}
        fill
        sizes="(max-width: 640px) 100vw, 384px"
        className="object-cover select-none pointer-events-none"
        unoptimized
        priority={!stacked}
      />
      <div className="absolute inset-x-0 bottom-0 p-5 bg-gradient-to-t from-black/95 via-black/70 to-transparent">
        <div className="flex items-baseline gap-2">
          <h2 className="text-2xl font-bold">{movie.title}</h2>
          <span className="text-neutral-400">{movie.year}</span>
        </div>
        <div className="text-sm text-amber-300 mb-2">★ {movie.rating}</div>
        <p className="text-sm text-neutral-300 line-clamp-4">{movie.overview}</p>
      </div>

      {!stacked && (
        <>
          <div
            className="absolute top-6 left-6 px-3 py-1 rounded-lg border-2 border-rose-400 text-rose-300 font-extrabold text-sm tracking-widest -rotate-12"
            style={{ opacity: passOpacity }}
          >
            NOPE
          </div>
          <div
            className="absolute top-6 right-6 px-3 py-1 rounded-lg border-2 border-emerald-400 text-emerald-300 font-extrabold text-sm tracking-widest rotate-12"
            style={{ opacity: likeOpacity }}
          >
            LIKE
          </div>
        </>
      )}

      {!stacked && (
        <div className="absolute bottom-4 right-4 flex gap-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (onPass) {
                setAnimating("pass");
                setTimeout(onPass, 180);
              }
            }}
            className="h-12 w-12 rounded-full bg-neutral-800/90 border border-neutral-700 text-rose-400 text-xl hover:scale-105 transition"
            aria-label="Pass"
          >
            ✕
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (onLike) {
                setAnimating("like");
                setTimeout(onLike, 180);
              }
            }}
            className="h-12 w-12 rounded-full bg-gradient-to-br from-pink-500 to-rose-500 text-white text-xl shadow-lg shadow-pink-500/30 hover:scale-105 transition"
            aria-label="Like"
          >
            ♥
          </button>
        </div>
      )}
    </div>
  );
}

function MatchesBar({ matches, movies }: { matches: string[]; movies: Movie[] }) {
  const matched = matches
    .map((id) => movies.find((m) => m.id === id))
    .filter((m): m is Movie => !!m);
  if (matched.length === 0) {
    return (
      <div className="text-center text-xs text-neutral-500 py-2">
        No matches yet — keep swiping.
      </div>
    );
  }
  return (
    <div className="border-t border-neutral-800 pt-3 pb-2">
      <p className="text-xs uppercase tracking-widest text-pink-400 mb-2">
        {matched.length} match{matched.length > 1 ? "es" : ""} 🎉
      </p>
      <div className="flex gap-2 overflow-x-auto">
        {matched.map((m) => (
          <div
            key={m.id}
            title={m.title}
            className="relative shrink-0 w-16 h-24 rounded-lg overflow-hidden border border-pink-500/40"
          >
            <Image
              src={m.posterUrl}
              alt={m.title}
              fill
              sizes="64px"
              className="object-cover"
              unoptimized
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function MatchModal({
  movie,
  members,
  onDismiss,
  onPick,
}: {
  movie: Movie;
  members: RoomStateView["members"];
  onDismiss: () => void;
  onPick: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onDismiss}
    >
      <div
        className="relative w-full max-w-md rounded-3xl overflow-hidden border border-pink-500/40 bg-gradient-to-b from-pink-950/80 to-neutral-950 shadow-2xl shadow-pink-500/20"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 text-center">
          <p className="text-xs uppercase tracking-[0.4em] text-pink-300/70">
            It&rsquo;s a match
          </p>
          <h2 className="mt-1 text-4xl font-black bg-gradient-to-r from-pink-300 to-rose-400 bg-clip-text text-transparent">
            🎬🍿
          </h2>
        </div>
        <div className="relative aspect-[2/3] max-h-[60vh] mx-auto w-full px-5">
          <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-xl">
            <Image
              src={movie.posterUrl}
              alt={movie.title}
              fill
              sizes="(max-width: 640px) 100vw, 384px"
              className="object-cover"
              unoptimized
              priority
            />
          </div>
        </div>
        <div className="p-5 space-y-1 text-center">
          <h3 className="text-2xl font-bold">{movie.title}</h3>
          <p className="text-neutral-400">
            {movie.year} · ★ <span className="text-amber-300">{movie.rating}</span>
          </p>
          <p className="text-sm text-neutral-400 pt-2">
            Everyone in the room liked this one.
          </p>
          <div className="flex justify-center gap-1 pt-2">
            {members.map((m) => (
              <span
                key={m.id}
                className="inline-flex items-center gap-1 text-xs bg-neutral-800/80 border border-neutral-700 rounded-full px-2 py-1"
              >
                <span className="h-2 w-2 rounded-full bg-pink-500" />
                {m.name}
              </span>
            ))}
          </div>
        </div>
        <div className="p-5 pt-0 flex gap-3">
          <button
            onClick={onDismiss}
            className="flex-1 rounded-xl border border-neutral-700 bg-neutral-900 py-3 font-semibold text-neutral-200 hover:bg-neutral-800 transition"
          >
            Keep swiping
          </button>
          <button
            onClick={onPick}
            className="flex-1 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 py-3 font-bold text-white shadow-lg shadow-pink-500/30 hover:opacity-95 transition"
          >
            Pick this one
          </button>
        </div>
      </div>
    </div>
  );
}

function WatchScreen({
  movie,
  decidedByName,
  onUndo,
}: {
  movie: Movie;
  decidedByName: string;
  onUndo: () => void;
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center py-6 text-center">
      <p className="text-xs uppercase tracking-[0.4em] text-pink-300/70">
        You&rsquo;re watching
      </p>
      <h2 className="mt-2 text-3xl font-black">🍿</h2>
      <div className="relative w-48 aspect-[2/3] my-5 rounded-2xl overflow-hidden shadow-2xl shadow-pink-500/20 border border-pink-500/40">
        <Image
          src={movie.posterUrl}
          alt={movie.title}
          fill
          sizes="192px"
          className="object-cover"
          unoptimized
          priority
        />
      </div>
      <h3 className="text-3xl font-bold">{movie.title}</h3>
      <p className="text-neutral-400 mt-1">
        {movie.year} · ★ <span className="text-amber-300">{movie.rating}</span>
      </p>
      <p className="text-sm text-neutral-500 mt-4 max-w-sm">{movie.overview}</p>
      <p className="text-xs text-neutral-600 mt-6">
        Chosen by <span className="text-pink-400">{decidedByName}</span>
      </p>
      <button
        onClick={onUndo}
        className="mt-4 text-xs text-neutral-400 hover:text-pink-300 underline underline-offset-4"
      >
        Actually, let&rsquo;s keep swiping
      </button>
    </div>
  );
}
