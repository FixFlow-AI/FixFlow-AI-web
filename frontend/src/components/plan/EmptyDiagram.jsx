import { isValidElement } from "react";
import { Boxes } from "lucide-react";

/**
 * The empty state every plan diagram falls back to.
 *
 * A section whose inputs are absent must **explain itself and offer a way
 * forward** — never a blank container (Requirements 4.5, 10.5, 11.2, 11.4).
 * So this component has one hard invariant: it always renders a sentence, and
 * it renders an affordance whenever the caller can name one.
 *
 * `reason` normally comes straight from `sectionAvailability()` in
 * `lib/plan/selectors.js`, which returns `{ available, reason }` per section —
 * either the `reason` string or the whole section state may be passed, so a
 * caller cannot accidentally render an empty box by handing over the wrong
 * half of that object.
 *
 * Missing sections are independent: rendering this for one section says
 * nothing about its siblings, which keep rendering their own data (R11.4).
 *
 * @module components/plan/EmptyDiagram
 */

/** Used only when a caller supplies no usable reason at all. */
const FALLBACK_REASON = "This section has no data to show yet.";

/**
 * Pull a displayable sentence out of whatever the caller passed.
 *
 * @param {unknown} reason A string, a `{reason}` section state, or nothing.
 * @returns {string} Always a non-empty sentence.
 */
function resolveReason(reason) {
  if (typeof reason === "string" && reason.trim()) return reason.trim();
  if (reason && typeof reason === "object" && typeof reason.reason === "string" && reason.reason.trim()) {
    return reason.reason.trim();
  }
  return FALLBACK_REASON;
}

/**
 * Render the optional affordance.
 *
 * Accepts either a ready-made node (for anything richer than a button) or a
 * `{ label, onClick, disabled }` spec, which becomes the same `panel-btn` the
 * rest of the plan panel uses.
 *
 * @param {import('react').ReactNode|{label?: string, onClick?: Function, disabled?: boolean}} action
 * @returns {import('react').ReactNode|null} `null` when there is nothing to offer.
 */
function renderAction(action) {
  if (!action) return null;
  if (isValidElement(action)) return action;
  if (typeof action !== "object") return null;

  const label = typeof action.label === "string" ? action.label.trim() : "";
  if (!label) return null;

  return (
    <button
      type="button"
      className="panel-btn"
      onClick={action.onClick}
      disabled={Boolean(action.disabled)}
    >
      {label}
    </button>
  );
}

/**
 * @param {Object} props
 * @param {string|{reason?: string|null}} [props.reason] Why the section is empty.
 * @param {import('react').ReactNode|{label?: string, onClick?: Function, disabled?: boolean}} [props.action]
 *   Optional way out — typically "Generate architecture" or "Generate detailed plan".
 * @param {string} [props.title] Short heading above the reason.
 * @param {import('react').ComponentType<{size?: number, style?: Object}>} [props.icon]
 *   Decorative `lucide-react` icon; defaults to the panel's `Boxes`.
 * @returns {JSX.Element}
 */
export function EmptyDiagram({ reason, action, title = "Nothing to show here yet", icon: Icon = Boxes }) {
  const sentence = resolveReason(reason);
  const affordance = renderAction(action);

  return (
    <div className="panel-card" style={{ textAlign: "center", padding: 24 }}>
      {Icon && <Icon size={26} style={{ color: "#94a3b8", marginBottom: 6 }} aria-hidden="true" />}
      <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 6px", color: "#0f172a" }}>{title}</h3>
      <p style={{ fontSize: 13.5, color: "#64748b", margin: affordance ? "0 0 14px" : 0, maxWidth: 460, marginInline: "auto" }}>
        {sentence}
      </p>
      {affordance}
    </div>
  );
}

export default EmptyDiagram;
