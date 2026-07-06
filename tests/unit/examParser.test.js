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
});
