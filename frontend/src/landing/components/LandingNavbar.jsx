import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useScrollPosition } from '../hooks/useScrollPosition';
import { Zap, Menu, X, ArrowRight, Sparkles, LayoutDashboard } from 'lucide-react';

const NAV_SECTIONS = [
  { id: 'how-it-works', label: 'How It Works' },
  { id: 'features', label: 'Features' },
  { id: 'ai-blueprint', label: 'AI Blueprint' },
  { id: 'use-cases', label: 'Use Cases' },
  { id: 'stats', label: 'Telemetry' },
  { id: 'faq', label: 'FAQ' },
];

export function LandingNavbar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isScrolled } = useScrollPosition(20);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('');

  // Scroll Spy Effect
  useEffect(() => {
    const handleScrollSpy = () => {
      const scrollPos = window.scrollY + 100;
      for (const section of NAV_SECTIONS) {
        const elem = document.getElementById(section.id);
        if (elem) {
          const top = elem.offsetTop;
          const height = elem.offsetHeight;
          if (scrollPos >= top && scrollPos < top + height) {
            setActiveSection(section.id);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScrollSpy, { passive: true });
    return () => window.removeEventListener('scroll', handleScrollSpy);
  }, []);

  const scrollToSection = (id) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      const yOffset = -80; // Account for sticky navbar height
      const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-300 ${
        isScrolled
          ? 'bg-slate-950/85 backdrop-blur-xl border-b border-slate-800/80 shadow-2xl shadow-primary-950/20 py-3.5'
          : 'bg-transparent py-5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link
            to="/"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-2.5 group focus:outline-none focus:ring-2 focus:ring-primary-500 rounded-xl p-1"
            aria-label="Convia Home"
          >
            <img
              src="/convia-logo.png"
              alt="Convia Logo"
              className="h-9 w-9 rounded-xl object-contain shadow-lg shadow-primary-500/30 group-hover:scale-105 transition-transform duration-200"
            />
            <span className="text-xl font-extrabold tracking-tight text-white">
              Convia
            </span>
          </Link>

          {/* Desktop Navigation Links with Scroll Spy active highlighting */}
          <nav className="hidden md:flex items-center gap-7 text-xs font-semibold text-slate-300" aria-label="Main Navigation">
            {NAV_SECTIONS.map((sec) => (
              <button
                key={sec.id}
                onClick={() => scrollToSection(sec.id)}
                className={`py-1 transition-colors duration-150 relative focus:outline-none focus:ring-2 focus:ring-primary-500 rounded px-1.5 ${
                  activeSection === sec.id ? 'text-white font-extrabold' : 'hover:text-white'
                }`}
              >
                {sec.label}
                {activeSection === sec.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary-500 to-primary-400 rounded-full" />
                )}
              </button>
            ))}
          </nav>

          {/* Right Action Buttons (Desktop) */}
          <div className="hidden md:flex items-center gap-4">
            {user ? (
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-extrabold text-xs shadow-lg shadow-primary-600/30 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <LayoutDashboard className="h-4 w-4" />
                <span>Go to Dashboard</span>
              </Link>
            ) : (
              <>
                <Link
                  to="/signin"
                  className="text-xs font-bold text-slate-300 hover:text-white transition-colors duration-150 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded"
                >
                  Login
                </Link>
                <Link
                  to="/signup"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-500 hover:to-primary-400 text-white font-extrabold text-xs shadow-lg shadow-primary-600/30 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <span>Create Workspace</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </>
            )}
          </div>

          {/* Mobile Hamburger Toggle Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            aria-label={mobileMenuOpen ? 'Close Navigation Menu' : 'Open Navigation Menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-800/80 bg-slate-950/95 backdrop-blur-2xl px-4 pt-4 pb-6 space-y-4 animate-in slide-in-from-top-4 duration-200">
          <nav className="flex flex-col gap-3 font-medium text-sm text-slate-300" aria-label="Mobile Navigation">
            {NAV_SECTIONS.map((sec) => (
              <button
                key={sec.id}
                onClick={() => scrollToSection(sec.id)}
                className="text-left py-2 hover:text-white transition-colors border-b border-slate-900 flex items-center justify-between"
              >
                <span>{sec.label}</span>
              </button>
            ))}
          </nav>

          <div className="pt-2 flex flex-col gap-2.5">
            {user ? (
              <Link
                to="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-primary-600 text-white font-extrabold text-xs shadow-lg shadow-primary-600/20"
              >
                <LayoutDashboard className="h-4 w-4" />
                <span>Go to Dashboard</span>
              </Link>
            ) : (
              <>
                <Link
                  to="/signup"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-primary-600 to-primary-500 text-white font-extrabold text-xs shadow-lg shadow-primary-600/20"
                >
                  <span>Create Workspace</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>

                <Link
                  to="/signin"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full inline-flex items-center justify-center py-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 font-bold text-xs"
                >
                  Login
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
