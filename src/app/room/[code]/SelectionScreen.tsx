"use client";

import { useCallback, useState } from "react";
import {
  MOODS,
  STREAMING_SERVICES,
  type MoodId,
  type ServiceId,
} from "@/lib/selections";

type Props = {
  code: string;
  userId: string;
  onSubmitted: () => void;
};

export default function SelectionScreen({ code, userId, onSubmitted }: Props) {
  const [moods, setMoods] = useState<Set<MoodId>>(new Set());
  const [services, setServices] = useState<Set<ServiceId>>(new Set());
  const [servicesAny, setServicesAny] = useState(false);
  const [pending, setPending] = useState<"submit" | "skip" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggleMood = useCallback((id: MoodId) => {
    setMoods((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleService = useCallback((id: ServiceId) => {
    setServicesAny(false);
    setServices((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const pickAny = useCallback(() => {
    setServices(new Set());
    setServicesAny((prev) => !prev);
  }, []);

  const submit = useCallback(
    async (skip: boolean) => {
      if (pending) return;
      setPending(skip ? "skip" : "submit");
      setError(null);
      try {
        const res = await fetch(`/api/rooms/${code}/select`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            userId,
            moods: skip ? [] : Array.from(moods),
            services: skip ? [] : Array.from(services),
            servicesAny: skip ? false : servicesAny,
            skip,
          }),
        });
        if (res.ok || res.status === 409) {
          onSubmitted();
          return;
        }
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error || "Failed to save your picks");
        setPending(null);
      } catch {
        setError("Network error — try again?");
        setPending(null);
      }
    },
    [code, moods, onSubmitted, pending, services, servicesAny, userId],
  );

  return (
    <div className="flex-1 flex flex-col gap-8 py-6 max-w-lg w-full mx-auto">
      <section className="space-y-3">
        <div>
          <h2 className="text-2xl font-bold">What are you in the mood for?</h2>
          <p className="text-sm text-neutral-400 mt-1">
            Pick 1&ndash;3 moods (or skip)
          </p>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Moods">
          {MOODS.map((m) => {
            const active = moods.has(m.id);
            return (
              <button
                key={m.id}
                type="button"
                aria-pressed={active}
                onClick={() => toggleMood(m.id)}
                disabled={!!pending}
                className={chipClass(active)}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </section>

      <div className="h-px bg-neutral-800" />

      <section className="space-y-3">
        <div>
          <h2 className="text-2xl font-bold">Where do you watch?</h2>
          <p className="text-sm text-neutral-400 mt-1">
            Pick any that apply, or &ldquo;Any&rdquo;
          </p>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Streaming services">
          <button
            type="button"
            aria-pressed={servicesAny}
            onClick={pickAny}
            disabled={!!pending}
            className={chipClass(servicesAny)}
          >
            Any / doesn&rsquo;t matter
          </button>
          {STREAMING_SERVICES.map((s) => {
            const active = services.has(s.id);
            return (
              <button
                key={s.id}
                type="button"
                aria-pressed={active}
                onClick={() => toggleService(s.id)}
                disabled={!!pending}
                className={chipClass(active)}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </section>

      {error && (
        <p
          role="alert"
          className="text-sm text-rose-300 bg-rose-950/40 border border-rose-900 rounded-lg px-3 py-2"
        >
          {error}
        </p>
      )}

      <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
        <button
          type="button"
          onClick={() => submit(true)}
          disabled={!!pending}
          className="flex-1 rounded-xl border border-neutral-700 bg-neutral-900 py-3 font-semibold text-neutral-300 hover:bg-neutral-800 transition disabled:opacity-60"
        >
          {pending === "skip" ? "Skipping…" : "Skip"}
        </button>
        <button
          type="button"
          onClick={() => submit(false)}
          disabled={!!pending}
          className="flex-1 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 py-3 font-bold text-white shadow-lg shadow-pink-500/30 hover:opacity-95 transition disabled:opacity-60"
        >
          {pending === "submit" ? "Saving…" : "Start swiping"}
        </button>
      </div>
    </div>
  );
}

function chipClass(active: boolean): string {
  return active
    ? "rounded-full px-4 py-2 text-sm font-semibold bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-md shadow-pink-500/20 border border-transparent transition disabled:opacity-60"
    : "rounded-full px-4 py-2 text-sm font-medium bg-neutral-800 text-neutral-300 border border-neutral-700 hover:border-neutral-500 hover:text-neutral-100 transition disabled:opacity-60";
}
