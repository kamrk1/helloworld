export const OFFLINE_WRITE_MESSAGE =
  "You're offline. Reconnect to save. Phone and desktop share the live cloud calendar — nothing was stored only on this device.";

export const UNREACHABLE_MESSAGE = "Can't reach the clinic server. Try again.";

export const SERVER_ERROR_MESSAGE = "Clinic server error. Try again.";

export const UNREACHABLE_BANNER = "Can't reach server — showing last saved calendar.";

export class OfflineError extends Error {
  constructor(message = OFFLINE_WRITE_MESSAGE) {
    super(message);
    this.name = "OfflineError";
  }
}

export class UnreachableError extends Error {
  constructor(message = UNREACHABLE_MESSAGE) {
    super(message);
    this.name = "UnreachableError";
  }
}

/** True only when the browser reports no network. */
export function isNavigatorOffline(onLine: boolean | undefined): boolean {
  return onLine === false;
}

/** Classify a thrown fetch/network failure. Never calls the user “offline” while they are online. */
export function errorAfterFetchFailure(onLine: boolean | undefined): Error {
  if (isNavigatorOffline(onLine)) return new OfflineError();
  return new UnreachableError();
}

/** Classify an HTTP error response. 5xx is a server error, not offline. */
export function errorFromHttpResponse(status: number, jsonError?: string): Error {
  const fromBody = typeof jsonError === "string" && jsonError.trim() ? jsonError.trim() : undefined;
  if (status >= 500) {
    return new Error(fromBody ?? SERVER_ERROR_MESSAGE);
  }
  return new Error(fromBody ?? `Request failed (${status})`);
}

export type ReachabilityBanner = "offline" | "unreachable" | "updating" | null;

export function reachabilityBanner(opts: {
  online: boolean;
  serverUnreachable: boolean;
  fromCache: boolean;
  refreshing: boolean;
}): ReachabilityBanner {
  if (!opts.online) return "offline";
  if (opts.refreshing && opts.fromCache) return "updating";
  if (opts.serverUnreachable) return "unreachable";
  return null;
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

function navigatorOnLine(): boolean | undefined {
  return typeof navigator === "undefined" ? undefined : navigator.onLine;
}

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (isNavigatorOffline(navigatorOnLine())) {
    throw new OfflineError();
  }
  try {
    return await fetch(input, init);
  } catch {
    throw errorAfterFetchFailure(navigatorOnLine());
  }
}

export async function apiJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await apiFetch(input, init);
  const json = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    throw errorFromHttpResponse(res.status, typeof json.error === "string" ? json.error : undefined);
  }
  return json as T;
}
