"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { DashboardData, Trade } from "@/lib/types";

const REFRESH_MS = 15_000;

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function text(value: unknown, fallback = "—"): string {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function n(value: unknown, digits = 2): string {
  const number = toNumber(value);
  if (number === null) return "—";
  return number.toLocaleString("ru-RU", { maximumFractionDigits: digits });
}

function signed(value: unknown, digits = 2): string {
  const number = toNumber(value);
  if (number === null) return "—";
  const prefix = number > 0 ? "+" : "";
  return `${prefix}${n(number, digits)}`;
}

function pct(value: unknown): string {
  const number = toNumber(value);
  if (number === null) return "—";
  return `${n(number, 2)}%`;
}

function money(value: unknown): string {
  const number = toNumber(value);
  if (number === null) return "—";
  const prefix = number > 0 ? "+" : "";
  return `${prefix}${n(number, 2)} USD`;
}

function statusClass(value: unknown): string {
  const v = text(value, "UNKNOWN").toUpperCase();

  if (
    v.includes("LIVE") ||
    v.includes("ONLINE") ||
    v.includes("HEALTHY") ||
    v.includes("PASS") ||
    v.includes("OPEN") ||
    v.includes("FILLED") ||
    v.includes("TP") ||
    v.includes("READY")
  ) return "good";

  if (
    v.includes("COLLECTING") ||
    v.includes("WAIT") ||
    v.includes("WATCH") ||
    v.includes("OBSERVING") ||
    v.includes("FRESH") ||
    v.includes("DELAY") ||
    v.includes("CHECKING")
  ) return "warn";

  if (
    v.includes("ERROR") ||
    v.includes("FAIL") ||
    v.includes("OFFLINE") ||
    v.includes("STALE") ||
    v.includes("SL") ||
    v.includes("REJECT")
  ) return "bad";

  return "neutral";
}

function friendlyStatus(value: unknown): string {
  const status = text(value, "—").toUpperCase();

  const labels: Record<string, string> = {
    LIVE: "Данные актуальны",
    ONLINE: "API работает",
    HEALTHY: "Система работает",
    PAPER_ONLY: "Только paper",
    PAPER: "Только paper",
    COLLECTING: "Сбор статистики",
    FRESH: "Актуально",
    CHECKING: "Проверяем",
    DELAYED: "Есть задержка",
    STALE: "Данные устарели",
    OFFLINE: "Нет соединения",
    UNKNOWN: "Нет данных",
    PASS: "Работает",
  };

  return labels[status] || status.replaceAll("_", " ");
}

function valueClass(value: number | null): string {
  if (value === null || value === 0) return "";
  return value > 0 ? "positive" : "negative";
}

function tradeState(trade: Trade): string {
  return text(trade.state, "UNKNOWN");
}

function friendlyTradeState(stateRaw: string): string {
  const state = stateRaw.toUpperCase();

  if (state.includes("WAITING")) return "Ждёт входа";
  if (state.includes("OPEN") || state.includes("FILLED")) return "Открыта";
  if (state.includes("TP")) return "Тейк-профит";
  if (state.includes("SL")) return "Стоп-лосс";
  if (state.includes("EXPIRED")) return "Сигнал истёк";
  if (state.includes("CLOSED")) return "Закрыта";
  return stateRaw;
}

function tradeR(trade: Trade): number | null {
  return toNumber(trade.realized_r) ?? toNumber(trade.unrealized_r);
}

function tradePnl(trade: Trade): number | null {
  return toNumber(trade.pnl_usd);
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
    const ts = new Date(candidate).getTime();
    if (Number.isFinite(ts)) return ts;
  }

  return 0;
}

function formatTradeTime(trade: Trade): string {
  const ts = tradeTimeValue(trade);
  if (!ts) return "—";

  return new Date(ts).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isFinalTrade(trade: Trade): boolean {
  const state = tradeState(trade).toUpperCase();
  return state.includes("TP") || state.includes("SL") || state.includes("CLOSED") || state.includes("FINAL");
}

function stageLabel(nameRaw: unknown): string {
  const name = text(nameRaw, "");
  const map: Record<string, string> = {
    MARKET_FEATURES: "Рыночные данные",
    ZONE_SCANNER: "Сканер зон",
    ZONE_WATCH: "Наблюдение за зонами",
    BOS_CONFIRMATION: "Подтверждение BOS",
    CONFIRMED_BRIDGE: "Фильтр кандидатов",
    PAPER_TRACKER: "Учёт paper-сделок",
    QUALITY_GATE: "Контроль качества",
  };
  return map[name] || name || "Этап";
}

function reasonLabel(codeRaw: string): string {
  const code = codeRaw.toUpperCase();

  const map: Record<string, string> = {
    NOT_SHORT: "Монета не подошла под short-сценарий",
    VOLUME_NOT_CONFIRMED: "Не подтвердился объём",
    PREDATES_CLEAN_COHORT: "Сигнал старше clean-запуска",
    RR_TOO_LOW: "Слишком слабое соотношение риск/прибыль",
    HTF_NOT_CONFIRMED: "Нет подтверждения старшего таймфрейма",
    GEOMETRY_INVALID: "Нарушена геометрия сценария",
    NOT_CONFIRMED: "Сценарий не подтвердился",
  };

  return map[code] || code.replaceAll("_", " ");
}

function Card({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="card metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      {hint ? <div className="metric-hint">{hint}</div> : null}
    </div>
  );
}

function PlainCard({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="card section-card">
      <div className="section-head compact-head">
        <div>
          <div className="eyebrow">{eyebrow}</div>
          <h2>{title}</h2>
        </div>
      </div>
      {children}
    </div>
  );
}

function TradeRow({ trade }: { trade: Trade }) {
  const r = tradeR(trade);
  const pnl = tradePnl(trade);
  const state = tradeState(trade);
  const friendlyState = friendlyTradeState(state);

  return (
    <tr>
      <td>
        <strong>{text(trade.symbol)}</strong>
      </td>
      <td>{text(trade.side)}</td>
      <td>
        <span className={`pill ${statusClass(state)}`}>{friendlyState}</span>
      </td>
      <td>{formatTradeTime(trade)}</td>
      <td className={valueClass(r)}>{r === null ? "—" : `${signed(r, 3)}R`}</td>
      <td className={valueClass(pnl)}>{pnl === null ? "—" : `${signed(pnl, 2)} USD`}</td>
      <td>{n(trade.score, 1)}</td>
    </tr>
  );
}

function TradeMobileCard({ trade }: { trade: Trade }) {
  const state = tradeState(trade);
  const r = tradeR(trade);
  const pnl = tradePnl(trade);

  return (
    <article className="trade-mobile-card">
      <div className="trade-mobile-head">
        <div>
          <strong>{text(trade.symbol)}</strong>
          <span>{text(trade.side)}</span>
        </div>
        <span className={`pill ${statusClass(state)}`}>{friendlyTradeState(state)}</span>
      </div>

      <div className="trade-mobile-time">{formatTradeTime(trade)}</div>

      <div className="trade-mobile-grid">
        <div>
          <span>Результат (R)</span>
          <strong className={valueClass(r)}>{r === null ? "—" : `${signed(r, 3)}R`}</strong>
        </div>
        <div>
          <span>Результат (USD)</span>
          <strong className={valueClass(pnl)}>{pnl === null ? "—" : `${signed(pnl, 2)} USD`}</strong>
        </div>
        <div>
          <span>Entry</span>
          <strong>{n(trade.entry, 8)}</strong>
        </div>
        <div>
          <span>Score</span>
          <strong>{n(trade.score, 1)}</strong>
        </div>
      </div>
    </article>
  );
}

function CurveChart({
  eyebrow,
  title,
  description,
  points,
  suffix,
  digits,
}: {
  eyebrow: string;
  title: string;
  description: string;
  points: Array<{ label: string; value: number }>;
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
          График автоматически появится после первой закрытой clean paper-сделки.
        </div>
      </div>
    );
  }

  const series = [{ label: "Старт", value: 0 }, ...points];
  const width = 760;
  const height = 220;
  const left = 24;
  const right = 18;
  const top = 18;
  const bottom = 20;

  const values = series.map((point) => point.value);
  let min = Math.min(...values, 0);
  let max = Math.max(...values, 0);

  if (min === max) {
    min -= 1;
    max += 1;
  } else {
    const pad = Math.max((max - min) * 0.12, 0.2);
    min -= pad;
    max += pad;
  }

  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;

  const x = (index: number): number =>
    left + (index / Math.max(series.length - 1, 1)) * chartWidth;

  const y = (value: number): number =>
    top + ((max - value) / (max - min)) * chartHeight;

  const polyline = series.map((point, index) => `${x(index)},${y(point.value)}`).join(" ");
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
        <svg className="curve-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
          {[0.25, 0.5, 0.75].map((ratio) => {
            const gy = top + chartHeight * ratio;
            return (
              <line
                key={ratio}
                x1={left}
                x2={width - right}
                y1={gy}
                y2={gy}
                className="curve-grid-line"
              />
            );
          })}

          {min < 0 && max > 0 ? (
            <line
              x1={left}
              x2={width - right}
              y1={y(0)}
              y2={y(0)}
              className="curve-zero-line"
            />
          ) : null}

          <polyline points={polyline} className={`curve-line ${lineClass}`} />

          {series.map((point, index) => (
            <circle
              key={`${point.label}-${index}`}
              cx={x(index)}
              cy={y(point.value)}
              r={index === series.length - 1 ? 4 : 2.4}
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

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);

    try {
      const response = await fetch(`/api/dashboard?ui_v3=${Date.now()}`, { cache: "no-store" });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.detail || payload?.error || "Dashboard API error");
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
  const windows = (funnel.windows || {}) as Record<string, Record<string, unknown>>;

  const stageRows = useMemo(
    () => (Array.isArray(pipeline.stages) ? (pipeline.stages as Array<Record<string, unknown>>) : []),
    [pipeline],
  );

  const bridgeStage = useMemo(
    () => stageRows.find((stage) => text(stage.name) === "CONFIRMED_BRIDGE"),
    [stageRows],
  );

  const rejectionCounts = useMemo(() => {
    const fromBridgeStage = bridgeStage?.rejection_counts;
    if (fromBridgeStage && typeof fromBridgeStage === "object" && !Array.isArray(fromBridgeStage)) {
      return fromBridgeStage as Record<string, unknown>;
    }
    return {};
  }, [bridgeStage]);

  const topReasons = useMemo(
    () =>
      Object.entries(rejectionCounts)
        .map(([key, value]) => ({ key, value: toNumber(value) ?? 0 }))
        .filter((row) => row.value > 0)
        .sort((a, b) => b.value - a.value)
        .slice(0, 5),
    [rejectionCounts],
  );

  const trades = useMemo(() => {
    const rows = Array.isArray(data?.trades) ? data.trades : [];
    return [...rows].sort((a, b) => tradeTimeValue(b) - tradeTimeValue(a));
  }, [data]);

  const openTrades = useMemo(
    () => trades.filter((trade) => !isFinalTrade(trade) && !tradeState(trade).toUpperCase().includes("WAITING")),
    [trades],
  );

  const waitingTrades = useMemo(
    () => trades.filter((trade) => tradeState(trade).toUpperCase().includes("WAITING")),
    [trades],
  );

  const closedTrades = useMemo(() => trades.filter((trade) => isFinalTrade(trade)), [trades]);

  const uniqueSymbols = useMemo(
    () => Array.from(new Set(trades.map((trade) => text(trade.symbol, "")).filter(Boolean))).sort(),
    [trades],
  );

  const closedAscending = useMemo(
    () => [...closedTrades].sort((a, b) => tradeTimeValue(a) - tradeTimeValue(b)),
    [closedTrades],
  );

  const rCurve = useMemo(() => {
    let cumulative = 0;
    return closedAscending
      .filter((trade) => toNumber(trade.realized_r) !== null)
      .map((trade) => {
        cumulative += toNumber(trade.realized_r) ?? 0;
        return { label: text(trade.symbol), value: cumulative };
      });
  }, [closedAscending]);

  const pnlCurve = useMemo(() => {
    let cumulative = 0;
    return closedAscending
      .filter((trade) => toNumber(trade.pnl_usd) !== null)
      .map((trade) => {
        cumulative += toNumber(trade.pnl_usd) ?? 0;
        return { label: text(trade.symbol), value: cumulative };
      });
  }, [closedAscending]);

  const generatedAt = data?.vps_published_at || data?.generated_at || data?.vercel_ingested_at;
  const generated = generatedAt ? new Date(generatedAt).toLocaleString("ru-RU") : "—";

  const snapshotAgeSeconds =
    generatedAt
      ? Math.max(0, Math.round((Date.now() - new Date(generatedAt).getTime()) / 1000))
      : null;

  const hasLiveData = Boolean(data);
  const refreshWarning = Boolean(error && data);

  const freshness =
    snapshotAgeSeconds === null
      ? "CHECKING"
      : snapshotAgeSeconds <= 180
        ? "LIVE"
        : snapshotAgeSeconds <= 600
          ? "DELAYED"
          : "STALE";

  const apiState =
    data
      ? refreshWarning
        ? "DELAYED"
        : "ONLINE"
      : error
        ? "OFFLINE"
        : "CHECKING";
  const health = text(pipeline.pipeline_health || quality.pipeline_health, "UNKNOWN");
  const review = text(quality.review_state, "COLLECTING");
  const reviewReason = text(quality.review_reason, "—");

  const realOff = safety.real_trades === false && quality.real_submit === false;
  const demoOff = safety.demo_submit === false && quality.demo_submit === false;
  const orderOff = safety.order_action === false && quality.order_action === false;

  const systemWorks =
    hasLiveData && (freshness === "LIVE" || freshness === "DELAYED");

  const understandableSummary =
    trades.length > 0
      ? `Система уже записала ${trades.length} сделок в clean cohort.`
      : "Система работает, но clean cohort пока ещё набирает статистику.";

  const statusTitle =
    !data && !error
      ? "Проверяем подключение…"
      : systemWorks && !refreshWarning
        ? "Да, сайт работает"
        : data && refreshWarning
          ? "Данные есть, обновление задержалось"
          : data
            ? "Последний snapshot доступен"
            : "Сайт временно не получает данные";

  const statusDescription =
    !data && !error
      ? "Подключаемся к live API и загружаем последний snapshot. Обычно это занимает несколько секунд."
      : data && refreshWarning
        ? `${understandableSummary} Последняя попытка автообновления задержалась, но предыдущий snapshot сохранён на экране.`
        : error
          ? `Не удалось получить первый snapshot: ${error}`
          : understandableSummary;

  return (
    <main className="shell">
      <header className="topbar">
        <div className="topbar-copy">
          <div className="eyebrow">BROM / ALPHA</div>
          <h1>Intraday Dashboard</h1>
          <p>
            Понятный live dashboard: видно, работает ли стратегия сейчас, собирается ли статистика,
            какие есть результаты и почему пока может не быть сделок.
          </p>
        </div>

        <div className="topbar-right">
          <div className="topbar-pills">
            <span className={`pill ${statusClass(freshness)}`}>{friendlyStatus(freshness)}</span>
            <span className={`pill ${statusClass(health)}`}>{friendlyStatus(health)}</span>
            <span className="pill neutral">{friendlyStatus(data?.mode || "PAPER_ONLY")}</span>
          </div>

          <button onClick={load} disabled={refreshing}>
            {refreshing ? "Обновление…" : "Обновить"}
          </button>

          <div className="updated">
            Snapshot: {generated}
            {snapshotAgeSeconds !== null ? ` · ${snapshotAgeSeconds}s назад` : ""}
          </div>
        </div>
      </header>

      <nav className="page-nav" aria-label="Разделы dashboard">
        <a href="#overview">Сводка</a>
        <a href="#performance">Результаты</a>
        <a href="#system">Система</a>
        <a href="#activity">Рынок</a>
        <a href="#trades">Сделки</a>
      </nav>

      <section className="hero-status-grid" id="overview">
        <div className="card hero-main">
          <div className="eyebrow">С ПЕРВОГО ВЗГЛЯДА</div>
          <h2>{statusTitle}</h2>
          <p className="hero-main-copy">{statusDescription}</p>

          <div className="hero-badges">
            <span className={`big-pill ${statusClass(apiState)}`}>
              <span className="status-dot" aria-hidden="true" />
              {friendlyStatus(apiState)}
            </span>
            <span className={`big-pill ${statusClass(freshness)}`}>{friendlyStatus(freshness)}</span>
            <span className={`big-pill ${realOff ? "good" : "bad"}`}>REAL {realOff ? "OFF" : "CHECK"}</span>
            <span className={`big-pill ${demoOff ? "good" : "bad"}`}>DEMO {demoOff ? "OFF" : "CHECK"}</span>
            <span className={`big-pill ${orderOff ? "good" : "bad"}`}>ORDERS {orderOff ? "OFF" : "CHECK"}</span>
          </div>

          <div className="hero-quick-grid">
            <div>
              <span>Последнее обновление</span>
              <strong>{generated}</strong>
            </div>
            <div>
              <span>Статус статистики</span>
              <strong>{review}</strong>
            </div>
            <div>
              <span>Прогресс quality gate</span>
              <strong>{n(sample.decisive, 0)}/30</strong>
            </div>
          </div>
        </div>

        <div className="card hero-side">
          <div className="eyebrow">ЧТО ЭТО ЗНАЧИТ</div>
          <h2>Простыми словами</h2>

          <div className="simple-list">
            <div className="simple-item">
              <strong>1. Стратегия ищет возможности</strong>
              <span>Система смотрит монеты и фильтрует только чистые сценарии.</span>
            </div>
            <div className="simple-item">
              <strong>2. Сейчас идёт сбор статистики</strong>
              <span>Пока не накоплено 30 решённых сделок, поэтому это этап проверки качества.</span>
            </div>
            <div className="simple-item">
              <strong>3. Реальная торговля выключена</strong>
              <span>Этот dashboard ничего не отправляет на биржу и не открывает сделки.</span>
            </div>
          </div>
        </div>
      </section>

      <section className="metrics-grid">
        <Card
          label="Сделки в ожидании"
          value={n(waitingTrades.length || summary.waiting_entry, 0)}
          hint="Ждут входа"
        />
        <Card
          label="Открытые сделки"
          value={n(openTrades.length || summary.active_filled, 0)}
          hint="Уже в рынке"
        />
        <Card
          label="Закрытые сделки"
          value={n(closedTrades.length || summary.closed, 0)}
          hint="Есть итог TP/SL"
        />
        <Card
          label="Net PnL"
          value={money(summary.hypothetical_net_pnl_usd)}
          hint={`${signed(summary.net_r, 3)}R cumulative`}
        />
        <Card
          label="Win rate"
          value={pct(summary.win_rate_pct)}
          hint={`${n(summary.wins, 0)} побед / ${n(summary.losses, 0)} стопов`}
        />
        <Card
          label="Монеты в истории"
          value={n(uniqueSymbols.length, 0)}
          hint={uniqueSymbols.length ? uniqueSymbols.slice(0, 3).join(", ") : "Пока пусто"}
        />
      </section>

      <section className="chart-grid" id="performance">
        <CurveChart
          eyebrow="PERFORMANCE / R"
          title="Cumulative R"
          description="Суммарный результат в R по уже закрытым clean paper-сделкам."
          points={rCurve}
          suffix="R"
          digits={3}
        />

        <CurveChart
          eyebrow="PAPER PERFORMANCE"
          title="Equity curve"
          description="Гипотетический cumulative PnL по paper-истории. Это не баланс реального счёта."
          points={pnlCurve}
          suffix=" USD"
          digits={2}
        />
      </section>

      <section className="two-col" id="system">
        <PlainCard eyebrow="ПОЧЕМУ ПОКА МОЖЕТ БЫТЬ ПУСТО" title="Почему нет сделок">
          <div className="why-grid">
            <div className="why-card">
              <span>Статус quality gate</span>
              <strong>{review}</strong>
              <p>{reviewReason}</p>
            </div>

            <div className="why-card">
              <span>Подходящих после clean-запуска</span>
              <strong>{n(funnel.eligible_since_activation, 0)}</strong>
              <p>Сколько сигналов реально дошло до стадии “подходит”.</p>
            </div>
          </div>

          {topReasons.length ? (
            <div className="reason-list">
              {topReasons.map((reason) => (
                <div className="reason-row" key={reason.key}>
                  <span>{reasonLabel(reason.key)}</span>
                  <strong>{n(reason.value, 0)}</strong>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-inline">
              Пока нет накопленных причин отклонения в текущем snapshot.
            </div>
          )}
        </PlainCard>

        <PlainCard eyebrow="ТЕХНИЧЕСКОЕ СОСТОЯНИЕ" title="Работает ли система">
          <div className="health-grid">
            <div className="health-item">
              <span>API</span>
              <strong className={statusClass(apiState)}>{friendlyStatus(apiState)}</strong>
            </div>
            <div className="health-item">
              <span>Свежесть данных</span>
              <strong className={statusClass(freshness)}>{friendlyStatus(freshness)}</strong>
            </div>
            <div className="health-item">
              <span>Pipeline</span>
              <strong className={statusClass(health)}>{friendlyStatus(health)}</strong>
            </div>
            <div className="health-item">
              <span>Режим</span>
              <strong>{friendlyStatus(data?.mode || "PAPER_ONLY")}</strong>
            </div>
          </div>

          <details className="tech-details">
            <summary>Показать технические этапы</summary>

            <div className="stage-list">
              {stageRows.length ? (
                stageRows.map((stage, index) => (
                  <div className="stage" key={`${text(stage.name)}-${index}`}>
                    <span>{stageLabel(stage.name)}</span>
                    <span className={`pill ${statusClass(stage.status)}`}>{friendlyStatus(stage.status)}</span>
                    <span className="subtle">{n(stage.age_seconds, 0)}s</span>
                  </div>
                ))
              ) : (
                <div className="empty-inline">Пока нет данных по техническим этапам.</div>
              )}
            </div>
          </details>
        </PlainCard>
      </section>

      <section className="two-col" id="activity">
        <PlainCard eyebrow="АКТИВНОСТЬ СТРАТЕГИИ" title="Что фильтр видит по рынку">
          {["1h", "6h", "24h"].map((windowName) => {
            const row = windows[windowName] || {};

            return (
              <div className="funnel-row" key={windowName}>
                <strong>{windowName}</strong>
                <span>Найдено: {n(row.source_rows, 0)}</span>
                <span>HTF ок: {n(row.htf_ok, 0)}</span>
                <span>Объём ок: {n(row.volume_ok, 0)}</span>
                <span className="accent">RR3: {n(row.rr_3_ready, 0)}</span>
              </div>
            );
          })}
          <div className="note">
            Это не сделки, а этапы фильтрации: сколько идей система нашла и сколько из них дошло дальше.
          </div>
        </PlainCard>

        <PlainCard eyebrow="МОНЕТЫ" title="Монеты и история">
          {uniqueSymbols.length ? (
            <div className="symbol-chip-wrap">
              {uniqueSymbols.map((symbol) => (
                <span className="symbol-chip" key={symbol}>{symbol}</span>
              ))}
            </div>
          ) : (
            <div className="empty-inline">
              Пока нет монет в clean paper-истории. После первой сделки они появятся здесь.
            </div>
          )}

          <div className="note">
            Здесь будет короткий список монет, которые уже попали в историю стратегии.
          </div>
        </PlainCard>
      </section>

      <section className="card section-card" id="trades">
        <div className="section-head">
          <div>
            <div className="eyebrow">ИСТОРИЯ СДЕЛОК</div>
            <h2>Понятная история сделок</h2>
            <p className="section-description">
              Без лишнего шума: монета, статус, время и сухой результат.
            </p>
          </div>
          <span className="subtle">Обновление каждые 15 секунд</span>
        </div>

        {initialLoading && !data ? (
          <div className="empty">Загружаю live snapshot…</div>
        ) : trades.length ? (
          <>
            <div className="table-wrap desktop-trades">
              <table>
                <thead>
                  <tr>
                    <th>Монета</th>
                    <th>Направление</th>
                    <th>Статус</th>
                    <th>Время</th>
                    <th>Результат (R)</th>
                    <th>Результат (USD)</th>
                    <th>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.map((trade, index) => (
                    <TradeRow
                      key={text(trade.id, `${text(trade.symbol)}-${tradeTimeValue(trade)}-${index}`)}
                      trade={trade}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mobile-trades">
              {trades.map((trade, index) => (
                <TradeMobileCard
                  key={text(trade.id, `${text(trade.symbol)}-${tradeTimeValue(trade)}-${index}`)}
                  trade={trade}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="empty empty-state">
            <strong>История сделок пока пустая.</strong>
            <span>
              Это нормально для этапа <b>{review}</b>. Система работает, но ещё накапливает чистую статистику.
            </span>
          </div>
        )}
      </section>

      <footer>
        BROM Alpha · понятный paper dashboard · real/demo submit выключены · ссылку можно использовать как live-статус стратегии
      </footer>
    </main>
  );
}
