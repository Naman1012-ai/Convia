import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { LandingNavbar } from '../components/LandingNavbar';
import { LandingFooter } from '../components/LandingFooter';
import { ArrowLeft, ChevronDown, ChevronRight, Clock, Shield } from 'lucide-react';

export function LegalLayout({ title, subtitle, lastUpdated = 'July 24, 2026', toc = [], children }) {
  const [activeId, setActiveId] = useState('');
  const [mobileTocOpen, setMobileTocOpen] = useState(false);

  // Scroll Spy for Table of Contents
  useEffect(() => {
    if (!toc.length) return;

    const handleScroll = () => {
      const scrollPos = window.scrollY + 140;
      for (const item of toc) {
        const elem = document.getElementById(item.id);
        if (elem) {
          const top = elem.offsetTop;
          const height = elem.offsetHeight;
          if (scrollPos >= top && scrollPos < top + height) {
            setActiveId(item.id);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [toc]);

  const scrollToSection = (id) => {
    setMobileTocOpen(false);
    const elem = document.getElementById(id);
    if (elem) {
      const yOffset = -90;
      const y = elem.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-primary-500 selection:text-white antialiased">
      <LandingNavbar />

      <main className="flex-1 py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full space-y-10">
        {/* Top Header Bar with Back Button & Breadcrumbs */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-slate-300 hover:text-white hover:border-primary-500/40 shadow-sm transition-all hover:-translate-x-0.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
              aria-label="Back to Home"
            >
              <ArrowLeft className="h-4 w-4 text-primary-400" />
              <span>Back to Home</span>
            </Link>

            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-xs font-mono text-slate-400" aria-label="Breadcrumb">
              <Link to="/" className="hover:text-white transition-colors">Home</Link>
              <ChevronRight className="h-3 w-3 text-slate-600" />
              <span className="text-primary-300 font-bold">{title}</span>
            </nav>
          </div>

          {/* Title Header */}
          <div className="space-y-3 pt-2 border-b border-slate-800/80 pb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-primary-500/30 text-primary-300 text-xs font-mono font-bold">
              <Shield className="h-3.5 w-3.5 text-primary-400" />
              <span>Trust & Transparency</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
              {title}
            </h1>

            <p className="text-base sm:text-lg text-slate-300 font-medium max-w-3xl leading-relaxed">
              {subtitle}
            </p>

            <div className="flex items-center gap-2 pt-2 text-xs font-mono text-slate-400">
              <Clock className="h-3.5 w-3.5 text-slate-500" />
              <span>Last Updated: <strong className="text-slate-200">{lastUpdated}</strong></span>
            </div>
          </div>
        </div>

        {/* Mobile Collapsible Table of Contents */}
        {toc.length > 0 && (
          <div className="lg:hidden rounded-2xl bg-slate-900/90 border border-slate-800 overflow-hidden">
            <button
              onClick={() => setMobileTocOpen(!mobileTocOpen)}
              className="w-full p-4 flex items-center justify-between text-xs font-mono font-bold text-primary-300 focus:outline-none"
              aria-expanded={mobileTocOpen}
            >
              <span>Table of Contents ({toc.length} Sections)</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${mobileTocOpen ? 'rotate-180' : ''}`} />
            </button>

            {mobileTocOpen && (
              <div className="p-4 pt-0 border-t border-slate-800/80 space-y-2 text-xs font-medium text-slate-300">
                {toc.map((item, idx) => (
                  <button
                    key={item.id}
                    onClick={() => scrollToSection(item.id)}
                    className="w-full text-left py-1.5 px-2 rounded hover:bg-slate-800 transition-colors flex items-center gap-2"
                  >
                    <span className="text-primary-400 font-mono text-[11px] font-bold">{idx + 1}.</span>
                    <span>{item.title}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Main Content Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* Desktop Sticky Table of Contents */}
          {toc.length > 0 && (
            <aside className="hidden lg:block lg:col-span-3 sticky top-28 space-y-3 p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl">
              <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider pb-2 border-b border-slate-800">
                Table of Contents
              </h3>
              <nav className="space-y-1 text-xs font-medium" aria-label="Table of Contents">
                {toc.map((item, idx) => {
                  const isActive = activeId === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => scrollToSection(item.id)}
                      className={`w-full text-left py-2 px-3 rounded-xl transition-all duration-150 flex items-start gap-2 ${
                        isActive
                          ? 'bg-primary-600/20 border border-primary-500/40 text-white font-bold shadow-sm'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                      }`}
                    >
                      <span className="text-primary-400 font-mono text-[10px] font-extrabold mt-0.5">
                        {idx + 1}.
                      </span>
                      <span className="leading-tight">{item.title}</span>
                    </button>
                  );
                })}
              </nav>
            </aside>
          )}

          {/* Right Main Legal Content Body */}
          <div className={toc.length > 0 ? 'lg:col-span-9 space-y-10' : 'lg:col-span-12 space-y-10'}>
            {children}
          </div>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}

LegalLayout.propTypes = {
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string.isRequired,
  lastUpdated: PropTypes.string,
  toc: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      title: PropTypes.string.isRequired,
    })
  ),
  children: PropTypes.node.isRequired,
};
