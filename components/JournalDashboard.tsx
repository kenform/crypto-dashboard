"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import DashboardNav from "@/components/DashboardNav";

type JournalRecord = {
  id?: string;
  source?: string;
  symbol?: string;
  side?: string;
  state?: string;
  outcome?: string | null;
  score?: number | null;
  pnl_usd?: number | null;
  realized_r?: number | null;
  created_at?: string | null;
  opened_at?: string | null;
  closed_at?: string | null;
  reason?: string | null;
};

function formatTime(value: unknown): string {
  if (!value) return "—";

  const date = new Date(String(value));

  if (!Number.isFinite(date.getTime())) return "—";

  return date.toLocaleString("ru-RU");
}

function sideClass(value: unknown): string {
  const side = String(value || "").toUpperCase();

  if (side === "LONG") return "ticker-long";
  if (side === "SHORT") return "ticker-short";

  return "";
}

export default function JournalDashboard() {
  const [records, setRecords] =
    useState<JournalRecord[]>([]);

  const [filter, setFilter] =
    useState("ALL");

  const load = useCallback(async () => {
    const response = await fetch(
      `/api/dashboard?journal=${Date.now()}`,
      { cache: "no-store" },
    );

    const body = await response.json();

    setRecords(
      body?.journal?.records || [],
    );
  }, []);

  useEffect(() => {
    load();

    const timer = window.setInterval(
      load,
      15_000,
    );

    return () => window.clearInterval(timer);
  }, [load]);

  const visible = useMemo(
    () =>
      filter === "ALL"
        ? records
        : records.filter(
            (record) => record.source === filter,
          ),
    [records, filter],
  );

  return (
    <main className="shell">
      <header className="topbar">
        <div className="topbar-copy">
          <div className="eyebrow">
            BROM / TRADE JOURNAL
          </div>

          <h1>Дневник сделок</h1>

          <p>
            Intraday, Scalp и реальные сделки MTT
            с подробными параметрами.
          </p>
        </div>
      </header>

      <DashboardNav active="journal" />

      <div className="journal-filters">
        {[
          ["ALL", "Все"],
          ["MTT_REAL", "MTT Real"],
          ["ALPHA_INTRADAY", "Intraday"],
          ["ALPHA_SCALP", "Scalp"],
        ].map(([value, label]) => (
          <button
            key={value}
            className={
              filter === value
                ? "journal-filter-active"
                : ""
            }
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>

      <section className="card section-card">
        <div className="section-head">
          <div>
            <div className="eyebrow">
              HISTORY
            </div>

            <h2>Все записи</h2>

            <p className="section-description">
              Нажмите на сделку для полной страницы.
            </p>
          </div>

          <span className="subtle">
            Записей: {visible.length}
          </span>
        </div>

        {visible.length ? (
          <div className="journal-list">
            {visible.map((record, index) => (
              <a
                key={record.id || index}
                className="journal-row"
                href={`/journal/${encodeURIComponent(
                  record.id || "",
                )}`}
              >
                <div>
                  <strong
                    className={sideClass(record.side)}
                  >
                    {record.symbol || "—"}
                  </strong>

                  <span>
                    {record.side || "—"} ·
                    {" "}
                    {record.source || "—"}
                  </span>
                </div>

                <div>
                  <strong>
                    {record.outcome ||
                      record.state ||
                      "—"}
                  </strong>

                  <span>
                    {formatTime(
                      record.closed_at ||
                      record.opened_at ||
                      record.created_at,
                    )}
                  </span>
                </div>

                <div>
                  <strong>
                    Score {record.score ?? "—"}
                  </strong>

                  <span>
                    {record.reason || "—"}
                  </span>
                </div>

                <span className="journal-arrow">→</span>
              </a>
            ))}
          </div>
        ) : (
          <div className="empty-inline">
            В выбранном разделе пока нет сделок.
          </div>
        )}
      </section>
    </main>
  );
}
