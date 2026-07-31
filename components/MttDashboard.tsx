"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

const REFRESH_MS = 15_000;

type RecordValue = Record<string, unknown>;

type TodayRecord = {
  symbol?: string | null;
  side?: string | null;
  state?: string | null;
  outcome?: string | null;
  score?: number | null;
  active?: boolean;
  submitted?: boolean;
  verified?: boolean;
  terminal?: boolean;
  created_at?: string | null;
};

type MttPayload = {
  status?: string;
  generated_at?: string | null;
  account?: RecordValue;
  policy?: RecordValue;
  runtime?: RecordValue;
  active_order_count?: number;
  active_position_count?: number;
  current_orders?: RecordValue[];
  current_positions?: RecordValue[];
  today_records?: TodayRecord[];
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

function pct(value: unknown): string {
  const parsed = numberValue(value);

  if (parsed === null) return "—";

  return `${parsed > 0 ? "+" : ""}${n(parsed, 2)}%`;
}

function valueClass(value: unknown): string {
  const parsed = numberValue(value);

  if (parsed === null || parsed === 0) return "";
  return parsed > 0 ? "positive" : "negative";
}

function stateLabel(value: unknown): string {
  const state = String(value || "UNKNOWN").toUpperCase();

  const labels: Record<string, string> = {
    SUBMITTED_VERIFIED: "Подтверждена",
    CANCELLED_VERIFIED: "Отменена",
    ACTIVE: "Активна",
    OPEN: "Открыта",
    FILLED: "Исполнена",
    TP: "Тейк-профит",
    SL: "Стоп-лосс",
    WIN: "Победа",
    LOSS: "Поражение",
  };

  return labels[state] || state.replaceAll("_", " ");
}

function statusClass(value: unknown): string {
  const state = String(value || "").toUpperCase();

  if (
    state.includes("WIN") ||
    state.includes("TP") ||
    state.includes("VERIFIED") ||
    state.includes("AVAILABLE")
  ) {
    return "good";
  }

  if (
    state.includes("ACTIVE") ||
    state.includes("OPEN") ||
    state.includes("FILLED") ||
    state.includes("SUBMITTED")
  ) {
    return "warn";
  }

  if (
    state.includes("LOSS") ||
    state.includes("SL") ||
    state.includes("REJECT") ||
    state.includes("FAIL")
  ) {
    return "bad";
  }

  return "neutral";
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

function firstValue(
  row: RecordValue,
  keys: string[],
): unknown {
  for (const key of keys) {
    if (
      row[key] !== null &&
      row[key] !== undefined &&
      row[key] !== ""
    ) {
      return row[key];
    }
  }

  return null;
}

function TruthDealCard({
  row,
  kind,
}: {
  row: RecordValue;
  kind: "Ордер" | "Позиция";
}) {
  const symbol = firstValue(
    row,
    ["symbol", "instrument", "market"],
  );

  const side = firstValue(
    row,
    ["side", "direction"],
  );

  const state = firstValue(
    row,
    ["status", "state"],
  );

  const entry = firstValue(
    row,
    [
      "entry",
      "entry_price",
      "average_entry",
      "avg_entry_price",
      "price",
      "limit_price",
    ],
  );

  return (
    <details className="deal-card">
      <summary className="deal-summary">
        <div className="deal-main">
          <strong>{String(symbol || kind)}</strong>
          <span>{String(side || "—")}</span>
        </div>

        <span
          className={`pill ${statusClass(state)}`}
        >
          {stateLabel(state || kind)}
        </span>

        <div className="deal-time">
          {formatTime(
            firstValue(
              row,
              [
                "opened_at",
                "created_at",
                "updated_at",
              ],
            ),
          )}
        </div>

        <div className="deal-result">
          <span>{kind}</span>
          <strong>
            {n(entry, 8)}
          </strong>
        </div>
      </summary>

      <div className="deal-details">
        <div>
          <span>Entry / Limit</span>
          <strong>{n(entry, 8)}</strong>
        </div>

        <div>
          <span>Stop Loss</span>
          <strong>
            {n(
              firstValue(
                row,
                ["stop_loss", "sl"],
              ),
              8,
            )}
          </strong>
        </div>

        <div>
          <span>Take Profit</span>
          <strong>
            {n(
              firstValue(
                row,
                ["take_profit", "tp"],
              ),
              8,
            )}
          </strong>
        </div>

        <div>
          <span>RR</span>
          <strong>
            {n(row.rr, 2)}
          </strong>
        </div>

        <div>
          <span>Score</span>
          <strong>
            {n(
              firstValue(
                row,
                ["score", "confidence"],
              ),
              1,
            )}
          </strong>
        </div>

        <div>
          <span>Риск</span>
          <strong>
            {money(row.risk_usd)}
          </strong>
        </div>

        <div>
          <span>Размер</span>
          <strong>
            {n(
              firstValue(
                row,
                [
                  "quantity",
                  "size",
                  "position_size",
                ],
              ),
              8,
            )}
          </strong>
        </div>

        <div>
          <span>PnL</span>
          <strong
            className={valueClass(
              firstValue(
                row,
                [
                  "pnl_usd",
                  "unrealized_pnl_usd",
                  "realized_pnl_usd",
                  "pnl",
                ],
              ),
            )}
          >
            {money(
              firstValue(
                row,
                [
                  "pnl_usd",
                  "unrealized_pnl_usd",
                  "realized_pnl_usd",
                  "pnl",
                ],
              ),
            )}
          </strong>
        </div>
      </div>
    </details>
  );
}

function TodayDealCard({
  row,
}: {
  row: TodayRecord;
}) {
  return (
    <details className="deal-card">
      <summary className="deal-summary">
        <div className="deal-main">
          <strong>{row.symbol || "—"}</strong>
          <span>{row.side || "—"}</span>
        </div>

        <span
          className={`pill ${statusClass(
            row.outcome || row.state,
          )}`}
        >
          {stateLabel(
            row.outcome || row.state,
          )}
        </span>

        <div className="deal-time">
          {formatTime(row.created_at)}
        </div>

        <div className="deal-result">
          <span>Score</span>
          <strong>{n(row.score, 1)}</strong>
        </div>
      </summary>

      <div className="deal-details">
        <div>
          <span>Статус</span>
          <strong>{stateLabel(row.state)}</strong>
        </div>

        <div>
          <span>Итог</span>
          <strong>
            {row.outcome
              ? stateLabel(row.outcome)
              : "Пока нет"}
          </strong>
        </div>

        <div>
          <span>Score</span>
          <strong>{n(row.score, 1)}</strong>
        </div>

        <div>
          <span>Время сигнала</span>
          <strong>{formatTime(row.created_at)}</strong>
        </div>
      </div>
    </details>
  );
}

export default function MttDashboard() {
  const [data, setData] =
    useState<MttPayload | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  const [refreshing, setRefreshing] =
    useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);

    try {
      const response = await fetch(
        `/api/dashboard?mtt_account=${Date.now()}`,
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

      const payload = body?.upscale_mtt;

      if (
        !payload ||
        payload.status !== "AVAILABLE"
      ) {
        throw new Error(
          payload?.reason ||
          "Account truth MTT недоступен",
        );
      }

      setData(payload);
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
  }, []);

  useEffect(() => {
    load();

    const timer = window.setInterval(
      load,
      REFRESH_MS,
    );

    return () => window.clearInterval(timer);
  }, [load]);

  const account = data?.account || {};
  const policy = data?.policy || {};
  const runtime = data?.runtime || {};

  const orders = data?.current_orders || [];
  const positions = data?.current_positions || [];
  const today = data?.today_records || [];

  const updated = data?.generated_at
    ? new Date(
        data.generated_at,
      ).toLocaleString("ru-RU")
    : "—";

  const totalPnl =
    numberValue(account.total_pnl_usd);

  const totalPnlPct =
    numberValue(account.total_pnl_pct);

  const todaySorted = useMemo(
    () =>
      [...today].sort(
        (a, b) =>
          new Date(
            b.created_at || 0,
          ).getTime() -
          new Date(
            a.created_at || 0,
          ).getTime(),
      ),
    [today],
  );

  return (
    <main className="shell">
      <header className="topbar">
        <div className="topbar-copy">
          <div className="eyebrow">
            BROM / UPSCALE / MTT
          </div>

          <h1>Real Account Dashboard</h1>

          <p>
            Актуальная read-only статистика
            реального Upscale-счёта.
          </p>
        </div>

        <div className="topbar-right">
          <span
            className={`pill ${error ? "bad" : "good"}`}
          >
            {error
              ? "Нет обновления"
              : "Account truth работает"}
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
            Обновлено: {updated}
          </div>
        </div>
      </header>

      <div className="dashboard-switch">
        <a href="/">Alpha</a>
        <span className="dashboard-switch-active">
          Upscale / MTT
        </span>
      </div>

      {error ? (
        <div className="error-banner">
          {error}
        </div>
      ) : null}

      <section className="metrics-grid">
        <div className="card metric-card">
          <div className="metric-label">
            Текущий баланс
          </div>
          <div className="metric-value">
            {n(account.current_balance_usd, 2)} USD
          </div>
          <div className="metric-hint">
            База: 10 000 USD
          </div>
        </div>

        <div className="card metric-card">
          <div className="metric-label">
            Текущий equity
          </div>
          <div className="metric-value">
            {n(account.current_equity_usd, 2)} USD
          </div>
          <div className="metric-hint">
            С учётом открытого PnL
          </div>
        </div>

        <div className="card metric-card">
          <div className="metric-label">
            Общий PnL
          </div>
          <div
            className={`metric-value ${valueClass(
              totalPnl,
            )}`}
          >
            {money(totalPnl)}
          </div>
          <div className="metric-hint">
            От стартовых 10 000 USD
          </div>
        </div>

        <div className="card metric-card">
          <div className="metric-label">
            Доходность
          </div>
          <div
            className={`metric-value ${valueClass(
              totalPnlPct,
            )}`}
          >
            {pct(totalPnlPct)}
          </div>
          <div className="metric-hint">
            От стартового депозита
          </div>
        </div>

        <div className="card metric-card">
          <div className="metric-label">
            Риск на сделку
          </div>
          <div className="metric-value">
            {money(policy.risk_per_trade_usd)}
          </div>
          <div className="metric-hint">
            {n(
              policy.risk_per_trade_pct,
              2,
            )}% от equity
          </div>
        </div>

        <div className="card metric-card">
          <div className="metric-label">
            Ордера / позиции
          </div>
          <div className="metric-value">
            {n(data?.active_order_count, 0)}
            {" / "}
            {n(data?.active_position_count, 0)}
          </div>
          <div className="metric-hint">
            Реальный account truth
          </div>
        </div>
      </section>

      <section className="compact-results">
        <div>
          <span>Минимальный Score</span>
          <strong>
            {n(policy.minimum_score, 0)}
          </strong>
        </div>

        <div>
          <span>Минимальный RR</span>
          <strong>
            {n(policy.minimum_rr, 1)}R
          </strong>
        </div>

        <div>
          <span>Плечо</span>
          <strong>
            {n(policy.leverage, 0)}×
          </strong>
        </div>

        <div>
          <span>Runtime</span>
          <strong>
            {stateLabel(runtime.status)}
          </strong>
        </div>
      </section>

      <section className="card section-card">
        <div className="section-head">
          <div>
            <div className="eyebrow">
              ТЕКУЩИЙ UPSCALE
            </div>
            <h2>Открытые ордера и позиции</h2>
            <p className="section-description">
              Только актуальное состояние реального
              счёта.
            </p>
          </div>
        </div>

        {orders.length || positions.length ? (
          <div className="deal-list">
            {orders.map((row, index) => (
              <TruthDealCard
                key={`order-${index}`}
                row={row}
                kind="Ордер"
              />
            ))}

            {positions.map((row, index) => (
              <TruthDealCard
                key={`position-${index}`}
                row={row}
                kind="Позиция"
              />
            ))}
          </div>
        ) : (
          <div className="empty-inline">
            Сейчас на реальном счёте нет активных
            ордеров и позиций.
          </div>
        )}

        {!orders.length &&
        numberValue(data?.active_order_count) !== null &&
        Number(data?.active_order_count) > 0 ? (
          <div className="data-warning">
            Upscale сообщает об активном ордере,
            но подробная account-truth запись пока
            не опубликована источником.
          </div>
        ) : null}

        {!positions.length &&
        numberValue(data?.active_position_count) !== null &&
        Number(data?.active_position_count) > 0 ? (
          <div className="data-warning">
            Upscale сообщает об активной позиции,
            но подробная account-truth запись пока
            не опубликована источником.
          </div>
        ) : null}
      </section>

      <section className="card section-card">
        <div className="section-head">
          <div>
            <div className="eyebrow">
              СЕГОДНЯ
            </div>
            <h2>История MTT за текущий день</h2>
            <p className="section-description">
              Старые июльские записи полностью
              исключены.
            </p>
          </div>

          <span className="subtle">
            Записей: {todaySorted.length}
          </span>
        </div>

        {todaySorted.length ? (
          <div className="deal-list">
            {todaySorted.map((row, index) => (
              <TodayDealCard
                key={`${row.symbol}-${row.created_at}-${index}`}
                row={row}
              />
            ))}
          </div>
        ) : (
          <div className="empty-inline">
            Сегодня MTT ещё не открыл и не закрыл
            новых сделок.
          </div>
        )}
      </section>

      <footer>
        Upscale / MTT · реальный счёт ·
        read-only dashboard
      </footer>
    </main>
  );
}
