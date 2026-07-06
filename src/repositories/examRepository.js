import { Result, ValidationError } from '../utils/result';
import { fetchExamHtml } from '../services/api/examApi';
import { parseExamHtml } from '../services/parsers/examParser';
import { touchLocalSettingsTimestamp } from '../utils/storage';
import '../types/index';

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

const getCacheKey = (email) => 
  email ? `classroom_hub_exam_results_${email}` : 'classroom_hub_exam_results_';

export const examRepository = {
  /**
   * Validates student ID
   * @param {string} studentId 
   * @param {string} lang 
   * @returns {import('../utils/result').Result<string>} Cleaned ID or Error
   */
  validateStudentId(studentId, lang) {
    const cleanId = studentId.replace(/\D/g, '').trim();
    if (cleanId.length !== 13) {
      return Result.fail(new ValidationError(lang === 'en' ? 'Student ID must be exactly 13 digits.' : 'รหัสนักศึกษาต้องมีความยาว 13 หลัก'));
    }
    return Result.ok(cleanId);
  },

  /**
   * Fetches exams (network + parse)
   * @param {string} cleanId 
   * @param {string} lang 
   * @param {AbortSignal} signal 
   * @returns {Promise<import('../utils/result').Result<{exams: Exam[], unlisted: UnlistedInfo|null}>>}
   */
  async fetchExams(cleanId, lang, signal) {
    const htmlResult = await fetchExamHtml(cleanId, signal);
    
    if (!htmlResult.success) {
      return htmlResult; // pass through the error (ApiError/NetworkError/AbortError)
    }

    return parseExamHtml(htmlResult.data, lang);
  },

  /**
   * Gets cached exams, checking TTL
   */
  getCachedExams(activeEmail) {
    const cached = localStorage.getItem(getCacheKey(activeEmail));
    if (!cached) return Result.ok(null);

    try {
      const parsed = JSON.parse(cached);
      
      // Check TTL (if timestamp exists)
      if (parsed.timestamp) {
        const cacheTime = new Date(parsed.timestamp).getTime();
        const now = Date.now();
        if (now - cacheTime > CACHE_TTL_MS) {
          // Cache expired, wipe strictly exams part (keep manual exams)
          parsed.exams = [];
          parsed.unlisted = null;
          // Note: we don't return null because we still want to load manualExams
        }
      }

      return Result.ok(parsed);
    } catch (e) {
      return Result.fail(e);
    }
  },

  /**
   * Saves exams to cache
   */
  saveToCache(activeEmail, exams, manualExams, unlisted) {
    try {
      localStorage.setItem(getCacheKey(activeEmail), JSON.stringify({
        exams,
        manualExams,
        unlisted,
        timestamp: new Date().toISOString()
      }));
      touchLocalSettingsTimestamp(activeEmail);
      return Result.ok(true);
    } catch (e) {
      return Result.fail(e);
    }
  },

  /**
   * Clears exams from cache (leaves manual exams intact)
   */
  clearExamsCache(activeEmail) {
    const cached = this.getCachedExams(activeEmail);
    if (cached.success && cached.data) {
      const { manualExams } = cached.data;
      this.saveToCache(activeEmail, [], manualExams || [], null);
    }
  }
};
