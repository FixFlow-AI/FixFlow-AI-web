import { useEffect, useState } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { Brand } from "../components/Brand";
import { useActiveSection } from "../hooks/useActiveSection";

const navItems = [
  ["Problem", "problem"],
  ["Intelligence", "intelligence"],
  ["Workflow", "workflow"],
  ["Trust", "trust"],
];

export function Navigation() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const activeSection = useActiveSection();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileOpen]);

  return (
    <header
      className={`site-header${scrolled || mobileOpen ? " is-scrolled" : ""}`}
    >
      <div className="nav-shell">
        <Brand compact />
        <nav className="desktop-nav" aria-label="Primary navigation">
          {navItems.map(([label, id]) => (
            <a
              className={activeSection === id ? "is-active" : ""}
              href={`#${id}`}
              key={id}
            >
              {label}
            </a>
          ))}
        </nav>
        <div className="hidden md:flex items-center gap-4">
          <a
            className="text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors"
            href="#/login"
          >
            Log in
          </a>
          <a className="button button--small nav-cta" href="#/signup">
            Request access
            <ArrowUpRight aria-hidden="true" size={15} strokeWidth={2} />
          </a>
        </div>
        <button
          className="icon-button menu-button"
          type="button"
          aria-expanded={mobileOpen}
          aria-controls="mobile-navigation"
          aria-label={
            mobileOpen ? "Close navigation menu" : "Open navigation menu"
          }
          onClick={() => setMobileOpen((open) => !open)}
        >
          {mobileOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
      </div>
      <nav
        className={`mobile-nav${mobileOpen ? " is-open" : ""}`}
        id="mobile-navigation"
        aria-label="Mobile navigation"
      >
        {navItems.map(([label, id], index) => (
          <a href={`#${id}`} key={id} onClick={() => setMobileOpen(false)}>
            <span>0{index + 1}</span>
            {label}
          </a>
        ))}
        <a
          className="text-sm font-bold text-slate-600 py-2 text-center"
          href="#/login"
          onClick={() => setMobileOpen(false)}
        >
          Log in
        </a>
        <a
          className="button"
          href="#/signup"
          onClick={() => setMobileOpen(false)}
        >
          Request early access
          <ArrowUpRight aria-hidden="true" size={17} />
        </a>
      </nav>
    </header>
  );
}
