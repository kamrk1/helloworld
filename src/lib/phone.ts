/** Normalize to 10-digit Indian mobile when possible. */
export function normalizePhone(input: string | null | undefined) {
  if (input == null) return "";
  const digits = String(input).replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits;
}

/** Persist missing staff phones as NULL — never "". */
export function phoneToStore(input: string | null | undefined): string | null {
  const n = normalizePhone(input);
  return n ? n : null;
}

export function hasMobile(phone?: string | null) {
  return isValidPhone(phone ?? "");
}

export function displayPhone(phone?: string | null) {
  if (phone == null || String(phone).trim() === "") return "";
  const n = normalizePhone(phone);
  if (n.length === 10) return `+91 ${n.slice(0, 5)} ${n.slice(5)}`;
  return phone;
}

export function waLink(phone?: string | null, text?: string) {
  const n = normalizePhone(phone);
  const e164 = n.length === 10 ? `91${n}` : n;
  const base = `https://wa.me/${e164}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

export function telLink(phone?: string | null) {
  const n = normalizePhone(phone);
  return n.length === 10 ? `tel:+91${n}` : `tel:${n}`;
}

export function isValidPhone(phone?: string | null) {
  return /^\d{10}$/.test(normalizePhone(phone));
}
