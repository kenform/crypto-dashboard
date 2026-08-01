import Dashboard from "@/components/Dashboard";

export default function Page() {
  return (
    <Dashboard
      view="short"
      title="Intraday SHORT Dashboard"
      strategyLabel="Paper-стратегия SHORT"
      modelLabel="SHORT-only модель"
    />
  );
}
