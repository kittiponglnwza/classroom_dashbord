import { GOOGLE_CONFIG } from '../config/google';

/**
 * Initialize Google OAuth 2.0 Token Client
 */
export const initGoogleClient = (onSuccess, onError) => {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  if (!clientId || clientId.includes('your-google-client-id-here')) {
    console.warn('VITE_GOOGLE_CLIENT_ID is not configured properly in .env');
    return null;
  }

  if (!window.google?.accounts?.oauth2) {
    console.error('Google Accounts OAuth2 SDK is not loaded. Make sure the script is in index.html');
    return null;
  }

  return window.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: GOOGLE_CONFIG.scopes.join(' '),
    callback: (tokenResponse) => {
      if (tokenResponse.error) {
        onError(tokenResponse);
      } else {
        onSuccess(tokenResponse);
      }
    },
    // Non-OAuth failures (popup blocked / closed by user). Without this handler GIS never
    // invokes `callback`, leaving any pending token request unresolved forever.
    error_callback: (err) => {
      onError({ error: err?.type || 'popup_error', error_description: err?.message || '' });
    },
  });
};
