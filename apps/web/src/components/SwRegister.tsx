"use client";

import { useEffect } from "react";

/** Registers the offline service worker (public/sw.js), basePath-aware. */
export function SwRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // Never in dev: cache-first assets would serve stale hot-reload chunks.
    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister()));
      return;
    }
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    navigator.serviceWorker.register(`${basePath}/sw.js`).catch(() => {
      // Offline support is progressive enhancement — never break the app over it.
    });
  }, []);
  return null;
}
