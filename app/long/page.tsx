import Dashboard from "@/components/Dashboard";

export default function LongPage() {
  return (
    <Dashboard
      view="long"
      title="Intraday LONG Dashboard"
      strategyLabel="Paper-стратегия LONG"
      modelLabel="LONG forward-only модель"
    />
  );
}
