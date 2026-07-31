export type Trade = {
  id?: string | number;
  symbol?: string;
  side?: string;
  state?: string;

  entry?: number | string | null;
  current_price?: number | string | null;
  sl?: number | string | null;
  tp?: number | string | null;

  realized_r?: number | string | null;
  unrealized_r?: number | string | null;
  pnl_usd?: number | string | null;
  score?: number | string | null;

  created_at?: string | null;
  candidate_time?: string | null;
  signal_time?: string | null;
  opened_at?: string | null;
  closed_at?: string | null;
  updated_at?: string | null;
  generated_at?: string | null;
  timestamp?: string | null;

  [key: string]: unknown;
};

export type DashboardData = {
  mode?: string;
  generated_at?: string;
  vps_published_at?: string;
  vercel_ingested_at?: string;

  summary?: Record<string, unknown>;
  quality?: Record<string, unknown>;
  pipeline?: Record<string, unknown>;
  funnel?: Record<string, unknown>;
  bridge?: Record<string, unknown>;
  safety?: Record<string, unknown>;
  trades?: Trade[];

  [key: string]: unknown;
};
