import React, { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Menu, X, Shield, ArrowRight } from 'lucide-react';
import Button from '../ui/Button.js';

export const PublicLayout: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const navLinks = [
    { name: 'Features', path: '/features' },
    { name: 'How It Works', path: '/how-it-works' },
    { name: 'Security', path: '/security' },
    { name: 'Pricing', path: '/pricing' }
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="flex flex-col min-h-screen">
      {/* Top Banner */}
      <div className="bg-blue-950/40 border-b border-blue-900/30 text-center py-2 text-xs text-blue-400 font-medium tracking-wide">
        🚀 FixFlow AI Public Pre-Launch is Live — Secure your place on the Waitlist.
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-brand-slate-950/85 border-b border-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-2">
            <Shield className="w-6 h-6 text-blue-500" />
            <span className="text-xl font-bold font-outfit tracking-tight text-white">
              FixFlow <span className="text-blue-500 font-normal">AI</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center space-x-8">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                to={link.path}
                className={`text-sm transition-colors ${
                  isActive(link.path)
                    ? 'text-blue-400 font-medium'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {link.name}
              </Link>
            ))}
          </nav>

          {/* Action buttons */}
          <div className="hidden md:flex items-center space-x-4">
            <Link to="/login">
              <Button variant="ghost" size="sm">Login</Button>
            </Link>
            <Link to="/signup">
              <Button variant="primary" size="sm" className="gap-1">
                Waitlist <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>

          {/* Mobile menu toggle */}
          <div className="md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-slate-400 hover:text-slate-200 focus:outline-none"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 top-24 z-40 bg-brand-slate-950/95 backdrop-blur-lg flex flex-col p-6 space-y-6">
          <nav className="flex flex-col space-y-4">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                to={link.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`text-lg transition-colors ${
                  isActive(link.path) ? 'text-blue-400 font-medium' : 'text-slate-400'
                }`}
              >
                {link.name}
              </Link>
            ))}
          </nav>
          <div className="border-t border-slate-900 pt-6 flex flex-col space-y-3">
            <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="w-full">
              <Button variant="ghost" fullWidth>Login</Button>
            </Link>
            <Link to="/signup" onClick={() => setMobileMenuOpen(false)} className="w-full">
              <Button variant="primary" fullWidth>Join Waitlist</Button>
            </Link>
          </div>
        </div>
      )}

      {/* Content */}
      <main className="flex-grow">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-brand-slate-950 border-t border-slate-900 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center space-x-2">
            <Shield className="w-5 h-5 text-blue-500" />
            <span className="font-semibold font-outfit text-white">FixFlow AI</span>
            <span className="text-xs text-slate-500">© 2026. All rights reserved.</span>
          </div>

          <div className="flex flex-wrap justify-center gap-x-8 gap-y-4 text-xs text-slate-500">
            <Link to="/security" className="hover:text-slate-300">Security Architecture</Link>
            <Link to="/how-it-works" className="hover:text-slate-300">Trust Escrow</Link>
            <Link to="/contact" className="hover:text-slate-300">Developer API</Link>
            <a href="https://github.com/FixFlow-AI/FixFlow-AI-web" target="_blank" rel="noreferrer" className="hover:text-slate-300">GitHub Source</a>
          </div>
        </div>
      </footer>
    </div>
  );
};
export default PublicLayout;
