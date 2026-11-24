"use client";

import { useEffect } from "react";

/** Registers the offline-page service worker in production builds. */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // Not critical: the app works without it.
    });
  }, []);
  return null;
}
