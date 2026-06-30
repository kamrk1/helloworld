import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Net Worth Calculator",
  description: "Production-grade net worth tracker for cash, equities, savings, bank accounts, and PF",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
