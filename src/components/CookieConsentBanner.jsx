import { useState } from 'react';
import { ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { getCookieConsent, saveCookieConsent } from '../utils/cookieConsent';
import { useSettings } from '../contexts/SettingsContext';

export default function CookieConsentBanner() {
  const settings = useSettings();
  const lang = settings?.lang || 'en';

  const [consent, setConsent] = useState(() => getCookieConsent());
  const [customizing, setCustomizing] = useState(false);
  const [preferencesEnabled, setPreferencesEnabled] = useState(true);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);

  if (consent) {
    return null;
  }

  const handleAcceptAll = () => {
    const saved = saveCookieConsent({
      preferences: true,
      analytics: true,
      status: 'accepted_all'
    });
    setConsent(saved);
  };

  const handleRejectOptional = () => {
    const saved = saveCookieConsent({
      preferences: false,
      analytics: false,
      status: 'rejected_optional'
    });
    setConsent(saved);
  };

  const handleSaveCustom = () => {
    const saved = saveCookieConsent({
      preferences: preferencesEnabled,
      analytics: analyticsEnabled,
      status: 'custom'
    });
    setConsent(saved);
  };

  return (
    <div
      role="region"
      aria-label={lang === 'en' ? 'Cookie consent' : 'การยินยอมคุกกี้'}
      data-testid="cookie-consent-banner"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 bg-white border border-[#D2D2D7] rounded-2xl p-4 shadow-md text-xs text-[#1D1D1F] space-y-3"
    >
      <div className="flex items-start gap-2.5">
        <ShieldCheck size={18} className="text-[#0071E3] shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h2 className="font-semibold text-[#1D1D1F] text-xs">
            {lang === 'en' ? 'Cookie & Storage Preferences' : 'การตั้งค่าคุกกี้และพื้นที่จัดเก็บข้อมูล'}
          </h2>
          <p className="text-[11px] text-[#6E6E73] leading-relaxed">
            {lang === 'en'
              ? 'We use strictly necessary storage for Google sign-in and task sync. You can accept all, reject optional cookies, or customize your preferences.'
              : 'เว็บไซต์ใช้คุกกี้และพื้นที่จัดเก็บที่จำเป็นสำหรับการเข้าสู่ระบบและซิงค์งาน คุณสามารถเลือกยอมรับทั้งหมด ปฏิเสธคุกกี้ที่ไม่จำเป็น หรือตั้งค่าเองได้'}
          </p>
        </div>
      </div>

      {customizing && (
        <div className="space-y-2 pt-2 border-t border-[#D2D2D7]/70 text-[11px]" data-testid="cookie-customize-panel">
          <label className="flex items-center justify-between gap-2 text-[#1D1D1F]">
            <span>{lang === 'en' ? 'Strictly Necessary (Auth & Sync)' : 'คุกกี้ที่จำเป็น (ระบบล็อกอินและซิงค์ข้อมูล)'}</span>
            <input type="checkbox" checked disabled className="rounded accent-[#0071E3]" />
          </label>
          <label className="flex items-center justify-between gap-2 text-[#1D1D1F] cursor-pointer">
            <span>{lang === 'en' ? 'UI Preferences (Language & View)' : 'คุกกี้การตั้งค่าผู้ใช้ (ภาษาและการแสดงผล)'}</span>
            <input
              type="checkbox"
              checked={preferencesEnabled}
              onChange={(e) => setPreferencesEnabled(e.target.checked)}
              className="rounded accent-[#0071E3] cursor-pointer"
            />
          </label>
          <label className="flex items-center justify-between gap-2 text-[#1D1D1F] cursor-pointer">
            <span>{lang === 'en' ? 'Optional Analytics' : 'คุกกี้วิเคราะห์การใช้งาน (ไม่จำเป็น)'}</span>
            <input
              type="checkbox"
              checked={analyticsEnabled}
              onChange={(e) => setAnalyticsEnabled(e.target.checked)}
              className="rounded accent-[#0071E3] cursor-pointer"
            />
          </label>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={() => setCustomizing(prev => !prev)}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#D2D2D7] text-[#1D1D1F] hover:bg-[#F5F5F7] transition-colors cursor-pointer text-[11px] font-medium"
        >
          <SlidersHorizontal size={12} />
          <span>{lang === 'en' ? 'Customize' : 'ตั้งค่า'}</span>
        </button>
        <button
          type="button"
          onClick={handleRejectOptional}
          className="px-3 py-1.5 rounded-lg border border-[#D2D2D7] bg-[#F5F5F7] hover:bg-[#E8E8ED] text-[#1D1D1F] font-medium transition-colors cursor-pointer text-[11px]"
        >
          {lang === 'en' ? 'Reject Optional' : 'ปฏิเสธที่ไม่จำเป็น'}
        </button>
        {customizing ? (
          <button
            type="button"
            onClick={handleSaveCustom}
            className="px-3 py-1.5 rounded-lg bg-[#0071E3] hover:bg-[#0077ED] text-white font-medium transition-colors cursor-pointer text-[11px]"
          >
            {lang === 'en' ? 'Save Preferences' : 'บันทึกการตั้งค่า'}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleAcceptAll}
            className="px-3 py-1.5 rounded-lg bg-[#0071E3] hover:bg-[#0077ED] text-white font-medium transition-colors cursor-pointer text-[11px]"
          >
            {lang === 'en' ? 'Accept All' : 'ยอมรับทั้งหมด'}
          </button>
        )}
      </div>
    </div>
  );
}
