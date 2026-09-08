# P54 Demo & Presentation Mode

## Mục tiêu

Chế độ demo cung cấp một luồng trình bày ổn định cho bảo vệ đồ án, demo khách hàng và pitching. Tài khoản demo không có mật khẩu, không kết nối Supabase và không ghi dữ liệu vào namespace của người dùng thật.

## Kiến trúc

```text
Welcome / Login
      |
      v
DemoAccountService ---- lưu phiên trước đó
      |
      +---- SampleLearningDataService ---- demo-p54 only
      |          |-- progress
      |          |-- practice history
      |          |-- SRS
      |          `-- achievements / outcomes
      |
      +---- PresentationModeService ---- ẩn UI kỹ thuật
      |
      `---- DemoFlowService ---- Home > Learning > AI > Analytics
```

`content/product-demo.json` lưu nội dung showcase và mẫu chỉ số. `data/product-demo.js` quản lý vòng đời demo. `product-demo.css` chuẩn hóa màn hình trình bày và responsive.

Khi thoát demo, app chỉ xóa các bản ghi có key `demo-p54`, xóa demo user và khôi phục session trước đó. Demo data không nằm trong `USER_SYNC_KEYS`.

## Feature list

- Tài khoản demo một chạm, không hardcode credential.
- Dữ liệu mẫu: 18 bài, 126 từ, 7-day streak, SRS, lịch sử luyện, lỗi và thành tích.
- Guided flow: Home, Learning, Trợ lý học tập, Analytics.
- Showcase giải thích purpose và value của từng nhóm tính năng.
- Presentation mode ẩn cloud/debug/technical UI nhưng giữ thông báo offline quan trọng.
- Asset demo được precache cùng app shell; refresh và offline sau lần cài đầu vẫn hoạt động.
- Nút reset chỉ khôi phục namespace demo.

## Flow thao tác

1. Mở Welcome hoặc Login và chọn **Xem bản demo**.
2. Chọn **Vào bản demo**.
3. Dùng thanh Demo để đi theo Home → Learning → Trợ lý học tập → Analytics.
4. Chọn badge **DEMO** để mở trung tâm showcase.
5. Chọn **Thoát demo** để trở lại phiên trước.

## Kịch bản 5 phút

| Thời gian | Màn hình | Nội dung trình bày |
|---|---|---|
| 0:00–0:45 | Demo login | Value proposition và cam kết dữ liệu tách biệt. |
| 0:45–2:00 | Home | User mở app và biết ngay hôm nay cần làm gì. |
| 2:00–3:00 | Learning | Lộ trình từ Hangul đến TOPIK, tiến độ có sẵn. |
| 3:00–4:00 | Trợ lý | AI dùng hồ sơ học, không thay curriculum. |
| 4:00–5:00 | Analytics | Chứng minh outcome, retention và bước tiếp theo. |

## Kịch bản 10 phút

- 0–1 phút: Bài toán người học bị quá tải và value proposition.
- 1–3 phút: Home cá nhân hóa, daily plan, SRS due và next action.
- 3–5 phút: Beginner/TOPIK curriculum, lesson progress và quick practice.
- 5–7 phút: Trợ lý học tập, error notebook và recommendation có ngữ cảnh.
- 7–9 phút: Analytics, learning outcome, skill growth và mastery.
- 9–10 phút: Offline/PWA, privacy, khả năng mở rộng và CTA.

## Kịch bản 20 phút

1. 0–2 phút: Vấn đề, persona và khoảnh khắc học thành công đầu tiên.
2. 2–5 phút: Onboarding và Home cá nhân hóa.
3. 5–8 phút: Level 0, Hangul, lesson, mini quiz và lưu progress.
4. 8–11 phút: SRS, mastery, error replay và daily session.
5. 11–14 phút: Listening, speaking, conversation và TOPIK.
6. 14–16 phút: AI orchestration, context tối thiểu và fallback khi API lỗi.
7. 16–18 phút: Outcome analytics và báo cáo tiến bộ.
8. 18–19 phút: PWA/offline, Supabase/Auth, privacy và khôi phục.
9. 19–20 phút: Showcase kiến trúc, roadmap sản phẩm và Q&A.

## Checklist trước khi trình bày

- Mở demo online một lần để service worker hoàn tất precache.
- Nhấn **Khôi phục dữ liệu mẫu** trước buổi demo.
- Bật Presentation mode và dark/light mode phù hợp màn chiếu.
- Kiểm tra Home, Learning, Trợ lý và Analytics bằng thanh Demo.
- Thử refresh và offline trước khi ngắt mạng thật.
- Dùng 1440×900 hoặc mobile 390×844 cho screenshot nhất quán.
