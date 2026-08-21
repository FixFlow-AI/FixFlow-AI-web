import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, X } from "lucide-react";
import { useLandingStore } from "../store/useLandingStore";
import {
  TOUR_STORAGE_KEY,
  TOUR_VERSION,
  coreTour,
  contextualTips,
} from "../data/clientTour";

const MOBILE_BREAKPOINT = 860;
const TARGET_TIMEOUT_MS = 1600;
const TOOLTIP_WIDTH = 344;
const GAP = 14;

/* ── persistence ──────────────────────────────────────────────────── */

function readProgress() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(TOUR_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // A version bump invalidates old progress so re-designed tours replay.
    if (parsed?.version !== TOUR_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeProgress(patch) {
  if (typeof window === "undefined") return;
  try {
    const current = readProgress() || {
      version: TOUR_VERSION,
      completed: false,
      dismissedAt: null,
      seenTips: [],
      lastStepId: null,
    };
    window.localStorage.setItem(
      TOUR_STORAGE_KEY,
      JSON.stringify({ ...current, ...patch, version: TOUR_VERSION }),
    );
  } catch {
    /* storage disabled — the tour degrades to session-only */
  }
}

function prefersReducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Snapshot of real store state used by every step's `skipIf`. */
function buildTourContext(state, sidebarCollapsed) {
  return {
    role: state.user?.role ?? null,
    dashboardTab: state.dashboardTab,
    sidebarCollapsed,
    reducedMotion: prefersReducedMotion(),
    rawBriefText: state.rawBriefText,
    isBriefParsed: state.isBriefParsed,
    briefParsing: state.briefParsing,
    parsedProposal: state.parsedProposal,
    parsedProposalId: state.parsedProposalId,
    isProposalGenerated: state.isProposalGenerated,
    confidenceResult: state.confidenceResult,
    matchResults: state.matchResults,
    matchingLoading: state.matchingLoading,
    agreementStatus: state.agreementStatus,
    escrowState: state.escrowState,
    milestoneCount: state.milestones?.length ?? 0,
    // BriefIntelligence derives its "Needs a decision" list from proposal risks.
    decisionCount: state.parsedProposal?.risks?.length ?? 0,
  };
}

/* ── positioning ──────────────────────────────────────────────────── */

function computePosition(rect, placement, isMobile) {
  if (isMobile || placement === "center") return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let top;
  let left;

  switch (placement) {
    case "right":
      top = rect.top + rect.height / 2;
      left = rect.right + GAP;
      break;
    case "left":
      top = rect.top + rect.height / 2;
      left = rect.left - GAP - TOOLTIP_WIDTH;
      break;
    case "top":
      top = rect.top - GAP;
      left = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2;
      break;
    case "bottom":
    default:
      top = rect.bottom + GAP;
      left = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2;
      break;
  }

  // Flip horizontally if the preferred side would overflow the viewport.
  if (left < 12) {
    left = placement === "left" ? rect.right + GAP : 12;
  }
  if (left + TOOLTIP_WIDTH > vw - 12) {
    left =
      placement === "right"
        ? Math.max(12, rect.left - GAP - TOOLTIP_WIDTH)
        : vw - TOOLTIP_WIDTH - 12;
  }

  const verticalAnchor =
    placement === "left" || placement === "right"
      ? "middle"
      : placement === "top"
        ? "end"
        : "start";

  return {
    top: Math.min(Math.max(top, 12), vh - 12),
    left,
    verticalAnchor,
  };
}

/* ── component ────────────────────────────────────────────────────── */

export function ProductTour({ sidebarCollapsed = false }) {
  const store = useLandingStore();
  const { user, dashboardTab, setDashboardTab } = store;

  const [activeTrack, setActiveTrack] = useState(null); // "core" | "tip" | null
  const [stepIndex, setStepIndex] = useState(0);
  const [activeTip, setActiveTip] = useState(null);
  const [rect, setRect] = useState(null);
  const [missingTarget, setMissingTarget] = useState(false);

  const tooltipRef = useRef(null);
  const lastFocused = useRef(null);
  const isClient = user?.role === "client";

  const isMobile =
    typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT;

  const ctx = useMemo(
    () => buildTourContext(store, sidebarCollapsed),
    [store, sidebarCollapsed],
  );

  const step =
    activeTrack === "core"
      ? coreTour[stepIndex]
      : activeTrack === "tip"
        ? activeTip
        : null;

  /* ── replay requests from the topbar Help button ── */
  useEffect(() => {
    const onRestart = () => {
      setActiveTip(null);
      setStepIndex(0);
      setActiveTrack("core");
    };
    window.addEventListener("ff:tour-restart", onRestart);
    return () => window.removeEventListener("ff:tour-restart", onRestart);
  }, []);

  /* ── start the core tour for brand-new client accounts ── */
  useEffect(() => {
    if (!isClient || activeTrack) return;
    const progress = readProgress();
    if (progress?.completed || progress?.dismissedAt) return;

    // Resume mid-tour if the user reloaded partway through.
    const resumeAt = progress?.lastStepId
      ? coreTour.findIndex((s) => s.id === progress.lastStepId)
      : 0;
    setStepIndex(resumeAt > 0 ? resumeAt : 0);
    setActiveTrack("core");
  }, [isClient, activeTrack]);

  /* ── fire a one-time contextual tip on first visit to a tab ── */
  useEffect(() => {
    if (!isClient || activeTrack) return;
    const progress = readProgress();
    // Contextual tips only make sense after the intro is finished or dismissed.
    if (!progress?.completed && !progress?.dismissedAt) return;

    const tip = contextualTips.find((t) => t.tab === dashboardTab);
    if (!tip) return;
    if (progress?.seenTips?.includes(tip.id)) return;
    if (tip.skipIf?.(ctx)) return;

    setActiveTip(tip);
    setActiveTrack("tip");
  }, [isClient, activeTrack, dashboardTab, ctx]);

  /* ── auto-skip steps whose precondition is already satisfied ── */
  useEffect(() => {
    if (activeTrack !== "core" || !step) return;
    if (!step.skipIf?.(ctx)) return;

    if (stepIndex < coreTour.length - 1) {
      setStepIndex((i) => i + 1);
    } else {
      finish();
    }
    // `finish` is stable via useCallback below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTrack, step, ctx, stepIndex]);

  /* ── navigate to the tab a step belongs to ── */
  useEffect(() => {
    if (!step?.tab || step.tab === dashboardTab) return;
    setDashboardTab(step.tab);
    window.location.hash = `#/dashboard/${step.tab}`;
  }, [step, dashboardTab, setDashboardTab]);

  /* ── resolve + track the target element ── */
  useEffect(() => {
    if (!step) return undefined;

    if (step.placement === "center") {
      setRect(null);
      setMissingTarget(false);
      return undefined;
    }

    let raf = 0;
    let settled = false;
    let prev = null;
    const startedAt = Date.now();

    const changed = (a, b) =>
      !a ||
      Math.abs(a.top - b.top) > 0.5 ||
      Math.abs(a.left - b.left) > 0.5 ||
      Math.abs(a.width - b.width) > 0.5 ||
      Math.abs(a.height - b.height) > 0.5;

    const locate = () => {
      const el = document.querySelector(step.target);
      if (el) {
        settled = true;
        setMissingTarget(false);
        el.scrollIntoView({
          behavior: ctx.reducedMotion ? "auto" : "smooth",
          block: "center",
          inline: "nearest",
        });
        // Follow the target through scroll/layout shifts, but only re-render
        // when the box actually moves — otherwise this is 60 setStates/sec.
        const track = () => {
          const nextEl = document.querySelector(step.target);
          if (nextEl) {
            const box = nextEl.getBoundingClientRect();
            if (changed(prev, box)) {
              prev = box;
              setRect(box);
            }
          }
          raf = window.requestAnimationFrame(track);
        };
        track();
        return;
      }
      // Panel may still be mounting — retry briefly, then give up gracefully
      // rather than blocking the whole queue on one missing selector.
      if (Date.now() - startedAt < TARGET_TIMEOUT_MS) {
        raf = window.requestAnimationFrame(locate);
      } else if (!settled) {
        console.warn(`[ProductTour] target not found: ${step.target}`);
        setMissingTarget(true);
      }
    };

    locate();
    return () => window.cancelAnimationFrame(raf);
  }, [step, ctx.reducedMotion]);

  /* ── a step whose target never appeared is dropped, not retried ── */
  useEffect(() => {
    if (!missingTarget) return;
    if (activeTrack === "core") {
      if (stepIndex < coreTour.length - 1) setStepIndex((i) => i + 1);
      else finish();
    } else {
      dismissTip();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missingTarget]);

  /* ── actions ── */

  const close = useCallback(() => {
    setActiveTrack(null);
    setActiveTip(null);
    setRect(null);
    setMissingTarget(false);
    lastFocused.current?.focus?.();
  }, []);

  const finish = useCallback(() => {
    writeProgress({ completed: true, lastStepId: null });
    close();
  }, [close]);

  const dismissAll = useCallback(() => {
    writeProgress({ dismissedAt: new Date().toISOString(), lastStepId: null });
    close();
  }, [close]);

  const dismissTip = useCallback(() => {
    if (!activeTip) return close();
    const progress = readProgress();
    const seen = new Set(progress?.seenTips ?? []);
    seen.add(activeTip.id);
    writeProgress({ seenTips: [...seen] });
    close();
  }, [activeTip, close]);

  const next = useCallback(() => {
    if (activeTrack === "tip") return dismissTip();
    if (stepIndex >= coreTour.length - 1) return finish();
    const target = coreTour[stepIndex + 1];
    writeProgress({ lastStepId: target.id });
    setStepIndex((i) => i + 1);
  }, [activeTrack, stepIndex, dismissTip, finish]);

  const back = useCallback(() => {
    if (activeTrack !== "core" || stepIndex === 0) return;
    const target = coreTour[stepIndex - 1];
    writeProgress({ lastStepId: target.id });
    setStepIndex((i) => i - 1);
  }, [activeTrack, stepIndex]);

  /* ── keyboard + focus ── */
  useEffect(() => {
    if (!step) return undefined;
    lastFocused.current = document.activeElement;
    tooltipRef.current?.focus();

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        activeTrack === "tip" ? dismissTip() : dismissAll();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        next();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        back();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [step, activeTrack, next, back, dismissTip, dismissAll]);

  if (!isClient || !step) return null;

  const position = rect
    ? computePosition(rect, step.placement, isMobile)
    : null;
  const centered = !position;
  const isCore = activeTrack === "core";

  return (
    <div className="tour-root" role="presentation">
      <div
        className="tour-scrim"
        onClick={isCore ? dismissAll : dismissTip}
        aria-hidden="true"
      />

      {rect && !isMobile && (
        <div
          className="tour-spotlight"
          aria-hidden="true"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
          }}
        />
      )}

      <div
        className={`tour-tooltip${centered ? " tour-tooltip--centered" : ""}${
          isMobile ? " tour-tooltip--sheet" : ""
        }`}
        ref={tooltipRef}
        role="dialog"
        aria-modal="false"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        tabIndex={-1}
        style={
          centered || isMobile
            ? undefined
            : {
                top: position.top,
                left: position.left,
                transform:
                  position.verticalAnchor === "middle"
                    ? "translateY(-50%)"
                    : position.verticalAnchor === "end"
                      ? "translateY(-100%)"
                      : "none",
              }
        }
      >
        <div className="tour-tooltip-head">
          {isCore && (
            <span className="tour-progress">
              Step {stepIndex + 1} of {coreTour.length}
            </span>
          )}
          {!isCore && <span className="tour-progress">Quick tip</span>}
          <button
            className="tour-close"
            type="button"
            onClick={isCore ? dismissAll : dismissTip}
            aria-label={isCore ? "Skip the tour" : "Dismiss tip"}
          >
            <X aria-hidden="true" size={15} />
          </button>
        </div>

        <h2 className="tour-title" id="tour-title">
          {step.title}
        </h2>
        <p className="tour-body" id="tour-body">
          {step.tooltip}
        </p>

        <div className="tour-actions">
          {isCore && stepIndex > 0 && (
            <button className="tour-btn tour-btn--quiet" type="button" onClick={back}>
              Back
            </button>
          )}
          {isCore && (
            <button className="tour-btn tour-btn--text" type="button" onClick={dismissAll}>
              Skip tour
            </button>
          )}
          <button className="tour-btn tour-btn--primary" type="button" onClick={next}>
            {step.nextLabel}
            <ArrowRight aria-hidden="true" size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

/** Clears saved progress so the tour can be replayed from the Help button. */
export function restartClientTour() {
  writeProgress({
    completed: false,
    dismissedAt: null,
    seenTips: [],
    lastStepId: null,
  });
  window.dispatchEvent(new CustomEvent("ff:tour-restart"));
}
