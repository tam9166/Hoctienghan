# TH-Tiếng Hàn Mobile PWA

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
- Branding hiển thị thống nhất là **TH-Tiếng Hàn**; các key `klearn_*` nội bộ được giữ để tương thích dữ liệu cũ.
- Appearance có ba chế độ: Theo thiết bị (System), Sáng (Light) và Tối (Dark), lưu lựa chọn riêng theo người dùng với fallback global.
- Onboarding mục tiêu, trình độ và Placement Test 10 câu.
- Dashboard/lộ trình cá nhân hóa theo người học.
- Điều hướng SPA giữa Trang chủ, Học, Ôn tập, Luyện tập và Cá nhân.
- Bài học 은/는, đọc câu tiếng Hàn bằng Web Speech Synthesis.
- Bài sắp xếp câu bằng thao tác chạm (tối ưu mobile).
- Hệ thống TOPIK 1–6 với current level, target level và tiến độ tính từ lịch sử thật.
- 270 bộ luyện tập nguyên bản (4.050 câu): TOPIK 1–4 mỗi cấp 30 đề, TOPIK 5–6 mỗi cấp 20 đề, EPS/Vocabulary/Grammar mỗi nhóm 30 đề và 20 đề Beginner.
- 45 dạng bài gồm vocabulary, grammar, listening, reading, writing, speaking, roleplay, shadowing và đề tổng hợp.
- Trang chọn đề đánh số, đề ngẫu nhiên 5–50 câu, thử thách nâng cao, luyện lỗi sai, đề đã lưu và lịch sử chi tiết.
- Kho 1.000 từ TOPIK 1–6 theo chủ đề, loại từ và trạng thái SRS; hỗ trợ tìm bằng tiếng Hàn hoặc tiếng Việt.
- Phiên âm Latin theo Revised Romanization trong bài học, 1.000 từ vựng, flashcard, Speaking, Shadowing, Roleplay, Writing hints và phần review; tìm từ bằng Hangul, tiếng Việt hoặc romanization.
- Toggle phiên âm được lưu riêng theo người dùng; nội dung kiểm tra TOPIK/listening/vocabulary không làm lộ phiên âm trước khi trả lời.
- SRS với lựa chọn 5/10/20/30/50/100/tất cả, chọn nguồn từ, pretest, bỏ qua, vẫn nhắc lại hoặc đánh dấu đã thuộc.
- Kiểm tra vốn từ độc lập theo từ đã học, hay sai, mastered hoặc đang ôn; có thể đưa từ sai vào phiên SRS.
- Speaking Hub có 10 mode, 12 roleplay, ko-KR Speech Recognition và chấm độ giống văn bản/từ khóa ở mức MVP.
- Writing Hub có 10 mode, TOPIK Writing 1–6, editor mobile, đếm ký tự/từ, bài mẫu và đánh giá sơ bộ dựa trên từ khóa/cấu trúc.
- Listening/Reading Hub theo TOPIK level, Korean TTS, recommended practice và daily practice plan.
- Ghi âm qua MediaRecorder và chấm tương đồng văn bản bằng Speech Recognition khi trình duyệt hỗ trợ.
- Hồ sơ động, tiến độ kỹ năng, huy hiệu, countdown TOPIK và lịch sử thi thử.
- PWA manifest + service worker network-first (`klearn-v7`) để cài app, dùng offline và nhận bản deploy mới.

Nếu đã cài PWA với tên cũ **K-Learn VN** trên iPhone/Android, hãy xóa shortcut cũ, mở lại URL rồi chọn Add to Home Screen để launcher nhận tên **TH-Tiếng Hàn** mới.

## Dữ liệu MVP

Dữ liệu được namespace theo các key `klearn_users`, `klearn_session`, `klearn_progress`, `klearn_srs`, `klearn_practice`, `klearn_practice_history`, `klearn_speaking`, `klearn_writing`, `klearn_settings`. Đây chưa phải hệ thống auth/backend production; cấu trúc code được chia section để có thể thay lớp storage/auth bằng Supabase sau này.

## Chưa phải AI thật
Điểm phát âm hiện dựa trên Speech-to-Text và độ giống văn bản. Đây không phải chấm âm vị AI chính xác; bản production vẫn cần backend/API pronunciation scoring.
