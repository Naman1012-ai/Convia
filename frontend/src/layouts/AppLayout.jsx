import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from '../components/layout/Navbar';
import { Sidebar } from '../components/layout/Sidebar';

export function AppLayout() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-lavender-surface text-slate-900">
      <Navbar
        isSidebarOpen={isMobileOpen}
        onMobileMenuToggle={() => setIsMobileOpen((prev) => !prev)}
      />
      <div className="flex flex-1">
        <Sidebar
          mode="global"
          isMobileOpen={isMobileOpen}
          onCloseMobile={() => setIsMobileOpen(false)}
        />
        <main className="flex-1 min-w-0 px-4 py-8 sm:px-8 max-w-7xl mx-auto w-full transition-all duration-200">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
