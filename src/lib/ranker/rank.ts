import type { MovieWithAvailability } from "../movies";
import type { Room } from "../rooms";
import {
  availability,
  moodMatch,
  quality,
  similarityToLikes,
  trending,
} from "./signals";
import {
  CROSS_POLLINATION_BOOST,
  DIVERSITY_WINDOW,
  RANKER_WEIGHTS,
  SIMILARITY_RAMP,
} from "./weights";

export type DebugScores = {
  moodMatch: number;
  availability: number;
  similarityToLikes: number;
  similarityRampMultiplier: number;
  trending: number;
  quality: number;
  crossPollinated: boolean;
  baseScore: number;
  finalScore: number;
};

export type RankResult = {
  // Movie ids in rank order. Uses the existing Movie.id string convention
  // (`tmdb-NNN` or `fb-N`) so fallback movies are rankable too.
  orderedMovieIds: string[];
  debug?: Record<string, DebugScores>;
};

// Ramp for similarityToLikes. While a member has few likes, their taste
// vector is too noisy — we down-weight the signal's contribution. See
// weights.ts SIMILARITY_RAMP for the knobs.
export function rampMultiplier(swipeCount: number): number {
  const { startsAt, fullAt } = SIMILARITY_RAMP;
  if (swipeCount <= startsAt) return 0;
  if (swipeCount >= fullAt) return 1;
  return (swipeCount - startsAt) / (fullAt - startsAt);
}

// Dominant genre used by the diversity pass. Ties resolved by the lowest
// genre id for determinism (shuffling is handled elsewhere).
function dominantGenre(movie: MovieWithAvailability): number | null {
  if (movie.genres.length === 0) return null;
  // No weights here — each movie contributes its genres equally. When a
  // movie has multiple genres, we pick the smallest id to break ties
  // deterministically; in practice most movies have 2–3 genres so this
  // is a coarse but predictable signal.
  return movie.genres.reduce((a, b) => (a < b ? a : b));
}

type ScoredMovie = {
  movie: MovieWithAvailability;
  score: number;
  popularity: number;
  debug?: DebugScores;
};

export function rankMoviesForMember(params: {
  memberId: string;
  room: Room;
  movies: MovieWithAvailability[];
  trendingIds: Map<number, number>;
}): RankResult {
  const { memberId, room, movies, trendingIds } = params;
  const member = room.members[memberId];
  if (!member) return { orderedMovieIds: [] };

  const others = Object.values(room.members).filter((m) => m.id !== memberId);
  const allMembers = Object.values(room.members);

  // Group mood context: union across every member's submitted moods.
  const moodUnion = new Set<string>();
  for (const m of allMembers) {
    for (const mood of m.moods) moodUnion.add(mood);
  }
  const moods = Array.from(moodUnion);

  // Target member's own likes fuel similarityToLikes.
  const memberLikeIds = new Set<string>();
  for (const [movieId, swipe] of Object.entries(member.swipes)) {
    if (swipe === "like") memberLikeIds.add(movieId);
  }
  const likedMovies = movies.filter((m) => memberLikeIds.has(m.id));
  const ramp = rampMultiplier(memberLikeIds.size);

  // Cross-pollination set: any movie liked by ANY other member. The
  // target's own likes are excluded both here (set only holds others)
  // and below via the already-swiped exclusion, so self-boost is
  // impossible.
  const crossPollinated = new Set<string>();
  for (const o of others) {
    for (const [movieId, swipe] of Object.entries(o.swipes)) {
      if (swipe === "like") crossPollinated.add(movieId);
    }
  }

  const includeDebug = process.env.DEBUG_RANKER === "1";

  // Score + exclude already-swiped-by-target.
  const scored: ScoredMovie[] = [];
  for (const movie of movies) {
    if (member.swipes[movie.id] !== undefined) continue; // already swiped → out

    const mScore = moodMatch(movie, moods);
    const aScore = availability(movie, allMembers);
    const rawSim = similarityToLikes(movie, likedMovies, SIMILARITY_RAMP.startsAt);
    const simContribution = rawSim * ramp;
    const tScore = trending(movie, trendingIds);
    const qScore = quality(movie);

    const base =
      RANKER_WEIGHTS.moodMatch * mScore +
      RANKER_WEIGHTS.availability * aScore +
      RANKER_WEIGHTS.similarityToLikes * simContribution +
      RANKER_WEIGHTS.trending * tScore +
      RANKER_WEIGHTS.quality * qScore;

    const boosted = crossPollinated.has(movie.id);
    const final = base + (boosted ? CROSS_POLLINATION_BOOST : 0);

    const entry: ScoredMovie = {
      movie,
      score: final,
      popularity: movie.popularity,
    };
    if (includeDebug) {
      entry.debug = {
        moodMatch: mScore,
        availability: aScore,
        similarityToLikes: rawSim,
        similarityRampMultiplier: ramp,
        trending: tScore,
        quality: qScore,
        crossPollinated: boosted,
        baseScore: base,
        finalScore: final,
      };
    }
    scored.push(entry);
  }

  // Sort: score desc, popularity desc as tie-break.
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.popularity - a.popularity;
  });

  // Diversity pass: walk left-to-right. If the last DIVERSITY_WINDOW items
  // all share a dominant genre with the incoming one, try to swap it with
  // a later item whose dominant genre differs. Best-effort single pass.
  if (scored.length > DIVERSITY_WINDOW) {
    for (let i = DIVERSITY_WINDOW; i < scored.length; i++) {
      const window = scored.slice(i - DIVERSITY_WINDOW, i);
      const windowGenres = window.map((s) => dominantGenre(s.movie));
      const first = windowGenres[0];
      if (first === null) continue;
      const windowUniform = windowGenres.every((g) => g === first);
      if (!windowUniform) continue;
      const current = dominantGenre(scored[i].movie);
      if (current !== first) continue;

      // Find a later item whose dominant genre differs; swap.
      for (let j = i + 1; j < scored.length; j++) {
        const cand = dominantGenre(scored[j].movie);
        if (cand !== null && cand !== first) {
          [scored[i], scored[j]] = [scored[j], scored[i]];
          break;
        }
      }
    }
  }

  const orderedMovieIds = scored.map((s) => s.movie.id);
  if (includeDebug) {
    const debug: Record<string, DebugScores> = {};
    for (const s of scored) {
      if (s.debug) debug[s.movie.id] = s.debug;
    }
    return { orderedMovieIds, debug };
  }
  return { orderedMovieIds };
}
