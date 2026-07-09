import { Result, ParserError } from '../../utils/result';
import { EXAM_CONFIG } from '../../config/exam';
import { logger } from '../../utils/logger';

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
      const headers = Array.from(table.querySelectorAll('th, td')).map(cell => cell.textContent.trim());
      
      let foundCount = 0;
      headers.forEach((header, idx) => {
        const text = header.trim();
        if (text.includes('วัน')) { colIndexes.date = idx; foundCount++; }
        else if (text.includes('เวลา')) { colIndexes.time = idx; foundCount++; }
        else if (text.includes('รหัสวิชา')) { colIndexes.subjectCode = idx; foundCount++; }
        else if (text.includes('วิชาที่สอบ') || (text.includes('วิชา') && colIndexes.subjectName === -1)) { colIndexes.subjectName = idx; foundCount++; }
        else if (text.includes('แถว')) { colIndexes.row = idx; }
        else if (text.includes('ลำดับที่นั่ง') || (text.includes('ที่นั่ง') && colIndexes.seat === -1)) { colIndexes.seat = idx; }
        else if (text.includes('ห้อง')) { colIndexes.room = idx; foundCount++; }
        else if (text.includes('ชั้น')) { colIndexes.floor = idx; }
        else if (text.includes('อาคาร')) { colIndexes.building = idx; }
      });

      if (foundCount >= 3) {
        examTable = table;
      }
    });

    if (examTable) {
      const rows = Array.from(examTable.querySelectorAll('tr')).slice(1);
      const parsedExams = [];

      rows.forEach(row => {
        const cells = Array.from(row.querySelectorAll('td')).map(cell => cell.textContent.trim());
        if (cells.length === 0) return;

        let dateText = colIndexes.date !== -1 ? cells[colIndexes.date] : '';
        
        // Apply generic month replacements from configuration if defined
        EXAM_CONFIG.monthReplacements.forEach(({ pattern, replacement }) => {
          dateText = dateText.replace(pattern, replacement);
        });
        
        const timeText = colIndexes.time !== -1 ? cells[colIndexes.time] : '';
        const codeVal = colIndexes.subjectCode !== -1 ? cells[colIndexes.subjectCode] : '';
        const nameVal = colIndexes.subjectName !== -1 ? cells[colIndexes.subjectName] : '';
        const rowVal = colIndexes.row !== -1 ? cells[colIndexes.row] : '';
        const seatVal = colIndexes.seat !== -1 ? cells[colIndexes.seat] : '';
        const roomVal = colIndexes.room !== -1 ? cells[colIndexes.room] : '';
        const floorVal = colIndexes.floor !== -1 ? cells[colIndexes.floor] : '';
        const buildingVal = colIndexes.building !== -1 ? cells[colIndexes.building] : '';

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

        parsedExams.push({
          id: `exam-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          courseCode,
          courseName,
          date: dateText,
          time: timeText,
          room: roomText,
          seat: seatText
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
      const href = a.getAttribute('href') || '';
      if (href.includes('drive.google.com')) {
        pdfLink = href;
      } else if (href.includes('forms.gle') || href.includes('docs.google.com/forms')) {
        formLink = href;
      }
    });

    return Result.ok({ exams: [], unlisted: { pdfLink, formLink } });
    
  } catch (error) {
    logger.error('Failed parsing exam HTML', error);
    return Result.fail(error);
  }
};
