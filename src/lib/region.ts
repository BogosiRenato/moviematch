// Region detection for room members. Called once per member on join; see
// rooms.ts for why we don't re-detect on touch/rejoin.
//
// Resolution order:
//   1. x-vercel-ip-country request header (production)
//   2. process.env.DEFAULT_REGION (dev / testing)
//   3. Hardcoded 'BW' (Botswana — our primary market)

const ALPHA2 = /^[A-Z]{2}$/;
const FALLBACK = "BW";

function isAlpha2(v: string | undefined | null): v is string {
  if (!v) return false;
  return ALPHA2.test(v.toUpperCase());
}

export function detectRegion(request: Request): string {
  const header = request.headers.get("x-vercel-ip-country");
  if (isAlpha2(header)) return header!.toUpperCase();

  const env = process.env.DEFAULT_REGION;
  if (isAlpha2(env)) return env!.toUpperCase();

  return FALLBACK;
}
