export type Movie = {
  id: string;
  title: string;
  year: number;
  overview: string;
  posterUrl: string;
  rating: number;
};

function placeholder(title: string, year: number): string {
  const text = encodeURIComponent(`${title}\n${year}`);
  return `https://placehold.co/500x750/1a1a2e/fda4af?text=${text}`;
}

const FALLBACK: Movie[] = [
  ["The Shawshank Redemption", 1994, "Two imprisoned men bond over a number of years, finding solace and eventual redemption through acts of common decency.", 9.3],
  ["The Godfather", 1972, "The aging patriarch of an organized crime dynasty transfers control of his clandestine empire to his reluctant son.", 9.2],
  ["The Dark Knight", 2008, "When the menace known as the Joker wreaks havoc and chaos on the people of Gotham, Batman must accept one of the greatest psychological and physical tests of his ability to fight injustice.", 9.0],
  ["Pulp Fiction", 1994, "The lives of two mob hitmen, a boxer, a gangster and his wife, and a pair of diner bandits intertwine in four tales of violence and redemption.", 8.9],
  ["Forrest Gump", 1994, "The presidencies of Kennedy and Johnson, the Vietnam War, the Watergate scandal and other historical events unfold from the perspective of an Alabama man with an IQ of 75.", 8.8],
  ["Inception", 2010, "A thief who steals corporate secrets through the use of dream-sharing technology is given the inverse task of planting an idea into the mind of a C.E.O.", 8.8],
  ["The Matrix", 1999, "When a beautiful stranger leads computer hacker Neo to a forbidding underworld, he discovers the shocking truth.", 8.7],
  ["Goodfellas", 1990, "The story of Henry Hill and his life in the mob, covering his relationship with his wife Karen and his mob partners.", 8.7],
  ["Parasite", 2019, "Greed and class discrimination threaten the newly formed symbiotic relationship between the wealthy Park family and the destitute Kim clan.", 8.5],
  ["Everything Everywhere All at Once", 2022, "A middle-aged Chinese immigrant is swept up into an insane adventure in which she alone can save existence by exploring other universes.", 7.8],
  ["Spirited Away", 2001, "During her family's move to the suburbs, a sullen 10-year-old girl wanders into a world ruled by gods, witches, and spirits.", 8.6],
  ["Interstellar", 2014, "A team of explorers travel through a wormhole in space in an attempt to ensure humanity's survival.", 8.7],
  ["Whiplash", 2014, "A promising young drummer enrolls at a cut-throat music conservatory where his dreams of greatness are mentored by an instructor who will stop at nothing to realize a student's potential.", 8.5],
  ["La La Land", 2016, "While navigating their careers in Los Angeles, a pianist and an actress fall in love while attempting to reconcile their aspirations for the future.", 8.0],
  ["Mad Max: Fury Road", 2015, "In a post-apocalyptic wasteland, a woman rebels against a tyrannical ruler in search for her homeland.", 8.1],
  ["Knives Out", 2019, "A detective investigates the death of a patriarch of an eccentric, combative family.", 7.9],
  ["The Grand Budapest Hotel", 2014, "A writer encounters the owner of an aging high-class hotel, who tells him of his early years serving as a lobby boy.", 8.1],
  ["Arrival", 2016, "A linguist works with the military to communicate with alien lifeforms after twelve mysterious spacecraft appear around the world.", 7.9],
  ["Get Out", 2017, "A young African-American visits his white girlfriend's parents for the weekend, where his simmering uneasiness about their reception eventually reaches a boiling point.", 7.7],
  ["Spider-Man: Into the Spider-Verse", 2018, "Teen Miles Morales becomes the Spider-Man of his universe and must join with five spider-powered individuals from other dimensions.", 8.4],
].map(([title, year, overview, rating], i) => ({
  id: `fb-${i + 1}`,
  title: title as string,
  year: year as number,
  overview: overview as string,
  rating: rating as number,
  posterUrl: placeholder(title as string, year as number),
}));

type TmdbMovie = {
  id: number;
  title: string;
  release_date: string;
  overview: string;
  poster_path: string | null;
  vote_average: number;
};

let cache: { movies: Movie[]; fetchedAt: number } | null = null;
const TTL_MS = 60 * 60 * 1000;

export async function getMovies(): Promise<Movie[]> {
  const key = process.env.TMDB_API_KEY;
  if (!key) return FALLBACK;

  if (cache && Date.now() - cache.fetchedAt < TTL_MS) return cache.movies;

  try {
    const movies: Movie[] = [];
    for (let page = 1; page <= 2; page++) {
      const url = `https://api.themoviedb.org/3/movie/popular?language=en-US&page=${page}`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${key}`,
          Accept: "application/json",
        },
        next: { revalidate: 3600 },
      });
      if (!res.ok) throw new Error(`TMDB ${res.status}`);
      const data = (await res.json()) as { results: TmdbMovie[] };
      for (const m of data.results) {
        if (!m.poster_path) continue;
        movies.push({
          id: `tmdb-${m.id}`,
          title: m.title,
          year: m.release_date ? parseInt(m.release_date.slice(0, 4)) : 0,
          overview: m.overview,
          rating: Math.round(m.vote_average * 10) / 10,
          posterUrl: `https://image.tmdb.org/t/p/w500${m.poster_path}`,
        });
      }
    }
    cache = { movies, fetchedAt: Date.now() };
    return movies;
  } catch {
    return FALLBACK;
  }
}
