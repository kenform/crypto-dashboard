"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { DashboardData, Trade } from "@/lib/types";

const REFRESH_MS = 15_000;

function n(value: unknown, digits = 2): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return value.toLocaleString("ru-RU", { maximumFractionDigits: digits });
}

function pct(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value) ? `${n(value, 2)}%` : "—";
}

function statusClass(value: string): string {
  const v = value.toUpperCase();
  if (["HEALTHY", "PASS", "TP", "REVIEW_READY", "OPEN"].includes(v)) return "good";
  if (["COLLECTING", "WAITING_ENTRY", "OBSERVING_CLEAN_COHORT"].includes(v)) return "warn";
  if (["SL", "DEGRADED", "REJECTED_BY_SAMPLE", "ERROR"].includes(v)) return "bad";
  return "neutral";
}

function Card({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="card metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      {hint ? <div className="metric-hint">{hint}</div> : null}
    </div>
  );
}

function TradeRow({ trade }: { trade: Trade }) {
  const r = trade.realized_r ?? trade.unrealized_r;
  return (
    <tr>
      <td><strong>{trade.symbol}</strong><div className="subtle">{trade.side}</div></td>
      <td><span className={`pill ${statusClass(trade.state)}`}>{trade.state}</span></td>
      <td>{n(trade.entry, 8)}</td>
      <td>{n(trade.current_price, 8)}</td>
      <td>{n(trade.sl, 8)}</td>
      <td>{n(trade.tp, 8)}</td>
      <td className={typeof r === "number" ? (r >= 0 ? "positive" : "negative") : ""}>{n(r, 3)}R</td>
      <td className={typeof trade.pnl_usd === "number" ? (trade.pnl_usd >= 0 ? "positive" : "negative") : ""}>${n(trade.pnl_usd, 2)}</td>
      <td>{trade.score == null ? "—" : n(trade.score, 1)}</td>
    </tr>
  );
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/dashboard", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.detail || payload?.error || "Dashboard API error");
      setData(payload);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  const summary = (data?.summary || {}) as Record<string, unknown>;
  const quality = (data?.quality || {}) as Record<string, unknown>;
  const sample = ((quality.sample || {}) as Record<string, unknown>);
  const pipeline = (data?.pipeline || {}) as Record<string, unknown>;
  const funnel = (data?.funnel || {}) as Record<string, unknown>;
  const windows = ((funnel.windows || {}) as Record<string, Record<string, unknown>>);

  const trades = useMemo(() => {
    const rows = data?.trades || [];
    const order: Record<string, number> = { OPEN: 0, WAITING_ENTRY: 1, TP: 2, SL: 3, EXPIRED_UNFILLED: 4 };
    return [...rows].sort((a, b) => (order[a.state] ?? 9) - (order[b.state] ?? 9));
  }, [data]);

  const generated = data?.generated_at ? new Date(data.generated_at).toLocaleString("ru-RU") : "—";
  const health = String(pipeline.pipeline_health || quality.pipeline_health || "UNKNOWN");
  const review = String(quality.review_state || "COLLECTING");

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">BROM / ALPHA</div>
          <h1>Intraday Dashboard</h1>
          <p>Подтверждённые paper-сделки, PnL и здоровье торговой цепочки.</p>
        </div>
        <div className="topbar-right">
          <span className={`pill ${statusClass(health)}`}>{health}</span>
          <button onClick={load} disabled={loading}>{loading ? "Обновление…" : "Обновить"}</button>
          <div className="updated">Обновлено: {generated}</div>
        </div>
      </header>

      {error ? <div className="error-banner">API: {error}</div> : null}

      <section className="metrics-grid">
        <Card label="Режим" value={data?.mode || "PAPER ONLY"} hint="Реальные и демо-ордера выключены" />
        <Card label="Quality gate" value={<span className={statusClass(review)}>{review}</span>} hint={`${n(sample.decisive, 0)}/30 решённых сделок`} />
        <Card label="Net PnL" value={`${n(summary.hypothetical_net_pnl_usd, 2)} USD`} hint={`${n(summary.net_r, 3)}R`} />
        <Card label="Expectancy" value={`${n(summary.expectancy_r, 3)}R`} hint={`Profit factor: ${n(summary.profit_factor, 2)}`} />
        <Card label="Win rate" value={pct(summary.win_rate_pct)} hint={`${n(summary.wins, 0)} TP / ${n(summary.losses, 0)} SL`} />
        <Card label="Сделки" value={n(summary.candidates, 0)} hint={`${n(summary.waiting_entry, 0)} ждут / ${n(summary.active_filled, 0)} открыты / ${n(summary.closed, 0)} закрыты`} />
      </section>

      <section className="card section-card">
        <div className="section-head">
          <div><div className="eyebrow">LIVE / PAPER</div><h2>Сделки и PnL</h2></div>
          <span className="subtle">Автообновление каждые 15 секунд</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Монета</th><th>Статус</th><th>Entry</th><th>Цена</th><th>SL</th><th>TP</th><th>PnL R</th><th>PnL USD</th><th>Score</th></tr></thead>
            <tbody>
              {trades.length ? trades.map((trade) => <TradeRow key={trade.id} trade={trade} />) : <tr><td colSpan={9} className="empty">Новых подтверждённых paper-сделок пока нет.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="two-col">
        <div className="card section-card">
          <div className="section-head"><div><div className="eyebrow">FILTER FLOW</div><h2>Воронка сигналов</h2></div></div>
          {["1h", "6h", "24h"].map((windowName) => {
            const row = windows[windowName] || {};
            return <div className="funnel-row" key={windowName}>
              <strong>{windowName}</strong>
              <span>SHORT {n(row.short, 0)}</span>
              <span>HTF {n(row.htf_ok, 0)}</span>
              <span>Volume {n(row.volume_ok, 0)}</span>
              <span className="accent">RR3 {n(row.rr_3_ready, 0)}</span>
            </div>;
          })}
          <div className="note">После чистого запуска: {n(funnel.eligible_since_activation, 0)} подходящих.</div>
        </div>

        <div className="card section-card">
          <div className="section-head"><div><div className="eyebrow">SYSTEM</div><h2>Здоровье цепочки</h2></div></div>
          <div className="stage-list">
            {Array.isArray(pipeline.stages) && pipeline.stages.length ? pipeline.stages.map((stage: any) => (
              <div className="stage" key={stage.name}>
                <span>{stage.name}</span>
                <span className={`pill ${statusClass(String(stage.status))}`}>{stage.status}</span>
                <span className="subtle">{n(stage.age_seconds, 0)}s</span>
              </div>
            )) : <div className="empty">Нет данных watchdog.</div>}
          </div>
        </div>
      </section>

      <footer>Только paper/research. Dashboard не умеет выставлять ордера.</footer>
    </main>
  );
}
