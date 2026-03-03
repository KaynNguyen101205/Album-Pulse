# 10 — Eraser AI Prompt (Architecture Diagram)

Paste prompt dưới đây vào Eraser AI (Cloud architecture preset).

```text
Create a landscape (16:9) system architecture diagram in a clean “Twitter System Design” style with color coding and a small legend.

Project: “AlbumPulse” — a Spotify-based album recommender web app (Next.js full-stack).

Color legend:
- Green: UI screens (web pages)
- Blue: Services / app components
- Red: Data stores
- Orange: External systems/APIs
- Purple: CI/CD

Draw left-to-right with clear boundaries (group boxes):
1) Users / Browser
2) Vercel Hosting (Next.js)
3) Supabase (Postgres)
4) Spotify Platform
5) CI/CD (GitHub)

Components to include:

[Users / Browser] (Green UI)
- Landing / Login Page
- Dashboard (Recommended Albums)
- Favorites Page

[Vercel Hosting] (Blue)
- Next.js App (Frontend SSR/SPA)
- Next.js API Routes (Backend)
  a) Auth API: /api/auth/login, /api/auth/callback (PKCE)
  b) Recommendation API: /api/albums/suggest
  c) Favorites API: /api/favorites (save/remove/list)
- Session/Cookie Layer (httpOnly cookies)

[Spotify Platform] (Orange)
- Spotify Accounts Service (OAuth /authorize + /api/token)
- Spotify Web API
  - Get Top Artists/Tracks
  - Get Recently Played
  - Get Artist Albums

[Supabase] (Red)
- Postgres Database tables:
  users, oauth_tokens, artists, albums, album_artists, favorites, recommendation_runs, recommendation_items
- Prisma ORM layer (Blue) between API Routes and Postgres

[CI/CD] (Purple)
- GitHub Repo
- GitHub Actions Pipeline
  - PR: lint + typecheck + tests + build
  - main: prisma migrate deploy + deploy to Vercel
- Vercel Deploy (Preview Deploys for PR, Production for main)

Connections (arrows with labels):
1) Browser -> Next.js App (HTTPS)
2) Login Flow:
   - Login Page -> Auth API (/api/auth/login)
   - Auth API -> Spotify Accounts Service (/authorize) [redirect]
   - Spotify Accounts -> Auth API (/api/auth/callback) [redirect back with code]
   - Auth API -> Spotify Accounts Service (/api/token) [exchange code for tokens]
   - Auth API -> Postgres (store/update oauth_tokens + user profile)
   - Auth API -> Browser (set httpOnly session cookie)
3) Recommendation Flow:
   - Dashboard -> Recommendation API (/api/albums/suggest)
   - Recommendation API -> Spotify Web API (top/recent/albums)
   - Recommendation API -> Recommendation Engine (score artists, dedupe albums, rank)
   - Recommendation API -> Postgres (cache + store recommendation_runs/items)
   - Recommendation API -> Dashboard (return albums)
4) Favorites Flow:
   - Favorites Page -> Favorites API -> Postgres (favorites)
5) CI/CD Flow:
   - Git push/PR -> GitHub Actions -> Vercel Deploy
   - main pipeline -> Prisma migrate deploy -> Supabase Postgres

Make it a big system design map with clusters, clear labels, and a corner legend.
```
