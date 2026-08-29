# K-Learn VN Mobile PWA

Bản gộp mobile-first từ các màn hình HTML mẫu: Trang chủ/Lộ trình, Bài học ngữ pháp, Luyện phát âm, Cá nhân.

## Chạy trên máy tính
Dùng một web server cục bộ (không mở trực tiếp file bằng `file://` nếu muốn Service Worker/Microphone hoạt động đúng):

```bash
python -m http.server 8080
```

Sau đó mở `http://localhost:8080`.

## Chạy/cài trên điện thoại
1. Deploy thư mục này lên HTTPS (Vercel, Netlify, GitHub Pages, Firebase Hosting...).
2. Mở URL bằng Chrome/Safari trên điện thoại.
3. Android/Chrome: menu → **Add to Home screen / Install app**.
4. iPhone/Safari: Share → **Add to Home Screen**.

## Tính năng hiện có
- Điều hướng SPA giữa 4 khu vực chính.
- Lộ trình học và mục tiêu ngày.
- Bài học 은/는, đọc câu tiếng Hàn bằng Web Speech Synthesis.
- Bài sắp xếp câu bằng thao tác chạm (tối ưu mobile).
- Ghi âm qua microphone bằng MediaRecorder.
- Hồ sơ, kỹ năng, huy hiệu, lịch sử thi thử.
- PWA manifest + service worker để cài như app và cache giao diện.

## Chưa phải AI thật
Phần “Tailored Feedback” hiện là feedback demo theo giao diện mẫu. Để chấm phát âm thật cần backend/API speech-to-text + pronunciation scoring.
