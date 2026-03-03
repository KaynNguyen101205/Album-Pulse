# 09 — Tasks Backlog (MVP)

## Phase 0 — Repo scaffold
- [ ] Init Next.js + TS
- [ ] Setup Tailwind + UI lib
- [ ] Setup Prisma + DB connection
- [ ] Add basic lint/typecheck/test scripts

## Phase 1 — Auth
- [ ] `/api/auth/login` (PKCE, set code_verifier cookie)
- [ ] `/api/auth/callback` (exchange token, upsert user, create session)
- [ ] Session strategy (httpOnly cookie)
- [ ] Logout (clear cookie)

## Phase 2 — Spotify client lib
- [ ] `lib/spotify.ts`: typed fetch wrapper
- [ ] Handle 401 → refresh/relogin
- [ ] Handle 429 retry/backoff

## Phase 3 — Recommendation engine
- [ ] `lib/recommend.ts`: scoring + ranking
- [ ] Fetch top artists + recently played
- [ ] Fetch albums per artist
- [ ] Dedupe + rank
- [ ] Persist run + items

## Phase 4 — UI
- [ ] Landing/Login page
- [ ] Dashboard grid + filters
- [ ] Favorites page

## Phase 5 — Favorites API
- [ ] GET/POST/DELETE favorites
- [ ] UI integration

## Phase 6 — CI/CD
- [ ] GitHub Actions: PR quality gate
- [ ] main: prisma migrate deploy
- [ ] Vercel env vars set

## Phase 7 — Polish
- [ ] Empty states + errors
- [ ] Basic analytics logs (optional)
