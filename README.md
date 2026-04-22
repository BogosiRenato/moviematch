# MovieMatch

Swipe movies with a friend (or a whole group). When everyone likes the same one, it's a match.

Think of it as Tinder for "what should we watch tonight?"

## How it works

1. Someone **creates a room** and gets a 6-letter code.
2. Everyone else **joins with the code**.
3. You all swipe through the same deck of movies — like or pass.
4. When every member has liked the same movie, it shows up in the **matches** bar.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- **Upstash Redis** for the room store (JSON blob per room, 24h TTL)
- Client-side polling for room state (every 2s)
- Optional TMDB API for real movie data; hardcoded fallback otherwise

## Getting started

```bash
npm install
cp .env.local.example .env.local
# fill in UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN (required)
# optionally add TMDB_API_KEY for real movie data
npm run dev
```

Open http://localhost:3000.

### Required: Upstash Redis

Rooms are stored in Upstash Redis so they survive server restarts and scale across serverless instances.

1. Sign up at https://upstash.com/ (free tier is plenty for development).
2. Create a Redis database.
3. From the dashboard, copy the **REST URL** and **REST Token** into `.env.local`:
   ```
   UPSTASH_REDIS_REST_URL=https://...-....upstash.io
   UPSTASH_REDIS_REST_TOKEN=...
   ```

Without these, the server will crash on startup.

### Optional: use real movie data from TMDB

Add your TMDB v4 bearer token to `.env.local`:
```
TMDB_API_KEY=eyJ...
```

Grab a key at https://www.themoviedb.org/settings/api.

## Project layout

```
src/
  app/
    page.tsx                        landing (create/join)
    room/[code]/page.tsx            room (server)
    room/[code]/RoomClient.tsx      swipe deck + matches (client)
    room/[code]/SelectionScreen.tsx mood + streaming-service picker (client)
    api/rooms/[code]/join           POST — join or rejoin a room
    api/rooms/[code]/state          GET  — poll room state for this user
    api/rooms/[code]/swipe          POST — record a like / pass
    api/rooms/[code]/decide         POST/DELETE — lock in / undo "the pick"
    api/rooms/[code]/select         POST — submit (or skip) moods + services
    _components/                    shared UI
  lib/
    rooms.ts                        Redis-backed room store + match logic
    movies.ts                       TMDB fetcher + fallback list + availability enrichment
    selections.ts                   canonical mood + streaming-service lists
    region.ts                       per-member region detection (header → env → 'BW')
    providers.ts                    TMDB watch-providers lookup + in-memory availability cache
```

## Known design decisions / gotchas

- **Selections are one-shot per session.** After a user submits (or skips) moods
  and services, the `/select` endpoint returns `409 Conflict` on any further
  attempt. The client treats 409 as "already done" and transitions into the
  deck. Editing selections mid-session is a possible future feature; for now
  the state machine stays simpler and matches user expectations (you pick once,
  then swipe).
- **`moodsRevealed` is a one-way latch.** It flips `true` the moment every
  current member has submitted or skipped, and stays `true` for the life of
  the room. If someone joins after the latch has flipped, their moods become
  visible to the room *as soon as they submit* — we don't un-hide the group or
  re-hide anyone. This keeps late joiners from gating reveal for everyone else.
- **Region is set once per member, on first join.** We detect from
  `x-vercel-ip-country` → `DEFAULT_REGION` env → `'BW'`, store it on the
  Member record, and never update it on subsequent rejoins or polls.
  Regions are stable per-device; re-detecting every poll would waste header
  reads and flap between sources if headers are intermittent. A traveling
  user gets a fresh region by clearing localStorage (new userId → new join).
- **In-memory availability cache with split TTLs.** `src/lib/providers.ts`
  caches TMDB `/movie/{id}/watch/providers` responses by `(movieId, region)`.
  Successful lookups cache for 24h; failed lookups cache for 1h to prevent
  retry storms during TMDB outages without long-term poisoning. Availability
  is process-local — not in Redis — because provider data shifts gradually
  and per-process freshness is good enough.
- **TMDB "flatrate" only.** We read `results[region].flatrate` from TMDB's
  watch-providers response, which covers subscription streaming. We
  deliberately ignore `rent`, `buy`, `free`, and `ads` — the app's pitch is
  "what can we watch tonight on a service we already pay for."
- **Region is exposed only to its owner.** `RoomStateView.you.region` is
  populated for the calling member; other members never see each other's
  countries.

## Known limitations

- Read-modify-write on a single JSON blob per room is last-write-wins. Fine for small rooms at 2s polling; revisit if contention becomes measurable.
- Polling (2s) instead of websockets. Fine for small groups; swap to Pusher / Ably / SSE for bigger rooms.
- No auth — rooms are identified by code only. Anyone with the code can join.
- `touchMember` writes to Redis on every state poll. Active rooms can burn through Upstash's free-tier command budget quickly; paid tier or a conditional write would help.
