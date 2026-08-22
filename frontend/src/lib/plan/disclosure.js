/**
 * Progressive disclosure helper (pure — no React, no DOM).
 *
 * Every "show more" affordance in the plan surfaces goes through `discloseSlice`
 * so a long list is never silently truncated: the caller always knows how many
 * items are still hidden (Requirement 10.3).
 *
 * Invariants guaranteed for *any* input, however malformed:
 *   - `visible.length + remaining === total`
 *   - `visible` is a prefix of the original list, in the original order
 *   - increasing `pagesShown` eventually reveals every item
 *
 * @module lib/plan/disclosure
 */

/**
 * Page size used when the caller supplies one that cannot be honoured
 * (missing, non-numeric, zero, negative, or non-finite).
 * @type {number}
 */
export const DEFAULT_PAGE_SIZE = 5;

/**
 * Result of one disclosure step.
 *
 * @template T
 * @typedef {Object} DisclosedSlice
 * @property {T[]} visible   Items to render now — a prefix of the input list.
 * @property {number} remaining Items still hidden; `0` when everything is shown.
 * @property {number} total  Total number of items in the input list.
 * @property {boolean} hasMore Whether another disclosure step would reveal more.
 */

/**
 * Coerce an arbitrary value into a usable positive integer page size.
 *
 * Fractional values are floored (2.7 → 2); anything that cannot yield a
 * positive integer falls back to {@link DEFAULT_PAGE_SIZE} so disclosure always
 * makes progress.
 *
 * @param {unknown} pageSize
 * @returns {number} A positive integer, or `Infinity` if the caller asked for it.
 */
function normalizePageSize(pageSize) {
  if (typeof pageSize !== 'number' || Number.isNaN(pageSize)) return DEFAULT_PAGE_SIZE;
  if (pageSize === Infinity) return Infinity;
  const floored = Math.floor(pageSize);
  return floored >= 1 ? floored : DEFAULT_PAGE_SIZE;
}

/**
 * Coerce an arbitrary value into a page count of at least one, so the first
 * page is always disclosed.
 *
 * @param {unknown} pagesShown
 * @returns {number} A positive integer, or `Infinity` if the caller asked for it.
 */
function normalizePagesShown(pagesShown) {
  if (typeof pagesShown !== 'number' || Number.isNaN(pagesShown)) return 1;
  if (pagesShown === Infinity) return Infinity;
  const floored = Math.floor(pagesShown);
  return floored >= 1 ? floored : 1;
}

/**
 * Disclose the first `pageSize * pagesShown` items of a list, reporting exactly
 * how much is still hidden.
 *
 * Defensive by design: a non-array `items` is treated as an empty list, an
 * unusable `pageSize` falls back to {@link DEFAULT_PAGE_SIZE}, and a
 * `pagesShown` past the end of the list simply reveals everything.
 *
 * @template T
 * @param {T[]} items Items to disclose. Non-arrays are treated as empty.
 * @param {number} [pageSize=DEFAULT_PAGE_SIZE] Items revealed per page.
 * @param {number} [pagesShown=1] How many pages the reviewer has opened so far.
 * @returns {DisclosedSlice<T>} The visible prefix plus the hidden-item count.
 *
 * @example
 * discloseSlice(['a', 'b', 'c', 'd'], 2, 1);
 * // → { visible: ['a', 'b'], remaining: 2, total: 4, hasMore: true }
 */
export function discloseSlice(items, pageSize = DEFAULT_PAGE_SIZE, pagesShown = 1) {
  const list = Array.isArray(items) ? items : [];
  const total = list.length;

  const size = normalizePageSize(pageSize);
  const pages = normalizePagesShown(pagesShown);

  // `size * pages` may be Infinity; Math.min clamps it to `total` regardless.
  const count = Math.min(total, size * pages);
  const visible = list.slice(0, count);

  return {
    visible,
    remaining: total - visible.length,
    total,
    hasMore: visible.length < total,
  };
}
