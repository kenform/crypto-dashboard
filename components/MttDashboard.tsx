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

type LifecycleStage = {
  stage?: string;
  label?: string;
  status?: string;
  time?: string | null;
};

type MttRecord = {
  id?: string;
  source?: string;
  symbol?: string;
  side?: string;
  state?: string;
  outcome?: string | null;
  score?: number | null;
  entry?: number | null;
  sl?: number | null;
  tp?: number | null;
  rr?: number | null;
  risk_usd?: number | null;
  quantity?: number | null;
  pnl_usd?: number | null;
  realized_r?: number | null;
  created_at?: string | null;
  verified_at?: string | null;
  opened_at?: string | null;
  closed_at?: string | null;
  reason?: string | null;
  lifecycle?: LifecycleStage[];
};

type MttPayload = {
  status?: string;
  generated_at?: string | null;
  account?: ValueMap;
  policy?: ValueMap;
  health?: ValueMap;
  runtime?: ValueMap;
  performance?: ValueMap;
  risk?: ValueMap;
  active_order_count?: number;
  active_position_count?: number;
  journal_records?: MttRecord[];
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
    value.trim() !== ""
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

function moneySigned(value: unknown): string {
  const parsed = numberValue(value);

  if (parsed === null) return "—";

  return `${parsed > 0 ? "+" : ""}${n(parsed, 2)} USD`;
}

function moneyPlain(value: unknown): string {
  const parsed = numberValue(value);

  if (parsed === null) return "—";

  return `${n(Math.abs(parsed), 2)} USD`;
}

function pctSigned(value: unknown): string {
  const parsed = numberValue(value);

  if (parsed === null) return "—";

  return `${parsed > 0 ? "+" : ""}${n(parsed, 2)}%`;
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

function freshness(value: unknown): string {
  const seconds = numberValue(value);

  if (seconds === null) return "нет данных";
  if (seconds < 60) return `${Math.round(seconds)} сек назад`;

  return `${Math.round(seconds / 60)} мин назад`;
}

function healthClass(value: unknown): string {
  const status = String(value || "").toUpperCase();

  if (status === "WORKING") return "health-working";
  if (status === "DELAYED") return "health-delayed";

  return "health-error";
}

function stateLabel(value: unknown): string {
  const status = String(value || "UNKNOWN").toUpperCase();

  const labels: Record<string, string> = {
    ARMED_WAITING_MTT: "Ждёт новый MTT-сигнал",
    ORDER_VERIFIED: "Ордер подтверждён",
    POSITION_ACTIVE: "Позиция открыта",
    SIGNAL_VERIFIED: "Сигнал подтверждён",
    CLOSED: "Сделка закрыта",
    WIN: "Победа",
    LOSS: "Поражение",
  };

  return labels[status] || status.replaceAll("_", " ");
}

function TradeCard({
  record,
}: {
  record: MttRecord;
}) {
  return (
    <details className="deal-card">
      <summary className="deal-summary">
        <div className="deal-main">
          <strong className={sideClass(record.side)}>
            {record.symbol || "—"}
          </strong>
          <span>{record.side || "—"}</span>
        </div>

        <span className="pill neutral">
          {stateLabel(record.outcome || record.state)}
        </span>

        <div className="deal-time">
          {formatTime(
            record.closed_at ||
            record.opened_at ||
            record.verified_at ||
            record.created_at,
          )}
        </div>

        <div className="deal-result">
          <span>
            {record.outcome
              ? "Итог"
              : "Score"}
          </span>
          <strong
            className={valueClass(record.pnl_usd)}
          >
            {record.outcome
              ? moneySigned(record.pnl_usd)
              : n(record.score, 1)}
          </strong>
        </div>
      </summary>

      <div className="deal-details">
        <div>
          <span>Entry</span>
          <strong>{n(record.entry, 8)}</strong>
        </div>

        <div>
          <span>Stop Loss</span>
          <strong>{n(record.sl, 8)}</strong>
        </div>

        <div>
          <span>Take Profit</span>
          <strong>{n(record.tp, 8)}</strong>
        </div>

        <div>
          <span>RR</span>
          <strong>{n(record.rr, 2)}R</strong>
        </div>

        <div>
          <span>Score</span>
          <strong>{n(record.score, 1)}</strong>
        </div>

        <div>
          <span>Риск</span>
          <strong>{moneyPlain(record.risk_usd)}</strong>
        </div>

        <div>
          <span>Размер</span>
          <strong>{n(record.quantity, 8)}</strong>
        </div>

        <div>
          <span>Причина</span>
          <strong>{record.reason || "—"}</strong>
        </div>
      </div>

      <div className="trade-lifecycle">
        {(record.lifecycle || []).map(
          (stage, index) => (
            <div
              key={`${stage.stage}-${index}`}
              className={`lifecycle-stage ${
                stage.status === "DONE"
                  ? "lifecycle-done"
                  : "lifecycle-waiting"
              }`}
            >
              <span className="lifecycle-dot" />

              <div>
                <strong>{stage.label || stage.stage}</strong>
                <small>{formatTime(stage.time)}</small>
              </div>
            </div>
          ),
        )}
      </div>

      {record.id ? (
        <a
          className="journal-detail-link"
          href={`/journal/${encodeURIComponent(record.id)}`}
        >
          Открыть подробную страницу сделки →
        </a>
      ) : null}
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
        `/api/dashboard?mtt_v2=${Date.now()}`,
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
          "MTT account truth недоступен",
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
  const health = data?.health || {};
  const runtime = data?.runtime || {};
  const performance = data?.performance || {};
  const risk = data?.risk || {};

  const records = useMemo(
    () => data?.journal_records || [],
    [data],
  );

  const totalPnl =
    numberValue(account.total_pnl_usd);

  const totalPnlPct =
    numberValue(account.total_pnl_pct);

  const winRate =
    numberValue(performance.win_rate_pct);

  const updated = data?.generated_at
    ? new Date(
        data.generated_at,
      ).toLocaleString("ru-RU")
    : "—";

  return (
    <main className="shell">
      <header className="topbar">
        <div className="topbar-copy">
          <div className="eyebrow">
            BROM / UPSCALE / MTT
          </div>

          <h1>Real Account Dashboard</h1>

          <p>
            Реальный Upscale account truth,
            автоторговля и статистика MTT.
          </p>
        </div>

        <div className="topbar-right">
          <div
            className={`autotrade-health ${healthClass(
              health.status,
            )}`}
            title={String(health.reason || "")}
          >
            <span className="health-dot" />
            <div>
              <strong>
                {String(
                  health.label ||
                  "Проверяем автоторговлю",
                )}
              </strong>
              <small>
                {freshness(
                  health.freshness_age_seconds,
                )}
              </small>
            </div>
          </div>

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

      <DashboardNav active="mtt" />

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
            Общий PnL
          </div>
          <div
            className={`metric-value ${valueClass(
              totalPnl,
            )}`}
          >
            {moneySigned(totalPnl)}
          </div>
          <div className="metric-hint">
            {pctSigned(totalPnlPct)}
          </div>
        </div>

        <div className="card metric-card">
          <div className="metric-label">
            Риск на сделку
          </div>
          <div className="metric-value">
            {moneyPlain(
              policy.risk_per_trade_usd,
            )}
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
            MTT Win rate
          </div>
          <div className="metric-value">
            {winRate === null
              ? "—"
              : `${n(winRate, 2)}%`}
          </div>
          <div className="metric-hint">
            Выборка: {n(
              performance.sample_size,
              0,
            )} закрытых real-сделок
          </div>
        </div>

        <div className="card metric-card">
          <div className="metric-label">
            Открытый риск
          </div>
          <div className="metric-value">
            {moneyPlain(
              risk.current_open_risk_usd,
            )}
          </div>
          <div className="metric-hint">
            Все текущие сделки
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
          <span>Победы / поражения</span>
          <strong>
            {n(performance.wins, 0)}
            {" / "}
            {n(performance.losses, 0)}
          </strong>
        </div>

        <div>
          <span>Profit factor</span>
          <strong>
            {n(performance.profit_factor, 2)}
          </strong>
        </div>

        <div>
          <span>Средний результат</span>
          <strong>
            {numberValue(performance.average_r) === null
              ? "—"
              : `${n(performance.average_r, 3)}R`}
          </strong>
        </div>

        <div>
          <span>Лимит сделок в день</span>
          <strong>Нет</strong>
        </div>

        <div>
          <span>Защита одного цикла</span>
          <strong>
            1 submit / сигнал
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
              MTT LIFECYCLE
            </div>

            <h2>Реальные сделки MTT</h2>

            <p className="section-description">
              Сигнал, проверка, ордер, позиция
              и окончательный результат.
            </p>
          </div>

          <a
            className="section-link"
            href="/journal?source=MTT_REAL"
          >
            Открыть дневник →
          </a>
        </div>

        {records.length ? (
          <div className="deal-list">
            {records.map((record) => (
              <TradeCard
                key={record.id}
                record={record}
              />
            ))}
          </div>
        ) : (
          <div className="empty-inline">
            После активации чистого дневника
            закрытых или открытых real-сделок
            MTT пока нет.
          </div>
        )}
      </section>

      <footer>
        Upscale / MTT · real account ·
        read-only statistics
      </footer>
    </main>
  );
}
