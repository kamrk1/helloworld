export const OFFLINE_WRITE_MESSAGE =
  "You're offline. Reconnect to save. Phone and desktop share the live cloud calendar — nothing was stored only on this device.";

export class OfflineError extends Error {
  constructor(message = OFFLINE_WRITE_MESSAGE) {
    super(message);
    this.name = "OfflineError";
  }
}

export function isStandaloneDisplay() {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: window-controls-overlay)").matches ||
    Boolean(nav.standalone)
  );
}

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new OfflineError();
  }
  try {
    return await fetch(input, init);
  } catch {
    throw new OfflineError();
  }
}

export async function apiJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await apiFetch(input, init);
  const json = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    throw new Error(typeof json.error === "string" ? json.error : `Request failed (${res.status})`);
  }
  return json as T;
}
