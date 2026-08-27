"use client";

import dynamic from "next/dynamic";

const CalendarBoard = dynamic(
  () => import("@/components/admin/CalendarBoard").then((m) => m.CalendarBoard),
  {
    ssr: false,
    loading: () => <div className="h-full bg-white" />,
  },
);

export default function AdminHomePage() {
  return <CalendarBoard />;
}
