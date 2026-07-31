"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import DashboardNav from "@/components/DashboardNav";

type ValueMap = Record<string, unknown>;

type Props = {
  id: string;
};

function n(value: unknown, digits = 8): string {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return "—";
  }

  return value.toLocaleString("ru-RU", {
    maximumFractionDigits: digits,
  });
}

function formatTime(value: unknown): string {
  if (!value) return "—";

  const date = new Date(String(value));

  if (!Number.isFinite(date.getTime())) return "—";

  return date.toLocaleString("ru-RU");
}

export default function JournalTrade({
  id,
}: Props) {
  const [record, setRecord] =
    useState<ValueMap | null>(null);

  const load = useCallback(async () => {
    const response = await fetch(
      `/api/dashboard?journal_trade=${Date.now()}`,
      { cache: "no-store" },
    );

    const body = await response.json();

    const rows =
      body?.journal?.records || [];

    setRecord(
      rows.find(
        (row: ValueMap) =>
          String(row.id) === decodeURIComponent(id),
      ) || null,
    );
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (!record) {
    return (
      <main className="shell">
        <DashboardNav active="journal" />

        <div className="card section-card">
          Сделка не найдена или ещё не опубликована.
        </div>
      </main>
    );
  }

  const lifecycle = Array.isArray(record.lifecycle)
    ? record.lifecycle as ValueMap[]
    : [];

  return (
    <main className="shell">
      <DashboardNav active="journal" />

      <a className="back-link" href="/journal">
        ← Назад в дневник
      </a>

      <header className="trade-page-header">
        <div>
          <div className="eyebrow">
            {String(record.source || "TRADE")}
          </div>

          <h1>
            {String(record.symbol || "—")}
            {" "}
            {String(record.side || "")}
          </h1>

          <p>
            {String(record.reason || "—")}
          </p>
        </div>

        <span className="pill neutral">
          {String(
            record.outcome ||
            record.state ||
            "UNKNOWN",
          )}
        </span>
      </header>

      <section className="trade-page-grid">
        {[
          ["Entry", n(record.entry)],
          ["Stop Loss", n(record.sl)],
          ["Take Profit", n(record.tp)],
          ["RR", `${n(record.rr, 2)}R`],
          ["Score", n(record.score, 1)],
          ["Risk", `${n(record.risk_usd, 2)} USD`],
          ["PnL", `${n(record.pnl_usd, 2)} USD`],
          ["Result R", `${n(record.realized_r, 3)}R`],
          ["Создана", formatTime(record.created_at)],
          ["Открыта", formatTime(record.opened_at)],
          ["Закрыта", formatTime(record.closed_at)],
        ].map(([label, value]) => (
          <div key={label} className="card trade-page-field">
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </section>

      {lifecycle.length ? (
        <section className="card section-card">
          <div className="section-head">
            <div>
              <div className="eyebrow">
                LIFECYCLE
              </div>
              <h2>Жизненный цикл сделки</h2>
            </div>
          </div>

          <div className="trade-lifecycle lifecycle-page">
            {lifecycle.map((stage, index) => (
              <div
                key={index}
                className={`lifecycle-stage ${
                  stage.status === "DONE"
                    ? "lifecycle-done"
                    : "lifecycle-waiting"
                }`}
              >
                <span className="lifecycle-dot" />

                <div>
                  <strong>
                    {String(stage.label || stage.stage)}
                  </strong>

                  <small>
                    {formatTime(stage.time)}
                  </small>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
