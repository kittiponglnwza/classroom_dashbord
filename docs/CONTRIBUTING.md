# Contributing to CH Classroom Hub

Thank you for your interest in contributing to **CH Classroom Hub**! This project is maintained by a small team and welcomes community contributions.

This document outlines the coding standards, branch strategies, and process for contributing to the repository.

## Table of Contents
1. [Getting Started](#getting-started)
2. [Development Workflow](#development-workflow)
3. [Branching Strategy](#branching-strategy)
4. [Commit Convention](#commit-convention)
5. [Coding Style](#coding-style)
6. [Testing](#testing)

---

## Getting Started

To get started with local development, follow these steps:

1. **Clone the repository:**
   ```bash
   git clone https://github.com/kittiponglnwza/classroom-dashboard.git
   cd classroom-dashboard
   ```

2. **Install dependencies:**
   Make sure you have Node.js (v18 or higher) installed.
   ```bash
   npm install
   ```

3. **Set up Environment Variables:**
   Create a `.env` file in the root directory. You will need a Google Client ID.
   ```env
   VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```
   The application will be available at `http://localhost:5173`.

---

## Development Workflow

1. Create an issue to discuss the changes you'd like to make, or pick an existing issue.
2. Fork the repository and create a new branch based on the issue.
3. Make your changes in your feature branch.
4. Run tests and linting to ensure quality standards.
5. Commit your changes using Conventional Commits.
6. Open a Pull Request (PR) against the `master` branch.

---

## Branching Strategy

We use a simplified Git Flow for managing branches:
- `master`: The production-ready state. Do not commit directly here.
- `feat/feature-name`: For new features (e.g., `feat/dark-mode`).
- `fix/bug-name`: For bug fixes (e.g., `fix/oauth-token-refresh`).
- `docs/doc-name`: For documentation updates.

---

## Commit Convention

This project enforces [Conventional Commits](https://www.conventionalcommits.org/) using Husky and Commitlint. Your commit messages must follow this structure:

```
<type>[optional scope]: <description>
```

**Common Types:**
- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Changes that do not affect the meaning of the code (white-space, formatting)
- `refactor`: A code change that neither fixes a bug nor adds a feature
- `perf`: A code change that improves performance
- `test`: Adding missing tests or correcting existing tests
- `chore`: Changes to the build process or auxiliary tools

**Example:**
```bash
git commit -m "feat(auth): implement silent token refresh"
```

---

## Coding Style

- We use **ESLint** to enforce JavaScript/React coding standards.
- Before committing, run `npm run lint` to catch and fix stylistic issues.
- React components must use functional components and Hooks.
- Tailwind CSS is the primary styling solution; avoid inline styles unless strictly necessary.

---

## Testing

CH Classroom Hub strictly enforces the Test Pyramid strategy.
When submitting a Pull Request, ensure that:
1. You have written tests for your new feature or bug fix.
2. All existing tests pass.

Run the test suite via:
```bash
npm run test
```

To view coverage:
```bash
npm run coverage
```
