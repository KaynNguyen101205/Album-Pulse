# 05 — Env & Setup (Local Dev)

## 1) Prereqs
- Node.js 20+
- Git
- Supabase project (Postgres) → lấy DATABASE_URL
- Spotify Developer app → CLIENT_ID + Redirect URI

## 2) Environment variables
Tạo file `.env.local`:
```bash
DATABASE_URL="postgresql://..."
SPOTIFY_CLIENT_ID="..."
SPOTIFY_REDIRECT_URI="http://localhost:3000/api/auth/callback"

# optional (nếu bạn dùng refresh token flow server-side)
# SPOTIFY_CLIENT_SECRET=""  # thường PKCE không cần secret trên client-side, nhưng server có thể dùng
```

## 3) Install & run
```bash
npm i
npx prisma generate
npx prisma migrate dev
npm run dev
```

## 4) Supabase notes
- Prisma connect bằng `DATABASE_URL` (connection string của Supabase).
- Nếu bạn bật RLS, nhớ policy cho server role hoặc dùng service role key **chỉ server-side**.

## 5) Spotify notes
- OAuth PKCE: cần set redirect URI đúng 100% (match exact).
- Scopes MVP: `user-top-read user-read-recently-played user-library-read` (tuỳ bạn).

## 6) Suggested scripts (package.json)
- `lint`, `typecheck`, `test`, `build`, `dev`
