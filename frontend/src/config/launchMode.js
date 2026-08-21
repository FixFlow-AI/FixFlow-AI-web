/**
 * Temporary public-launch policy.
 *
 * Default-on keeps fresh deployments safe. To reopen every signup role and
 * freelancer workspace feature, set VITE_FREELANCER_ONLY_ONBOARDING=false and
 * rebuild the frontend; set the matching backend flag to false as well.
 */
export const FREELANCER_ONLY_ONBOARDING =
  import.meta.env.VITE_FREELANCER_ONLY_ONBOARDING === "true";
