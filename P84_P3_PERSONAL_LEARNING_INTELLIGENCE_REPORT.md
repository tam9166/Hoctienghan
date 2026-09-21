# P84-P3 Personal Learning Intelligence & Adaptive Coach Report

## 1. Audit

- Hồ sơ nền dùng `LearnerProfileService`; goal và placement dùng `currentTopikLevel`, `targetTopikLevel`, `studyMinutesPerDay` hiện có.
- Adaptive plan gọi `LearningDirectorService.plan()` và điều hướng vào P82/P84 review; không tạo Adaptive Engine mới.
- Mastery/SRS dùng các card hiện có qua `getUserSrs`, `VocabularyService` và P82 session pipeline.
- Lỗi dùng Error Notebook hiện có; practice skill dùng `PracticeService.getHistory()`; consistency dùng progress/focus/session history.
- Vocabulary Health, context, listening, typing và confusion evidence dùng P84-P2 `modeStats`.
- P84-P3 không thêm event tracking, API, database table, public profile, teacher analytics hoặc scoring engine.

## 2. Learning Profile

- Tạo Learning Profile private gồm goal, TOPIK hiện tại/đích, thời lượng học, consistency, strengths, weaknesses và các kỹ năng chưa đủ evidence.
- Profile chỉ tổng hợp source data của user hiện tại, không phải hồ sơ cá nhân công khai.
- Kỹ năng cần tối thiểu evidence trước khi có phần trăm; nếu chưa đủ, UI hiển thị empty state rõ ràng.

## 3. Learning Signals

- Vocabulary: learned, mastered, weak và forgotten words.
- Recall: Korean → Vietnamese, Vietnamese → Korean, context, listening và confusion mode.
- SRS: số từ đến hạn, số phiên hoàn thành và completion rate từ session state hiện có.
- Error: lỗi chưa giải quyết và lỗi lặp lại từ Error Notebook.
- Practice: Reading, Grammar, Speaking và Writing lấy từ skill breakdown đã lưu.
- Không ghi signal hoặc report-derived data trở lại source store.

## 4. Strength Analysis

- Kỹ năng có đủ evidence và score từ 75% được xếp vào “Bạn đang mạnh”.
- Kết quả được sắp theo score, có nhãn rõ cho Vocabulary recall, Reading, Listening, Context và Typing.
- Kỹ năng chưa đủ dữ liệu không bị gán score hoặc kết luận.

## 5. Weakness Analysis

- Kỹ năng có đủ evidence và score dưới 60% được đưa vào “Cần cải thiện”.
- Dashboard hiển thị số từ nghe sai, nhập sai và dùng sai ngữ cảnh, thay vì chỉ hiển thị số lượt lỗi.
- Mỗi weakness có “Luyện ngay”; Vocabulary/Typing/Listening/Context vào P84-P2 Smart Review, các skill khác vào hub hiện có.

## 6. Learning Health Dashboard

- Hiển thị Vocabulary, Recall và Consistency dưới dạng progress bar nhẹ nhàng.
- Có SRS due count và session completion rate.
- UI nói rõ đây là chỉ số định hướng, không phải xếp hạng; gián đoạn không bị phạt.
- User mới thấy “Tiếp tục học để mở khóa phân tích.” thay vì score giả.

## 7. Weekly Report

- Tổng hợp 7 ngày: learning days, words studied/reviewed, mastered, review attempts, practice attempts và vocabulary growth.
- Hiển thị chủ đề mạnh/yếu theo mastery hiện có và các từ có evidence đang cải thiện.
- Report được tính từ SRS, P82/P84 session history, practice history và focus activity.

## 8. Monthly Report

- Dùng cùng contract với cửa sổ 30 ngày.
- Có toggle Week/Month, empty state khi không có activity và nguồn dữ liệu được công khai trong UI.
- Không có leaderboard, so sánh xã hội hoặc public report.

## 9. Adaptive Plan

- Kế hoạch 5 phút: 5 weak/due words.
- Kế hoạch 10 phút: SRS + frequently wrong.
- Kế hoạch 20 phút: thêm Context.
- Kế hoạch 30 phút: thêm Listening khi audio có sẵn và 5 từ mới.
- Plan gọi Learning Director hiện có để giữ integration với goal/history và chạy bài qua P82/P84 services.
- Khi audio không có, Listening tự bị loại; các phần còn lại vẫn hoạt động.

## 10. Goal Tracking

- Hiển thị TOPIK hiện tại → TOPIK mục tiêu và vocabulary evidence hiện tại.
- Target vocabulary là mốc định hướng nội bộ theo level; UI ghi rõ đây không phải dự đoán ngày đạt TOPIK.
- Không tạo forecast chắc chắn hoặc cam kết outcome.

## 11. Recovery

- Return Experience bật khi activity gần nhất cách ít nhất 14 ngày; kịch bản 30 ngày đã được test.
- Nội dung trung tính: “Chào mừng quay lại”, due count và 10 phút phục hồi; không dùng ngôn ngữ phạt.
- Recovery Mode 3 ngày: mastered/familiar words, weak words, rồi Context review.
- Ngày 1 chọn cụ thể card mastered trong deck; không đổi thành weak ranking.
- Không reset SRS, mastery, wrong count, notes, examples, tags hoặc progress cũ.

## 12. Privacy

- Profile có nhãn private và chỉ đọc user-scoped stores.
- Không có share, ranking, public endpoint, teacher/admin surface hay cross-user aggregation.
- Test owner isolation xác nhận user không có source data không nhìn thấy signal của user khác.

## 13. Offline

- Profile, report, health, goal, recommendation và recovery đều tính client-side.
- CSS/JS P84-P3 được thêm vào Service Worker asset list và P82 offline pack.
- Browser test bật network offline và xác nhận plan/report tiếp tục hoạt động.

## 14. CloudSync

- Source learning state tiếp tục sync qua các domain sẵn có: SRS, progress, vocabulary collections/organization và practice history.
- P84-P3 không tạo storage key hay CloudSync schedule mới.
- Weekly/monthly report và profile là derived data, được tính lại từ source và không sync.

## 15. Security

- Không thêm API hoặc server secret.
- Nội dung động được escape; route/action dùng allowlist và existing service boundary.
- Logic AI không được gọi; AI disabled vẫn có đầy đủ chức năng cốt lõi.
- Không lưu hoặc gửi private weakness/error history ra ngoài user scope.

## 16. Performance

- Derived results dùng memory cache theo chữ ký user/source data và khung giờ; cache bị invalid khi SRS, deck, practice, error hoặc progress thay đổi.
- Không persist/report snapshot trùng lặp và không gọi AI/network khi mở dashboard.
- Benchmark unit với 5.000 active cards: Learning Profile khoảng 115–120 ms trên máy test, dưới budget 2 giây.

## 17. Tests

- P84-P3 unit pass: new-user empty state, 30-day weekly/monthly report, strengths, weaknesses/actions, Learning Health, SRS signals, 5/30-minute plan, goal, recovery, AI disabled, offline/private/derived-sync contract và 5.000-card performance.
- Browser P84-P3 pass tại 360, 390, 430, 768, 1024, 1440 và 1920 px; không horizontal overflow; touch controls đạt tối thiểu 40 px trong browser QA và CSS đặt min-height 44 px.
- Real-user scenarios pass: 3-month learner profile, 30-day return recovery, TOPIK goal và 5-minute short session.
- Full Node suite: **87 passed, 0 failed**.
- Syntax check, production build contract và release-readiness contract đều pass.

## 18. Regression

- Unit regression pass cho P78, P79, P80, P81, P82, P83, P84-P0, P84-P1 và P84-P2 trong full suite.
- Browser regression pass cho P78, P79, P80, P81, P82, P83, P84-P0, P84-P1 và P84-P2.
- P83 có một lần chạy lỗi do local HTTP server kết thúc giữa batch; rerun với server mới pass toàn bộ source/reprocess/import checks. Đây không phải code regression.
- P84-P0 daily action, P84-P1 organization/multi-recall và P84-P2 mastery/context/confusion vẫn giữ nguyên hành vi.

## 19. Vercel Count

- Vercel Hobby Functions: **7/12**.
- P84-P3 thêm **0** function; toàn bộ calculation chạy local.
- Functions hiện tại: `api/ai/feedback.js`, `api/billing.js`, `api/chat.js`, `api/commerce.js`, `api/config.js`, `api/health.js`, `api/version.js`.

## 20. Remaining Issues

- TOPIK vocabulary targets là heuristic định hướng, không phải chuẩn chứng nhận hoặc score predictor.
- Source hiện tại không lưu per-word wrong snapshots theo từng tuần/tháng, nên “từ đang cải thiện” dùng evidence tích lũy thay vì hiển thị delta chính xác kiểu 5 sai → 1 sai.
- Recovery tự bật từ 14 ngày để hỗ trợ quay lại sớm; 30 ngày vẫn dùng cùng flow.
- Cache là memory cache theo source signature; reload sẽ tính lại. Không persist derived cache để giữ privacy và tránh CloudSync dữ liệu có thể tái tạo.
- P84-P4 hoặc phase tiếp theo không được triển khai.
