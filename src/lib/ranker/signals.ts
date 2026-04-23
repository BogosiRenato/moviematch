import type { Movie, MovieWithAvailability } from "../movies";
import { MOOD_TO_GENRES, MOOD_TO_KEYWORDS } from "../mood-mapping";
import type { Member } from "../rooms";
import type { MoodId } from "../selections";
import { isMoodId } from "../selections";

// Every signal returns a value in [0, 1]. Neutral is 0.5 — used when we
// have no basis to score (e.g. fallback movies without metadata).

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

// Distinct union of mapped genres + mapped keywords across all active
// moods. Score = (matches on the movie) / (distinct mapped items). Empty
// moods or empty mapping → 0.5 neutral.
export function moodMatch(movie: Movie, moods: string[]): number {
  if (moods.length === 0) return 0.5;

  const genreUnion = new Set<number>();
  const keywordUnion = new Set<string>();
  for (const m of moods) {
    if (!isMoodId(m)) continue;
    const id = m as MoodId;
    for (const g of MOOD_TO_GENRES[id]) genreUnion.add(g);
    for (const k of MOOD_TO_KEYWORDS[id]) keywordUnion.add(k.toLowerCase());
  }

  const total = genreUnion.size + keywordUnion.size;
  if (total === 0) return 0.5;

  const movieGenres = new Set(movie.genres);
  const movieKeywords = new Set(movie.keywords.map((k) => k.toLowerCase()));

  let matches = 0;
  for (const g of genreUnion) if (movieGenres.has(g)) matches++;
  for (const k of keywordUnion) if (movieKeywords.has(k)) matches++;

  return clamp01(matches / total);
}

// Availability: share of members who can watch this movie on one of their
// selected services in their region.
//
//   - servicesAny = true OR selectionSkipped = true → counts as "can watch"
//     (no constraint). Even when the movie has no known streaming.
//   - Constrained members need their services to intersect
//     movie.availability[member.region].
//
// If EVERY member lacks usable availability for this movie (undefined or
// empty-array at their region), return 0.5 neutral — we don't want to
// penalize a movie just because TMDB data is missing. If even one member
// has real data, that's signal worth using and we compute normally.
export function availability(
  movie: MovieWithAvailability,
  members: Member[],
): number {
  if (members.length === 0) return 0.5;

  const allMissing = members.every((m) => {
    const list = movie.availability[m.region];
    return !list || list.length === 0;
  });
  if (allMissing) return 0.5;

  let canWatch = 0;
  for (const m of members) {
    if (m.servicesAny || m.selectionSkipped) {
      canWatch++;
      continue;
    }
    const movieServices = movie.availability[m.region] ?? [];
    if (movieServices.length === 0) continue;
    if (movieServices.some((s) => m.services.includes(s))) {
      canWatch++;
    }
  }
  return clamp01(canWatch / members.length);
}

// Build a taste vector over TMDB genre IDs from the movies this member
// has individually liked, then return cosine similarity to the candidate
// movie's own genre vector. Returns 0.5 if the member has < startsAt
// likes (the ramp multiplier outside the signal will typically zero it
// out in that regime anyway, but the neutral internal value matters for
// debug logging).
export function similarityToLikes(
  movie: Movie,
  likedMovies: Movie[],
  minLikesForSignal: number,
): number {
  if (likedMovies.length < minLikesForSignal) return 0.5;
  if (likedMovies.length === 0) return 0.5;
  if (movie.genres.length === 0) return 0.5;

  const taste = new Map<number, number>();
  for (const liked of likedMovies) {
    for (const g of liked.genres) {
      taste.set(g, (taste.get(g) ?? 0) + 1);
    }
  }
  if (taste.size === 0) return 0.5;

  const movieGenres = new Set(movie.genres);
  let dot = 0;
  let tasteMag2 = 0;
  for (const [g, w] of taste) {
    tasteMag2 += w * w;
    if (movieGenres.has(g)) dot += w;
  }
  const movieMag = Math.sqrt(movieGenres.size);
  const tasteMag = Math.sqrt(tasteMag2);
  if (movieMag === 0 || tasteMag === 0) return 0;
  return clamp01(dot / (movieMag * tasteMag));
}

// Trending: linearly interpolate 1.0 at rank 1 down to 0.5 at rank 20.
// Not in the trending set → 0. trendingIds is movieId → 1-indexed rank.
export function trending(
  movie: Movie,
  trendingIds: Map<number, number>,
): number {
  const match = /^tmdb-(\d+)$/.exec(movie.id);
  if (!match) return 0;
  const tmdbId = Number(match[1]);
  const rank = trendingIds.get(tmdbId);
  if (!rank) return 0;
  // rank 1 → 1.0, rank 20 → 0.5. Linear between.
  const denom = 38; // 2 * (20 - 1) so rank 1 = 1.0 and rank 20 = 0.5
  return clamp01(1 - (rank - 1) / denom);
}

// Quality: vote_average / 10, down-weighted by a vote-count ramp so a
// 10.0 rating from three voters doesn't beat a widely-loved 8.5.
export function quality(movie: Movie): number {
  const base = (movie.rating ?? 0) / 10;
  const voteRamp = Math.min((movie.voteCount ?? 0) / 500, 1);
  return clamp01(base * voteRamp);
}
