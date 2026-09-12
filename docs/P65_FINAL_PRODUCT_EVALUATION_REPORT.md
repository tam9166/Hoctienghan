# P65 FINAL PRODUCT EVALUATION REPORT

Ngày đánh giá: 11/09/2026

Repository/branch: `tam9166/Hoctienghan` / `main`

Commit được đánh giá: `362eab5677aad64c713fe22b4cc1354c3e21fe5e`
Phiên bản khai báo: `1.2.0-rc.1` (`release-candidate`)

## Cơ sở đánh giá và giới hạn

Báo cáo dựa trên source code, migrations, tài liệu P48/P50/P62/P63/P64, kiểm tra build/readiness, 55 static/contract test, một tập browser regression đại diện và quan sát trực quan các màn hình portfolio. So sánh thị trường chỉ dùng thông tin công khai trên trang chính thức của các sản phẩm tại thời điểm đánh giá.

Không tìm thấy dataset, cohort export hoặc kết quả nghiên cứu từ người dùng thật trong repository. Các dữ liệu test/demo đều là dữ liệu tổng hợp. Vì vậy:

- không kết luận retention, learning gain, product-market fit hoặc khả năng đỗ TOPIK;
- đánh giá UX là expert review cộng với browser/task automation, không thay thế moderated usability test;
- số lượng feature hoặc test pass không được coi là bằng chứng một module tạo giá trị học tập.

Kết quả kiểm tra mới trong P65:

| Evidence | Result |
| --- | --- |
| Static/contract tests | 55/55 pass |
| Latest GitHub CI for evaluated SHA | [Completed successfully](https://github.com/tam9166/Hoctienghan/actions/runs/34620417213) |
| Production build contract | Pass: 31 direct assets, 86 lazy assets, 2,736,829 referenced bytes |
| Local performance sample | FCP 628 ms, load 1,086 ms, 40 requests, about 1.08 MB transferred; local machine only |
| Responsive/product UX | Pass at 360, 390, 430, 768, 1024, 1440 and 1920 px; light/dark; no horizontal overflow |
| Demo/browser flow | Pass at 360–1920 px; refresh/offline/demo isolation pass |
| Beginner/offline integrity | Pass in P48 and P49 representative browser tests |
| Voice/outcomes browser checks | Pass at 360–1920 px, dark mode and private persistence |
| P47 safety browser regression | Core privacy behavior passed, but one UI-copy assertion failed; see Risks |
| Content audit | 6,764 records: 3 VALID, 6,002 NEEDS REVIEW, 648 MISSING DATA, 111 DUPLICATE |
| Production environment | Not verified; `PRODUCTION_URL` absent, Supabase production setup pending, AI fallback expected without key |

## 1. Executive Summary

Tiếng Hàn - TamHoanq giải quyết đúng một vấn đề có thật: người Việt tự học tiếng Hàn cần biết bắt đầu ở đâu, hôm nay học gì và mình có đang tiến bộ hay không. Lời hứa “Hangul → TOPIK → tiếng Hàn dùng được” rõ hơn nhiều so với cách định vị bằng số lượng module hoặc AI.

Điểm mạnh nhất là tính liên kết hệ thống: onboarding, Level 0, lesson, practice, SRS, mastery, lỗi sai, daily plan, outcomes, local-first và cloud tùy chọn đã được nối thành một hành trình. UI/brand và responsive cũng đã vượt mức prototype thô; landing và Home thể hiện sản phẩm giáo dục khá rõ.

Điểm yếu lớn nhất không nằm ở kỹ thuật giao diện mà ở độ tin cậy của nội dung. Audit hiện tại cho thấy phần lớn content chưa có human-review evidence; 2.400 câu TOPIK được sinh theo template và không có nguồn đề chính thức được xác minh; 1.000 ví dụ từ vựng dùng chung template; không có native audio asset. Đây là rủi ro trực tiếp đối với giá trị học tập và uy tín thương hiệu.

Kết luận tổng thể: **một engineering prototype cuối kỳ/release candidate có tích hợp tốt, đủ mạnh để demo và portfolio, có thể tiến tới closed beta có kiểm soát sau khi xử lý blocker; chưa đủ bằng chứng cho public launch hoặc sản phẩm thương mại.** Tổng điểm đánh giá là **62/100**.

## 2. Product Maturity

### Problem solved

- Giảm quá tải cho người mới bằng Level 0 và một hành động chính trên Home.
- Kết nối học mới, luyện tập, ôn nhớ, lỗi sai và mục tiêu trong cùng hồ sơ.
- Kết hợp TOPIK với ngữ cảnh sống/làm việc thay vì tách thành nhiều ứng dụng.
- Hỗ trợ local-first và offline; cloud/AI không phải điều kiện để học cơ bản.

### Target user

Primary user hợp lý nhất là người Việt bắt đầu hoặc học lại tiếng Hàn, chủ yếu học trên điện thoại, có thời gian giới hạn và cần lộ trình từ Hangul đến TOPIK/giao tiếp. Nhóm TOPIK, du học và làm việc tại Hàn là secondary segment phù hợp. Teacher, community, marketplace và multi-language chưa nên là lời hứa chính.

### Main value

Giá trị khác biệt khả thi là: **một bước học rõ ràng mỗi ngày, được giải thích theo bối cảnh người Việt và nối từ nền tảng đến mục tiêu thực tế.** Đây là hypothesis có cơ sở sản phẩm, nhưng chưa có user evidence xác nhận.

### Differentiation

- Vietnamese-first thay vì chỉ dịch UI.
- Một hành trình liên tục từ số 0 đến TOPIK và thực tế.
- Lỗi sai quay lại review; tiến bộ gắn với learning evidence.
- Local-first, privacy control và fallback rõ.

Khác biệt này chưa bền vững nếu nội dung không được native/editor review. Competitor có thể sao chép daily plan hoặc AI; chất lượng curriculum và niềm tin mới là moat dài hạn.

### Current maturity level

| Dimension | Maturity | Evidence |
| --- | --- | --- |
| Product vision | Strong | Positioning và primary journey rõ |
| Feature integration | Medium–high | Core services liên kết, nhiều regression test |
| UX polish | Medium–high | Responsive/dark/no-overflow và progressive disclosure pass |
| Content trust | Low | 3/6,764 records có approved quality evidence |
| Learning efficacy | Unproven | Có measurement engine, chưa có real-user baseline/cohort |
| Operations | Medium–low | CI/runbooks có; production config, restore drill và live health chưa được xác minh |
| Market readiness | Early | Chưa có acquisition, activation, retention, willingness-to-pay data |

## 3. Feature Evaluation

`Status` phản ánh triển khai/integration. `Quality` dùng bốn mức Excellent, Good, Need improvement, Risk. Không module nào được xếp Excellent vì chưa có bằng chứng người dùng thật và content review diện rộng.

| Module | Status | Quality | Risk | Evaluation |
| --- | --- | --- | --- | --- |
| Learning Core: lesson, vocabulary, grammar, practice | Implemented | Need improvement | High | Flow và storage hoạt động, nhưng 120 lesson shell có placeholder/thiếu content; vocabulary examples và nhiều practice item là template chưa review. |
| Learning Intelligence: SRS, Mastery, Adaptive, Daily Mission | Implemented and integrated | Good | Medium | Rule deterministic, evidence states và fallback rõ; chưa có controlled outcome data để chứng minh thuật toán tối ưu hơn baseline. |
| TOPIK System | Broad implementation | Risk | Critical | Có level, mock/practice, analytics và strategy UI; 2.400 câu template, 0 source đề chính thức được xác minh nên chưa thể dùng như assessment chuẩn hóa. |
| Speaking/Writing | Functional browser MVP | Need improvement | High | Voice/text flows, history và feedback UI pass; chấm chủ yếu dựa transcript/similarity/rule, không có native audio/phoneme ground truth. |
| AI System | Optional and integrated | Need improvement | High | Context, consent, memory, orchestration và fallback tốt về kiến trúc; accuracy chưa độc lập đánh giá và `/api/chat` chưa xác thực Supabase JWT. |
| CloudSync | Implemented contract | Good | Medium | User-scoped payload, revision/CAS, idempotent queue và conflict test có; production Supabase chưa xác minh, JSON snapshot sẽ khó query/mở rộng. |
| Authentication | Local + Supabase foundation | Good | Medium | Local PBKDF2/session TTL và Supabase PKCE có; local auth không phải server identity, OAuth/passwordless/MFA phụ thuộc cấu hình ngoài repo. |
| Offline/PWA | Implemented | Good | Medium | Offline reopen, cache scope và background queue pass; cần device/network soak test và kiểm tra upgrade giữa các release thật. |
| Mobile | Reproducible Capacitor shell | Need improvement | High | Có build/doctor/workflow và shared auth/data strategy; chưa có signed build, store release hoặc real-device matrix evidence. |
| Community/Business | Architecture/UI foundations | Risk | High | Nhiều model/route/migration nhưng chưa có vận hành moderation, payment, support SLA, marketplace supply hoặc user demand evidence. |

## 4. UX Evaluation

### First impression

Landing trả lời tốt ba câu hỏi bằng hero, supporting copy và CTA: sản phẩm dành cho người Việt, đi từ Hangul đến TOPIK, và nút “Bắt đầu học” là điểm vào rõ. Trong expert review, thông điệp có thể hiểu trong 30 giây. Tuy nhiên chưa có timed real-user test nên không được coi đây là completion-rate evidence.

### Beginner experience

Onboarding đã rút còn mục tiêu, trình độ và thời gian; người chưa biết Hangul được đưa vào Level 0 thay vì TOPIK test. P48 browser test xác nhận beginner/lesson/offline progress integrity. Rủi ro xuất hiện khi người dùng rời Home: hub Learning tải/hiển thị rất nhiều nhóm nâng cao, nên progressive disclosure phải tiếp tục được kiểm bằng người mới thật.

### Learning flow

Home ưu tiên “Đề xuất hôm nay”, CTA học và số liệu tối thiểu. Lesson có bước, practice và lưu mastery; review có SRS; lỗi có đường sửa. Đây là flow hợp lý hơn một feature catalogue. Điểm chưa chứng minh là người học có hoàn thành flow, hiểu feedback và quay lại đúng bước hay không.

### Return experience

Session persistence, daily plan, SRS due, recovery behavior, offline reopen và sync queue tạo nền tảng quay lại tốt. Chưa có Day 1/7/30 retention thật; mọi nhận định về habit vẫn là design hypothesis.

### Advanced/TOPIK user

Người học nâng cao có nhiều công cụ: mock/practice, analytics, weak-skill suggestions, strategy và writing/speaking. Utility bề mặt cao nhưng validity thấp: khi câu hỏi chưa có provenance/human review, dashboard chính xác về phép tính vẫn có thể đo một bài test chưa đủ tin cậy.

### UX verdict

Core journey: **Good**. Discovery sâu: **Need improvement**. Outcome proof: **Unproven**. Vấn đề UX tiếp theo không phải thêm màn hình; đó là chứng minh người thật tìm đúng bài, hoàn thành bài và hiểu bước tiếp theo.

## 5. UI/Brand Evaluation

| Area | Evaluation | Evidence/Risk |
| --- | --- | --- |
| Brand consistency | Good | Logo TH, lime/ink và tên TamHoanq thống nhất trên landing, shell và PWA assets. |
| Color system | Good | `#DDFF66`, `#CBEF4D`, `#F7FFD1`, ink và border dùng qua shared tokens; dark mode pass. |
| Typography | Good with caveat | Be Vietnam Pro rõ; Hangul dùng fallback Noto Sans KR/system, chưa có cross-device font evidence. |
| Component system | Need improvement | Core button/card/nav nhất quán, nhưng 36 root CSS files và nhiều module tạo biến thể/card pattern khó quản trị. |
| Visual quality | Good on core surfaces | Portfolio screenshots cho Landing/Home/Learning/TOPIK/Analytics sạch và có hierarchy. |
| Professional feeling | Good for demo | Landing/Home giống education product; deep admin/advanced routes còn emoji, English eyebrow và cấu trúc catalogue giống demo/SaaS. |

Nếu bỏ logo, Landing và Home vẫn có dấu hiệu TamHoanq nhờ Vietnamese-first, daily next step và Hangul→TOPIK. Nhiều route sâu chưa đạt: chúng có thể thuộc một dashboard giáo dục bất kỳ. Product hiện **không còn giống AI template ở core journey**, nhưng vẫn mang dấu vết “feature demo” ở các khu nâng cao.

## 6. AI Evaluation

| Criterion | Evaluation |
| --- | --- |
| Usefulness | Có giá trị tiềm năng khi giải thích/sửa câu theo learner context; không chiếm Home hoặc thay curriculum. |
| Accuracy | Chưa đủ bằng chứng. Có output guards và prompt constraints nhưng không có Korean expert eval set hoặc production feedback data. |
| Safety | Consent, bounded context, secret filtering, `store:false` và fallback là điểm tốt; prompt filter không thay thế safety evaluation. |
| Cost | Có small/strong routing, output limits và usage fields; chưa có production budget/tenant quota evidence. |
| Transparency | Tốt: privacy settings nói rõ AI, trạng thái off/unconfigured và fallback. |
| Dependency | Thấp–trung bình: core learning vẫn chạy khi AI lỗi, đây là thiết kế đúng. |

**AI level:** kiến trúc đạt **Level 2 — Personalized tutor foundation** vì có learner context, memory và task routing. Mức được chứng minh trong vận hành chỉ khoảng **Level 1–2**. Chưa đạt Level 3: adaptive engine chủ yếu là rule-based, chưa có closed-loop evidence rằng AI cải thiện learning outcome, và chất lượng phản hồi chưa được human-evaluated diện rộng.

Trước public/paid use, `/api/chat` cần trusted user authentication, distributed rate limiting/quota, Korean evaluation set, error/latency/cost telemetry và escalation rõ khi confidence thấp.

## 7. Technical Evaluation

### Architecture

Local-first SPA/PWA, optional cloud/AI boundaries, route-level lazy loading và CAS sync là các quyết định phù hợp với resilience. Core learning không phụ thuộc dịch vụ ngoài. Điểm yếu là app phát triển theo nhiều extension global: `app.js` khoảng 422 KB, `data/` có 76 JavaScript files khoảng 1.75 MB và audit đếm khoảng 300 `window.*` references. Điều này tăng coupling, load-order risk và chi phí onboarding.

### Code quality and maintainability

Static contracts bao phủ nhiều invariants, nhưng vanilla global namespace, HTML string rendering và 36 CSS files làm refactor an toàn khó hơn khi team lớn. Không có type system hoặc root dependency/build graph để kiểm tra interface giữa services. Route loader giảm startup cost nhưng riêng các hub `lessons` và `profile` vẫn kéo rất nhiều nhóm discovery.

### Security

Điểm tốt: PBKDF2 local credential, session expiry, Supabase PKCE, RLS, CAS-only core mutation, privacy preference, CSP/security headers và secret scanning. Khoảng trống: `/api/chat` không xác thực Supabase JWT; rate limit chỉ in-memory mỗi serverless instance; account deletion cần trusted backend; OAuth/MFA và production RLS chưa có environment evidence.

### Performance

Local audit cho FCP 628 ms và load 1,086 ms, nhưng đây không phải field data. Initial path vẫn có 40 requests và khoảng 1.08 MB transfer; toàn asset graph tham chiếu khoảng 2.74 MB. Lazy loading, pagination và cache strategy là đúng hướng, nhưng cần mobile/slow-network field metrics trước public launch.

### Scalability

Serverless API và normalized extension tables có thể mở rộng. Core `learning_sync` là một JSONB snapshot theo user: đơn giản và an toàn cho hiện trạng, nhưng không phù hợp cho query analytics sâu, payload lớn hoặc nhiều concurrent clients lâu dài. In-memory rate limiting và browser-local telemetry cũng không phải nền tảng vận hành đa tenant hoàn chỉnh.

### Testing and documentation

55 static/contract tests pass và repository có 30 browser scripts. Các test representative cho responsive, dark mode, offline, privacy, demo, learning outcomes và voice đều pass, trừ P47 browser test có copy assertion cũ: runtime vẫn trả `AI_DISABLED_BY_USER`, không gọi fetch/sync và vẫn render `#aiPrivacySettings`, nhưng test tìm cụm copy trước P63. Đây là **test drift**, không phải bằng chứng privacy gate hỏng; vẫn phải sửa trước release để suite browser xanh hoàn toàn.

P64 documentation là một điểm mạnh rõ: architecture, database, API, AI, learning engine, security, development, demo và case study đã phản ánh đúng source và nêu giới hạn.

## 8. Learning Effectiveness

### What is technically supported

- SRS sử dụng recall rating, interval, streak, mastery, confidence/risk extension.
- Mastery phân biệt `not_started`, `learning`, `understood`, `mastered` dựa evidence.
- Adaptive plan dùng weakness, repeated errors, due reviews, inactivity và goal signals.
- Learning outcomes giữ baseline, before/after, 7/30-day retention, goal evidence và confidence status.
- Khi thiếu mẫu, UI trả “đang thu thập” thay vì tự bịa mức tăng trưởng.

### What is not proven

- Không có learner cohort thật để chứng minh vocabulary/listening/speaking tăng.
- Không có A/B result chứng minh daily plan tốt hơn lựa chọn thủ công.
- Không có external/official TOPIK benchmark.
- Không có native reviewer evidence cho đa số nội dung.
- Course effectiveness hiện là tương quan, chính source cũng không khẳng định quan hệ nhân quả.

### Verdict by outcome

| Outcome | Potential | Evidence level | Verdict |
| --- | --- | --- | --- |
| Knowledge retention | Good mechanism | Synthetic/contract tests | Promising, unvalidated |
| Practice quality | Mixed | Structural audit | Flow tốt, content validity yếu |
| Progress tracking | Good | Source + browser tests | Reliable for recorded activity/evidence, not external proficiency |
| Goal achievement | Early | Internal score only | Must not be treated as certification |
| Beginner success | Good design | Automated flow | Needs real-user completion and comprehension data |
| TOPIK preparation | Broad utility | Content provenance gap | Not ready for high-stakes readiness claims |

## 9. Competitive Position

Nguồn dưới đây là mô tả chính thức của đối thủ, không phải independent quality ranking.

| Product | Publicly documented strength | TamHoanq position | Gap/risk |
| --- | --- | --- | --- |
| Duolingo | [Korean course now advertises Hangul practice, grammar changes, broad localization and content up to B2](https://blog.duolingo.com/korean-course-updates/). | Có lợi thế Vietnamese-first, TOPIK/real-life continuity và local-first. | Không nên cạnh tranh bằng scale, game loop hoặc breadth; Duolingo có product/data maturity lớn hơn nhiều. |
| LingoDeer | [Detailed grammar, native-speaker audio, bite-sized quizzes and offline Korean](https://www.lingodeer.com/language/korean). | Có thể giải thích theo tư duy Việt và gắn daily recommendation với lỗi cá nhân. | TamHoanq chưa có native audio và verified curriculum tương đương. |
| Memrise | [Native-speaker video, personalized review and AI speaking practice](https://www.memrise.com/en-us/learn-korean). | Có curriculum/TOPIK/error loop tập trung hơn cho người Việt. | Thiếu authentic media/native voice; AI value chưa được user-validated. |
| Topik Master | [Exam-focused app with synchronized listening audio, transcripts and timer control](https://play.google.com/store/apps/details?hl=ko&id=com.topikmaster.app). | Phạm vi từ zero đến real life rộng hơn và có adaptive review. | TOPIK content hiện không có official provenance; breadth không bù được validity. |
| Talk To Me In Korean | [Structured curriculum with one-lesson/four-step flow](https://courses.talktomeinkorean.com/) và [level-based Korean course catalog](https://courses.talktomeinkorean.com/course-curriculum). | Có lợi thế local Vietnamese context, next action và integrated progress. | TTMIK có human-created content, native authority và curriculum trust mà TamHoanq chưa chứng minh. |

### SWOT

| Strength | Weakness |
| --- | --- |
| Vietnamese-first positioning; coherent zero-to-goal flow; local-first resilience; integrated learning evidence; strong documentation/test discipline. | Content review coverage rất thấp; thiếu native audio; nhiều feature foundation; global namespace/large app shell; không có real-user outcome data. |

| Opportunity | Threat |
| --- | --- |
| Phục vụ rõ nhóm người Việt cần Hangul→TOPIK→đời sống bằng một daily path; xây trust qua human-reviewed Vietnamese/Korean content. | Đối thủ có native content, mobile polish, distribution và learning data lớn; AI features nhanh chóng trở thành commodity; claim TOPIK sai có thể làm mất uy tín. |

## 10. Product Score

| Dimension | Score | Rationale |
| --- | ---: | --- |
| Product Vision | 8/10 | Target và problem rõ; cần giữ scope Korean/Vietnamese thay vì chạy theo platform breadth. |
| UX | 7/10 | Core next-action và beginner flow tốt; deep discovery và real-user validation còn thiếu. |
| UI | 8/10 | Brand, hierarchy, responsive và dark mode tốt; route sâu/icon/copy chưa hoàn toàn nhất quán. |
| Learning Experience | 6/10 | Engine/flow tốt nhưng trải nghiệm chỉ mạnh bằng nội dung, audio và feedback được xác minh. |
| Content Quality | 3/10 | 3 VALID/6,764; template/placeholder/provenance là blocker. |
| AI Integration | 6/10 | Optional, contextual, fallback tốt; accuracy, auth, cost và outcome chưa đủ evidence. |
| Technical Architecture | 7/10 | Resilient boundaries và CAS sync; monolith/global coupling làm giảm maintainability. |
| Security | 6/10 | Nhiều control đúng; production verification, JWT/chat quota và deletion backend chưa hoàn tất. |
| Scalability | 5/10 | Có lazy/serverless/schema foundations; snapshot/core architecture và vận hành chưa được load-tested. |
| Business Potential | 6/10 | Niche và value proposition hợp lý; chưa có demand, retention, conversion hoặc willingness-to-pay. |
| **Total** | **62/100** | **Demo/portfolio-grade release candidate; chưa phải market-ready product.** |

## 11. Remaining Risks

### Critical

1. **Learning content trust:** 6,002 records cần review, 648 thiếu dữ liệu, chỉ 3 VALID; TOPIK provenance bằng 0 cho 2.400 câu runtime.

### High

1. **No real-user evidence:** không có task completion, activation, retention hoặc learning gain thật.
2. **AI public-abuse surface:** `/api/chat` chưa xác thực Supabase JWT và rate limit không distributed.
3. **Production readiness unverified:** domain health, applied migrations, backup restore, on-call và provider configuration chưa có evidence.
4. **Maintainability:** `app.js` lớn, khoảng 300 global references và nhiều extension route/CSS tăng regression risk.
5. **Voice validity:** browser TTS/transcript similarity không đủ để claim native pronunciation assessment.

### Medium

1. `learning_sync` JSON snapshot có rủi ro payload/query/concurrency khi scale.
2. P47 browser assertion đã drift sau thay đổi product copy; suite browser không xanh tuyệt đối.
3. Mobile mới là unsigned/reproducible shell; chưa có real-device/store evidence.
4. External Google font và platform-specific Hangul fallback có thể làm UI/offline không đồng nhất.

### Low

1. Emoji/English eyebrow/technical wording vẫn còn ở một số route sâu.
2. Documentation versioning cần được duy trì cùng source để tránh drift mới.

## 12. Top 10 Final Improvements

Nếu chỉ được sửa mười việc và không thêm feature:

1. **Đóng băng feature expansion** cho đến khi core journey và content P0 đạt quality gate.
2. **Review thủ công 120 lesson shell và 2.400 TOPIK questions**; item chưa có source phải giữ nhãn practice, không được gọi đề chuẩn hóa.
3. **Thay dần 1.000 vocabulary template examples**, xác minh 986 romanization và phân loại 33 duplicate groups bằng Korean reviewer + Vietnamese editor.
4. **Chạy moderated usability test** với 5–8 người primary user mỗi vòng: first impression, onboarding, first lesson, review và return task.
5. **Định nghĩa activation/outcome baseline** và dùng telemetry opt-in hiện có để đo time-to-first-lesson, completion, Day 1/7/30 và retention 7/30 ngày.
6. **Sửa P47 browser test drift** theo semantic selector/code thay vì câu chữ, sau đó yêu cầu toàn bộ critical browser suite xanh trước release.
7. **Harden `/api/chat`** bằng Supabase JWT/session validation, distributed rate limit/quota và redacted cost/error telemetry.
8. **Xác minh staging end-to-end:** apply migrations, test RLS theo role, CAS conflict, account deletion, backup và restore drill.
9. **Giảm complexity nhìn thấy và kỹ thuật:** giữ một primary action ở hub; gom route nâng cao; dần tách interface khỏi `window.*` mà không đổi learning behavior.
10. **Đưa audio/voice về claim trung thực:** ưu tiên native licensed audio cho core lessons và không hiển thị phoneme/naturalness như kết quả chính xác khi chỉ có transcript heuristic.

## Stop Criteria

| Target | Decision | Conditions/notes |
| --- | --- | --- |
| Demo | ✅ Ready | Dùng demo data cô lập; nêu rõ content/AI/mobile limitations. |
| Portfolio | ✅ Ready | P64 docs, architecture, screenshots, tests và case study đủ mạnh. |
| Đồ án tốt nghiệp | ✅ Ready | Tốt về phạm vi kỹ thuật; bảo vệ trung thực bằng evidence và limitations, không dùng feature count làm kết quả. |
| Beta users | ⚠️ Conditional | Chỉ closed beta, content P0 được gắn nhãn/review, P47 test drift sửa, staging/auth/privacy được xác minh và có support contact. |
| Public launch | ❌ Not ready | Critical content risk, production verification và user validation chưa đạt. |
| Commercial product | ❌ Not ready | Chưa có trusted content at scale, paid API controls, retention/outcome, support/operations hoặc willingness-to-pay evidence. |

## 13. Strategic Roadmap

### 0–3 months: prove the core

- Dừng mở rộng module; tập trung Level 0 → first lesson → SRS → TOPIK 1 core loop.
- Xử lý content P0 theo human-review workflow và công khai provenance/status.
- Sửa browser regression, hoàn tất staging/RLS/API hardening tối thiểu.
- Thực hiện hai vòng usability test và thiết lập activation/outcome baseline.
- Gate cuối kỳ: người dùng mục tiêu hiểu positioning, tìm được bài đầu và hoàn thành/revisit mà không cần hướng dẫn từ developer.

### 3–6 months: validate a controlled beta

- Mở closed beta theo cohort nhỏ; đo funnel, retention và learning evidence có consent.
- Ưu tiên native audio và content depth cho phần được dùng nhiều, không phủ toàn bộ catalogue.
- Dùng support/feedback để loại hoặc ẩn route không tạo giá trị.
- Chạy backup/restore, incident, slow-network và multi-device sync drills định kỳ.
- Chỉ cân nhắc public beta khi critical content queue của core path đã đóng và không còn high-severity auth/data issue.

### 6–12 months: choose, do not accumulate

- Ra quyết định go/no-go cho public/commercial release dựa activation, Day 7/30 retention, measured learning outcomes và support load.
- Chọn một growth wedge: beginner Vietnamese, TOPIK hoặc Korean-for-life; không theo đuổi cả marketplace, school và global language cùng lúc.
- Chuyển những phần có usage thật sang architecture/service boundaries dễ bảo trì; archive hoặc giữ experimental phần không có demand.
- Mobile store, teacher/organization hoặc monetization chỉ được promote sau khi core quality, privacy, operations và demand gate đạt.

## 14. Final Recommendation

**Không thêm feature mới.** TamHoanq đã đủ rộng; ưu tiên tiếp theo là chuyển từ “feature-complete prototype” sang “trusted learning product”. Ba việc quyết định thành bại là:

1. chất lượng nội dung được người có chuyên môn xác nhận;
2. bằng chứng người Việt thật có thể bắt đầu, quay lại và tiến bộ;
3. vận hành/auth/data đủ an toàn cho beta.

Nên sử dụng sản phẩm ngay cho demo, portfolio và bảo vệ đồ án. Nên chuẩn bị một closed beta nhỏ sau khi đóng các điều kiện ghi trong Stop Criteria. Không nên public launch, bán subscription hoặc mở rộng global platform ở trạng thái hiện tại.

Giá trị dài hạn không nằm ở việc có nhiều AI agent hay nhiều route hơn đối thủ. Giá trị nằm ở việc TamHoanq có thể chứng minh một lời hứa đơn giản: **người Việt bắt đầu đúng, biết học gì tiếp và tiến bộ bằng nội dung đáng tin.**
