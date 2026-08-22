import { Component, Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Eye, RefreshCw } from "lucide-react";

/**
 * Deferred, code-split, crash-isolated container for a single plan diagram.
 *
 * Three concerns are solved here once, so no individual diagram has to:
 *
 *  1. **Bundle isolation (Requirement 12.1).** The caller passes a `load`
 *     factory — `() => import("./ScheduleGantt.jsx")` — so Vite splits that
 *     diagram into its own chunk. Nothing about the diagram is reachable from
 *     the landing or initial dashboard graph.
 *  2. **Deferred work (Requirements 12.2, 12.6).** The chunk is not requested
 *     and the component is not mounted until the container intersects the
 *     viewport, so an off-screen diagram costs nothing. Where
 *     `IntersectionObserver` does not exist, a "Show diagram" button loads it
 *     on demand — the content is always reachable, never silently dropped.
 *  3. **Containment (Requirement 12.5).** The outer container is the scroller
 *     (`overflow-x: auto; max-width: 100%`) and `minWidth` is applied to the
 *     **inner canvas only**, so a diagram wider than the panel scrolls inside
 *     its own box and the document never scrolls horizontally. A render throw
 *     is caught by the error boundary below, so one broken diagram degrades to
 *     a message instead of taking down the whole proposal step.
 *
 * Styling reuses the `panel-*` classes and the inline-style palette already
 * used across `sections/dashboard/ExecutionPlanPanel.jsx`.
 *
 * @module components/plan/DeferredViz
 */

/** Load the chunk slightly before it scrolls into view, so it feels instant. */
const DEFAULT_ROOT_MARGIN = "200px 0px";

function supportsIntersectionObserver() {
  return typeof window !== "undefined" && typeof window.IntersectionObserver === "function";
}

/**
 * Catches a render/lifecycle throw from one diagram and renders a contained
 * message in its place.
 *
 * Deliberately a class component: `getDerivedStateFromError` has no hook
 * equivalent, and colocating it here keeps the boundary and the container that
 * needs it in one file.
 */
class DiagramErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
    this.reset = this.reset.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { error: error || new Error("Unknown rendering error") };
  }

  componentDidCatch(error, info) {
    // Surfaced for diagnosis only — the user already sees the contained message.
    if (typeof this.props.onError === "function") {
      this.props.onError(error, info);
    }
  }

  reset() {
    this.setState({ error: null });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const { title } = this.props;
    return (
      <div
        role="alert"
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 8,
          padding: "12px 14px",
          borderRadius: 8,
          fontSize: 13,
          background: "#fef2f2",
          border: "1px solid #fee2e2",
          color: "#991b1b",
        }}
      >
        <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
        <div>
          <div style={{ fontWeight: 700 }}>
            {title ? `${title} could not be displayed.` : "This diagram could not be displayed."}
          </div>
          <p style={{ margin: "2px 0 8px", color: "#b91c1c" }}>
            The rest of the proposal is unaffected. The underlying data is still available in the
            other views.
          </p>
          <button type="button" className="panel-btn panel-btn--ghost" onClick={this.reset}>
            <RefreshCw size={14} /> Try again
          </button>
        </div>
      </div>
    );
  }
}

/**
 * @typedef {Object} DeferredVizProps
 * @property {() => Promise<{ default: React.ComponentType<any> }>} load
 *   Dynamic-import factory for the diagram. Must be **stable** across renders
 *   (a module-level constant or a `useCallback` result) — a new factory identity
 *   means a new lazy component, which remounts the diagram.
 * @property {string} [title] Accessible name for the region, the "Show diagram"
 *   button, and the contained error message.
 * @property {number|string} [minWidth] Minimum width of the inner canvas, so a
 *   wide diagram scrolls within this container instead of the page.
 * @property {number|string} [reserveHeight=240] Height reserved by the loading
 *   placeholder, so the chunk arriving does not shift the page.
 * @property {string} [rootMargin] `IntersectionObserver` root margin.
 * @property {string} [className] Extra classes for the outer container.
 */

/**
 * Renders `load`'s component once this container is (or is asked to be) visible.
 *
 * Every prop other than the ones listed above is forwarded to the loaded
 * component, so a diagram keeps its own `plan` / `diagnostics` / callback API.
 *
 * @param {DeferredVizProps & Record<string, any>} props
 */
export function DeferredViz({
  load,
  title,
  minWidth,
  reserveHeight = 240,
  rootMargin = DEFAULT_ROOT_MARGIN,
  className = "",
  ...rest
}) {
  const containerRef = useRef(null);
  const [visible, setVisible] = useState(false);
  // Resolved on the very first render so an unsupported environment shows its
  // "Show diagram" button immediately rather than after an empty frame.
  const [observed, setObserved] = useState(supportsIntersectionObserver);

  useEffect(() => {
    if (visible) return undefined;

    if (!supportsIntersectionObserver()) {
      setObserved(false);
      return undefined;
    }
    setObserved(true);

    const element = containerRef.current;
    if (!element) return undefined;

    const observer = new window.IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [visible, rootMargin]);

  const show = useCallback(() => setVisible(true), []);

  // `lazy` is memoised on the factory identity: recreating it every render would
  // discard the resolved module and remount the diagram on each pass.
  const LazyDiagram = useMemo(
    () => (typeof load === "function" ? lazy(load) : null),
    [load],
  );

  const placeholder = (
    <div
      aria-hidden="true"
      style={{
        minHeight: reserveHeight,
        borderRadius: 8,
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 13,
        color: "#64748b",
      }}
    >
      Loading diagram…
    </div>
  );

  let body;
  if (!LazyDiagram) {
    body = (
      <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>Nothing to display.</p>
    );
  } else if (visible) {
    body = (
      <DiagramErrorBoundary title={title}>
        <Suspense fallback={placeholder}>
          {/* min-width lives on the inner canvas only (Requirement 12.5). */}
          <div style={minWidth == null ? undefined : { minWidth }}>
            <LazyDiagram {...rest} />
          </div>
        </Suspense>
      </DiagramErrorBoundary>
    );
  } else if (observed) {
    // Intersection will mount it; reserve the space so nothing jumps.
    body = placeholder;
  } else {
    body = (
      <div
        style={{
          minHeight: reserveHeight,
          borderRadius: 8,
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          padding: 16,
          textAlign: "center",
        }}
      >
        <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
          {title ? `${title} is ready to load.` : "This diagram is ready to load."}
        </p>
        <button
          type="button"
          className="panel-btn"
          onClick={show}
          aria-label={title ? `Show diagram: ${title}` : undefined}
        >
          <Eye size={14} /> Show diagram
        </button>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={className || undefined}
      data-testid="deferred-viz"
      role="region"
      aria-label={title || undefined}
      style={{ overflowX: "auto", maxWidth: "100%" }}
    >
      {body}
    </div>
  );
}

export default DeferredViz;
