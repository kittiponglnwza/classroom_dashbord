/* global chrome */
(() => {
  const STORAGE_KEY = 'ch_reg_snapshots_v3';
  const HUB_URL = 'https://classrooms-hub.vercel.app/schedule';
  const TOAST_HOST_ID = 'ch-classroom-hub-reg-toast-host';

  let lastUrl = location.href;
  let debounceTimer = null;
  let toastDismissTimer = null;

  function hashString(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16);
  }

  function detectPageKind() {
    const path = (location.pathname || '').toLowerCase();
    if (path.includes('/registrar/timetable') || path.includes('/registrar/enrollresult')) {
      return 'timetable';
    }
    if (path.includes('/registrar/grade')) {
      return 'grade';
    }
    return null;
  }

  function cleanCellText(el) {
    return String(el?.innerText || el?.textContent || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function detectAcademicYearFromDom() {
    const bodyText = document.body?.innerText || '';
    const directMatch = bodyText.match(/ปีการศึกษา\s*(25\d{2})/);
    if (directMatch) return directMatch[1];

    const controls = document.querySelectorAll('select, input');
    for (const el of controls) {
      if (el.tagName === 'SELECT') {
        const val = String(el.value || '').trim();
        if (/^(25\d{2})$/.test(val)) return val;
        const optText = String(el.options?.[el.selectedIndex]?.text || '').trim();
        if (/^(25\d{2})$/.test(optText)) return optText;
      } else {
        const val = String(el.value || '').trim();
        if (/^(25\d{2})$/.test(val)) return val;
      }
    }

    const leafEls = document.querySelectorAll('button, span, div, option:checked');
    for (const el of leafEls) {
      if (el.closest('table')) continue;
      if (el.children && el.children.length > 0 && el.tagName !== 'BUTTON') continue;
      const txt = String(el.textContent || '').trim();
      if (/^(25\d{2})$/.test(txt)) return txt;
    }

    const rangeMatch = bodyText.match(/\d{1,2}\/\d{1,2}\/(25\d{2})/);
    if (rangeMatch) return rangeMatch[1];

    for (const el of controls) {
      const valRange = String(el.value || '').match(/\d{1,2}\/\d{1,2}\/(25\d{2})/);
      if (valRange) return valRange[1];
    }

    return '';
  }

  /**
   * Computes a one-way privacy-preserving hash of the 13-digit Student ID on the Reg page
   * so Classroom Hub can prevent cross-account overwrites without storing raw student PII.
   */
  function detectStudentIdHashFromDom() {
    const bodyText = document.body?.innerText || '';
    const match = bodyText.match(/\b(\d{13})\b/);
    if (!match) return null;
    return hashString(`ch_sid_${match[1]}`);
  }

  /**
   * Primary extractor: reads live DOM <table> rows directly so multi-line <br>/<div>
   * cells (Thai+Eng course titles, wrapped headers, exam date+time) become clean 1-line TSV rows.
   */
  function extractTimetableFromDomTables() {
    const tables = Array.from(document.querySelectorAll('table'));
    let bestRows = [];
    let bestCourseCodes = new Set();

    for (const table of tables) {
      // Only take rows directly belonging to this table (avoid nested layout tables)
      const trs = Array.from(table.querySelectorAll('tr')).filter((tr) => tr.closest('table') === table);
      if (trs.length < 2) continue;

      const rowArrays = trs.map((tr) =>
        Array.from(tr.children)
          .filter((el) => el.tagName === 'TH' || el.tagName === 'TD')
          .map((cell) => cleanCellText(cell))
      );

      // Find header row inside this table (must have a cell strictly starting with รหัสวิชา, not a หมายเหตุ caption)
      const headerRowIdx = rowArrays.findIndex((cells) => {
        const hasCodeHeader = cells.some((c) => /^รหัสวิชา(?:\s|$)/.test(c));
        if (!hasCodeHeader) return false;
        const joined = cells.join(' ');
        return (
          joined.includes('วันเวลาเรียน') ||
          joined.includes('สอบกลาง') ||
          joined.includes('อาจารย์') ||
          (joined.includes('หน่วยกิต') && !joined.includes('เกรด'))
        );
      });

      const dataRows = headerRowIdx >= 0 ? rowArrays.slice(headerRowIdx + 1) : rowArrays;
      const matchedCourseCodes = new Set();
      const validDataLines = [];

      for (const cells of dataRows) {
        const first = (cells[0] || '').trim();
        if (/^\d{9}$/.test(first)) {
          matchedCourseCodes.add(first);
          validDataLines.push(cells.join('\t'));
        }
      }

      if (matchedCourseCodes.size > bestCourseCodes.size && (headerRowIdx >= 0 || validDataLines.some((l) => /\d{1,2}[:.]\d{2}\s*[-–]\s*\d{1,2}[:.]\d{2}/.test(l)))) {
        const headerLine =
          headerRowIdx >= 0
            ? rowArrays[headerRowIdx].join('\t')
            : 'รหัสวิชา\tตอนเรียน\tรายวิชา\tหน่วยกิต\tอาจารย์ผู้สอน\tวันเวลาเรียน\tห้อง\tสอบกลางภาค\tสอบปลายภาค\tหมายเหตุ';
        bestRows = [headerLine, ...validDataLines];
        bestCourseCodes = matchedCourseCodes;
      }
    }

    if (bestCourseCodes.size === 0) return null;

    const detectedYear = detectAcademicYearFromDom();
    const prefix = detectedYear ? [`ปีการศึกษา${detectedYear}`] : [];
    const slotCount = bestRows
      .slice(1)
      .filter((line) => /(?:พฤ|อา|จ|อ|พ|ศ|ส)\.?\s*\d{1,2}[:.]\d{2}\s*[-–]\s*\d{1,2}[:.]\d{2}/.test(line)).length;

    return {
      text: [...prefix, ...bestRows].join('\n'),
      count: bestCourseCodes.size,
      slotCount,
    };
  }

  /**
   * Extracts ONLY the academic table/section text, stripping student name,
   * navbar, contact phone numbers, and footer before anything is stored.
   */
  function extractSanitizedAcademicText(kind) {
    if (kind === 'timetable') {
      const fromDom = extractTimetableFromDomTables();
      if (fromDom) return fromDom;
    }

    const raw = (document.body?.innerText || '').replace(/\r\n/g, '\n');
    // Preserve \t separators between table columns while dropping blank lines
    const lines = raw
      .split('\n')
      .map((l) => l.replace(/^ +| +$/g, ''))
      .filter((l) => l.trim().length > 0);
    const trimmedLines = lines.map((l) => l.trim());

    if (kind === 'timetable') {
      const matchedYearLine = trimmedLines.find((l) => /^ปีการศึกษา\s*\d{4}$/.test(l)) || '';
      const detectedYear = matchedYearLine ? '' : detectAcademicYearFromDom();
      const yearLine = matchedYearLine || (detectedYear ? `ปีการศึกษา${detectedYear}` : '');
      let headerIdx = -1;
      for (let i = 0; i < lines.length; i++) {
        if (/^หมายเหตุ\s*[:：]/.test(trimmedLines[i])) continue;
        const firstCell = lines[i].split('\t')[0].trim();
        if (firstCell !== 'รหัสวิชา' && !/^รหัสวิชา(?:\s|$)/.test(trimmedLines[i])) continue;
        const lookahead = trimmedLines.slice(i, i + 15).join(' ');
        if (
          lookahead.includes('วันเวลาเรียน') ||
          lookahead.includes('สอบกลาง') ||
          lookahead.includes('อาจารย์') ||
          (lookahead.includes('หน่วยกิต') && !lookahead.includes('เกรด'))
        ) {
          headerIdx = i;
          break;
        }
      }
      if (headerIdx === -1) {
        headerIdx = lines.findIndex((l, idx) => {
          if (!/^\d{9}(?:\t|$)/.test(l.trim())) return false;
          const nearby = trimmedLines.slice(idx, idx + 10).join(' ');
          return /\d{1,2}[:.]\d{2}\s*[-–]\s*\d{1,2}[:.]\d{2}/.test(nearby) || /\d+\(\d+-\d+-\d+\)\*?/.test(nearby);
        });
      }
      if (headerIdx === -1) return null;

      const slice = [];
      if (yearLine) slice.push(yearLine);
      for (let i = headerIdx; i < lines.length; i++) {
        if (/^(?:@\s*\d{4}|©|Visionnet|กรณีที่พบปัญหา)/i.test(trimmedLines[i])) break;
        slice.push(lines[i]);
      }

      const courseCodes = new Set();
      slice.forEach((l) => {
        const m = l.trim().match(/^(\d{9})(?:\t|$)/);
        if (m) courseCodes.add(m[1]);
      });
      if (courseCodes.size === 0) return null;

      const slotCount = slice.filter((l) =>
        /(?:พฤ|อา|จ|อ|พ|ศ|ส)\.?\s*\d{1,2}[:.]\d{2}\s*[-–]\s*\d{1,2}[:.]\d{2}/.test(l)
      ).length;

      return {
        text: slice.join('\n'),
        count: courseCodes.size,
        slotCount,
      };
    }

    if (kind === 'grade') {
      const firstSemIdx = trimmedLines.findIndex((l) => /^ปีการศึกษา\s*\d+\s*\/\s*\d{4}$/.test(l));
      if (firstSemIdx === -1) return null;

      const slice = ['ผลการศึกษา'];
      let semesterCount = 0;
      const courseCodes = new Set();

      for (let i = firstSemIdx; i < lines.length; i++) {
        const t = trimmedLines[i];
        if (/^(?:หมายเหตุ\s*CA|@\s*\d{4}|©|Visionnet|กรณีที่พบปัญหา)/i.test(t)) break;
        if (/^ปีการศึกษา\s*\d+\s*\/\s*\d{4}$/.test(t)) semesterCount++;
        const cm = t.match(/^(\d{9})(?:\t|$)/);
        if (cm) courseCodes.add(cm[1]);
        slice.push(lines[i]);
      }

      if (semesterCount === 0 || (courseCodes.size === 0 && !slice.some((l) => l.includes('GPAX')))) {
        return null;
      }

      return {
        text: slice.join('\n'),
        count: semesterCount,
        slotCount: 0,
      };
    }

    return null;
  }

  function showCornerToast(kind, count, slotCount, isNewUpdate) {
    try {
      let host = document.getElementById(TOAST_HOST_ID);
      if (!host) {
        host = document.createElement('div');
        host.id = TOAST_HOST_ID;
        host.style.position = 'fixed';
        host.style.right = '18px';
        host.style.bottom = '18px';
        host.style.zIndex = '2147483647';
        document.body.appendChild(host);
      }
      const shadow = host.shadowRoot || host.attachShadow({ mode: 'open' });
      const titleText =
        kind === 'timetable'
          ? `บันทึกตารางเรียนแล้ว (${count} วิชา${slotCount > 0 ? ` • ${slotCount} คาบ` : ''})`
          : `บันทึกผลการศึกษาแล้ว (${count} เทอม)`;
      const subText = isNewUpdate
        ? 'เปิด CH Classroom Hub เมื่อไหร่จะซิงค์ให้อัตโนมัติ (ไม่เก็บรหัสผ่าน)'
        : 'ข้อมูลล่าสุดซิงค์เก็บไว้เรียบร้อยแล้ว';
      const targetHref = kind === 'timetable' ? HUB_URL : 'https://classrooms-hub.vercel.app/academic';

      shadow.innerHTML = `
        <style>
          .card {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            background: #252526;
            color: #D4D4D4;
            border: 1px solid #3C3C3C;
            border-left: 3px solid #10B981;
            border-radius: 12px;
            padding: 12px 14px;
            box-shadow: 0 12px 28px rgba(0, 0, 0, 0.45);
            width: 310px;
            box-sizing: border-box;
          }
          .top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
          .brand { display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 700; color: #FFFFFF; }
          .brand-logo { width: 22px; height: 22px; display: block; flex-shrink: 0; }
          .close { background: transparent; border: none; color: #858585; font-size: 16px; cursor: pointer; padding: 0 2px; line-height: 1; }
          .close:hover { color: #FFFFFF; }
          .title { font-size: 12px; font-weight: 600; color: #34D399; margin: 6px 0 2px; }
          .sub { font-size: 11px; color: #9D9D9D; line-height: 1.4; margin: 0 0 10px; }
          .btn {
            display: inline-block;
            background: #007ACC;
            color: #FFFFFF;
            text-decoration: none;
            font-size: 11px;
            font-weight: 600;
            padding: 6px 10px;
            border-radius: 8px;
          }
          .btn:hover { background: #1177BB; }
        </style>
        <div class="card">
          <div class="top">
            <div class="brand">
              <svg class="brand-logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="22" height="22" aria-hidden="true">
                <defs>
                  <linearGradient id="chLogoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#6366f1" />
                    <stop offset="100%" stop-color="#a855f7" />
                  </linearGradient>
                </defs>
                <rect x="1.5" y="1.5" width="29" height="29" rx="7.5" fill="#0b0f19" stroke="url(#chLogoGrad)" stroke-width="2" />
                <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13.5" font-weight="900" letter-spacing="-0.5px">CH</text>
              </svg>
              <span>Classroom Hub Sync</span>
            </div>
            <button class="close" type="button" aria-label="Close">&times;</button>
          </div>
          <div class="title">${titleText}</div>
          <p class="sub">${subText}</p>
          <a class="btn" href="${targetHref}" target="_blank" rel="noopener noreferrer">เปิด CH Classroom Hub &rarr;</a>
        </div>
      `;

      const closeBtn = shadow.querySelector('.close');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          host.remove();
        });
      }

      if (toastDismissTimer) clearTimeout(toastDismissTimer);
      toastDismissTimer = setTimeout(() => {
        const el = document.getElementById(TOAST_HOST_ID);
        if (el) el.remove();
      }, 6500);
    } catch {
      // Ignore DOM overlay errors
    }
  }

  async function captureCurrentPage(forceNotify = false) {
    const kind = detectPageKind();
    if (!kind) return { captured: false, reason: 'NOT_ACADEMIC_PAGE' };

    const extracted = extractSanitizedAcademicText(kind);
    if (!extracted) return { captured: false, reason: 'TABLE_NOT_READY' };

    const nextHash = hashString(extracted.text);

    try {
      const stored = await chrome.storage.local.get(STORAGE_KEY);
      const current = stored?.[STORAGE_KEY] || {};
      const existing = current[kind];

      if (!forceNotify && existing && existing.hash === nextHash) {
        return { captured: true, changed: false, kind, count: extracted.count, slotCount: extracted.slotCount };
      }

      const studentIdHash = detectStudentIdHashFromDom();
      const updated = {
        ...current,
        [kind]: {
          text: extracted.text,
          hash: nextHash,
          studentIdHash,
          count: extracted.count,
          slotCount: extracted.slotCount || 0,
          capturedAt: new Date().toISOString(),
        },
      };

      await chrome.storage.local.set({ [STORAGE_KEY]: updated });
      showCornerToast(kind, extracted.count, extracted.slotCount || 0, !existing || existing.hash !== nextHash);
      return { captured: true, changed: true, kind, count: extracted.count, slotCount: extracted.slotCount };
    } catch (err) {
      return { captured: false, reason: err?.message || 'STORAGE_ERROR' };
    }
  }

  function scheduleCapture() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      captureCurrentPage(false);
    }, 900);
  }

  // Watch asynchronous table rendering (Visionnet SPA)
  const observer = new MutationObserver(() => {
    if (detectPageKind()) {
      scheduleCapture();
    }
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // Watch SPA route transitions (pushState / popstate)
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      if (detectPageKind()) {
        scheduleCapture();
      }
    }
  }, 1000);

  // Manual trigger from extension popup
  if (chrome?.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (msg && msg.type === 'CH_FORCE_CAPTURE') {
        captureCurrentPage(true).then(sendResponse);
        return true;
      }
      return undefined;
    });
  }

  // Initial scan on page load
  scheduleCapture();
})();
