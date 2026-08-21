import { useEffect, useState } from "react";
import { useLandingStore } from "./store/useLandingStore";
import { CursorField } from "./components/CursorField";
import { ScrollProgress } from "./components/ScrollProgress";
import { useSmoothScroll } from "./hooks/useSmoothScroll";
import { Automation } from "./sections/Automation";
import { FinalCta } from "./sections/FinalCta";
import { Footer } from "./sections/Footer";
import { Hero } from "./sections/Hero";
import { HowItThinks } from "./sections/HowItThinks";
import { Navigation } from "./sections/Navigation";
import { Problem } from "./sections/Problem";
import {
  DeliveryFundsMoments,
  IntelligenceProductMoments,
  OutcomeProductMoment,
  ProductOverviewMoment,
  ProposalAgreementMoments,
  RoleOnboardingMoment,
} from "./sections/ProductMoments";
import { SocialProof } from "./sections/SocialProof";
import { Pricing } from "./sections/Pricing";
import { Faq } from "./sections/Faq";
import { SystemIntelligence } from "./sections/SystemIntelligence";
import { Trust } from "./sections/Trust";
import { Workflow } from "./sections/Workflow";

import { Login } from "./sections/Login";
import { Signup } from "./sections/Signup";
import { Dashboard } from "./sections/Dashboard";
import { getUser, isAuthenticated, setSession, startProactiveRefreshTimer } from "./lib/auth";
import { api } from "./lib/api";
import { handleGithubRedirect } from "./components/GithubSignInButton";
import { AuthLoader } from "./components/AuthLoader";

export function App() {
  useSmoothScroll();
  const {
    page,
    setPage,
    setDashboardTab,
    hydrateAuth,
    login,
    isAuthenticating,
    setIsAuthenticating,
  } = useLandingStore();

  // Initialize the proactive background refresh timer on app load.
  useEffect(() => {
    startProactiveRefreshTimer();
  }, []);

  // Rehydrate the session from localStorage on first load so a refresh keeps
  // the user logged in.
  useEffect(() => {
    hydrateAuth(getUser());
  }, [hydrateAuth]);

  // Handle a GitHub OAuth return (?code=&state=) once on load: exchange the
  // code via the backend, store the session, and navigate into the app.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await handleGithubRedirect({ api, setSession, login });
      
      // If result is null, it means handleGithubRedirect did not run the OAuth exchange
      // (e.g. because there was no code/state in the URL, or it was already cleared by a double-mount).
      // In that case, we should not clear the isAuthenticating state because a real exchange 
      // is already running in the background from the other mount.
      if (!result) return;

      setIsAuthenticating(false);

      if (result.nextHash) {
        window.location.hash = result.nextHash;
      } else if (result.error) {
        // Surface the error on the login screen.
        setPage("login"); // Synchronously set page to login to avoid landing page flash
        window.location.hash = "#/login";
        window.sessionStorage.setItem("ff_github_error", result.error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [login, setIsAuthenticating, setPage]);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (!hash || hash === "#" || hash === "#/") {
        setPage("landing");
      } else if (hash === "#/login") {
        setPage("login");
      } else if (hash === "#/signup") {
        setPage("signup");
      } else if (hash.startsWith("#/dashboard")) {
        // Guard: only authenticated users can reach the dashboard.
        if (!isAuthenticated()) {
          setPage("login");
          window.location.hash = "#/login";
          return;
        }
        setPage("dashboard");
        const parts = hash.split("/");
        const tab = parts[2];
        if (tab) {
          setDashboardTab(tab);
        } else {
          setDashboardTab("overview");
        }
      }
    };

    handleHashChange();
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [setPage, setDashboardTab]);

  if (isAuthenticating) {
    return <AuthLoader />;
  }

  if (page === "login") {
    return (
      <>
        <CursorField />
        <Login />
      </>
    );
  }

  if (page === "signup") {
    return (
      <>
        <CursorField />
        <Signup />
      </>
    );
  }

  if (page === "dashboard") {
    return (
      <>
        <CursorField />
        <Dashboard />
      </>
    );
  }

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <ScrollProgress />
      <CursorField />
      <Navigation />
      <main id="main-content">
        <Hero />
        <SocialProof />
        <ProductOverviewMoment />
        <Problem />
        <IntelligenceProductMoments />
        <SystemIntelligence />
        <HowItThinks />
        <ProposalAgreementMoments />
        <Workflow />
        <DeliveryFundsMoments />
        <Automation />
        <Trust />
        <OutcomeProductMoment />
        <RoleOnboardingMoment />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
