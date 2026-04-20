"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CreateRoomForm() {
  return null;
}

export function CreateRoomButton() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleCreate() {
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch("/api/rooms", { method: "POST" });
      if (!res.ok) throw new Error("Failed to create room");
      const { code } = await res.json();
      const q = name ? `?name=${encodeURIComponent(name)}` : "";
      router.push(`/room/${code}${q}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <input
        type="text"
        placeholder="Your name (optional)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full rounded-xl bg-neutral-900 border border-neutral-800 px-4 py-3 text-sm placeholder:text-neutral-600 focus:outline-none focus:border-pink-500/50"
        maxLength={24}
      />
      <button
        onClick={handleCreate}
        disabled={loading}
        className="w-full rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 px-6 py-3 font-semibold text-white shadow-lg shadow-pink-500/20 transition hover:opacity-95 disabled:opacity-50"
      >
        {loading ? "Creating…" : "Create a room"}
      </button>
      {err && <p className="text-xs text-rose-400">{err}</p>}
    </div>
  );
}

export function JoinRoomForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const clean = code.trim().toUpperCase();
    if (clean.length < 4) {
      setErr("Enter a valid room code");
      return;
    }
    const q = name ? `?name=${encodeURIComponent(name)}` : "";
    router.push(`/room/${clean}${q}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <input
        type="text"
        placeholder="Room code"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        className="w-full rounded-xl bg-neutral-900 border border-neutral-800 px-4 py-3 text-center text-lg font-mono tracking-[0.5em] uppercase placeholder:text-neutral-600 placeholder:tracking-normal focus:outline-none focus:border-pink-500/50"
        maxLength={6}
      />
      <input
        type="text"
        placeholder="Your name (optional)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full rounded-xl bg-neutral-900 border border-neutral-800 px-4 py-3 text-sm placeholder:text-neutral-600 focus:outline-none focus:border-pink-500/50"
        maxLength={24}
      />
      <button
        type="submit"
        className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-6 py-3 font-semibold text-neutral-100 transition hover:bg-neutral-800"
      >
        Join room
      </button>
      {err && <p className="text-xs text-rose-400">{err}</p>}
    </form>
  );
}
