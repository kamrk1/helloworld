import type { CapacitorConfig } from "@capacitor/cli";

const LIVE_HOST = "proud-truth-84df.kamrk1.workers.dev";

/**
 * Native WebView shell around the live multi-tenant clinic admin.
 * Start URL is generic /login (clinic ID + password) so one APK serves every customer.
 * Do not bake a single clinic slug into the start URL.
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
    url: `https://${LIVE_HOST}/login`,
    cleartext: false,
    androidScheme: "https",
    allowNavigation: [LIVE_HOST],
    errorPath: "error.html",
  },
};

export default config;
