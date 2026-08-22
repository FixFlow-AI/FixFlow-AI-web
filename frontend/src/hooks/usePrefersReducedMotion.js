import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function getMediaQueryList() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return null;
  }

  try {
    return window.matchMedia(QUERY);
  } catch {
    return null;
  }
}

function readPreference() {
  const mediaQueryList = getMediaQueryList();
  // No matchMedia (SSR, jsdom without a stub, very old browsers) means we cannot
  // know the user's preference, so we default to reduced motion — the safe choice.
  if (!mediaQueryList) return true;
  return Boolean(mediaQueryList.matches);
}

/**
 * Tracks the user's `prefers-reduced-motion` setting.
 *
 * Returns `true` when motion should be reduced. Defaults to `true` when
 * `matchMedia` is unavailable, and stays in sync with runtime changes to the
 * OS/browser setting.
 *
 * @returns {boolean} whether animations should be suppressed
 */
export function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(readPreference);

  useEffect(() => {
    const mediaQueryList = getMediaQueryList();

    if (!mediaQueryList) {
      setPrefersReducedMotion(true);
      return undefined;
    }

    setPrefersReducedMotion(Boolean(mediaQueryList.matches));

    const onChange = (event) => {
      setPrefersReducedMotion(Boolean(event?.matches ?? mediaQueryList.matches));
    };

    // Safari < 14 and older jsdom builds only expose the legacy listener API.
    if (typeof mediaQueryList.addEventListener === "function") {
      mediaQueryList.addEventListener("change", onChange);
      return () => mediaQueryList.removeEventListener("change", onChange);
    }

    if (typeof mediaQueryList.addListener === "function") {
      mediaQueryList.addListener(onChange);
      return () => mediaQueryList.removeListener(onChange);
    }

    return undefined;
  }, []);

  return prefersReducedMotion;
}

export default usePrefersReducedMotion;
