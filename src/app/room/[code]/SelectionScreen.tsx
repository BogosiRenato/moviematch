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

type MoodStyle = {
  emoji: string;
  accent: string;
  glow: string;
};

const MOOD_STYLE: Record<MoodId, MoodStyle> = {
  fun:         { emoji: "🎉", accent: "from-amber-400 to-orange-500",    glow: "shadow-amber-500/40"    },
  thoughtful:  { emoji: "🧠", accent: "from-indigo-500 to-blue-600",     glow: "shadow-indigo-500/40"   },
  spooky:      { emoji: "👻", accent: "from-purple-600 to-neutral-900",  glow: "shadow-purple-500/40"   },
  action:      { emoji: "💥", accent: "from-red-500 to-orange-600",      glow: "shadow-red-500/40"      },
  romantic:    { emoji: "💗", accent: "from-pink-400 to-rose-500",       glow: "shadow-pink-500/40"     },
  feelgood:    { emoji: "🌿", accent: "from-emerald-400 to-teal-500",    glow: "shadow-emerald-500/40"  },
  weird:       { emoji: "🌀", accent: "from-fuchsia-500 to-cyan-500",    glow: "shadow-fuchsia-500/40"  },
  mindbending: { emoji: "🧩", accent: "from-violet-500 to-cyan-400",     glow: "shadow-violet-500/40"   },
};

type ServiceStyle = {
  bg: string;
  glow: string;
  logo: React.ReactNode;
};

const SERVICE_STYLE: Record<ServiceId, ServiceStyle> = {
  netflix: {
    bg: "bg-[#E50914]",
    glow: "shadow-red-600/50",
    logo: <NetflixLogo />,
  },
  prime: {
    bg: "bg-[#00A8E1]",
    glow: "shadow-sky-500/50",
    logo: <PrimeLogo />,
  },
  disneyplus: {
    bg: "bg-gradient-to-br from-[#01153E] via-[#0A2C77] to-[#1F80E0]",
    glow: "shadow-blue-600/50",
    logo: <DisneyPlusLogo />,
  },
  appletv: {
    bg: "bg-black",
    glow: "shadow-neutral-500/40",
    logo: <AppleTvLogo />,
  },
  max: {
    bg: "bg-gradient-to-br from-[#002BE7] to-[#7B2BF9]",
    glow: "shadow-indigo-500/50",
    logo: <MaxLogo />,
  },
  hulu: {
    bg: "bg-[#1CE783]",
    glow: "shadow-emerald-400/50",
    logo: <HuluLogo />,
  },
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
        <div className="grid grid-cols-2 gap-2.5" role="group" aria-label="Moods">
          {MOODS.map((m) => {
            const active = moods.has(m.id);
            const s = MOOD_STYLE[m.id];
            return (
              <button
                key={m.id}
                type="button"
                aria-pressed={active}
                onClick={() => toggleMood(m.id)}
                disabled={!!pending}
                className={
                  "group relative rounded-2xl px-4 py-3 text-left font-semibold text-sm border transition-all duration-200 ease-out disabled:opacity-60 active:scale-95 " +
                  (active
                    ? `bg-gradient-to-br ${s.accent} text-white border-white/20 -translate-y-0.5 shadow-lg ${s.glow} animate-pop`
                    : "bg-neutral-900 text-neutral-200 border-neutral-800 hover:border-neutral-600 hover:-translate-y-0.5 hover:bg-neutral-800/70")
                }
              >
                <span className="flex items-center gap-2">
                  <span
                    className={
                      "text-2xl inline-block transition-transform duration-200 origin-bottom " +
                      (active
                        ? "scale-110 animate-float"
                        : "group-hover:animate-wiggle")
                    }
                    aria-hidden
                  >
                    {s.emoji}
                  </span>
                  <span>{m.label}</span>
                </span>
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

        <button
          type="button"
          aria-pressed={servicesAny}
          onClick={pickAny}
          disabled={!!pending}
          className={
            "w-full rounded-2xl px-4 py-2.5 text-sm font-semibold border transition-all duration-200 ease-out disabled:opacity-60 active:scale-[0.98] " +
            (servicesAny
              ? "bg-gradient-to-r from-pink-500 to-rose-500 text-white border-white/20 shadow-lg shadow-pink-500/30 animate-pop"
              : "bg-neutral-900 text-neutral-300 border-neutral-800 hover:border-neutral-600 hover:bg-neutral-800/70")
          }
        >
          Any / doesn&rsquo;t matter
        </button>

        <div
          className="grid grid-cols-2 gap-2.5"
          role="group"
          aria-label="Streaming services"
        >
          {STREAMING_SERVICES.map((s) => {
            const active = services.has(s.id);
            const style = SERVICE_STYLE[s.id];
            return (
              <button
                key={s.id}
                type="button"
                aria-pressed={active}
                aria-label={s.label}
                onClick={() => toggleService(s.id)}
                disabled={!!pending}
                className={
                  "relative h-16 rounded-2xl overflow-hidden flex items-center justify-center border transition-all duration-200 ease-out disabled:opacity-60 active:scale-95 " +
                  style.bg +
                  " " +
                  (active
                    ? `border-white/30 -translate-y-0.5 shadow-xl ${style.glow} animate-pop`
                    : "border-neutral-800 opacity-60 saturate-[0.7] hover:opacity-95 hover:saturate-100 hover:-translate-y-0.5")
                }
              >
                {style.logo}
                <span
                  className={
                    "absolute top-1.5 right-1.5 h-5 w-5 rounded-full flex items-center justify-center text-[11px] font-bold transition-all duration-200 " +
                    (active
                      ? "bg-white/95 text-neutral-900 scale-100"
                      : "bg-white/0 text-transparent scale-50")
                  }
                  aria-hidden
                >
                  ✓
                </span>
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
          className="flex-1 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 py-3 font-bold text-white shadow-lg shadow-pink-500/30 hover:opacity-95 transition disabled:opacity-60 active:scale-[0.98]"
        >
          {pending === "submit" ? "Saving…" : "Start swiping"}
        </button>
      </div>
    </div>
  );
}

function NetflixLogo() {
  return (
    <span
      className="text-white font-black text-[15px] tracking-[0.22em]"
      style={{ fontFamily: "'Arial Black', Impact, sans-serif" }}
    >
      NETFLIX
    </span>
  );
}

function PrimeLogo() {
  return (
    <div className="flex flex-col items-center leading-none text-white">
      <span className="text-[15px] font-semibold tracking-tight">prime</span>
      <span className="text-[10px] font-light tracking-[0.2em] mt-0.5">
        VIDEO
      </span>
    </div>
  );
}

function DisneyPlusLogo() {
  return (
    <span className="text-white font-black italic text-lg tracking-wide">
      Disney<span className="font-bold not-italic ml-0.5">+</span>
    </span>
  );
}

function AppleTvLogo() {
  return (
    <div className="flex items-center gap-1.5 text-white">
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className="h-5 w-5"
        aria-hidden
      >
        <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
      </svg>
      <span className="font-semibold text-base tracking-tight">
        tv<span className="font-light">+</span>
      </span>
    </div>
  );
}

function MaxLogo() {
  return (
    <span className="text-white font-black italic text-2xl tracking-tight">
      max
    </span>
  );
}

function HuluLogo() {
  return (
    <span className="text-black font-black italic text-xl tracking-tight">
      hulu
    </span>
  );
}
