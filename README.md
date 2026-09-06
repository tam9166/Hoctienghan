# Tiếng Hàn - TamHoanq Mobile PWA

![Logo TH của Tiếng Hàn - TamHoanq](icons/logo-source.svg)

MVP mobile-first học tiếng Hàn dành cho người Việt, triển khai dạng static SPA/PWA.

Nhận diện chính dùng xanh chanh `#C5ED4F` kết hợp màu chữ tối `#1C2416`; cùng một nguồn logo TH được dùng cho giao diện, favicon và bộ icon PWA.

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
- PWA manifest + service worker network-first (`klearn-v46`) để cài app, dùng offline và nhận bản deploy mới; các gói học do người dùng tải được tách riêng trong Cache Storage.

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

## Giao diện học tập và cloud sync

- Hệ màu giao diện dùng lime `#DDFF66`, accent hover `#CBEF4D`, nền nhạt `#F7FFD1`, chữ đậm `#1F2A1A` và viền `#D6E8A8`; dark mode dùng cùng màu nhấn trên bề mặt tối có độ tương phản rõ.
- Information architecture chính gồm Home, Học tập, TOPIK, Ôn tập, Trợ lý học tập và Hồ sơ. Home ưu tiên tiến độ, nhiệm vụ hôm nay, bài học tiếp theo, từ đến hạn và kỹ năng cần cải thiện.
- Học tập gom lesson theo TOPIK, mini quiz, luyện nghe/nói/viết/đọc, sổ từ cá nhân và các lộ trình XKLĐ, du học, công sở. TOPIK có thi từng phần, full đề, kho đề TOPIK 1–6 và đếm ngược kỳ thi.
- Các hiệu ứng gradient/bóng đổ được tiết chế; button, badge, active navigation, progress và trạng thái tương tác dùng chung color system.

- `CloudSyncService` dùng local-first: thao tác ghi vào localStorage ngay, sau đó debounce sync theo sự kiện có ý nghĩa. Khi chưa cấu hình provider, Profile hiển thị `Chỉ lưu trên thiết bị`; khi mất mạng hiển thị `Ngoại tuyến` và không làm mất tiến độ.
- Dữ liệu cũ không bị xóa. `/api/config` chỉ trả public URL và publishable/anon key; `data/cloud-sync.js` khởi tạo singleton Supabase client chính thức, tự restore/refresh session và cung cấp provider cho `CloudSyncService`. Access/refresh token do Supabase client quản lý, không được đưa vào payload học tập.
- `LearnerProfileService` suy ra điểm mạnh/yếu từ SRS, lesson progress, điểm luyện, câu sai, speaking/writing metadata và thống kê 7 ngày; khi chưa đủ dữ liệu sẽ không gắn nhãn điểm yếu.
- `SmartReviewService` xếp hạng SRS đến hạn, từ/câu sai, mastery thấp và skill yếu theo rule minh bạch; hỗ trợ phiên 5/10/15/20/30 phút.
- Mastery lesson dùng `not_started → learning → understood → mastered`; progress record có `updatedAt`, `contentVersion` để tương thích về sau.
- `Trợ lý học tập` mở rộng tutor bằng learner context rút gọn (TOPIK, mastery, SRS, điểm kỹ năng, streak, handwriting và Sổ lỗi), không gửi password/token/database đầy đủ. Nhận xét tuần, sửa câu, bài luyện cá nhân và speaking feedback đều đi qua `/api/chat`.
- `Sổ lỗi của tôi` lưu local-first tại `klearn_errors`, gộp lỗi trùng theo fingerprint và đồng bộ như một domain người dùng; lỗi có thể đến từ TOPIK/grammar, speaking, writing hoặc công cụ sửa câu. Word Map trong từ điển tạo liên kết theo topic/tag/part-of-speech hiện có.
- Placement Test hiện có 16 câu đa chiều (vocabulary/grammar/reading/listening) và hiển thị breakdown theo kỹ năng. Đây là adaptive MVP, chưa phải bài thi chuẩn hóa.
- TOPIK Analytics hiển thị điểm, đúng/sai, thời gian trung bình, breakdown skill, trend 5 đề và readiness ước tính có nhãn rõ ràng.
- Global Search (`⌕` trên header) tìm theo Hangul, romanization, Vietnamese, English, 中文 trong lesson, dictionary, practice và phrasebook.
- Weekly Insights tổng hợp phút học, bài, từ thành thạo, đề đã làm, điểm mạnh/yếu; AI chỉ nhận structured stats nhỏ khi được bật.
- `PronunciationProvider` và `HandwritingProvider` là abstraction cho model tương lai. MVP hiện tại chỉ chấm text similarity/self-confirmation, không giả vờ có phoneme hoặc handwriting recognition AI.
- `AdaptiveLearningEngine` tạo Daily Mission cố định theo ngày bằng rule deterministic: kỹ năng yếu (+3), lỗi lặp (+3), lâu chưa luyện (+2), SRS đến hạn (+3), liên quan TOPIK mục tiêu (+2), memory/graph yếu (+2). Engine dùng learner profile, progress, practice history, SRS và Error Notebook; không random và không gửi secrets.
- `GoalTrackingService` lưu mục tiêu/deadline/phút học tại `klearn_learning_goals`; `RoadmapService` tạo roadmap 6 phase tại `klearn_adaptive_roadmaps`. Lớp nhận xét từ trợ lý là tùy chọn, fallback local luôn hoạt động.
- Daily Mission lưu tại `klearn_daily_missions`, giữ khoảng 30 ngày và khôi phục đúng mission khi reload. Ba domain mới được thêm vào `USER_SYNC_KEYS`, vì vậy Supabase `learning_sync.data` JSONB hiện có tự đồng bộ mà không cần bảng/migration SQL mới.
- Schema local được nâng lên version 13 theo hướng additive/idempotent; các key mới tự khởi tạo khi cần, không reset users, progress, SRS, Auth hay dữ liệu cloud cũ.
- `LearningMemoryService` lưu long-term memory chọn lọc tại `klearn_ai_memory`: learning preference, weak/strong knowledge, learning goal và repeated mistakes. Không lưu toàn bộ hội thoại; `MemoryRetrievalService` chỉ lấy tối đa vài memory liên quan đến câu hỏi/bài học. `klearn_ai_memory` và `klearn_knowledge_progress` đều nằm trong `USER_SYNC_KEYS` và dùng JSONB cloud hiện có.
- `KnowledgeGraphService` cung cấp core grammar graph và tự dựng vocabulary nodes từ dictionary theo topic (ví dụ 은/는 ↔ 이/가 và 학교 → 학생/선생님/수업/공부), related-node lookup và knowledge progress riêng từng user tại `klearn_knowledge_progress`. Graph weakness kết hợp Error Notebook, mastery và SRS để nâng điểm Smart Review/Daily Mission.
- Hồ sơ có xu hướng học tập và phần ghi nhớ chọn lọc; các thẻ đều mobile-first, dark-mode và chỉ hiển thị tín hiệu học tập cần thiết.

## Product UX Optimization (P23)

- Home tự nhận diện nhóm `beginner`, `topik`, `conversation` hoặc `general` từ hồ sơ hiện có, sau đó ưu tiên một hành động chính và phân bổ tính năng theo tỷ lệ rõ ràng.
- Progressive disclosure có ba mức `core → developing → advanced`; người mới không bị đẩy vào analytics hoặc công cụ nâng cao quá sớm.
- Command Center trả lời nhanh câu hỏi “Bạn muốn làm gì?” bằng các lối tắt học bài, ôn từ, luyện nói và làm test; danh sách tự thu gọn theo mức tiến bộ.
- Smart Search hợp nhất lesson, grammar/công cụ, vocabulary, câu, Sổ lỗi, ghi chú và bookmark; autocomplete hỗ trợ Arrow Up/Down, Enter và Escape.
- Onboarding rút còn hai màn hình, chỉ thu thập mục tiêu, trình độ và số phút học. Người chưa biết Hangul được đưa thẳng vào Level 0, không bị bắt làm placement test.
- Empty state luôn có hành động tiếp theo; lỗi được trình bày theo nguyên nhân, cách xử lý và nút retry/Home thay cho thông báo mơ hồ.
- Trợ năng theo user gồm cỡ chữ lớn, tương phản cao và giảm chuyển động; có skip link, focus ring, nhãn screen reader và vùng chạm tối thiểu 44–48px.
- Cấu hình P23 lưu user-scoped trong `klearn_product_ux`, tham gia CloudSync JSONB hiện có và không reset bất kỳ dữ liệu học nào.

## Advanced User Retention System (P24)

- `HabitFormationService` đo nhịp học bằng bốn tín hiệu: độ đều, đủ thời lượng mục tiêu, tỷ lệ hoàn thành và độ ổn định khung giờ; không quy habit thành một con số streak.
- Home có retention card, vòng lặp động lực, so sánh 30 ngày và smart reminder. Reminder tôn trọng cài đặt thông báo, không nhắc sau khi đã học trong ngày, không xin quyền browser và tối đa một đề xuất/ngày.
- Tổng kết tuần, phản tư tháng và mục tiêu lớn được lưu user-scoped trong `klearn_retention`; Goal Engine được chia thành đúng 50 milestone phản ánh tiến độ thật, không tự mở chỉ vì xem trang.
- Reactivation chọn kế hoạch nhẹ cho người vắng 7–29 ngày hoặc từ 30 ngày trở lên. Celebration chỉ mở khi có bằng chứng: 100 từ mastered, 50 giờ học tập thực tế (không tính lượt SRS như giờ học), hoặc một kết quả TOPIK đạt từ 60%.
- `retention_daily_metrics` là aggregate-only cho admin, có RLS chỉ đọc qua Supabase `app_metadata.role = 'admin'`; frontend không bịa số 0 khi migration/backend chưa sẵn sàng. Chạy `supabase/migrations/20260906_advanced_retention_system.sql` khi bật analytics quản trị.
- P24 nối vào CloudSync JSONB hiện có, cache PWA `klearn-v47`, hỗ trợ dark mode/mobile-first và không thay đổi Auth, SRS, Mastery hoặc dữ liệu cũ.

## Learning Trust and Quality System (P25)

- Content detail hiển thị `Native checked`, `Grammar checked`, `Example checked`, `Difficulty validated`, confidence score, learning source và kiểm tra translation/audio.
- Quality content được quality-gate bằng `content/content-quality-system.json`; nguồn được ghi rõ theo TOPIK curriculum, frequency vocabulary hoặc native-reviewed examples.
- Người học có thể báo sai nghĩa, audio, ví dụ, độ khó hoặc nội dung trùng ngay tại nội dung đang xem. Báo cáo local user-scoped dùng CloudSync hiện có; Supabase có bảng riêng với RLS cho reporter/reviewer/admin.
- Content Health Dashboard chỉ dành cho admin, tổng hợp coverage review, confidence, nguồn, audio/difficulty issues và duplicate detection; không trả dữ liệu user riêng tư.
- Version history nối với lịch sử P20 và metadata P25 để hiển thị old/new version, ngày cập nhật và lý do thay đổi.
- Chạy `supabase/migrations/20260906_content_quality_system.sql` để bật native validation, quality review và quality reports trên Supabase. PWA cache nâng lên `klearn-v48`.

## Công cụ học thực hành

- So sánh ngữ pháp song song, sổ ngữ pháp cá nhân và Repair Path nối trực tiếp với Sổ lỗi; lỗi chỉ được khép lại sau review, luyện tập và retest đạt yêu cầu.
- Luyện gõ Hangul theo 6 stage với độ chính xác, CPM và cụm cách/phút; Focus Study 15/25/45 phút lấy ưu tiên từ SRS, lỗi và Adaptive Learning Engine.
- Chapter Checkpoint kiểm tra từ vựng, ngữ pháp, nghe và đọc theo nhóm bài học, không khóa tiến độ và đưa điểm yếu về luồng ôn tập.
- Gói học offline dùng Cache Storage theo thao tác tải/xóa của người dùng; metadata thiết bị không đưa lên CloudSync.
- Shadowing Recorder chỉ giữ audio tạm trong tab, cùng Lịch học, Timeline cột mốc thật, bộ từ cá nhân, xếp câu và nhiệm vụ tiếng Hàn ngoài đời.
- Cài đặt học tập theo từng user gồm romanization, bản dịch, tốc độ/tự phát audio, cỡ chữ Hangul, mục tiêu từ, độ khó và mức hướng dẫn; giao diện mới hỗ trợ Việt, English và 中文（简体）.

### Bật Supabase cloud sync (tùy chọn)

1. Tạo Supabase project, bật Email/Password Auth và chạy `supabase/schema.sql` để tạo `learning_sync` cùng RLS `auth.uid() = user_id`.
2. Trên Vercel đặt `SUPABASE_URL` và `SUPABASE_ANON_KEY`. `SUPABASE_ANON_KEY` có thể là publishable key mới dạng `sb_publishable_...`; không bao giờ dùng `service_role`/`sb_secret_...`.
3. Trong Supabase Auth → URL Configuration đặt Site URL là production URL, đồng thời thêm production/preview/local URLs cần dùng để email confirmation quay về app.
4. Người dùng local tiếp tục học bình thường. Chỉ khi họ chủ động “Đăng nhập & liên kết” hoặc “Đăng ký & liên kết”, app mới gắn local profile hiện tại với `session.user.id`, merge và upsert cloud.
5. Nếu thiếu config, timeout hoặc Supabase outage, app vẫn chạy local mode đầy đủ.

### Education Platform

- `EducationPermissionService` chỉ đọc role `student`, `teacher`, `reviewer`, `admin` từ `Supabase session.user.app_metadata`; app không cho tự nâng role bằng localStorage.
- Teacher/Admin có khu quản lý School/Center, lớp học, roster, assignment lesson/vocabulary/test, phản hồi writing/speaking, Course Builder và báo cáo tiến độ lớp. Student chỉ đọc assignment/feedback mà RLS trả về cho chính họ.
- Course Builder có mẫu Business Korean, Travel Korean và TOPIK. Mỗi course item giữ `verified`, `difficulty`, `status`; nội dung chưa verified không thể chuyển thẳng sang `approved`.
- Chạy migration `supabase/migrations/20260906_education_platform_foundation.sql` sau migration teacher foundation để tạo organization, classroom, course, assignment và RLS. Dashboard giáo viên chỉ nhận snapshot tiến độ tối thiểu; learning journal, chat và audio không được trả qua RPC.

### Future Immersive Korean Experience

- `Thế giới tiếng Hàn` gom Virtual Korean City, Roleplay Game, Career Korean, University Life, Travel Simulator và Voice World vào một session engine; không tạo sáu chatbot hoặc menu AI riêng.
- Virtual City có Restaurant, Airport, School và Hospital. Roleplay có du học sinh mới, nhân viên mới và du lịch Hàn Quốc; Career có Interview, Meeting, Email; University và Travel dùng cùng data model mở rộng được.
- Mỗi lượt luyện chấm minh bạch theo ý nghĩa, grammar, độ tự nhiên và ngữ cảnh rồi theo dõi ba tín hiệu `confidence`, `fluency`, `accuracy`. Điểm thấp nối về Error Notebook; audio từ voice input không được lưu.
- Immersion Mode dùng chung `StudySettingsService`, ẩn translation và romanization trong session, sau khi tắt sẽ khôi phục lựa chọn trước đó. Debate dùng rubric local; chỉ mở Trợ lý học tập hiện có khi người dùng chủ động yêu cầu phản biện.
- Personal Learning Avatar hiện chỉ là nghiên cứu contract dữ liệu từ goal, mastery, SRS và speaking journey; không tạo khuôn mặt/giọng nói AI, không giả lập cảm xúc và không tự nhắn tin.

### Advanced Korean Learning Ecosystem Expansion

- Hub P5–P10 gom Journey Intelligence, Real Korean Life, Language Science, Skill World, Career & Purpose và Learning Architecture; không tạo thêm AI Tutor/Coach hoặc đặt AI Partner ở Home.
- Journey Replay, Learning DNA, nhắc học theo thói quen và Mood/Energy chỉ dùng activity, progress, SRS, Mastery và Learner Profile thật. Mood không được diễn giải như dữ liệu tâm lý.
- Life Simulator có Housing, Hospital, Bank, School và Work; Document/Sign Reader ưu tiên `TextDetector` chạy cục bộ và fallback nhập text. Ảnh, audio, token và dữ liệu riêng tư không được tải lên hoặc lưu.
- Error Pattern Map tổng hợp xu hướng riêng với Error Notebook; Naturalness/Complexity lưu câu theo user; Skill Tree, Mastery Map, Weekly Boss và badge đều lấy từ mastery thay vì level ảo.
- Career Path bao gồm IT, Business, Tourism và Office Korean cùng Interview, Email, Presentation và Etiquette. Memory Graph chỉ là structured learning context; bài luyện phụ luôn giữ `sourceId` của content đã duyệt.
- Nội dung P5–P10 nằm trong `content/ecosystem-expansion.json`, chỉ được fetch khi mở module, qua quality gate `verified + approved`, và được service worker cache cho lần dùng offline tiếp theo.

### Learning Intelligence & Data Science

- Trang Phân tích hiện tại được bổ sung một dashboard Learning Intelligence; không tạo chatbot hay trang AI mới.
- `MemoryRiskService` tính `Recall Strength` 0–100 và `Memory Risk` từ số lần đúng/sai, mastery, khoảng cách ôn, thời gian chưa gặp và due date. Smart Review dùng cùng phép tính để ưu tiên kiến thức có rủi ro quên cao.
- Bottleneck Detection so sánh các kỹ năng có dữ liệu; Mistake Root Cause phân nhóm tín hiệu thành lỗ hổng khái niệm, quên quy tắc, nhầm ngữ cảnh hoặc nhận biết âm. Kết quả luôn kèm bằng chứng và mức độ tin cậy.
- Learning Pattern phân tích khung giờ, thời lượng và loại bài từ practice/focus session; Efficiency Score kết hợp kết quả, khả năng lưu giữ và mức hoàn thành, không thưởng điểm chỉ vì học lâu.
- Knowledge Graph minh họa quan hệ vocabulary → form/grammar → sentence → topic; Skill Dependency Graph cho biết nền tảng nào còn thiếu trước mục tiêu TOPIK.
- Forecast 3 tháng hiển thị một khoảng dự kiến, giả định và mức tin cậy; đây không phải cam kết điểm thi. Toàn bộ P18 chạy local từ dữ liệu học hiện có, không đọc chat history, password, token hay audio và không reset dữ liệu người dùng.

### Korean Real-World Ecosystem

- Hub `Chuẩn bị cuộc sống tại Hàn` mở rộng Real Korean Life hiện có với Document Assistant, Menu Reader, Sign Reader, Shopping, Banking, Rental, University, Workplace và Survival Checklist; không tạo chatbot mới.
- Document Assistant nhận text hoặc ảnh tối đa 8 MB, ưu tiên `TextDetector` trên thiết bị và fallback sang nhập text. Ảnh, OCR text và kết quả phân tích chỉ nằm trong runtime hiện tại, không upload, không ghi localStorage/cloud; app cũng không yêu cầu OTP, PIN hay thông tin ngân hàng.
- Menu Reader có Restaurant, Cafe và Convenience Store với tên món, thành phần tham khảo, câu gọi món và cảnh báo dị ứng. Sign Reader phân biệt danger/warning/info, giải nghĩa và nêu hành động cần làm.
- Banking, Rental, University và Workplace Guide cung cấp từng bước, phrase kit và audio TTS hiện có. Shopping Guide giải thích size tham khảo, thử đồ, thanh toán và đổi trả.
- Culture Warning kiểm tra sắc thái theo ngữ cảnh bằng rule minh bạch: câu đúng ngữ pháp vẫn có thể bị cảnh báo nếu thiếu lịch sự. Survival Checklist chỉ lưu các mục người dùng tự xác nhận trong domain user-scoped hiện có.
- Nội dung P19 ở `content/real-world-assistant.json`, lazy-load qua quality gate `verified + approved` và được service worker cache cho offline. Vocabulary đã duyệt có thể đưa vào SRS mà không thay đổi TOPIK data.

### Advanced Content Platform

- Hub `Nền tảng nội dung` chuẩn hóa version, ngày tạo/cập nhật và workflow `Draft → Review → Approved`; người học chỉ tìm và mở nội dung Approved.
- Quality score tách rõ Grammar accuracy, Example quality và Audio quality. Native Review queue giữ nội dung chưa đạt ngưỡng ngoài luồng học, đồng thời tiếp tục dùng role Supabase hiện có cho quyền review/admin.
- Grammar Example Bank có câu Beginner, Intermediate và Advanced. Vocabulary Frequency Database cung cấp thứ hạng cùng frequency band để ưu tiên từ thông dụng.
- Content Search tìm lesson, grammar, word và example. Gợi ý bài tiếp theo dùng tiến độ/kỹ năng yếu hiện có, không tạo chatbot hoặc AI page mới.
- `My Korean Notebook` dùng chung Bookmark và Notes user-scoped. Feedback `khó hiểu / có lỗi / thiếu ví dụ` được lưu theo tài khoản trong `klearn_content_feedback` và đi qua CloudSync hiện có.
- Nội dung nguồn nằm ở `content/advanced-content-platform.json`, lazy-load qua quality gate và được cache cho offline bởi service worker.

### Community Learning Foundation

- `Community Hub` mở rộng foundation cũ bằng ba nhóm TOPIK 1, Conversation và Business Korean, challenge 30 ngày Hangul, Community Q&A và Peer Practice. Không có social feed hay leaderboard.
- Profile mặc định `private` và chỉ cho phép chia sẻ display name, level, tối đa bốn interest cùng learning goal sau khi người dùng opt-in. Email, điện thoại, URL và social handle bị chặn khỏi nội dung cộng đồng.
- Achievement sharing không tự đăng. Người dùng chọn milestone thật và phạm vi `private/groups`; Learning Friend chỉ theo dõi hồ sơ học tập, không mở direct message.
- Community Safety hỗ trợ report, block và unblock. Hồ sơ đã block bị loại khỏi peer matching; report và block được lưu user-scoped trong domain `klearn_community_progress` hiện có.
- Hồ sơ peer đi kèm hiện là dữ liệu mẫu được gắn nhãn rõ ràng. Lời mời luyện tập, câu hỏi, báo cáo và milestone share chỉ tạo bản nháp/bản xem trước cục bộ, không giả vờ đã gửi tới người thật hoặc moderation backend.
- Nội dung seed đã kiểm duyệt nằm ở `content/community-learning.json`, lazy-load và cache offline. Migration `20260906_community_learning_foundation.sql` chuẩn bị tables cùng RLS cho profile, group, challenge, Q&A, useful rating, peer request, milestone share, block và report; cần áp dụng migration và nối backend trước khi bật tương tác đa người dùng trực tuyến.
- Community Statistics chỉ hiển thị số nhóm, ngày challenge, câu hỏi và lời mời của chính tài khoản hiện tại; không tính rank hoặc so sánh từng người.

### Enterprise Education Platform

- `SubscriptionService` tách tier thương mại `free/premium` khỏi role giáo dục `student/teacher/reviewer/admin`. Tier và trạng thái Premium chỉ được đọc từ `Supabase session.user.app_metadata`; localStorage không thể tự nâng gói, và trạng thái không còn `active/trialing` sẽ dùng entitlement Free.
- Premium foundation định nghĩa Advanced Analytics, Premium Courses và Extended Practice nhưng không khóa hoặc làm hỏng tính năng học hiện có. Thanh toán chưa được tích hợp và UI không tạo giao dịch giả.
- Course Marketplace chỉ hiển thị khóa `approved + verified`; enrollment được lưu user-scoped. Certificate preview chỉ tạo khi tiến độ khóa đạt yêu cầu, được ghi rõ là local preview cho tới khi backend ký/xác minh.
- School Management và Center Dashboard tái sử dụng Organization, Classroom, Teacher Dashboard cùng role/RLS hiện có. Dashboard chỉ đọc snapshot tổng hợp, không đọc journal, chat, recording hoặc nội dung cá nhân thô.
- Partner API mới dừng ở hợp đồng `docs/partner-api-v1.openapi.json`: OAuth client credentials, scope theo organization và audit request. Không có endpoint thật hoặc secret nào được phát hành trong browser.
- Admin Analytics chỉ dành cho role `admin`; chỉ số backend chưa kết nối hiển thị `—` thay vì bịa dữ liệu. Product Language schema hỗ trợ `ko/ja/zh`, nhưng chỉ Korean đang active; Japanese và Chinese được ghi rõ là foundation/planned.
- Migration `20260906_enterprise_education_platform.sql` thêm subscription, entitlement, marketplace, certificate, organization plan, partner client/audit, aggregate analytics và product languages với RLS. Credential hash nằm ở bảng server-only không có authenticated policy.

### Korean AI Infrastructure

- AI Tutor và AI Coach dùng chung `AIOrchestrationService`: request, learner context và response được tách riêng; context chỉ giữ các trường học tập cần thiết, giới hạn độ dài và loại bỏ dữ liệu nhạy cảm.
- Routing `small/strong`, prompt version và thử nghiệm tone được cấu hình trong `content/ai-infrastructure.json`; model thật chỉ được chọn ở server qua `OPENAI_SMALL_MODEL`, `OPENAI_STRONG_MODEL` hoặc `OPENAI_MODEL`, không đưa secret vào frontend.
- Quality/safety gate kiểm tra response rỗng, claim không được xác minh và secret pattern. Khi provider lỗi, vượt budget hoặc bị chặn, app dùng fallback nội bộ và vẫn giữ nguyên Auth, CloudSync, SRS và lịch sử học.
- Usage telemetry chỉ lưu request count, token ước lượng/thực tế, route, prompt version, quality status và fallback; không lưu raw prompt/response. Local metrics nằm trong `klearn_ai_infrastructure`, migration `20260906_korean_ai_infrastructure.sql` chuẩn bị bảng evaluation logs với RLS user/admin.

### Global Language Platform Foundation

- `LanguageCoreService` tách logic language-independent khỏi content Korean, với mã chuẩn `ko`, `ja`, `zh`, `en`, locale, script, hướng chữ và trạng thái content. Korean là gói duy nhất đang active; các ngôn ngữ khác chỉ là foundation, không giả lập curriculum.
- `LanguageProfileService` lưu active language, level, goal và trạng thái riêng cho từng ngôn ngữ trong `klearn_language_profiles`; dữ liệu được đưa vào `USER_SYNC_KEYS` để không phá CloudSync hiện có.
- `ExamFrameworkService` chuẩn hóa mapping TOPIK/JLPT/HSK; `CourseStructureService`, `LanguageVocabularyEngine`, `GrammarFrameworkService` và `AudioFrameworkService` dùng schema chung nhưng nhận `languageId` bắt buộc.
- `LanguageComparisonService` hỗ trợ so sánh song song Vietnamese/Korean/Japanese/Chinese/English mà không trộn SRS hoặc mastery giữa ngôn ngữ. `GlobalLanguageContentService` yêu cầu `verified + approved + architectureOnly` trước khi hydrate.
- Migration `20260906_global_language_platform.sql` tạo hồ sơ đa ngôn ngữ user-scoped với RLS; không lưu nội dung riêng tư, audio thô hoặc credential.

### User Research and Experiment System

- `UserResearchService` chỉ ghi event học tập tối thiểu khi người dùng bật consent: bắt đầu/hoàn thành lesson, feature usage, review, drop-off, feedback và survey. Mặc định là `unknown`; từ chối consent thì event tracking dừng nhưng app vẫn hoạt động.
- Properties được allowlist và chặn password, token, secret, email, phone, chat, journal, audio/recording. Không có tracking ngoài phạm vi app; dữ liệu local được namespace theo user và CloudSync không reset progress hiện có.
- `ResearchAnalyticsService.metrics()` tính funnel, feature usage, drop-off và segment Beginner/TOPIK/Conversation từ event đã consent. `ExperimentService` gán A/B deterministic theo user + experiment, ghi exposure/result tối thiểu và không tạo chatbot/menu mới.
- Consent notice xuất hiện trong Profile; feedback lesson/report/suggestion và khảo sát ngắn là hành động chủ động của người dùng, nội dung bị giới hạn và lọc dữ liệu nhạy cảm.
- Content contract nằm ở `content/user-research-experiments.json`; migration `20260906_user_research_experiments.sql` chuẩn bị consent, bounded events, feedback và experiment logs với RLS user/admin.

### Advanced Learning Analytics Platform

- Trang Phân tích bổ sung `AdvancedLearningAnalyticsService` để biến số liệu thành tiến bộ dễ đọc: tốc độ học theo tuần, retention curve ở mốc 1/7/30 ngày, skill growth, learning efficiency và Knowledge Health Score.
- Course Completion Analysis nhóm lesson theo course/TOPIK/topic để chỉ ra phần hoàn thành thấp; Practice Quality Score tách accuracy, focus và progress thay vì chỉ đếm số phiên.
- Long-term Progress hiển thị cửa sổ 3 tháng, 6 tháng và 1 năm. Personal Benchmark chỉ so sánh user với chính giai đoạn trước của họ; không có peer ranking hay dữ liệu người khác.
- Weekly, monthly và yearly report được tạo deterministically từ SRS, Practice History, Mastery, Learner Profile và lesson progress. Người dùng có thể lưu tối đa 30 báo cáo trong `klearn_analytics_reports`; CloudSync vẫn dùng namespace user-scoped hiện có.
- Content contract nằm ở `content/advanced-learning-analytics.json`; migration `20260906_advanced_learning_analytics.sql` chuẩn bị bảng report cá nhân với RLS owner-only. Không lưu raw chat, journal, token, password hoặc audio.

### EdTech Business Intelligence Platform

- Route `Admin Control Center` mở rộng `admin-analytics` hiện có cho role `admin` từ Supabase metadata; không tạo một admin dashboard song song và không cho học viên xem aggregate vận hành.
- `BusinessIntelligenceService` đọc các bảng aggregate server-generated để theo dõi lifecycle New/Active/Returning/Churn, Day 1/7/30 retention, course performance, content engagement/ROI, free → premium conversion và learning value.
- Support queue chỉ lấy `type/status` (bug report, feedback, question), không đọc raw message. System health chỉ lấy error rate, API success, latency P95 và slow requests. Operation reports hỗ trợ daily/weekly/monthly.
- Khi BI backend chưa kết nối, UI hiển thị trạng thái unavailable/`—`, không bịa số 0. Quick links gom Content Health, Retention, Support và Enterprise trong một control center.
- Content contract nằm ở `content/edtech-business-intelligence.json`; migration `20260906_edtech_business_intelligence.sql` tạo aggregate tables với RLS admin-only. Không có user ID, email, credential, password, token, chat, journal hoặc audio trong BI tables.

### Premium Learning Experience

- `premium-features` hiện là một hub P31 dùng entitlement Premium do `SubscriptionService` đọc từ Supabase metadata; không có thao tác tự nâng gói bằng localStorage và học cơ bản/SRS/TOPIK hiện tại không bị khóa.
- Premium Study Plan có TOPIK 6 tháng và Conversation 3 tháng; Advanced Mock Exam dùng PracticeService hiện có với timer/exam-mode/skill breakdown, không tạo ngân hàng câu hỏi giả.
- Premium Content Pack gồm Business, Academic và Travel Korean. Private Learning Report tái sử dụng P18 report, Learner Profile và Forecast để tạo weakness/prediction/recommendation riêng user.
- Advanced Speaking Review đọc pronunciation attempts và skill profile thật; Personal Curriculum tạo module từ plan + điểm yếu hiện tại. Không tuyên bố chấm phoneme AI chính xác.
- Notes/Vocabulary export dùng dữ liệu user-scoped; PDF dùng print dialog của trình duyệt, không upload dữ liệu. Certificate tái sử dụng CertificationService và chỉ dùng completion evidence.
- Premium Support mở luồng teacher feedback hiện có. Family Account mới là architecture foundation (`owner/learner`, tối đa 4 slot), chưa tự gửi invitation hoặc chia sẻ progress giữa người dùng.
- Content contract nằm ở `content/premium-learning-experience.json`; migration `20260906_premium_learning_experience.sql` chuẩn bị family account/member với RLS owner/member và entitlement server-managed.

## Dữ liệu MVP

Dữ liệu local vẫn được namespace theo các key `klearn_users`, `klearn_session`, `klearn_progress`, `klearn_srs`, `klearn_practice`, `klearn_practice_history`, `klearn_speaking`, `klearn_writing`, `klearn_settings`. Local auth được giữ cho chế độ thiết bị; Supabase Email/Password Auth là danh tính cloud tùy chọn cho đồng bộ đa thiết bị.

## Chưa phải AI thật
Điểm phát âm hiện dựa trên Speech-to-Text và độ giống văn bản. Đây không phải chấm âm vị AI chính xác; bản production vẫn cần backend/API pronunciation scoring.
