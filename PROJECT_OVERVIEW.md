# Project overview

## 1. Product

**Tiếng Hàn - TamHoanq** là ứng dụng web/PWA local-first dành cho người Việt học tiếng Hàn. Định vị hiện tại: một lộ trình rõ từ Hangul đến TOPIK và giao tiếp thực tế, với bước học hằng ngày và bằng chứng tiến bộ từ hoạt động đã hoàn thành.

Phiên bản khai báo trong [`version.json`](version.json) là `1.2.0-rc.1` (`release-candidate`). Repository có pipeline kiểm tra và triển khai, nhưng trạng thái release candidate không đồng nghĩa sản phẩm đã được chứng minh production-ready hoặc đã phát hành trên app store.

## 2. Problem statement

Người Việt tự học tiếng Hàn thường gặp bốn vấn đề:

- Không biết bắt đầu từ Hangul, từ vựng, ngữ pháp hay đề TOPIK.
- Nội dung và công cụ bị tách rời, khiến tiến độ khó theo dõi.
- Ôn tập không đúng thời điểm và lỗi cũ không quay lại thành bài luyện.
- Ứng dụng có nhiều chức năng nhưng không trả lời nhanh “hôm nay học gì?”.

## 3. Solution

TamHoanq kết nối onboarding, Level 0, curriculum TOPIK, practice, SRS, mastery, Error Notebook và kế hoạch hằng ngày trong một hồ sơ người học. Dữ liệu được lưu trên thiết bị trước; khi Supabase được cấu hình và người dùng liên kết tài khoản cloud, snapshot học tập được đồng bộ bằng revision và compare-and-swap.

AI là lớp hỗ trợ tùy chọn cho giải thích, sửa câu và gợi ý. Curriculum, kết quả đã đo và dữ liệu người học không được thay bằng nội dung AI tự quyết định.

## 4. Target users

### Primary

Người Việt bắt đầu hoặc học lại tiếng Hàn, học chủ yếu trên điện thoại và cần một bước tiếp theo rõ ràng từ Hangul đến khả năng sử dụng/TOPIK.

### Secondary

- Người chuẩn bị thi TOPIK.
- Người chuẩn bị du học, làm việc hoặc sinh sống tại Hàn Quốc.
- Người đã học rời rạc và muốn ôn có hệ thống.

### Not the current focus

- Trẻ nhỏ cần hệ sinh thái phụ huynh/game chuyên biệt.
- Người gần bản ngữ cần nghiên cứu ngôn ngữ học chuyên sâu.
- Nền tảng mạng xã hội hoặc marketplace hoàn chỉnh.
- Nền tảng đa ngôn ngữ đã phát hành. Repository mới có các foundation và mô hình mở rộng.

Chi tiết định vị nằm trong [`docs/P63_BRAND_POSITIONING_REPORT.md`](docs/P63_BRAND_POSITIONING_REPORT.md).

## 5. Core values

1. **Vietnamese-first:** giải thích theo ngữ cảnh và tư duy người Việt.
2. **Foundation before complexity:** người mới bắt đầu từ Hangul, không bị đẩy vào dashboard nâng cao.
3. **One clear next step:** Home ưu tiên hành động học tiếp theo.
4. **Evidence-based progress:** kết quả đến từ bài học, review, practice và checkpoint đã thực hiện.
5. **Local-first and transparent:** học offline được; cloud và AI là lựa chọn có trạng thái/fallback rõ.

## 6. Main capabilities

### Learning core

- Beginner Level 0, Hangul, ghép âm tiết, batchim và first words.
- Curriculum TOPIK 1–6, bài học, ngữ pháp, từ vựng và mock practice.
- SRS, mastery, active recall, interleaving và Error Notebook.
- Listening, speaking, writing, reading, conversation và practical Korean.
- Daily plan, goals, milestones, reports và learning outcomes.

### Platform support

- Static SPA/PWA, responsive light/dark UI và ba ngôn ngữ giao diện.
- Local accounts; Supabase Auth/CloudSync khi backend được cấu hình.
- Route-level lazy loading và offline app shell.
- Trợ lý học tập tùy chọn qua server-side OpenAI endpoint.
- Demo account cô lập cho trình bày.
- Capacitor shell có thể tái tạo cho Android/iOS; chưa có binary ký hoặc store release trong repository.

### Foundations, not complete businesses

Các khu teacher, organization, community, marketplace, premium và global-language có model/UI/migration foundation. Không nên giới thiệu chúng như dịch vụ thương mại hoàn chỉnh, thanh toán thật, mạng xã hội đầy đủ hoặc khóa học đa ngôn ngữ đã phát hành.

## 7. Technology stack

| Layer | Technology |
|---|---|
| Web UI | HTML5, CSS, vanilla JavaScript |
| Routing/state | Hash routing, in-memory `state`, user-scoped localStorage services |
| PWA | Web App Manifest, Service Worker, Cache Storage |
| Cloud | Supabase Auth, Postgres, RLS, RPC compare-and-swap |
| API | Node.js Vercel Serverless Functions |
| AI | OpenAI Responses API through `/api/chat`; optional and server-side |
| Mobile shell | Capacitor 8, Android/iOS generated projects |
| Delivery | GitHub Actions, Vercel deployment workflow |
| Testing | Node static/contract tests and Edge CDP responsive browser tests |

## 8. Future direction

Ưu tiên hợp lý sau release candidate:

- Hoàn thành user testing với primary persona trước khi mở thêm feature.
- Chuẩn hóa nội dung bằng human review và evidence về learning outcomes.
- Giảm bề mặt kỹ thuật/phase code khỏi UI người học.
- Xác nhận vận hành Supabase, monitoring, backup và incident process trong môi trường thật.
- Chỉ mở rộng teacher/mobile/global-language khi core Korean journey đạt chỉ số sử dụng và kết quả học rõ ràng.

## 9. Evidence and limitations

- Source code, migrations và automated tests là bằng chứng triển khai kỹ thuật.
- Không có dữ liệu trong repository chứng minh retention, điểm TOPIK hoặc mức tăng kỹ năng của người dùng thật.
- Các forecast/score trong app là hỗ trợ học tập, không phải chứng nhận chính thức.
- Health/readiness scripts xác nhận contract cấu hình; chúng không thay thế load test, penetration test hoặc disaster-recovery drill.
