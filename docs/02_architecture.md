# 02 — Architecture

## 1) High-level components
- **Next.js Web App**
  - Pages: Landing/Login, Dashboard, Favorites
  - API Routes: Auth, Recommend, Favorites
- **Spotify Platform**
  - Accounts Service: /authorize, /api/token
  - Web API: top/recent, artist albums
- **Supabase Postgres**
  - user + oauth tokens + cached artists/albums + favorites + rec history
- **Prisma**
  - DB access layer (type-safe)

## 2) Auth flow (PKCE)
1. Browser → `/api/auth/login`
2. App tạo `code_verifier`, `code_challenge`, redirect sang Spotify `/authorize`
3. Spotify redirect → `/api/auth/callback?code=...`
4. Server exchange code → `/api/token`
5. Store/Upsert user + tokens trong DB
6. Set session cookie (httpOnly) → redirect `/dashboard`

## 3) Recommendation flow (heuristic)
1. Dashboard → `/api/albums/suggest`
2. API đọc session → lấy access token (or refresh if expired)
3. Fetch signals:
   - `/me/top/artists` (limit 20)
   - `/me/player/recently-played` (limit 50)
4. Scoring:
   - điểm artist = top_weight + recent_count_weight
5. For top N artists:
   - `/artists/{id}/albums?include_groups=album&limit=20`
6. Normalize & rank:
   - dedupe album (spotifyId)
   - rank = artist_score + release_recency_bonus
7. Persist:
   - cache artists/albums
   - create `recommendation_run` + `recommendation_items`
8. Return JSON → render cards

## 4) Favorites flow
- Favorites UI → `/api/favorites`
- Insert/delete record `favorites`
- UI refresh list

## 5) Caching strategy (simple)
- Cache `artist` + `album` vào DB, update `updatedAt` khi gặp lại.
- Optional: in-memory cache trong request (Map) để dedupe trong 1 run.
- Avoid: Redis / queue ở MVP (giữ free-tier + đơn giản).

## 6) Error handling
- 401/403: refresh token (nếu có) hoặc re-login
- 429: exponential backoff + respect `Retry-After`
- 5xx: show retry UI

## 7) Security notes
- Tokens: refresh token lưu DB (có thể mã hoá app-layer).
- Session cookie: httpOnly, secure, sameSite=lax.
- DB: use service role key only server-side.
