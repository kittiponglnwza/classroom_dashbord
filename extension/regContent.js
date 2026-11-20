/* global chrome */
(() => {
  const STORAGE_KEY = 'ch_reg_snapshots';
  const HUB_URL = 'https://classrooms-hub.vercel.app/academic';
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

  /**
   * Extracts ONLY the academic table/section text, stripping student name,
   * navbar, contact phone numbers, and footer before anything is stored.
   */
  function extractSanitizedAcademicText(kind) {
    const raw = (document.body?.innerText || '').replace(/\r\n/g, '\n');
    // Preserve \t separators between table columns while dropping blank lines
    const lines = raw
      .split('\n')
      .map((l) => l.replace(/^ +| +$/g, ''))
      .filter((l) => l.trim().length > 0);
    const trimmedLines = lines.map((l) => l.trim());

    if (kind === 'timetable') {
      const yearLine = trimmedLines.find((l) => /^ปีการศึกษา\s*\d{4}$/.test(l)) || '';
      let headerIdx = -1;
      for (let i = 0; i < lines.length; i++) {
        const t = trimmedLines[i];
        if (
          t.includes('รหัสวิชา') &&
          (t.includes('วันเวลาเรียน') ||
            t.includes('สอบกลาง') ||
            t.includes('อาจารย์') ||
            (t.includes('หน่วยกิต') && !t.includes('เกรด')))
        ) {
          headerIdx = i;
          break;
        }
        if (t === 'รหัสวิชา') {
          const lookahead = trimmedLines.slice(i, i + 12).join(' ');
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

      return {
        text: slice.join('\n'),
        count: courseCodes.size,
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
      };
    }

    return null;
  }

  function showCornerToast(kind, count, isNewUpdate) {
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
      const titleText = kind === 'timetable'
        ? `บันทึกตารางเรียนแล้ว (${count} วิชา)`
        : `บันทึกผลการศึกษาแล้ว (${count} เทอม)`;
      const subText = isNewUpdate
        ? 'เปิด CH Classroom Hub เมื่อไหร่จะซิงค์ให้อัตโนมัติ (ไม่เก็บรหัสผ่าน)'
        : 'ข้อมูลล่าสุดซิงค์เก็บไว้เรียบร้อยแล้ว';

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
            width: 300px;
            box-sizing: border-box;
          }
          .top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
          .brand { display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 700; color: #FFFFFF; }
          .badge { background: #007ACC; color: #FFFFFF; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 6px; }
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
            <div class="brand"><span class="badge">CH</span><span>Classroom Hub Sync</span></div>
            <button class="close" type="button" aria-label="Close">&times;</button>
          </div>
          <div class="title">${titleText}</div>
          <p class="sub">${subText}</p>
          <a class="btn" href="${HUB_URL}" target="_blank" rel="noopener noreferrer">เปิด CH Classroom Hub &rarr;</a>
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
        return { captured: true, changed: false, kind, count: extracted.count };
      }

      const updated = {
        ...current,
        [kind]: {
          text: extracted.text,
          hash: nextHash,
          count: extracted.count,
          capturedAt: new Date().toISOString(),
        },
      };

      await chrome.storage.local.set({ [STORAGE_KEY]: updated });
      showCornerToast(kind, extracted.count, !existing || existing.hash !== nextHash);
      return { captured: true, changed: true, kind, count: extracted.count };
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
