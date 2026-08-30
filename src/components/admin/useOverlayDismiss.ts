"use client";

import { useEffect, useRef } from "react";

/**
 * Escape and hardware/browser Back close an overlay without leaving the page.
 * Pushes a dummy history entry after paint so React Strict Mode remounts do not
 * immediately popstate-close the sheet.
 */
export function useOverlayDismiss(onClose: () => void) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const tokenRef = useRef(`overlay:${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    const token = tokenRef.current;
    let cancelled = false;
    let pushed = false;

    function isTopOverlay() {
      const state = history.state;
      return Boolean(state && typeof state === "object" && state.__clinicOverlay === token);
    }

    function pushEntry() {
      if (cancelled || pushed) return;
      const prev = history.state && typeof history.state === "object" ? history.state : {};
      history.pushState({ ...prev, __clinicOverlay: token }, "");
      pushed = true;
    }

    const raf = requestAnimationFrame(pushEntry);

    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (pushed && !isTopOverlay()) return;
      e.preventDefault();
      onCloseRef.current();
    }
    function onPop() {
      if (cancelled) return;
      if (isTopOverlay()) return;
      onCloseRef.current();
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("popstate", onPop);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("popstate", onPop);
      if (pushed && isTopOverlay()) {
        history.back();
      }
    };
  }, []);
}
