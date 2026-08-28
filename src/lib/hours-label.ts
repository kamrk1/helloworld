const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function closedDaysLabel(closedWeekdays: number[]) {
  const names = closedWeekdays
    .filter((d) => d >= 0 && d <= 6)
    .sort((a, b) => a - b)
    .map((d) => DAY_NAMES[d]);
  if (names.length === 0) return "Open every day";
  if (names.length === 1) return `${names[0]} closed`;
  return `${names.join(" / ")} closed`;
}

export function openDaysLabel(closedWeekdays: number[]) {
  const open = DAY_NAMES.filter((_, i) => !closedWeekdays.includes(i));
  if (open.length === 7) return "Every day";
  if (open.length === 6 && closedWeekdays.length === 1) {
    return `${DAY_NAMES[(closedWeekdays[0] + 1) % 7]}–${DAY_NAMES[(closedWeekdays[0] + 6) % 7]}`;
  }
  return open.join(", ");
}

export function hhmmDuration(minutes: number) {
  const m = Math.max(5, Math.round(minutes));
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}:00`;
}

export function snapToAllowed(minutes: number, allowed: number[]) {
  const list = allowed.length ? allowed : [30];
  return list.reduce((best, n) => (Math.abs(n - minutes) < Math.abs(best - minutes) ? n : best), list[0]);
}
