"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import DashboardNav from "@/components/DashboardNav";

const REFRESH_MS = 15_000;

type StatBlock = {
  trade_count?: number | null;
  wait_entry_count?: number | null;
  open_count?: number | null;
  closed_count?: number | null;
  wins?: number | null;
  losses?: number | null;
  win_rate_pct?: number | null;
  net_r?: number | null;
  expectancy_r?: number | null;
  profit_factor?: number | null;
  maximum_drawdown_r?: number | null;
  maximum_losing_streak?: number | null;
  average_mfe_r?: number | null;
  average_mae_r?: number | null;
};

type ShadowTrade = {
  id?: string;
  message_id?: number | null;
  symbol?: string;
  side?: string;
  score?: number | null;
  score_band?: string;
  entry?: number | null;
  sl?: number | null;
  tp?: number | null;
  planned_rr?: number | null;
  status?: string;
  signal_time?: string | null;
  opened_at?: string | null;
  closed_at?: string | null;
  realized_r?: number | null;
  mfe_r?: number | null;
  mae_r?: number | null;
};

type ShadowPayload = {
  schema?: string;
  generated_at?: string | null;
  mode?: string;
  source?: {
    watermark?: number | null;
    forward_only?: boolean;
    historical_replay?: boolean;
  };
  policy?: {
    score_condition?: string;
    market_data?: string;
  };
  summary?: {
    pending_count?: number | null;
    idea_only_count?: number | null;
    market_data_error_count?: number | null;
  };
  statistics?: {
    overall?: StatBlock;
    by_score_band?: Record<string, StatBlock>;
    by_side?: Record<string, StatBlock>;
  };
  trades?: ShadowTrade[];
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

function signedR(
  value: unknown,
): string {
  const parsed = numberValue(value);

  if (parsed === null) return "—";

  return `${parsed > 0 ? "+" : ""}${n(parsed, 3)}R`;
}

function valueClass(
  value: unknown,
): string {
  const parsed = numberValue(value);

  if (parsed === null || parsed === 0) {
    return "";
  }

  return parsed > 0
    ? "positive"
    : "negative";
}

function sideClass(
  value: unknown,
): string {
  const side = String(
    value || "",
  ).toUpperCase();

  if (side === "LONG") {
    return "ticker-long";
  }

  if (side === "SHORT") {
    return "ticker-short";
  }

  return "";
}

function formatTime(
  value: unknown,
): string {
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

function statusLabel(
  value: unknown,
): string {
  const status = String(
    value || "UNKNOWN",
  ).toUpperCase();

  const labels: Record<string, string> = {
    WAIT_ENTRY: "Ждёт вход",
    OPEN: "Открыта",
    CLOSED_TP: "Закрыта по TP",
    CLOSED_SL: "Закрыта по SL",
    CLOSED_TIME_EXIT: "Закрыта по времени",
    EXPIRED_NO_ENTRY: "Вход не состоялся",
    IDEA_ONLY: "Только идея",
  };

  return (
    labels[status]
    || status.replaceAll("_", " ")
  );
}

function statusClass(
  value: unknown,
): string {
  const status = String(
    value || "",
  ).toUpperCase();

  if (
    status === "CLOSED_TP"
    || status === "OPEN"
  ) {
    return "shadow-status-good";
  }

  if (status === "CLOSED_SL") {
    return "shadow-status-bad";
  }

  return "shadow-status-neutral";
}

function bandLabel(
  value: string,
): string {
  const labels: Record<string, string> = {
    LT_50: "< 50",
    "50_59": "50–59",
    "60_69": "60–69",
    "70_79": "70–79",
    "80_84": "80–84",
  };

  return labels[value] || value;
}

export default function MttShadowDashboard() {
  const [data, setData] =
    useState<ShadowPayload | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  const [refreshing, setRefreshing] =
    useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);

    try {
      const response = await fetch(
        `/api/dashboard?mtt_shadow=${Date.now()}`,
        {
          cache: "no-store",
        },
      );

      const body = await response.json();

      if (!response.ok) {
        throw new Error(
          body?.detail
          || body?.error
          || "Ошибка dashboard API",
        );
      }

      const payload = body?.mtt_shadow;

      if (
        !payload
        || payload.schema
          !== "BROM_MTT_SUB85_SHADOW_LAB_V1"
        || payload.mode
          !== "PAPER_SHADOW_ONLY"
      ) {
        throw new Error(
          "Данные MTT Shadow недоступны",
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

    return () => {
      window.clearInterval(timer);
    };
  }, [load]);

  const overall =
    data?.statistics?.overall || {};

  const bands =
    data?.statistics?.by_score_band || {};

  const trades = useMemo(
    () => (
      Array.isArray(data?.trades)
        ? data.trades
        : []
    ),
    [data],
  );

  const bandRows = useMemo(
    () => [
      "LT_50",
      "50_59",
      "60_69",
      "70_79",
      "80_84",
    ].map((key) => ({
      key,
      statistics: bands[key] || {},
    })),
    [bands],
  );

  const bestBand = useMemo(() => {
    const eligible = bandRows.filter(
      (row) => (
        numberValue(
          row.statistics.closed_count,
        ) ?? 0
      ) > 0,
    );

    if (!eligible.length) {
      return "Ждём закрытые сделки";
    }

    eligible.sort((left, right) => {
      const leftExpectancy =
        numberValue(
          left.statistics.expectancy_r,
        ) ?? -999;

      const rightExpectancy =
        numberValue(
          right.statistics.expectancy_r,
        ) ?? -999;

      return (
        rightExpectancy
        - leftExpectancy
      );
    });

    return bandLabel(eligible[0].key);
  }, [bandRows]);

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
            BROM / MTT SHADOW
          </div>

          <h1>MTT Shadow Lab</h1>

          <p>
            Виртуальная проверка новых MTT-сигналов
            со score ниже 85 без риска реальными
            деньгами.
          </p>
        </div>

        <div className="topbar-right">
          <div className="shadow-mode-pill">
            <span />
            PAPER / SHADOW
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

      <DashboardNav active="mtt-shadow" />

      {error ? (
        <div className="error-banner">
          {error}
        </div>
      ) : null}

      <section className="shadow-intro card">
        <strong>
          Реальные деньги не используются
        </strong>

        <span>
          Только новые сигналы после watermark{" "}
          {n(data?.source?.watermark, 0)}.
          Старая история не переоткрывается.
        </span>
      </section>

      <section className="metrics-grid">
        <div className="card metric-card">
          <div className="metric-label">
            Всего сделок
          </div>

          <div className="metric-value">
            {n(overall.trade_count, 0)}
          </div>

          <div className="metric-hint">
            Score ниже 85
          </div>
        </div>

        <div className="card metric-card">
          <div className="metric-label">
            Ждут вход
          </div>

          <div className="metric-value">
            {n(
              overall.wait_entry_count,
              0,
            )}
          </div>

          <div className="metric-hint">
            Entry ещё не достигнут
          </div>
        </div>

        <div className="card metric-card">
          <div className="metric-label">
            Открыто
          </div>

          <div className="metric-value">
            {n(overall.open_count, 0)}
          </div>

          <div className="metric-hint">
            Виртуальные позиции
          </div>
        </div>

        <div className="card metric-card">
          <div className="metric-label">
            Закрыто
          </div>

          <div className="metric-value">
            {n(overall.closed_count, 0)}
          </div>

          <div className="metric-hint">
            Есть финальный результат
          </div>
        </div>

        <div className="card metric-card">
          <div className="metric-label">
            Винрейт
          </div>

          <div className="metric-value">
            {numberValue(
              overall.win_rate_pct,
            ) === null
              ? "—"
              : `${n(
                  overall.win_rate_pct,
                  2,
                )}%`}
          </div>

          <div className="metric-hint">
            Только закрытые сделки
          </div>
        </div>

        <div className="card metric-card">
          <div className="metric-label">
            Итог
          </div>

          <div
            className={`metric-value ${valueClass(
              overall.net_r,
            )}`}
          >
            {signedR(overall.net_r)}
          </div>

          <div className="metric-hint">
            Лучший score: {bestBand}
          </div>
        </div>
      </section>

      <section className="compact-results">
        <div>
          <span>Победы / поражения</span>
          <strong>
            {n(overall.wins, 0)}
            {" / "}
            {n(overall.losses, 0)}
          </strong>
        </div>

        <div>
          <span>Ожидание</span>
          <strong>
            {signedR(
              overall.expectancy_r,
            )}
          </strong>
        </div>

        <div>
          <span>Profit factor</span>
          <strong>
            {n(
              overall.profit_factor,
              2,
            )}
          </strong>
        </div>

        <div>
          <span>Макс. просадка</span>
          <strong>
            {signedR(
              numberValue(
                overall.maximum_drawdown_r,
              ) === null
                ? null
                : -Math.abs(
                    numberValue(
                      overall.maximum_drawdown_r,
                    ) || 0,
                  ),
            )}
          </strong>
        </div>

        <div>
          <span>Серия убытков</span>
          <strong>
            {n(
              overall.maximum_losing_streak,
              0,
            )}
          </strong>
        </div>

        <div>
          <span>Только идеи</span>
          <strong>
            {n(
              data?.summary
                ?.idea_only_count,
              0,
            )}
          </strong>
        </div>
      </section>

      <section className="card section-card">
        <div className="section-head">
          <div>
            <div className="eyebrow">
              СРАВНЕНИЕ SCORE
            </div>

            <h2>Какие оценки работают лучше</h2>

            <p className="section-description">
              Результаты считаются отдельно для
              каждого диапазона score.
            </p>
          </div>
        </div>

        <div className="shadow-band-grid">
          {bandRows.map((row) => (
            <div
              className="shadow-band-card"
              key={row.key}
            >
              <span>
                Score {bandLabel(row.key)}
              </span>

              <strong
                className={valueClass(
                  row.statistics.net_r,
                )}
              >
                {signedR(
                  row.statistics.net_r,
                )}
              </strong>

              <small>
                {n(
                  row.statistics.closed_count,
                  0,
                )} закрыто · WR{" "}
                {numberValue(
                  row.statistics.win_rate_pct,
                ) === null
                  ? "—"
                  : `${n(
                      row.statistics.win_rate_pct,
                      1,
                    )}%`}
              </small>
            </div>
          ))}
        </div>
      </section>

      <section className="card section-card">
        <div className="section-head">
          <div>
            <div className="eyebrow">
              PAPER-СДЕЛКИ
            </div>

            <h2>MTT Shadow</h2>

            <p className="section-description">
              Entry, SL и TP берутся из исходного
              сигнала. Уровни не выдумываются.
            </p>
          </div>
        </div>

        {trades.length ? (
          <div className="table-wrap shadow-table-wrap">
            <table className="shadow-table">
              <thead>
                <tr>
                  <th>Актив</th>
                  <th>Сторона</th>
                  <th>Score</th>
                  <th>Entry</th>
                  <th>SL</th>
                  <th>TP</th>
                  <th>RR</th>
                  <th>Статус</th>
                  <th>Результат</th>
                  <th>Время</th>
                </tr>
              </thead>

              <tbody>
                {trades.map((trade) => (
                  <tr
                    key={
                      trade.id
                      || String(
                        trade.message_id,
                      )
                    }
                  >
                    <td>
                      <strong>
                        {trade.symbol || "—"}
                      </strong>
                    </td>

                    <td>
                      <span
                        className={sideClass(
                          trade.side,
                        )}
                      >
                        {trade.side || "—"}
                      </span>
                    </td>

                    <td>
                      <strong>
                        {n(trade.score, 1)}
                      </strong>
                    </td>

                    <td>{n(trade.entry, 8)}</td>
                    <td>{n(trade.sl, 8)}</td>
                    <td>{n(trade.tp, 8)}</td>

                    <td>
                      {numberValue(
                        trade.planned_rr,
                      ) === null
                        ? "—"
                        : `${n(
                            trade.planned_rr,
                            2,
                          )}R`}
                    </td>

                    <td>
                      <span
                        className={`shadow-status ${statusClass(
                          trade.status,
                        )}`}
                      >
                        {statusLabel(
                          trade.status,
                        )}
                      </span>
                    </td>

                    <td
                      className={valueClass(
                        trade.realized_r,
                      )}
                    >
                      <strong>
                        {signedR(
                          trade.realized_r,
                        )}
                      </strong>
                    </td>

                    <td>
                      {formatTime(
                        trade.opened_at
                        || trade.signal_time,
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-inline shadow-empty">
            <strong>
              Ждём первый новый MTT-сигнал
            </strong>

            <span>
              Лаборатория начала работу после
              message_id{" "}
              {n(
                data?.source?.watermark,
                0,
              )}. Старые сделки намеренно
              не добавляются.
            </span>
          </div>
        )}
      </section>

      <footer>
        MTT Shadow · paper only ·
        real execution disabled
      </footer>
    </main>
  );
}
