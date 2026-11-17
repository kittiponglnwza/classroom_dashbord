import { useState } from 'react';
import Sidebar from './Sidebar';
import HeaderBar from './HeaderBar';
import { X } from 'lucide-react';

export default function Layout({ children }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F5F5F7] text-[#1D1D1F]">
      <div className="hidden md:block h-full shrink-0">
        <Sidebar />
      </div>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden bg-black/25">
          <div className="h-full w-64 bg-white shadow-lg">
            <Sidebar onLinkClick={() => setMobileMenuOpen(false)} />
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close Mobile Menu"
            className="p-2.5 text-[#1D1D1F] absolute top-3.5 right-3.5 bg-white rounded-full border border-[#D2D2D7] shadow-xs cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <HeaderBar setMobileMenuOpen={setMobileMenuOpen} />

        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-[#F5F5F7] px-4 py-6 md:px-8 md:py-8">
          <div className="max-w-6xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
