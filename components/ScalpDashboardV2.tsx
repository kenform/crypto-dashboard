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
  result_r_2r?: number | null;
  result_r_3r?: number | null;
  mfe_r?: number | null;
  mae_r?: number | null;
  created_at?: string | null;
  opened_at?: string | null;
  closed_at?: string | null;
  reason?: string | null;
};

type ShadowMetrics = {
  selected?: number | null;
  closed?: number | null;
  open?: number | null;
  waiting?: number | null;
  wins?: number | null;
  losses?: number | null;
  win_rate_pct?: number | null;
  expectancy_r?: number | null;
  total_r?: number | null;
  profit_factor?: number | null;
  max_drawdown_r?: number | null;
};

type ShadowArm = {
  label?: string;
  historical?: ShadowMetrics;
  forward?: ShadowMetrics;
  decision_ready?: boolean;
};

type ShadowPayload = {
  status?: string;
  activation_epoch?: string | null;
  forward_candidate_count?: number | null;
  minimum_closed_for_decision?: number | null;
  current_leader?: string | null;
  arms?: Record<string, ShadowArm>;
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
  safety?: ValueMap;
  shadow_v2?: ShadowPayload;
  trades?: ScalpTrade[];
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

function rValue(value: unknown): string {
  const parsed = numberValue(value);

  if (parsed === null) return "—";

  return `${parsed > 0 ? "+" : ""}${n(parsed, 3)}R`;
}

function pct(value: unknown): string {
  const parsed = numberValue(value);

  if (parsed === null) return "—";

  return `${n(parsed, 2)}%`;
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

function statusLabel(value: unknown): string {
  const state = String(
    value || "UNKNOWN",
  ).toUpperCase();

  const labels: Record<string, string> = {
    WAITING_ENTRY: "Ждёт вход",
    OPEN: "Открыта",
    STOP_LOSS: "Стоп-лосс",
    TP2_HIT: "Достигнуто 2R",
    TP3_HIT: "Достигнуто 3R",
    EXPIRED_NO_ENTRY: "Вход не состоялся",
    EXPIRED_AFTER_ENTRY:
      "Закрыта по времени",
    DECISION_READY:
      "Данных достаточно для анализа",
    COLLECTING_FORWARD_SAMPLE:
      "Сбор новой выборки",
  };

  return (
    labels[state]
    || state.replaceAll("_", " ")
  );
}

function statusTone(value: unknown): string {
  const state = String(
    value || "",
  ).toUpperCase();

  if (
    state === "TP2_HIT"
    || state === "TP3_HIT"
    || state === "OPEN"
  ) {
    return "v2-status-good";
  }

  if (state === "STOP_LOSS") {
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

function TradeCard({
  trade,
}: {
  trade: ScalpTrade;
}) {
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
            {trade.tier
              ? ` · ${trade.tier}`
              : ""}
          </span>
        </div>

        <span
          className={`v2-status ${statusTone(
            trade.state,
          )}`}
        >
          {statusLabel(
            trade.state
            || trade.outcome,
          )}
        </span>

        <div className="v2-trade-score">
          <span>Score</span>
          <strong>
            {n(trade.score, 1)}
          </strong>
        </div>

        <strong
          className={valueClass(
            trade.result_r_3r,
          )}
        >
          {rValue(
            trade.result_r_3r,
          )}
        </strong>

        <time>
          {formatTime(
            trade.closed_at
            || trade.opened_at
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
          <span>Цель 2R</span>
          <strong>{n(trade.tp2, 8)}</strong>
        </div>

        <div>
          <span>Цель 3R</span>
          <strong>{n(trade.tp3, 8)}</strong>
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
      </div>
    </details>
  );
}

export default function ScalpDashboardV2() {
  const [data, setData] =
    useState<ScalpPayload | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  const [refreshing, setRefreshing] =
    useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);

    try {
      const response = await fetch(
        `/api/dashboard?scalp_v2_ui=${Date.now()}`,
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

      if (
        !body?.scalp
        || typeof body.scalp !== "object"
      ) {
        throw new Error(
          "Данные Scalp недоступны",
        );
      }

      setData(body.scalp);
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

  const summary = data?.summary || {};
  const policy = data?.policy || {};
  const health = data?.health || {};
  const shadow = data?.shadow_v2;

  const trades = useMemo(() => {
    return [
      ...(data?.trades || []),
    ].sort((left, right) => {
      const leftTime = new Date(
        left.created_at || 0,
      ).getTime();

      const rightTime = new Date(
        right.created_at || 0,
      ).getTime();

      return rightTime - leftTime;
    });
  }, [data]);

  const shadowArms = Object.entries(
    shadow?.arms || {},
  );

  const leader = (
    shadow?.current_leader
      ? shadow.arms?.[
          shadow.current_leader
        ]
      : undefined
  );

  const leaderForward =
    leader?.forward || {};

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
            BROM / SCALP
          </div>

          <h1>Скальпинг</h1>

          <p>
            Scalp V1 и параллельный V2-эксперимент
            на новых данных. Только виртуальная
            торговля.
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
            {error
              ? "Нет обновления"
              : data?.status === "AVAILABLE"
              ? "Трекер работает"
              : "Проверяем данные"}
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

      <DashboardNav active="scalp" />

      {error ? (
        <div className="error-banner">
          {error}
        </div>
      ) : null}

      <section className="metrics-grid">
        <div className="card metric-card">
          <div className="metric-label">
            Кандидаты V1
          </div>

          <div className="metric-value">
            {n(summary.registered, 0)}
          </div>

          <div className="metric-hint">
            Вся исследовательская выборка
          </div>
        </div>

        <div className="card metric-card">
          <div className="metric-label">
            Вход состоялся
          </div>

          <div className="metric-value">
            {n(summary.filled, 0)}
          </div>

          <div className="metric-hint">
            Fill rate:{" "}
            {pct(summary.fill_rate_pct)}
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
            Победы / убытки:{" "}
            {n(summary.wins, 0)}
            {" / "}
            {n(summary.losses, 0)}
          </div>
        </div>

        <div className="card metric-card">
          <div className="metric-label">
            Открытые / ждут
          </div>

          <div className="metric-value">
            {n(summary.active, 0)}
            {" / "}
            {n(summary.waiting, 0)}
          </div>

          <div className="metric-hint">
            Текущие состояния
          </div>
        </div>

        <div className="card metric-card">
          <div className="metric-label">
            Итог при цели 3R
          </div>

          <div
            className={`metric-value ${valueClass(
              summary.net_r_3r,
            )}`}
          >
            {rValue(summary.net_r_3r)}
          </div>

          <div className="metric-hint">
            Матожидание:{" "}
            {rValue(summary.expectancy_3r)}
          </div>
        </div>

        <div className="card metric-card">
          <div className="metric-label">
            Итог при цели 2R
          </div>

          <div
            className={`metric-value ${valueClass(
              summary.net_r_2r,
            )}`}
          >
            {rValue(summary.net_r_2r)}
          </div>

          <div className="metric-hint">
            Матожидание:{" "}
            {rValue(summary.expectancy_2r)}
          </div>
        </div>
      </section>

      <section className="compact-results">
        <div>
          <span>Винрейт 3R</span>
          <strong>
            {pct(
              summary.win_rate_3r_pct,
            )}
          </strong>
        </div>

        <div>
          <span>Винрейт 2R</span>
          <strong>
            {pct(
              summary.win_rate_2r_pct,
            )}
          </strong>
        </div>

        <div>
          <span>Стоп-лоссы</span>
          <strong>
            {n(summary.stop_losses, 0)}
          </strong>
        </div>

        <div>
          <span>Без входа</span>
          <strong>
            {n(
              summary.expired_no_entry,
              0,
            )}
          </strong>
        </div>

        <div>
          <span>Средний MFE</span>
          <strong>
            {rValue(summary.average_mfe_r)}
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
              SCALP V2 / FORWARD
            </div>

            <h2>Параллельный эксперимент</h2>

            <p className="section-description">
              Ветки сравниваются только на новых
              сигналах. Отрицательный лидер не
              считается готовой торговой стратегией.
            </p>
          </div>

          <span className="pill neutral">
            {statusLabel(shadow?.status)}
          </span>
        </div>

        <section className="compact-results">
          <div>
            <span>Новых кандидатов</span>
            <strong>
              {n(
                shadow?.forward_candidate_count,
                0,
              )}
            </strong>
          </div>

          <div>
            <span>Минимум закрытых</span>
            <strong>
              {n(
                shadow
                  ?.minimum_closed_for_decision,
                0,
              )}
            </strong>
          </div>

          <div>
            <span>Текущая ведущая ветка</span>
            <strong>
              {leader?.label
                || "Не определена"}
            </strong>
          </div>

          <div>
            <span>Закрыто у лидера</span>
            <strong>
              {n(
                leaderForward.closed,
                0,
              )}
            </strong>
          </div>

          <div>
            <span>Forward результат</span>
            <strong
              className={valueClass(
                leaderForward.total_r,
              )}
            >
              {rValue(
                leaderForward.total_r,
              )}
            </strong>
          </div>

          <div>
            <span>Автопродвижение</span>
            <strong>Отключено</strong>
          </div>
        </section>

        <div className="scalp-v2-arm-grid">
          {shadowArms.map(
            ([armId, arm]) => {
              const forward =
                arm.forward || {};

              return (
                <article
                  className="scalp-v2-arm-card"
                  key={armId}
                >
                  <div className="scalp-v2-arm-head">
                    <strong>
                      {arm.label || armId}
                    </strong>

                    <span>
                      {arm.decision_ready
                        ? "Выборка собрана"
                        : "Сбор данных"}
                    </span>
                  </div>

                  <div className="scalp-v2-arm-result">
                    <strong
                      className={valueClass(
                        forward.total_r,
                      )}
                    >
                      {rValue(
                        forward.total_r,
                      )}
                    </strong>

                    <small>
                      {n(
                        forward.closed,
                        0,
                      )} закрыто
                    </small>
                  </div>

                  <div className="scalp-v2-arm-metrics">
                    <span>
                      WR{" "}
                      {pct(
                        forward.win_rate_pct,
                      )}
                    </span>

                    <span>
                      EV{" "}
                      {rValue(
                        forward.expectancy_r,
                      )}
                    </span>

                    <span>
                      PF{" "}
                      {n(
                        forward.profit_factor,
                        2,
                      )}
                    </span>
                  </div>
                </article>
              );
            },
          )}
        </div>
      </section>

      <section className="card section-card">
        <div className="section-head">
          <div>
            <div className="eyebrow">
              SCALP V1
            </div>

            <h2>Последние идеи и сделки</h2>

            <p className="section-description">
              Показаны последние 30 записей.
              Полная история остаётся в журнале.
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
          <div className="v2-trade-list">
            {trades.slice(0, 30).map(
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
            Сделок Scalp пока нет.
          </div>
        )}
      </section>

      <details className="card section-card tech-details v2-tech-details">
        <summary>
          Техническая информация
        </summary>

        <div className="v2-tech-grid">
          <div>
            <span>Стратегия</span>
            <strong>
              {data?.strategy || "—"}
            </strong>
          </div>

          <div>
            <span>Минимальный score</span>
            <strong>
              {n(
                policy.minimum_score,
                0,
              )}
            </strong>
          </div>

          <div>
            <span>Состояние pipeline</span>
            <strong>
              {String(
                health.pipeline_state
                || health.status
                || "—",
              )}
            </strong>
          </div>
        </div>

        <pre className="v2-json">
          {JSON.stringify(
            {
              diagnosis: data?.diagnosis,
              policy: data?.policy,
              health: data?.health,
              safety: data?.safety,
            },
            null,
            2,
          )}
        </pre>
      </details>

      <footer>
        Scalp · PAPER only · реальные заявки
        не отправляются
      </footer>
    </main>
  );
}
