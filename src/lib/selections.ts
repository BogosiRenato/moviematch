export const MOODS = [
  { id: "fun", label: "Fun" },
  { id: "thoughtful", label: "Thoughtful" },
  { id: "spooky", label: "Spooky" },
  { id: "action", label: "Action-packed" },
  { id: "romantic", label: "Romantic" },
  { id: "feelgood", label: "Feel-good" },
  { id: "weird", label: "Weird" },
  { id: "mindbending", label: "Mind-bending" },
] as const;

export const STREAMING_SERVICES = [
  { id: "netflix", label: "Netflix" },
  { id: "prime", label: "Prime Video" },
  { id: "disneyplus", label: "Disney+" },
  { id: "appletv", label: "Apple TV+" },
  { id: "max", label: "Max" },
  { id: "hulu", label: "Hulu" },
] as const;

export type MoodId = (typeof MOODS)[number]["id"];
export type ServiceId = (typeof STREAMING_SERVICES)[number]["id"];

const MOOD_IDS = new Set<string>(MOODS.map((m) => m.id));
const SERVICE_IDS = new Set<string>(STREAMING_SERVICES.map((s) => s.id));

export function isMoodId(v: unknown): v is MoodId {
  return typeof v === "string" && MOOD_IDS.has(v);
}

export function isServiceId(v: unknown): v is ServiceId {
  return typeof v === "string" && SERVICE_IDS.has(v);
}

export function labelForMood(id: string): string | undefined {
  return MOODS.find((m) => m.id === id)?.label;
}
