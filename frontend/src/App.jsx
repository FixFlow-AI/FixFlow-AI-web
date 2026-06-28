import { useEffect } from "react";
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
import { SystemIntelligence } from "./sections/SystemIntelligence";
import { Trust } from "./sections/Trust";
import { Workflow } from "./sections/Workflow";

import { Login } from "./sections/Login";
import { Signup } from "./sections/Signup";
import { Dashboard } from "./sections/Dashboard";
import { getUser, isAuthenticated } from "./lib/auth";

export function App() {
  useSmoothScroll();
  const { page, setPage, setDashboardTab, hydrateAuth } = useLandingStore();

  // Rehydrate the session from localStorage on first load so a refresh keeps
  // the user logged in.
  useEffect(() => {
    hydrateAuth(getUser());
  }, [hydrateAuth]);

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
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
