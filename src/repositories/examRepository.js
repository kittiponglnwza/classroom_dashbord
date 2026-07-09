import { Result, ValidationError } from '../utils/result';
import { fetchExamHtml } from '../services/api/examApi';
import { parseExamHtml } from '../services/parsers/examParser';
import { StorageRepository } from './StorageRepository';
import { STORAGE_CONFIG } from '../config/storage';
import { logger } from '../utils/logger';
import '../types/index';

const KEYS = STORAGE_CONFIG.keys;

export const examRepository = {
  /**
   * Validates student ID
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
   */
  async fetchExams(cleanId, lang, signal) {
    const htmlResult = await fetchExamHtml(cleanId, signal);
    
    if (!htmlResult.success) {
      return htmlResult;
    }

    return parseExamHtml(htmlResult.data, lang);
  },

  /**
   * Gets cached exams, checking TTL
   */
  getCachedExams(activeEmail) {
    try {
      // 1. Try to load cached exams within TTL
      const data = StorageRepository.get(KEYS.exams, activeEmail, false);
      if (data) {
        return Result.ok(data);
      }

      // 2. If expired, load raw cache without TTL check to recover manualExams
      const rawData = StorageRepository.get(KEYS.exams, activeEmail, true);
      if (!rawData) {
        return Result.ok({ exams: [], manualExams: [], unlisted: null });
      }

      // 3. TTL has expired, so wipe external exams but preserve manual exams
      logger.info(`Exam cache expired for ${activeEmail}. Clearing external exams while preserving manual exams.`);
      const updatedCache = {
        exams: [],
        manualExams: rawData.manualExams || [],
        unlisted: null
      };

      // Save the cleaned structure back to storage
      StorageRepository.set(KEYS.exams, updatedCache, activeEmail);
      return Result.ok(updatedCache);

    } catch (e) {
      logger.error('Failed reading exam cache', e);
      return Result.fail(e);
    }
  },

  /**
   * Saves exams to cache
   */
  saveToCache(activeEmail, exams, manualExams, unlisted) {
    try {
      const cacheData = {
        exams,
        manualExams,
        unlisted
      };
      StorageRepository.set(KEYS.exams, cacheData, activeEmail);
      return Result.ok(true);
    } catch (e) {
      logger.error('Failed writing exam cache', e);
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
