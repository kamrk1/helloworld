"use client";

import { useEffect, useRef } from "react";

/**
 * Escape and hardware/browser Back close an overlay without leaving the page.
 * Pushes a dummy history entry while open; X/unmount pops it if still on top.
 */
export function useOverlayDismiss(onClose: () => void) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const tokenRef = useRef(`overlay:${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    const token = tokenRef.current;
    const prev = history.state && typeof history.state === "object" ? history.state : {};
    history.pushState({ ...prev, __clinicOverlay: token }, "");

    function isTopOverlay() {
      const state = history.state;
      return Boolean(state && typeof state === "object" && state.__clinicOverlay === token);
    }

    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (!isTopOverlay()) return;
      e.preventDefault();
      onCloseRef.current();
    }
    function onPop() {
      // Nested overlay popped back to us — stay open.
      if (isTopOverlay()) return;
      onCloseRef.current();
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("popstate", onPop);
      const state = history.state;
      if (state && typeof state === "object" && state.__clinicOverlay === token) {
        history.back();
      }
    };
  }, []);
}
