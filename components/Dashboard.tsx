"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { DashboardData, Trade } from "@/lib/types";

const REFRESH_MS = 15_000;

type CurvePoint = {
  value: number;
  label: string;
};

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return null;
}

function n(value: unknown, digits = 2): string {
  const number = toNumber(value);
  if (number === null) return "—";

  return number.toLocaleString("ru-RU", {
    maximumFractionDigits: digits,
  });
}

function signed(value: unknown, digits = 2): string {
  const number = toNumber(value);
  if (number === null) return "—";

  const prefix = number > 0 ? "+" : "";
  return `${prefix}${n(number, digits)}`;
}

function pct(value: unknown): string {
  const number = toNumber(value);
  return number === null ? "—" : `${n(number, 2)}%`;
}

function money(value: unknown): string {
  const number = toNumber(value);
  return number === null ? "—" : `${signed(number, 2)} USD`;
}

function text(value: unknown, fallback = "—"): string {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function statusClass(value: unknown): string {
  const state = text(value, "UNKNOWN").toUpperCase();

  if (
    state.includes("HEALTHY") ||
    state.includes("PASS") ||
    state.includes("REVIEW_READY") ||
    state === "OPEN" ||
    state.includes("POSITION_OPEN") ||
    state.includes("PAPER_FILLED") ||
    state.includes("TP")
  ) {
    return "good";
  }

  if (
    state.includes("COLLECTING") ||
    state.includes("WAITING") ||
    state.includes("OBSERVING") ||
    state.includes("FRESH") ||
    state.includes("WATCH")
  ) {
    return "warn";
  }

  if (
    state.includes("SL") ||
    state.includes("DEGRADED") ||
    state.includes("REJECTED") ||
    state.includes("ERROR") ||
    state.includes("STALE") ||
    state.includes("FAIL")
  ) {
    return "bad";
  }

  return "neutral";
}

function tradeState(trade: Trade): string {
  return text(trade.state, "UNKNOWN");
}

function isFinalTrade(trade: Trade): boolean {
  const state = tradeState(trade).toUpperCase();

  return (
    state.includes("TP") ||
    state.includes("SL") ||
    state.includes("CLOSED") ||
    state.includes("FINAL")
  );
}

function tradeTimeValue(trade: Trade): number {
  const candidates = [
    trade.closed_at,
    trade.updated_at,
    trade.opened_at,
    trade.created_at,
    trade.candidate_time,
    trade.signal_time,
    trade.timestamp,
    trade.generated_at,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;

    const timestamp = new Date(candidate).getTime();
    if (Number.isFinite(timestamp)) return timestamp;
  }

  return 0;
}

function formatTradeTime(trade: Trade): string {
  const timestamp = tradeTimeValue(trade);
  if (!timestamp) return "—";

  return new Date(timestamp).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function tradeR(trade: Trade): number | null {
  return toNumber(trade.realized_r) ?? toNumber(trade.unrealized_r);
}

function tradePnl(trade: Trade): number | null {
  return toNumber(trade.pnl_usd);
}

function valueClass(value: number | null): string {
  if (value === null || value === 0) return "";
  return value > 0 ? "positive" : "negative";
}

function Card({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="card metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      {hint ? <div className="metric-hint">{hint}</div> : null}
    </div>
  );
}

function CurveChart({
  title,
  eyebrow,
  description,
  points,
  suffix,
  digits,
}: {
  title: string;
  eyebrow: string;
  description: string;
  points: CurvePoint[];
  suffix: string;
  digits: number;
}) {
  if (!points.length) {
    return (
      <div className="card chart-card">
        <div className="eyebrow">{eyebrow}</div>
        <div className="chart-title-row">
          <h2>{title}</h2>
          <span className="chart-current">—</span>
        </div>
        <p className="chart-description">{description}</p>
        <div className="chart-empty">
          График появится после первой закрытой paper-сделки.
        </div>
      </div>
    );
  }

  const series: CurvePoint[] = [
    { value: 0, label: "Старт" },
    ...points,
  ];

  const width = 760;
  const height = 230;
  const left = 24;
  const right = 18;
  const top = 18;
  const bottom = 24;

  const values = series.map((point) => point.value);
  let minimum = Math.min(...values, 0);
  let maximum = Math.max(...values, 0);

  if (minimum === maximum) {
    minimum -= 1;
    maximum += 1;
  } else {
    const padding = Math.max((maximum - minimum) * 0.12, 0.15);
    minimum -= padding;
    maximum += padding;
  }

  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;

  const x = (index: number): number =>
    left + (index / Math.max(series.length - 1, 1)) * chartWidth;

  const y = (value: number): number =>
    top + ((maximum - value) / (maximum - minimum)) * chartHeight;

  const polyline = series
    .map((point, index) => `${x(index)},${y(point.value)}`)
    .join(" ");

  const finalValue = points[points.length - 1].value;
  const lineClass = finalValue >= 0 ? "curve-positive" : "curve-negative";

  return (
    <div className="card chart-card">
      <div className="eyebrow">{eyebrow}</div>

      <div className="chart-title-row">
        <h2>{title}</h2>
        <span className={`chart-current ${valueClass(finalValue)}`}>
          {signed(finalValue, digits)}
          {suffix}
        </span>
      </div>

      <p className="chart-description">{description}</p>

      <div className="curve-wrap">
        <svg
          className="curve-svg"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={title}
        >
          {[0.25, 0.5, 0.75].map((ratio) => {
            const gridY = top + chartHeight * ratio;
            return (
              <line
                key={ratio}
                x1={left}
                x2={width - right}
                y1={gridY}
                y2={gridY}
                className="curve-grid-line"
              />
            );
          })}

          {minimum < 0 && maximum > 0 ? (
            <line
              x1={left}
              x2={width - right}
              y1={y(0)}
              y2={y(0)}
              className="curve-zero-line"
            />
          ) : null}

          <polyline
            points={polyline}
            className={`curve-line ${lineClass}`}
          />

          {series.map((point, index) => (
            <circle
              key={`${point.label}-${index}`}
              cx={x(index)}
              cy={y(point.value)}
              r={index === series.length - 1 ? 4.5 : 2.5}
              className={`curve-dot ${lineClass}`}
            />
          ))}
        </svg>
      </div>

      <div className="chart-foot">
        <span>Старт: 0</span>
        <span>Закрытых точек: {points.length}</span>
      </div>
    </div>
  );
}

function TradeRow({ trade }: { trade: Trade }) {
  const r = tradeR(trade);
  const pnl = tradePnl(trade);
  const state = tradeState(trade);

  return (
    <tr>
      <td>
        <strong>{text(trade.symbol)}</strong>
        <div className="subtle">{text(trade.side)}</div>
      </td>
      <td>
        <span className={`pill ${statusClass(state)}`}>{state}</span>
      </td>
      <td>{formatTradeTime(trade)}</td>
      <td>{n(trade.entry, 8)}</td>
      <td>{n(trade.current_price, 8)}</td>
      <td>{n(trade.sl, 8)}</td>
      <td>{n(trade.tp, 8)}</td>
      <td className={valueClass(r)}>
        {r === null ? "—" : `${signed(r, 3)}R`}
      </td>
      <td className={valueClass(pnl)}>
        {pnl === null ? "—" : `${signed(pnl, 2)} USD`}
      </td>
      <td>{n(trade.score, 1)}</td>
    </tr>
  );
}

function TradeMobileCard({ trade }: { trade: Trade }) {
  const r = tradeR(trade);
  const pnl = tradePnl(trade);
  const state = tradeState(trade);

  return (
    <article className="trade-mobile-card">
      <div className="trade-mobile-head">
        <div>
          <strong>{text(trade.symbol)}</strong>
          <span>{text(trade.side)}</span>
        </div>
        <span className={`pill ${statusClass(state)}`}>{state}</span>
      </div>

      <div className="trade-mobile-time">{formatTradeTime(trade)}</div>

      <div className="trade-mobile-grid">
        <div>
          <span>Entry</span>
          <strong>{n(trade.entry, 8)}</strong>
        </div>
        <div>
          <span>Цена</span>
          <strong>{n(trade.current_price, 8)}</strong>
        </div>
        <div>
          <span>SL</span>
          <strong>{n(trade.sl, 8)}</strong>
        </div>
        <div>
          <span>TP</span>
          <strong>{n(trade.tp, 8)}</strong>
        </div>
      </div>

      <div className="trade-mobile-result">
        <span className={valueClass(r)}>
          {r === null ? "R: —" : `R: ${signed(r, 3)}`}
        </span>
        <span className={valueClass(pnl)}>
          {pnl === null ? "PnL: —" : `PnL: ${signed(pnl, 2)} USD`}
        </span>
        <span>Score: {n(trade.score, 1)}</span>
      </div>
    </article>
  );
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState("");
  const [sideFilter, setSideFilter] = useState("ALL");
  const [stateFilter, setStateFilter] = useState("ALL");

  const load = useCallback(async () => {
    setRefreshing(true);

    try {
      const response = await fetch(`/api/dashboard?ui=${Date.now()}`, {
        cache: "no-store",
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          payload?.detail || payload?.error || "Dashboard API error",
        );
      }

      setData(payload);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setRefreshing(false);
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    load();

    const timer = window.setInterval(load, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  const summary = (data?.summary || {}) as Record<string, unknown>;
  const quality = (data?.quality || {}) as Record<string, unknown>;
  const sample = (quality.sample || {}) as Record<string, unknown>;
  const pipeline = (data?.pipeline || {}) as Record<string, unknown>;
  const funnel = (data?.funnel || {}) as Record<string, unknown>;
  const safety = (data?.safety || {}) as Record<string, unknown>;

  const windows = (funnel.windows || {}) as Record<
    string,
    Record<string, unknown>
  >;

  const trades = useMemo(() => {
    const rows = Array.isArray(data?.trades) ? data.trades : [];

    const priority = (trade: Trade): number => {
      const state = tradeState(trade).toUpperCase();

      if (state.includes("OPEN") || state.includes("FILLED")) return 0;
      if (state.includes("WAITING")) return 1;
      return 2;
    };

    return [...rows].sort((a, b) => {
      const priorityDifference = priority(a) - priority(b);
      if (priorityDifference !== 0) return priorityDifference;
      return tradeTimeValue(b) - tradeTimeValue(a);
    });
  }, [data]);

  const states = useMemo(
    () =>
      Array.from(
        new Set(trades.map((trade) => tradeState(trade)).filter(Boolean)),
      ).sort(),
    [trades],
  );

  const sides = useMemo(
    () =>
      Array.from(
        new Set(
          trades
            .map((trade) => text(trade.side, "UNKNOWN"))
            .filter(Boolean),
        ),
      ).sort(),
    [trades],
  );

  const filteredTrades = useMemo(() => {
    const query = search.trim().toUpperCase();

    return trades.filter((trade) => {
      const symbol = text(trade.symbol, "").toUpperCase();
      const id = text(trade.id, "").toUpperCase();
      const side = text(trade.side, "UNKNOWN");
      const state = tradeState(trade);

      const searchOk =
        !query || symbol.includes(query) || id.includes(query);

      const sideOk = sideFilter === "ALL" || side === sideFilter;
      const stateOk = stateFilter === "ALL" || state === stateFilter;

      return searchOk && sideOk && stateOk;
    });
  }, [trades, search, sideFilter, stateFilter]);

  const closedTradesAscending = useMemo(
    () =>
      trades
        .filter(
          (trade) =>
            isFinalTrade(trade) || toNumber(trade.realized_r) !== null,
        )
        .sort((a, b) => tradeTimeValue(a) - tradeTimeValue(b)),
    [trades],
  );

  const rCurve = useMemo(() => {
    let cumulative = 0;

    return closedTradesAscending
      .filter((trade) => toNumber(trade.realized_r) !== null)
      .map((trade) => {
        cumulative += toNumber(trade.realized_r) ?? 0;

        return {
          value: cumulative,
          label: `${text(trade.symbol)} ${tradeState(trade)}`,
        };
      });
  }, [closedTradesAscending]);

  const pnlCurve = useMemo(() => {
    let cumulative = 0;

    return closedTradesAscending
      .filter((trade) => toNumber(trade.pnl_usd) !== null)
      .map((trade) => {
        cumulative += toNumber(trade.pnl_usd) ?? 0;

        return {
          value: cumulative,
          label: `${text(trade.symbol)} ${tradeState(trade)}`,
        };
      });
  }, [closedTradesAscending]);

  const generatedAt =
    data?.vps_published_at ||
    data?.generated_at ||
    data?.vercel_ingested_at;

  const generated = generatedAt
    ? new Date(generatedAt).toLocaleString("ru-RU")
    : "—";

  const snapshotAgeSeconds = generatedAt
    ? Math.max(
        0,
        Math.round((Date.now() - new Date(generatedAt).getTime()) / 1000),
      )
    : null;

  const freshness =
    snapshotAgeSeconds === null
      ? "UNKNOWN"
      : snapshotAgeSeconds <= 180
        ? "LIVE"
        : snapshotAgeSeconds <= 600
          ? "DELAYED"
          : "STALE";

  const health = text(
    pipeline.pipeline_health || quality.pipeline_health,
    "UNKNOWN",
  );

  const review = text(quality.review_state, "COLLECTING");

  const realOff =
    safety.real_trades === false && quality.real_submit === false;

  const demoOff =
    safety.demo_submit === false && quality.demo_submit === false;

  const orderOff =
    safety.order_action === false && quality.order_action === false;

  const stageRows = Array.isArray(pipeline.stages)
    ? (pipeline.stages as Array<Record<string, unknown>>)
    : [];

  return (
    <main className="shell">
      <header className="topbar">
        <div className="topbar-copy">
          <div className="eyebrow">BROM / ALPHA</div>
          <h1>Intraday Dashboard</h1>
          <p>
            Чистая forward-статистика Alpha: сделки, cumulative R,
            гипотетический paper PnL и здоровье pipeline.
          </p>
        </div>

        <div className="topbar-right">
          <div className="topbar-pills">
            <span className={`pill ${statusClass(health)}`}>{health}</span>
            <span className={`pill ${statusClass(freshness)}`}>
              {freshness}
            </span>
            <span className="pill neutral">
              {text(data?.mode, "PAPER_ONLY")}
            </span>
          </div>

          <button onClick={load} disabled={refreshing}>
            {refreshing ? "Обновление…" : "Обновить"}
          </button>

          <div className="updated">
            Snapshot: {generated}
            {snapshotAgeSeconds !== null
              ? ` · ${snapshotAgeSeconds}s назад`
              : ""}
          </div>
        </div>
      </header>

      <section className="safety-strip" aria-label="Safety state">
        <span className={realOff ? "safety-ok" : "safety-alert"}>
          REAL {realOff ? "OFF" : "CHECK"}
        </span>
        <span className={demoOff ? "safety-ok" : "safety-alert"}>
          DEMO {demoOff ? "OFF" : "CHECK"}
        </span>
        <span className={orderOff ? "safety-ok" : "safety-alert"}>
          ORDERS {orderOff ? "OFF" : "CHECK"}
        </span>
        <span className="safety-copy">
          Dashboard только читает paper snapshot и не умеет отправлять
          ордера.
        </span>
      </section>

      {error ? (
        <div className="error-banner">
          API: {error}. Последний успешный snapshot остаётся на экране.
        </div>
      ) : null}

      <section className="metrics-grid">
        <Card
          label="Quality gate"
          value={
            <span className={statusClass(review)}>{review}</span>
          }
          hint={`${n(sample.decisive, 0)}/30 решённых сделок`}
        />

        <Card
          label="Net paper PnL"
          value={money(summary.hypothetical_net_pnl_usd)}
          hint={`${signed(summary.net_r, 3)}R cumulative`}
        />

        <Card
          label="Expectancy"
          value={
            toNumber(summary.expectancy_r) === null
              ? "—"
              : `${signed(summary.expectancy_r, 3)}R`
          }
          hint={`Profit factor: ${n(summary.profit_factor, 2)}`}
        />

        <Card
          label="Win rate"
          value={pct(summary.win_rate_pct)}
          hint={`${n(summary.wins, 0)} TP / ${n(summary.losses, 0)} SL`}
        />

        <Card
          label="Сделки"
          value={n(summary.candidates, 0)}
          hint={`${n(summary.waiting_entry, 0)} ждут / ${n(summary.active_filled, 0)} открыты`}
        />

        <Card
          label="Закрытые"
          value={n(summary.closed, 0)}
          hint={`${n(summary.ambiguous, 0)} ambiguous / ${n(summary.data_unavailable, 0)} no data`}
        />
      </section>

      <section className="chart-grid">
        <CurveChart
          eyebrow="PERFORMANCE / R"
          title="Cumulative R"
          description="Только фактически закрытые clean paper-сделки с realized R."
          points={rCurve}
          suffix="R"
          digits={3}
        />

        <CurveChart
          eyebrow="PAPER EQUITY"
          title="Equity curve"
          description="Гипотетическое изменение paper equity от нулевой точки, не баланс реального счёта."
          points={pnlCurve}
          suffix=" USD"
          digits={2}
        />
      </section>

      <section className="card section-card">
        <div className="section-head history-head">
          <div>
            <div className="eyebrow">TRADE LOG</div>
            <h2>История сделок</h2>
            <p className="section-description">
              Активные сделки показаны первыми, затем история по времени.
            </p>
          </div>

          <span className="subtle">
            Показано {filteredTrades.length} из {trades.length}
          </span>
        </div>

        <div className="filter-bar">
          <label>
            <span>Поиск</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="BTC, ETH или Trade ID"
              inputMode="search"
            />
          </label>

          <label>
            <span>Направление</span>
            <select
              value={sideFilter}
              onChange={(event) => setSideFilter(event.target.value)}
            >
              <option value="ALL">Все</option>
              {sides.map((side) => (
                <option key={side} value={side}>
                  {side}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Статус</span>
            <select
              value={stateFilter}
              onChange={(event) => setStateFilter(event.target.value)}
            >
              <option value="ALL">Все</option>
              {states.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
          </label>

          <button
            className="reset-button"
            onClick={() => {
              setSearch("");
              setSideFilter("ALL");
              setStateFilter("ALL");
            }}
            disabled={
              search === "" &&
              sideFilter === "ALL" &&
              stateFilter === "ALL"
            }
          >
            Сбросить
          </button>
        </div>

        {initialLoading && !data ? (
          <div className="empty">Загружаю live snapshot…</div>
        ) : filteredTrades.length ? (
          <>
            <div className="table-wrap desktop-trades">
              <table>
                <thead>
                  <tr>
                    <th>Монета</th>
                    <th>Статус</th>
                    <th>Время</th>
                    <th>Entry</th>
                    <th>Цена</th>
                    <th>SL</th>
                    <th>TP</th>
                    <th>PnL R</th>
                    <th>PnL USD</th>
                    <th>Score</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredTrades.map((trade, index) => (
                    <TradeRow
                      key={text(
                        trade.id,
                        `${text(trade.symbol)}-${tradeTimeValue(trade)}-${index}`,
                      )}
                      trade={trade}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mobile-trades">
              {filteredTrades.map((trade, index) => (
                <TradeMobileCard
                  key={text(
                    trade.id,
                    `${text(trade.symbol)}-${tradeTimeValue(trade)}-${index}`,
                  )}
                  trade={trade}
                />
              ))}
            </div>
          </>
        ) : trades.length ? (
          <div className="empty">
            По выбранным фильтрам сделок не найдено.
          </div>
        ) : (
          <div className="empty empty-state">
            <strong>Clean cohort пока пуст.</strong>
            <span>
              Это ожидаемо при статусе COLLECTING 0/30. Первая
              подтверждённая paper-сделка автоматически появится здесь и
              запустит оба графика.
            </span>
          </div>
        )}
      </section>

      <section className="two-col">
        <div className="card section-card">
          <div className="section-head">
            <div>
              <div className="eyebrow">FILTER FLOW</div>
              <h2>Воронка сигналов</h2>
            </div>
          </div>

          {["1h", "6h", "24h"].map((windowName) => {
            const row = windows[windowName] || {};

            return (
              <div className="funnel-row" key={windowName}>
                <strong>{windowName}</strong>
                <span>SHORT {n(row.short, 0)}</span>
                <span>HTF {n(row.htf_ok, 0)}</span>
                <span>Volume {n(row.volume_ok, 0)}</span>
                <span className="accent">
                  RR3 {n(row.rr_3_ready, 0)}
                </span>
              </div>
            );
          })}

          <div className="note">
            После clean activation:{" "}
            {n(funnel.eligible_since_activation, 0)} подходящих.
          </div>
        </div>

        <div className="card section-card">
          <div className="section-head">
            <div>
              <div className="eyebrow">SYSTEM</div>
              <h2>Здоровье цепочки</h2>
            </div>
          </div>

          <div className="stage-list">
            {stageRows.length ? (
              stageRows.map((stage, index) => (
                <div
                  className="stage"
                  key={`${text(stage.name)}-${index}`}
                >
                  <span>{text(stage.name)}</span>
                  <span
                    className={`pill ${statusClass(stage.status)}`}
                  >
                    {text(stage.status)}
                  </span>
                  <span className="subtle">
                    {n(stage.age_seconds, 0)}s
                  </span>
                </div>
              ))
            ) : (
              <div className="empty">Нет данных watchdog.</div>
            )}
          </div>
        </div>
      </section>

      <footer>
        BROM Alpha · PAPER_ONLY · no submit · no order mutation ·
        автообновление каждые 15 секунд
      </footer>
    </main>
  );
}
