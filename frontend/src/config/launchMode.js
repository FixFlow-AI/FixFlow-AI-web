/**
 * Temporary public-launch policy.
 *
 * Default-on keeps fresh deployments safe. To reopen every signup role and
 * freelancer workspace feature, set VITE_FREELANCER_ONLY_ONBOARDING=false and
 * rebuild the frontend; set the matching backend flag to false as well.
 */
// Fail-safe on purpose: only the explicit string "false" opens the other roles.
// A missing or misspelled env var must keep client/agency/developer onboarding
// CLOSED, matching the backend gate in backend/src/routes/auth.ts. Do not
// change this to `=== "true"` — that inverts the default and a deploy without
// the variable would silently expose unfinished onboarding paths.
export const FREELANCER_ONLY_ONBOARDING =
  import.meta.env.VITE_FREELANCER_ONLY_ONBOARDING !== "false";
