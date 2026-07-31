# BROM Alpha Dashboard

Готовый Next.js-проект для Vercel. Браузер обращается только к Vercel `/api/dashboard`; секретный токен остаётся внутри Vercel Environment Variables.

## 1. VPS API

Загрузите папку `server` на VPS и выполните:

```bash
cd server
bash install.sh
```

Скопируйте две строки из результата:

- `VERCEL_ALPHA_API_URL=...`
- `VERCEL_ALPHA_API_TOKEN=...`

Проверьте, что TCP-порт `8788` доступен извне. API только читает статистику и не содержит торговых функций.

## 2. Vercel

1. Загрузите проект в GitHub или импортируйте папку в Vercel.
2. В Settings → Environment Variables добавьте:
   - `ALPHA_API_URL`
   - `ALPHA_API_TOKEN`
3. Deploy / Redeploy.

## 3. Что отображается

- pipeline health и quality gate;
- paper-сделки и статусы;
- текущий и закрытый PnL в R и USD;
- Entry / текущая цена / SL / TP;
- signal funnel 1h / 6h / 24h;
- heartbeat каждого этапа;
- автоматическое обновление каждые 15 секунд.

## Безопасность

- токен не отправляется в браузер;
- Vercel Route Handler проксирует данные с VPS;
- API read-only;
- real/demo submit и order mutation отсутствуют.
