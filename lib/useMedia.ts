"use client";

import { useSyncExternalStore } from "react";

/** Subscribe to a media query. Returns false during server render. */
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export const useReducedMotion = () => useMediaQuery("(prefers-reduced-motion: reduce)");
export const useReducedTransparency = () => useMediaQuery("(prefers-reduced-transparency: reduce)");

const noop = () => () => {};

/** Chromium is the only engine that renders SVG filters inside backdrop-filter. */
export function useBackdropUrlSupport() {
  return useSyncExternalStore(
    noop,
    () => {
      const ua = navigator.userAgent;
      return /Chrome\/|Chromium\/|Edg\//.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
    },
    () => false,
  );
}
