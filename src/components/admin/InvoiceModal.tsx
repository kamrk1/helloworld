"use client";

import { useEffect, useState } from "react";
import { Modal } from "./Modal";
import { useAdminData } from "./AdminDataProvider";
import { useToast } from "./Toast";
import type { AppointmentDTO, InvoiceDTO, InvoiceItemDTO } from "@/lib/types";
import { formatDateLong, toISODateIST } from "@/lib/datetime";
import { adminBase } from "@/lib/clinic-config";
import { apiJson } from "@/lib/api-client";
import { Trash2 } from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */
function numberToWords(num: number): string {
  if (num === 0) return "Zero Only";
  const a = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const n = ("000000000" + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return "";
  let str = "";
  str += (Number(n[1]) !== 0) ? (a[Number(n[1])] || b[n[1][0] as any] + " " + a[n[1][1] as any]) + " Crore " : "";
  str += (Number(n[2]) !== 0) ? (a[Number(n[2])] || b[n[2][0] as any] + " " + a[n[2][1] as any]) + " Lakh " : "";
  str += (Number(n[3]) !== 0) ? (a[Number(n[3])] || b[n[3][0] as any] + " " + a[n[3][1] as any]) + " Thousand " : "";
  str += (Number(n[4]) !== 0) ? (a[Number(n[4])] || b[n[4][0] as any] + " " + a[n[4][1] as any]) + " Hundred " : "";
  str += (Number(n[5]) !== 0) ? ((str !== "") ? "and " : "") + (a[Number(n[5])] || b[n[5][0] as any] + " " + a[n[5][1] as any]) + " " : "";
  return "Rupees " + str.trim() + " Only";
}

export function InvoiceModal({
  appointment,
  onClose,
}: {
  appointment: AppointmentDTO;
  onClose: () => void;
}) {
  const { upsertAppointment, snapshot } = useAdminData();
  const clinic = snapshot.clinic;
  const toast = useToast();
  
  const [billNo, setBillNo] = useState("");
  const [date, setDate] = useState(toISODateIST(new Date()));
  const [amountWords, setAmountWords] = useState("");
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [items, setItems] = useState<InvoiceItemDTO[]>([{ name: "", cost: 0 }]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/appointments/${appointment.id}/invoice`)
      .then((r) => (r.ok ? r.json() : null))
      .then((inv: InvoiceDTO | null) => {
        if (!inv) return;
        setBillNo(inv.billNo);
        setDate(toISODateIST(new Date(inv.date)));
        setAmountWords(inv.amountWords);
        setPaymentMode(inv.paymentMode);
        setItems(inv.items.length > 0 ? inv.items : [{ name: "", cost: 0 }]);
      })
      .catch(() => undefined);
  }, [appointment.id]);

  const totalAmount = items.reduce((sum, item) => sum + (Number(item.cost) || 0), 0);

  useEffect(() => {
    if (totalAmount > 0) {
      setAmountWords(numberToWords(totalAmount));
    } else {
      setAmountWords("");
    }
  }, [totalAmount]);

  async function save(printAfter: boolean) {
    if (!billNo) {
      toast.push("Bill number is required", "err");
      return;
    }
    const cleanItems = items.filter(i => i.name.trim() !== "");
    if (cleanItems.length === 0) {
      toast.push("Add at least one item", "err");
      return;
    }
    setBusy(true);
    try {
      const json = await apiJson<{ appointment: AppointmentDTO }>(
        `/api/admin/appointments/${appointment.id}/invoice`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            billNo,
            date,
            amountWords,
            paymentMode,
            items: cleanItems,
            totalAmount,
          }),
        },
      );
      upsertAppointment(json.appointment);
      toast.push("Invoice saved");
      if (printAfter) {
        window.open(`${adminBase(clinic.id)}/print/invoice/${appointment.id}?print=1`, "_blank");
      }
      onClose();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Failed", "err");
    } finally {
      setBusy(false);
    }
  }

  function addItem() {
    setItems([...items, { name: "", cost: 0 }]);
  }

  function removeItem(index: number) {
    if (items.length <= 1) {
      setItems([{ name: "", cost: 0 }]);
      return;
    }
    setItems(items.filter((_, i) => i !== index));
  }

  function updateItem(index: number, field: keyof InvoiceItemDTO, value: string | number) {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  }

  return (
    <Modal title="Invoice" onClose={onClose} wide>
      <p className="mb-4 text-sm text-slate-500">
        {appointment.patientName} · {appointment.ref} · {formatDateLong(new Date(appointment.startAt))} ·{" "}
        {clinic.name}
      </p>
      
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Bill No.</label>
          <input className="input" value={billNo} onChange={(e) => setBillNo(e.target.value)} placeholder="088" />
        </div>
        <div>
          <label className="label">Date</label>
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Items</label>
          <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
            {items.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <input 
                  className="input flex-1" 
                  placeholder="Item Name (e.g. RCT)" 
                  value={item.name} 
                  onChange={(e) => updateItem(i, "name", e.target.value)} 
                />
                <input 
                  className="input w-24 text-right" 
                  type="number" 
                  placeholder="Cost" 
                  value={item.cost === 0 ? "" : item.cost} 
                  onChange={(e) => updateItem(i, "cost", Number(e.target.value))} 
                />
                <button type="button" className="btn-ghost text-red-500 hover:bg-red-50" onClick={() => removeItem(i)}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2">
              <button type="button" className="text-xs font-semibold text-teal hover:underline" onClick={addItem}>
                + Add Item
              </button>
              <div className="font-semibold">Total: ₹{totalAmount.toLocaleString()}</div>
            </div>
          </div>
        </div>
        
        <div>
          <label className="label">Amount in Words</label>
          <input className="input" value={amountWords} onChange={(e) => setAmountWords(e.target.value)} placeholder="Five hundred only" />
        </div>
        <div>
          <label className="label">Payment Mode</label>
          <input className="input" value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)} placeholder="Cash / UPI / Cheque" />
        </div>
      </div>
      
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button className="btn-secondary" onClick={onClose} type="button">
          Cancel
        </button>
        <button className="btn-secondary" disabled={busy} onClick={() => save(false)}>
          Save
        </button>
        <button className="btn-primary" disabled={busy} onClick={() => save(true)}>
          Save & print / PDF
        </button>
      </div>
    </Modal>
  );
}
