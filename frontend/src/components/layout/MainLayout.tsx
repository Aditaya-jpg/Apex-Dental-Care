import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export const MainLayout: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="flex h-screen w-full overflow-x-hidden bg-slate-50">
      <Sidebar
        drawerId="mobile-nav-drawer"
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          drawerId="mobile-nav-drawer"
          isMobileMenuOpen={isMobileMenuOpen}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
        />
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 md:p-8 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
