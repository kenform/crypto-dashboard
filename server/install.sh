#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

HOME_DIR="/home/openclawuser"
INTEL="$HOME_DIR/brom_signal_intel/intel"
ALPHA="$INTEL/brom_alpha_v3"
PY="$HOME_DIR/brom_browser_worker/.venv/bin/python"
API_DIR="$ALPHA/web"
API="$API_DIR/alpha_dashboard_api_v1.py"
ENV_FILE="$HOME_DIR/.config/brom-alpha-dashboard.env"
UNIT_DIR="$HOME_DIR/.config/systemd/user"
SERVICE="$UNIT_DIR/brom-alpha-dashboard-api-v1.service"
PORT="8788"

mkdir -p "$API_DIR" "$UNIT_DIR" "$(dirname "$ENV_FILE")"
cp "$(dirname "$0")/alpha_dashboard_api_v1.py" "$API"
chmod 700 "$API"

if [ ! -s "$ENV_FILE" ]; then
  TOKEN="$($PY - <<'PY'
import secrets
print(secrets.token_hex(32))
PY
)"
  cat > "$ENV_FILE" <<ENV
ALPHA_DASHBOARD_TOKEN=$TOKEN
ALPHA_DASHBOARD_HOST=0.0.0.0
ALPHA_DASHBOARD_PORT=$PORT
ENV
fi
chmod 600 "$ENV_FILE"

cat > "$SERVICE" <<UNIT
[Unit]
Description=BROM Alpha dashboard read-only API
After=network-online.target

[Service]
Type=simple
EnvironmentFile=$ENV_FILE
ExecStart=$PY $API
Restart=always
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=read-only
ReadWritePaths=$ALPHA/runtime $INTEL

[Install]
WantedBy=default.target
UNIT

systemctl --user daemon-reload
systemctl --user enable --now brom-alpha-dashboard-api-v1.service
sleep 2

TOKEN="$(sed -n 's/^ALPHA_DASHBOARD_TOKEN=//p' "$ENV_FILE")"
STATUS="$(systemctl --user is-active brom-alpha-dashboard-api-v1.service || true)"
HEALTH="$(curl -fsS "http://127.0.0.1:$PORT/health")"
ROWS="$(curl -fsS -H "Authorization: Bearer $TOKEN" "http://127.0.0.1:$PORT/api/dashboard" | "$PY" -c 'import json,sys; d=json.load(sys.stdin); print(len(d.get("trades") or []))')"

PUBLIC_IP="$(hostname -I | awk '{print $1}')"

echo "============================================================"
echo "ALPHA_DASHBOARD_API=INSTALLED"
echo "SERVICE_STATE=$STATUS"
echo "HEALTH=$HEALTH"
echo "TRADE_ROWS=$ROWS"
echo "VERCEL_ALPHA_API_URL=http://$PUBLIC_IP:$PORT/api/dashboard"
echo "VERCEL_ALPHA_API_TOKEN=$TOKEN"
echo "REAL_SUBMIT=0"
echo "DEMO_SUBMIT=0"
echo "ORDER_ACTION=0"
echo "============================================================"

echo "NOTE=Port $PORT must be reachable from the internet. If UFW is active, allow TCP $PORT."
