import type { CapacitorConfig } from "@capacitor/cli";

const LIVE_HOST = "proud-truth-84df.kamrk1.workers.dev";

/**
 * Native WebView shell around the live clinic admin.
 * Start URL is /admin (same as the PWA). Do not start at / (public booking)
 * or /login. Unauthenticated first launch may redirect /admin → /login once,
 * then return to /admin after sign-in.
 */
const config: CapacitorConfig = {
  appId: "care.shreedatta.clinic",
  appName: "SDC Clinic",
  webDir: "www",
  backgroundColor: "#F7F5F2",
  android: {
    allowMixedContent: false,
    backgroundColor: "#F7F5F2",
  },
  server: {
    url: `https://${LIVE_HOST}/admin`,
    cleartext: false,
    androidScheme: "https",
    allowNavigation: [LIVE_HOST],
    errorPath: "error.html",
  },
};

export default config;
