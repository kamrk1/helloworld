"use client";

import { useEffect } from "react";
import { adminBase } from "@/lib/clinic-config";

export function PrintTrigger({ auto, clinicId }: { auto: boolean; clinicId: string }) {
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
      <a className="btn-secondary" href={adminBase(clinicId)}>
        Back to calendar
      </a>
    </div>
  );
}
