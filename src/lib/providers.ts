import type { ServiceId } from "./selections";

export type { ServiceId };

// TMDB provider_id → our ServiceId. IDs are stable across regions; only
// which providers appear per region varies. Providers returned by TMDB
// that aren't in this map are ignored — we only care about our 6 services.
const TMDB_PROVIDER_MAP: Record<number, ServiceId> = {
  8: "netflix",
  9: "prime", // Amazon Prime Video
  337: "disneyplus",
  350: "appletv", // Apple TV+
  1899: "max", // Max / HBO Max
  15: "hulu",
};

type CacheEntry = { services: ServiceId[]; expiresAt: number };

const cache = new Map<string, CacheEntry>();
const SUCCESS_TTL_MS = 24 * 60 * 60 * 1000;
const FAILURE_TTL_MS = 60 * 60 * 1000;

let warnedMissingKey = false;

function cacheKey(movieId: number, region: string): string {
  return `${movieId}:${region}`;
}

function debug(...args: unknown[]): void {
  if (process.env.DEBUG_PROVIDERS) {
    console.log("[providers]", ...args);
  }
}

type TmdbProviderResults = {
  results?: Record<
    string,
    {
      flatrate?: Array<{ provider_id: number }>;
    }
  >;
};

async function fetchFromTmdb(
  movieId: number,
  region: string,
  key: string,
): Promise<ServiceId[]> {
  const url = `https://api.themoviedb.org/3/movie/${movieId}/watch/providers`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
    },
    // Providers shift gradually; 24h matches our in-memory TTL.
    next: { revalidate: 24 * 60 * 60 },
  });
  if (!res.ok) {
    throw new Error(`TMDB ${res.status}`);
  }
  const data = (await res.json()) as TmdbProviderResults;
  const flatrate = data?.results?.[region]?.flatrate;
  if (!Array.isArray(flatrate)) return [];

  const seen = new Set<ServiceId>();
  for (const entry of flatrate) {
    const mapped = TMDB_PROVIDER_MAP[entry.provider_id];
    if (mapped) seen.add(mapped);
  }
  return Array.from(seen);
}

export async function getAvailability(
  movieId: number,
  region: string,
): Promise<ServiceId[]> {
  const key = process.env.TMDB_API_KEY;
  if (!key) {
    if (!warnedMissingKey) {
      warnedMissingKey = true;
      console.warn(
        "[providers] TMDB_API_KEY not set — availability lookups will return empty",
      );
    }
    return [];
  }

  const ck = cacheKey(movieId, region);
  const hit = cache.get(ck);
  if (hit && hit.expiresAt > Date.now()) {
    debug("hit", ck);
    return hit.services;
  }
  debug("miss", ck);

  try {
    const services = await fetchFromTmdb(movieId, region, key);
    cache.set(ck, {
      services,
      expiresAt: Date.now() + SUCCESS_TTL_MS,
    });
    return services;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(
      `[providers] lookup failed movieId=${movieId} region=${region}: ${msg}`,
    );
    cache.set(ck, {
      services: [],
      expiresAt: Date.now() + FAILURE_TTL_MS,
    });
    return [];
  }
}
