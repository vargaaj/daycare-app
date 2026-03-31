# AGENTS.md

## Stack And Commands

- Framework: Next.js 16 App Router with React 19 and TypeScript (`app/` pages, route handlers under `app/**/api/route.ts`).
- Styling: Tailwind CSS v4 via `@import "tailwindcss"` in `app/globals.css`. No Tailwind config file is present.
- Auth: Clerk. Protected routes are enforced in `proxy.ts`.
- Data/storage: Supabase via the admin client in `lib/supabaseAdmin.ts`.
- Spreadsheet parsing: `xlsx`.
- Test stack: Vitest with `jsdom`, React Testing Library, Testing Library `user-event`, and `@testing-library/jest-dom`.
- Package manager/runtime: npm with Node `24.14.0` and npm `11.9.0` pinned in `package.json`.
- Commands:
  - `npm run dev`
  - `npm run build`
  - `npm run lint`
  - `npm test`
  - `npm run test:watch`

## Project Map

- `app/`
  - `page.tsx`: marketing landing page.
  - `configure/page.tsx`: classroom setup flow.
  - `upload/page.tsx`: spreadsheet upload flow.
  - `dashboard/page.tsx`: server-loaded dashboard data.
  - `configure/api/classrooms/route.ts`: CRUD for classrooms.
  - `upload/api/route.ts`: validates `.xlsx`, uploads to Supabase Storage, replaces current child/assignment data, then runs optimization.
  - `dashboard/api/route.ts`: saves month edits and projects changed children forward through the school year.
- `components/`
  - `configuration/`: client form for classroom setup.
  - `upload/`: client upload form.
  - `dashboard/`: large interactive dashboard client component.
  - top-level marketing sections.
- `lib/`
  - `supabaseAdmin.ts`: cached server-only Supabase admin client.
  - `optimization/optimizeClassrooms.ts`: future-month assignment engine.
- `test/setup.ts`: shared Vitest test setup and Testing Library cleanup.
- `types/`: shared request/response and form types.
- `vitest.config.ts`: Vitest config with React plugin, tsconfig path aliases, and `jsdom`.
- `public/templates/classroom_template.xlsx`: upload template.

## Implementation Rules

- Keep route pages thin. Fetch on the server in `app/**/page.tsx`, and keep interactive state in client components under `components/**`.
- Do not import `getSupabaseAdminClient()` into client components. It requires the service role key and belongs on the server only.
- Reuse existing types in `types/` before adding inline object types that cross file boundaries.
- Prefer small helper functions near the logic they support. Avoid broad abstractions unless the duplication is already causing drift.
- If you change schedule parsing, age-range parsing, or month-key generation, update every live implementation:
  - `components/dashboard/ClassroomDashboard.tsx`
  - `app/dashboard/api/route.ts`
  - `lib/optimization/optimizeClassrooms.ts`
  - `components/configuration/ClassroomConfigurationForm.tsx` for age-range validation
- Preserve current product rules unless the task explicitly changes them:
  - month keys are stored as first-of-month ISO strings like `YYYY-MM-01`
  - current month is editable/frozen; optimization projects from the following month through August of the school year
  - assignments are constrained by classroom age range, daily capacity, and monotonic progression to older rooms
  - upload currently performs a fresh overwrite of `children` and `classroom_assignments` for the signed-in user

## Database And API Notes

- Tables used directly in code: `classrooms`, `children`, `classroom_assignments`.
- Storage bucket used directly in code: `uploads`.
- There is no schema or migration tool checked into this repo. Never change database schema unless explicitly asked.
- Keep `user_id` filtering on every Supabase query touching tenant data.
- Route handlers already do explicit payload validation with narrow TypeScript guards. Preserve that pattern when expanding request bodies.
- Return user-facing error messages from API routes and log the raw Supabase error server-side.

## UI Conventions

- Preserve the existing visual language: slate/indigo palette, rounded cards, soft shadows, gradient page backgrounds, dense but readable form layouts.
- Tailwind classes are written inline in components; follow that pattern instead of introducing a separate styling system.
- Prefer extending existing UI sections/components over creating new wrapper layers.
- Avoid unnecessary React state. Most derived dashboard values are computed with `useMemo`; keep derived data derived.
- Keep server and client concerns separated. Do not move fetch-heavy server logic into client components unless required by the feature.

## Testing

- Preferred test stack for new tests is Vitest + React Testing Library + `@testing-library/user-event`, running in `jsdom`.
- Use the existing `vitest.config.ts` and `test/setup.ts` instead of creating ad hoc test bootstrapping.
- Use component tests for client components in `components/**`.
- Use Vitest unit tests for pure helpers and parsing/assignment logic when you extract or centralize them.
- When testing UI, prefer semantic Testing Library queries (`getByRole`, `getByLabelText`) over class or implementation-detail selectors.
- Mock browser/network boundaries (`fetch`, `window.confirm`, router hooks) and auth/data boundaries (Clerk, Supabase) in unit tests.
- `npm test` is configured as `vitest run --passWithNoTests` so CI/local verification can succeed before the first tests are added.
- If you add new tests, prefer placing them near the code they cover or under a focused `test/` area; keep placement consistent within the same feature.

## Verification

- Run `npm run lint` after changes when possible.
- Run `npm test` when test files or testable helpers/components change.
- Automated coverage is still minimal, so keep doing focused manual verification of:
  - `/configure` classroom CRUD
  - `/upload` spreadsheet validation and upload flow
  - `/dashboard` month edits, add-child flow, and save/projection behavior

## Change Strategy

- Prefer minimal edits in the existing flow over refactoring large files preemptively.
- Explain architecture before large refactors, especially in `components/dashboard/ClassroomDashboard.tsx` and the optimization logic.
- If work touches optimization or assignment persistence, verify both the current-month editing path and the future-month projection path.
