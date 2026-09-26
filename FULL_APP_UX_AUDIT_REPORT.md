# FULL APP UX AUDIT

Ngày kiểm thử: 27/09/2026
Repository: `tam9166/Hoctienghan`
Môi trường: local app tại `http://127.0.0.1:4173/`, trình duyệt Codex In-app Browser, dữ liệu `Bản demo`.

## Phạm vi và cách kiểm thử

Audit được thực hiện bằng thao tác UI thật, không đọc source trước khi đi qua các flow chính. Đã quan sát first impression, đăng ký, Home, Học tập, Vocabulary, SRS, mini test, Error Notebook, TOPIK, kết quả, Adaptive Assistant, Learning Plan, lesson, profile, achievement và Offline Pack. Đã dùng các viewport 320×800, 360×800, 390×844, 430×932, 768×1024, 1024×768, 1440×900 và 1920×1080 để đo overflow của Home; kiểm tra trực tiếp sâu hơn ở mobile và desktop mặc định.

Không tạo tài khoản cloud hay gửi dữ liệu ra ngoài. Nút tạo tài khoản không được submit vì đó là side effect tạo account. Multi-device conflict và network failure không thể tái hiện đầy đủ trong một tài khoản demo duy nhất; các kết luận này được đánh dấu rõ là chưa xác minh live.

## 1. First Impression

**ISSUE**

Landing page nói rõ giá trị: “Tiếng Hàn được thiết kế dành riêng cho người Việt”, “biết rõ hôm nay học gì”, và có CTA “Bắt đầu học”. Đây là điểm tốt. Tuy nhiên CTA dẫn ngay tới màn hình tạo tài khoản với 4 trường Họ tên, Email, Mật khẩu, Xác nhận mật khẩu; người mới chưa được thấy một bài học mẫu trước khi phải đăng ký. “Xem bản demo” có tồn tại nhưng nằm sau lựa chọn đăng nhập/đăng ký.

Người dùng mới hiểu app dùng để học tiếng Hàn, nhưng chưa chắc biết mình sẽ bắt đầu bài nào trước khi qua registration.

## 2. New User Journey

**ISSUE**

Persona A đi theo `Mở app → Bắt đầu học` gặp màn hình đăng ký, không có skip/guest lesson. Copy “Chúng tôi tìm thấy tiến trình học trước đây” và “0 ký tự · 0 từ · 0 bài đã học vẫn được giữ nguyên” không tự nhiên với người hoàn toàn mới; họ có thể không hiểu đang tiếp tục tài khoản nào.

Onboarding goal, current level, TOPIK target, thời gian/ngày và skill ưu tiên chưa được kiểm tra live vì bước tạo tài khoản chưa được submit. Đây là blocker cho việc đánh giá trọn vẹn onboarding, không phải bằng chứng rằng các trường đó không tồn tại.

## 3. Vocabulary

**PASS WITH ISSUE**

Kho chủ đề có mô tả, số từ và tiến độ. Mở một từ cho thấy Korean trước, audio thường/chậm, phiên âm tùy chọn, ví dụ Korean và toggle nghĩa Việt. Nút “Đã học bước đầu · đưa vào SRS” làm kết quả sau học khá rõ.

Vấn đề: trang review dùng `SRS CÁ NHÂN`, “đến hạn”, “cần củng cố”, 7 nhóm lọc và 4 mode nhưng không giải thích ngắn cho beginner. Trên chi tiết từ, nghĩa Việt đang hiển thị sẵn nên người muốn luyện nghe nhìn thấy đáp án quá sớm. Một số nhãn `usage mastered`, `Topic progress`, `Level 0/5`, `Seen/Recognized` còn tiếng Anh.

## 4. Listening

**PASS WITH ISSUE**

Korean là visual focus: `안녕하세요`, nút “Bình thường”, “Nghe chậm”, phiên âm trong disclosure và ví dụ Korean xuất hiện trước nghĩa Việt. Có toggle “Ẩn nghĩa tiếng Việt”.

Issue UX-006: trạng thái ban đầu vẫn hiện nghĩa Việt. Với người chọn “luyện nghe”, app nên mặc định ẩn nghĩa hoặc hỏi preference một lần; hiện tại người học phải chủ động ẩn sau khi đáp án đã lộ.

## 5. Lessons

**PASS**

Flow `Khóa học → Tiếng Hàn sơ cấp → Bài 05 · Thời gian → Vào bài học` có progress `1 / 8`, tên phần, mục tiêu và nút `Tiếp theo →`. Mini test bị khóa tới khi trả lời đủ 5 câu, điều kiện này được hiển thị rõ.

Sau khi nộp đúng 5/5, app hiển thị 100/100, trạng thái “Sẵn sàng lưu”; sau `Lưu tiến độ`, có status “Đã lưu tiến độ bài học” và mở tiếp Bài 06. Đây là feedback và next action tốt.

## 6. Mini Test

**PASS WITH ISSUE**

Câu hỏi, lựa chọn, audio thường/chậm, chấm đúng/sai và giải thích đều dễ hiểu. Khi trả lời sai trong SRS, app hiện câu trả lời của user, đáp án đúng và ví dụ.

Issue UX-007: sau câu sai, hành động chính chỉ là `Câu tiếp theo`; không có CTA ngay tại feedback để `Lưu Sổ lỗi`, `Ôn lại SRS` hoặc mở giải thích grammar. Người dùng phải tự nhớ đường đi sang chức năng khác.

## 7. Error Notebook

**PASS WITH ISSUE**

Sổ lỗi có loại lỗi, số lần mắc, đáp án đúng, giải thích, cảnh báo `Repeated mistake` và nút `LUYỆN LẠI`. Đây là một trong các flow rõ nhất.

Issue UX-008: `Lần cuối: 2026-09-26T17:08:57.062Z` là timestamp kỹ thuật, không phù hợp người học. Nguồn bài/câu hỏi chưa được liên kết thành một đường dẫn có thể mở lại. `grammar`, `vocabulary`, `Strategy`, `Careless Mistake` trộn ngôn ngữ.

## 8. SRS

**PASS WITH ISSUE**

Màn hình hiển thị 5 từ đến hạn, ưu tiên, bộ lọc nhóm/chủ đề/số từ và các mode Trắc nghiệm, Nhập đáp án, Nghe và chọn, Ghép cặp. `Bắt đầu ôn` hoạt động; tiến độ `1/5` và feedback đúng/sai rõ.

Issue UX-009: với beginner, “SRS CÁ NHÂN”, “đến hạn” và “ưu tiên vì hay sai hoặc sắp quên” chưa giải thích vì sao cần ôn. Hai metric `5 từ đến hạn` và `5 ưu tiên` dễ bị hiểu là hai nhóm khác nhau dù có thể trùng. Empty state live chưa được kiểm tra vì demo có sẵn dữ liệu.

## 9. TOPIK

**PASS WITH ISSUE**

TOPIK module có Kho đề, Thi thử, Luyện theo dạng, Kết quả; Full Test có timer, đánh dấu câu, điều hướng 1–20, trước/sau, nộp bài và tự nộp. Cảnh báo đề là câu tự biên soạn và điểm chỉ là luyện tập xuất hiện rõ.

Kết quả có tổng điểm, Listening/Reading, weakness, error type, danh sách câu, `Lịch sử & AI Report`, `Tạo đề cải thiện`, `Mở Sổ lỗi`.

Issue UX-010: kết quả hiển thị `19 sai · 19 bỏ trống` sau khi chỉ trả lời một câu; người mới dễ hiểu rằng hai con số là hai nhóm lỗi độc lập. Kết quả không hiển thị thời gian đã dùng dù đây là tín hiệu quan trọng khi luyện đề. `Original questions`, `REAL EXAM MODE`, `SMART GENERATOR`, `SCORE PREDICTION`, `Main Idea`, `Strategy`, `Careless Mistake` còn tiếng Anh.

## 10. Adaptive Assistant

**ISSUE**

Assistant đọc được mục tiêu TOPIK, từ hay quên, lỗi và kỹ năng yếu. Phần “Hôm nay nên học gì?” cho thấy `Ôn 5 mục SRS` và `Luyện writing`.

Issue UX-011: các recommendation này là generic text, không phải CTA trực tiếp. Nút gần đó là `Giải thích gợi ý` và `Luyện hội thoại`, không có `Ôn SRS ngay` hoặc `Luyện viết ngay` tương ứng. Người dùng biết lý do nhưng vẫn phải tự tìm route.

Issue UX-012: cùng một màn hình learner-facing hiển thị `AI QUALITY & COST`, request, token, latency, cache public và P68. Đây là thông tin vận hành, làm tăng tải nhận thức và che khuất quyết định học tập.

## 11. Dashboard

**ISSUE**

Home đã trả lời “Hôm nay học gì?” bằng Today Plan 20 phút, task và nút `BẮT ĐẦU HỌC HÔM NAY`. Summary có từ đã học, cần ôn, lỗi và bước tiếp theo.

Issue UX-003: ở viewport 360×800, CTA chính nằm khoảng y=881, ngoài màn hình đầu tiên; người dùng thấy danh sách task nhưng chưa thấy nút bắt đầu. Nút nổi `Hỏi bài` phủ lên vùng Today Plan ở screenshot mobile, có thể che text/task.

Issue UX-013: Home có ba nhóm chức năng, nhiều route và thêm một card Học nhanh 5 phút. Grouping tốt hơn trước nhưng vẫn có duplicate entry giữa Home, Học tập và Profile.

## 12. Progress

**ISSUE — MAJOR**

Từ Home bấm `Tiến độ học`, URL chuyển sang `#learning-progress` nhưng giao diện vẫn là Home. Console ghi:

`RangeError: Invalid time value at data/beginner-learning-assistant.js:110 ... learningProgressView ... setView`

Đây là lỗi user-visible: người dùng bấm đúng nút nhưng không nhận được trang tiến độ và không có error state.

Issue UX-001: route Progress phải chặn ngày/giá trị không hợp lệ, hiển thị fallback và giữ next action thay vì để render thất bại im lặng.

Ngoài lỗi route, profile hiển thị các % kỹ năng nhưng không nói đó là accuracy, mastery hay estimated level.

## 13. Learning Plan

**PASS WITH ISSUE**

`Kế hoạch học` mở được, có tổng thời lượng, 4 task, nút `Mở`, `BẮT ĐẦU HỌC HÔM NAY`, điểm yếu, readiness và roadmap 6 chặng. Đây là flow có cấu trúc tốt.

Issue UX-014: cùng màn hình trộn `local-first`, `TOPIK Readiness`, `Adaptive`, `roadmap`, `skill priority` và nhiều combobox. Beginner cần một lớp giải thích ngắn hơn; hiện tại người dùng phải hiểu quá nhiều thuật ngữ để chỉnh kế hoạch.

## 14. Mobile UX

**ISSUE**

Đã đo Home ở đủ 8 kích thước yêu cầu: không có horizontal overflow. CTA và touch target chính có chiều cao khoảng 48–53px.

Tuy nhiên ở 360px, Home dài khoảng 3.115px; Today Plan CTA nằm dưới fold. Header brand bị ellipsis và các nút icon rộng khoảng 40px, dưới mốc 44px thường dùng cho touch target. FAB `Hỏi bài` chồng lên nội dung ở mobile screenshot. Đây là friction thực tế dù layout không overflow.

## 15. Offline

**PASS WITH ISSUE**

Màn hình `Gói học ngoại tuyến` giải thích chỉ pack đã tải mới được cam kết dùng khi mất mạng. Tải Beginner Pack chuyển từ `Chưa tải` sang `Đã tải`, hiển thị thời điểm tải và status `Đã tải gói ngoại tuyến.`

Issue UX-015: `Vocabulary Pack · 0 lessons` khiến người dùng không biết pack này có học được gì hay chỉ là metadata. Nên hiển thị số từ/chủ đề thay cho `0 lessons` hoặc giải thích loại nội dung.

Offline lesson/SRS/Error Notebook và sync conflict chưa được tắt mạng live trong audit này; regression automated trước đó đã có coverage nhưng không thay thế kiểm thử quan sát trực tiếp.

## 16. Multi-device

**PARTIAL / ISSUE**

Profile nói rõ local-first, đồng bộ và đổi thiết bị; copy cho biết tiến trình được bảo vệ. Tuy nhiên audit không đăng nhập cloud, không tạo tài khoản và không mở hai session người dùng thật, nên chưa thể xác nhận merge/conflict UX. Cần một test riêng với Device A/Device B và một conflict có thể nhìn thấy; đặc biệt phải kiểm tra rằng app không silently overwrite.

## 17. Empty States

**ISSUE / PARTIAL**

Các màn hình có dữ liệu đều có next action. Nhưng live demo không thể đưa về trạng thái zero-data mà không xóa/đổi storage hoặc tạo account mới, nên empty Vocabulary, empty SRS, empty Error Notebook, empty TOPIK history và empty Achievement chưa được xác minh bằng UI thật trong phiên này.

Unit/browser regression trước đó có coverage cho new-user vocabulary onboarding và empty state; kết quả đó được xem là test contract, không phải bằng chứng visual live cho mọi màn hình.

## 18. Error States

**ISSUE — MAJOR**

Loading state của lazy TOPIK và Assistant hiển thị `Đang mở chức năng…`, không để màn hình trắng. Lesson có success status sau lưu.

Issue UX-010: khi localStorage không thể ghi SRS, console lặp `QuotaExceededError: Setting the value of 'klearn_srs' exceeded the quota` qua nhiều route. UI không báo “chưa lưu”, không cho người dùng biết cần giải phóng dung lượng/xóa pack/chờ sync, và không có retry/recovery. Đây là rủi ro mất dữ liệu học tập.

Network failure, audio unavailable và Supabase unavailable chưa được mô phỏng live; không kết luận PASS chỉ dựa trên code/test contract.

## 19. Navigation

**ISSUE**

Bottom navigation có Trang chủ, Học tập, Luyện tập, Trợ lý, Hồ sơ; TOPIK được mở từ nhóm Home hoặc route chuyên biệt. Back link trên các màn hình chính tương đối nhất quán.

Issue UX-016: Progress route hỏng nhưng không báo lỗi. TOPIK/SRS/Error Notebook không nằm trong bottom nav mà phải được discover qua Home hoặc Học tập; với người mới đây là discoverability cost. `Cài đặt học tập`, Offline và Timeline nằm sâu trong Profile.

## 20. Consistency

**ISSUE**

Có nhiều cặp thuật ngữ cho cùng hành động: `Ôn tập`/`Luyện tập`, `Bắt đầu`/`Học ngay`/`Tiếp tục`, `Sổ lỗi`/`Error Notebook`, `Từ đã học`/`mastered`, `TOPIK readiness`/`score prediction`. Một số màn hình tiếng Việt rõ, nhưng các nhãn vận hành và mastery vẫn tiếng Anh.

Profile có dữ liệu không nhất quán về thời lượng: phần Learner Profile hiển thị `20 phút/tuần`, trong khi mục tiêu cá nhân hiển thị `20 phút/ngày`. Với người dùng, không rõ con số nào là nguồn sự thật.

## Persona matrix

| Persona | Kết quả | Bằng chứng | Mức friction |
|---|---|---|---|
| A · Người mới hoàn toàn | Chưa đi thẳng vào bài học; gặp registration 4 trường | `Bắt đầu học → Đăng ký` | P1 |
| B · Sơ cấp có SRS | SRS, topic, lesson và mini test dùng được | Demo: 5 từ đến hạn, 4 mode review, lesson 1/8 | P2 do jargon/filter |
| C · Hướng TOPIK | Full Test, timer, mark, submit, result, tạo đề cải thiện hoạt động | TOPIK I 20 câu, 100 phút, result 10/200 | P2 do nhãn/time/blank counting |
| D · Học không đều | Có logic recovery 3 ngày/7 ngày trong adaptive contract; chưa time-travel live | Engine có `light` và `welcome-back`; chưa visual live | Chưa xác minh đầy đủ |
| E · Nhiều thiết bị | UI có local-first/sync và profile signal; conflict chưa chạy live | Profile/Offline copy; chưa đăng nhập cloud | Chưa xác minh |

## Journey clarity matrix

| Bước | Đang ở đâu? | Đang làm gì? | Next action | Kết quả/ghi nhớ | Đánh giá |
|---|---|---|---|---|---|
| Open app | Welcome | Chọn bắt đầu/demo | Bắt đầu học hoặc demo | Chưa có lesson ngay | UNCLEAR |
| Home | Today Plan | Xem task theo dữ liệu | Start today | Session/task | CLEAR, nhưng CTA dưới fold trên mobile |
| Vocabulary | Topic/word | Nghe và luyện | Chọn skill hoặc đưa vào SRS | Mastery/SRS | CLEAR WITH JARGON |
| SRS | Review queue | Trả lời card | Câu tiếp theo | SRS evidence | CLEAR |
| Lesson | Step 1/8 | Học từng phần | Next | Score + save | CLEAR |
| Mini test | 5 câu | Chọn đáp án | Submit | Explanation | CLEAR, thiếu Error/SRS CTA |
| Error Notebook | Sổ lỗi | Xem pattern | Luyện lại | Repetition evidence | CLEAR |
| TOPIK | Exam mode | Làm đề có timer | Submit/result | History/weakness | CLEAR WITH RESULT COPY ISSUE |
| Result | Chữa đề | Đọc score/weakness | Create improved test | Recommendation | CLEAR |
| Progress | `#learning-progress` | Muốn xem biểu đồ | Không có trang hiển thị | Không nhận được result | BLOCKER |
| Learning Plan | Roadmap | Chọn thời lượng/goal | Start today | Daily tasks | CLEAR WITH LOAD |
| Profile | Hồ sơ + nhiều ecosystem | Chỉnh preference/sync | Nhiều hướng cùng lúc | Không có một primary action | UNCLEAR |
| Offline | Pack list | Tải pack | Xóa pack/học offline | Status downloaded | CLEAR |

## UX FRICTION AUDIT

- Học 5 phút: từ Home cần scroll tới card `Học nhanh 5 phút`; Today Plan CTA không phải quick start trên first viewport mobile.
- Sửa một lỗi sau mini test: feedback không có nút trực tiếp sang Error Notebook/SRS.
- Tìm Progress: nút có mặt nhưng route render lỗi, người dùng không biết vì sao.
- Tìm TOPIK: phải đi qua Home group hoặc route, không nằm ổn định trong bottom nav.
- Tìm Offline: nằm sâu trong Profile/Insights.
- Profile: quá nhiều ecosystem blocks trước khi tới thông tin account và setting thật.

## COGNITIVE LOAD AUDIT

Mức tải cao nhất nằm ở Home mobile, Học tập, Adaptive Assistant và Profile. Các nguyên nhân lặp lại: nhiều card cùng cấp, duplicate route, English operational labels, metric không có định nghĩa, và hai lớp navigation (bottom nav + Home directory + Profile ecosystem). Đề xuất ở mức audit, chưa triển khai:

1. Giữ một CTA chính duy nhất trong first viewport: `Bắt đầu phiên hôm nay`.
2. Đưa SRS/Error/TOPIK vào một nhóm `Ôn & thi`, mỗi mục có một dòng lợi ích.
3. Tách learner UI khỏi AI quality/cost/operator telemetry.
4. Chuẩn hóa `Học ngay`, `Ôn lại`, `Tiếp tục`, `Luyện lại` theo intent.
5. Hiển thị định nghĩa ngắn cho mọi %: `độ chính xác`, `từ đang học`, `ước tính luyện tập`.

## Feature discoverability / “Why should I care?”

- SRS: hiện có số đến hạn nhưng chưa có câu “Ôn đúng lúc để nhớ lâu hơn”.
- Error Notebook: lợi ích thể hiện qua lỗi lặp và `LUYỆN LẠI`, tương đối tốt.
- TOPIK: mục tiêu rõ, nhưng các nhãn tiếng Anh làm giảm khả năng hiểu của beginner.
- Progress: có ý nghĩa nhưng đang bị blocker route.
- Achievement: có cột mốc thật, nhưng `mastered` chưa dịch.
- Learning Plan: có lý do theo evidence, nhưng quá nhiều thuật ngữ cùng lúc.

## ISSUE LIST

### UX-001

Screen: Progress
Severity: P1 — MAJOR UX / FUNCTIONAL BLOCKER
Problem: `#learning-progress` đổi URL nhưng Home vẫn hiển thị.
User impact: Không xem được biểu đồ/tiến độ sau khi bấm đúng CTA.
Evidence: UI vẫn là Home; console `RangeError: Invalid time value ... learningProgressView ... beginner-learning-assistant.js:110`.
Suggested solution: Validate ngày trước `Intl.DateTimeFormat`, bỏ record lỗi hoặc dùng fallback `—`; thêm visible error/retry.

### UX-002

Screen: Welcome → Registration
Severity: P1
Problem: Người mới phải điền 4 trường trước khi thấy lesson; không có guest/preview rõ ràng.
User impact: Drop-off trước activation.
Evidence: `Bắt đầu học` mở `Đăng ký`; `Họ tên`, `Email`, `Mật khẩu`, `Xác nhận mật khẩu`; không submit trong audit.
Suggested solution: Cho một lesson thử không tài khoản hoặc rút gọn registration; thêm step indicator và giải thích vì sao cần account.

### UX-003

Screen: Home mobile 320–360px
Severity: P1
Problem: CTA Today Plan nằm dưới fold; FAB `Hỏi bài` phủ nội dung.
User impact: Người mới thấy task nhưng chưa thấy cách bắt đầu.
Evidence: ở 360×800, `BẮT ĐẦU HỌC HÔM NAY` top ≈881px; screenshot cho thấy FAB nằm trên Today Plan.
Suggested solution: Đưa CTA vào header sticky của plan hoặc lên first viewport; reposition FAB ngoài vùng task.

### UX-004

Screen: Học tập / Adaptive / Profile
Severity: P1
Problem: Quá nhiều card và ecosystem blocks cùng cấp; Profile rất dài, có nhiều phần trùng.
User impact: Không biết đâu là hành động chính.
Evidence: Học tập có hơn 20 destination; Profile chứa Learner Profile, ecosystem, mobile, privacy, account, TOPIK, history trong một trang.
Suggested solution: Progressive disclosure, 3 nhóm chính, đưa setting/advanced tools vào subpage.

### UX-005

Screen: Toàn app
Severity: P2
Problem: Thuật ngữ tiếng Anh và technical jargon không nhất quán.
User impact: Beginner không hiểu `SRS`, `mastered`, `Original questions`, `Score Prediction`, `Strategy`.
Evidence: xuất hiện trực tiếp trong DOM snapshot của SRS, Vocabulary, TOPIK, Profile.
Suggested solution: Dùng tiếng Việt + helper text ngắn; giữ TOPIK/Hangul, giải thích SRS lần đầu.

### UX-006

Screen: Vocabulary word detail
Severity: P2
Problem: Nghĩa Việt hiển thị sẵn trong flow luyện nghe.
User impact: Đáp án lộ trước khi nghe/nhớ.
Evidence: `🇻🇳 TIẾNG VIỆT · Xin chào` xuất hiện ngay; nút ẩn nghĩa là thao tác bổ sung.
Suggested solution: Mặc định ẩn nghĩa ở listening mode; lưu preference.

### UX-007

Screen: Mini test / SRS feedback
Severity: P2
Problem: Feedback sai không có đường tắt sang Error Notebook/SRS/Grammar.
User impact: Người học biết sai nhưng phải tự tìm cách sửa.
Evidence: chỉ có `Câu tiếp theo` sau câu sai.
Suggested solution: thêm `Lưu sổ lỗi`, `Ôn lại từ`, `Xem ngữ pháp` theo loại lỗi.

### UX-008

Screen: Error Notebook
Severity: P2
Problem: Timestamp kỹ thuật và source chưa mở lại được; loại lỗi trộn English/Vietnamese.
User impact: Khó nhớ lỗi xảy ra ở đâu và cách sửa lại.
Evidence: `Lần cuối: 2026-09-26T17:08:57.062Z`; `grammar`, `Repeated mistake`.
Suggested solution: format ngày giờ tiếng Việt, thêm `Mở câu gốc`, chuẩn hóa nhãn.

### UX-009

Screen: SRS
Severity: P2
Problem: “đến hạn”/“ưu tiên” và SRS chưa có giải thích beginner.
User impact: Người mới không hiểu vì sao cần ôn hôm nay.
Evidence: 5 due và 5 priority hiển thị cạnh nhau.
Suggested solution: helper text “Ôn đúng lúc để nhớ lâu hơn”; chỉ hiển thị một primary queue.

### UX-010

Screen: Result / Error states / persistence
Severity: P1
Problem: SRS write vượt quota, chỉ log console, không có UI recovery.
User impact: Có thể mất tiến độ hoặc tưởng đã lưu.
Evidence: lặp `QuotaExceededError: Setting the value of 'klearn_srs' exceeded the quota` qua app routes; không có toast/error card tương ứng.
Suggested solution: bắt lỗi storage, hiện trạng thái `Chưa lưu`, retry/export/giải phóng dung lượng; không ghi đè âm thầm.

### UX-011

Screen: Adaptive Assistant
Severity: P2
Problem: Recommendation không có action tương ứng.
User impact: Biết điểm yếu nhưng phải tự đi tìm màn hình luyện.
Evidence: `Ôn 5 mục SRS`, `Luyện writing` là generic text; CTA chỉ `Giải thích gợi ý`, `Luyện hội thoại`.
Suggested solution: mỗi recommendation có một CTA trực tiếp và lý do một câu.

### UX-012

Screen: Adaptive Assistant
Severity: P2
Problem: AI cost/latency/operator telemetry hiển thị cho learner.
User impact: Tăng cognitive load, không giúp quyết định học.
Evidence: `AI QUALITY & COST`, Request hôm nay, Token 30 ngày, Latency, Cache public.
Suggested solution: chuyển sang admin/developer diagnostics.

### UX-013

Screen: Home / Học tập / Profile
Severity: P2
Problem: Duplicate destination và TOPIK/Offline bị giấu theo context.
User impact: Feature discoverability thấp.
Evidence: Vocabulary xuất hiện ở Home, Học tập, Profile; TOPIK chủ yếu qua Home group; Offline nằm trong Profile.
Suggested solution: một navigation map cố định, contextual CTA từ Today Plan.

### UX-014

Screen: Learning Plan
Severity: P2
Problem: Một màn hình vừa là daily plan, goal form, readiness, roadmap và adaptive explanation.
User impact: Người mới không biết chỉnh phần nào trước.
Evidence: nhiều combobox và 6 roadmap stages trên cùng trang.
Suggested solution: chia `Hôm nay`, `Mục tiêu`, `Lộ trình`; giữ một CTA chính.

### UX-015

Screen: Offline Pack
Severity: P2
Problem: Vocabulary Pack hiển thị `0 lessons`.
User impact: Không biết pack có nội dung hay tải nhầm.
Evidence: card `Vocabulary Pack · ~36 KB · 0 lessons · v1`.
Suggested solution: hiển thị `số từ/chủ đề`, hoặc giải thích pack không chứa lesson.

### UX-016

Screen: Navigation
Severity: P2
Problem: Progress không có visible failure; TOPIK/SRS/Error/Offline không có điểm vào cố định ở bottom nav.
User impact: Người dùng có thể tưởng app không có tính năng hoặc bấm rồi không có gì xảy ra.
Evidence: Progress URL đổi nhưng Home giữ nguyên; bottom nav chỉ 5 mục learner-facing.
Suggested solution: route health fallback + một `Thư viện học`/`Ôn & thi` ổn định.

## Severity summary

- Critical issues (P0): **0 quan sát được**.
- Major issues (P1): **5** — UX-001, UX-002, UX-003, UX-004, UX-010.
- Moderate issues (P2): **11** — UX-005 đến UX-009, UX-011 đến UX-016.
- Minor issues (P3): **0 tách riêng**; các copy nhỏ đã gộp vào P2 consistency.

## Regression / no-change boundary

Lần audit này **không sửa code, không sửa database/migration, không tạo tài khoản, không commit và không push**. Có dùng thao tác demo để tạo một vài dữ liệu local phục vụ quan sát; không gửi dữ liệu ra Supabase. Báo cáo này là artifact duy nhất được tạo.

## Kết luận

App có nền tảng học tập giàu chức năng và các flow Lesson, SRS, Error Notebook, TOPIK và Offline Pack nhìn chung có feedback tốt. Tuy nhiên chưa thể kết luận “người Việt mới luôn biết bước tiếp theo” vì ba điểm lớn: registration gate trước activation, Home mobile đẩy CTA xuống dưới fold, và Progress route hỏng âm thầm. Rủi ro nghiêm trọng nhất về dữ liệu là `QuotaExceededError` khi ghi SRS mà không có thông báo phục hồi.

Theo yêu cầu, **dừng tại audit**. Chưa triển khai bất kỳ đề xuất sửa nào; chỉ bắt đầu sửa sau khi người dùng xác nhận rõ “OK, hãy sửa”.
