# P82 PERSONAL VOCABULARY & SMART VOCABULARY FILES REPORT

## 1. Existing Vocabulary Audit

- Audit read-only được thực hiện trước khi sửa code trên Vocabulary, P79, SRS, Mastery, Active Recall, Word Life, Adaptive Engine, Error Notebook, Offline Pack, CloudSync, Auth, AI và các API Vercel.
- Hệ thống đã có `VocabularyCollectionService`/`STORAGE_KEYS.vocabularyCollections` cho collection cơ bản, P79 cho personal words, `VocabularyService` + `SRSStateService` + `MasteryService` cho tiến độ dài hạn, `ErrorNotebookService`, `AdaptiveDifficultyService`, Active Recall/Word Life, local-first storage, CloudSync và Offline Pack.
- Collection cũ chỉ lưu title, `wordIds`/`customWords`, chưa có import file, topic hierarchy, browser 5.000 từ, focus session, AI classification, per-deck analytics hoặc conflict merge chi tiết.
- Repository không có dependency XLSX phù hợp. Vì vậy P82 hỗ trợ CSV/TXT/JSON và từ chối XLS/XLSX với thông báo xuất CSV, thay vì thêm parser nặng/phức tạp.
- Quyết định: mở rộng schema collection hiện hữu lên v2, dùng cùng SRS/Mastery/Error/Adaptive và cùng `/api/chat`; không tạo vocabulary store, SRS engine, mastery engine, notebook, adaptive engine hay serverless function thứ hai.

## 2. Architecture

- `data/personal-vocabulary-system.js` là module lazy-load P82; `personal-vocabulary-system.css` chứa UI responsive. Năm route: dashboard, deck, import, classification và focus session.
- Module nối vào route loader sau P79 và AI, nên cold shell không tải P82 khi không dùng.
- P82 được mở từ Learning Directory và P79 Vocabulary Immersion; các route giữ active navigation ở Học tập.
- Client xử lý import, paging, topic, session và export. AI chỉ tái sử dụng task allowlisted `vocabulary_classification` trên `/api/chat` hiện hữu.
- Cache được nâng lên `klearn-v105`; app/route loader và các asset bị thay đổi được version hóa đồng bộ.

## 3. Data Model

- Deck v2 có `id`, `title`, `description`, `owner/userId`, `source`, `schemaVersion`, `wordIds`, `customWords`, `topics`, `imports`, `activeSession`, `sessionHistory`, `activity`, `revision`, timestamps và tombstone `deletedAt`.
- Word có Korean, Vietnamese meaning, word type, example, note, accepted answers, topic/subtopic, classification metadata, source row, timestamps và deck id.
- Progress word không bị sao chép vào deck. Status, attempts, correct/wrong, mastery, last/next review được derive từ SRS card hiện hữu.
- Deck/topic progress cũng là derived views từ word list + SRS index, tránh hai nguồn sự thật.
- Collection P79/cũ được normalize tương thích; linked word có thể được promote thành custom word khi chỉnh topic.

## 4. Deck System

- Dashboard hiển thị số deck, tổng từ, đang học, đã thuộc, cần ôn và hoạt động gần đây.
- User có thể tạo, đổi tên/mô tả, duplicate, thêm/sửa/xóa từ, import thêm, export hoặc xóa deck.
- Browser có search, filter status/topic/word type, sort và paging cố định 50 row; không render hàng nghìn DOM node.
- Dashboard import luôn tạo deck mới. Nút **Import thêm** trong deck mới import vào đúng deck hiện tại.
- Xóa deck ghi tombstone và chỉ dọn membership/session của deck; SRS global, deck khác và learner account được giữ nguyên.

## 5. Import System

- Hỗ trợ CSV có quoted fields, TXT phân cách tab/semicolon/comma, và JSON array hoặc `{ words: [] }`.
- Header aliases hỗ trợ Korean/Meaning tối thiểu cùng WordType, Topic, Subtopic, Example, Note và AcceptedAnswers khi có.
- Validate format, Hangul, trường bắt buộc, dung lượng 5 MB và tối đa 5.000 row trước khi ghi deck.
- Duplicate fingerprint là Korean + Meaning + Topic. Ba mode: Skip, Merge existing và Create duplicate.
- Import history lưu fingerprint, file name, added/merged/skipped/invalid và timestamp; import lại cùng file với Merge/Skip là idempotent theo lựa chọn.
- XLS/XLSX chưa hỗ trợ do không có dependency; đây là giới hạn được hiển thị rõ trong UI.

## 6. AI Classification

- AI chỉ chạy khi user bấm yêu cầu; không chạy khi mở deck, render, học hay trả lời quiz.
- Mỗi request tối đa 25 từ/2.800 ký tự, tối đa 60 batch cho mỗi thao tác. Suggestion đã lưu không bị gửi lại; thao tác tiếp theo có thể xử lý phần còn lại của deck rất lớn.
- Server contract giới hạn output 900 token, yêu cầu JSON array `index/topic/subtopic/confidence` và reject schema không hợp lệ.
- Confidence dưới 0,45 hoặc output không parse được sẽ vào **Chưa phân loại**; không ép category.
- AI chỉ ghi `status: suggested`. Topic chính thức chỉ thay đổi sau confirm/chỉnh sửa của user.

## 7. Topic System

- Hỗ trợ Deck → Topic → Subtopic → Word; subtopic là tùy chọn.
- Giữ Topic có sẵn trong file. File không có topic bắt đầu từ **Chưa phân loại**.
- User có thể confirm all, reject AI, chỉnh/tách từng suggestion, tạo topic thủ công, gộp topic hoặc bỏ phân loại.
- Topic card hiển thị tổng từ, mastered, learning, review, completion và danh sách subtopic.

## 8. Learning Session

- Chọn theo topic và scope: Continue, Review, Weak, Unmastered hoặc Random; count hỗ trợ 5/10/20/30 hoặc custom tối đa 100.
- Continue ưu tiên Not Started → Weak → Due Review → Learning; không chọn mastered nếu không cần.
- Session cố định `selectedWordIds` ngay khi bắt đầu; không tự thêm từ giữa phiên.
- Core quiz chỉ hiển thị nghĩa tiếng Việt và yêu cầu nhập Korean. Listening/Mixed được giữ là mode tùy chọn, không làm loãng core flow.
- Active session lưu sau mỗi answer, có Resume/Học tiếp; completed summary lưu selected, attempts, wrong attempts, rounds và topic.

## 9. Shuffle

- Fisher–Yates shuffle được dùng khi chọn session và khi sang round retry.
- Thứ tự file không được dùng làm thứ tự học.
- Test inject deterministic random để chứng minh selected order khác 10 word đầu trong file.

## 10. Korean Input

- Input được trim, collapse whitespace, loại zero-width character và normalize Unicode NFC.
- Exact match với Korean hoặc `acceptedAnswers`; không có fuzzy auto-correct.
- `학교` đúng, `학꾸` sai; test cũng xác nhận alternative hợp lệ như `무엇`/`뭐`.
- Feedback sai hiển thị input của user, đáp án đúng, audio và nút thử lại sau.

## 11. Mastery

- P82 phân biệt rõ **session mastered** (mỗi từ đã recall đúng trong phiên) và long-term Mastery hiện hữu.
- Từ sai quay lại cuối queue; round mới chỉ kết thúc khi toàn bộ selected words đã trả lời đúng.
- Mỗi attempt gọi `VocabularyService.recordRecall`, nên mastery score/status dài hạn vẫn dùng threshold và evidence của Learning Core, không dùng XP và không hard-code mastery engine thứ hai.
- UI sau phiên nhắc rõ hoàn thành phiên không đồng nghĩa mastered dài hạn.

## 12. SRS Integration

- Personal word được upsert thành SRS card hiện hữu với `deckId`, topic và source metadata.
- `recordRecall` cập nhật review/correct/wrong/streak/mastery/status/nextReview theo cùng scheduling formula của SRS review cũ.
- Per-word/deck/topic progress đọc trực tiếp từ SRS. Xóa deck không xóa SRS evidence.
- Real-browser test ép một card đến hạn, reload app và xác nhận card xuất hiện trong `VocabularyService.dueCards()`.

## 13. Error Notebook

- Mỗi answer sai ghi vào `ErrorNotebookService` hiện hữu với type, meaning prompt, user mistake, correction, explanation, `deckId`, topic, `wordId` và source P82.
- Error fingerprint được mở rộng bằng deck/word để cùng spelling error ở hai từ/deck không bị gộp nhầm.
- Adaptive service cũ nhận đúng/sai cùng lúc; không tạo notebook hay weakness store riêng.

## 14. Offline

- Deck, topic, session và progress là local-first nên xem/học/quiz/lưu được khi offline.
- P82 module/style được khai báo trong Service Worker và có nút chuẩn bị offline pack qua Cache API + `STORAGE_KEYS.offlinePacks` hiện hữu.
- AI không được quảng bá là offline. Khi mất mạng, manual topic và learning core vẫn hoạt động.

## 15. CloudSync

- `vocabularyCollections` tiếp tục là user-scoped sync domain hiện hữu.
- Merge theo deck id/timestamp, rồi merge word/topic/import/session history/activity theo item id; cap history/activity và giới hạn 100 deck như store cũ.
- Tombstone mới hơn thắng stale remote data; word list, word ids và active session không bị làm sống lại.
- `activeSession: null` từ completion mới hơn thắng stale active session, tránh bị quay lại phiên đã xong.
- Browser test xác nhận merge giữ word từ hai device, chọn metadata mới hơn, bảo toàn completion và deletion.

## 16. Privacy

- `P82AIClassificationService.available()` kiểm tra AI consent trước khi gửi vocabulary data.
- Khi AI tắt: import, manual topic, deck browser, focus session, SRS và offline vẫn hoạt động; chỉ classification bị disable.
- AI không gửi lại saved suggestions và không chạy ngầm. Prompt chỉ chứa các field cần cho phân loại.

## 17. Performance

- Browser list paging 50 item; classification batch 25 word; dashboard/summary/topic/session/export lập SRS index một lần thay vì parse/search storage cho từng word.
- Unit benchmark trên máy test: parse 5.000 word **143 ms**, import + persist 5.000 word **544 ms**; trang 100 vẫn chỉ trả 50 row.
- Real Edge import 500 word **28,2 ms** trong run cuối; 7 viewport × 4 route responsive hoàn tất không overflow.
- Production graph: 35 direct assets, 130 lazy assets, 3.738.283 referenced bytes; P82 ở lazy path.

## 18. Security

- Mọi deck operation lọc và verify `owner === currentUser.id`; test chuyển sang user khác không nhìn thấy deck.
- Không thay đổi Teacher/Admin/Creator permission, Auth, premium entitlement hoặc API authorization.
- OPENAI key vẫn server-only trong `/api/chat`; không có provider secret/client secret/service-role key trong P82 client bundle.
- AI task vẫn qua consent, rate limit, input cap, task allowlist, routing và output quality/schema validation hiện hữu.
- Destructive deck action có confirm; cloud tombstone ngăn stale resurrection mà không xóa global learning evidence.

## 19. Vercel Function Count

- Trước P82: **7 functions**.
- Sau P82: **7 functions**; tác động ròng **0**.
- Danh sách: `/api/ai/feedback`, `/api/billing`, `/api/chat`, `/api/commerce`, `/api/config`, `/api/health`, `/api/version`.
- `scripts/vercel-function-audit.js` pass **7/12** trên Vercel Hobby. P82 chỉ thêm task allowlisted vào `/api/chat`, không thêm endpoint/function.

## 20. Tests

- Full unit/static regression: **82/82 test files passed**.
- P82 unit: CRUD, CSV/TXT/JSON, XLSX-unavailable contract, 500/5.000 word, pagination, duplicate modes, AI suggestion/no-resend/manual correction, topic/subtopic, shuffle, exact Korean, retry rounds, shared SRS/Mastery/Error/Adaptive, export, offline, owner isolation và static security/integration contracts.
- P82 real-browser: **46 checks**, 500-word import, AI privacy gate, 12 AI topics, 3 manual corrections, 10-word shuffled session, 3 wrong + retry, 10/10 completion, reload persistence, due SRS, offline và CloudSync conflict/tombstone.
- Responsive pass tại **360, 390, 430, 768, 1024, 1440, 1920 px** trên dashboard, deck, import và classification; dark mode, touch target và horizontal overflow được kiểm tra.
- Browser regressions P77, P78, P79, P80 và P81 pass; P79–P82 được chạy lại sau thay đổi integrity cuối.
- JavaScript syntax pass cho **278** tracked/new JS files. Production build, release-readiness, mobile development build, native doctor và `git diff --check` pass.

## 21. Real User Flow

- Edge test tạo user local, giữ nguyên progress/SRS cũ, import file 500 word không Topic và paging 50 row.
- AI bị từ chối khi consent tắt; sau khi user bật consent, mocked provider đề xuất 12 topic và chưa thay topic trước confirm.
- User confirm, sửa 3 nhóm sang Công việc/Công ty–Nhân sự–Thương mại, chọn 10 word, và session chứng minh thứ tự đã shuffle.
- User sai 3 answer; cả 3 được ghi Error Notebook và quay lại queue. Session kết thúc sau round 2 với 10/10.
- Reload giữ deck 500 word và completed session; SRS có 10 card của deck và card due xuất hiện trong review.
- Offline navigation về deck vẫn render word table; existing progress marker và SRS card trước P82 không bị thay đổi.

## 22. Remaining Issues

- XLS/XLSX chưa hỗ trợ. User cần export CSV/TXT/JSON; chỉ nên thêm XLSX khi repository chọn một dependency được audit về kích thước và security.
- Local browser storage quota phụ thuộc trình duyệt/thiết bị. 5.000 word đã pass trong test, nhưng nhiều deck 5.000 word kèm example dài cần QA thêm về quota/eviction trên thiết bị thật.
- AI classification rất lớn được giới hạn 1.500 word cho mỗi thao tác để bảo vệ chi phí/rate. User có thể yêu cầu tiếp phần chưa có suggestion; quota server/account vẫn có thể yêu cầu chia qua nhiều lần.
- AI classification phụ thuộc consent, network, rate quota và `OPENAI_API_KEY`; manual topic và learning core là fallback đầy đủ.
- Local environment không có `PRODUCTION_URL`, Supabase production variables hoặc `MOBILE_API_BASE_URL`; canonical-domain smoke và mobile release bundle phải chạy trong CI/environment có secrets. Web production asset build và mobile development/native doctor đã pass.
- Vercel Production deployment đã success, nhưng anonymous app-level smoke trên deployment URL bị chuyển sang Vercel Deployment Protection. Deployment status và CI là xanh; nội dung app sau lớp protection cần canonical URL hoặc protection bypass token được quản lý bên ngoài repository.
- Cần QA thêm bằng bàn phím Hàn thật, screen reader thật, storage pressure và hai thiết bị CloudSync production.
- Không có phase sau P82 nào được triển khai.

## Git

- Feature commit: `fdd417a4fe89b971299be3e2c322cb2a1505f111`
- Feature message: `feat: add P82 personal vocabulary system`
- Report/deployment commit: `3a6e18a87ee46ead79b17eed5b1d03e13cb2e6ec`
- Branch: `main`
- Push: `origin/main` đã nhận feature và report commit.
- GitHub CI: **success**; Mobile native workflow: **success**.
- Vercel Production: **success**, deployment `https://hoctienghan-km6a8k8j8-tam9166s-projects.vercel.app`.
