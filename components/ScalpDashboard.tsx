"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import DashboardNav from "@/components/DashboardNav";

const REFRESH_MS = 15_000;

type ValueMap = Record<string, unknown>;

type ScalpTrade = {
  id?: string;
  symbol?: string;
  side?: string;
  tier?: string | null;
  state?: string;
  outcome?: string | null;
  score?: number | null;
  entry?: number | null;
  sl?: number | null;
  tp2?: number | null;
  tp3?: number | null;
  source_rr?: number | null;
  result_r_2r?: number | null;
  result_r_3r?: number | null;
  mfe_r?: number | null;
  mae_r?: number | null;
  created_at?: string | null;
  opened_at?: string | null;
  closed_at?: string | null;
  reason?: string | null;
};

type ScalpPayload = {
  status?: string;
  mode?: string;
  strategy?: string;
  sample_label?: string;
  generated_at?: string | null;
  health?: ValueMap;
  policy?: ValueMap;
  summary?: ValueMap;
  diagnosis?: ValueMap;
  trades?: ScalpTrade[];
};

function numberValue(
  value: unknown,
): number | null {
  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return value;
  }

  if (
    typeof value === "string" &&
    value.trim()
  ) {
    const parsed = Number(value);

    return Number.isFinite(parsed)
      ? parsed
      : null;
  }

  return null;
}

function n(
  value: unknown,
  digits = 2,
): string {
  const parsed = numberValue(value);

  if (parsed === null) return "—";

  return parsed.toLocaleString("ru-RU", {
    maximumFractionDigits: digits,
  });
}

function pct(value: unknown): string {
  const parsed = numberValue(value);

  return parsed === null
    ? "—"
    : `${n(parsed, 2)}%`;
}

function rValue(value: unknown): string {
  const parsed = numberValue(value);

  if (parsed === null) return "—";

  return `${parsed > 0 ? "+" : ""}${n(parsed, 3)}R`;
}

function valueClass(value: unknown): string {
  const parsed = numberValue(value);

  if (parsed === null || parsed === 0) return "";
  return parsed > 0 ? "positive" : "negative";
}

function sideClass(value: unknown): string {
  const side = String(value || "").toUpperCase();

  if (side === "LONG") return "ticker-long";
  if (side === "SHORT") return "ticker-short";

  return "";
}

function formatTime(value: unknown): string {
  if (!value) return "—";

  const date = new Date(String(value));

  if (!Number.isFinite(date.getTime())) return "—";

  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(value: unknown): string {
  const state = String(value || "UNKNOWN").toUpperCase();

  const labels: Record<string, string> = {
    WAITING_ENTRY: "Ждёт входа",
    OPEN: "Открыта",
    STOP_LOSS: "Стоп-лосс",
    TP3_HIT: "Цель 3R",
    EXPIRED_NO_ENTRY: "Вход не исполнен",
    EXPIRED_AFTER_ENTRY: "Истекла после входа",
    INVALID_CANDIDATE: "Некорректная геометрия",
  };

  return labels[state] || state.replaceAll("_", " ");
}

export default function ScalpDashboard() {
  const [data, setData] =
    useState<ScalpPayload | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/dashboard?scalp_truth=${Date.now()}`,
        { cache: "no-store" },
      );

      const body = await response.json();

      if (!response.ok) {
        throw new Error(
          body?.detail ||
          body?.error ||
          "Ошибка dashboard API",
        );
      }

      setData(body?.scalp || null);
      setError(null);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : String(caught),
      );
    }
  }, []);

  useEffect(() => {
    load();

    const timer = window.setInterval(
      load,
      REFRESH_MS,
    );

    return () => window.clearInterval(timer);
  }, [load]);

  const summary = data?.summary || {};
  const policy = data?.policy || {};
  const health = data?.health || {};

  const trades = useMemo(
    () => data?.trades || [],
    [data],
  );

  return (
    <main className="shell">
      <header className="topbar">
        <div className="topbar-copy">
          <div className="eyebrow">
            BROM / ALPHA / SCALP
          </div>

          <h1>Scalp Dashboard</h1>

          <p>
            Каноническая shadow-only статистика
            Alpha Scalp 141.
          </p>
        </div>

        <div className="topbar-right">
          <span
            className={`pill ${
              data?.status === "AVAILABLE"
                ? "good"
                : data?.status === "DELAYED"
                ? "warn"
                : "neutral"
            }`}
          >
            {data?.status === "AVAILABLE"
              ? "Tracker работает"
              : data?.status === "DELAYED"
              ? "Источник задерживается"
              : "Ожидаем tracker"}
          </span>

          <div className="updated">
            {String(
              data?.sample_label ||
              "V1 shadow sample",
            )}
          </div>
        </div>
      </header>

      <DashboardNav active="scalp" />

      {error ? (
        <div className="error-banner">
          {error}
        </div>
      ) : null}

      <section className="metrics-grid">
        <div className="card metric-card">
          <div className="metric-label">
            Кандидаты
          </div>
          <div className="metric-value">
            {n(summary.registered, 0)}
          </div>
          <div className="metric-hint">
            Всего зарегистрировано
          </div>
        </div>

        <div className="card metric-card">
          <div className="metric-label">
            Вход исполнен
          </div>
          <div className="metric-value">
            {n(summary.filled, 0)}
          </div>
          <div className="metric-hint">
            Fill rate: {pct(
              summary.fill_rate_pct,
            )}
          </div>
        </div>

        <div className="card metric-card">
          <div className="metric-label">
            Win rate 2R
          </div>
          <div className="metric-value">
            {pct(summary.win_rate_2r_pct)}
          </div>
          <div className="metric-hint">
            Break-even: 33,33%
          </div>
        </div>

        <div className="card metric-card">
          <div className="metric-label">
            Win rate 3R
          </div>
          <div className="metric-value">
            {pct(summary.win_rate_3r_pct)}
          </div>
          <div className="metric-hint">
            Break-even: 25%
          </div>
        </div>

        <div className="card metric-card">
          <div className="metric-label">
            Expectancy 2R
          </div>
          <div
            className={`metric-value ${valueClass(
              summary.expectancy_2r,
            )}`}
          >
            {rValue(summary.expectancy_2r)}
          </div>
          <div className="metric-hint">
            До комиссий
          </div>
        </div>

        <div className="card metric-card">
          <div className="metric-label">
            Expectancy 3R
          </div>
          <div
            className={`metric-value ${valueClass(
              summary.expectancy_3r,
            )}`}
          >
            {rValue(summary.expectancy_3r)}
          </div>
          <div className="metric-hint">
            До комиссий
          </div>
        </div>
      </section>

      <section className="compact-results">
        <div>
          <span>TP2 / TP3</span>
          <strong>
            {n(summary.tp2_wins, 0)}
            {" / "}
            {n(summary.tp3_wins, 0)}
          </strong>
        </div>

        <div>
          <span>Стоп-лоссы</span>
          <strong>
            {n(summary.stop_losses, 0)}
          </strong>
        </div>

        <div>
          <span>Истекли без входа</span>
          <strong>
            {n(summary.expired_no_entry, 0)}
          </strong>
        </div>

        <div>
          <span>Открытые / ожидают</span>
          <strong>
            {n(summary.active, 0)}
            {" / "}
            {n(summary.waiting, 0)}
          </strong>
        </div>

        <div>
          <span>Stop rate от входов</span>
          <strong>
            {pct(
              summary.stop_rate_filled_pct,
            )}
          </strong>
        </div>

      </section>

      <section className="card section-card">
        <div className="section-head">
          <div>
            <div className="eyebrow">
              ALPHA SCALP 141 V1
            </div>

            <h2>Последние сделки и кандидаты</h2>

            <p className="section-description">
              V1 оставлен без изменений.
              Следующая версия будет тестироваться
              отдельным research-контуром.
            </p>
          </div>

          <a
            className="section-link"
            href="/journal?source=ALPHA_SCALP"
          >
            Открыть дневник →
          </a>
        </div>

        {trades.length ? (
          <div className="deal-list">
            {trades.slice(0, 100).map(
              (trade, index) => (
                <details
                  key={trade.id || index}
                  className="deal-card"
                >
                  <summary className="deal-summary">
                    <div className="deal-main">
                      <strong
                        className={sideClass(
                          trade.side,
                        )}
                      >
                        {trade.symbol || "—"}
                      </strong>

                      <span>
                        {trade.side || "—"}
                        {trade.tier
                          ? ` · ${trade.tier}`
                          : ""}
                      </span>
                    </div>

                    <span className="pill neutral">
                      {statusLabel(trade.state)}
                    </span>

                    <div className="deal-time">
                      {formatTime(
                        trade.closed_at ||
                        trade.opened_at ||
                        trade.created_at,
                      )}
                    </div>

                    <div className="deal-result">
                      <span>Результат 3R</span>
                      <strong
                        className={valueClass(
                          trade.result_r_3r,
                        )}
                      >
                        {rValue(
                          trade.result_r_3r,
                        )}
                      </strong>
                    </div>
                  </summary>

                  <div className="deal-details">
                    <div>
                      <span>Entry</span>
                      <strong>
                        {n(trade.entry, 8)}
                      </strong>
                    </div>

                    <div>
                      <span>Stop Loss</span>
                      <strong>
                        {n(trade.sl, 8)}
                      </strong>
                    </div>

                    <div>
                      <span>Target 2R</span>
                      <strong>
                        {n(trade.tp2, 8)}
                      </strong>
                    </div>

                    <div>
                      <span>Target 3R</span>
                      <strong>
                        {n(trade.tp3, 8)}
                      </strong>
                    </div>

                    <div>
                      <span>Результат 2R</span>
                      <strong
                        className={valueClass(
                          trade.result_r_2r,
                        )}
                      >
                        {rValue(
                          trade.result_r_2r,
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>MFE / MAE</span>
                      <strong>
                        {rValue(trade.mfe_r)}
                        {" / "}
                        {rValue(trade.mae_r)}
                      </strong>
                    </div>

                    <div>
                      <span>Source RR</span>
                      <strong>
                        {n(trade.source_rr, 2)}
                      </strong>
                    </div>

                    <div>
                      <span>Причина / статус</span>
                      <strong>
                        {trade.reason || "—"}
                      </strong>
                    </div>
                  </div>
                </details>
              ),
            )}
          </div>
        ) : (
          <div className="empty-inline">
            Канонический tracker пока не отдал
            кандидатов.
          </div>
        )}
      </section>

      <footer>
        Alpha Scalp 141 V1 · shadow-only ·
        no real/demo submit
      </footer>
    </main>
  );
}
