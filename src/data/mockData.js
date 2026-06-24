export const initialAssignments = [
  {
    id: 'assign-1',
    title: 'Linux Assignment 3: Shell Scripting & Automation',
    course: 'Linux Administration',
    courseCode: 'CS-302',
    dueDate: '2026-06-25',
    status: 'todo',
    points: 100,
    description: 'Write a bash script that automates system backups. The script should compress the specified directory, append the current date to the filename, and move it to a backup folder. Include error logging and check if the destination has sufficient space.',
    attachments: [
      { name: 'assignment3_guideline.pdf', size: '1.2 MB' },
      { name: 'backup_template.sh', size: '4 KB' }
    ],
    courseColor: 'emerald' // Tailwind emerald accent
  },
  {
    id: 'assign-2',
    title: 'Database Lab 4: SQL Query Optimization',
    course: 'Advanced Database Systems',
    courseCode: 'CS-341',
    dueDate: '2026-06-27',
    status: 'doing',
    points: 50,
    description: 'Analyze and optimize a set of slow SQL queries. Write execution plans using EXPLAIN and EXPLAIN ANALYZE. Create appropriate indexes and rewrite subqueries to joins where necessary to reduce execution time by at least 50%.',
    attachments: [
      { name: 'lab4_slow_queries.sql', size: '12 KB' },
      { name: 'performance_schema_guide.md', size: '45 KB' }
    ],
    courseColor: 'blue' // Tailwind blue accent
  },
  {
    id: 'assign-3',
    title: 'Landing Page Redesign Prototype',
    course: 'Human-Computer Interaction',
    courseCode: 'CS-205',
    dueDate: '2026-06-26',
    status: 'todo',
    points: 100,
    description: 'Create a high-fidelity interactive prototype of a landing page redesign in Figma. Focus on usability heuristics, visual hierarchy, dark-mode accessibility, and mobile responsive layout. Submit the Figma share link and a brief UX rationale document.',
    attachments: [
      { name: 'hci_heuristic_checklist.pdf', size: '320 KB' }
    ],
    courseColor: 'amber' // Tailwind amber accent
  },
  {
    id: 'assign-4',
    title: 'Homework 3: Dynamic Programming & Greedy Algorithms',
    course: 'Algorithms & Complexity',
    courseCode: 'CS-401',
    dueDate: '2026-06-30',
    status: 'doing',
    points: 80,
    description: 'Solve the 4 theoretical problems on dynamic programming (Knapsack variation, Longest Common Subsequence modification) and greedy algorithms (Interval scheduling, Huffman coding). Show proofs of correctness and analyze time complexities.',
    attachments: [
      { name: 'homework3_problems.pdf', size: '410 KB' }
    ],
    courseColor: 'rose' // Tailwind rose accent
  },
  {
    id: 'assign-5',
    title: 'React Hooks & State Management Lab',
    course: 'Web Application Development',
    courseCode: 'CS-322',
    dueDate: '2026-06-29',
    status: 'done',
    points: 60,
    description: 'Build a custom search filter application using React functional components. Implement custom hooks for debouncing search inputs and fetching API data with loading/error states. Integrate React Context API for application-wide theme states.',
    attachments: [
      { name: 'react_lab_boilerplate.zip', size: '2.5 MB' }
    ],
    courseColor: 'purple' // Tailwind purple accent
  },
  {
    id: 'assign-6',
    title: 'Final Project Proposal & Architecture',
    course: 'Web Application Development',
    courseCode: 'CS-322',
    dueDate: '2026-07-10',
    status: 'todo',
    points: 150,
    description: 'Submit your group final project proposal. Detail the application architecture, system design diagram, database schema (ERD), API endpoints, and a breakdown of tasks among group members using a Gantt chart or Scrum board.',
    attachments: [
      { name: 'final_project_guidelines.pdf', size: '890 KB' }
    ],
    courseColor: 'purple'
  },
  {
    id: 'assign-7',
    title: 'Linux Terminal Project: Secure Server Setup',
    course: 'Linux Administration',
    courseCode: 'CS-302',
    dueDate: '2026-07-12',
    status: 'todo',
    points: 200,
    description: 'Configure a secure Ubuntu server on a virtual machine. Install and secure SSH, set up a firewall using UFW, configure Nginx with SSL/TLS, and set up automatic system updates. Provide a comprehensive setup documentation with logs and screenshots.',
    attachments: [],
    courseColor: 'emerald'
  }
];

export const initialCourses = [
  { id: 'course-linux', name: 'Linux Administration', code: 'CS-302', instructor: 'Dr. John Doe', color: 'emerald', bgBanner: 'from-emerald-900/30 to-emerald-950/40' },
  { id: 'course-db', name: 'Advanced Database Systems', code: 'CS-341', instructor: 'Prof. Sarah Smith', color: 'blue', bgBanner: 'from-blue-900/30 to-blue-950/40' },
  { id: 'course-hci', name: 'Human-Computer Interaction', code: 'CS-205', instructor: 'Dr. Jane Wilson', color: 'amber', bgBanner: 'from-amber-900/30 to-amber-950/40' },
  { id: 'course-algo', name: 'Algorithms & Complexity', code: 'CS-401', instructor: 'Prof. Alan Turing', color: 'rose', bgBanner: 'from-rose-900/30 to-rose-950/40' },
  { id: 'course-web', name: 'Web Application Development', code: 'CS-322', instructor: 'Assoc. Prof. Tim Berners-Lee', color: 'purple', bgBanner: 'from-purple-900/30 to-purple-950/40' }
];

export const defaultProfile = {
  name: 'Alex Mercer',
  studentId: '66010912345',
  email: 'alex.mercer@university.edu',
  major: 'Computer Science',
  avatarUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&q=80&w=200'
};
