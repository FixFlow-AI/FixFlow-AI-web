/**
 * Minimal RFC 6902 JSON Patch (add / remove / replace) with RFC 6901 JSON
 * Pointer resolution. Used for field-level, conflict-safe edits to the deep
 * execution plan (AI-008). Deliberately small and dependency-free.
 *
 * Supported ops: add, remove, replace. Unsupported ops (move/copy/test) throw
 * a JsonPatchError so callers can return 422 with a precise reason.
 */

export type JsonPatchOp = 'add' | 'remove' | 'replace';

export interface JsonPatchOperation {
  op: JsonPatchOp;
  path: string; // JSON Pointer, e.g. /scopeModules/0/name
  value?: unknown; // required for add/replace
}

export class JsonPatchError extends Error {
  constructor(
    message: string,
    public readonly path?: string,
  ) {
    super(message);
    this.name = 'JsonPatchError';
  }
}

/** Decode a JSON Pointer reference token per RFC 6901 (~1 → /, ~0 → ~). */
function decodeToken(token: string): string {
  return token.replace(/~1/g, '/').replace(/~0/g, '~');
}

/** Split a JSON Pointer into decoded reference tokens. '' is the whole doc. */
function parsePointer(pointer: string): string[] {
  if (pointer === '') return [];
  if (!pointer.startsWith('/')) {
    throw new JsonPatchError(`Invalid JSON Pointer '${pointer}' (must start with '/').`, pointer);
  }
  return pointer.split('/').slice(1).map(decodeToken);
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function deepClone<T>(v: T): T {
  return v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T);
}

function navigate(root: unknown, tokens: string[]): unknown {
  let cur: unknown = root;
  for (const token of tokens) {
    if (Array.isArray(cur)) {
      const idx = Number(token);
      if (!Number.isInteger(idx) || idx < 0 || idx >= cur.length) {
        throw new JsonPatchError(`Array index '${token}' out of range.`);
      }
      cur = cur[idx];
    } else if (isPlainObject(cur)) {
      if (!(token in cur)) throw new JsonPatchError(`Path segment '${token}' not found.`);
      cur = cur[token];
    } else {
      throw new JsonPatchError(`Cannot descend into '${token}'.`);
    }
  }
  return cur;
}

function applyOne(root: any, op: JsonPatchOperation): void {
  const tokens = parsePointer(op.path);
  if (tokens.length === 0) {
    throw new JsonPatchError('Operating on the whole document is not allowed.', op.path);
  }
  const last = tokens[tokens.length - 1];
  const parent = navigate(root, tokens.slice(0, -1));

  if (op.op === 'add' || op.op === 'replace') {
    if (op.value === undefined) {
      throw new JsonPatchError(`'${op.op}' requires a value.`, op.path);
    }
  }

  if (Array.isArray(parent)) {
    if (op.op === 'add') {
      if (last === '-') {
        parent.push(op.value);
        return;
      }
      const idx = Number(last);
      if (!Number.isInteger(idx) || idx < 0 || idx > parent.length) {
        throw new JsonPatchError(`Array index '${last}' out of range for add.`, op.path);
      }
      parent.splice(idx, 0, op.value);
      return;
    }
    const idx = Number(last);
    if (!Number.isInteger(idx) || idx < 0 || idx >= parent.length) {
      throw new JsonPatchError(`Array index '${last}' out of range.`, op.path);
    }
    if (op.op === 'remove') parent.splice(idx, 1);
    else parent[idx] = op.value; // replace
    return;
  }

  if (isPlainObject(parent)) {
    if (op.op === 'remove') {
      if (!(last in parent)) throw new JsonPatchError(`Cannot remove missing key '${last}'.`, op.path);
      delete parent[last];
    } else if (op.op === 'replace') {
      if (!(last in parent)) throw new JsonPatchError(`Cannot replace missing key '${last}'.`, op.path);
      parent[last] = op.value;
    } else {
      // add: create or overwrite
      parent[last] = op.value;
    }
    return;
  }

  throw new JsonPatchError(`Cannot apply '${op.op}' at '${op.path}'.`, op.path);
}

/**
 * Apply a patch to a deep clone of `doc` and return the new document. The input
 * is never mutated. All-or-nothing: any failing op throws and the original is
 * left untouched (the caller keeps its reference).
 */
export function applyJsonPatch<T>(doc: T, operations: JsonPatchOperation[]): T {
  if (!Array.isArray(operations)) {
    throw new JsonPatchError('operations must be an array.');
  }
  const draft = deepClone(doc) as any;
  for (const op of operations) {
    if (!op || typeof op.path !== 'string' || !['add', 'remove', 'replace'].includes(op.op)) {
      throw new JsonPatchError(`Unsupported or malformed operation: ${JSON.stringify(op)}.`);
    }
    applyOne(draft, op);
  }
  return draft as T;
}

/**
 * The set of "conflict scopes" a patch touches — the first two pointer segments
 * (e.g. /tasks/3/title → "tasks/3"). Two patches with disjoint scope sets may
 * be auto-merged; overlapping scopes are a genuine conflict.
 */
export function changedScopes(operations: JsonPatchOperation[]): Set<string> {
  const scopes = new Set<string>();
  for (const op of operations) {
    const tokens = parsePointer(op.path);
    scopes.add(tokens.slice(0, 2).join('/'));
  }
  return scopes;
}

/** True when two scope sets share no member (safe to auto-merge). */
export function scopesDisjoint(a: Set<string>, b: Set<string>): boolean {
  for (const s of a) if (b.has(s)) return false;
  return true;
}
