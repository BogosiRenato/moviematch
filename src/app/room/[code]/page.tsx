import { getMovies } from "@/lib/movies";
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
  const room = getRoom(code);
  if (!room) notFound();
  const movies = await getMovies();
  return <RoomClient code={room.code} initialName={name ?? ""} movies={movies} />;
}
