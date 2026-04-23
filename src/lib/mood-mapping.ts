import type { MoodId } from "./selections";

// Mood → TMDB genre IDs. Source of truth for the ranker's moodMatch signal.
// Numbers are TMDB genre IDs (stable across the API).
export const MOOD_TO_GENRES: Record<MoodId, number[]> = {
  fun: [35, 12, 10751], // Comedy, Adventure, Family
  thoughtful: [18, 99], // Drama, Documentary
  spooky: [27, 53], // Horror, Thriller
  action: [28, 12], // Action, Adventure
  romantic: [10749], // Romance
  feelgood: [35, 10751, 16], // Comedy, Family, Animation
  weird: [], // primarily keyword-driven
  mindbending: [878, 9648], // Science Fiction, Mystery
};

// Mood → TMDB keyword names (lowercase). Keywords come from the enrichment
// pipeline in movies.ts; matching is case-insensitive (we lowercase on
// fetch). We pick a small, curated set per mood — broader lists dilute the
// signal.
export const MOOD_TO_KEYWORDS: Record<MoodId, string[]> = {
  fun: ["comedy", "lighthearted"],
  thoughtful: ["philosophy", "character study", "introspective"],
  spooky: ["supernatural", "ghost", "haunting"],
  action: ["high stakes", "chase"],
  romantic: ["love triangle", "romance"],
  feelgood: ["heartwarming", "uplifting"],
  weird: ["surreal", "cult film", "absurd"],
  mindbending: ["nonlinear timeline", "plot twist", "twist ending"],
};
