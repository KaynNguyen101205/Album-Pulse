# 01 — Overview

## 1) Problem statement
Từ thói quen nghe nhạc trên Spotify, hệ thống đề xuất một danh sách **album** phù hợp với taste hiện tại của user.

## 2) Core user journeys
1. **Login**: User bấm “Login with Spotify” → OAuth PKCE → hệ thống tạo session.
2. **Get recommendations**: Dashboard gọi API → lấy signals → tính điểm → trả list album.
3. **Manage favorites**: User save/remove album yêu thích.
4. **(Optional) View history**: xem các “recommendation runs” trước đó.

## 3) Non-functional goals (mức MVP)
- Bảo mật token: access token không lưu localStorage; dùng httpOnly cookie / session.
- Clear data flow: diagram dễ hiểu (UI → API Routes → Spotify → DB).
- Free-tier friendly: tránh background jobs nặng, tối ưu số call Spotify.
- Maintainable: docs + contracts rõ ràng, schema DB rõ.

## 4) Assumptions / constraints
- Spotify API có rate limits; cần retry/backoff cho 429.
- Một số endpoint có thể bị hạn chế theo chính sách Spotify; design tập trung vào top/recent + artist albums.
- Nếu user không có dữ liệu “recently played” (mới tạo tài khoản), fallback sang top artists/tracks hoặc trending logic đơn giản.

## 5) Output format
Album card gồm:
- title, artists, release date, cover image, spotify url
- “why recommended” (string ngắn)
