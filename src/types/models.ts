export interface Attachment {
  name: string;
  size?: string;
  url?: string;
  type?: string;
}

export interface Assignment {
  id: string;
  title: string;
  course: string;
  courseCode: string;
  dueDate: string;
  status: 'todo' | 'doing' | 'done' | string;
  points: number;
  description: string;
  attachments: Attachment[];
  courseColor: string;
  courseId: string;
  googleLink?: string;
  topicId: string | null;
  creationTime: string;
  updateTime: string;
  updatedAt?: string;
}

export interface Course {
  id: string;
  name: string;
  code: string;
  color: string;
  descriptionHeading?: string;
  section?: string;
  room?: string;
  activeCount?: number; // UI computed
  updatedAt?: string;
}

export interface Resource {
  id: string;
  courseId: string;
  course: string;
  courseCode: string;
  courseColor: string;
  type: 'announcement' | 'material';
  title: string;
  description: string;
  creationTime: string;
  updateTime: string;
  googleLink?: string;
  attachments: Attachment[];
}

export interface Exam {
  id: string;
  courseCode: string;
  courseName?: string;
  subjectName?: string;
  subjectCode?: string;
  date: string;
  time: string;
  room: string;
  seat: string;
  rawIsoDate?: string;
  updatedAt?: string;
}

export interface ManualExam extends Exam {
  isManual: true;
}

export interface UnlistedExamInfo {
  pdfLink: string;
  formLink: string;
}

export interface ExamData {
  exams: Exam[];
  manualExams?: ManualExam[];
  unlisted: UnlistedExamInfo | null;
}

export interface ScheduleEntry {
  id: string;
  title: string;
  courseCode?: string;
  day: string;
  date?: string;
  endDate?: string;
  noAutoEndDate?: boolean;
  startTime: string;
  endTime: string;
  room?: string;
  color?: string;
  notes?: string;
  source?: string;
  isExam?: boolean;
  deletedAt?: string;
  updatedAt?: string;
}

export interface SyncRecord<T> {
  version: number;
  timestamp: string;
  data: T[];
}

export interface Profile {
  name?: string;
  email?: string;
  picture?: string;
  updatedAt?: string;
}

export interface UserProfile extends Profile {
  id?: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: UserProfile | null;
  loading: boolean;
  error: string | null;
}

export interface ClassroomState {
  courses: Course[];
  assignments: Assignment[];
  resources: Resource[];
  loading: boolean;
  error: string | null;
}

export interface SyncState {
  isSyncing: boolean;
  lastSync: string | null;
  error: string | null;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  duration?: number;
}

export interface FilterState {
  status?: string;
  courseId?: string;
  query?: string;
}

export interface GradeCourseRow {
  courseCode: string;
  courseName: string;
  section?: string;
  credits: number;
  grade: string;
}

export interface SemesterStats {
  ca: number;
  cs: number;
  cg: number;
  gp: number;
  gpa?: number;
  gpax?: number;
}

export interface AcademicSemester {
  semesterId: string;
  status?: string;
  courses: GradeCourseRow[];
  semesterStats?: SemesterStats | null;
  cumulativeStats?: SemesterStats | null;
}

export interface EnrolledCourseRecord {
  courseCode: string;
  thaiName?: string;
  engName?: string;
  credits: number;
  creditSpec?: string;
  instructor?: string;
  sections?: string[];
  remark?: string;
  academicYear?: string;
}

export interface CurriculumCategory {
  id: string;
  nameTh: string;
  nameEn: string;
  requiredCredits: number;
  color: string;
}

export interface AcademicData {
  semesters: AcademicSemester[];
  enrolledCourses: EnrolledCourseRecord[];
  curriculum: CurriculumCategory[];
  minGpax: number;
  courseCategoryMap: Record<string, string>;
  privacyBlur?: boolean;
  lastImportedAt?: string | null;
  updatedAt?: string;
}
