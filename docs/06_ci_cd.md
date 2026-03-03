# 06 — CI/CD (GitHub Actions + Vercel)

## 1) Goal
- PR: chất lượng code (lint/typecheck/test/build)
- main: migrate DB + deploy app

## 2) GitHub Actions (example)
Create `.github/workflows/ci.yml`:
```yaml
name: ci

on:
  pull_request:
  push:
    branches: [main]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
      - run: npm run build

  migrate:
    if: github.ref == 'refs/heads/main'
    needs: quality
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npx prisma migrate deploy
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

## 3) Vercel deploy
- Connect repo với Vercel
- PR → Preview Deploy tự động
- main → Production Deploy tự động

## 4) Secrets
- `DATABASE_URL` trong GitHub Actions secrets
- Vercel env vars: `DATABASE_URL`, `SPOTIFY_CLIENT_ID`, `SPOTIFY_REDIRECT_URI`

## 5) Migration safety (MVP)
- `migrate dev` chỉ dùng local
- `migrate deploy` chạy trên main
