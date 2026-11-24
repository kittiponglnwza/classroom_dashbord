export const APP_VERSION =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_APP_VERSION) || '1.2.2';

export const APP_COMMIT =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_APP_COMMIT) || '';

export const APP_BUILD_TIME =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_APP_BUILD_TIME) ||
  '2026-11-24T06:23:00.000Z';

export function formatAppBuildTime(lang = 'en', isoStr = APP_BUILD_TIME) {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString(lang === 'th' ? 'th-TH' : 'en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export async function forceCheckPwaUpdate() {
  try {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((reg) => reg.update().catch(() => {})));
    }
  } catch {
    // Ignore service worker update errors
  }
  if (typeof window !== 'undefined' && window.location) {
    window.location.reload();
  }
}
