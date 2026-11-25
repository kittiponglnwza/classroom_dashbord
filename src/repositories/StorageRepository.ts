import { ValidationError, StorageError } from '../utils/errors';
import { STORAGE_CONFIG } from '../config/storage';
import { logger } from '../utils/logger';
import { SyncRecord } from '../types/models';

// In-memory cache store
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const memoryCache = new Map<string, SyncRecord<any>>();
const rawCache = new Map<string, string>();

const NON_ACCOUNT_STORAGE_KEYS = new Set([
  'classroom_hub_remember_me',
  'classroom_hub_cookie_consent',
  'classroom_hub_language',
  'classroom_hub_exam_layout',
  'classroom_hub_schema_version',
  STORAGE_CONFIG.keys.accessToken,
  `${STORAGE_CONFIG.keys.accessToken}_expires_at`,
  `${STORAGE_CONFIG.keys.accessToken}_verified_email`,
  STORAGE_CONFIG.keys.activeEmail,
]);

export class StorageRepository {
  /**
   * Returns persistent `localStorage` when "Remember me" is enabled (default),
   * or ephemeral `sessionStorage` when "Remember me" is disabled (Public/Shared PC mode)
   * so grades, Student IDs, and Discord Webhook URLs never touch disk persistence.
   */
  static getScopedStorage(): Storage {
    try {
      if (
        typeof localStorage !== 'undefined' &&
        typeof sessionStorage !== 'undefined' &&
        localStorage.getItem('classroom_hub_remember_me') === 'false'
      ) {
        return sessionStorage;
      }
    } catch {
      // Fallback to localStorage if sessionStorage access fails
    }
    return localStorage;
  }

  /**
   * Relocates active user-scoped records between `localStorage` and `sessionStorage`
   * when the user toggles "Remember me" mid-session.
   */
  static relocateAccountStorage(toPersistent: boolean): void {
    if (typeof localStorage === 'undefined' || typeof sessionStorage === 'undefined') return;
    const fromStore = toPersistent ? sessionStorage : localStorage;
    const toStore = toPersistent ? localStorage : sessionStorage;
    const keysToMove: string[] = [];

    for (let i = 0; i < fromStore.length; i++) {
      const k = fromStore.key(i);
      if (k && k.startsWith('classroom_hub_') && !NON_ACCOUNT_STORAGE_KEYS.has(k)) {
        keysToMove.push(k);
      }
    }

    keysToMove.forEach((k) => {
      const val = fromStore.getItem(k);
      if (val !== null) {
        try {
          toStore.setItem(k, val);
        } catch (err) {
          logger.warn(`Failed relocating storage key ${k}:`, err);
        }
      }
      fromStore.removeItem(k);
    });
    this.clearMemoryCache();
  }

  static getCacheKey(key: string, email?: string): string {
    const active = email ? email.toLowerCase().trim() : '';
    return active ? `${key}_${active}` : key;
  }

  /**
   * Validates data structure using defensive schema checks
   */
  static validate(key: string, data: unknown): void {
    if (data === null || data === undefined) return;

    try {
      if (key === STORAGE_CONFIG.keys.assignments) {
        if (!Array.isArray(data)) throw new ValidationError('Assignments must be an array.');
        data.forEach(item => {
          if (!item || !item.id || typeof item.title !== 'string') {
            throw new ValidationError('Assignment must contain id and title.');
          }
        });
      }

      if (key === STORAGE_CONFIG.keys.courses) {
        if (!Array.isArray(data)) throw new ValidationError('Courses must be an array.');
        data.forEach(item => {
          if (!item || !item.id || typeof item.name !== 'string') {
            throw new ValidationError('Course must contain id and name.');
          }
        });
      }

      if (key === STORAGE_CONFIG.keys.schedule) {
        if (!Array.isArray(data)) throw new ValidationError('Schedule must be an array.');
        data.forEach(item => {
          if (!item || !item.id || !item.day || !item.startTime || !item.endTime) {
            throw new ValidationError('Schedule entry must contain id, day, startTime, and endTime.');
          }
        });
      }

      if (key === STORAGE_CONFIG.keys.exams) {
        if (typeof data !== 'object' || data === null) throw new ValidationError('Exams cache must be an object.');
        const typedData = data as Record<string, unknown>;
        if (!Array.isArray(typedData.exams || []) || !Array.isArray(typedData.manualExams || [])) {
          throw new ValidationError('Exams fields must be arrays.');
        }
      }

      if (key === STORAGE_CONFIG.keys.academic) {
        if (typeof data !== 'object' || data === null || Array.isArray(data)) {
          throw new ValidationError('Academic data must be an object.');
        }
        const typedData = data as Record<string, unknown>;
        if (!Array.isArray(typedData.semesters || []) || !Array.isArray(typedData.enrolledCourses || [])) {
          throw new ValidationError('Academic semesters and enrolledCourses must be arrays.');
        }
      }
    } catch (err) {
      logger.error(`Validation failed for key: ${key}`, err);
      throw err;
    }
  }

  /**
   * Migrate storage schema versions if required
   */
  static migrate(email?: string): void {
    const store = this.getScopedStorage();
    const activeEmail = email ? email.toLowerCase().trim() : '';
    const versionKey = activeEmail ? `classroom_hub_schema_version_${activeEmail}` : 'classroom_hub_schema_version';
    const storedVersion = parseInt(store.getItem(versionKey) || '1', 10);

    if (storedVersion < STORAGE_CONFIG.schemaVersion) {
      logger.info(`Migrating data schema for ${activeEmail || 'default'} from v${storedVersion} to v${STORAGE_CONFIG.schemaVersion}`);
      
      // Perform schema migrations here
      if (storedVersion === 1) {
        // Example: Migrate settings or key names if required
        // In this case, we migrate old keys to lowercase email keys (handled dynamically in storage.js)
      }

      store.setItem(versionKey, String(STORAGE_CONFIG.schemaVersion));
    }
  }

  /**
   * Evict heavy regenerable caches (resources & stale exam caches) to free storage quota
   */
  private static evictExpendableCaches(email = '', includeExams = false): void {
    try {
      const store = this.getScopedStorage();
      const keysToRemove: string[] = [];
      const resourcesPrefix = STORAGE_CONFIG.keys.resources;
      const examsPrefix = STORAGE_CONFIG.keys.exams;

      for (let i = 0; i < store.length; i++) {
        const k = store.key(i);
        if (!k) continue;
        if (k === resourcesPrefix || k.startsWith(`${resourcesPrefix}_`)) {
          keysToRemove.push(k);
        }
        if (includeExams && (k === examsPrefix || k.startsWith(`${examsPrefix}_`))) {
          keysToRemove.push(k);
        }
      }
      if (keysToRemove.length === 0 && !includeExams) {
        for (let i = 0; i < store.length; i++) {
          const k = store.key(i);
          if (k && (k === examsPrefix || k.startsWith(`${examsPrefix}_`))) {
            keysToRemove.push(k);
          }
        }
      }
      keysToRemove.forEach((k) => {
        store.removeItem(k);
        memoryCache.delete(k);
        rawCache.delete(k);
      });
      if (keysToRemove.length > 0) {
        logger.warn(`Evicted ${keysToRemove.length} expendable cache keys after QuotaExceededError (${email || 'default'})`);
      }
    } catch (evictErr) {
      logger.warn('Failed to evict expendable caches:', evictErr);
    }
  }

  /**
   * Write data to storage (Memory Cache & Scoped Storage) with schema validation and updatedAt
   */
  static set<T>(baseKey: string, value: T, email = ''): void {
    const store = this.getScopedStorage();
    const cacheKey = this.getCacheKey(baseKey, email);
    
    // Schema validation
    this.validate(baseKey, value);

    const payload: SyncRecord<any> = {
      version: STORAGE_CONFIG.schemaVersion,
      timestamp: new Date().toISOString(),
      data: value as any
    };

    const serialized = JSON.stringify(payload);
    const writePayload = () => {
      store.setItem(cacheKey, serialized);
      memoryCache.set(cacheKey, payload);
      rawCache.set(cacheKey, serialized);

      const isSyncableUserKey =
        baseKey === STORAGE_CONFIG.keys.assignments ||
        baseKey === STORAGE_CONFIG.keys.courses ||
        baseKey === STORAGE_CONFIG.keys.schedule ||
        baseKey === STORAGE_CONFIG.keys.hiddenCourses ||
        baseKey === STORAGE_CONFIG.keys.academic;
      if (email && isSyncableUserKey) {
        const timeKey = `classroom_hub_settings_last_updated_${email.toLowerCase().trim()}`;
        store.setItem(timeKey, payload.timestamp);
      }
    };

    try {
      writePayload();
    } catch (err: any) {
      const isQuota =
        err?.name === 'QuotaExceededError' ||
        err?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
        err?.code === 22;

      if (isQuota && baseKey !== STORAGE_CONFIG.keys.resources) {
        this.evictExpendableCaches(email, false);
        try {
          writePayload();
          return;
        } catch (retryErr: any) {
          this.evictExpendableCaches(email, true);
          try {
            writePayload();
            return;
          } catch (finalErr: any) {
            logger.error(`LocalStorage write retry failed after full cache eviction for key: ${cacheKey}`, finalErr || retryErr);
            throw new StorageError(`Failed to save data (storage quota exceeded): ${finalErr?.message || 'QuotaExceededError'}`);
          }
        }
      }
      logger.error(`LocalStorage write error for key: ${cacheKey}`, err);
      throw new StorageError(`Failed to save settings data: ${err?.message || 'Storage error'}`);
    }
  }

  /**
   * Get data from storage checking Memory Cache, LocalStorage, and TTL expiration
   */
  static get<T>(baseKey: string, email = '', forceIgnoreTTL = false): T | null {
    const store = this.getScopedStorage();
    const cacheKey = this.getCacheKey(baseKey, email);
    this.migrate(email);

    const stored = store.getItem(cacheKey);
    if (!stored) {
      memoryCache.delete(cacheKey);
      rawCache.delete(cacheKey);
      return null;
    }

    // 1. Check memory cache first (only when raw localStorage string matches)
    if (memoryCache.has(cacheKey) && rawCache.get(cacheKey) === stored) {
      const cached = memoryCache.get(cacheKey)!;
      if (this.isValidCache(baseKey, cached, forceIgnoreTTL)) {
        logger.debug(`Cache Hit (Memory) for ${cacheKey}`);
        return cached.data as T;
      }
      memoryCache.delete(cacheKey);
      rawCache.delete(cacheKey);
      logger.debug(`Cache Expired (Memory) for ${cacheKey}`);
      return null;
    }

    // 2. Parse from LocalStorage
    try {
      const parsed = JSON.parse(stored) as SyncRecord<any>;
      
      // Verify wrap structure
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed.data !== undefined && parsed.timestamp !== undefined) {
        if (this.isValidCache(baseKey, parsed, forceIgnoreTTL)) {
          logger.debug(`Cache Hit (LocalStorage) for ${cacheKey}`);
          memoryCache.set(cacheKey, parsed);
          rawCache.set(cacheKey, stored);
          return parsed.data as T;
        }
        memoryCache.delete(cacheKey);
        rawCache.delete(cacheKey);
        logger.info(`Cache Expired (LocalStorage) for ${cacheKey}`);
        return null;
      }

      // Handle legacy unwrapped records transparently
      if (parsed !== undefined) {
        return parsed as T;
      }
      return null;
    } catch (err) {
      logger.error(`LocalStorage read/parse error for key: ${cacheKey}`, err);
      return null;
    }
  }

  /**
   * Validate if cached item is within TTL limits
   */
  static isValidCache(baseKey: string, cachedObject: SyncRecord<any>, forceIgnoreTTL: boolean): boolean {
    if (forceIgnoreTTL) return true;
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ttls = STORAGE_CONFIG.ttls as any;
    const ttl = ttls[baseKey];
    if (!ttl) return true; // Items without configured TTL (e.g. local settings) do not expire

    const parsedTime = new Date(cachedObject?.timestamp).getTime();
    if (!Number.isFinite(parsedTime)) return false;
    const age = Date.now() - parsedTime;
    return age >= 0 && age < ttl;
  }

  /**
   * Remove item from storage
   */
  static remove(baseKey: string, email = ''): void {
    const cacheKey = this.getCacheKey(baseKey, email);
    localStorage.removeItem(cacheKey);
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(cacheKey);
    }
    memoryCache.delete(cacheKey);
    rawCache.delete(cacheKey);
  }

  /**
   * Clear all active memory caches
   */
  static clearMemoryCache(): void {
    memoryCache.clear();
    rawCache.clear();
  }
}
