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
- In-memory room store (per-server process, resets on restart)
- Client-side polling for room state (every 2s)
- Optional TMDB API for real movie data; hardcoded fallback otherwise

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000.

### Optional: use real movie data from TMDB

```bash
cp .env.local.example .env.local
# edit .env.local and paste your TMDB v4 bearer token into TMDB_API_KEY
```

Grab a key at https://www.themoviedb.org/settings/api.

## Project layout

```
src/
  app/
    page.tsx                   landing (create/join)
    room/[code]/page.tsx       room (server)
    room/[code]/RoomClient.tsx swipe deck + matches (client)
    api/rooms/...              REST endpoints
    _components/               shared UI
  lib/
    rooms.ts                   in-memory room store + match logic
    movies.ts                  TMDB fetcher + fallback list
```

## Known limitations

- Room state is in-memory on the server process. A production deploy needs Redis/DB-backed storage.
- Polling (2s) instead of websockets. Fine for small groups; swap to Pusher / Ably / SSE for bigger rooms.
- No auth — rooms are identified by code only. Anyone with the code can join.
