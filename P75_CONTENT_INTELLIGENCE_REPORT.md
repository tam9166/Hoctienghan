# P75_CONTENT_INTELLIGENCE_REPORT

Ngày kiểm thử: 2026-09-16  
Repository: `tam9166/Hoctienghan`  
Branch: `main`  
Feature commit: `42c7522`

## 1. Content Architecture

- Thêm schema `Content Entity` chung với các trường bắt buộc: `id`, `type`, `title`, `level`, `topic`, `skill`, `difficulty`, `author`, `review_status`, `version`, `created_at`, `updated_at`.
- Registry hỗ trợ đủ 9 loại: lesson, vocabulary, grammar, listening, reading, writing, speaking, culture và story.
- Adapter đọc dữ liệu hiện có từ theory lessons, vocabulary bank, Advanced Content Platform và Content Repository. ID cũ được giữ làm `id/source_id`; không tạo lại progress hoặc completion.
- Registry chỉ đọc learning data. Workspace biên tập nằm ở key riêng `klearn_content_intelligence`, không được thêm vào CloudSync cá nhân.
- Route P75 được lazy-load; analytics chỉ xử lý batch cần thiết thay vì quét toàn bộ kho khi mở Home.

## 2. CMS System

- Thêm Content Operations foundation cho Create, Edit, Review, Publish và Archive.
- Workflow chuẩn: `draft → ai_review → human_review → approved → published`; archive/revision có transition rõ ràng.
- Content editor tạo/sửa bản nháp; reviewer/editor có quyền review/approve theo role và scope; chỉ admin/super admin được publish.
- Khu vực learner là read-only. Content Operations bị chặn nếu role không đủ quyền.
- Hệ CMS cũ, AI Content Studio và P62/P66 governance được giữ nguyên; P75 đóng vai trò orchestration layer, không thay thế dữ liệu đang chạy.

## 3. Version Control

- Mỗi lần revise tạo version mới, giữ nguyên content ID và lưu snapshot đầy đủ của version trước.
- `id`, `source_id`, `created_at` là bất biến trong revision API.
- Workflow history lưu actor role, thời gian, trạng thái trước/sau và ghi chú.
- Lesson progress, SRS, mastery và completion không nằm trong snapshot content nên không bị ghi đè khi content tăng version.
- Cloud production tiếp tục dùng trigger/version table đã có ở migration P62; local workspace được đánh dấu `authoritative: false`.

## 4. Quality System

- Mở rộng quality model thành 6 chiều: Accuracy, Naturalness, Difficulty Fit, Example Quality, Audio Quality và Learning Effectiveness.
- Trọng số được khai báo trong content model; publish threshold mặc định là 80.
- Có checklist riêng cho cả 9 loại content.
- Điểm thiếu bằng chứng được giữ `null` và loại khỏi phép tính có trọng số; hệ thống không tự điền điểm đẹp giả.
- Mỗi kết quả có `evidenceCoverage` và trạng thái `ready/needs-review/collecting`.

## 5. AI Content Assistant

- AI assistant chỉ hỗ trợ phát hiện lệch difficulty, thiếu review tự nhiên, thiếu audio evidence và nội dung quá ngắn.
- Output luôn có confidence, issue, suggestion, `advisoryOnly: true`, `sourceOfTruth: false`, `canPublish: false`.
- API publish của AI assistant chủ động ném lỗi. Human approval và admin publish là bắt buộc.
- AI không thay đổi score, mastery, SRS hoặc Adaptive Engine.

## 6. Analytics

- Theo dõi theo content: views, started/completed, completion rate, drop rate, average score, common errors và review frequency.
- Dữ liệu lấy từ learning attempts, lesson progress, research events đã consent và SRS hiện có.
- Learning effectiveness đo remembered/used/improved và retention 7/30 ngày khi có evidence.
- Trạng thái `collecting` được dùng khi chưa đủ mẫu; lượt mở không được coi là kết quả học.
- Dashboard quản trị tổng hợp total, cần review, báo lỗi, popular và weak content; batch giới hạn tránh block UI khi kho lớn.

## 7. Recommendation

- Recommendation kết hợp quality, learner weakness, level, completion và effectiveness evidence.
- Mỗi đề xuất có reason và evidence object.
- Chỉ được hiển thị kết luận cohort khi sample đạt tối thiểu 20. Nếu chưa đủ, UI nói rõ chưa đủ cohort thay vì tạo câu “người giống bạn cải thiện”.
- Adaptive/SRS/Mastery hiện có chỉ được đọc làm tín hiệu, không bị thay đổi thuật toán.

## 8. Content Gap

- Gap engine so coverage đã approved/published với target theo level và content type.
- Kết quả gồm `expected`, `current`, `gap`, `covered/missing`.
- Dashboard hiển thị trực tiếp khoảng thiếu cho Foundation, TOPIK 1, TOPIK 2 và TOPIK 3.
- Target là cấu hình có version, có thể điều chỉnh bởi đội curriculum mà không sửa engine.

## 9. Offline Pack

- Chuẩn hóa 4 pack: Beginner Korean, TOPIK 1, Business Korean và Travel Korean.
- Mỗi pack công bố content list/count, size, level, skill, lesson IDs, exercise IDs, audio metadata và asset list.
- Kết nối trực tiếp `OfflinePackService` P74/P49; payload lớn nằm ở Cache Storage, localStorage chỉ giữ metadata.
- Bổ sung Business Korean Pack và Travel Korean Pack vào catalog offline thật; download vẫn atomic và có version cache riêng.
- Service worker cache tăng `klearn-v101`; route loader/app asset tăng version để tránh chạy bundle cũ.

## 10. Security

- Student không thể create/edit/review/publish.
- Content scope lấy từ Supabase `app_metadata.content_scopes`; localStorage không cấp role.
- Creator/editor chỉ làm việc trong scope; reviewer/editor/admin mới approve; admin/super admin mới publish/archive.
- AI không có đường publish.
- P75 không đọc hoặc ghi password, access token, refresh token hoặc private profile fields.
- Workspace local chỉ là bản nháp không có thẩm quyền; publish production vẫn phải qua Supabase RLS/trigger hiện có.

## 11. Testing

- `git diff --check`: pass.
- Syntax: `app.js`, route loader, service worker, practical study và P75 module: pass.
- Toàn bộ unit regression: **73/73 pass**.
- P75 unit: migration, immutable version, workflow, permission, quality evidence, analytics, recommendation, gap và packs: pass.
- P75 browser: **360, 390, 430, 768, 1024, 1440, 1920 px**; dark mode; không horizontal overflow; touch target ≥44 px: pass.
- P75 browser xác nhận đủ 9 content types, 4 pack, read-only visit không tạo workspace và marker progress cũ còn nguyên.
- P49 offline/PWA regression: pass; offline reopen giữ user, 1,000 SRS cards và background queue.
- P71C Content Science responsive/data isolation regression: pass.
- P74 Product Delight responsive/progress regression: pass.

## 12. Remaining Risks

- P75 local authoring workspace là non-authoritative. Để editor vận hành đa thiết bị, cần nối UI P75 với bảng `learning_content`/`learning_content_versions` qua server adapter đang được P62/P66 bảo vệ.
- Workflow cloud cũ dùng `review/approved + published_at`; P75 dùng trạng thái chi tiết hơn. Cần migration mapping có kế hoạch trước khi thay constraint production, không đổi trực tiếp trên dữ liệu đang chạy.
- Cohort recommendation cần pipeline aggregate phía server và minimum cohort 20; bản hiện tại không giả lập số liệu cohort.
- Audio Quality giữ `null` nếu thiếu human/audio QC evidence. Cần quy trình kiểm âm thật để tăng coverage.
- Business/Travel pack hiện đóng gói JSON/metadata hiện có; file audio binary cần CDN manifest và kiểm tra quota trước khi đưa vào pack production.
- Difficulty engine là heuristic có confidence và chỉ advisory; quyết định curriculum cuối cùng vẫn thuộc reviewer.

## 13. Git SHA

- Feature implementation: `42c7522` — `feat: build content intelligence platform`
- Báo cáo này được commit riêng sau feature commit để SHA implementation không bị vòng lặp tự tham chiếu.

### Evidence files

- `content/content-intelligence-platform.json`
- `data/content-intelligence-platform.js`
- `content-intelligence-platform.css`
- `tests/p75-content-intelligence.test.js`
- `tests/p75-content-intelligence-responsive.browser.js`
