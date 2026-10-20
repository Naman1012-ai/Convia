import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Navbar } from '../components/layout/Navbar';
import { Sidebar } from '../components/layout/Sidebar';

export function AppLayout() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const location = useLocation();
  const isCommunity = location.pathname.startsWith('/community');

  return (
    <div className={`flex flex-col bg-lavender-surface text-slate-900 ${isCommunity ? 'h-screen overflow-hidden' : 'min-h-screen'}`}>
      <Navbar
        isSidebarOpen={isMobileOpen}
        onMobileMenuToggle={() => setIsMobileOpen((prev) => !prev)}
      />
      <div className={`flex flex-1 ${isCommunity ? 'min-h-0 overflow-hidden' : ''}`}>
        <Sidebar
          mode="global"
          isMobileOpen={isMobileOpen}
          onCloseMobile={() => setIsMobileOpen(false)}
        />
        <main
          className={
            isCommunity
              ? 'flex-1 min-w-0 px-2 sm:px-4 py-2 sm:py-3 max-w-7xl mx-auto w-full transition-all duration-200 flex flex-col h-full overflow-hidden'
              : 'flex-1 min-w-0 px-4 py-8 sm:px-8 max-w-7xl mx-auto w-full transition-all duration-200'
          }
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
