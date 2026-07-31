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
  state?: string;
  outcome?: string | null;
  score?: number | null;
  entry?: number | null;
  sl?: number | null;
  tp?: number | null;
  rr?: number | null;
  pnl_usd?: number | null;
  created_at?: string | null;
};

type ScalpPayload = {
  status?: string;
  mode?: string;
  generated_at?: string | null;
  health?: ValueMap;
  policy?: ValueMap;
  summary?: ValueMap;
  trades?: ScalpTrade[];
};

function numberValue(value: unknown): number | null {
  return typeof value === "number" &&
    Number.isFinite(value)
    ? value
    : null;
}

function n(value: unknown, digits = 2): string {
  const parsed = numberValue(value);

  if (parsed === null) return "—";

  return parsed.toLocaleString("ru-RU", {
    maximumFractionDigits: digits,
  });
}

function sideClass(value: unknown): string {
  const side = String(value || "").toUpperCase();

  if (side === "LONG") return "ticker-long";
  if (side === "SHORT") return "ticker-short";

  return "";
}

function valueClass(value: unknown): string {
  const parsed = numberValue(value);

  if (parsed === null || parsed === 0) return "";
  return parsed > 0 ? "positive" : "negative";
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

export default function ScalpDashboard() {
  const [data, setData] =
    useState<ScalpPayload | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/dashboard?scalp=${Date.now()}`,
        { cache: "no-store" },
      );

      const body = await response.json();

      if (!response.ok) {
        throw new Error("Ошибка dashboard API");
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
            Отдельная shadow-only статистика
            скальп-сделок Alpha.
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
              ? "Scalp работает"
              : data?.status === "DELAYED"
              ? "Источник задерживается"
              : "Собираем статистику"}
          </span>
        </div>
      </header>

      <DashboardNav active="scalp" />

      {error ? (
        <div className="error-banner">{error}</div>
      ) : null}

      <section className="metrics-grid">
        <div className="card metric-card">
          <div className="metric-label">
            Идеи
          </div>
          <div className="metric-value">
            {n(summary.candidates, 0)}
          </div>
          <div className="metric-hint">
            Scalp shadow records
          </div>
        </div>

        <div className="card metric-card">
          <div className="metric-label">
            Ждут входа
          </div>
          <div className="metric-value">
            {n(summary.waiting, 0)}
          </div>
          <div className="metric-hint">
            Пока без результата
          </div>
        </div>

        <div className="card metric-card">
          <div className="metric-label">
            Открытые
          </div>
          <div className="metric-value">
            {n(summary.active, 0)}
          </div>
          <div className="metric-hint">
            Shadow positions
          </div>
        </div>

        <div className="card metric-card">
          <div className="metric-label">
            Закрытые
          </div>
          <div className="metric-value">
            {n(summary.closed, 0)}
          </div>
          <div className="metric-hint">
            Известные результаты
          </div>
        </div>

        <div className="card metric-card">
          <div className="metric-label">
            Win rate
          </div>
          <div className="metric-value">
            {numberValue(summary.win_rate_pct) === null
              ? "—"
              : `${n(summary.win_rate_pct, 2)}%`}
          </div>
          <div className="metric-hint">
            {n(summary.wins, 0)}W /
            {" "}
            {n(summary.losses, 0)}L
          </div>
        </div>

        <div className="card metric-card">
          <div className="metric-label">
            Net PnL
          </div>
          <div
            className={`metric-value ${valueClass(
              summary.net_pnl_usd,
            )}`}
          >
            {numberValue(summary.net_pnl_usd) === null
              ? "—"
              : `${n(summary.net_pnl_usd, 2)} USD`}
          </div>
          <div className="metric-hint">
            Shadow result
          </div>
        </div>
      </section>

      <section className="compact-results">
        <div>
          <span>Режим</span>
          <strong>{data?.mode || "SHADOW_ONLY"}</strong>
        </div>

        <div>
          <span>Минимальный Score</span>
          <strong>{n(policy.minimum_score, 0)}</strong>
        </div>

        <div>
          <span>Основная цель</span>
          <strong>
            {n(policy.primary_target_r, 2)}R
          </strong>
        </div>

        <div>
          <span>Вторая цель</span>
          <strong>
            {n(policy.secondary_target_r, 2)}R
          </strong>
        </div>
      </section>

      <section className="card section-card">
        <div className="section-head">
          <div>
            <div className="eyebrow">
              ALPHA SCALP
            </div>

            <h2>Скальп-сделки</h2>

            <p className="section-description">
              Статистика не смешивается
              с Alpha Intraday.
            </p>
          </div>

          <a
            className="section-link"
            href="/journal?source=ALPHA_SCALP"
          >
            Дневник Scalp →
          </a>
        </div>

        {trades.length ? (
          <div className="deal-list">
            {trades.map((trade, index) => (
              <details
                key={trade.id || index}
                className="deal-card"
              >
                <summary className="deal-summary">
                  <div className="deal-main">
                    <strong
                      className={sideClass(trade.side)}
                    >
                      {trade.symbol || "—"}
                    </strong>
                    <span>{trade.side || "—"}</span>
                  </div>

                  <span className="pill neutral">
                    {trade.outcome ||
                      trade.state ||
                      "UNKNOWN"}
                  </span>

                  <div className="deal-time">
                    {formatTime(trade.created_at)}
                  </div>

                  <div className="deal-result">
                    <span>Score</span>
                    <strong>{n(trade.score, 1)}</strong>
                  </div>
                </summary>

                <div className="deal-details">
                  <div>
                    <span>Entry</span>
                    <strong>{n(trade.entry, 8)}</strong>
                  </div>

                  <div>
                    <span>SL</span>
                    <strong>{n(trade.sl, 8)}</strong>
                  </div>

                  <div>
                    <span>TP</span>
                    <strong>{n(trade.tp, 8)}</strong>
                  </div>

                  <div>
                    <span>RR</span>
                    <strong>{n(trade.rr, 2)}R</strong>
                  </div>
                </div>
              </details>
            ))}
          </div>
        ) : (
          <div className="empty-inline">
            Канонический Scalp outcome source
            пока не отдал сделки. Страница уже
            готова и заполнится автоматически.
          </div>
        )}
      </section>
    </main>
  );
}
