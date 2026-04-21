import { NextResponse } from "next/server";
import { submitSelection } from "@/lib/rooms";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ code: string }> },
) {
  const { code } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    userId?: string;
    moods?: unknown;
    services?: unknown;
    servicesAny?: unknown;
    skip?: unknown;
  };

  if (!body.userId || typeof body.userId !== "string") {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const skip = body.skip === true;
  const moods = Array.isArray(body.moods) ? (body.moods as unknown[]) : [];
  const services = Array.isArray(body.services)
    ? (body.services as unknown[])
    : [];
  const servicesAny = body.servicesAny === true;

  if (!moods.every((m) => typeof m === "string")) {
    return NextResponse.json({ error: "moods must be strings" }, { status: 400 });
  }
  if (!services.every((s) => typeof s === "string")) {
    return NextResponse.json(
      { error: "services must be strings" },
      { status: 400 },
    );
  }

  const result = await submitSelection(code, body.userId, {
    moods: moods as string[],
    services: services as string[],
    servicesAny,
    skip,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ state: result.state });
}
