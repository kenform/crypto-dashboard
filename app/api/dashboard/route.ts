import { get } from "@vercel/blob";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const result = await get("alpha-dashboard/latest.json", {
      access: "public",
    });

    if (!result || result.statusCode !== 200 || !result.stream) {
      return NextResponse.json(
        {
          error: "Alpha snapshot has not been published yet",
          detail: "The VPS uploader has not sent the first snapshot.",
        },
        { status: 503 },
      );
    }

    const text = await new Response(result.stream).text();
    const data = JSON.parse(text);

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Alpha Blob snapshot is unavailable",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 502 },
    );
  }
}
