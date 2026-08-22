import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "../lib/api";

const LOAD_ERROR = "Could not load the plan.";
const GENERATE_ERROR = "Could not generate the plan.";

// The gateway can answer GET /api/proposals/:id/plan with two different 404s:
// `{ error: 'No plan generated for this proposal yet.', code: 'PLAN_NOT_GENERATED' }`
// and `{ error: 'Proposal not found.' }`. `api.js` only carries `message` and
// `status` on ApiError, so the missing-proposal case is recognised by message
// and everything else 404 is read as "no plan yet" — the same interpretation
// ExecutionPlanPanel.jsx already uses.
const PROPOSAL_MISSING = /proposal not found/i;

function isPlanNotGenerated(err) {
  if (!(err instanceof ApiError) || err.status !== 404) return false;
  if (err.code === "PLAN_NOT_GENERATED") return true;
  return !PROPOSAL_MISSING.test(err.message || "");
}

function messageFor(err, fallback) {
  return (err instanceof ApiError && err.message) || fallback;
}

/**
 * Loads the stored execution plan for a proposal.
 *
 * A 404 `PLAN_NOT_GENERATED` is not a failure: it sets `notGenerated` so the
 * caller can render a generate affordance (Requirement 11.2). Every other
 * failure is surfaced through `error` without throwing, so the surrounding
 * proposal step keeps rendering (Requirement 11.4).
 *
 * @param {string | null | undefined} proposalId proposal to load the plan for
 * @returns {{
 *   plan: object | null,
 *   diagnostics: object | null,
 *   status: string | null,
 *   revision: number,
 *   error: string | null,
 *   notGenerated: boolean,
 *   loading: boolean,
 *   generating: boolean,
 *   reload: () => Promise<void>,
 *   generate: (opts?: { scope?: string, preserveClientEdits?: boolean, confirmOverwrite?: boolean }) => Promise<boolean>,
 * }}
 */
export function usePlan(proposalId) {
  const [plan, setPlan] = useState(null);
  const [diagnostics, setDiagnostics] = useState(null);
  const [status, setStatus] = useState(null);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState(null);
  const [notGenerated, setNotGenerated] = useState(false);
  const [loading, setLoading] = useState(Boolean(proposalId));
  const [generating, setGenerating] = useState(false);

  const mountedRef = useRef(true);
  const abortRef = useRef(null);
  // Monotonic id of the newest fetch. A response is applied only if it still
  // owns this id, so a slow earlier request can never overwrite a newer one.
  const requestIdRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const clear = useCallback(() => {
    setPlan(null);
    setDiagnostics(null);
    setStatus(null);
    setRevision(0);
  }, []);

  // Both GET /plan and POST /plan/generate answer with the same field names.
  const applyDocument = useCallback((res) => {
    setPlan(res?.plan ?? null);
    setDiagnostics(res?.diagnostics ?? res?.plan?.diagnostics ?? null);
    setStatus(res?.status ?? null);
    setRevision(typeof res?.currentRevision === "number" ? res.currentRevision : 0);
    setNotGenerated(false);
    setError(null);
  }, []);

  const reload = useCallback(async () => {
    // Bumping the id first also invalidates any in-flight response.
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    abortRef.current?.abort();
    abortRef.current = null;

    if (!proposalId) {
      clear();
      setError(null);
      setNotGenerated(false);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);

    // An aborted fetch surfaces as ApiError(status 0) from api.js, so staleness
    // is decided by the request id rather than by the error name.
    const isCurrent = () => mountedRef.current && requestId === requestIdRef.current;

    try {
      const res = await api.getExecutionPlan(proposalId, controller.signal);
      if (!isCurrent()) return;
      applyDocument(res);
    } catch (err) {
      if (!isCurrent()) return;
      if (isPlanNotGenerated(err)) {
        clear();
        setNotGenerated(true);
        setError(null);
      } else {
        setNotGenerated(false);
        setError(messageFor(err, LOAD_ERROR));
      }
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [proposalId, applyDocument, clear]);

  useEffect(() => {
    reload();
  }, [reload]);

  const generate = useCallback(
    async (opts = {}) => {
      if (!proposalId) return false;
      setGenerating(true);
      setError(null);
      try {
        const res = await api.generateExecutionPlan(proposalId, opts);
        if (!mountedRef.current) return false;
        // Show the fresh plan straight away, then refetch for the canonical
        // record (status, revision, diagnostics of the stored document).
        applyDocument(res);
        await reload();
        return true;
      } catch (err) {
        // Generation failed, so `notGenerated` is left as-is: the caller keeps
        // offering generation and shows this error alongside it.
        if (mountedRef.current) setError(messageFor(err, GENERATE_ERROR));
        return false;
      } finally {
        if (mountedRef.current) setGenerating(false);
      }
    },
    [proposalId, applyDocument, reload],
  );

  return {
    plan,
    diagnostics,
    status,
    revision,
    error,
    notGenerated,
    loading,
    generating,
    reload,
    generate,
  };
}

export default usePlan;
