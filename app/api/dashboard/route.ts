import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const url = process.env.ALPHA_API_URL;
  const token = process.env.ALPHA_API_TOKEN;

  if (!url || !token) {
    return NextResponse.json(
      { error: "ALPHA_API_URL or ALPHA_API_TOKEN is not configured" },
      { status: 500 },
    );
  }

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    const text = await response.text();

    if (!response.ok) {
      return NextResponse.json(
        { error: "Upstream Alpha API failed", status: response.status, detail: text.slice(0, 500) },
        { status: 502 },
      );
    }

    const data = JSON.parse(text);

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Alpha API is unavailable", detail: error instanceof Error ? error.message : String(error) },
      { status: 502 },
    );
  }
}
