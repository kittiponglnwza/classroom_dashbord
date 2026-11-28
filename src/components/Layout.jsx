import { useState, useEffect, useRef } from 'react';
import { useLocation, useInRouterContext } from 'react-router-dom';
import Sidebar from './Sidebar';
import HeaderBar from './HeaderBar';
import MobileBottomNav from './MobileBottomNav';
import AiAssistantDrawer from './AiAssistantDrawer';
import { X, MessageSquareText } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import { useDialogFocusTrap } from '../hooks/useDialogFocusTrap';

function RouteFocusSync({ mainRef }) {
  const location = useLocation();
  const prevPathRef = useRef(location.pathname);

  useEffect(() => {
    if (prevPathRef.current !== location.pathname) {
      prevPathRef.current = location.pathname;
      if (mainRef.current) {
        mainRef.current.scrollTop = 0;
        mainRef.current.focus({ preventScroll: true });
      }
    }
  }, [location.pathname, mainRef]);

  return null;
}

export default function Layout({ children }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const { lang = 'th' } = useSettings() || {};
  const inRouter = useInRouterContext();
  const mobileDrawerRef = useRef(null);
  const mainRef = useRef(null);

  useDialogFocusTrap(mobileMenuOpen, mobileDrawerRef, {
    onClose: () => setMobileMenuOpen(false),
  });

  return (
    <div className="flex h-screen h-dvh w-full overflow-hidden bg-[var(--app-bg)] text-[var(--text-primary)]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:px-4 focus:py-2.5 focus:rounded-lg focus:bg-[var(--primary)] focus:text-white focus:text-xs focus:font-medium focus:outline-none focus:ring-2 focus:ring-[var(--primary-bright)]"
      >
        {lang === 'en' ? 'Skip to main content' : 'ข้ามไปยังเนื้อหาหลัก'}
      </a>

      {inRouter && <RouteFocusSync mainRef={mainRef} />}

      <div className="hidden md:block h-full shrink-0">
        <Sidebar />
      </div>

      {mobileMenuOpen && (
        <div
          ref={mobileDrawerRef}
          role="dialog"
          aria-modal="true"
          aria-label="Mobile Navigation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setMobileMenuOpen(false);
          }}
          className="fixed inset-0 z-50 flex md:hidden bg-black/60"
        >
          <div className="h-full w-72 max-w-[82vw] bg-[var(--sidebar-bg)] border-r border-[var(--border)]">
            <Sidebar onLinkClick={() => setMobileMenuOpen(false)} />
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close Mobile Menu"
            className="w-11 h-11 flex items-center justify-center text-[var(--text-primary)] hover:bg-[var(--surface-hover)] absolute top-3 right-3 bg-[var(--surface)] rounded-lg border border-[var(--border)] cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <HeaderBar
          setMobileMenuOpen={setMobileMenuOpen}
          onOpenAssistant={() => setAssistantOpen(true)}
        />

        <main
          ref={mainRef}
          id="main-content"
          tabIndex={-1}
          className="main-scroll-container flex-1 overflow-y-auto overflow-x-hidden bg-[var(--app-bg)] px-4 pt-4 pb-24 sm:px-6 sm:py-6 lg:px-8 lg:py-8 md:pb-8 focus:outline-none"
        >
          <div className="max-w-[var(--page-max-width)] mx-auto w-full">
            {children}
          </div>
        </main>
      </div>

      {!assistantOpen && (
        <button
          type="button"
          data-testid="floating-assistant-trigger"
          onClick={() => setAssistantOpen(true)}
          aria-label={lang === 'en' ? 'Open Study Assistant drawer' : 'เปิดแผงผู้ช่วยวางแผนการเรียน'}
          className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-40 min-h-11 md:min-h-10 px-3.5 rounded-xl bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)] border border-[var(--border-strong)] text-[var(--text-heading)] flex items-center gap-2 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
        >
          <MessageSquareText size={16} strokeWidth={1.5} className="text-[var(--primary-bright)] shrink-0" />
          <span className="text-xs font-medium">
            {lang === 'en' ? 'Study Assistant' : 'ผู้ช่วยเรียน'}
          </span>
        </button>
      )}

      <AiAssistantDrawer
        isOpen={assistantOpen}
        onClose={() => setAssistantOpen(false)}
      />

      <MobileBottomNav onOpenMenu={() => setMobileMenuOpen(true)} />
    </div>
  );
}
