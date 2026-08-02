type Props = {
  active:
    | "intraday"
    | "scalp"
    | "mtt"
    | "mtt-shadow"
    | "journal"
    | "copytrader";
};

export default function DashboardNav({
  active,
}: Props) {
  const links = [
    {
      id: "intraday",
      href: "/",
      label: "Интрадей",
    },
    {
      id: "scalp",
      href: "/scalp",
      label: "Скальпинг",
    },
    {
      id: "mtt",
      href: "/mtt",
      label: "MTT Реал",
    },
    {
      id: "mtt-shadow",
      href: "/mtt-shadow",
      label: "MTT Shadow",
    },
    {
      id: "copytrader",
      href: "/copytrader",
      label: "CopyTrader",
    },
    {
      id: "journal",
      href: "/journal",
      label: "Дневник",
    },
  ] as const;

  return (
    <nav
      className="dashboard-switch dashboard-main-nav"
      aria-label="Разделы dashboard"
    >
      {links.map((link) =>
        link.id === active ? (
          <span
            key={link.id}
            className="dashboard-switch-active"
          >
            {link.label}
          </span>
        ) : (
          <a key={link.id} href={link.href}>
            {link.label}
          </a>
        ),
      )}
    </nav>
  );
}
