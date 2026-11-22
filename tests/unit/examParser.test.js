import { describe, it, expect } from 'vitest';
import { parseExamHtml } from '../../src/services/parsers/examParser';

describe('examParser', () => {
  it('should parse valid KMUTNB exam HTML table', () => {
    const htmlText = `
      <html>
        <body>
          <table>
            <tr>
              <th>วัน</th>
              <th>เวลา</th>
              <th>รหัสวิชา</th>
              <th>วิชาที่สอบ</th>
              <th>ห้อง</th>
              <th>แถว</th>
              <th>ลำดับที่นั่ง</th>
            </tr>
            <tr>
              <td>18 ก.ค. 2569</td>
              <td>09:00 - 12:00</td>
              <td>040613502</td>
              <td>COMPUTER NETWORK</td>
              <td>81-506</td>
              <td>5</td>
              <td>20</td>
            </tr>
          </table>
        </body>
      </html>
    `;

    const result = parseExamHtml(htmlText, 'th');
    
    expect(result.success).toBe(true);
    expect(result.data.exams).toHaveLength(1);
    
    const exam = result.data.exams[0];
    expect(exam.courseCode).toBe('040613502');
    expect(exam.courseName).toBe('COMPUTER NETWORK');
    expect(exam.date).toBe('18 ก.ค. 2569');
    expect(exam.time).toBe('09:00 - 12:00');
    expect(exam.room).toBe('81-506');
    expect(exam.seat).toBe('แถว 5 ที่นั่ง 20');
  });

  it('should handle unlisted state properly', () => {
    const htmlText = `
      <html>
        <body>
          <p>No exams found</p>
          <a href="https://drive.google.com/file/d/test/view">PDF</a>
          <a href="https://forms.gle/test">Form</a>
        </body>
      </html>
    `;

    const result = parseExamHtml(htmlText, 'en');
    
    expect(result.success).toBe(true);
    expect(result.data.exams).toHaveLength(0);
    expect(result.data.unlisted.pdfLink).toBe('https://drive.google.com/file/d/test/view');
    expect(result.data.unlisted.formLink).toBe('https://forms.gle/test');
  });

  it('extracts examType and termLabel from real KMUTNB SciBase table caption', () => {
    const htmlText = `
      <table class="datatable">
        <caption>ข้อมูลที่นั่งสอบปลายภาค ประจำภาคเรียนที่ 1 ปีการศึกษา 2569<br /> ของ คุณ ทดสอบ รหัสนักศึกษา 6704062611115</caption>
        <tr>
          <th>วันที่สอบ</th><th>เวลาสอบ</th><th>รหัสวิชาที่สอบ</th><th>วิชาที่สอบ</th>
          <th>ตอนที่</th><th>แถวที่นั่ง</th><th>ลำดับที่นั่ง</th><th>ห้องสอบ</th><th>ชั้น</th><th>อาคาร</th>
        </tr>
        <tr>
          <td>20 ต.ค. 2569</td><td>13:00-16:00</td><td>40613112</td><td>DIGITAL CIRCUIT DESIGN</td>
          <td>4</td><td>2</td><td>7</td><td>72-402</td><td>4</td><td>72</td>
        </tr>
      </table>
    `;

    const result = parseExamHtml(htmlText, 'th');
    expect(result.success).toBe(true);
    expect(result.data.exams).toHaveLength(1);
    expect(result.data.exams[0]).toMatchObject({
      courseCode: '40613112',
      courseName: 'DIGITAL CIRCUIT DESIGN',
      examType: 'final',
      termLabel: '1/2569',
      seat: 'แถว 2 ที่นั่ง 7',
      room: '72-402 (อาคาร 72, ชั้น 4)',
    });
  });
});
