import { useState } from 'react';
import Sidebar from './Sidebar';
import HeaderBar from './HeaderBar';
import { X } from 'lucide-react';

export default function Layout({ children }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-dark-bg text-dark-text">
      <div className="hidden md:block h-full">
        <Sidebar />
      </div>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden bg-black/60 backdrop-blur-sm">
          <div className="h-full w-64 animate-fade-in">
            <Sidebar onLinkClick={() => setMobileMenuOpen(false)} />
          </div>
          <button 
            onClick={() => setMobileMenuOpen(false)}
            className="p-3 text-white absolute top-4 right-4 bg-dark-card rounded-full border border-dark-border cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <HeaderBar setMobileMenuOpen={setMobileMenuOpen} />

        <main className="flex-1 overflow-y-auto bg-dark-bg p-6 md:p-8">
          <div className="max-w-7xl mx-auto w-full animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
