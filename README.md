# AlbumPulse

AlbumPulse is a music discovery app built with Next.js and Prisma. Users can sign in, complete onboarding by selecting favorite albums and preferences, browse personalized recommendations, save favorites, and review a generated "weekly drop" of album picks.

This README is for developers and contributors working on the repository locally. It covers setup, required environment variables, database expectations, useful scripts, and the current CI/workflow state.

## Product overview

The current app flow is centered around:

- Authentication with Google OAuth and credentials-based sign-in
- Onboarding that collects favorite albums plus artist/genre preferences
- A dashboard that loads personalized album recommendations
- Favorites and saved albums management
- A weekly drop experience with feedback, ratings, reviews, and recommendation refresh/generation flows

Recommendation quality depends on the database contents, available external API keys, and whether album embeddings or seeded catalog data have been prepared.

## Tech stack

- Next.js 14 App Router
- React 18
- TypeScript
- Prisma ORM
- PostgreSQL
- NextAuth
- Vitest
- External music/recommendation data integrations:
  - MusicBrainz
  - Cover Art Archive
  - Last.fm
  - Hugging Face inference for embeddings

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Create your local environment file

Copy the checked-in example file:

```bash
cp env.example .env
```

Then fill in the required values described below.

### 3. Provision PostgreSQL

This project requires PostgreSQL. Set `DATABASE_URL` in `.env` to a working local or remote database before running Prisma commands.

### 4. Configure authentication

Set the required NextAuth and Google OAuth variables in `.env`.

For local development:

- `NEXTAUTH_URL` should be `http://localhost:3000`
- Add `http://localhost:3000/api/auth/callback/google` to the Google OAuth app's authorized redirect URIs

For production:

- `NEXTAUTH_URL` must match the exact deployed app URL
- Add the production callback URL to the same Google OAuth app

### 5. Generate the Prisma client and run migrations

```bash
npm run prisma:generate
npm run prisma:migrate
```

### 6. Start the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

### Required

These variables are enforced by [`src/lib/env.ts`](/Users/nguyentam/Album-Pulse/src/lib/env.ts):

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string used by Prisma |
| `NEXTAUTH_URL` | Base URL used by NextAuth callbacks and session flows |
| `NEXTAUTH_SECRET` | Secret used by NextAuth to sign and verify auth state |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |

### Optional / integration-specific

| Variable | Purpose |
| --- | --- |
| `LASTFM_API_KEY` | Enables Last.fm-backed metadata and popularity lookups where used |
| `MUSICBRAINZ_USER_AGENT` | Identifies this app when calling MusicBrainz |
| `EMBEDDING_API_KEY` | Enables embedding generation for similarity/recommendation workflows |
| `ADMIN_API_KEY` | Supports admin-only routes in production |

Use [`env.example`](/Users/nguyentam/Album-Pulse/env.example) as the template for local setup.

## Database and auth notes

- PostgreSQL is required. SQLite is not supported by the checked-in Prisma schema.
- [`prisma/schema.prisma`](/Users/nguyentam/Album-Pulse/prisma/schema.prisma) is the source of truth for the database model.
- Prisma migrations are already tracked under [`prisma/migrations`](/Users/nguyentam/Album-Pulse/prisma/migrations).
- Google OAuth redirect URIs must match both the local and deployed callback URLs exactly.
- Credentials auth also exists in the app, so Google OAuth is not the only supported sign-in path.
- Some recommendation and weekly drop flows are only meaningful once users, favorites, albums, and optionally embeddings exist in the database.

## Scripts

### App lifecycle

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local Next.js dev server |
| `npm run build` | Generate Prisma client and build the production app |
| `npm run start` | Start the production server after a build |

### Quality checks

| Command | Purpose |
| --- | --- |
| `npm run lint` | Run Next.js ESLint checks |
| `npm run typecheck` | Run TypeScript without emitting files |
| `npm test` | Run the Vitest suite once |
| `npm run test:watch` | Run Vitest in watch mode |

### Prisma and database

| Command | Purpose |
| --- | --- |
| `npm run prisma:generate` | Generate the Prisma client |
| `npm run prisma:migrate` | Run Prisma development migrations |
| `npm run db:verify` | Run a minimal CRUD verification against the current schema |

### Seed, ops, and recommendation utilities

| Command | Purpose |
| --- | --- |
| `npm run seed:test-user` | Create a test user with favorites from embedded albums |
| `npm run seed:more-albums` | Fetch and seed additional album/catalog data |
| `npm run embed:albums` | Generate embeddings for albums in the catalog |
| `npm run inspect:similar -- <album-id-or-mbid>` | Inspect nearest-neighbor matches for a given album |
| `npm run list:users` | List users and their favorite counts |
| `npm run cron:weekly-drop` | Run the weekly drop scheduler entrypoint manually |
| `npm run test:recommendation` | Exercise weekly drop generation for a suitable user |

## CI / workflow status

The repository currently includes these GitHub Actions workflows:

- [`ci.yml`](/Users/nguyentam/Album-Pulse/.github/workflows/ci.yml)
  - Runs install, Prisma generate, lint, and tests
  - Runs typecheck and build with `continue-on-error: true`
- [`integrate.yml`](/Users/nguyentam/Album-Pulse/.github/workflows/integrate.yml)
  - Runs on `main`
  - Verifies dependencies, generates Prisma client, runs lint
  - Runs typecheck and build with `continue-on-error: true`
- [`migrate.yml`](/Users/nguyentam/Album-Pulse/.github/workflows/migrate.yml)
  - Runs on `main`
  - Executes `prisma migrate deploy` only when the `DATABASE_URL` GitHub secret exists
- [`deploy.yml`](/Users/nguyentam/Album-Pulse/.github/workflows/deploy.yml)
  - Intentionally disabled placeholder workflow

## Known caveats

- The workflow files still contain notes that typecheck/build are expected to fail until remaining app code is fully aligned with the current schema and migration state.
- Recommendation quality depends on available catalog data, user favorites, and optional external services.
- Embedding and similarity workflows require the catalog to be populated first and may require `EMBEDDING_API_KEY`.
- Seed and recommendation helper scripts assume a working PostgreSQL database and realistic music data in the repo's current schema.

## Project structure

High-level folders:

- [`src/app`](/Users/nguyentam/Album-Pulse/src/app): App Router pages and route entrypoints
- [`src/components`](/Users/nguyentam/Album-Pulse/src/components): UI components for onboarding, dashboard, favorites, and weekly drop flows
- [`src/lib`](/Users/nguyentam/Album-Pulse/src/lib): shared client/server helpers, auth, validation, Spotify helpers, and recommendation logic
- [`src/server`](/Users/nguyentam/Album-Pulse/src/server): DB repositories, services, clients, schedulers, jobs, and embedding utilities
- [`prisma`](/Users/nguyentam/Album-Pulse/prisma): Prisma schema, migrations, and seed entrypoint
- [`scripts`](/Users/nguyentam/Album-Pulse/scripts): operational and verification scripts

## Local development checklist

For a realistic local environment:

1. Create `.env` from `env.example`
2. Point `DATABASE_URL` at PostgreSQL
3. Configure NextAuth and Google OAuth correctly
4. Run `npm run prisma:generate`
5. Run `npm run prisma:migrate`
6. Start the app with `npm run dev`
7. Seed data or create users/favorites if you want to exercise recommendation and weekly drop flows
