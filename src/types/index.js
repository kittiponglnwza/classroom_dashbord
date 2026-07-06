/**
 * @typedef {Object} Exam
 * @property {string} id - Unique identifier
 * @property {string} courseCode - Course code (e.g. '040613502')
 * @property {string} courseName - Name of the course
 * @property {string} date - Display string for date (e.g. '18 ก.ค. 2569')
 * @property {string} [rawIsoDate] - ISO date string (if manual)
 * @property {string} time - Exam time (e.g. '09:00 - 12:00')
 * @property {string} room - Room designation (e.g. '81-506')
 * @property {string} seat - Seat designation (e.g. 'แถว 5 ที่นั่ง 20')
 * @property {boolean} [isManual] - Whether this was manually added
 */

/**
 * @typedef {Object} UnlistedInfo
 * @property {string} pdfLink - Link to the unlisted PDF document
 * @property {string} formLink - Link to the petition form
 */

export default {};
