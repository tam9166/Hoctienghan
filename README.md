# Tiếng Hàn - TamHoanq Mobile PWA

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
- Branding hiển thị thống nhất là **Tiếng Hàn - TamHoanq**; các key `klearn_*` nội bộ được giữ để tương thích dữ liệu cũ.
- Appearance có ba chế độ: Theo thiết bị (System), Sáng (Light) và Tối (Dark), lưu lựa chọn riêng theo người dùng với fallback global.
- Header có quick controls cho ngôn ngữ và giao diện; app hỗ trợ Tiếng Việt (`vi`), English (`en`) và 中文（简体）(`zh-CN`) với locale resources mở rộng được cho các ngôn ngữ mới.
- Nội dung Korean source/romanization luôn giữ nguyên; nghĩa, hướng dẫn và giải thích dùng `I18nService.localizedText()` với fallback locale an toàn về tiếng Việt.
- Onboarding mục tiêu, trình độ và Placement Test 10 câu.
- Dashboard/lộ trình cá nhân hóa theo người học.
- Điều hướng SPA giữa Trang chủ, Học, Ôn tập, Luyện tập và Cá nhân.
- Bài học 은/는, đọc câu tiếng Hàn bằng Web Speech Synthesis.
- Bài sắp xếp câu bằng thao tác chạm (tối ưu mobile).
- Hệ thống TOPIK 1–6 với current level, target level và tiến độ tính từ lịch sử thật.
- 270 bộ luyện tập nguyên bản (4.050 câu): TOPIK 1–4 mỗi cấp 30 đề, TOPIK 5–6 mỗi cấp 20 đề, EPS/Vocabulary/Grammar mỗi nhóm 30 đề và 20 đề Beginner.
- 45 dạng bài gồm vocabulary, grammar, listening, reading, writing, speaking, roleplay, shadowing và đề tổng hợp.
- Trang chọn đề đánh số, đề ngẫu nhiên 5–50 câu, thử thách nâng cao, luyện lỗi sai, đề đã lưu và lịch sử chi tiết.
- Kho 1.000 từ TOPIK 1–6 theo chủ đề, loại từ và trạng thái SRS; hỗ trợ tìm bằng tiếng Hàn, romanization hoặc nghĩa theo ngôn ngữ hiện tại.
- Phiên âm Latin theo Revised Romanization trong bài học, 1.000 từ vựng, flashcard, Speaking, Shadowing, Roleplay, Writing hints và phần review; tìm từ bằng Hangul, tiếng Việt hoặc romanization.
- Toggle phiên âm được lưu riêng theo người dùng; nội dung kiểm tra TOPIK/listening/vocabulary không làm lộ phiên âm trước khi trả lời.
- SRS với lựa chọn 5/10/20/30/50/100/tất cả, chọn nguồn từ, pretest, bỏ qua, vẫn nhắc lại hoặc đánh dấu đã thuộc.
- Kiểm tra vốn từ độc lập theo từ đã học, hay sai, mastered hoặc đang ôn; có thể đưa từ sai vào phiên SRS.
- Speaking Hub có 10 mode, 12 roleplay, ko-KR Speech Recognition và chấm độ giống văn bản/từ khóa ở mức MVP.
- Writing Hub có 10 mode, TOPIK Writing 1–6, editor mobile, đếm ký tự/từ, bài mẫu và đánh giá sơ bộ dựa trên từ khóa/cấu trúc.
- Listening/Reading Hub theo TOPIK level, Korean TTS, recommended practice và daily practice plan.
- Ghi âm qua MediaRecorder và chấm tương đồng văn bản bằng Speech Recognition khi trình duyệt hỗ trợ.
- Hồ sơ động, tiến độ kỹ năng, huy hiệu, countdown TOPIK và lịch sử thi thử.
- PWA manifest + service worker network-first (`klearn-v8`) để cài app, dùng offline và nhận bản deploy mới.

Nếu đã cài PWA với tên cũ, hãy xóa shortcut cũ, mở lại URL rồi chọn Add to Home Screen để launcher nhận tên **Tiếng Hàn - TamHoanq** mới.

## Công cụ từ điển và dịch

- Từ điển offline hơn 1.500 mục, tìm bằng Hangul, romanization hoặc nghĩa tiếng Việt.
- Entry có phát âm, romanization, ví dụ, lưu yêu thích và thêm vào SRS.
- Translation Hub hỗ trợ Việt ↔ Hàn cho từ, cụm từ, câu mẫu và một số template offline.
- Phrasebook offline, lưu câu và lịch sử dịch theo từng tài khoản.
- Kết quả tiếng Hàn có thể nghe bằng TTS `ko-KR` và chuyển thẳng sang luyện nói.
- Chưa cấu hình API dịch online; câu ngoài dữ liệu local hiển thị thông báo rõ ràng, không giả kết quả.
- AI Gia sư TamHoanq mở bằng nút nổi, lưu hội thoại theo user, dùng context học tối thiểu và có quick actions sửa câu/dịch/tạo bài tập.
- Endpoint server-side tùy chọn là `/api/chat`; cấu hình `OPENAI_API_KEY` và tùy chọn `OPENAI_MODEL` trên Vercel Environment Variables. Không đặt key trong frontend.
- Khi chưa có key hoặc offline, AI hiển thị trạng thái cấu hình/kết nối rõ ràng; dictionary, theory và phrasebook vẫn hoạt động offline.

## Learning intelligence và cloud sync

- `CloudSyncService` dùng local-first: thao tác ghi vào localStorage ngay, sau đó debounce sync theo sự kiện có ý nghĩa. Khi chưa cấu hình provider, Profile hiển thị `Chỉ lưu trên thiết bị`; khi mất mạng hiển thị `Ngoại tuyến` và không làm mất tiến độ.
- Dữ liệu cũ không bị xóa. `/api/config` chỉ trả public URL và publishable/anon key; `data/cloud-sync.js` khởi tạo singleton Supabase client chính thức, tự restore/refresh session và cung cấp provider cho `CloudSyncService`. Access/refresh token do Supabase client quản lý, không được đưa vào payload học tập.
- `LearnerProfileService` suy ra điểm mạnh/yếu từ SRS, lesson progress, điểm luyện, câu sai, speaking/writing metadata và thống kê 7 ngày; khi chưa đủ dữ liệu sẽ không gắn nhãn điểm yếu.
- `SmartReviewService` xếp hạng SRS đến hạn, từ/câu sai, mastery thấp và skill yếu theo rule minh bạch; hỗ trợ phiên 5/10/15/20/30 phút.
- Mastery lesson dùng `not_started → learning → understood → mastered`; progress record có `updatedAt`, `contentVersion` để tương thích về sau.
- `AI Korean Coach` mở rộng AI Tutor bằng learner context rút gọn (TOPIK, mastery, SRS, điểm kỹ năng, streak, handwriting và Error Notebook), không gửi password/token/database đầy đủ. `AI Weekly Coach Report`, sentence corrector, personalized practice và speaking feedback đều đi qua `/api/chat`.
- `Error Notebook` lưu local-first tại `klearn_errors`, gộp lỗi trùng theo fingerprint và đồng bộ như một domain người dùng; lỗi có thể đến từ TOPIK/grammar, speaking, writing hoặc AI correction. Word Map trong từ điển tạo liên kết theo topic/tag/part-of-speech hiện có.
- Placement Test hiện có 16 câu đa chiều (vocabulary/grammar/reading/listening) và hiển thị breakdown theo kỹ năng. Đây là adaptive MVP, chưa phải bài thi chuẩn hóa.
- TOPIK Analytics hiển thị điểm, đúng/sai, thời gian trung bình, breakdown skill, trend 5 đề và readiness ước tính có nhãn rõ ràng.
- Global Search (`⌕` trên header) tìm theo Hangul, romanization, Vietnamese, English, 中文 trong lesson, dictionary, practice và phrasebook.
- Weekly Insights tổng hợp phút học, bài, từ thành thạo, đề đã làm, điểm mạnh/yếu; AI chỉ nhận structured stats nhỏ khi được bật.
- `PronunciationProvider` và `HandwritingProvider` là abstraction cho model tương lai. MVP hiện tại chỉ chấm text similarity/self-confirmation, không giả vờ có phoneme hoặc handwriting recognition AI.
- `AdaptiveLearningEngine` tạo Daily Mission cố định theo ngày bằng rule deterministic: kỹ năng yếu (+3), lỗi lặp (+3), lâu chưa luyện (+2), SRS đến hạn (+3), liên quan TOPIK mục tiêu (+2), memory/graph yếu (+2). Engine dùng learner profile, progress, practice history, SRS và Error Notebook; không random và không gửi secrets.
- `GoalTrackingService` lưu mục tiêu/deadline/phút học tại `klearn_learning_goals`; `RoadmapService` tạo roadmap 6 phase tại `klearn_adaptive_roadmaps`. Nút “Tạo lộ trình bằng AI” chỉ là lớp nhận xét tùy chọn, fallback local luôn hoạt động.
- Daily Mission lưu tại `klearn_daily_missions`, giữ khoảng 30 ngày và khôi phục đúng mission khi reload. Ba domain mới được thêm vào `USER_SYNC_KEYS`, vì vậy Supabase `learning_sync.data` JSONB hiện có tự đồng bộ mà không cần bảng/migration SQL mới.
- Schema local được nâng lên version 12 theo hướng additive/idempotent; các key mới tự khởi tạo khi cần, không reset users, progress, SRS, Auth hay dữ liệu cloud cũ.
- `LearningMemoryService` lưu long-term memory chọn lọc tại `klearn_ai_memory`: learning preference, weak/strong knowledge, learning goal và repeated mistakes. Không lưu toàn bộ hội thoại; `MemoryRetrievalService` chỉ lấy tối đa vài memory liên quan đến câu hỏi/bài học. `klearn_ai_memory` và `klearn_knowledge_progress` đều nằm trong `USER_SYNC_KEYS` và dùng JSONB cloud hiện có.
- `KnowledgeGraphService` cung cấp core grammar graph và tự dựng vocabulary nodes từ dictionary theo topic (ví dụ 은/는 ↔ 이/가 và 학교 → 학생/선생님/수업/공부), related-node lookup và knowledge progress riêng từng user tại `klearn_knowledge_progress`. Graph weakness kết hợp Error Notebook, mastery và SRS để nâng điểm Smart Review/Daily Mission.
- Profile có AI Learning DNA và AI Coach có Memory Insight; các thẻ đều mobile-first, dark-mode và chỉ hiển thị tín hiệu học tập cần thiết.

### Bật Supabase cloud sync (tùy chọn)

1. Tạo Supabase project, bật Email/Password Auth và chạy `supabase/schema.sql` để tạo `learning_sync` cùng RLS `auth.uid() = user_id`.
2. Trên Vercel đặt `SUPABASE_URL` và `SUPABASE_ANON_KEY`. `SUPABASE_ANON_KEY` có thể là publishable key mới dạng `sb_publishable_...`; không bao giờ dùng `service_role`/`sb_secret_...`.
3. Trong Supabase Auth → URL Configuration đặt Site URL là production URL, đồng thời thêm production/preview/local URLs cần dùng để email confirmation quay về app.
4. Người dùng local tiếp tục học bình thường. Chỉ khi họ chủ động “Đăng nhập & liên kết” hoặc “Đăng ký & liên kết”, app mới gắn local profile hiện tại với `session.user.id`, merge và upsert cloud.
5. Nếu thiếu config, timeout hoặc Supabase outage, app vẫn chạy local mode đầy đủ.

## Dữ liệu MVP

Dữ liệu local vẫn được namespace theo các key `klearn_users`, `klearn_session`, `klearn_progress`, `klearn_srs`, `klearn_practice`, `klearn_practice_history`, `klearn_speaking`, `klearn_writing`, `klearn_settings`. Local auth được giữ cho chế độ thiết bị; Supabase Email/Password Auth là danh tính cloud tùy chọn cho đồng bộ đa thiết bị.

## Chưa phải AI thật
Điểm phát âm hiện dựa trên Speech-to-Text và độ giống văn bản. Đây không phải chấm âm vị AI chính xác; bản production vẫn cần backend/API pronunciation scoring.
