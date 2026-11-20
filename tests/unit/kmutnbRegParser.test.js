import { describe, it, expect } from 'vitest';
import {
  parseKmutnbRegInput,
  splitBilingualCourseTitle,
  parseScheduleSlots,
  parseExamDateTime,
  buildKmutnbRegBookmarklet,
  decodeRegImportHashPayload
} from '../../src/services/parsers/kmutnbRegParser';
import {
  computeAcademicSummary,
  computeGraduationProgress,
  simulateWhatIfGpa,
  solveRequiredTermGpa,
  truncateTwoDecimals,
  decodeKmutnbBuilding
} from '../../src/utils/academicUtils';

const SAMPLE_TIMETABLE_TEXT = `
ระบบสารสนเทศเพื่องานทะเบียนนักศึกษา
ไทย
นายทดสอบ ระบบนักศึกษา
กรณีที่พบปัญหาการใช้งานติดต่อได้ที่ 02-555-2000
ตารางเรียน/สอบ
ปีการศึกษา2569
ภาคที่
วัน/เวลา
จันทร์
040613203 (S.1)78-621
040613203 (L.1)78-621
080303515 (L.1)-
หมายเหตุ : ข้อมูลที่แสดงคือ "รหัสวิชา (Sec.) ห้องเรียน"
รหัสวิชา
ตอนเรียน
รายวิชา
หน่วยกิต
อาจารย์ผู้สอน
วันเวลาเรียน
ห้อง
สอบกลางภาค
สอบปลายภาค
หมายเหตุ
040613203
S.1
การโปรแกรมเชิงโครงสร้างStructured Programming
3(2-2-5)
รองศาสตราจารย์ ดร.ทดสอบ หนึ่ง
S.1 จ.08:30-10:30
78-621
15 ม.ค. 2570เวลา 09:00-12:00
17 มี.ค. 2570เวลา 13:00-16:00
สอนเป็นภาษาอังกฤษ (เสริมทักษะภาษาอังกฤษ)
040613203
L.1
การโปรแกรมเชิงโครงสร้างStructured Programming
3(2-2-5)
รองศาสตราจารย์ ดร.ทดสอบ หนึ่ง
L.1 จ.10:30-12:30
78-621
15 ม.ค. 2570เวลา 09:00-12:00
17 มี.ค. 2570เวลา 13:00-16:00
สอนเป็นภาษาอังกฤษ (เสริมทักษะภาษาอังกฤษ)
040613206
S.2
การออกแบบและการวิเคราะห์ขั้นตอนวิธีDesign and Analysis of Algorithm
3(2-2-5)
ผู้ช่วยศาสตราจารย์ ดร.ทดสอบ สอง
S.2 พฤ.13:00-15:00
78-618/2
17 ม.ค. 2570เวลา 13:00-16:00
25 มี.ค. 2570เวลา 13:00-16:00
040613206
L.2
การออกแบบและการวิเคราะห์ขั้นตอนวิธีDesign and Analysis of Algorithm
3(2-2-5)
ผู้ช่วยศาสตราจารย์ ดร.ทดสอบ สอง
L.2 พฤ.15:00-17:00
78-618/2
17 ม.ค. 2570เวลา 13:00-16:00
25 มี.ค. 2570เวลา 13:00-16:00
040613304
S.1
การบริหารโครงการProject Management
3(3-0-6)
อาจารย์ทดสอบ สาม
S.1 พ.09:00-12:00
75-604
11 ม.ค. 2570เวลา 13:00-16:00
18 มี.ค. 2570เวลา 09:00-12:00
040613708
S.1
ปัญญาประดิษฐ์แบบรู้สร้างGenerative AI
3(3-0-6)
ผู้ช่วยศาสตราจารย์ ดร.ทดสอบ สี่
S.1 ศ.13:00-16:00
78-618/1
12 ม.ค. 2570เวลา 09:00-12:00
22 มี.ค. 2570เวลา 13:00-16:00
จัดการเรียนการสอนเป็นภาษาอังกฤษ
040613902
S.1
อินเทอร์เน็ตของสรรพสิ่งInternet of Things
3(2-2-5)
รองศาสตราจารย์ ดร.ทดสอบ ห้า
S.1 อ.08:30-10:30
78-618/2
15 ม.ค. 2570เวลา 13:00-16:00
16 มี.ค. 2570เวลา 13:00-16:00
040613902
L.1
อินเทอร์เน็ตของสรรพสิ่งInternet of Things
3(2-2-5)
รองศาสตราจารย์ ดร.ทดสอบ ห้า
L.1 อ.10:30-12:30
78-618/2
15 ม.ค. 2570เวลา 13:00-16:00
16 มี.ค. 2570เวลา 13:00-16:00
080103034
S.16
การสนทนาภาษาอังกฤษEnglish Conversation
3(3-0-6)
อาจารย์ ดร.ทดสอบ หก
S.16 ศ.09:00-12:00
78-301
26 มี.ค. 2570เวลา 09:00-11:00
080303515
L.1
การเดิน-วิ่ง เพื่อสุขภาพWalk and Run for Health
1(0-2-1)
อาจารย์ทดสอบ เจ็ด
L.1 จ.13:00-15:00
-
080303701
S.8
กระบวนการคิดเชิงออกแบบDesign Thinking
3(3-0-6)
อาจารย์ ดร.ทดสอบ แปด
S.8 พฤ.09:00-12:00
31-1007B
@ 2026 Visionnet, All rights Reserved
`;

const SAMPLE_GRADE_TEXT = `
ผลการศึกษา
**ข้อมูลผลการเรียนอย่างไม่เป็นทางการ**
ปีการศึกษา 1/2567
รหัสวิชา
ชื่อวิชา
ตอนเรียน
หน่วยกิต
เกรด
040203101
MATHEMATICS I
7
3
C
040313016
PHYSICS IN DAILY LIFE
7
3
C+
040613100
FUND OF COMP SCI & PROF ISSU
1
3
C
040613103
DISCRETE MATH FOR COMP SCI
1
3
D+
040613201
COMPUTER PROGRAMMING I
1
3
C+
080203905
ECONOMICS FOR EVERYDAY LIFE
3
3
B
ผลการศึกษา : ปกติ
THIS SEMESTER
CUMULATIVE TO THIS SEMESTER
CA
CS
CG
GP
GPA
CA
CS
CG
GP
GPAX
18
18
18
40.5
2.25
18
18
18
40.5
2.25
ปีการศึกษา 2/2567
รหัสวิชา
ชื่อวิชา
ตอนเรียน
หน่วยกิต
เกรด
040503011
STAT FOR ENGR & SCIENTISTS
11
3
C+
040613104
MATHEMATICS FOR COMPUTING
1
3
D+
040613203
STRUCTURED PROGRAMMING
2
3
W
040613301
DATABASE SYSTEM
2
3
C+
040613303
HUMAN COMPUTER INTERACTION
2
3
B+
040613501
COMP ORGAN & OPERAT SYSTEM
1
3
C+
ผลการศึกษา : ปกติ
THIS SEMESTER
CUMULATIVE TO THIS SEMESTER
CA
CS
CG
GP
GPA
CA
CS
CG
GP
GPAX
15
15
15
37.5
2.50
33
33
33
78
2.36
ปีการศึกษา 1/2568
รหัสวิชา
ชื่อวิชา
ตอนเรียน
หน่วยกิต
เกรด
030923100
PHYSICS FOR TECHNOLOGIST
1
3
A
030953115
MEDITATION FOR LIFE DEV
3
3
A
040613205
DATA STRUCTURE
2
3
D
040613302
SYSTEM ANALYSIS & DESIGN
1
3
C+
080103001
ENGLISH I
88
3
B+
ผลการศึกษา : ปกติ
THIS SEMESTER
CUMULATIVE TO THIS SEMESTER
CA
CS
CG
GP
GPA
CA
CS
CG
GP
GPAX
15
15
15
45
3.00
48
48
48
123
2.56
ปีการศึกษา 2/2568
รหัสวิชา
ชื่อวิชา
ตอนเรียน
หน่วยกิต
เกรด
040613203
STRUCTURED PROGRAMMING
1
3
F
040613306
SOFTWARE ENGINEERING
1
3
B+
040613502
COMPUTER NETWORK
1
3
D+
040613601
COMP SYSTEM SECURITY
2
3
C
040613701
INTELLIGENT SYSTEM
1
3
C
080103002
ENGLISH II
85
3
B
ผลการศึกษา : ปกติ
THIS SEMESTER
CUMULATIVE TO THIS SEMESTER
CA
CS
CG
GP
GPA
CA
CS
CG
GP
GPAX
18
15
18
36
2.00
66
63
66
159
2.40
ปีการศึกษา 1/2569
รหัสวิชา
ชื่อวิชา
ตอนเรียน
หน่วยกิต
เกรด
040413001
BIOLOGY IN DAILY LIFE
1
3
C
040613105
NUMERICAL METHOD
2
3
F
040613112
DIGITAL CIRCUIT DESIGN
4
3
D+
040613411
WEB DEVELOPMENT
1
3
C
040613504
INTER-NETWORKING TECHNOLOGY
1
3
D
080103030
ACADEMIC READING
7
3
C
ผลการศึกษา : ปกติ
THIS SEMESTER
CUMULATIVE TO THIS SEMESTER
CA
CS
CG
GP
GPA
CA
CS
CG
GP
GPAX
18
15
18
25.5
1.41
84
78
84
184.5
2.19
ปีการศึกษา 2/2569
รหัสวิชา
ชื่อวิชา
ตอนเรียน
หน่วยกิต
เกรด
ผลการศึกษา : ยังไม่คำนวณ
THIS SEMESTER
CUMULATIVE TO THIS SEMESTER
CA
CS
CG
GP
GPA
CA
CS
CG
GP
GPAX
22
0
0
0
0.00
106
78
84
184.5
2.19
หมายเหตุCA : จำนวนหน่วยกิตที่ลงทะเบียน
`;

describe('KMUTNB Reg Parser & Academic Graduation Engine', () => {
  it('splits concatenated Thai + English course titles cleanly', () => {
    expect(splitBilingualCourseTitle('การโปรแกรมเชิงโครงสร้างStructured Programming')).toEqual({
      thaiName: 'การโปรแกรมเชิงโครงสร้าง',
      engName: 'Structured Programming'
    });
    expect(splitBilingualCourseTitle('การเดิน-วิ่ง เพื่อสุขภาพWalk and Run for Health')).toEqual({
      thaiName: 'การเดิน-วิ่ง เพื่อสุขภาพ',
      engName: 'Walk and Run for Health'
    });
  });

  it('parses Thai day abbreviations without confusing พฤ. with พ. or อา. with อ.', () => {
    expect(parseScheduleSlots('S.2 พฤ.13:00-15:00')).toEqual([
      { day: 'thu', startTime: '13:00', endTime: '15:00' }
    ]);
    expect(parseScheduleSlots('S.1 พ.09:00-12:00')).toEqual([
      { day: 'wed', startTime: '09:00', endTime: '12:00' }
    ]);
    expect(parseScheduleSlots('S.1 อา.09:00-12:00')).toEqual([
      { day: 'sun', startTime: '09:00', endTime: '12:00' }
    ]);
    expect(parseScheduleSlots('S.1 อ.08:30-10:30')).toEqual([
      { day: 'tue', startTime: '08:30', endTime: '10:30' }
    ]);
  });

  it('parses KMUTNB Buddhist-year exam dates attached to เวลา', () => {
    const parsed = parseExamDateTime('15 ม.ค. 2570เวลา 09:00-12:00');
    expect(parsed).toMatchObject({
      date: '15 ม.ค. 2570',
      rawIsoDate: '2027-01-15',
      time: '09:00-12:00'
    });
  });

  it('parses combined KMUTNB timetable + grade report in one paste with full accuracy & PII stripping', () => {
    const combined = `${SAMPLE_TIMETABLE_TEXT}\n${SAMPLE_GRADE_TEXT}`;
    const result = parseKmutnbRegInput(combined);

    expect(result.success).toBe(true);
    expect(result.meta.hasTimetable).toBe(true);
    expect(result.meta.hasGrades).toBe(true);

    // Timetable: 11 slots across 8 unique courses = 22 credits
    expect(result.meta.totalScheduleSlots).toBe(11);
    expect(result.meta.totalEnrolledCourses).toBe(8);
    expect(result.meta.totalEnrolledCredits).toBe(22);

    // Deduplicated exams: 5 courses x 2 (mid+fin) + 1 course (080103034 final only) = 11 exams
    expect(result.meta.totalExams).toBe(11);
    const engConvExam = result.timetable.examEntries.find((e) => e.courseCode === '080103034');
    expect(engConvExam).toBeDefined();
    expect(engConvExam.examType).toBe('final');
    expect(engConvExam.rawIsoDate).toBe('2027-03-26');
    expect(engConvExam.time).toBe('09:00-11:00');

    // Room "-" normalized to empty string; building decoded in notes for 78-621
    const walkRunSlot = result.timetable.scheduleEntries.find((s) => s.courseCode === '080303515');
    expect(walkRunSlot.room).toBe('');
    expect(walkRunSlot.day).toBe('mon');
    expect(walkRunSlot.startTime).toBe('13:00');

    const spLecture = result.timetable.scheduleEntries.find((s) => s.courseCode === '040613203' && s.title.includes('S.1'));
    expect(spLecture.room).toBe('78-621');
    expect(spLecture.notes).toContain('อาคาร 78');

    // Grades: 6 semesters, 29 graded course rows
    expect(result.meta.totalSemesters).toBe(6);
    expect(result.meta.totalGradeRows).toBe(29);
    const inProgressSem = result.grades.semesters.find((s) => s.semesterId === '2/2569');
    expect(inProgressSem.courses).toHaveLength(0);
    expect(inProgressSem.cumulativeStats.gpax).toBe(2.19);

    // Security / Data Minimization: student name & phone never appear in parsed output
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('นายทดสอบ ระบบ');
    expect(serialized).not.toContain('02-555-2000');
  });

  it('computes exact KMUTNB GPA truncation, passed courses, retakes, and graduation progress', () => {
    expect(truncateTwoDecimals(25.5 / 18)).toBe(1.41);
    expect(truncateTwoDecimals(184.5 / 84)).toBe(2.19);
    expect(decodeKmutnbBuilding('78-621')).toContain('อาคาร 78');

    const parsed = parseKmutnbRegInput(`${SAMPLE_TIMETABLE_TEXT}\n${SAMPLE_GRADE_TEXT}`);
    const summary = computeAcademicSummary(parsed.grades.semesters, parsed.timetable.enrolledCourses);

    expect(summary.gpax).toBe(2.19);
    expect(summary.latestGpa).toBe(1.41);
    expect(summary.latestSemesterId).toBe('1/2569');
    expect(summary.uniquePassedCredits).toBe(78);
    expect(summary.inProgressCredits).toBe(22);

    // 040613203 was W (2/2567) -> F (2/2568) -> currently retaking in 2/2569
    expect(summary.retakingCourses.map((c) => c.courseCode)).toEqual(['040613203']);
    // 040613105 got F in 1/2569 and is not yet re-enrolled
    expect(summary.failedCourses.map((c) => c.courseCode)).toEqual(['040613105']);

    const grad = computeGraduationProgress(summary.allCourseAudits, undefined, {}, 2.0, summary.gpax);
    expect(grad.totalPassed).toBe(78);
    expect(grad.totalInProgress).toBe(22);
    expect(grad.totalRequired).toBe(129);
    expect(grad.remainingCredits).toBe(51);
    expect(grad.remainingWithEnrolled).toBe(29);
    expect(grad.checklist.gpaxMet).toBe(true);
    expect(grad.checklist.noUnresolvedFails).toBe(false);
  });

  it('parses HTML table format as well as TSV rows', () => {
    const html = `
      <html><body>
        <table>
          <tr><th>รหัสวิชา</th><th>ตอนเรียน</th><th>รายวิชา</th><th>หน่วยกิต</th><th>อาจารย์ผู้สอน</th><th>วันเวลาเรียน</th><th>ห้อง</th><th>สอบกลางภาค</th><th>สอบปลายภาค</th><th>หมายเหตุ</th></tr>
          <tr><td>040613304</td><td>S.1</td><td>การบริหารโครงการProject Management</td><td>3(3-0-6)</td><td>อ.ทดสอบ</td><td>S.1 พ.09:00-12:00</td><td>75-604</td><td></td><td>18 มี.ค. 2570 เวลา 09:00-12:00</td><td></td></tr>
        </table>
      </body></html>
    `;
    const parsed = parseKmutnbRegInput(html);
    expect(parsed.success).toBe(true);
    expect(parsed.timetable.scheduleEntries).toHaveLength(1);
    expect(parsed.timetable.examEntries).toHaveLength(1);
    expect(parsed.timetable.examEntries[0].examType).toBe('final');
  });

  it('simulates What-if GPA and solves required Term GPA for target GPAX', () => {
    const sim = simulateWhatIfGpa(84, 184.5, 78, [
      { courseCode: '040613203', credits: 3, grade: 'B+' },
      { courseCode: '040613206', credits: 3, grade: 'B' },
      { courseCode: '040613304', credits: 3, grade: 'A' },
    ]);
    // 3*3.5 + 3*3.0 + 3*4.0 = 31.5 / 9 = 3.50
    expect(sim.termGpa).toBe(3.5);
    expect(sim.projectedPassedCredits).toBe(87);
    expect(sim.projectedGpax).toBe(truncateTwoDecimals((184.5 + 31.5) / (84 + 9)));

    const solved = solveRequiredTermGpa(84, 184.5, 22, 2.5);
    expect(solved.valid).toBe(true);
    expect(solved.achievable).toBe(true);
    // Required total GP = 2.5 * 106 = 265; needed = 265 - 184.5 = 80.5; 80.5 / 22 = 3.659 -> 3.66
    expect(solved.requiredGpa).toBe(3.66);
  });

  it('round-trips Thai bookmarklet hash payload cleanly', () => {
    const href = buildKmutnbRegBookmarklet('https://classrooms-hub.vercel.app');
    expect(href.startsWith('javascript:')).toBe(true);

    const sample = 'ปีการศึกษา 1/2567\n040613100\nคอมพิวเตอร์';
    const bytes = new TextEncoder().encode(sample);
    let bin = '';
    bytes.forEach((b) => { bin += String.fromCharCode(b); });
    const encoded = btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    expect(decodeRegImportHashPayload(encoded)).toBe(sample);
  });
});
