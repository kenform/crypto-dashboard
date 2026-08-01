"use client";

import DashboardNav from "@/components/DashboardNav";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

const REFRESH_MS = 15_000;

type CopySummary = {
  starting_balance_usd?: number | null;
  balance_usd?: number | null;
  equity_usd?: number | null;
  realized_pnl_usd?: number | null;
  unrealized_pnl_usd?: number | null;
  total_return_pct?: number | null;
  open_positions?: number | null;
  closed_positions?: number | null;
  wins?: number | null;
  losses?: number | null;
  win_rate_pct?: number | null;
};

type CopyPosition = {
  id?: string;
  lifecycle?: string;
  trader?: string | null;
  symbol?: string | null;
  side?: string | null;
  entry_price?: number | null;
  current_price?: number | null;
  exit_price?: number | null;
  quantity?: number | null;
  leverage?: number | null;
  allocation_pct?: number | null;
  realized_pnl_usd?: number | null;
  unrealized_pnl_usd?: number | null;
  return_pct?: number | null;
  opened_at?: string | null;
  closed_at?: string | null;
};

type CopyQuality = {
  collector_status?: string | null;
  selected_traders?: number | null;
  monitor_eligible?: number | null;
  visible_positions?: number | null;
  hidden_positions?: number | null;
  truncated_traders?: number | null;
  endpoint_failures?: number | null;
};

type CopytraderData = {
  status?: string | null;
  mode?: string | null;
  exchange?: string | null;
  generated_at?: string | null;
  summary?: CopySummary;
  open_positions?: CopyPosition[];
  closed_positions?: CopyPosition[];
  data_quality?: CopyQuality;
  sample_warning?: string | null;
  minimum_closed_for_review?: number | null;
};

type DashboardResponse = {
  generated_at?: string | null;
  vps_published_at?: string | null;
  vercel_ingested_at?: string | null;
  copytrader?: CopytraderData;
  error?: string;
  detail?: string;
};

const panel = {
  border:
    "1px solid rgba(148, 163, 184, 0.18)",
  borderRadius: "16px",
  background:
    "rgba(15, 23, 42, 0.58)",
  padding: "16px",
} as const;

function finite(
  value: unknown,
): number | null {
  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return value;
  }

  return null;
}

function n(
  value: unknown,
  digits = 2,
): string {
  const parsed = finite(value);

  if (parsed === null) {
    return "—";
  }

  return parsed.toLocaleString(
    "ru-RU",
    {
      maximumFractionDigits: digits,
    },
  );
}

function money(
  value: unknown,
): string {
  const parsed = finite(value);

  if (parsed === null) {
    return "—";
  }

  return `${parsed > 0 ? "+" : ""}${n(
    parsed,
    2,
  )} USD`;
}

function percent(
  value: unknown,
): string {
  const parsed = finite(value);

  if (parsed === null) {
    return "—";
  }

  return `${parsed > 0 ? "+" : ""}${n(
    parsed,
    3,
  )}%`;
}

function valueColor(
  value: unknown,
): string | undefined {
  const parsed = finite(value);

  if (parsed === null || parsed === 0) {
    return undefined;
  }

  return parsed > 0
    ? "#5eead4"
    : "#fda4af";
}

function PositionTable({
  title,
  positions,
  closed,
}: {
  title: string;
  positions: CopyPosition[];
  closed: boolean;
}) {
  return (
    <section
      style={{
        marginTop: "22px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent:
            "space-between",
          gap: "12px",
          marginBottom: "10px",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: "18px",
          }}
        >
          {title}
        </h2>

        <span
          style={{
            fontSize: "11px",
            opacity: 0.58,
          }}
        >
          Записей: {positions.length}
        </span>
      </div>

      <div
        style={{
          overflowX: "auto",
          border:
            "1px solid rgba(148, 163, 184, 0.18)",
          borderRadius: "16px",
          background:
            "rgba(15, 23, 42, 0.46)",
        }}
      >
        <table
          style={{
            width: "100%",
            minWidth: "930px",
            borderCollapse: "collapse",
            fontSize: "12px",
          }}
        >
          <thead>
            <tr
              style={{
                textAlign: "left",
                opacity: 0.66,
              }}
            >
              {[
                "Трейдер",
                "Монета",
                "Сторона",
                "Entry",
                closed
                  ? "Exit"
                  : "Current",
                closed
                  ? "Realized PnL"
                  : "Unrealized PnL",
                "Return",
                "Время",
              ].map((label) => (
                <th
                  key={label}
                  style={{
                    padding: "12px",
                    whiteSpace: "nowrap",
                    borderBottom:
                      "1px solid rgba(148, 163, 184, 0.15)",
                  }}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {positions.length ? (
              positions.map(
                (position, index) => {
                  const pnl = closed
                    ? position.realized_pnl_usd
                    : position.unrealized_pnl_usd;

                  return (
                    <tr
                      key={
                        position.id ||
                        `${position.symbol}-${index}`
                      }
                    >
                      <td
                        style={{
                          padding: "12px",
                          borderBottom:
                            "1px solid rgba(148, 163, 184, 0.08)",
                        }}
                      >
                        {position.trader ||
                          "—"}
                      </td>

                      <td
                        style={{
                          padding: "12px",
                          fontWeight: 800,
                          borderBottom:
                            "1px solid rgba(148, 163, 184, 0.08)",
                        }}
                      >
                        {position.symbol ||
                          "—"}
                      </td>

                      <td
                        style={{
                          padding: "12px",
                          borderBottom:
                            "1px solid rgba(148, 163, 184, 0.08)",
                        }}
                      >
                        {position.side ||
                          "—"}
                      </td>

                      <td
                        style={{
                          padding: "12px",
                          borderBottom:
                            "1px solid rgba(148, 163, 184, 0.08)",
                        }}
                      >
                        {n(
                          position.entry_price,
                          8,
                        )}
                      </td>

                      <td
                        style={{
                          padding: "12px",
                          borderBottom:
                            "1px solid rgba(148, 163, 184, 0.08)",
                        }}
                      >
                        {n(
                          closed
                            ? position.exit_price
                            : position.current_price,
                          8,
                        )}
                      </td>

                      <td
                        style={{
                          padding: "12px",
                          fontWeight: 800,
                          color:
                            valueColor(pnl),
                          borderBottom:
                            "1px solid rgba(148, 163, 184, 0.08)",
                        }}
                      >
                        {money(pnl)}
                      </td>

                      <td
                        style={{
                          padding: "12px",
                          color:
                            valueColor(
                              position.return_pct,
                            ),
                          borderBottom:
                            "1px solid rgba(148, 163, 184, 0.08)",
                        }}
                      >
                        {percent(
                          position.return_pct,
                        )}
                      </td>

                      <td
                        style={{
                          padding: "12px",
                          whiteSpace: "nowrap",
                          opacity: 0.64,
                          borderBottom:
                            "1px solid rgba(148, 163, 184, 0.08)",
                        }}
                      >
                        {closed
                          ? position.closed_at ||
                            "—"
                          : position.opened_at ||
                            "—"}
                      </td>
                    </tr>
                  );
                },
              )
            ) : (
              <tr>
                <td
                  colSpan={8}
                  style={{
                    padding: "24px",
                    textAlign: "center",
                    opacity: 0.55,
                  }}
                >
                  Пока данных нет
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function CopytraderDashboard() {
  const [data, setData] =
    useState<DashboardResponse | null>(
      null,
    );

  const [error, setError] =
    useState<string | null>(null);

  const [refreshing, setRefreshing] =
    useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);

    try {
      const response = await fetch(
        `/api/dashboard?copytrader=${Date.now()}`,
        {
          cache: "no-store",
        },
      );

      const body =
        (await response.json()) as DashboardResponse;

      if (!response.ok) {
        throw new Error(
          body.detail ||
            body.error ||
            "Ошибка CopyTrader API",
        );
      }

      setData(body);
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
    void load();

    const timer = window.setInterval(
      () => {
        void load();
      },
      REFRESH_MS,
    );

    return () =>
      window.clearInterval(timer);
  }, [load]);

  const copytrader =
    data?.copytrader;

  const summary =
    copytrader?.summary || {};

  const quality =
    copytrader?.data_quality || {};

  const openPositions = useMemo(
    () =>
      copytrader?.open_positions ||
      [],
    [copytrader],
  );

  const closedPositions = useMemo(
    () =>
      copytrader?.closed_positions ||
      [],
    [copytrader],
  );

  const cards = [
    {
      label: "Старт",
      value: money(
        summary.starting_balance_usd,
      ),
    },
    {
      label: "Balance",
      value: money(
        summary.balance_usd,
      ),
    },
    {
      label: "Equity",
      value: money(
        summary.equity_usd,
      ),
    },
    {
      label: "Realized PnL",
      value: money(
        summary.realized_pnl_usd,
      ),
      color:
        valueColor(
          summary.realized_pnl_usd,
        ),
    },
    {
      label: "Unrealized PnL",
      value: money(
        summary.unrealized_pnl_usd,
      ),
      color:
        valueColor(
          summary.unrealized_pnl_usd,
        ),
    },
    {
      label: "Total return",
      value: percent(
        summary.total_return_pct,
      ),
      color:
        valueColor(
          summary.total_return_pct,
        ),
    },
    {
      label: "Открыто",
      value: n(
        summary.open_positions ??
          openPositions.length,
        0,
      ),
    },
    {
      label: "Закрыто",
      value: n(
        summary.closed_positions ??
          closedPositions.length,
        0,
      ),
    },
    {
      label: "Win rate",
      value: percent(
        summary.win_rate_pct,
      ),
    },
  ];

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">
            OKX · PAPER ONLY
          </p>

          <h1>
            CopyTrader Dashboard
          </h1>

          <p className="dashboard-subtitle">
            Shadow-проверка публичных сделок.
            Это не реальные биржевые исполнения
            и не разрешение переходить на live.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void load()}
          disabled={refreshing}
          className="refresh-button"
        >
          {refreshing
            ? "Обновление..."
            : "Обновить"}
        </button>
      </header>

      <DashboardNav active="copytrader" />

      {error ? (
        <section
          style={{
            ...panel,
            marginTop: "18px",
            borderColor:
              "rgba(251, 113, 133, 0.45)",
          }}
        >
          Ошибка: {error}
        </section>
      ) : null}

      <section
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(170px, 1fr))",
          gap: "12px",
          marginTop: "18px",
        }}
      >
        {cards.map((card) => (
          <article
            key={card.label}
            style={panel}
          >
            <div
              style={{
                fontSize: "11px",
                opacity: 0.58,
              }}
            >
              {card.label}
            </div>

            <div
              style={{
                marginTop: "7px",
                fontSize: "21px",
                fontWeight: 800,
                color: card.color,
              }}
            >
              {card.value}
            </div>
          </article>
        ))}
      </section>

      <section
        style={{
          ...panel,
          marginTop: "18px",
        }}
      >
        <h2
          style={{
            margin: "0 0 12px",
            fontSize: "17px",
          }}
        >
          Качество источника
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "12px",
            fontSize: "13px",
          }}
        >
          <div>
            Статус:{" "}
            <strong>
              {quality.collector_status ||
                copytrader?.status ||
                "—"}
            </strong>
          </div>

          <div>
            Выбрано трейдеров:{" "}
            <strong>
              {n(
                quality.selected_traders,
                0,
              )}
            </strong>
          </div>

          <div>
            Допущено:{" "}
            <strong>
              {n(
                quality.monitor_eligible,
                0,
              )}
            </strong>
          </div>

          <div>
            Видимых позиций:{" "}
            <strong>
              {n(
                quality.visible_positions,
                0,
              )}
            </strong>
          </div>

          <div>
            Скрытых позиций:{" "}
            <strong>
              {n(
                quality.hidden_positions,
                0,
              )}
            </strong>
          </div>

          <div>
            Truncated traders:{" "}
            <strong>
              {n(
                quality.truncated_traders,
                0,
              )}
            </strong>
          </div>

          <div>
            Endpoint failures:{" "}
            <strong>
              {n(
                quality.endpoint_failures,
                0,
              )}
            </strong>
          </div>
        </div>
      </section>

      {copytrader?.sample_warning ? (
        <section
          style={{
            ...panel,
            marginTop: "18px",
            borderColor:
              "rgba(251, 191, 36, 0.45)",
            background:
              "rgba(120, 53, 15, 0.15)",
          }}
        >
          <strong>
            Выборка недостаточна для live.
          </strong>

          <p
            style={{
              margin: "7px 0 0",
              lineHeight: 1.5,
              opacity: 0.74,
            }}
          >
            Закрыто только{" "}
            {n(
              summary.closed_positions,
              0,
            )}{" "}
            сделок. Минимальный порог первого
            исследования:{" "}
            {n(
              copytrader.minimum_closed_for_review,
              0,
            )}.
          </p>
        </section>
      ) : null}

      <PositionTable
        title="Открытые PAPER-позиции"
        positions={openPositions}
        closed={false}
      />

      <PositionTable
        title="Закрытые PAPER-позиции"
        positions={closedPositions}
        closed
      />

      <footer
        style={{
          marginTop: "22px",
          fontSize: "11px",
          opacity: 0.5,
        }}
      >
        Snapshot:{" "}
        {copytrader?.generated_at ||
          data?.vps_published_at ||
          data?.generated_at ||
          "—"}
      </footer>
    </main>
  );
}
