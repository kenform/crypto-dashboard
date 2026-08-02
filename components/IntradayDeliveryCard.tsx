"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

type DeliveryPayload = {
  status?: string;
  mode?: string;
  historical_replay?: boolean;
  topic_name?: string;
  thread_id?: string | null;
  activation_epoch?: string | null;
  generated_at?: string | null;
  current_trade_count?: number | null;
  watermark_count?: number | null;
  processed_count?: number | null;
  delivered_trade_count?: number | null;
  sent_new_last_run?: number | null;
  sent_updates_last_run?: number | null;
  error_count?: number | null;
};

function formatDate(value?: string | null): string {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString(
    "ru-RU",
    {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    },
  );
}

function numberValue(
  value?: number | null,
): string {
  return typeof value === "number"
    ? String(value)
    : "—";
}

export default function IntradayDeliveryCard() {
  const [data, setData] =
    useState<DeliveryPayload | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/intraday-delivery?ts=${Date.now()}`,
        {
          cache: "no-store",
        },
      );

      const body =
        await response.json() as DeliveryPayload;

      if (!response.ok) {
        throw new Error(
          body.status || "DELIVERY_API_ERROR",
        );
      }

      setData(body);
      setError(null);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "UNKNOWN_ERROR",
      );
    }
  }, []);

  useEffect(() => {
    void load();

    const timer = window.setInterval(
      () => void load(),
      60_000,
    );

    return () => {
      window.clearInterval(timer);
    };
  }, [load]);

  const working =
    data?.status === "WORKING";

  return (
    <section className="telegram-delivery-card">
      <div className="telegram-delivery-head">
        <div>
          <span className="telegram-delivery-kicker">
            Telegram Delivery
          </span>

          <h2>
            Intraday
          </h2>

          <p>
            Только новые PAPER-сигналы и изменения
            состояния. Исторический replay выключен.
          </p>
        </div>

        <span
          className={
            working
              ? "telegram-delivery-status is-working"
              : "telegram-delivery-status"
          }
        >
          {error
            ? "ОШИБКА"
            : data?.status || "ЗАГРУЗКА"}
        </span>
      </div>

      <div className="telegram-delivery-grid">
        <div>
          <span>Топик</span>
          <strong>
            {data?.topic_name || "Intraday"}
          </strong>
        </div>

        <div>
          <span>Доставлено сигналов</span>
          <strong>
            {numberValue(
              data?.delivered_trade_count,
            )}
          </strong>
        </div>

        <div>
          <span>Watermark</span>
          <strong>
            {numberValue(
              data?.watermark_count,
            )}
          </strong>
        </div>

        <div>
          <span>Ошибки</span>
          <strong>
            {numberValue(
              data?.error_count,
            )}
          </strong>
        </div>
      </div>

      <div className="telegram-delivery-foot">
        <span>
          Последняя проверка:{" "}
          <strong>
            {formatDate(data?.generated_at)}
          </strong>
        </span>

        <span>
          Последний цикл: новых{" "}
          <strong>
            {numberValue(
              data?.sent_new_last_run,
            )}
          </strong>
          , обновлений{" "}
          <strong>
            {numberValue(
              data?.sent_updates_last_run,
            )}
          </strong>
        </span>
      </div>

      {error ? (
        <div className="telegram-delivery-error">
          {error}
        </div>
      ) : null}
    </section>
  );
}
