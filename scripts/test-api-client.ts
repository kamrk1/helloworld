/**
 * Offline vs unreachable vs 5xx copy for API client + admin banner.
 *   npx tsx scripts/test-api-client.ts
 */
import {
  errorAfterFetchFailure,
  errorFromHttpResponse,
  isNavigatorOffline,
  OfflineError,
  OFFLINE_WRITE_MESSAGE,
  reachabilityBanner,
  SERVER_ERROR_MESSAGE,
  UNREACHABLE_BANNER,
  UNREACHABLE_MESSAGE,
  UnreachableError,
} from "../src/lib/api-client";

function assert(cond: unknown, msg: string) {
  if (!cond) {
    console.error("FAIL", msg);
    process.exit(1);
  }
}

assert(isNavigatorOffline(false) === true, "navigator.onLine false is offline");
assert(isNavigatorOffline(true) === false, "navigator.onLine true is not offline");
assert(isNavigatorOffline(undefined) === false, "unknown navigator is not treated as offline");

const offlineErr = errorAfterFetchFailure(false);
assert(offlineErr instanceof OfflineError, "fetch throw while offline is OfflineError");
assert(offlineErr.message === OFFLINE_WRITE_MESSAGE, "offline fetch uses offline copy");
assert(!offlineErr.message.toLowerCase().includes("can't reach"), "offline copy is not unreachable copy");

const timeoutOnline = errorAfterFetchFailure(true);
assert(!(timeoutOnline instanceof OfflineError), "fetch throw while online is not OfflineError");
assert(!(timeoutOnline instanceof UnreachableError), "timeout while online is not the unreachable banner error");
assert(timeoutOnline.message === SERVER_ERROR_MESSAGE, "timeout while online keeps Clinic server error copy");
assert(!/offline/i.test(timeoutOnline.message), "online fetch failure must not say offline");
assert(!/can't reach/i.test(timeoutOnline.message), "online timeout must not show can't-reach copy");

const unknownErr = errorAfterFetchFailure(undefined);
assert(unknownErr instanceof UnreachableError, "unknown online status is treated as unreachable, not offline");
assert(!/offline/i.test(unknownErr.message), "unknown status must not say offline");
assert(unknownErr.message === UNREACHABLE_MESSAGE, "unknown status uses can't-reach copy");

const serverErr = errorFromHttpResponse(502);
assert(!(serverErr instanceof OfflineError), "502 is not OfflineError");
assert(serverErr.message === SERVER_ERROR_MESSAGE, "502 without body uses server error copy");
assert(!/offline/i.test(serverErr.message), "502 must not say offline");

const serverBody = errorFromHttpResponse(500, "Database unavailable");
assert(serverBody.message === "Database unavailable", "5xx uses JSON error when present");
assert(!/offline/i.test(serverBody.message), "5xx JSON error must not say offline");

const notFound = errorFromHttpResponse(404);
assert(notFound.message === "Request failed (404)", "4xx without body keeps status message");

const notFoundBody = errorFromHttpResponse(401, "Wrong password");
assert(notFoundBody.message === "Wrong password", "4xx uses JSON error when present");

assert(
  reachabilityBanner({
    online: false,
    serverUnreachable: true,
    fromCache: true,
    refreshing: false,
  }) === "offline",
  "banner is Offline only when navigator is offline",
);
assert(
  reachabilityBanner({
    online: true,
    serverUnreachable: true,
    fromCache: true,
    refreshing: false,
  }) === null,
  "failed snapshot while online must not show Can't reach server banner",
);
assert(
  UNREACHABLE_BANNER.toLowerCase().includes("can't reach server"),
  "unreachable banner mentions can't reach server",
);
assert(!/offline/i.test(UNREACHABLE_BANNER), "unreachable banner must not say Offline");
assert(
  reachabilityBanner({
    online: true,
    serverUnreachable: false,
    fromCache: true,
    refreshing: true,
  }) === "updating",
  "cached calendar while refreshing shows updating",
);
assert(
  reachabilityBanner({
    online: true,
    serverUnreachable: false,
    fromCache: false,
    refreshing: false,
  }) === null,
  "live snapshot has no banner",
);

assert(
  reachabilityBanner({
    online: true,
    serverUnreachable: true,
    fromCache: false,
    refreshing: false,
  }) === null,
  "5xx while online does not show the unreachable banner",
);

console.log("ok");
