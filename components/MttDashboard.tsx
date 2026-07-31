"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const REFRESH_MS = 15_000;

type MttRecord = {
  symbol?: string | null;
  side?: string | null;
  state?: string | null;
  outcome?: string | null;
  score?: number | null;
  score_bucket?: string | null;
  active?: boolean;
  submitted?: boolean;
  verified?: boolean;
  terminal?: boolean;
  created_at?: string | null;
};

type MttPayload = {
  status?: string;
  mode?: string;
  generated_at?: string | null;
  summary?: Record<string, unknown>;
  active_records?: MttRecord[];
  recent_records?: MttRecord[];
  safety?: Record<string, unknown>;
};

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : null;
}

function n(value: unknown, digits = 0): string {
  const parsed = numberValue(value);

  if (parsed === null) return "—";

  return parsed.toLocaleString("ru-RU", {
    maximumFractionDigits: digits,
  });
}

function pct(value: unknown): string {
  const parsed = numberValue(value);
  return parsed === null ? "—" : `${n(parsed, 2)}%`;
}

function stateLabel(value: unknown): string {
  const state = String(value || "UNKNOWN").toUpperCase();

  const labels: Record<string, string> = {
    SUBMITTED_VERIFIED: "Подтверждена",
    CANCELLED_VERIFIED: "Отменена",
    REJECTED_STALE_LIMIT_PRICE: "Цена устарела",
    REJECTED_INFRA_MISSED_WINDOW: "Окно пропущено",
    REJECTED_CONTROLLED_CANARY_NOT_SELECTED_PRECLICK:
      "Не выбрана системой",
    REJECTED_CONTROLLED_CANARY_FAILED_PRECLICK:
      "Не прошла pre-check",
    SKIPPED_EXISTING_DEDUPE: "Дубликат",
  };

  return labels[state] || state.replaceAll("_", " ");
}

function statusClass(value: unknown): string {
  const state = String(value || "").toUpperCase();

  if (
    state.includes("WIN") ||
    state.includes("VERIFIED") ||
    state.includes("AVAILABLE")
  ) {
    return "good";
  }

  if (
    state.includes("ACTIVE") ||
    state.includes("SUBMITTED") ||
    state.includes("WAIT")
  ) {
    return "warn";
  }

  if (
    state.includes("LOSS") ||
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

function outcomeLabel(value: unknown): string {
  const outcome = String(value || "").toUpperCase();

  if (outcome === "WIN") return "Победа";
  if (outcome === "LOSS") return "Поражение";

  return "Без итога";
}

function MttRow({ record }: { record: MttRecord }) {
  return (
    <tr>
      <td><strong>{record.symbol || "—"}</strong></td>
      <td>{record.side || "—"}</td>
      <td>
        <span className={`pill ${statusClass(record.state)}`}>
          {stateLabel(record.state)}
        </span>
      </td>
      <td>
        <span className={statusClass(record.outcome)}>
          {outcomeLabel(record.outcome)}
        </span>
      </td>
      <td>{n(record.score, 1)}</td>
      <td>{formatTime(record.created_at)}</td>
    </tr>
  );
}

export default function MttDashboard() {
  const [data, setData] = useState<MttPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);

    try {
      const response = await fetch(
        `/api/dashboard?mtt=${Date.now()}`,
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

      const mtt = body?.upscale_mtt;

      if (!mtt || mtt.status !== "AVAILABLE") {
        throw new Error(
          mtt?.reason ||
          "Статистика MTT пока недоступна",
        );
      }

      setData(mtt);
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

    const timer = window.setInterval(load, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  const summary = data?.summary || {};
  const activeRecords = data?.active_records || [];
  const recentRecords = data?.recent_records || [];

  const outcomeRecords = useMemo(
    () =>
      recentRecords
        .filter((row) => row.outcome)
        .slice(0, 30),
    [recentRecords],
  );

  const updated = data?.generated_at
    ? new Date(data.generated_at).toLocaleString("ru-RU")
    : "—";

  return (
    <main className="shell">
      <header className="topbar">
        <div className="topbar-copy">
          <div className="eyebrow">BROM / UPSCALE / MTT</div>
          <h1>MTT Statistics</h1>
          <p>
            Отдельная read-only статистика MTT.
            Без данных аккаунта и управления сделками.
          </p>
        </div>

        <div className="topbar-right">
          <span className={`pill ${error ? "bad" : "good"}`}>
            {error ? "Нет обновления" : "Статистика работает"}
          </span>

          <button onClick={load} disabled={refreshing}>
            {refreshing ? "Обновление…" : "Обновить"}
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
          MTT statistics: {error}
        </div>
      ) : null}

      <section className="metrics-grid mtt-metrics-grid">
        <div className="card metric-card">
          <div className="metric-label">Активные записи</div>
          <div className="metric-value">{n(summary.active)}</div>
          <div className="metric-hint">
            Активны в статистике MTT
          </div>
        </div>

        <div className="card metric-card">
          <div className="metric-label">Подтверждённые</div>
          <div className="metric-value">{n(summary.verified)}</div>
          <div className="metric-hint">
            Verified submit records
          </div>
        </div>

        <div className="card metric-card">
          <div className="metric-label">Закрытые с итогом</div>
          <div className="metric-value">
            {n(summary.closed_with_known_outcome)}
          </div>
          <div className="metric-hint">
            Только известные WIN/LOSS
          </div>
        </div>

        <div className="card metric-card">
          <div className="metric-label">Победы</div>
          <div className="metric-value positive">
            {n(summary.wins)}
          </div>
          <div className="metric-hint">
            Из известных результатов
          </div>
        </div>

        <div className="card metric-card">
          <div className="metric-label">Поражения</div>
          <div className="metric-value negative">
            {n(summary.losses)}
          </div>
          <div className="metric-hint">
            Из известных результатов
          </div>
        </div>

        <div className="card metric-card">
          <div className="metric-label">Win rate</div>
          <div className="metric-value">
            {pct(summary.win_rate_pct)}
          </div>
          <div className="metric-hint">
            По закрытым известным итогам
          </div>
        </div>
      </section>

      <section className="card section-card">
        <div className="section-head">
          <div>
            <div className="eyebrow">АКТИВНЫЕ MTT</div>
            <h2>Активные записи</h2>
            <p className="section-description">
              Это записи статистики MTT, а не account-truth
              список текущих позиций Upscale.
            </p>
          </div>

          <span className="subtle">
            Всего: {activeRecords.length}
          </span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Монета</th>
                <th>Направление</th>
                <th>Статус</th>
                <th>Итог</th>
                <th>Score</th>
                <th>Время</th>
              </tr>
            </thead>

            <tbody>
              {activeRecords.length ? (
                activeRecords.map((record, index) => (
                  <MttRow
                    key={`${record.symbol}-${record.created_at}-${index}`}
                    record={record}
                  />
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="empty">
                    Активных записей MTT сейчас нет.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card section-card">
        <div className="section-head">
          <div>
            <div className="eyebrow">ИЗВЕСТНЫЕ РЕЗУЛЬТАТЫ</div>
            <h2>История WIN / LOSS</h2>
            <p className="section-description">
              Только записи, для которых уже известен итог.
            </p>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Монета</th>
                <th>Направление</th>
                <th>Статус</th>
                <th>Итог</th>
                <th>Score</th>
                <th>Время</th>
              </tr>
            </thead>

            <tbody>
              {outcomeRecords.length ? (
                outcomeRecords.map((record, index) => (
                  <MttRow
                    key={`${record.symbol}-${record.created_at}-outcome-${index}`}
                    record={record}
                  />
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="empty">
                    Известных результатов пока нет.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <footer>
        Upscale / MTT · только read-only статистика
      </footer>
    </main>
  );
}
