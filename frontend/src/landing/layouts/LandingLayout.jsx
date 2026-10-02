import React from 'react';
import PropTypes from 'prop-types';
import { LandingNavbar } from '../components/LandingNavbar';
import { LandingFooter } from '../components/LandingFooter';

export function LandingLayout({ children }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-primary-500 selection:text-white antialiased">
      <LandingNavbar />
      <main className="flex-1">
        {children}
      </main>
      <LandingFooter />
    </div>
  );
}

LandingLayout.propTypes = {
  children: PropTypes.node.isRequired,
};
