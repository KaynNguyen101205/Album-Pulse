# AlbumPulse — Spotify Album Recommender (Option A)

> Mục tiêu: User đăng nhập Spotify → hệ thống đọc listening signals (top artists/tracks, recently played) → gợi ý **album** phù hợp → user lưu **favorites**.

## Stack (end-to-end, free-tier friendly)
- **App**: Next.js (full-stack) + TypeScript
- **UI**: TailwindCSS + shadcn/ui (tuỳ chọn)
- **DB**: Supabase Postgres
- **ORM**: Prisma
- **Auth**: Spotify OAuth (Authorization Code + PKCE)
- **Hosting**: Vercel (Hobby)
- **CI/CD**: GitHub Actions + Vercel Deploy

## Vì sao không dùng Spotify Recommendations API?
Spotify đã hạn chế nhiều endpoint (Recommendations/Related Artists/Audio Features/Audio Analysis) cho app use case mới.
MVP sẽ gợi ý album theo heuristic:
- lấy **top artists + recently played**
- lấy **albums của các artist đó**
- rank theo điểm + recency + dedupe
- cache album/artist vào DB để giảm call

## Docs
- `docs/01_overview.md`
- `docs/02_architecture.md`
- `docs/03_api_contract.md`
- `docs/04_database_prisma_schema.md`
- `docs/05_env_and_setup.md`
- `docs/06_ci_cd.md`
- `docs/07_ui_design_system.md`
- `docs/08_uml_use_case.md`
- `docs/09_tasks_backlog.md`
- `docs/10_eraser_prompt.md`

## Folder gợi ý (repo)
```
/app
  /(public)
  /dashboard
  /favorites
/api
  /auth/login
  /auth/callback
  /albums/suggest
  /favorites
/prisma
  schema.prisma
/lib
  spotify.ts
  prisma.ts
  recommend.ts
/docs
```
