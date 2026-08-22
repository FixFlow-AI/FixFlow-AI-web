import { mapLabel } from "./encoding";

/**
 * The legend that makes a diagram's encoding readable as words.
 *
 * `encoding.js` guarantees every state carries a glyph (or, for graph edges, a
 * stroke pattern plus an arrowhead shape) *and* a word. This component is the
 * place those pairs are spelled out, so nothing in a diagram is communicated
 * by colour alone (Requirement 12.3): each row shows the non-colour channel,
 * the state's word, and the sentence explaining what it means.
 *
 * It is purely informational — no focus, no handlers, no tab stops — so it
 * never competes with the diagram it describes for keyboard attention.
 *
 * @module components/plan/DiagramLegend
 */

/** Arrowhead paths, drawn at the end of the stroke sample. `markerShape` → path. */
const MARKERS = {
  "filled-arrow": { d: "M0 0 L9 4.5 L0 9 Z", filled: true },
  "open-arrow": { d: "M0 0 L9 4.5 L0 9", filled: false },
  diamond: { d: "M0 4.5 L4.5 0 L9 4.5 L4.5 9 Z", filled: true },
  "hollow-arrow": { d: "M0 0 L9 4.5 L0 9 Z", filled: false },
};

/**
 * Normalise the `map` / `maps` props into groups to render.
 *
 * @param {Object|Object[]|null|undefined} input One presentation map, or several.
 * @returns {{label: string, entries: Object[]}[]} Groups with at least one entry.
 */
function toGroups(input) {
  const maps = (Array.isArray(input) ? input : [input]).filter(
    (candidate) => candidate && typeof candidate === "object",
  );

  return maps
    .map((map) => ({ label: mapLabel(map), entries: Object.values(map) }))
    .filter((group) => group.entries.length > 0);
}

/**
 * A stroke sample for an edge kind, showing the real dash pattern and
 * arrowhead rather than a stand-in glyph. Decorative: the word next to it
 * carries the meaning.
 *
 * @param {{entry: Object}} props An entry from `EDGE_KINDS`.
 * @returns {JSX.Element}
 */
function EdgeSample({ entry }) {
  const marker = MARKERS[entry.markerShape] || MARKERS["filled-arrow"];
  return (
    <svg width={44} height={11} viewBox="0 0 44 11" aria-hidden="true" focusable="false" style={{ flexShrink: 0 }}>
      <line
        x1={1}
        y1={5.5}
        x2={33}
        y2={5.5}
        stroke={entry.color}
        strokeWidth={2}
        strokeDasharray={entry.strokeDasharray}
      />
      <path
        d={marker.d}
        transform="translate(33 1)"
        fill={marker.filled ? entry.color : "#ffffff"}
        stroke={entry.color}
        strokeWidth={1.2}
      />
    </svg>
  );
}

/**
 * A glyph sample for every non-edge state, in the state's own colours — the
 * glyph itself is the non-colour channel.
 *
 * @param {{entry: Object}} props An entry from any presentation map.
 * @returns {JSX.Element}
 */
function GlyphSample({ entry }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 20,
        height: 20,
        flexShrink: 0,
        borderRadius: 4,
        fontSize: 12,
        lineHeight: 1,
        background: entry.bg,
        border: `1px solid ${entry.border}`,
        color: entry.color,
      }}
    >
      {entry.glyph}
    </span>
  );
}

/**
 * @param {Object} props
 * @param {Object} [props.map] A single presentation map from `encoding.js`.
 * @param {Object|Object[]} [props.maps] Several maps, rendered as labelled groups.
 * @param {string} [props.title] Heading for the whole legend; pass `null` to omit.
 * @returns {JSX.Element|null} `null` only when handed no usable map at all.
 */
export function DiagramLegend({ map, maps, title = "Legend" }) {
  const groups = toGroups(map ?? maps);
  if (groups.length === 0) return null;

  return (
    <div className="panel-card" style={{ padding: 12 }}>
      {title && (
        <h4 style={{ fontSize: 12, fontWeight: 700, margin: "0 0 8px", color: "#334155" }}>{title}</h4>
      )}
      <div style={{ display: "grid", gap: 10 }}>
        {groups.map((group) => (
          <div key={group.label}>
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: 0.5,
                textTransform: "uppercase",
                color: "#94a3b8",
              }}
            >
              {group.label}
            </span>
            <dl
              style={{
                margin: "5px 0 0",
                display: "grid",
                gridTemplateColumns: "auto 1fr",
                alignItems: "baseline",
                gap: "4px 10px",
                fontSize: 12.5,
              }}
            >
              {group.entries.map((entry) => (
                <div key={entry.key} style={{ display: "contents" }}>
                  <dt style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600, color: "#334155" }}>
                    {entry.markerShape ? <EdgeSample entry={entry} /> : <GlyphSample entry={entry} />}
                    {entry.word}
                  </dt>
                  <dd style={{ margin: 0, color: "#64748b" }}>{entry.description}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}

export default DiagramLegend;
