import type {
  IntradayView,
} from "@/components/Dashboard";

type Props = {
  active: IntradayView;
};

const modes: Array<{
  id: IntradayView;
  href: string;
  label: string;
  description: string;
}> = [
  {
    id: "short",
    href: "/",
    label: "SHORT",
    description: "Исходная контрольная выборка",
  },
  {
    id: "long",
    href: "/long",
    label: "LONG",
    description: "Forward-only с момента запуска",
  },
  {
    id: "combined",
    href: "/combined",
    label: "COMBINED",
    description: "Агрегация LONG + SHORT",
  },
];

export default function IntradayModeNav({
  active,
}: Props) {
  return (
    <nav
      aria-label="Режим Intraday"
      style={{
        display: "grid",
        gridTemplateColumns:
          "repeat(auto-fit, minmax(180px, 1fr))",
        gap: "9px",
        marginTop: "12px",
      }}
    >
      {modes.map((mode) =>
        mode.id === active ? (
          <span
            key={mode.id}
            aria-current="page"
            style={{
              display: "block",
              padding: "11px 13px",
              borderRadius: "13px",
              border:
                "1px solid rgba(94, 234, 212, 0.55)",
              background:
                "rgba(15, 118, 110, 0.17)",
              boxShadow:
                "0 0 20px rgba(45, 212, 191, 0.08)",
            }}
          >
            <strong
              style={{
                display: "block",
                fontSize: "12px",
                letterSpacing: "0.07em",
              }}
            >
              {mode.label}
            </strong>

            <span
              style={{
                display: "block",
                marginTop: "3px",
                fontSize: "10px",
                opacity: 0.62,
              }}
            >
              {mode.description}
            </span>
          </span>
        ) : (
          <a
            key={mode.id}
            href={mode.href}
            style={{
              display: "block",
              padding: "11px 13px",
              borderRadius: "13px",
              border:
                "1px solid rgba(148, 163, 184, 0.18)",
              background:
                "rgba(15, 23, 42, 0.42)",
              color: "inherit",
              textDecoration: "none",
            }}
          >
            <strong
              style={{
                display: "block",
                fontSize: "12px",
                letterSpacing: "0.07em",
              }}
            >
              {mode.label}
            </strong>

            <span
              style={{
                display: "block",
                marginTop: "3px",
                fontSize: "10px",
                opacity: 0.62,
              }}
            >
              {mode.description}
            </span>
          </a>
        ),
      )}
    </nav>
  );
}
