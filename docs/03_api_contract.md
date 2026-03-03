# 03 — API Contract (Next.js Route Handlers)

Base: `/api`

## 1) Auth

### GET `/api/auth/login`
- Purpose: Start Spotify OAuth PKCE flow
- Response: Redirect to Spotify `/authorize`

### GET `/api/auth/callback?code=...`
- Purpose: Exchange code for tokens, create session
- Response: Redirect to `/dashboard`

## 2) Recommendations

### GET `/api/albums/suggest`
**Response 200**
```json
{
  "albums": [
    {
      "spotifyId": "string",
      "ten": "string",
      "ngayPhatHanh": "YYYY-MM-DD|YYYY-MM|YYYY",
      "anhBiaUrl": "string|null",
      "spotifyUrl": "string|null",
      "ngheSi": [{ "spotifyId": "string", "ten": "string" }],
      "diem": 12.34,
      "lyDo": "string"
    }
  ],
  "meta": {
    "timeRange": "MEDIUM_TERM",
    "nguon": "MIX",
    "createdAt": "ISO-8601"
  }
}
```

**Errors**
- 401 `not_logged_in`
- 429 `rate_limited`
- 500 `internal_error`

## 3) Favorites

### GET `/api/favorites`
Response 200
```json
{ "items": [ { "spotifyId": "string", "ten": "string", "anhBiaUrl": "string|null" } ] }
```

### POST `/api/favorites`
Body
```json
{ "albumSpotifyId": "string" }
```
Response 200
```json
{ "ok": true }
```

### DELETE `/api/favorites?albumSpotifyId=...`
Response 200
```json
{ "ok": true }
```

## 4) (Optional) History

### GET `/api/recommendations/history`
Return recent recommendation runs and top albums per run.
