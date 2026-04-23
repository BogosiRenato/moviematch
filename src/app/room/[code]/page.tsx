import {
  enrichMoviesWithAvailability,
  enrichMoviesWithKeywords,
  getMovies,
} from "@/lib/movies";
import { getRoom } from "@/lib/rooms";
import { notFound } from "next/navigation";
import RoomClient from "./RoomClient";

export default async function RoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ name?: string }>;
}) {
  const { code } = await params;
  const { name } = await searchParams;
  const room = await getRoom(code);
  if (!room) notFound();
  const movies = await getMovies();
  // Union of every current member's region. The joining member isn't in the
  // room yet on this SSR pass — they'll see enrichment for their region on
  // the next navigation/poll.
  const regions = Array.from(
    new Set(Object.values(room.members).map((m) => m.region).filter(Boolean)),
  );
  const withAvail = await enrichMoviesWithAvailability(movies, regions);
  // Keyword enrichment feeds the ranker's moodMatch signal; cached 24h
  // per-movie, so subsequent loads are free.
  const enriched = (await enrichMoviesWithKeywords(withAvail)) as typeof withAvail;
  return (
    <RoomClient code={room.code} initialName={name ?? ""} movies={enriched} />
  );
}
