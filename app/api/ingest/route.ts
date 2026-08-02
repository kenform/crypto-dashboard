import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const response = {
  error: "ingest_endpoint_retired",
  detail:
    "The dashboard is self-hosted and no longer uses Vercel Blob.",
  read_only: true,
};

export async function POST() {
  return NextResponse.json(
    response,
    {
      status: 410,
      headers: {
        "Cache-Control":
          "no-store, max-age=0",
      },
    },
  );
}

export async function GET() {
  return NextResponse.json(
    response,
    {
      status: 410,
      headers: {
        "Cache-Control":
          "no-store, max-age=0",
      },
    },
  );
}
