import { Result } from '../../utils/result';
import { EXAM_CONFIG } from '../../config/exam';
import { sanitizeExternalUrl } from '../../utils/sanitize';
import { logger } from '../../utils/logger';

const stableExamPart = (val) =>
  String(val || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_\u0E00-\u0E7F-]/g, '')
    .slice(0, 32);

const isAllowedHostname = (urlString, checkFn) => {
  const safe = sanitizeExternalUrl(urlString);
  if (!safe) return false;
  try {
    const parsed = new URL(safe);
    return checkFn(parsed);
  } catch {
    return false;
  }
};

/**
 * Parses the raw HTML text from KMUTNB exam system into structured Exam objects.
 * 
 * @param {string} htmlText 
 * @param {string} lang 
 * @returns {import('../../utils/result').Result<{exams: Exam[], unlisted: UnlistedInfo|null}>}
 */
export const parseExamHtml = (htmlText, lang) => {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, 'text/html');

    const tables = doc.querySelectorAll('table');
    let examTable = null;
    let colIndexes = {
      date: -1, time: -1, subjectCode: -1, subjectName: -1,
      row: -1, seat: -1, room: -1, floor: -1, building: -1
    };

    tables.forEach(table => {
      if (examTable) return;
      const localIndexes = {
        date: -1, time: -1, subjectCode: -1, subjectName: -1,
        row: -1, seat: -1, room: -1, floor: -1, building: -1
      };

      const headerRow = table.querySelector('thead tr') || table.querySelector('tr');
      const headers = headerRow
        ? Array.from(headerRow.querySelectorAll('th, td')).map(cell => cell.textContent.trim())
        : [];
      
      let foundCount = 0;
      headers.forEach((header, idx) => {
        const text = header.trim();
        if (text.includes('วัน')) { localIndexes.date = idx; foundCount++; }
        else if (text.includes('เวลา')) { localIndexes.time = idx; foundCount++; }
        else if (text.includes('รหัสวิชา')) { localIndexes.subjectCode = idx; foundCount++; }
        else if (text.includes('วิชาที่สอบ') || (text.includes('วิชา') && localIndexes.subjectName === -1)) { localIndexes.subjectName = idx; foundCount++; }
        else if (text.includes('แถว')) { localIndexes.row = idx; }
        else if (text.includes('ลำดับที่นั่ง') || (text.includes('ที่นั่ง') && localIndexes.seat === -1)) { localIndexes.seat = idx; }
        else if (text.includes('ห้อง')) { localIndexes.room = idx; foundCount++; }
        else if (text.includes('ชั้น')) { localIndexes.floor = idx; }
        else if (text.includes('อาคาร')) { localIndexes.building = idx; }
      });

      if (foundCount >= 3) {
        examTable = table;
        colIndexes = localIndexes;
      }
    });

    if (examTable) {
      const captionText = (examTable.querySelector('caption')?.textContent || '').replace(/\s+/g, ' ').trim();
      const captionExamType = captionText.includes('กลางภาค')
        ? 'midterm'
        : (captionText.includes('ปลายภาค') ? 'final' : '');
      const captionTermMatch = captionText.match(/ภาคเรียนที่\s*(\d+)\s*ปีการศึกษา\s*(\d{4})/);
      const captionTermLabel = captionTermMatch ? `${captionTermMatch[1]}/${captionTermMatch[2]}` : '';

      const rows = Array.from(examTable.querySelectorAll('tr')).slice(1);
      const parsedExams = [];

      rows.forEach((row, rowIndex) => {
        const cells = Array.from(row.querySelectorAll('td')).map(cell => cell.textContent.trim());
        if (cells.length === 0) return;

        let dateText = colIndexes.date !== -1 ? (cells[colIndexes.date] || '') : '';
        
        // Apply generic month replacements from configuration if defined
        EXAM_CONFIG.monthReplacements.forEach(({ pattern, replacement }) => {
          dateText = dateText.replace(pattern, replacement);
        });
        
        const timeText = colIndexes.time !== -1 ? (cells[colIndexes.time] || '') : '';
        const codeVal = colIndexes.subjectCode !== -1 ? (cells[colIndexes.subjectCode] || '') : '';
        const nameVal = colIndexes.subjectName !== -1 ? (cells[colIndexes.subjectName] || '') : '';
        const rowVal = colIndexes.row !== -1 ? (cells[colIndexes.row] || '') : '';
        const seatVal = colIndexes.seat !== -1 ? (cells[colIndexes.seat] || '') : '';
        const roomVal = colIndexes.room !== -1 ? (cells[colIndexes.room] || '') : '';
        const floorVal = colIndexes.floor !== -1 ? (cells[colIndexes.floor] || '') : '';
        const buildingVal = colIndexes.building !== -1 ? (cells[colIndexes.building] || '') : '';

        if (!nameVal && !codeVal) return;

        let courseCode = codeVal || 'CLASSROOM';
        let courseName = nameVal || codeVal;
        
        if (!codeVal && nameVal) {
          const codeMatch = nameVal.match(/^([A-Z]{3,4}\d{3,4}|[0-9]{7,9})/i);
          if (codeMatch) {
            courseCode = codeMatch[0];
            courseName = nameVal.substring(courseCode.length).replace(/^[\s-–:]+/, '').trim();
          }
        }

        let seatText = seatVal;
        if (rowVal && seatVal) {
          seatText = lang === 'en' ? `Row ${rowVal}, Seat ${seatVal}` : `แถว ${rowVal} ที่นั่ง ${seatVal}`;
        }

        let roomText = roomVal;
        if (buildingVal || floorVal) {
          const bPart = buildingVal ? (lang === 'en' ? `Bldg. ${buildingVal}` : `อาคาร ${buildingVal}`) : '';
          const fPart = floorVal ? (lang === 'en' ? `Fl. ${floorVal}` : `ชั้น ${floorVal}`) : '';
          const extra = [bPart, fPart].filter(Boolean).join(', ');
          if (extra) {
            roomText = `${roomVal} (${extra})`;
          }
        }

        const stableId = [
          'exam',
          stableExamPart(courseCode) || 'course',
          stableExamPart(dateText) || 'nodate',
          stableExamPart(timeText) || 'notime',
          rowIndex
        ].join('-');

        parsedExams.push({
          id: stableId,
          courseCode,
          courseName,
          date: dateText,
          time: timeText,
          room: roomText,
          seat: seatText,
          ...(captionExamType ? { examType: captionExamType } : {}),
          ...(captionTermLabel ? { termLabel: captionTermLabel } : {})
        });
      });

      if (parsedExams.length > 0) {
        return Result.ok({ exams: parsedExams, unlisted: null });
      }
    }

    // Handle Unlisted State with configuration-driven fallbacks
    const links = doc.querySelectorAll('a');
    let pdfLink = EXAM_CONFIG.fallbackPdfLink;
    let formLink = EXAM_CONFIG.fallbackFormLink;

    links.forEach(a => {
      const href = sanitizeExternalUrl(a.getAttribute('href') || '');
      if (!href) return;
      if (
        isAllowedHostname(
          href,
          (u) =>
            u.protocol === 'https:' &&
            u.hostname.toLowerCase() === 'drive.google.com' &&
            (u.pathname.startsWith('/file/') || u.pathname.startsWith('/drive/'))
        )
      ) {
        pdfLink = href;
      } else if (
        isAllowedHostname(
          href,
          (u) =>
            u.protocol === 'https:' &&
            ((u.hostname.toLowerCase() === 'forms.gle' && /^\/[A-Za-z0-9_-]+$/.test(u.pathname)) ||
              (u.hostname.toLowerCase() === 'docs.google.com' && u.pathname.startsWith('/forms/')))
        )
      ) {
        formLink = href;
      }
    });

    return Result.ok({ exams: [], unlisted: { pdfLink, formLink } });
    
  } catch (error) {
    logger.error('Failed parsing exam HTML', error);
    return Result.fail(error);
  }
};
