import { useEffect } from "react";
import Lenis from "lenis";

export function useSmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return undefined;
    }

    const lenis = new Lenis({
      duration: 1.05,
      smoothWheel: true,
      wheelMultiplier: 0.9,
      prevent: (node) => {
        let current = node;
        while (current && current !== document.body && current !== document.documentElement) {
          if (
            current.tagName === "TEXTAREA" ||
            current.tagName === "INPUT" ||
            current.tagName === "SELECT" ||
            current.hasAttribute?.("data-lenis-prevent") ||
            current.classList?.contains("fixflow-custom-scroll") ||
            current.classList?.contains("fixflow-modal-body") ||
            current.classList?.contains("brief-tooltip") ||
            (current.scrollHeight > current.clientHeight &&
              (window.getComputedStyle(current).overflowY === "auto" ||
               window.getComputedStyle(current).overflowY === "scroll"))
          ) {
            return true;
          }
          current = current.parentElement;
        }
        return false;
      },
    });

    let frame = 0;

    const raf = (time) => {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    };

    frame = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
    };
  }, []);
}
