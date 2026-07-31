import { put } from "@vercel/blob";
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_BODY_BYTES = 2_000_000;

function secureEqual(expected: string, actual: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(actual);

  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const expectedSecret = process.env.ALPHA_INGEST_SECRET;
  const authorization = request.headers.get("authorization") ?? "";
  const providedSecret = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";

  if (
    !expectedSecret ||
    !providedSecret ||
    !secureEqual(expectedSecret, providedSecret)
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");

  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return NextResponse.json({ error: "JSON object required" }, { status: 400 });
  }

  const record = payload as Record<string, unknown>;

  if (record.mode !== "PAPER_ONLY") {
    return NextResponse.json(
      { error: "Only PAPER_ONLY snapshots are accepted" },
      { status: 422 },
    );
  }

  const ingestedAt = new Date().toISOString();
  const body = JSON.stringify({
    ...record,
    vercel_ingested_at: ingestedAt,
  });

  const blob = await put("alpha-dashboard/latest.json", body, {
    access: "public",
    allowOverwrite: true,
    cacheControlMaxAge: 60,
    contentType: "application/json",
  });

  return NextResponse.json(
    {
      ok: true,
      pathname: blob.pathname,
      url: blob.url,
      ingested_at: ingestedAt,
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
