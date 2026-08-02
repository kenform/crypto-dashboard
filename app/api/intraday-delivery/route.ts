import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";

export const dynamic = "force-dynamic";

const STATE_PATH =
  "/home/openclawuser/brom_signal_intel/intel/" +
  "brom_alpha_v3/runtime/intraday_telegram_forward_v1/state.json";

const LATEST_PATH =
  "/home/openclawuser/brom_signal_intel/intel/" +
  "brom_alpha_v3/runtime/intraday_telegram_forward_v1/latest.json";

const TOPIC_ENV_PATH =
  "/home/openclawuser/.config/brom-intraday-telegram.env";

type JsonMap = Record<string, unknown>;

function asMap(value: unknown): JsonMap {
  return (
    value !== null
    && typeof value === "object"
    && !Array.isArray(value)
  )
    ? value as JsonMap
    : {};
}

function parseEnv(text: string): Record<string, string> {
  const result: Record<string, string> = {};

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (
      !line
      || line.startsWith("#")
      || !line.includes("=")
    ) {
      continue;
    }

    const index = line.indexOf("=");
    const key = line.slice(0, index).trim();

    let value = line.slice(index + 1).trim();

    if (
      value.length >= 2
      && value[0] === value[value.length - 1]
      && (value[0] === '"' || value[0] === "'")
    ) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}

function objectCount(value: unknown): number {
  return (
    value !== null
    && typeof value === "object"
    && !Array.isArray(value)
  )
    ? Object.keys(value as JsonMap).length
    : 0;
}

function arrayCount(value: unknown): number {
  return Array.isArray(value)
    ? value.length
    : 0;
}

export async function GET() {
  try {
    const [
      stateText,
      latestText,
      topicText,
    ] = await Promise.all([
      readFile(STATE_PATH, "utf8"),
      readFile(LATEST_PATH, "utf8"),
      readFile(TOPIC_ENV_PATH, "utf8"),
    ]);

    const state = asMap(JSON.parse(stateText));
    const latest = asMap(JSON.parse(latestText));
    const topic = parseEnv(topicText);

    return NextResponse.json(
      {
        schema:
          "BROM_INTRADAY_TELEGRAM_DELIVERY_API_V1",

        status:
          latest.status ?? "UNKNOWN",

        mode:
          latest.mode ?? state.mode ?? "UNKNOWN",

        historical_replay:
          latest.historical_replay
          ?? state.historical_replay
          ?? null,

        topic_name:
          topic.BROM_INTRADAY_TG_TOPIC_NAME
          ?? "Intraday",

        thread_id:
          topic.BROM_INTRADAY_TG_THREAD_ID
          ?? null,

        activation_epoch:
          state.activation_epoch ?? null,

        generated_at:
          latest.generated_at ?? null,

        current_trade_count:
          latest.current_trade_count ?? null,

        watermark_count:
          latest.watermark_count
          ?? arrayCount(state.processed_ids),

        processed_count:
          arrayCount(state.processed_ids),

        delivered_trade_count:
          objectCount(state.message_ids),

        sent_new_last_run:
          latest.sent_new ?? 0,

        sent_updates_last_run:
          latest.sent_updates ?? 0,

        error_count:
          latest.error_count ?? 0,

        safety: {
          paper_only: true,
          telegram_send_from_ui: false,
          token_exposed: false,
          chat_id_exposed: false,
        },
      },
      {
        headers: {
          "Cache-Control":
            "no-store, max-age=0",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        schema:
          "BROM_INTRADAY_TELEGRAM_DELIVERY_API_V1",

        status: "ERROR",

        error:
          error instanceof Error
            ? error.message
            : "UNKNOWN_ERROR",

        safety: {
          paper_only: true,
          telegram_send_from_ui: false,
          token_exposed: false,
          chat_id_exposed: false,
        },
      },
      {
        status: 503,

        headers: {
          "Cache-Control":
            "no-store, max-age=0",
        },
      },
    );
  }
}
