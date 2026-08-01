import Dashboard from "@/components/Dashboard";

export default function CombinedPage() {
  return (
    <Dashboard
      view="combined"
      title="Intraday Combined Dashboard"
      strategyLabel="Paper-исследование LONG + SHORT"
      modelLabel="Combined research portfolio"
    />
  );
}
