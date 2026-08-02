"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import DashboardNav from "@/components/DashboardNav";

const REFRESH_MS = 15_000;

type AnyMap = Record<string, unknown>;

type CopytraderPayload = AnyMap & {
  generated_at?: string;
  mode?: string;
  status?: string;
  summary?: unknown;
  portfolio?: unknown;
  trader_stats?: unknown;
  period_stats?: unknown;
  open_positions?: unknown;
  closed_positions?: unknown;
  data_quality?: unknown;
  upscale_inventory?: unknown;
  allocation_semantics?: unknown;
  sample_warning?: unknown;
};

function isMap(value: unknown): value is AnyMap {
  return (
    typeof value === "object"
    && value !== null
    && !Array.isArray(value)
  );
}

function asMap(value: unknown): AnyMap {
  return isMap(value) ? value : {};
}

function asRows(value: unknown): AnyMap[] {
  if (Array.isArray(value)) {
    return value.filter(isMap);
  }

  if (isMap(value)) {
    return Object.entries(value)
      .filter(([, child]) => isMap(child))
      .map(([key, child]) => ({
        __map_key: key,
        ...child as AnyMap,
      }));
  }

  return [];
}

function numberValue(value: unknown): number | null {
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

function pickNumber(
  maps: AnyMap[],
  keys: string[],
): number | null {
  for (const map of maps) {
    for (const key of keys) {
      const parsed = numberValue(map[key]);

      if (parsed !== null) {
        return parsed;
      }
    }
  }

  return null;
}

function pickString(
  map: AnyMap,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = map[key];

    if (
      typeof value === "string"
      && value.trim()
    ) {
      return value.trim();
    }

    if (
      typeof value === "number"
      && Number.isFinite(value)
    ) {
      return String(value);
    }
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

function signedMoney(value: unknown): string {
  const parsed = numberValue(value);

  if (parsed === null) return "—";

  return `${parsed > 0 ? "+" : ""}${n(parsed, 2)} USD`;
}

function signedPct(value: unknown): string {
  const parsed = numberValue(value);

  if (parsed === null) return "—";

  return `${parsed > 0 ? "+" : ""}${n(parsed, 2)}%`;
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

function normalizeSide(value: unknown): string {
  const side = String(value || "").toUpperCase();

  if (side === "BUY") return "LONG";
  if (side === "SELL") return "SHORT";

  return side;
}

function sideClass(value: unknown): string {
  const side = normalizeSide(value);

  if (side === "LONG") return "ticker-long";
  if (side === "SHORT") return "ticker-short";

  return "";
}

function formatTime(value: unknown): string {
  if (!value) return "—";

  const date = new Date(String(value));

  if (!Number.isFinite(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function compactId(value: unknown): string {
  const raw = String(value || "");

  if (!raw) return "Неизвестный трейдер";

  if (raw.length <= 18) return raw;

  return `${raw.slice(0, 8)}…${raw.slice(-6)}`;
}

function statusLabel(value: unknown): string {
  const raw = String(
    value || "UNKNOWN",
  ).toUpperCase();

  const labels: Record<string, string> = {
    AVAILABLE: "Данные доступны",
    WORKING: "Работает",
    ACTIVE: "Активно",
    OPEN: "Открыта",
    CLOSED: "Закрыта",
    WIN: "Прибыль",
    LOSS: "Убыток",
    STRICT: "Строгий отбор",
    WATCH: "Наблюдение",
    WATCH_ONLY: "Только наблюдение",
    EXCLUDED: "Исключён",
    BLOCKED: "Заблокировано",
    PAPER_ONLY: "Виртуальный режим",
    BLOCKING_NEW_ENTRIES:
      "Новые входы заблокированы",
    UPSCALE_INVENTORY_UNPROVEN:
      "Список инструментов не подтверждён",
  };

  return (
    labels[raw]
    || raw.replaceAll("_", " ")
  );
}

function getPositionSymbol(row: AnyMap): string {
  return (
    pickString(
      row,
      [
        "symbol",
        "instrument",
        "instId",
        "ticker",
        "pair",
      ],
    )
    || "—"
  );
}

function getPositionSide(row: AnyMap): string {
  return normalizeSide(
    pickString(
      row,
      [
        "side",
        "direction",
        "position_side",
        "posSide",
      ],
    ),
  );
}

function getPositionStatus(row: AnyMap): string {
  return (
    pickString(
      row,
      [
        "__position_group",
        "status",
        "state",
        "outcome",
      ],
    )
    || "UNKNOWN"
  );
}

function getPositionTrader(row: AnyMap): string {
  return (
    pickString(
      row,
      [
        "trader_id",
        "trader",
        "source_trader_id",
        "source",
        "copytrader_id",
        "account_id",
      ],
    )
    || "—"
  );
}

export default function CopytraderDashboardV2() {
  const [data, setData] =
    useState<CopytraderPayload | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  const [refreshing, setRefreshing] =
    useState(false);

  const [query, setQuery] =
    useState("");

  const [sideFilter, setSideFilter] =
    useState("ALL");

  const [stateFilter, setStateFilter] =
    useState("ALL");

  const load = useCallback(async () => {
    setRefreshing(true);

    try {
      const response = await fetch(
        `/api/dashboard?copy_v2=${Date.now()}`,
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
        !body?.copytrader
        || typeof body.copytrader !== "object"
      ) {
        throw new Error(
          "Данные CopyTrader недоступны",
        );
      }

      setData(body.copytrader);
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

  const summary = asMap(data?.summary);
  const portfolio = asMap(data?.portfolio);
  const dataQuality = asMap(data?.data_quality);
  const inventory = asMap(
    data?.upscale_inventory,
  );

  const openPositions = useMemo(
    () => asRows(data?.open_positions).map(
      (row) => ({
        ...row,
        __position_group: "OPEN",
      }),
    ),
    [data],
  );

  const closedPositions = useMemo(
    () => asRows(data?.closed_positions).map(
      (row) => ({
        ...row,
        __position_group: "CLOSED",
      }),
    ),
    [data],
  );

  const traderRows = useMemo(() => {
    const direct = asRows(
      data?.trader_stats,
    );

    if (direct.length) return direct;

    return asRows(data?.period_stats);
  }, [data]);

  const positions = useMemo(
    () => [
      ...openPositions,
      ...closedPositions,
    ],
    [openPositions, closedPositions],
  );

  const filteredPositions = useMemo(() => {
    const normalizedQuery =
      query.trim().toLowerCase();

    return positions.filter((row) => {
      const symbol =
        getPositionSymbol(row);

      const trader =
        getPositionTrader(row);

      const side =
        getPositionSide(row);

      const status =
        getPositionStatus(row);

      const searchMatches = (
        !normalizedQuery
        || symbol.toLowerCase().includes(
          normalizedQuery,
        )
        || trader.toLowerCase().includes(
          normalizedQuery,
        )
      );

      const sideMatches = (
        sideFilter === "ALL"
        || side === sideFilter
      );

      const stateMatches = (
        stateFilter === "ALL"
        || status === stateFilter
      );

      return (
        searchMatches
        && sideMatches
        && stateMatches
      );
    });
  }, [
    positions,
    query,
    sideFilter,
    stateFilter,
  ]);

  const metricMaps = [
    portfolio,
    summary,
  ];

  const netPnl = pickNumber(
    metricMaps,
    [
      "net_pnl_usd",
      "realized_pnl_usd",
      "total_pnl_usd",
      "hypothetical_net_pnl_usd",
      "pnl_usd",
    ],
  );

  const winRate = pickNumber(
    metricMaps,
    [
      "win_rate_pct",
      "win_ratio",
      "winrate_pct",
    ],
  );

  const profitFactor = pickNumber(
    metricMaps,
    [
      "profit_factor",
      "pf",
    ],
  );

  const drawdown = pickNumber(
    metricMaps,
    [
      "maximum_drawdown_pct",
      "max_drawdown_pct",
      "drawdown_pct",
      "maximum_drawdown_r",
    ],
  );

  const allocatedCapital = pickNumber(
    metricMaps,
    [
      "allocated_capital_usd",
      "allocation_usd",
      "capital_usd",
      "portfolio_value_usd",
    ],
  );

  const inventoryProven = (
    inventory.proven === true
    || inventory.inventory_proven === true
    || inventory.authoritative === true
  );

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
            BROM / COPYTRADER
          </div>

          <h1>CopyTrader Research</h1>

          <p>
            PAPER-исследование трейдеров, их позиций и поведения при открытии и закрытии сделок.
          </p>
        </div>

        <div className="topbar-right">
          <div
            className={`copy-v2-mode ${
              inventoryProven
                ? "copy-v2-mode-good"
                : "copy-v2-mode-warn"
            }`}
          >
            <span />
            {inventoryProven
              ? "PAPER · ИНСТРУМЕНТЫ ПРОВЕРЕНЫ"
              : "PAPER · НОВЫЕ ВХОДЫ НА ПАУЗЕ"}
          </div>

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

      <DashboardNav active="copytrader" />

      {error ? (
        <div className="error-banner">
          {error}
        </div>
      ) : null}

      <section className="copy-research-notice card">
        <div>
          <strong>Только PAPER</strong>
          <span>
            Реальное копирование и отправка заявок
            на Upscale выключены.
          </span>
        </div>

        <div>
          <strong>Почему входы на паузе</strong>
          <span>
            Система пока не доказала, что нужные
            инструменты доступны для торговли
            на Upscale.
          </span>
        </div>

        <div>
          <strong>Как сейчас закрывается позиция</strong>
          <span>
            PAPER-позиция закрывается после
            подтверждённого закрытия ведущим
            трейдером. Собственный аварийный SL
            ещё не внедрён.
          </span>
        </div>
      </section>

      <section className="metrics-grid">
        <div className="card metric-card">
          <div className="metric-label">
            Отслеживаемые трейдеры
          </div>

          <div className="metric-value">
            {n(traderRows.length, 0)}
          </div>

          <div className="metric-hint">
            Строгий отбор и наблюдение
          </div>
        </div>

        <div className="card metric-card">
          <div className="metric-label">
            Открытые позиции
          </div>

          <div className="metric-value">
            {n(openPositions.length, 0)}
          </div>

          <div className="metric-hint">
            Только виртуальный портфель
          </div>
        </div>

        <div className="card metric-card">
          <div className="metric-label">
            Закрытые позиции
          </div>

          <div className="metric-value">
            {n(closedPositions.length, 0)}
          </div>

          <div className="metric-hint">
            Финальная статистика
          </div>
        </div>

        <div className="card metric-card">
          <div className="metric-label">
            Общий результат
          </div>

          <div
            className={`metric-value ${valueClass(
              netPnl,
            )}`}
          >
            {signedMoney(netPnl)}
          </div>

          <div className="metric-hint">
            PAPER-портфель
          </div>
        </div>

        <div className="card metric-card">
          <div className="metric-label">
            Винрейт
          </div>

          <div className="metric-value">
            {winRate === null
              ? "—"
              : `${n(winRate, 2)}%`}
          </div>

          <div className="metric-hint">
            Только закрытые позиции
          </div>
        </div>

        <div className="card metric-card">
          <div className="metric-label">
            Выделенный капитал
          </div>

          <div className="metric-value">
            {allocatedCapital === null
              ? "—"
              : `${n(
                  allocatedCapital,
                  2,
                )} USD`}
          </div>

          <div className="metric-hint">
            Доля капитала, не риск убытка
          </div>
        </div>
      </section>

      <section className="compact-results">
        <div>
          <span>Profit factor</span>
          <strong>
            {n(profitFactor, 2)}
          </strong>
        </div>

        <div>
          <span>Макс. просадка</span>
          <strong>
            {drawdown === null
              ? "—"
              : `${n(
                  Math.abs(drawdown),
                  2,
                )}${Math.abs(drawdown) <= 100 ? "%" : "R"}`}
          </strong>
        </div>

        <div>
          <span>Режим</span>
          <strong>
            {statusLabel(
              data?.mode
              || "PAPER_ONLY",
            )}
          </strong>
        </div>

        <div>
          <span>Состояние данных</span>
          <strong>
            {statusLabel(
              pickString(
                dataQuality,
                [
                  "status",
                  "state",
                  "quality",
                ],
              )
              || data?.status
              || "AVAILABLE",
            )}
          </strong>
        </div>

        <div>
          <span>Инструменты Upscale</span>
          <strong>
            {inventoryProven
              ? "Подтверждены"
              : "Не подтверждены"}
          </strong>
        </div>

        <div>
          <span>Независимый защитный SL</span>
          <strong>Не настроен</strong>
        </div>
      </section>

      <section className="card section-card">
        <div className="section-head">
          <div>
            <div className="eyebrow">
              ОТБОР ТРЕЙДЕРОВ
            </div>

            <h2>Статистика трейдеров</h2>

            <p className="section-description">
              Главное по каждому источнику без
              повторяющихся технических полей.
            </p>
          </div>
        </div>

        {traderRows.length ? (
          <div className="copy-v2-trader-grid">
            {traderRows.slice(0, 16).map(
              (row, index) => {
                const traderId = (
                  pickString(
                    row,
                    [
                      "trader_id",
                      "trader",
                      "name",
                      "source",
                      "account_id",
                      "__map_key",
                    ],
                  )
                  || `Трейдер ${index + 1}`
                );

                const status = (
                  pickString(
                    row,
                    [
                      "decision",
                      "status",
                      "classification",
                      "review_state",
                      "eligibility",
                    ],
                  )
                  || "WATCH"
                );

                const fourWeek = pickNumber(
                  [row],
                  [
                    "four_week_return_pct",
                    "return_4w_pct",
                    "four_week_ratio",
                    "period_30d",
                  ],
                );

                const traderWinRate =
                  pickNumber(
                    [row],
                    [
                      "win_rate_pct",
                      "win_ratio",
                      "winrate_pct",
                    ],
                  );

                const sample = pickNumber(
                  [row],
                  [
                    "closed_count",
                    "sample_size",
                    "trade_count",
                    "trades",
                  ],
                );

                return (
                  <article
                    className="copy-v2-trader-card"
                    key={`${traderId}-${index}`}
                  >
                    <div className="copy-v2-trader-head">
                      <strong title={traderId}>
                        {compactId(traderId)}
                      </strong>

                      <span className="copy-v2-status">
                        {statusLabel(status)}
                      </span>
                    </div>

                    <div className="copy-v2-trader-metrics">
                      <div>
                        <span>4 недели</span>
                        <strong
                          className={valueClass(
                            fourWeek,
                          )}
                        >
                          {signedPct(fourWeek)}
                        </strong>
                      </div>

                      <div>
                        <span>Винрейт</span>
                        <strong>
                          {traderWinRate === null
                            ? "—"
                            : `${n(
                                traderWinRate,
                                1,
                              )}%`}
                        </strong>
                      </div>

                      <div>
                        <span>Выборка</span>
                        <strong>
                          {n(sample, 0)}
                        </strong>
                      </div>
                    </div>
                  </article>
                );
              },
            )}
          </div>
        ) : (
          <div className="empty-inline">
            Статистика трейдеров пока не получена.
          </div>
        )}

        {traderRows.length > 16 ? (
          <div className="copy-v2-overflow-note">
            Показаны первые 16 из{" "}
            {traderRows.length} трейдеров.
          </div>
        ) : null}
      </section>

      <section className="card section-card">
        <div className="section-head">
          <div>
            <div className="eyebrow">
              ВИРТУАЛЬНЫЙ ПОРТФЕЛЬ
            </div>

            <h2>Позиции CopyTrader</h2>

            <p className="section-description">
              Открытые и закрытые позиции в одном
              списке с поиском и фильтрами.
            </p>
          </div>
        </div>

        <div className="copy-v2-toolbar">
          <label>
            <span>Поиск</span>

            <input
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
              }}
              placeholder="Монета или трейдер"
            />
          </label>

          <label>
            <span>Сторона</span>

            <select
              value={sideFilter}
              onChange={(event) => {
                setSideFilter(
                  event.target.value,
                );
              }}
            >
              <option value="ALL">
                Все
              </option>
              <option value="LONG">
                LONG
              </option>
              <option value="SHORT">
                SHORT
              </option>
            </select>
          </label>

          <label>
            <span>Состояние</span>

            <select
              value={stateFilter}
              onChange={(event) => {
                setStateFilter(
                  event.target.value,
                );
              }}
            >
              <option value="ALL">
                Все
              </option>
              <option value="OPEN">
                Открытые
              </option>
              <option value="CLOSED">
                Закрытые
              </option>
            </select>
          </label>

          <div className="copy-v2-result-count">
            Найдено:{" "}
            <strong>
              {filteredPositions.length}
            </strong>
          </div>
        </div>

        {filteredPositions.length ? (
          <>
            <div className="table-wrap copy-v2-desktop-table">
              <table>
                <thead>
                  <tr>
                    <th>Актив</th>
                    <th>Сторона</th>
                    <th>Состояние</th>
                    <th>Entry</th>
                    <th>Текущая / выход</th>
                    <th>PnL</th>
                    <th>Трейдер</th>
                    <th>Время</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredPositions.map(
                    (row, index) => {
                      const symbol =
                        getPositionSymbol(row);

                      const side =
                        getPositionSide(row);

                      const status =
                        getPositionStatus(row);

                      const entry =
                        pickNumber(
                          [row],
                          [
                            "entry",
                            "entry_price",
                            "open_price",
                          ],
                        );

                      const current =
                        pickNumber(
                          [row],
                          [
                            "current",
                            "current_price",
                            "exit_price",
                            "close_price",
                            "mark_price",
                          ],
                        );

                      const pnl =
                        pickNumber(
                          [row],
                          [
                            "pnl_usd",
                            "realized_pnl_usd",
                            "unrealized_pnl_usd",
                            "pnl",
                          ],
                        );

                      const time = (
                        pickString(
                          row,
                          [
                            "closed_at",
                            "opened_at",
                            "created_at",
                            "timestamp",
                          ],
                        )
                      );

                      const trader =
                        getPositionTrader(row);

                      return (
                        <tr
                          key={`${symbol}-${trader}-${index}`}
                        >
                          <td>
                            <strong>
                              {symbol}
                            </strong>
                          </td>

                          <td>
                            <span
                              className={sideClass(
                                side,
                              )}
                            >
                              {side || "—"}
                            </span>
                          </td>

                          <td>
                            <span className="copy-v2-status">
                              {statusLabel(
                                status,
                              )}
                            </span>
                          </td>

                          <td>
                            {n(entry, 8)}
                          </td>

                          <td>
                            {n(current, 8)}
                          </td>

                          <td
                            className={valueClass(
                              pnl,
                            )}
                          >
                            <strong>
                              {signedMoney(pnl)}
                            </strong>
                          </td>

                          <td title={trader}>
                            {compactId(trader)}
                          </td>

                          <td>
                            {formatTime(time)}
                          </td>
                        </tr>
                      );
                    },
                  )}
                </tbody>
              </table>
            </div>

            <div className="copy-v2-mobile-list">
              {filteredPositions.map(
                (row, index) => {
                  const symbol =
                    getPositionSymbol(row);

                  const side =
                    getPositionSide(row);

                  const status =
                    getPositionStatus(row);

                  const pnl =
                    pickNumber(
                      [row],
                      [
                        "pnl_usd",
                        "realized_pnl_usd",
                        "unrealized_pnl_usd",
                        "pnl",
                      ],
                    );

                  return (
                    <article
                      className="copy-v2-position-card"
                      key={`mobile-${symbol}-${index}`}
                    >
                      <div className="copy-v2-position-head">
                        <div>
                          <strong>
                            {symbol}
                          </strong>

                          <span
                            className={sideClass(
                              side,
                            )}
                          >
                            {side || "—"}
                          </span>
                        </div>

                        <strong
                          className={valueClass(
                            pnl,
                          )}
                        >
                          {signedMoney(pnl)}
                        </strong>
                      </div>

                      <div className="copy-v2-position-grid">
                        <div>
                          <span>Статус</span>
                          <strong>
                            {statusLabel(status)}
                          </strong>
                        </div>

                        <div>
                          <span>Entry</span>
                          <strong>
                            {n(
                              pickNumber(
                                [row],
                                [
                                  "entry",
                                  "entry_price",
                                  "open_price",
                                ],
                              ),
                              8,
                            )}
                          </strong>
                        </div>

                        <div>
                          <span>Цена / выход</span>
                          <strong>
                            {n(
                              pickNumber(
                                [row],
                                [
                                  "current",
                                  "current_price",
                                  "exit_price",
                                  "close_price",
                                ],
                              ),
                              8,
                            )}
                          </strong>
                        </div>

                        <div>
                          <span>Трейдер</span>
                          <strong>
                            {compactId(
                              getPositionTrader(
                                row,
                              ),
                            )}
                          </strong>
                        </div>
                      </div>
                    </article>
                  );
                },
              )}
            </div>
          </>
        ) : (
          <div className="empty-inline">
            По выбранным фильтрам позиций нет.
          </div>
        )}
      </section>

      <details className="card section-card tech-details copy-v2-tech">
        <summary>
          Техническая информация
        </summary>

        <div className="copy-v2-tech-grid">
          <div>
            <span>Предупреждение выборки</span>
            <strong>
              {String(
                data?.sample_warning
                || "Нет",
              )}
            </strong>
          </div>

          <div>
            <span>Схема продукта</span>
            <strong>
              {String(
                data?.product_schema
                || "—",
              )}
            </strong>
          </div>

          <div>
            <span>Версия продукта</span>
            <strong>
              {String(
                data?.product_revision
                || "—",
              )}
            </strong>
          </div>

          <div>
            <span>Биржа</span>
            <strong>
              {String(
                data?.exchange
                || "—",
              )}
            </strong>
          </div>
        </div>

        <pre className="copy-v2-json">
          {JSON.stringify(
            {
              allocation_semantics:
                data?.allocation_semantics,
              data_quality:
                data?.data_quality,
              upscale_inventory:
                data?.upscale_inventory,
              position_mapping:
                data?.position_mapping,
              safety:
                data?.safety,
            },
            null,
            2,
          )}
        </pre>
      </details>

      <footer>
        CopyTrader Research · PAPER only · реальное копирование выключено
      </footer>
    </main>
  );
}
