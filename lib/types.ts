export type Trade = {
  id: string;
  symbol: string;
  side: string;
  state: string;
  entry: number | null;
  sl: number | null;
  tp: number | null;
  current_price: number | null;
  planned_rr: number | null;
  realized_r: number | null;
  unrealized_r: number | null;
  pnl_usd: number | null;
  risk_usd: number | null;
  created_at: string | null;
  filled_at: string | null;
  closed_at: string | null;
  score: number | null;
};

export type DashboardData = {
  generated_at: string;
  mode: string;
  summary: Record<string, unknown>;
  trades: Trade[];
  quality: Record<string, unknown>;
  pipeline: Record<string, unknown>;
  funnel: Record<string, unknown>;
  bridge: Record<string, unknown>;
};
