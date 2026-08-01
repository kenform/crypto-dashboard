"use client";

import DashboardNav from "@/components/DashboardNav";
import IntradayModeNav from "@/components/IntradayModeNav";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  DashboardData,
  Trade,
} from "@/lib/types";

const REFRESH_MS = 15_000;
const START_BALANCE_USD = 10_000;
const RISK_USD = 25;
const RISK_PCT = 0.25;
const TARGET_RR = 3;

type AlphaTrade = Trade & {
  planned_rr?: number | null;
  current_price?: number | null;
  filled_at?: string | null;
  risk_usd?: number | null;
  pnl_usd?: number | null;
  realized_r?: number | null;
  unrealized_r?: number | null;
};

function numberValue(value: unknown): number | null {
  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return value;
  }

  if (
    typeof value === "string" &&
    value.trim() !== ""
  ) {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
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

function money(value: unknown): string {
  const parsed = numberValue(value);

  if (parsed === null) return "—";

  return `${parsed > 0 ? "+" : ""}${n(parsed, 2)} USD`;
}

function moneyPlain(value: unknown): string {
  const parsed = numberValue(value);

  if (parsed === null) return "—";

  return `${n(Math.abs(parsed), 2)} USD`;
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

function sideTickerClass(value: unknown): string {
  const side = String(value || "").toUpperCase();

  if (side === "LONG") return "ticker-long";
  if (side === "SHORT") return "ticker-short";

  return "";
}

function stateLabel(value: unknown): string {
  const state = String(value || "UNKNOWN").toUpperCase();

  const labels: Record<string, string> = {
    WAITING_ENTRY: "Ждёт входа",
    ACTIVE_FILLED: "Позиция открыта",
    OPEN: "Позиция открыта",
    FILLED: "Позиция открыта",
    TP: "Тейк-профит",
    SL: "Стоп-лосс",
    CLOSED: "Закрыта",
    EXPIRED_UNFILLED: "Вход не исполнен",
  };

  return labels[state] || state.replaceAll("_", " ");
}

function stateClass(value: unknown): string {
  const state = String(value || "").toUpperCase();

  if (
    state.includes("TP") ||
    state.includes("CLOSED")
  ) {
    return "good";
  }

  if (
    state.includes("WAITING") ||
    state.includes("ACTIVE") ||
    state.includes("OPEN") ||
    state.includes("FILLED")
  ) {
    return "warn";
  }

  if (
    state.includes("SL") ||
    state.includes("EXPIRED") ||
    state.includes("ERROR")
  ) {
    return "bad";
  }

  return "neutral";
}

function isWaiting(trade: AlphaTrade): boolean {
  return String(
    trade.state || "",
  ).toUpperCase() === "WAITING_ENTRY";
}

function isOpen(trade: AlphaTrade): boolean {
  return [
    "ACTIVE_FILLED",
    "OPEN",
    "FILLED",
    "ACTIVE",
  ].includes(
    String(trade.state || "").toUpperCase(),
  );
}

function isClosed(trade: AlphaTrade): boolean {
  const state = String(
    trade.state || "",
  ).toUpperCase();

  return (
    trade.realized_r !== null &&
    trade.realized_r !== undefined
  ) || [
    "TP",
    "SL",
    "CLOSED",
    "FINAL",
  ].some((value) => state.includes(value));
}

function tradeTime(trade: AlphaTrade): string {
  const raw =
    trade.closed_at ||
    trade.filled_at ||
    trade.created_at;

  if (!raw) return "—";

  const date = new Date(raw);

  if (!Number.isFinite(date.getTime())) return "—";

  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function plannedRr(trade: AlphaTrade): number | null {
  const direct = numberValue(trade.planned_rr);

  if (direct !== null) return direct;

  const entry = numberValue(trade.entry);
  const sl = numberValue(trade.sl);
  const tp = numberValue(trade.tp);
  const side = String(trade.side || "").toUpperCase();

  if (
    entry === null ||
    sl === null ||
    tp === null
  ) {
    return null;
  }

  const risk =
    side === "SHORT"
      ? sl - entry
      : entry - sl;

  const reward =
    side === "SHORT"
      ? entry - tp
      : tp - entry;

  return risk > 0 ? reward / risk : null;
}

function tradeResult(trade: AlphaTrade): {
  label: string;
  r: number | null;
  pnl: number | null;
} {
  if (isWaiting(trade)) {
    return {
      label: "Результата ещё нет",
      r: null,
      pnl: null,
    };
  }

  if (isClosed(trade)) {
    return {
      label: "Итоговый результат",
      r: numberValue(trade.realized_r),
      pnl: numberValue(trade.pnl_usd),
    };
  }

  if (isOpen(trade)) {
    return {
      label: "Плавающий результат",
      r: numberValue(trade.unrealized_r),
      pnl: numberValue(trade.pnl_usd),
    };
  }

  return {
    label: "Результат не рассчитан",
    r: null,
    pnl: null,
  };
}

function DealCard({
  trade,
}: {
  trade: AlphaTrade;
}) {
  const result = tradeResult(trade);
  const rr = plannedRr(trade);

  return (
    <details className="deal-card">
      <summary className="deal-summary">
        <div className="deal-main">
          <strong
            className={sideTickerClass(trade.side)}
          >
            {trade.symbol || "—"}
          </strong>
          <span>{trade.side || "—"}</span>
        </div>

        <span
          className={`pill ${stateClass(trade.state)}`}
        >
          {stateLabel(trade.state)}
        </span>

        <div className="deal-time">
          {tradeTime(trade)}
        </div>

        <div className="deal-result">
          <span>{result.label}</span>
          <strong className={valueClass(result.r)}>
            {rValue(result.r)}
          </strong>
        </div>
      </summary>

      <div className="deal-details">
        <div>
          <span>Entry</span>
          <strong>{n(trade.entry, 8)}</strong>
        </div>

        <div>
          <span>Stop Loss</span>
          <strong>{n(trade.sl, 8)}</strong>
        </div>

        <div>
          <span>Take Profit</span>
          <strong>{n(trade.tp, 8)}</strong>
        </div>

        <div>
          <span>Плановый RR</span>
          <strong>
            {rr === null ? "—" : `${n(rr, 2)}R`}
          </strong>
        </div>

        <div>
          <span>Score</span>
          <strong>{n(trade.score, 1)}</strong>
        </div>

        <div>
          <span>Риск</span>
          <strong>
            {moneyPlain(trade.risk_usd ?? RISK_USD)}
          </strong>
        </div>

        <div>
          <span>Текущая цена</span>
          <strong>
            {isWaiting(trade)
              ? "Вход ещё не исполнен"
              : n(trade.current_price, 8)}
          </strong>
        </div>

        <div>
          <span>Результат в USD</span>
          <strong className={valueClass(result.pnl)}>
            {money(result.pnl)}
          </strong>
        </div>
      </div>
    </details>
  );
}

export type IntradayView =
  | "short"
  | "long"
  | "combined";

type DashboardProps = {
  view?: IntradayView;
  title?: string;
  strategyLabel?: string;
  modelLabel?: string;
};

function selectIntradayView(
  body: DashboardData,
  view: IntradayView,
): DashboardData {
  if (view === "short") {
    return {
      ...body,
      selected_intraday_mode: "SHORT",
    };
  }

  const intraday = body.intraday as
    | Record<string, DashboardData>
    | undefined;

  const branch = intraday?.[view];

  if (!branch) {
    return {
      ...body,
      mode:
        view === "long"
          ? "ALPHA_NATIVE_LONG_3R_PAPER_TRACKER"
          : "ALPHA_INTRADAY_COMBINED_RESEARCH",
      summary: {},
      trades: [],
      bridge: {},
      selected_intraday_mode:
        view.toUpperCase(),
    };
  }

  return {
    ...body,
    mode: branch.mode || body.mode,
    summary: branch.summary || {},
    trades: branch.trades || [],
    bridge: branch.bridge || {},
    safety: branch.safety || body.safety,
    selected_intraday_mode:
      view.toUpperCase(),
  };
}

export default function Dashboard({
  view = "short",
  title = "Intraday SHORT Dashboard",
  strategyLabel = "Paper SHORT strategy",
  modelLabel = "SHORT model",
}: DashboardProps) {
  const [data, setData] =
    useState<DashboardData | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  const [refreshing, setRefreshing] =
    useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);

    try {
      const response = await fetch(
        `/api/dashboard?alpha=${Date.now()}`,
        { cache: "no-store" },
      );

      const body =
        (await response.json()) as DashboardData & {
          error?: string;
          detail?: string;
        };

      if (!response.ok) {
        throw new Error(
          body?.detail ||
          body?.error ||
          "Ошибка dashboard API",
        );
      }

      setData(selectIntradayView(body, view));
      setError(null);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : String(caught),
      );
    } finally {
      setRefreshing(false);
    }
  }, [view]);

  useEffect(() => {
    load();

    const timer = window.setInterval(
      load,
      REFRESH_MS,
    );

    return () => window.clearInterval(timer);
  }, [load]);

  const summary = (
    data?.summary || {}
  ) as Record<string, unknown>;

  const trades = useMemo(
    () =>
      [
        ...((data?.trades || []) as AlphaTrade[]),
      ].sort((a, b) => {
        const aTime = new Date(
          a.created_at || 0,
        ).getTime();

        const bTime = new Date(
          b.created_at || 0,
        ).getTime();

        return bTime - aTime;
      }),
    [data],
  );

  const waiting = trades.filter(isWaiting);
  const open = trades.filter(isOpen);
  const closed = trades.filter(isClosed);

  const closedPnl =
    numberValue(
      summary.hypothetical_net_pnl_usd,
    ) ?? 0;

  const virtualBalance =
    START_BALANCE_USD + closedPnl;

  const generatedRaw =
    data?.vps_published_at ||
    data?.generated_at ||
    data?.vercel_ingested_at;

  const generated = generatedRaw
    ? new Date(generatedRaw).toLocaleString(
        "ru-RU",
      )
    : "—";

  return (
    <main className="shell">
      <header className="topbar">
        <div className="topbar-copy">
          <div className="eyebrow">
            BROM / ALPHA
          </div>

          <h1>{title}</h1>

          <p>
            {strategyLabel} · депозит
            $10 000 · риск 0,25% · цель 3R.
          </p>
        </div>

        <div className="topbar-right">
          <span
            className={`pill ${error ? "bad" : "good"}`}
          >
            {error
              ? "Нет обновления"
              : "Система работает"}
          </span>

          <button
            onClick={load}
            disabled={refreshing}
          >
            {refreshing
              ? "Обновление…"
              : "Обновить"}
          </button>

          <div className="updated">
            Обновлено: {generated}
          </div>
        </div>
      </header>

      <DashboardNav active="intraday" />
      <IntradayModeNav active={view} />

      <section className="metrics-grid">
        <div className="card metric-card">
          <div className="metric-label">
            Виртуальный баланс
          </div>
          <div className="metric-value">
            {n(virtualBalance, 2)} USD
          </div>
          <div className="metric-hint">
            Старт: 10 000 USD
          </div>
        </div>

        <div className="card metric-card">
          <div className="metric-label">
            Риск на сделку
          </div>
          <div className="metric-value">
            25 USD
          </div>
          <div className="metric-hint">
            {RISK_PCT}% от депозита
          </div>
        </div>

        <div className="card metric-card">
          <div className="metric-label">
            Целевой RR
          </div>
          <div className="metric-value">
            {TARGET_RR}R
          </div>
          <div className="metric-hint">
            {modelLabel}
          </div>
        </div>

        <div className="card metric-card">
          <div className="metric-label">
            Ждут входа
          </div>
          <div className="metric-value">
            {waiting.length}
          </div>
          <div className="metric-hint">
            Результата ещё нет
          </div>
        </div>

        <div className="card metric-card">
          <div className="metric-label">
            Открытые
          </div>
          <div className="metric-value">
            {open.length}
          </div>
          <div className="metric-hint">
            Плавающий PnL
          </div>
        </div>

        <div className="card metric-card">
          <div className="metric-label">
            Закрытые
          </div>
          <div className="metric-value">
            {closed.length}
          </div>
          <div className="metric-hint">
            Итоговые результаты
          </div>
        </div>
      </section>

      <section className="compact-results">
        <div>
          <span>Net PnL</span>
          <strong className={valueClass(closedPnl)}>
            {money(closedPnl)}
          </strong>
        </div>

        <div>
          <span>Net R</span>
          <strong
            className={valueClass(summary.net_r)}
          >
            {rValue(summary.net_r)}
          </strong>
        </div>

        <div>
          <span>Win rate</span>
          <strong>
            {numberValue(summary.win_rate_pct) === null
              ? "—"
              : `${n(summary.win_rate_pct, 2)}%`}
          </strong>
        </div>

        <div>
          <span>Profit factor</span>
          <strong>
            {n(summary.profit_factor, 2)}
          </strong>
        </div>
      </section>

      <section className="card section-card">
        <div className="section-head">
          <div>
            <div className="eyebrow">
              СДЕЛКИ ALPHA
            </div>
            <h2>История и текущие заявки</h2>
            <p className="section-description">
              Нажмите на монету, чтобы увидеть
              Entry, SL, TP, RR, Score и риск.
            </p>
          </div>

          <span className="subtle">
            Всего: {trades.length}
          </span>
        </div>

        {trades.length ? (
          <div className="deal-list">
            {trades.map((trade, index) => (
              <DealCard
                key={
                  String(trade.id || "") ||
                  `${trade.symbol}-${trade.created_at}-${index}`
                }
                trade={trade}
              />
            ))}
          </div>
        ) : (
          <div className="empty-inline">
            Сделок Alpha пока нет.
          </div>
        )}
      </section>

      <footer>
        Alpha · paper-only · старт 10 000 USD ·
        риск 25 USD
      </footer>
    </main>
  );
}
