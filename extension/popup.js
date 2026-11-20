/* global chrome */
const STORAGE_KEY = 'ch_reg_snapshots';
const DELIVERED_KEY = 'ch_reg_delivered_by_origin';
const PROD_ORIGIN = 'https://classrooms-hub.vercel.app';

function formatTime(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('th-TH', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

async function renderStatus() {
  const res = await chrome.storage.local.get([STORAGE_KEY, DELIVERED_KEY]);
  const snapshots = res?.[STORAGE_KEY] || {};
  const deliveredMap = res?.[DELIVERED_KEY] || {};
  const delivered = deliveredMap[PROD_ORIGIN] || Object.values(deliveredMap)[0] || {};

  const ttMeta = document.getElementById('tt-meta');
  const ttPill = document.getElementById('tt-pill');
  const grMeta = document.getElementById('gr-meta');
  const grPill = document.getElementById('gr-pill');

  if (snapshots.timetable) {
    ttMeta.textContent = `${snapshots.timetable.count || 0} วิชา • ${formatTime(snapshots.timetable.capturedAt)}`;
    const synced = delivered.timetableHash === snapshots.timetable.hash;
    ttPill.textContent = synced ? 'ซิงค์แล้ว ✓' : 'รอซิงค์เข้าเว็บ';
    ttPill.className = `pill ${synced ? 'pill-ok' : 'pill-wait'}`;
  } else {
    ttMeta.textContent = 'ยังไม่มีข้อมูล — กดเปิดหน้าตารางเรียน';
    ttPill.textContent = 'รอข้อมูล';
    ttPill.className = 'pill pill-empty';
  }

  if (snapshots.grade) {
    grMeta.textContent = `${snapshots.grade.count || 0} เทอม • ${formatTime(snapshots.grade.capturedAt)}`;
    const synced = delivered.gradeHash === snapshots.grade.hash;
    grPill.textContent = synced ? 'ซิงค์แล้ว ✓' : 'รอซิงค์เข้าเว็บ';
    grPill.className = `pill ${synced ? 'pill-ok' : 'pill-wait'}`;
  } else {
    grMeta.textContent = 'ยังไม่มีข้อมูล — กดเปิดหน้าผลการศึกษา';
    grPill.textContent = 'รอข้อมูล';
    grPill.className = 'pill pill-empty';
  }
}

document.getElementById('capture-btn').addEventListener('click', async () => {
  const msgEl = document.getElementById('status-msg');
  msgEl.style.color = '#9D9D9D';
  msgEl.textContent = 'กำลังตรวจสอบแท็บปัจจุบัน...';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !String(tab.url || '').includes('reg.kmutnb.ac.th/registrar/')) {
      msgEl.style.color = '#FBBF24';
      msgEl.textContent = 'กรุณาเปิดหน้า ตารางเรียน หรือ ผลการศึกษา บน reg.kmutnb.ac.th ก่อน';
      return;
    }

    const reply = await chrome.tabs.sendMessage(tab.id, { type: 'CH_FORCE_CAPTURE' });
    if (reply?.captured) {
      msgEl.style.color = '#34D399';
      msgEl.textContent = 'ดึงข้อมูลสำเร็จ! เปิด CH Classroom Hub เพื่อรับข้อมูลอัตโนมัติ';
      await renderStatus();
    } else {
      msgEl.style.color = '#F87171';
      msgEl.textContent = 'ยังไม่พบตารางข้อมูลบนหน้านี้ (ลองรอโหลดให้เสร็จก่อน)';
    }
  } catch {
    msgEl.style.color = '#FBBF24';
    msgEl.textContent = 'ลองรีเฟรชหน้า reg.kmutnb.ac.th 1 ครั้งแล้วกดใหม่ครับ';
  }
});

document.getElementById('clear-btn').addEventListener('click', async () => {
  await chrome.storage.local.remove([STORAGE_KEY, DELIVERED_KEY]);
  const msgEl = document.getElementById('status-msg');
  msgEl.style.color = '#9D9D9D';
  msgEl.textContent = 'ล้างแคชใน Extension เรียบร้อยแล้ว';
  await renderStatus();
});

renderStatus();
