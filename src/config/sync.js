export const SYNC_CONFIG = {
  debounceDelayMs: 1000,
  maxRetryAttempts: 3,
  backoffBaseMs: 1000,
  backoffMaxMs: 15000,
  jitterEnabled: true,
  
  // Feature Flags
  featureFlags: {
    backgroundGmail: false, // Disabled due to client-side implicit flow limitations
    examParser: true,
    experimentalSync: true,
    clientSideEncryption: false // Set to true if Web Crypto AES-GCM is active
  }
};
