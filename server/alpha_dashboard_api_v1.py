#!/usr/bin/env python3
from __future__ import annotations

import json
import math
import os
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

HOME = Path("/home/openclawuser")
INTEL = HOME / "brom_signal_intel" / "intel"
ALPHA = INTEL / "brom_alpha_v3"

PAPER_LATEST = INTEL / "brom_alpha_native_short_3r_paper_tracker_latest.json"
PAPER_STATE = INTEL / "brom_alpha_native_short_3r_paper_tracker_state.json"
QUALITY = ALPHA / "runtime" / "alpha_confirmed_paper_quality_gate_v1" / "latest.json"
PIPELINE = ALPHA / "runtime" / "alpha_pipeline_watchdog_v1" / "latest.json"
FUNNEL = ALPHA / "runtime" / "alpha_signal_funnel_monitor_v1" / "latest.json"
BRIDGE = ALPHA / "runtime" / "alpha_native_short_3r_paper_v1" / "bridge_state.json"

TOKEN = os.environ.get("ALPHA_DASHBOARD_TOKEN", "")
HOST = os.environ.get("ALPHA_DASHBOARD_HOST", "0.0.0.0")
PORT = int(os.environ.get("ALPHA_DASHBOARD_PORT", "8788"))


def load(path: Path) -> dict:
    try:
        value = json.loads(path.read_text(encoding="utf-8", errors="replace"))
        return value if isinstance(value, dict) else {}
    except Exception:
        return {}


def number(value: Any) -> float | None:
    try:
        result = float(value)
    except (TypeError, ValueError):
        return None
    return result if math.isfinite(result) else None


def millis_to_iso(value: Any) -> str | None:
    try:
        return datetime.fromtimestamp(float(value) / 1000.0, timezone.utc).isoformat()
    except (TypeError, ValueError, OSError):
        return None


def normalize_trade(key: str, row: dict) -> dict:
    side = str(row.get("side") or "").upper()
    state = str(row.get("state") or row.get("status") or "UNKNOWN").upper()
    entry = number(row.get("entry"))
    stop = number(row.get("sl"))
    target = number(row.get("tp"))
    current = number(row.get("last_market_price") or row.get("last_price"))
    risk_usd = number(row.get("risk_usd"))
    realized_r = number(row.get("realized_r"))
    planned_rr = number(row.get("planned_rr") or row.get("rr"))

    unrealized_r = None
    if current is not None and entry is not None and stop is not None:
        if side == "SHORT" and stop > entry:
            unrealized_r = (entry - current) / (stop - entry)
        elif side == "LONG" and entry > stop:
            unrealized_r = (current - entry) / (entry - stop)

    effective_r = realized_r if realized_r is not None else unrealized_r
    pnl_usd = effective_r * risk_usd if effective_r is not None and risk_usd is not None else None

    return {
        "id": str(row.get("fingerprint") or key),
        "symbol": str(row.get("symbol") or "UNKNOWN"),
        "side": side,
        "state": state,
        "entry": entry,
        "sl": stop,
        "tp": target,
        "current_price": current,
        "planned_rr": planned_rr,
        "realized_r": realized_r,
        "unrealized_r": unrealized_r,
        "pnl_usd": pnl_usd,
        "risk_usd": risk_usd,
        "created_at": row.get("created_at"),
        "filled_at": row.get("entry_filled_at") or millis_to_iso(row.get("entry_filled_at_ms")),
        "closed_at": row.get("closed_at") or millis_to_iso(row.get("closed_at_ms")),
        "score": number(row.get("score")),
    }


def snapshot() -> dict:
    paper = load(PAPER_LATEST)
    state = load(PAPER_STATE)
    quality = load(QUALITY)
    pipeline = load(PIPELINE)
    funnel = load(FUNNEL)
    bridge = load(BRIDGE)

    stored = state.get("trades") or {}
    if isinstance(stored, dict):
        trades = [normalize_trade(str(key), row) for key, row in stored.items() if isinstance(row, dict)]
    else:
        trades = []

    trades.sort(key=lambda row: (row["state"] not in {"OPEN", "WAITING_ENTRY"}, row["symbol"]))

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "mode": "PAPER_ONLY",
        "summary": paper.get("summary") or {},
        "trades": trades,
        "quality": quality,
        "pipeline": pipeline,
        "funnel": funnel,
        "bridge": bridge,
        "safety": {
            "real_trades": False,
            "demo_submit": False,
            "order_action": False,
        },
    }


class Handler(BaseHTTPRequestHandler):
    server_version = "BromAlphaDashboard/1.0"

    def log_message(self, fmt: str, *args: Any) -> None:
        print("API", self.address_string(), fmt % args, flush=True)

    def send_json(self, status: int, payload: Any) -> None:
        body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store, max-age=0")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def authorized(self) -> bool:
        return bool(TOKEN) and self.headers.get("Authorization", "") == f"Bearer {TOKEN}"

    def do_GET(self) -> None:
        if self.path == "/health":
            self.send_json(200, {"ok": True, "service": "brom-alpha-dashboard-api-v1"})
            return
        if self.path != "/api/dashboard":
            self.send_json(404, {"error": "not_found"})
            return
        if not self.authorized():
            self.send_json(401, {"error": "unauthorized"})
            return
        self.send_json(200, snapshot())


if __name__ == "__main__":
    if not TOKEN:
        raise SystemExit("ALPHA_DASHBOARD_TOKEN is required")
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"ALPHA_DASHBOARD_API_LISTEN={HOST}:{PORT}", flush=True)
    server.serve_forever()
