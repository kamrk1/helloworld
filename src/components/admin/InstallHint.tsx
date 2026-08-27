"use client";

import { useEffect, useState } from "react";
import { Share, X } from "lucide-react";
import { isStandaloneDisplay } from "@/lib/api-client";

const DISMISS_KEY = "sdc-install-dismissed";

export function InstallHint() {
  const [visible, setVisible] = useState(false);
  const [ios, setIos] = useState(false);
  const [deferred, setDeferred] = useState<{ prompt: () => Promise<void> } | null>(null);

  useEffect(() => {
    if (isStandaloneDisplay()) return;
    if (localStorage.getItem(DISMISS_KEY)) return;
    const ua = navigator.userAgent;
    const isIos = /iphone|ipad|ipod/i.test(ua) && !("MSStream" in window);
    setIos(isIos);

    const onBip = (event: Event) => {
      event.preventDefault();
      const e = event as Event & { prompt: () => Promise<void> };
      setDeferred(e);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    if (isIos) setVisible(true);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  if (!visible) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    setVisible(false);
  }

  return (
    <div className="mx-3 mb-3 rounded-xl border border-teal/20 bg-teal-50 px-3 py-2.5 text-xs text-teal-dark">
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 leading-snug">
          {ios ? (
            <>
              Install this app: tap <Share className="inline h-3.5 w-3.5" /> then{" "}
              <span className="font-semibold">Add to Home Screen</span>.
            </>
          ) : (
            <>Install Shree Datta Dental Care on this device for a full-screen calendar.</>
          )}
        </p>
        <button className="btn-ghost px-1 py-0 text-slate-400" onClick={dismiss} aria-label="Dismiss">
          <X className="h-4 w-4" />
        </button>
      </div>
      {deferred && (
        <button className="btn-primary mt-2 w-full py-1.5 text-xs" onClick={() => void install()}>
          Install app
        </button>
      )}
    </div>
  );
}
