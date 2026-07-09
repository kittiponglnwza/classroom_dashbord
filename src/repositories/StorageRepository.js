import { ValidationError, StorageError } from '../utils/errors';
import { STORAGE_CONFIG } from '../config/storage';
import { logger } from '../utils/logger';

// In-memory cache store
const memoryCache = new Map();

export class StorageRepository {
  static getCacheKey(key, email) {
    const active = email ? email.toLowerCase().trim() : '';
    return active ? `${key}_${active}` : key;
  }

  /**
   * Validates data structure using defensive schema checks
   */
  static validate(key, data) {
    if (data === null || data === undefined) return;

    try {
      if (key === STORAGE_CONFIG.keys.assignments) {
        if (!Array.isArray(data)) throw new ValidationError('Assignments must be an array.');
        data.forEach(item => {
          if (!item.id || !item.title) {
            throw new ValidationError('Assignment must contain id and title.');
          }
        });
      }

      if (key === STORAGE_CONFIG.keys.courses) {
        if (!Array.isArray(data)) throw new ValidationError('Courses must be an array.');
        data.forEach(item => {
          if (!item.id || !item.name) {
            throw new ValidationError('Course must contain id and name.');
          }
        });
      }

      if (key === STORAGE_CONFIG.keys.schedule) {
        if (!Array.isArray(data)) throw new ValidationError('Schedule must be an array.');
        data.forEach(item => {
          if (!item.id || !item.day || !item.startTime || !item.endTime) {
            throw new ValidationError('Schedule entry must contain id, day, startTime, and endTime.');
          }
        });
      }

      if (key === STORAGE_CONFIG.keys.exams) {
        if (typeof data !== 'object') throw new ValidationError('Exams cache must be an object.');
        if (!Array.isArray(data.exams || []) || !Array.isArray(data.manualExams || [])) {
          throw new ValidationError('Exams fields must be arrays.');
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
  static migrate(email) {
    const activeEmail = email ? email.toLowerCase().trim() : '';
    const versionKey = activeEmail ? `classroom_hub_schema_version_${activeEmail}` : 'classroom_hub_schema_version';
    const storedVersion = parseInt(localStorage.getItem(versionKey) || '1', 10);

    if (storedVersion < STORAGE_CONFIG.schemaVersion) {
      logger.info(`Migrating data schema for ${activeEmail || 'default'} from v${storedVersion} to v${STORAGE_CONFIG.schemaVersion}`);
      
      // Perform schema migrations here
      if (storedVersion === 1) {
        // Example: Migrate settings or key names if required
        // In this case, we migrate old keys to lowercase email keys (handled dynamically in storage.js)
      }

      localStorage.setItem(versionKey, String(STORAGE_CONFIG.schemaVersion));
    }
  }

  /**
   * Write data to storage (Memory Cache & LocalStorage) with schema validation and updatedAt
   */
  static set(baseKey, value, email = '') {
    const cacheKey = this.getCacheKey(baseKey, email);
    
    // Schema validation
    this.validate(baseKey, value);

    const payload = {
      version: STORAGE_CONFIG.schemaVersion,
      timestamp: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      data: value
    };

    try {
      const serialized = JSON.stringify(payload);
      localStorage.setItem(cacheKey, serialized);
      memoryCache.set(cacheKey, payload);
      
      // Update modification timestamp for synchronization
      if (email) {
        const timeKey = `classroom_hub_settings_last_updated_${email.toLowerCase().trim()}`;
        localStorage.setItem(timeKey, payload.timestamp);
      }
    } catch (err) {
      logger.error(`LocalStorage write error for key: ${cacheKey}`, err);
      throw new StorageError(`Failed to save settings data: ${err.message}`);
    }
  }

  /**
   * Get data from storage checking Memory Cache, LocalStorage, and TTL expiration
   */
  static get(baseKey, email = '', forceIgnoreTTL = false) {
    const cacheKey = this.getCacheKey(baseKey, email);
    this.migrate(email);

    // 1. Check memory cache first
    if (memoryCache.has(cacheKey)) {
      const cached = memoryCache.get(cacheKey);
      if (this.isValidCache(baseKey, cached, forceIgnoreTTL)) {
        logger.debug(`Cache Hit (Memory) for ${cacheKey}`);
        return cached.data;
      }
      logger.debug(`Cache Expired (Memory) for ${cacheKey}`);
    }

    // 2. Fall back to LocalStorage
    const stored = localStorage.getItem(cacheKey);
    if (!stored) {
      return null;
    }

    try {
      const parsed = JSON.parse(stored);
      
      // Verify wrap structure
      if (parsed && parsed.data !== undefined) {
        if (this.isValidCache(baseKey, parsed, forceIgnoreTTL)) {
          logger.debug(`Cache Hit (LocalStorage) for ${cacheKey}`);
          memoryCache.set(cacheKey, parsed);
          return parsed.data;
        }
        logger.info(`Cache Expired (LocalStorage) for ${cacheKey}`);
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
  static isValidCache(baseKey, cachedObject, forceIgnoreTTL) {
    if (forceIgnoreTTL) return true;
    
    const ttl = STORAGE_CONFIG.ttls[baseKey];
    if (!ttl) return true; // Items without configured TTL (e.g. local settings) do not expire

    const age = Date.now() - new Date(cachedObject.timestamp).getTime();
    return age < ttl;
  }

  /**
   * Remove item from storage
   */
  static remove(baseKey, email = '') {
    const cacheKey = this.getCacheKey(baseKey, email);
    localStorage.removeItem(cacheKey);
    memoryCache.delete(cacheKey);
  }

  /**
   * Clear all active memory caches
   */
  static clearMemoryCache() {
    memoryCache.clear();
  }
}
