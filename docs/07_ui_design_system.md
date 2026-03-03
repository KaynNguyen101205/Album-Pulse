# 07 — UI Design System (MVP)

## 1) Brand
- Name: AlbumPulse
- Tone: clean, music-focused, simple

## 2) Tokens (starter)
- Spacing: 4, 8, 12, 16, 24, 32
- Radius: 12 (cards), 10 (buttons), 16 (modals)
- Typography:
  - H1: 32/40, bold
  - H2: 24/32, semibold
  - Body: 14/20
  - Caption: 12/16

## 3) Components
### Buttons
- Primary: “Login with Spotify”, “Save”, “Refresh”
- Secondary: “Remove”, “Cancel”

### Cards
- AlbumCard:
  - cover image
  - album title
  - artists
  - release date
  - “Why recommended” (caption)
  - actions: Save/Remove

### Navigation
- Top nav: Logo + Dashboard + Favorites + Logout

### Feedback
- Loading skeleton cards
- Empty states:
  - “No recent plays found”
  - “No favorites yet”
- Error banner/toast

## 4) Pages
### Landing/Login
- CTA login
- short value prop
- privacy note: store minimal data

### Dashboard
- filters: time range (short/medium/long), sort (score/newest)
- grid album cards

### Favorites
- list albums saved
- quick remove

## 5) Accessibility (basic)
- keyboard focus states
- alt text on images
