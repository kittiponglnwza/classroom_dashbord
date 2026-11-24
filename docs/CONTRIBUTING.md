# Contributing

Thanks for helping improve CH Classroom Hub. Here is how to run the project locally and what checks to run before opening a pull request.

## Local Setup

Requires Node.js 20.19+ or 22.12+ (for Vite 8).

```bash
git clone https://github.com/kittiponglnwza/classroom_dashbord.git
cd classroom_dashbord
npm install
```

Create a `.env` file in the project root:

```env
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

Start the local dev server at `http://localhost:5173`:

```bash
npm run dev
```

## Branches and Commits

- Keep `master` deployable; work on a branch such as `feat/<name>`, `fix/<name>`, or `docs/<name>` and open a PR against `master`.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) (`commitlint.config.js`), for example:
  - `feat(exam): add fallback banner for previous-semester results`
  - `fix(sidebar): keep mobile drawer expanded on narrow screens`
  - `docs: update security and API reference`

Common commit types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`.

## Code Guidelines

- Use functional React components and hooks.
- Style with Tailwind CSS utilities rather than inline styles where possible.
- Never render untrusted strings with `dangerouslySetInnerHTML`, and always pass external URLs through `sanitizeExternalUrl()` (`src/utils/sanitize.js`).
- Keep user-scoped `localStorage` keys tied to the active email via `StorageRepository` or the helpers in `src/utils/storage.js`.

## Verification Checks

Run the same checks CI executes before pushing:

```bash
npm run typecheck   # TypeScript type checks (tsc --noEmit)
npm run lint        # ESLint across src and tests
npm run coverage    # Vitest suite + coverage thresholds
npm run build       # Production Vite build
```

You can also run `npm run test` for a faster test run without coverage reporting.
