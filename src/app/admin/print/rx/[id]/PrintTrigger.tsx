"use client";

import { useEffect } from "react";

export function PrintTrigger({ auto }: { auto: boolean }) {
  useEffect(() => {
    if (auto) {
      const t = setTimeout(() => window.print(), 250);
      return () => clearTimeout(t);
    }
  }, [auto]);
  return (
    <div className="no-print mb-4 flex justify-end gap-2">
      <button className="btn-primary" onClick={() => window.print()}>
        Print / Save PDF
      </button>
      <a className="btn-secondary" href="/admin">
        Back to calendar
      </a>
    </div>
  );
}
