"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import DashboardNav from "@/components/DashboardNav";

type ValueMap = Record<string, unknown>;

type MttPayload = ValueMap & {
  status?: string;
  mode?: string;
  generated_at?: string;
  active_position_count?: number;
  active_order_count?: number;
  current_positions?: ValueMap[];
  current_orders?: ValueMap[];
  today_records?: ValueMap[];
  journal_records?: ValueMap[];
  account?: ValueMap;
  performance?: ValueMap;
  risk?: ValueMap;
  health?: ValueMap;
  policy?: ValueMap;
  runtime?: ValueMap;
  safety?: ValueMap;
};

function map(value: unknown): ValueMap {
  return (
    value !== null
    && typeof value === "object"
    && !Array.isArray(value)
  )
    ? value as ValueMap
    : {};
}

function rows(value: unknown): ValueMap[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is ValueMap =>
          item !== null
          && typeof item === "object"
          && !Array.isArray(item),
      )
    : [];
}

function pick(
  record: ValueMap,
  keys: string[],
): unknown {
  for (const key of keys) {
    const value = record[key];

    if (
      value !== undefined
      && value !== null
      && value !== ""
    ) {
      return value;
    }
  }

  return null;
}

function number(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value)
      ? value
      : null;
  }

  if (typeof value === "string") {
    const parsed = Number(value);

    return Number.isFinite(parsed)
      ? parsed
      : null;
  }

  return null;
}

function formatNumber(
  value: unknown,
  maximumFractionDigits = 6,
): string {
  const parsed = number(value);

  if (parsed === null) return "—";

  return parsed.toLocaleString(
    "ru-RU",
    {
      maximumFractionDigits,
    },
  );
}

function formatUsd(value: unknown): string {
  const parsed = number(value);

  if (parsed === null) return "—";

  return parsed.toLocaleString(
    "ru-RU",
    {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    },
  );
}

function formatDate(value: unknown): string {
  if (typeof value !== "string" || !value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(
    "ru-RU",
    {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    },
  );
}

function text(value: unknown): string {
  return value === null || value === undefined
    ? "—"
    : String(value);
}

function PositionCard({
  position,
  index,
}: {
  position: ValueMap;
  index: number;
}) {
  const symbol = text(
    pick(position, [
      "symbol",
      "instrument",
      "ticker",
      "market",
    ]),
  );

  const side = text(
    pick(position, [
      "side",
      "direction",
      "position_side",
    ]),
  ).toUpperCase();

  const pnl = pick(position, [
    "unrealized_pnl_usd",
    "pnl_usd",
    "unrealized_pnl",
    "profit",
  ]);

  return (
    <article
      className="mtt-real-position"
      key={
        text(
          pick(position, [
            "id",
            "position_id",
            "position_ref",
          ]),
        ) + index
      }
    >
      <div className="mtt-real-position-head">
        <div>
          <strong>{symbol}</strong>
          <span>{side}</span>
        </div>

        <b>
          {formatUsd(pnl)}
        </b>
      </div>

      <div className="mtt-real-position-grid">
        <div>
          <span>Entry</span>
          <strong>
            {formatNumber(
              pick(position, [
                "entry",
                "entry_price",
                "open_price",
              ]),
            )}
          </strong>
        </div>

        <div>
          <span>Текущая цена</span>
          <strong>
            {formatNumber(
              pick(position, [
                "current_price",
                "mark_price",
                "last_price",
              ]),
            )}
          </strong>
        </div>

        <div>
          <span>Stop Loss</span>
          <strong>
            {formatNumber(
              pick(position, [
                "sl",
                "stop_loss",
                "stop_price",
              ]),
            )}
          </strong>
        </div>

        <div>
          <span>Take Profit</span>
          <strong>
            {formatNumber(
              pick(position, [
                "tp",
                "take_profit",
                "take_profit_price",
              ]),
            )}
          </strong>
        </div>

        <div>
          <span>Размер</span>
          <strong>
            {formatNumber(
              pick(position, [
                "quantity",
                "qty",
                "size",
                "position_size",
              ]),
              8,
            )}
          </strong>
        </div>

        <div>
          <span>Открыта</span>
          <strong>
            {formatDate(
              pick(position, [
                "opened_at",
                "created_at",
                "entry_time",
              ]),
            )}
          </strong>
        </div>
      </div>
    </article>
  );
}

export default function MttDashboardV2() {
  const [data, setData] =
    useState<MttPayload | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  const [loading, setLoading] =
    useState(true);

  const load = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/dashboard?mtt_v2e=${Date.now()}`,
        {
          cache: "no-store",
        },
      );

      const body =
        await response.json() as ValueMap;

      const payload = map(
        body.upscale_mtt,
      ) as MttPayload;

      if (!response.ok || !payload.status) {
        throw new Error(
          "MTT_REAL_DATA_UNAVAILABLE",
        );
      }

      setData(payload);
      setError(null);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "UNKNOWN_ERROR",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();

    const timer = window.setInterval(
      () => void load(),
      30_000,
    );

    return () => {
      window.clearInterval(timer);
    };
  }, [load]);

  const positions = useMemo(
    () => rows(data?.current_positions),
    [data],
  );

  const orders = useMemo(
    () => rows(data?.current_orders),
    [data],
  );

  const today = useMemo(
    () => rows(data?.today_records),
    [data],
  );

  const account = map(data?.account);
  const performance = map(data?.performance);

  const equity = pick(account, [
    "equity_usd",
    "equity",
    "account_equity",
  ]);

  const balance = pick(account, [
    "balance_usd",
    "balance",
    "account_balance",
  ]);

  const todayPnl = pick(performance, [
    "today_pnl_usd",
    "daily_pnl_usd",
    "realized_pnl_today_usd",
  ]);

  return (
    <main className="dashboard-shell mtt-real-v2">
      <DashboardNav active="mtt" />

      <header className="page-header">
        <div>
          <span className="eyebrow">
            REAL EXECUTION · READ ONLY UI
          </span>

          <h1>MTT Real</h1>

          <p>
            Наблюдение за фактическими позициями,
            заявками и результатами MTT. Интерфейс
            ничего не открывает, не закрывает и не
            изменяет.
          </p>
        </div>

        <span className="status-pill danger">
          REAL
        </span>
      </header>

      {error ? (
        <div className="error-banner">
          {error}
        </div>
      ) : null}

      <section className="mtt-real-warning">
        <strong>
          Реальная торговля активна
        </strong>

        <span>
          Любые позиции и заявки управляются только
          существующим MTT executor. Эта страница —
          мониторинг.
        </span>
      </section>

      <section className="metrics-grid">
        <article className="metric-card">
          <span>Статус</span>
          <strong>
            {loading
              ? "Загрузка"
              : data?.status || "—"}
          </strong>
        </article>

        <article className="metric-card">
          <span>Активные позиции</span>
          <strong>
            {data?.active_position_count
              ?? positions.length}
          </strong>
        </article>

        <article className="metric-card">
          <span>Активные заявки</span>
          <strong>
            {data?.active_order_count
              ?? orders.length}
          </strong>
        </article>

        <article className="metric-card">
          <span>Equity</span>
          <strong>
            {formatUsd(equity)}
          </strong>
        </article>

        <article className="metric-card">
          <span>Balance</span>
          <strong>
            {formatUsd(balance)}
          </strong>
        </article>

        <article className="metric-card">
          <span>PnL сегодня</span>
          <strong>
            {formatUsd(todayPnl)}
          </strong>
        </article>
      </section>

      <section className="section-card">
        <div className="section-heading">
          <div>
            <span>LIVE POSITIONS</span>
            <h2>Открытые позиции</h2>
          </div>

          <strong>
            {positions.length}
          </strong>
        </div>

        {positions.length ? (
          <div className="mtt-real-position-list">
            {positions.map(
              (position, index) => (
                <PositionCard
                  key={index}
                  position={position}
                  index={index}
                />
              ),
            )}
          </div>
        ) : (
          <div className="empty-state">
            Открытых позиций нет.
          </div>
        )}
      </section>

      <section className="section-card">
        <div className="section-heading">
          <div>
            <span>TODAY</span>
            <h2>События сегодня</h2>
          </div>

          <strong>
            {today.length}
          </strong>
        </div>

        {today.length ? (
          <div className="mtt-real-events">
            {today.slice(0, 20).map(
              (record, index) => (
                <div
                  className="mtt-real-event"
                  key={index}
                >
                  <div>
                    <strong>
                      {text(
                        pick(record, [
                          "symbol",
                          "instrument",
                          "event",
                          "action",
                        ]),
                      )}
                    </strong>

                    <span>
                      {text(
                        pick(record, [
                          "side",
                          "state",
                          "outcome",
                          "status",
                        ]),
                      )}
                    </span>
                  </div>

                  <div>
                    <strong>
                      {formatUsd(
                        pick(record, [
                          "pnl_usd",
                          "realized_pnl_usd",
                          "profit_usd",
                        ]),
                      )}
                    </strong>

                    <span>
                      {formatDate(
                        pick(record, [
                          "created_at",
                          "closed_at",
                          "timestamp",
                        ]),
                      )}
                    </span>
                  </div>
                </div>
              ),
            )}
          </div>
        ) : (
          <div className="empty-state">
            Событий за сегодня пока нет.
          </div>
        )}
      </section>

      <details className="section-card tech-details">
        <summary>
          Технические детали MTT
        </summary>

        <div className="mtt-real-tech-grid">
          <div>
            <span>Mode</span>
            <strong>
              {data?.mode || "—"}
            </strong>
          </div>

          <div>
            <span>Обновлено</span>
            <strong>
              {formatDate(data?.generated_at)}
            </strong>
          </div>

          <div>
            <span>Health</span>
            <pre>
              {JSON.stringify(
                data?.health || {},
                null,
                2,
              )}
            </pre>
          </div>

          <div>
            <span>Safety</span>
            <pre>
              {JSON.stringify(
                data?.safety || {},
                null,
                2,
              )}
            </pre>
          </div>
        </div>
      </details>

      <footer>
        MTT Real · наблюдение · торговые действия
        из интерфейса отсутствуют
      </footer>
    </main>
  );
}
