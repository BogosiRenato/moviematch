// Tunable constants for the Phase 4 ranker. Changing these directly
// shifts how the deck is ordered; no other code should encode these
// numbers. All weights are [0, 1] and the five signal weights sum to 1.0
// so the base score is naturally in [0, 1] before the cross-pollination
// boost is added on top.

export const RANKER_WEIGHTS = {
  moodMatch: 0.3,
  availability: 0.25,
  similarityToLikes: 0.2, // ramps with the member's own swipe count
  trending: 0.15,
  quality: 0.1,
} as const;

// Applied additively to a movie's score in member A's deck when any OTHER
// member has liked that movie. Tuned so a cross-pollinated movie jumps
// meaningfully up the deck but doesn't automatically dominate.
export const CROSS_POLLINATION_BOOST = 0.35;

// similarityToLikes is noisy while a member has only swiped a handful.
// We ramp its weight linearly from startsAt → fullAt.
//   swipeCount <= startsAt → multiplier 0
//   swipeCount >= fullAt   → multiplier 1
export const SIMILARITY_RAMP = {
  startsAt: 0,
  fullAt: 5,
};

// Reserved for a future group-ranking signal; not referenced by Phase 4's
// individual deck ranking. Declared here so weights.ts stays the single
// place ranker constants live.
export const VARIANCE_PENALTY_WEIGHT = 0.15;

// Diversity pass window size. If DIVERSITY_WINDOW consecutive movies in
// the top-ranked list share the same dominant genre, demote one further
// down. Best-effort; a single left-to-right pass, not a strict guarantee.
export const DIVERSITY_WINDOW = 3;
