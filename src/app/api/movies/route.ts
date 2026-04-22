import { NextResponse } from "next/server";
import { enrichMoviesWithAvailability, getMovies } from "@/lib/movies";
import { detectRegion } from "@/lib/region";

export async function GET(req: Request) {
  // No room context here — enrich with just the caller's detected region.
  // Room-scoped enrichment (across all member regions) happens in the room
  // server component.
  const region = detectRegion(req);
  const movies = await getMovies();
  const enriched = await enrichMoviesWithAvailability(movies, [region]);
  return NextResponse.json({ movies: enriched });
}
