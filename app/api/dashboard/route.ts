import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_UPSTREAM =
  "http://127.0.0.1:8790/api/dashboard";

const NO_CACHE_HEADERS = {
  "Cache-Control":
    "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
};

export async function GET() {
  const token =
    process.env.ALPHA_DASHBOARD_TOKEN;

  const upstream =
    process.env.ALPHA_DASHBOARD_UPSTREAM
    ?? DEFAULT_UPSTREAM;

  if (!token) {
    return NextResponse.json(
      {
        error:
          "Dashboard server authentication is unavailable",
      },
      {
        status: 503,
        headers: NO_CACHE_HEADERS,
      },
    );
  }

  try {
    const response = await fetch(
      upstream,
      {
        method: "GET",
        headers: {
          Authorization:
            `Bearer ${token}`,
          Accept: "application/json",
        },
        cache: "no-store",
        signal:
          AbortSignal.timeout(20_000),
      },
    );

    const text = await response.text();

    let payload: unknown;

    try {
      payload = JSON.parse(text);
    } catch {
      return NextResponse.json(
        {
          error:
            "Local snapshot adapter returned invalid JSON",
          upstream_status:
            response.status,
        },
        {
          status: 502,
          headers: NO_CACHE_HEADERS,
        },
      );
    }

    return NextResponse.json(
      payload,
      {
        status: response.status,
        headers: {
          ...NO_CACHE_HEADERS,
          "X-Brom-Dashboard-Source":
            "LOCAL_SNAPSHOT_ADAPTER_V1",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          "Local snapshot adapter is unavailable",
        detail:
          error instanceof Error
            ? error.message
            : String(error),
      },
      {
        status: 502,
        headers: NO_CACHE_HEADERS,
      },
    );
  }
}
