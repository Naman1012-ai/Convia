import React from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from '../components/layout/Navbar';

export function AppLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-lavender-surface text-slate-900">
      <Navbar />
      <main className="flex-1 px-4 py-8 sm:px-8 max-w-7xl mx-auto w-full">
        <Outlet />
      </main>
    </div>
  );
}
