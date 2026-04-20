import { CreateRoomButton, JoinRoomForm } from "./_components/LandingForms";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-md space-y-10 text-center">
        <div className="space-y-3">
          <h1 className="text-5xl font-bold tracking-tight bg-gradient-to-br from-pink-400 via-rose-400 to-orange-300 bg-clip-text text-transparent">
            MovieMatch
          </h1>
          <p className="text-neutral-400 text-lg">
            Swipe movies with your people. When you all like the same one, it&rsquo;s a match.
          </p>
        </div>

        <div className="space-y-4">
          <CreateRoomButton />

          <div className="flex items-center gap-3 text-xs uppercase tracking-widest text-neutral-500">
            <span className="h-px flex-1 bg-neutral-800" />
            or join one
            <span className="h-px flex-1 bg-neutral-800" />
          </div>

          <JoinRoomForm />
        </div>

        <p className="text-xs text-neutral-600">
          No signup. Rooms live in memory and disappear when the server restarts.
        </p>
      </div>
    </main>
  );
}
