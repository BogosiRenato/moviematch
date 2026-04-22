import { enrichMoviesWithAvailability, getMovies } from "@/lib/movies";
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
  // the next navigation/poll. That's fine for Phase 3 (data plumbing only).
  const regions = Array.from(
    new Set(Object.values(room.members).map((m) => m.region).filter(Boolean)),
  );
  const enriched = await enrichMoviesWithAvailability(movies, regions);
  return (
    <RoomClient code={room.code} initialName={name ?? ""} movies={enriched} />
  );
}
