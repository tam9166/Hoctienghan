# K-Learn VN Mobile PWA

MVP mobile-first học tiếng Hàn dành cho người Việt, triển khai dạng static SPA/PWA.

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
- Welcome, đăng ký/đăng nhập và session persistence bằng localStorage.
- Onboarding mục tiêu, trình độ và Placement Test 10 câu.
- Dashboard/lộ trình cá nhân hóa theo người học.
- Điều hướng SPA giữa Trang chủ, Học, Ôn tập, Luyện tập và Cá nhân.
- Bài học 은/는, đọc câu tiếng Hàn bằng Web Speech Synthesis.
- Bài sắp xếp câu bằng thao tác chạm (tối ưu mobile).
- Ngân hàng 114 bộ luyện tập nguyên bản (1.710 câu), gồm Beginner, TOPIK I, TOPIK II, EPS-TOPIK và từ vựng theo chủ đề.
- Luyện nhanh 5–30 câu, bộ lọc đề, giải thích đáp án, phân tích điểm yếu và lịch sử kết quả theo tài khoản.
- Kho 660 từ vựng theo 33 chủ đề, có nghĩa tiếng Việt, ví dụ song ngữ và nội dung phát âm.
- SRS nâng cấp với chọn số từ, kiểm tra trước để bỏ qua từ đã nhớ, flashcard và lịch ôn 10 phút đến 30 ngày.
- Kiểm tra vốn từ độc lập theo từ đã học, hay sai, mastered hoặc đang ôn; có thể đưa từ sai vào phiên SRS.
- Ghi âm qua MediaRecorder và chấm tương đồng văn bản bằng Speech Recognition khi trình duyệt hỗ trợ.
- Hồ sơ động, tiến độ kỹ năng, huy hiệu, countdown TOPIK và lịch sử thi thử.
- PWA manifest + service worker network-first để cài app, dùng offline và nhận bản deploy mới.

## Dữ liệu MVP

Dữ liệu được namespace theo các key `klearn_users`, `klearn_session`, `klearn_progress`, `klearn_srs`, `klearn_practice`, `klearn_practice_history`, `klearn_settings`. Đây chưa phải hệ thống auth/backend production; cấu trúc code được chia section để có thể thay lớp storage/auth bằng Supabase sau này.

## Chưa phải AI thật
Điểm phát âm hiện dựa trên Speech-to-Text và độ giống văn bản. Đây không phải chấm âm vị AI chính xác; bản production vẫn cần backend/API pronunciation scoring.
