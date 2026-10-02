import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { Zap, ArrowLeft } from 'lucide-react';

export function AuthLayout() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-primary-50/70 via-white to-lavender-surface p-4 sm:p-6 relative">
      {/* Top Left "Back to Home" Button */}
      <div className="w-full max-w-md mb-4 flex items-center justify-between">
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/95 border border-lavender-border text-xs font-bold text-slate-700 hover:text-primary-700 hover:border-primary-300 shadow-sm transition-all hover:-translate-x-0.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
          aria-label="Back to Home"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Home</span>
        </Link>
      </div>

      {/* Branding Header */}
      <Link to="/" className="mb-6 flex flex-col items-center text-center group focus:outline-none focus:ring-2 focus:ring-primary-500 rounded-xl p-1">
        <img
          src="/convia-logo.png"
          alt="Convia Logo"
          className="mb-2.5 h-14 w-14 rounded-2xl shadow-md shadow-primary-200/60 group-hover:scale-105 transition-transform object-contain"
        />
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Convia</h1>
        <p className="mt-0.5 text-xs text-slate-500 font-medium">Where Ideas Converge into Action.</p>
      </Link>

      {/* Main Form Container */}
      <div className="w-full max-w-md rounded-2xl border border-lavender-border bg-white p-6 sm:p-8 shadow-xl shadow-primary-100/30">
        <Outlet />
      </div>

      <footer className="mt-8 text-xs text-slate-400">
        Convia Platform &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}
