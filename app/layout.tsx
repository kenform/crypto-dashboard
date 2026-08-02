import type { ReactNode } from "react";
import type { Metadata } from "next";
import "./globals.css";
import "./ui-cleanup-v1.css";
import "./ui-page-v2.css";
import "./ui-page-v2b.css";

export const metadata: Metadata = {
  title: "BROM Alpha Dashboard",
  description: "Понятный live dashboard Alpha paper-стратегии: статус, статистика, монеты и здоровье системы.",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
