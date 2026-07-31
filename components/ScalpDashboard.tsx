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

type ShadowMetrics = {
  selected?: number | null;
  closed?: number | null;
  open?: number | null;
  waiting?: number | null;
  wins?: number | null;
  losses?: number | null;
  flat?: number | null;
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

type ScalpShadowV2 = {
  status?: string;
  generated_at?: string | null;
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
  shadow_v2?: ScalpShadowV2;
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

function shadowStatusLabel(
  value: unknown,
): string {
  const status = String(
    value || "NOT_AVAILABLE",
  ).toUpperCase();

  const labels: Record<string, string> = {
    COLLECTING_FORWARD_SAMPLE:
      "Собираем новые сделки",

    DECISION_READY:
      "Данных достаточно для решения",

    NOT_AVAILABLE:
      "Данные ещё не доступны",
  };

  return (
    labels[status]
    || status.replaceAll("_", " ")
  );
}

function shadowStatusClass(
  value: unknown,
): string {
  const status = String(
    value || "",
  ).toUpperCase();

  if (status === "DECISION_READY") {
    return "good";
  }

  if (
    status === "COLLECTING_FORWARD_SAMPLE"
  ) {
    return "warn";
  }

  return "neutral";
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

  const shadow = data?.shadow_v2;

  const shadowArms = Object.entries(
    shadow?.arms || {},
  );

  const minimumClosed = numberValue(
    shadow?.minimum_closed_for_decision,
  ) || 20;

  const currentLeaderLabel = (
    shadow?.current_leader
      ? shadow?.arms?.[
          shadow.current_leader
        ]?.label
      : null
  );

  return (
    <main className="shell">
      <header className="topbar">
        <div className="topbar-copy">
          <div className="eyebrow">
            BROM / ALPHA / SCALP
          </div>

          <h1>Панель Scalp</h1>

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
              ? "Трекер работает"
              : data?.status === "DELAYED"
              ? "Источник задерживается"
              : "Ожидаем данные трекера"}
          </span>

          <div className="updated">
            {String(
              data?.sample_label ||
              "Теневая выборка V1",
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
            Винрейт 2R
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
            Винрейт 3R
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
            Матожидание 2R
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
            Матожидание 3R
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
          <span>Доля стоп-лоссов от входов</span>
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
              SCALP V2 — ПРОВЕРКА НА НОВЫХ ДАННЫХ
            </div>

            <h2>
              Параллельный forward-эксперимент
            </h2>

            <p className="section-description">
              Шесть независимых фильтров
              сравниваются только на сигналах,
              появившихся после запуска эксперимента.
              Текущий Scalp V1 не изменён.
            </p>
          </div>

          <span
            className={`pill ${shadowStatusClass(
              shadow?.status,
            )}`}
          >
            {shadowStatusLabel(
              shadow?.status,
            )}
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
            <span>
              Минимум закрытых на ветку
            </span>
            <strong>
              {n(minimumClosed, 0)}
            </strong>
          </div>

          <div>
            <span>Текущий лидер</span>
            <strong>
              {currentLeaderLabel ||
                "Ещё не определён"}
            </strong>
          </div>

          <div>
            <span>Старт эксперимента</span>
            <strong>
              {formatTime(
                shadow?.activation_epoch,
              )}
            </strong>
          </div>
        </section>

        {shadowArms.length ? (
          <section className="metrics-grid">
            {shadowArms.map(
              ([armId, arm]) => {
                const historical =
                  arm.historical || {};

                const forward =
                  arm.forward || {};

                return (
                  <div
                    className="card metric-card"
                    key={armId}
                  >
                    <div className="metric-label">
                      {arm.label || armId}
                    </div>

                    <div className="metric-value">
                      {n(forward.closed, 0)}
                      {" / "}
                      {n(minimumClosed, 0)}
                    </div>

                    <div className="metric-hint">
                      Новые закрытые сделки
                    </div>

                    <div className="metric-hint">
                      Винрейт:{" "}
                      {pct(
                        forward.win_rate_pct,
                      )}
                      {" · "}
                      Матожидание:{" "}
                      <span
                        className={valueClass(
                          forward.expectancy_r,
                        )}
                      >
                        {rValue(
                          forward.expectancy_r,
                        )}
                      </span>
                    </div>

                    <div className="metric-hint">
                      Выбрано:{" "}
                      {n(forward.selected, 0)}
                      {" · "}
                      Открыто:{" "}
                      {n(forward.open, 0)}
                      {" · "}
                      Ожидают:{" "}
                      {n(forward.waiting, 0)}
                    </div>

                    <div className="metric-hint">
                      История:{" "}
                      {n(
                        historical.closed,
                        0,
                      )}
                      {" сделок · "}
                      {rValue(
                        historical.expectancy_r,
                      )}
                    </div>

                    <div className="metric-hint">
                      {arm.decision_ready
                        ? "✓ Данных достаточно"
                        : "Сбор выборки продолжается"}
                    </div>
                  </div>
                );
              },
            )}
          </section>
        ) : (
          <div className="empty-inline">
            Shadow-эксперимент ещё не
            опубликовал ветки.
          </div>
        )}
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
                      <span>Вход</span>
                      <strong>
                        {n(trade.entry, 8)}
                      </strong>
                    </div>

                    <div>
                      <span>Стоп-лосс</span>
                      <strong>
                        {n(trade.sl, 8)}
                      </strong>
                    </div>

                    <div>
                      <span>Цель 2R</span>
                      <strong>
                        {n(trade.tp2, 8)}
                      </strong>
                    </div>

                    <div>
                      <span>Цель 3R</span>
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
                      <span>Исходный RR</span>
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
        Alpha Scalp 141 V1 · теневой режим ·
        без реальных и демо-заявок
      </footer>
    </main>
  );
}
