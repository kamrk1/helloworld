/** Normalize to 10-digit Indian mobile when possible. */
export function normalizePhone(input: string) {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits;
}

export function displayPhone(phone: string) {
  const n = normalizePhone(phone);
  if (n.length === 10) return `+91 ${n.slice(0, 5)} ${n.slice(5)}`;
  return phone;
}

export function waLink(phone: string, text?: string) {
  const n = normalizePhone(phone);
  const e164 = n.length === 10 ? `91${n}` : n;
  const base = `https://wa.me/${e164}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

export function telLink(phone: string) {
  const n = normalizePhone(phone);
  return n.length === 10 ? `tel:+91${n}` : `tel:${n}`;
}

export function isValidPhone(phone: string) {
  return /^\d{10}$/.test(normalizePhone(phone));
}
