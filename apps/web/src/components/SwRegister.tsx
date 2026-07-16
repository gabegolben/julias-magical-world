"use client";

import { useEffect } from "react";

/** Registers the offline service worker (public/sw.js), basePath-aware. */
export function SwRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    navigator.serviceWorker.register(`${basePath}/sw.js`).catch(() => {
      // Offline support is progressive enhancement — never break the app over it.
    });
  }, []);
  return null;
}
