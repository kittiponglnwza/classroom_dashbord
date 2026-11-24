import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import HeaderBar from './HeaderBar';
import { X } from 'lucide-react';

export default function Layout({ children }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  return (
    <div className="flex h-screen h-dvh w-screen overflow-hidden bg-[var(--app-bg)] text-[var(--text-primary)]">
      <div className="hidden md:block h-full shrink-0">
        <Sidebar />
      </div>

      {mobileMenuOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Mobile Navigation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setMobileMenuOpen(false);
          }}
          className="fixed inset-0 z-50 flex md:hidden bg-black/60"
        >
          <div className="h-full w-64 bg-[var(--sidebar-bg)] border-r border-[var(--border)]">
            <Sidebar onLinkClick={() => setMobileMenuOpen(false)} />
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close Mobile Menu"
            className="p-2.5 text-[var(--text-primary)] hover:bg-[var(--surface-hover)] absolute top-3.5 right-3.5 bg-[var(--surface)] rounded-full border border-[var(--border)] cursor-pointer transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <HeaderBar setMobileMenuOpen={setMobileMenuOpen} />

        <main className="main-scroll-container flex-1 overflow-y-auto overflow-x-hidden bg-[var(--app-bg)] px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-7">
          <div className="max-w-[var(--page-max-width)] mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
