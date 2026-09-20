# P81 TOPIK STRATEGY & COACHING SYSTEM REPORT

## 1. Existing System Audit

- Audit read-only được thực hiện trước khi sửa code trên routes, TOPIK content, P80 exam engine, AI Coach, Error Notebook, Adaptive Engine, Learning Journey, SRS, Mastery, CloudSync, Offline/PWA và Vercel APIs.
- Hệ thống đã có trước P81: P80 cung cấp ngân hàng 44 câu, mock/section/type/smart test, timer, chấm điểm, phân tích kết quả, đồng bộ lỗi và dự báo điểm; `AICoachService` sử dụng `/api/chat` với AI consent; `GoalTrackingService`, `RoadmapService` và `AdaptiveLearningEngine` cung cấp goal/adaptive; SRS, Error Notebook, Mastery, CloudSync và offline packs đã có store dùng chung.
- Hệ thống có nhưng chưa hoàn chỉnh: `data/topik-strategy.js` chỉ có 6 chiến thuật cơ bản; Strategy Center cũ trong `data/long-term-ecosystem.js` là nội dung tĩnh, chưa có mastery dựa trên evidence, practice bridge, goal plan, readiness hoặc provenance đầy đủ.
- Hoàn toàn chưa có: thư viện P81 có cấu trúc, coaching flow Reading/Listening/Writing, Writing Template + Self-check, time training tùy chỉnh, strategy adaptation/mastery/readiness và strategy offline packs.
- Quyết định kiến trúc: xây một module P81 lazy-load, nội dung JSON tĩnh có provenance, và adapter nối các service hiện hữu. Không tạo question bank, AI chatbot, adaptive engine, SRS, progress store, API hoặc serverless function thứ hai.

## 2. New Features

- Thêm `content/topik-strategy-coaching-system.json`, `data/topik-strategy-coaching-system.js` và `topik-strategy-coaching-system.css`.
- Có 23 strategy, 8 nhóm writing template, Writing Self-check, flexible time plan/timer, P80 simulation bridge, goal planner, AI coaching bridge, adaptive recommendation, evidence mastery, dashboard, readiness và 3 offline packs.
- P81 được đăng ký trong route loader và chỉ tải khi đi vào TOPIK. Cold shell không tải toàn bộ strategy content.
- Các route UI gồm hub, library, strategy detail, writing, time management, simulation, goal, coach, dashboard, readiness và offline.
- P80 được mở rộng section progress trong exam mode; phần thi vẫn giữ nguyên chấm điểm và result flow hiện hữu.

## 3. Reading Strategy

- Bao phủ TOPIK I và TOPIK II với các dạng: thông tin chi tiết, chọn câu phù hợp, từ vựng/ngữ pháp, sắp xếp, ý chính, điền chỗ trống, trình tự, suy luận, từ trong ngữ cảnh và biểu đồ/bảng.
- Mỗi strategy có explanation, educational example, think-aloud pedagogy ngắn gọn, lỗi thường gặp, recommended approach và practice reference.
- Think-aloud chỉ mô tả các bước học có thể kiểm chứng, không hiển thị chain-of-thought nội bộ của AI.
- Nút luyện tập chuyển sang P80 theo section/question type để dùng cùng ngân hàng câu hỏi, scoring và Error Notebook.
- Tìm kiếm/lọc hoạt động theo level, section, question type và từ khóa tiếng Việt/Hàn.

## 4. Listening Strategy

- Bao phủ đọc trước câu hỏi, keyword/context prediction, speaker/purpose, thông tin thay đổi, distractor và inference.
- Mỗi bài chỉ ra tín hiệu cần nghe, bẫy thường gặp và hành động sau khi nghe; không tuyệt đối hóa một chiến thuật cho mọi câu.
- Practice reference nối trực tiếp sang P80 Listening; không tạo audio question bank hoặc progress store song song.
- Lỗi Listening trong Error Notebook được dùng để tăng ưu tiên strategy tương ứng, gồm distractor và inference.

## 5. Writing Strategy

- Tách riêng câu 51, 52, 53 và 54 của TOPIK II.
- Mỗi dạng có yêu cầu, cấu trúc triển khai, lỗi thường gặp, recommended approach, checklist và practice reference.
- Writing Self-check gồm chủ đề, cấu trúc, ngữ pháp, từ vựng, liên kết, chính tả, độ dài và logic.
- UI phân biệt rõ self-check/AI feedback với official grading; không tuyên bố AI chấm giống giám khảo TOPIK.

## 6. Template Library

- Có 8 nhóm: connective, academic, comparison, cause/effect, contrast, opinion, introduction và conclusion.
- Mỗi template giải thích khi nào dùng, vì sao dùng, cách thay đổi, ví dụ và cảnh báo lỗi dùng máy móc.
- Template được trình bày như công cụ tạo cấu trúc và biến thể, không phải đáp án học thuộc.

## 7. Time Management

- Hỗ trợ target TOPIK I/TOPIK II với đề xuất thời gian làm, kiểm tra và dự phòng.
- Người học có thể chỉnh từng phần; hệ thống không ép một công thức duy nhất.
- Practice Timer có start/pause/reset, thời gian còn lại và cảnh báo theo kế hoạch đã chọn.
- Time plan là dữ liệu local, không cần API hoặc secret.

## 8. Exam Simulation

- Simulation gọi P80 thay vì sao chép exam engine.
- Có full-screen tùy hỗ trợ trình duyệt, timer, question navigation, section progress, submit và result.
- Trong exam, hint, answer và AI explanation không xuất hiện; review/explanation chỉ mở sau submit qua result flow P80.
- Bản mở rộng section progress của P80 được test cùng regression P80 để giữ scoring và analysis hiện hữu.

## 9. Goal Planner

- Nhận current level, target TOPIK và target exam date, rồi tạo weekly strategy gồm Vocabulary, Grammar, Listening, Reading, Writing và Mock Test.
- Có lựa chọn kế hoạch 7 ngày hoặc 14 ngày.
- Planner sử dụng `GoalTrackingService` và `AdaptiveLearningEngine`; `independentScheduler` luôn là `false`.
- Priority được lấy từ evidence hiện có thay vì dựng một lịch/adaptive database độc lập.

## 10. AI Coach

- Tái sử dụng `AICoachService` với task `learning_recommendation`; không tạo chatbot, endpoint hoặc model route mới.
- Context được tối thiểu hóa từ mock history, skill performance, Error Notebook, vocabulary/grammar/writing/listening/reading weakness.
- AI consent và server-side secret boundary của `/api/chat` được giữ nguyên. Khi AI không khả dụng hoặc chưa consent, kế hoạch deterministic/local vẫn hoạt động.
- Kết quả hiển thị diagnosis, priority areas và improvement plan 7/14 ngày; luôn ghi rõ đây là AI guidance, không phải kết quả/chấm thi chính thức.

## 11. Strategy Mastery

- Năm trạng thái: Not Started, Learning, Practicing, Reliable và Mastered.
- Trạng thái được suy ra từ practice evidence đúng/sai, số lần thử, độ ổn định và recent evidence; không dùng XP làm bằng chứng mastery.
- Strategy adaptation đọc mastery và Error Notebook để tăng practice cho Reading inference, Listening distractor hoặc Writing structure khi có lỗi lặp lại.
- SRS/Adaptive/Error Notebook hiện hữu được kết nối, không có adaptive engine hoặc learning record trùng lặp.
- Dashboard hiển thị Reading/Listening/Writing progress, weak strategies, recently improved strategies và recommended next strategy.

## 12. Readiness

- Readiness là chỉ báo evidence-based, không phải lời hứa đậu hoặc dự đoán chính thức.
- Thành phần evidence gồm recent P80 attempts, strategy đạt Reliable/Mastered, số ngày hoạt động và xu hướng xử lý lỗi.
- UI giải thích nguồn dữ liệu tạo nên Listening, Reading và Writing readiness; khi thiếu evidence sẽ báo thiếu dữ liệu thay vì tạo điểm tin cậy giả.

## 13. Content Provenance

- Tất cả 23 example hiện tại được ghi `PRACTICE_EXAMPLE` và hiển thị nhãn **Practice Example**.
- Provenance lưu `source`, `examYear`, `examNumber` và `questionReference`; các trường đề thật hiện để `null` vì seed P81 không tự nhận là official TOPIK.
- Không có nội dung nào được gắn nhãn Official TOPIK nếu không có nguồn verified.
- Quality audit kiểm tra các disclaimer về practice example, AI feedback và readiness; không hứa điểm, không gọi AI prediction là kết quả chính thức.

## 14. Vietnamese-first Improvements

- Explanation, bẫy, approach, checklist và coaching được viết cho người Việt; Korean terminology được giữ cạnh giải thích tiếng Việt.
- Nội dung nêu lỗi do cách đọc/dịch từng từ, từ dễ nhầm, distractor và cách nhận diện nhanh.
- Nội dung là biên tập sư phạm gốc, không phải bản dịch máy đơn thuần.

## 15. Offline

- Có 3 pack: TOPIK I Strategy, TOPIK II Reading Strategy và TOPIK II Writing Strategy.
- Download dùng Cache API và `STORAGE_KEYS.offlinePacks` hiện hữu; không tạo offline database riêng.
- Pack chứa strategy JSON/module/style và các P80 assets cần cho practice phù hợp. Nội dung cơ bản vẫn xem được offline; AI không được quảng bá là offline.
- Service Worker cache được nâng lên `klearn-v104`; asset version được đồng bộ với toàn bộ regression contracts.

## 16. Security

- P81 public strategy content không chứa secret và không cần quyền Teacher/Admin.
- AI giữ authentication/consent/rate-limit/server-only secret boundary của `/api/chat`; module P81 không gọi provider trực tiếp.
- Không thay đổi authorization, premium entitlement, Teacher/Creator hoặc Admin routes.
- Không thêm bypass auth, không expose API key và không lưu raw private coaching context vào static content/cache.
- Security/Auth/CloudSync regression suites đều pass.

## 17. Vercel Function Impact

- Trước P81: **7 functions**.
- Sau P81: **7 functions**; tác động ròng **0**.
- Danh sách hiện tại: `/api/ai/feedback`, `/api/billing`, `/api/chat`, `/api/commerce`, `/api/config`, `/api/health`, `/api/version`.
- `scripts/vercel-function-audit.js` pass ở **7/12**, phù hợp Vercel Hobby. P81 dùng static client content và các endpoint hiện hữu.

## 18. Testing

- Full unit/static regression: **81/81 suites passed**.
- P81 unit pass: 23 strategies; Reading, Listening, Writing 51–54; templates; self-check; timer; P80 bridge; Adaptive goal/coach; evidence mastery/readiness; offline; security và 7-function budget.
- P81 real-browser: **92 checks** trên 10 P81 routes tại 320, 360, 390, 430, 768, 1024, 1440 và 1920 px; pass responsive, dark mode, touch, keyboard focus, Korean rendering và không horizontal overflow.
- Browser integration xác nhận P80 practice bridge, Adaptive goal, AI Coach reuse, readiness, offline pack, progress/SRS preservation và function impact 0.
- Browser regressions P77, P78, P79 và P80 pass; P78/P79 được chạy độc lập sau một lần Edge startup contention khi chạy đồng thời.
- JavaScript syntax: **803 files passed**; production asset contract pass với 35 direct assets, 128 lazy assets và 3,657,296 referenced bytes.
- Release readiness pass; mobile native build pass; `git diff --check` pass (chỉ có cảnh báo LF/CRLF của Git trên Windows).
- CI cho commit `67ff6cf` hoàn tất **success**; Vercel Production deployment hoàn tất **success**.

## 19. Remaining Issues

- 23 strategy là seed coaching có cấu trúc, chưa phải thư viện chiến thuật/corpus đầy đủ cho mọi kỳ và mọi biến thể TOPIK. Mở rộng nội dung cần editorial QA và provenance tương ứng.
- Practice examples là nội dung giáo dục gốc, không phải official exam questions. Muốn liên kết đề thật cần nhập nguồn được phép và đủ exam year/number/question reference.
- AI diagnosis phụ thuộc consent, cấu hình `OPENAI_API_KEY` và endpoint hiện hữu; deterministic fallback vẫn dùng được nhưng không thay thế huấn luyện viên/giám khảo.
- Vercel Deployment Protection đang chặn anonymous app-level production smoke; deployment status của Vercel vẫn success. `PRODUCTION_URL` chưa được đặt nên release readiness ghi domain smoke là pending.
- Cần QA thiết bị thật thêm cho full-screen, mobile timer background, offline storage pressure và service-worker upgrade.
- Không có hạng mục P82 nào được triển khai.

## 20. Git SHA

- Feature commit: `36ffe2a50823a69c5db3465042261233e91b924d`
- Feature message: `feat: add P81 TOPIK strategy coaching`
- CI contract fix: `67ff6cfa51765e1c8f49e0443ec9c132e5775aad`
- Fix message: `test: align cache version contracts`
- Branch: `main`
- Push: `origin/main` đã nhận cả feature và CI fix.
- Deployment for `67ff6cf`: Vercel Production **success**.

P81 hoàn thành vòng **Goal → Strategy → Practice → P80 Mock Test → Error Notebook → AI Diagnosis → Improvement → Readiness** trên cùng Learning Core hiện hữu, không tạo duplicate learning system và không tăng Vercel Function count.
