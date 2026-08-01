"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import DashboardNav from "@/components/DashboardNav";

type Summary = {
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

type TraderStats = {
  trader_id?: string | null;
  label?: string | null;
  exchange?: string | null;
  win_rate_pct?: number | null;
  profit_days?: number | null;
  four_week_return_pct?: number | null;
  four_week_proven?: boolean | null;
  six_month_return_pct?: number | null;
  six_month_proven?: boolean | null;
  one_year_return_pct?: number | null;
  one_year_proven?: boolean | null;
  daily_points?: number | null;
  weekly_points?: number | null;
  source_span_days?: number | null;
};

type Position = {
  id?: string | null;
  symbol?: string | null;
  side?: string | null;
  lifecycle?: string | null;
  exchange?: string | null;
  trader?: string | null;
  trader_label?: string | null;
  source_trader_id?: string | null;
  allocation_pct?: number | null;
  capital_allocation_pct?: number | null;
  leverage?: number | null;
  quantity?: number | null;
  entry_price?: number | null;
  current_price?: number | null;
  exit_price?: number | null;
  unrealized_pnl_usd?: number | null;
  realized_pnl_usd?: number | null;
  return_pct?: number | null;
  opened_at?: string | null;
  closed_at?: string | null;
  upscale_supported?: boolean | null;
  upscale_status?: string | null;
  position_ref?: string | null;
  mapping_status?: string | null;
  position_key_verified?: boolean | null;
  margin_allocation_usd?: number | null;
};

type UpscaleInventory = {
  proven?: boolean | null;
  complete?: boolean | null;
  filter_active?: boolean | null;
  symbol_count?: number | null;
  status?: string | null;
  reason?: string | null;
  copy_symbols?: string[] | null;
  not_proven_symbols?: string[] | null;
};

type CopytraderData = {
  product_schema?: string | null;
  status?: string | null;
  mode?: string | null;
  exchange?: string | null;
  generated_at?: string | null;
  allocation_semantics?: string | null;
  summary?: Summary | null;
  portfolio?: Summary | null;
  open_positions?: Position[] | null;
  closed_positions?: Position[] | null;
  trader_stats?: TraderStats[] | null;
  upscale_inventory?: UpscaleInventory | null;
  sample_warning?: string | null;
  minimum_closed_for_review?: number | null;
};

type DashboardResponse = {
  generated_at?: string | null;
  vps_published_at?: string | null;
  vercel_ingested_at?: string | null;
  copytrader?: CopytraderData | null;
  error?: string;
  detail?: string;
};

function finite(
  value: number | null | undefined,
): number | null {
  return typeof value === "number" &&
    Number.isFinite(value)
    ? value
    : null;
}

function money(
  value: number | null | undefined,
): string {
  const number = finite(value);

  if (number === null) {
    return "—";
  }

  return new Intl.NumberFormat(
    "ru-RU",
    {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    },
  ).format(number);
}

function percent(
  value: number | null | undefined,
  signed = false,
): string {
  const number = finite(value);

  if (number === null) {
    return "—";
  }

  const prefix =
    signed && number > 0
      ? "+"
      : "";

  return `${prefix}${number.toFixed(2)}%`;
}

function price(
  value: number | null | undefined,
): string {
  const number = finite(value);

  if (number === null) {
    return "—";
  }

  return new Intl.NumberFormat(
    "ru-RU",
    {
      maximumFractionDigits:
        number >= 100
          ? 2
          : number >= 1
            ? 5
            : 8,
    },
  ).format(number);
}

function shortSymbol(
  value: string | null | undefined,
): string {
  return String(value || "—")
    .toUpperCase()
    .replace(/-USDT-SWAP$/, "")
    .replace(/-USDC-SWAP$/, "")
    .replace(/-USD-SWAP$/, "")
    .replace(/USDT$/, "")
    .replace(/USDC$/, "");
}

function sideLabel(
  value: string | null | undefined,
): string {
  const side = String(
    value || "",
  ).toUpperCase();

  if (side === "LONG") {
    return "Лонг";
  }

  if (side === "SHORT") {
    return "Шорт";
  }

  return value || "—";
}

function pnlValue(
  position: Position,
): number | null {
  return finite(
    position.realized_pnl_usd,
  ) ??
    finite(
      position.unrealized_pnl_usd,
    );
}

function compactTrader(
  position: Position,
): string {
  if (position.trader_label) {
    return position.trader_label;
  }

  const raw = String(
    position.source_trader_id ||
      position.trader ||
      "",
  )
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();

  return raw
    ? `Трейдер ${raw.slice(0, 8)}`
    : "Трейдер не указан";
}

function pnlClass(
  value: number | null | undefined,
): string {
  const number = finite(value);

  if (number === null || number === 0) {
    return "neutral";
  }

  return number > 0
    ? "positive"
    : "negative";
}

function upscaleLabel(
  position: Position,
): string {
  if (
    position.upscale_status ===
      "SUPPORTED" ||
    position.upscale_supported === true
  ) {
    return "Доступен";
  }

  if (
    position.upscale_status ===
      "NOT_SUPPORTED" ||
    position.upscale_supported === false
  ) {
    return "Не доступен";
  }

  return "Не подтверждено";
}

function PositionsTable({
  rows,
  closed,
}: {
  rows: Position[];
  closed: boolean;
}) {
  if (!rows.length) {
    return (
      <div className="empty-state">
        Пока нет позиций.
      </div>
    );
  }

  return (
    <div className="table-shell">
      <table className="compact-table">
        <thead>
          <tr>
            <th>Инструмент</th>
            <th>Сторона</th>
            <th>Трейдер</th>
            <th>Биржа</th>
            <th>Доля капитала</th>
            <th>Вход</th>
            <th>
              {closed
                ? "Выход"
                : "Текущая"}
            </th>
            <th>PnL</th>
            <th>Upscale</th>
          </tr>
        </thead>

        <tbody>
          {rows.map(
            (
              position,
              index,
            ) => {
              const pnl =
                pnlValue(position);

              const allocation =
                finite(
                  position
                    .capital_allocation_pct,
                ) ??
                finite(
                  position
                    .allocation_pct,
                );

              return (
                <tr
                  key={
                    position.id ||
                    [
                      position.symbol,
                      position.side,
                      position.trader,
                      index,
                    ].join(":")
                  }
                >
                  <td>
                    <strong>
                      {shortSymbol(
                        position.symbol,
                      )}
                    </strong>

                    <span className="subline">
                      ID{" "}
                      {(
                        position.position_ref ||
                        position.id ||
                        "—"
                      )
                        .slice(0, 8)
                        .toUpperCase()}
                    </span>
                  </td>

                  <td>
                    <span
                      className={`side-badge ${
                        String(
                          position.side ||
                            "",
                        ).toUpperCase() ===
                        "LONG"
                          ? "long"
                          : "short"
                      }`}
                    >
                      {sideLabel(
                        position.side,
                      )}
                    </span>
                  </td>

                  <td>
                    {compactTrader(
                      position,
                    )}
                  </td>

                  <td>
                    {position.exchange ||
                      "OKX"}
                  </td>

                  <td>
                    <strong>
                      {percent(
                        allocation,
                      )}
                    </strong>

                    <span className="subline">
                      доля капитала, не стоп-риск
                    </span>
                  </td>

                  <td>
                    {price(
                      position.entry_price,
                    )}
                  </td>

                  <td>
                    {price(
                      closed
                        ? position.exit_price
                        : position.current_price,
                    )}
                  </td>

                  <td>
                    <strong
                      className={pnlClass(
                        pnl,
                      )}
                    >
                      {money(pnl)}
                    </strong>

                    <span
                      className={`subline ${pnlClass(
                        position.return_pct,
                      )}`}
                    >
                      {percent(
                        position.return_pct,
                        true,
                      )}
                    </span>
                  </td>

                  <td>
                    <span
                      className={`availability ${
                        position.upscale_status ===
                        "SUPPORTED"
                          ? "confirmed"
                          : "unknown"
                      }`}
                    >
                      {upscaleLabel(
                        position,
                      )}
                    </span>
                  </td>
                </tr>
              );
            },
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function CopytraderDashboard() {
  const [data, setData] =
    useState<DashboardResponse | null>(
      null,
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const load = useCallback(
    async () => {
      try {
        setError(null);

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
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Не удалось загрузить данные",
        );
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void load();

    const timer = window.setInterval(
      () => {
        void load();
      },
      30_000,
    );

    return () =>
      window.clearInterval(timer);
  }, [load]);

  const copytrader =
    data?.copytrader;

  const summary =
    copytrader?.summary ||
    copytrader?.portfolio ||
    {};

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

  const traderStats = useMemo(
    () =>
      copytrader?.trader_stats ||
      [],
    [copytrader],
  );

  const inventory =
    copytrader?.upscale_inventory;

  const totalPnl =
    (finite(
      summary.realized_pnl_usd,
    ) || 0) +
    (finite(
      summary.unrealized_pnl_usd,
    ) || 0);

  return (
    <main
      className="copy-page"
      data-product-schema="BROM_COPYTRADER_PRODUCT_V2_1"
    >
      <header className="page-header">
        <div>
          <div className="eyebrow">
            BROM · COPYTRADER
          </div>

          <h1>
            CopyTrader — бумажный портфель
          </h1>

          <p>
            Компактный контроль сделок
            выбранных трейдеров OKX.
            Распределение показывает долю
            капитала, а не гарантированный
            размер убытка.
          </p>
        </div>

        <div className="header-actions">
          <span className="mode-badge">
            PAPER ONLY
          </span>

          <button
            type="button"
            onClick={() => {
              setLoading(true);
              void load();
            }}
          >
            Обновить
          </button>
        </div>
      </header>

      <DashboardNav active="copytrader" />

      <section className="notice warning">
        <strong>
          Фильтр Upscale не активирован.
        </strong>

        <span>
          Свежий полный список инструментов
          не подтверждён. Текущие монеты
          остаются в PAPER-статистике и не
          считаются ни доступными, ни
          недоступными на платформе.
        </span>
      </section>

      {copytrader?.sample_warning ? (
        <section className="notice info">
          <strong>
            Статистика ещё набирается.
          </strong>

          <span>
            Закрыто сделок:{" "}
            {closedPositions.length}. Для
            решения о реальной торговле
            требуется минимум{" "}
            {copytrader
              .minimum_closed_for_review ||
              30}.
          </span>
        </section>
      ) : null}

      {error ? (
        <section className="notice error">
          <strong>
            Ошибка загрузки
          </strong>

          <span>{error}</span>
        </section>
      ) : null}

      <section className="summary-grid">
        <article className="summary-card">
          <span>Капитал</span>
          <strong>
            {money(
              summary.equity_usd,
            )}
          </strong>
          <small>
            Старт:{" "}
            {money(
              summary
                .starting_balance_usd,
            )}
          </small>
        </article>

        <article className="summary-card">
          <span>Общий PnL</span>
          <strong
            className={pnlClass(
              totalPnl,
            )}
          >
            {money(totalPnl)}
          </strong>
          <small>
            Реализовано:{" "}
            {money(
              summary
                .realized_pnl_usd,
            )}
          </small>
        </article>

        <article className="summary-card">
          <span>Доходность</span>
          <strong
            className={pnlClass(
              summary
                .total_return_pct,
            )}
          >
            {percent(
              summary
                .total_return_pct,
              true,
            )}
          </strong>
          <small>
            PAPER-портфель
          </small>
        </article>

        <article className="summary-card">
          <span>Позиции</span>
          <strong>
            {openPositions.length} /{" "}
            {closedPositions.length}
          </strong>
          <small>
            открыто / закрыто
          </small>
        </article>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>
              Статистика трейдеров
            </h2>

            <p>
              Win rate — общий показатель
              источника. Доходность за четыре
              недели рассчитана по
              подтверждённому ряду OKX.
            </p>
          </div>

          <span className="count-badge">
            {traderStats.length} трейдеров
          </span>
        </div>

        <div className="table-shell">
          <table className="compact-table trader-table">
            <thead>
              <tr>
                <th>Трейдер</th>
                <th>Биржа</th>
                <th>Win rate</th>
                <th>
                  Доходность за 4 недели
                </th>
                <th>6 месяцев</th>
                <th>1 год</th>
                <th>История</th>
              </tr>
            </thead>

            <tbody>
              {traderStats.map(
                (
                  trader,
                  index,
                ) => (
                  <tr
                    key={
                      trader.trader_id ||
                      trader.label ||
                      index
                    }
                  >
                    <td>
                      <strong>
                        {trader.label ||
                          "Трейдер"}
                      </strong>
                    </td>

                    <td>
                      {trader.exchange ||
                        "OKX"}
                    </td>

                    <td>
                      {percent(
                        trader.win_rate_pct,
                      )}
                    </td>

                    <td>
                      <strong
                        className={pnlClass(
                          trader
                            .four_week_return_pct,
                        )}
                      >
                        {trader
                          .four_week_proven
                          ? percent(
                              trader
                                .four_week_return_pct,
                              true,
                            )
                          : "нет данных"}
                      </strong>
                    </td>

                    <td>
                      {trader
                        .six_month_proven
                        ? percent(
                            trader
                              .six_month_return_pct,
                            true,
                          )
                        : "нет данных"}
                    </td>

                    <td>
                      {trader
                        .one_year_proven
                        ? percent(
                            trader
                              .one_year_return_pct,
                            true,
                          )
                        : "нет данных"}
                    </td>

                    <td>
                      {trader.weekly_points ||
                        0}{" "}
                      недель
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>
              Открытые PAPER-позиции
            </h2>

            <p>
              Биржа источника, трейдер,
              направление и фактическая доля
              капитала на позицию.
            </p>
          </div>

          <span className="count-badge">
            {openPositions.length}
          </span>
        </div>

        <PositionsTable
          rows={openPositions}
          closed={false}
        />
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>
              Закрытые PAPER-позиции
            </h2>

            <p>
              Реализованный результат без
              изменения исторической
              статистики.
            </p>
          </div>

          <span className="count-badge">
            {closedPositions.length}
          </span>
        </div>

        <PositionsTable
          rows={closedPositions}
          closed
        />
      </section>

      <footer className="product-footer">
        <span>
          Источник:{" "}
          {copytrader?.exchange ||
            "OKX"}
        </span>

        <span>
          Upscale inventory:{" "}
          {inventory?.proven
            ? "подтверждён"
            : "не подтверждён"}
        </span>

        <span>
          Обновлено:{" "}
          {copytrader?.generated_at
            ? new Date(
                copytrader.generated_at,
              ).toLocaleString(
                "ru-RU",
              )
            : loading
              ? "загрузка"
              : "—"}
        </span>
      </footer>

      <style jsx>{`
        .copy-page {
          width: min(
            1440px,
            calc(100% - 32px)
          );
          margin: 0 auto;
          padding: 24px 0 48px;
        }

        .page-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: 18px;
        }

        .eyebrow {
          margin-bottom: 7px;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.14em;
          opacity: 0.62;
        }

        h1 {
          margin: 0;
          font-size: clamp(
            25px,
            4vw,
            38px
          );
          line-height: 1.08;
        }

        .page-header p {
          max-width: 720px;
          margin: 10px 0 0;
          font-size: 14px;
          line-height: 1.55;
          opacity: 0.68;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
        }

        button {
          min-height: 38px;
          padding: 0 15px;
          border: 1px solid
            rgba(
              255,
              255,
              255,
              0.16
            );
          border-radius: 10px;
          background: rgba(
            255,
            255,
            255,
            0.06
          );
          color: inherit;
          cursor: pointer;
        }

        .mode-badge,
        .count-badge {
          display: inline-flex;
          align-items: center;
          min-height: 28px;
          padding: 0 10px;
          border-radius: 999px;
          background: rgba(
            255,
            255,
            255,
            0.07
          );
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.05em;
        }

        .notice {
          display: grid;
          grid-template-columns:
            minmax(180px, auto)
            1fr;
          gap: 12px;
          margin-top: 14px;
          padding: 12px 14px;
          border: 1px solid
            rgba(
              255,
              255,
              255,
              0.1
            );
          border-radius: 12px;
          font-size: 13px;
          line-height: 1.45;
        }

        .notice.warning {
          background: rgba(
            245,
            158,
            11,
            0.08
          );
        }

        .notice.info {
          background: rgba(
            59,
            130,
            246,
            0.07
          );
        }

        .notice.error {
          background: rgba(
            239,
            68,
            68,
            0.08
          );
        }

        .summary-grid {
          display: grid;
          grid-template-columns:
            repeat(
              4,
              minmax(0, 1fr)
            );
          gap: 12px;
          margin-top: 16px;
        }

        .summary-card,
        .panel {
          border: 1px solid
            rgba(
              255,
              255,
              255,
              0.1
            );
          background: rgba(
            255,
            255,
            255,
            0.035
          );
          box-shadow:
            0 18px 50px
            rgba(
              0,
              0,
              0,
              0.12
            );
        }

        .summary-card {
          display: grid;
          gap: 6px;
          min-height: 112px;
          padding: 15px;
          border-radius: 14px;
        }

        .summary-card span {
          font-size: 12px;
          opacity: 0.62;
        }

        .summary-card strong {
          align-self: center;
          font-size: 23px;
        }

        .summary-card small {
          font-size: 11px;
          opacity: 0.52;
        }

        .panel {
          margin-top: 16px;
          padding: 16px;
          border-radius: 16px;
        }

        .panel-heading {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 13px;
        }

        .panel-heading h2 {
          margin: 0;
          font-size: 17px;
        }

        .panel-heading p {
          max-width: 720px;
          margin: 5px 0 0;
          font-size: 12px;
          line-height: 1.45;
          opacity: 0.56;
        }

        .table-shell {
          width: 100%;
          overflow-x: auto;
          border: 1px solid
            rgba(
              255,
              255,
              255,
              0.08
            );
          border-radius: 12px;
        }

        .compact-table {
          width: 100%;
          min-width: 1040px;
          border-collapse: collapse;
          table-layout: auto;
          font-size: 12px;
        }

        .trader-table {
          min-width: 850px;
        }

        th,
        td {
          padding: 10px 11px;
          border-bottom: 1px solid
            rgba(
              255,
              255,
              255,
              0.07
            );
          text-align: left;
          white-space: nowrap;
          vertical-align: middle;
        }

        th {
          background: rgba(
            255,
            255,
            255,
            0.035
          );
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.045em;
          text-transform: uppercase;
          opacity: 0.55;
        }

        tbody tr:last-child td {
          border-bottom: 0;
        }

        tbody tr:hover {
          background: rgba(
            255,
            255,
            255,
            0.025
          );
        }

        .subline {
          display: block;
          margin-top: 3px;
          font-size: 10px;
          opacity: 0.48;
        }

        .side-badge,
        .availability {
          display: inline-flex;
          align-items: center;
          min-height: 24px;
          padding: 0 8px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 800;
        }

        .side-badge.long {
          background: rgba(
            16,
            185,
            129,
            0.12
          );
        }

        .side-badge.short {
          background: rgba(
            239,
            68,
            68,
            0.12
          );
        }

        .availability.confirmed {
          background: rgba(
            16,
            185,
            129,
            0.12
          );
        }

        .availability.unknown {
          background: rgba(
            245,
            158,
            11,
            0.1
          );
        }

        .positive {
          color: #34d399;
        }

        .negative {
          color: #fb7185;
        }

        .neutral {
          color: inherit;
        }

        .empty-state {
          padding: 25px;
          text-align: center;
          font-size: 13px;
          opacity: 0.55;
        }

        .product-footer {
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          gap: 12px;
          margin-top: 16px;
          padding: 0 3px;
          font-size: 10px;
          opacity: 0.45;
        }

        @media (
          max-width: 980px
        ) {
          .summary-grid {
            grid-template-columns:
              repeat(
                2,
                minmax(0, 1fr)
              );
          }

          .page-header {
            flex-direction: column;
          }
        }

        @media (
          max-width: 580px
        ) {
          .copy-page {
            width: min(
              100% - 20px,
              1440px
            );
            padding-top: 15px;
          }

          .summary-grid {
            grid-template-columns: 1fr;
          }

          .notice {
            grid-template-columns: 1fr;
          }

          .panel {
            padding: 12px;
          }
        }
      `}</style>
    </main>
  );
}
