"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import DashboardNav from "@/components/DashboardNav";
import IntradayDeliveryCard from "@/components/IntradayDeliveryCard";

const REFRESH_MS = 15_000;

export type IntradayView =
  | "short"
  | "long"
  | "combined";

type ValueMap = Record<string, unknown>;

type AlphaTrade = {
  id?: string;
  symbol?: string;
  side?: string;
  state?: string;
  score?: number | null;
  entry?: number | null;
  sl?: number | null;
  tp?: number | null;
  planned_rr?: number | null;
  risk_usd?: number | null;
  current_price?: number | null;
  pnl_usd?: number | null;
  realized_r?: number | null;
  unrealized_r?: number | null;
  created_at?: string | null;
  filled_at?: string | null;
  closed_at?: string | null;
};

type IntradayBranch = {
  generated_at?: string | null;
  mode?: string;
  summary?: ValueMap;
  trades?: AlphaTrade[];
  bridge?: ValueMap;
  safety?: ValueMap;
};

type DashboardApi = IntradayBranch & {
  intraday?: Partial<
    Record<IntradayView, IntradayBranch>
  >;
};

type Props = {
  view: IntradayView;
  title: string;
};

function numberValue(
  value: unknown,
): number | null {
  if (
    typeof value === "number"
    && Number.isFinite(value)
  ) {
    return value;
  }

  if (
    typeof value === "string"
    && value.trim() !== ""
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

function money(value: unknown): string {
  const parsed = numberValue(value);

  if (parsed === null) return "—";

  return `${parsed > 0 ? "+" : ""}${n(parsed, 2)} USD`;
}

function rValue(value: unknown): string {
  const parsed = numberValue(value);

  if (parsed === null) return "—";

  return `${parsed > 0 ? "+" : ""}${n(parsed, 3)}R`;
}

function valueClass(value: unknown): string {
  const parsed = numberValue(value);

  if (parsed === null || parsed === 0) {
    return "";
  }

  return parsed > 0
    ? "positive"
    : "negative";
}

function sideClass(value: unknown): string {
  const side = String(
    value || "",
  ).toUpperCase();

  if (side === "LONG") return "ticker-long";
  if (side === "SHORT") return "ticker-short";

  return "";
}

function stateLabel(value: unknown): string {
  const state = String(
    value || "UNKNOWN",
  ).toUpperCase();

  const labels: Record<string, string> = {
    WAITING_ENTRY: "Ждёт вход",
    WAIT_ENTRY: "Ждёт вход",
    ACTIVE_FILLED: "Позиция открыта",
    OPEN: "Позиция открыта",
    TP: "Закрыта по TP",
    SL: "Закрыта по SL",
    WIN: "Прибыль",
    LOSS: "Убыток",
    CLOSED: "Закрыта",
    EXPIRED_UNFILLED: "Вход не состоялся",
    AMBIGUOUS_ENTRY_EXIT_SAME_CANDLE:
      "Неоднозначная свеча",
    DATA_UNAVAILABLE: "Нет рыночных данных",
  };

  return (
    labels[state]
    || state.replaceAll("_", " ")
  );
}

function stateCategory(
  value: unknown,
): "ACTIVE" | "WAITING" | "CLOSED" {
  const state = String(
    value || "",
  ).toUpperCase();

  if (
    state.includes("ACTIVE")
    || state === "OPEN"
  ) {
    return "ACTIVE";
  }

  if (
    state.includes("WAIT")
    || state.includes("PENDING")
  ) {
    return "WAITING";
  }

  return "CLOSED";
}

function stateTone(value: unknown): string {
  const state = String(
    value || "",
  ).toUpperCase();

  if (
    state === "TP"
    || state === "WIN"
    || state === "ACTIVE_FILLED"
    || state === "OPEN"
  ) {
    return "v2-status-good";
  }

  if (
    state === "SL"
    || state === "LOSS"
  ) {
    return "v2-status-bad";
  }

  return "v2-status-neutral";
}

function formatTime(value: unknown): string {
  if (!value) return "—";

  const date = new Date(
    String(value),
  );

  if (!Number.isFinite(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateOnly(
  value: number | null,
): string {
  if (value === null) return "—";

  return new Date(value).toLocaleDateString(
    "ru-RU",
    {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    },
  );
}

function selectBranch(
  body: DashboardApi,
  view: IntradayView,
): IntradayBranch {
  const branch = body.intraday?.[view];

  if (branch) {
    return branch;
  }

  if (view === "short") {
    return {
      generated_at: body.generated_at,
      mode: body.mode,
      summary: body.summary || {},
      trades: body.trades || [],
      bridge: body.bridge || {},
      safety: body.safety || {},
    };
  }

  return {
    generated_at: body.generated_at,
    mode: "PAPER_ONLY",
    summary: {},
    trades: [],
    bridge: {},
    safety: {},
  };
}

function IntradayModeNav({
  active,
}: {
  active: IntradayView;
}) {
  const links = [
    {
      id: "short",
      href: "/",
      label: "SHORT",
    },
    {
      id: "long",
      href: "/long",
      label: "LONG",
    },
    {
      id: "combined",
      href: "/combined",
      label: "Общий портфель",
    },
  ] as const;

  return (
    <nav
      className="intraday-v2-mode-nav"
      aria-label="Режим Intraday"
    >
      {links.map((link) =>
        link.id === active ? (
          <span key={link.id}>
            {link.label}
          </span>
        ) : (
          <a
            key={link.id}
            href={link.href}
          >
            {link.label}
          </a>
        ),
      )}
    </nav>
  );
}

function TradeCard({
  trade,
}: {
  trade: AlphaTrade;
}) {
  const resultR = (
    numberValue(trade.realized_r)
    ?? numberValue(trade.unrealized_r)
  );

  return (
    <details className="v2-trade-card">
      <summary className="v2-trade-summary">
        <div className="v2-trade-symbol">
          <strong
            className={sideClass(
              trade.side,
            )}
          >
            {trade.symbol || "—"}
          </strong>

          <span>
            {trade.side || "—"}
          </span>
        </div>

        <span
          className={`v2-status ${stateTone(
            trade.state,
          )}`}
        >
          {stateLabel(trade.state)}
        </span>

        <div className="v2-trade-score">
          <span>Score</span>
          <strong>
            {n(trade.score, 1)}
          </strong>
        </div>

        <strong
          className={valueClass(resultR)}
        >
          {rValue(resultR)}
        </strong>

        <time>
          {formatTime(
            trade.closed_at
            || trade.filled_at
            || trade.created_at,
          )}
        </time>
      </summary>

      <div className="v2-trade-details">
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
            {rValue(trade.planned_rr)}
          </strong>
        </div>

        <div>
          <span>Текущая цена</span>
          <strong>
            {n(trade.current_price, 8)}
          </strong>
        </div>

        <div>
          <span>Результат</span>
          <strong
            className={valueClass(
              trade.pnl_usd,
            )}
          >
            {money(trade.pnl_usd)}
          </strong>
        </div>
      </div>
    </details>
  );
}

export default function DashboardV2({
  view,
  title,
}: Props) {
  const [data, setData] =
    useState<IntradayBranch | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  const [refreshing, setRefreshing] =
    useState(false);

  const [tradeFilter, setTradeFilter] =
    useState<
      "ALL" | "ACTIVE" | "WAITING" | "CLOSED"
    >("ALL");

  const load = useCallback(async () => {
    setRefreshing(true);

    try {
      const response = await fetch(
        `/api/dashboard?intraday_v2=${Date.now()}`,
        {
          cache: "no-store",
        },
      );

      const body =
        await response.json() as DashboardApi & {
          error?: string;
          detail?: string;
        };

      if (!response.ok) {
        throw new Error(
          body.detail
          || body.error
          || "Ошибка dashboard API",
        );
      }

      setData(
        selectBranch(
          body,
          view,
        ),
      );

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

    return () => {
      window.clearInterval(timer);
    };
  }, [load]);

  const summary = data?.summary || {};

  const trades = useMemo(() => {
    return [
      ...(data?.trades || []),
    ].sort((left, right) => {
      const categoryOrder = {
        ACTIVE: 0,
        WAITING: 1,
        CLOSED: 2,
      };

      const categoryDifference = (
        categoryOrder[
          stateCategory(left.state)
        ]
        - categoryOrder[
          stateCategory(right.state)
        ]
      );

      if (categoryDifference !== 0) {
        return categoryDifference;
      }

      const leftTime = new Date(
        left.created_at || 0,
      ).getTime();

      const rightTime = new Date(
        right.created_at || 0,
      ).getTime();

      return rightTime - leftTime;
    });
  }, [data]);

  const active = trades.filter(
    (trade) =>
      stateCategory(trade.state)
      === "ACTIVE",
  );

  const waiting = trades.filter(
    (trade) =>
      stateCategory(trade.state)
      === "WAITING",
  );

  const closed = trades.filter(
    (trade) =>
      stateCategory(trade.state)
      === "CLOSED",
  );

  const visibleTrades = trades.filter(
    (trade) => (
      tradeFilter === "ALL"
      || stateCategory(trade.state)
        === tradeFilter
    ),
  );

  const samplePeriod = useMemo(() => {
    const timestamps = trades
      .map((trade) => {
        const value = new Date(
          trade.created_at || "",
        ).getTime();

        return Number.isFinite(value)
          ? value
          : null;
      })
      .filter(
        (value): value is number =>
          value !== null,
      )
      .sort((left, right) => left - right);

    return {
      start:
        timestamps.length
          ? timestamps[0]
          : null,

      end:
        timestamps.length
          ? timestamps[
              timestamps.length - 1
            ]
          : null,
    };
  }, [trades]);

  const generated = data?.generated_at
    ? new Date(
        data.generated_at,
      ).toLocaleString("ru-RU")
    : "—";

  return (
    <main className="shell">
      <header className="topbar">
        <div className="topbar-copy">
          <div className="eyebrow">
            BROM / INTRADAY
          </div>

          <h1>{title}</h1>

          <p>
            Накопленная статистика текущего трекера: сигналы, открытые позиции и закрытые сделки.
          </p>
        </div>

        <div className="topbar-right">
          <span
            className={`pill ${
              error ? "bad" : "good"
            }`}
          >
            {error
              ? "Нет обновления"
              : "PAPER / Виртуально"}
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
            {n(
              summary.candidates
              ?? trades.length,
              0,
            )}
          </div>

          <div className="metric-hint">
            Накопленные записи трекера
          </div>
        </div>

        <div className="card metric-card">
          <div className="metric-label">
            Ждут вход
          </div>

          <div className="metric-value">
            {n(waiting.length, 0)}
          </div>

          <div className="metric-hint">
            Entry ещё не достигнут
          </div>
        </div>

        <div className="card metric-card">
          <div className="metric-label">
            Открытые
          </div>

          <div className="metric-value">
            {n(active.length, 0)}
          </div>

          <div className="metric-hint">
            Виртуальные позиции
          </div>
        </div>

        <div className="card metric-card">
          <div className="metric-label">
            Закрытые
          </div>

          <div className="metric-value">
            {n(closed.length, 0)}
          </div>

          <div className="metric-hint">
            Есть итоговый результат
          </div>
        </div>

        <div className="card metric-card">
          <div className="metric-label">
            Итог в R
          </div>

          <div
            className={`metric-value ${valueClass(
              summary.net_r,
            )}`}
          >
            {rValue(summary.net_r)}
          </div>

          <div className="metric-hint">
            По закрытым сделкам
          </div>
        </div>

        <div className="card metric-card">
          <div className="metric-label">
            Условный PnL
          </div>

          <div
            className={`metric-value ${valueClass(
              summary.hypothetical_net_pnl_usd,
            )}`}
          >
            {money(
              summary.hypothetical_net_pnl_usd,
            )}
          </div>

          <div className="metric-hint">
            Исследовательская модель
          </div>
        </div>
      </section>

      <IntradayDeliveryCard />

      <section className="compact-results">
        <div>
          <span>Победы / поражения</span>
          <strong>
            {n(summary.wins, 0)}
            {" / "}
            {n(summary.losses, 0)}
          </strong>
        </div>

        <div>
          <span>Винрейт</span>
          <strong>
            {numberValue(
              summary.win_rate_pct,
            ) === null
              ? "—"
              : `${n(
                  summary.win_rate_pct,
                  2,
                )}%`}
          </strong>
        </div>

        <div>
          <span>Матожидание</span>
          <strong
            className={valueClass(
              summary.expectancy_r,
            )}
          >
            {rValue(
              summary.expectancy_r,
            )}
          </strong>
        </div>

        <div>
          <span>Profit factor</span>
          <strong>
            {n(
              summary.profit_factor,
              2,
            )}
          </strong>
        </div>

        <div>
          <span>Период выборки</span>
          <strong>
            {formatDateOnly(
              samplePeriod.start,
            )}
            {" — "}
            {formatDateOnly(
              samplePeriod.end,
            )}
          </strong>
        </div>

        <div>
          <span>Реальные заявки</span>
          <strong>Отключены</strong>
        </div>
      </section>

      <section className="card section-card">
        <div className="section-head">
          <div>
            <div className="eyebrow">
              СДЕЛКИ INTRADAY
            </div>

            <h2>Позиции и история</h2>

            <p className="section-description">
              Показаны все накопленные записи текущего трекера. Entry, SL, TP и Score доступны внутри карточки.
            </p>
          </div>

          <span className="subtle">
            Показано: {visibleTrades.length}
          </span>
        </div>

        <div className="v2-filter-row">
          {([
            ["ALL", "Все"],
            ["ACTIVE", "Открытые"],
            ["WAITING", "Ждут вход"],
            ["CLOSED", "Завершённые"],
          ] as const).map(
            ([id, label]) => (
              <button
                key={id}
                className={
                  tradeFilter === id
                    ? "v2-filter-active"
                    : ""
                }
                onClick={() => {
                  setTradeFilter(id);
                }}
              >
                {label}
              </button>
            ),
          )}
        </div>

        {visibleTrades.length ? (
          <div className="v2-trade-list">
            {visibleTrades.map(
              (trade, index) => (
                <TradeCard
                  key={
                    trade.id
                    || `${trade.symbol}-${index}`
                  }
                  trade={trade}
                />
              ),
            )}
          </div>
        ) : (
          <div className="empty-inline">
            В выбранной категории сделок нет.
          </div>
        )}
      </section>

      <details className="card section-card tech-details v2-tech-details">
        <summary>
          Техническая информация
        </summary>

        <div className="v2-tech-grid">
          <div>
            <span>Режим</span>
            <strong>
              {String(
                data?.mode || "PAPER_ONLY",
              )}
            </strong>
          </div>

          <div>
            <span>Выбранное направление</span>
            <strong>
              {view.toUpperCase()}
            </strong>
          </div>

          <div>
            <span>Реальные сделки</span>
            <strong>Отключены</strong>
          </div>
        </div>

        <pre className="v2-json">
          {JSON.stringify(
            {
              safety: data?.safety,
              bridge: data?.bridge,
              state_counts:
                summary.state_counts,
            },
            null,
            2,
          )}
        </pre>
      </details>

      <footer>
        Intraday · виртуальная статистика ·
        реальные заявки не отправляются
      </footer>
    </main>
  );
}
