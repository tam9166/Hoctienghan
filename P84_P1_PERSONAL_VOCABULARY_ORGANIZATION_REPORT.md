# P84-P1 Personal Vocabulary Organization & Multi-Recall Report

Ngày hoàn thành: 2026-09-20  
Phạm vi: chỉ P84-P1; không triển khai P84-P2/P84-P3.

## 1. Existing architecture

- P82 là nguồn sự thật cho deck, word, focus session, import/export và owner scope.
- P83 chỉ tạo dữ liệu đã review vào P82; không có kho vocabulary song song.
- P84-P0 cung cấp Today Vocabulary, ưu tiên SRS, unmastered, frequently wrong và quick session.
- SRS, Mastery, Adaptive Difficulty, Error Notebook, Learning Journey và CloudSync tiếp tục dùng service hiện có.
- Deck được lưu user-scoped trong `klearn_vocabulary_collections`; P1 thêm miền user-scoped `klearn_vocabulary_organization` chỉ cho folder.
- Teacher/Creator bridge chỉ nhận nội dung nguồn cần publish; metadata cá nhân không được chuyển sang draft, assignment hoặc AI.

## 2. Folder

- Folder phẳng, đơn giản: `id`, `ownerId`, `name`, `description`, `createdAt`, `updatedAt`, `deletedAt`, `revision`.
- Dashboard My Vocabulary có thanh folder ngang, số deck trong từng folder và Uncategorized.
- Đã kiểm tra kịch bản 30 deck, move 10 deck vào TOPIK II.

## 3. Tags

- Deck và word đều hỗ trợ nhiều tag, chuẩn hóa bỏ ký tự `#`, lowercase và loại trùng.
- Có add/remove tag, bulk tag, deck tag, filter tag và search theo tag.
- Tag là metadata cá nhân; không thay đổi topic hay nội dung nguồn.

## 4. Personal notes

- Mỗi word có `personalNote`, `personalNoteUpdatedAt` và `noteConflicts` riêng với trường `note` nguồn.
- Có thể thêm/sửa trong focus session mà không rời luồng học.
- Cloud conflict giữ bản mới nhất và bảo toàn các bản khác trong `noteConflicts`; UI báo xung đột, lưu lại là xác nhận giải quyết.
- Notes không được đưa vào prompt AI.

## 5. Personal examples

- `personalExamples[]` gồm `id`, `text`, `createdAt`, `updatedAt`.
- System example vẫn ở `example`; My Example không ghi đè dữ liệu này.
- Sau câu trả lời đúng, người học có thể thêm câu riêng; dữ liệu tồn tại qua reload và CloudSync.

## 6. Search

- Global search tìm theo Korean, Vietnamese meaning, topic, tag, deck và folder.
- Kết quả phân trang 50 mục; không render toàn bộ 5.000 từ.
- Chuẩn hóa Unicode, chữ hoa/thường và whitespace.

## 7. Filters

- Có thể kết hợp folder, deck, topic, tag và status.
- Status hỗ trợ mastered, SRS due/reviewing, frequently wrong và unmastered.
- Dashboard cũng lọc deck theo folder và deck tag.

## 8. Duplicate deck

- Bắt buộc confirmation và cho đặt tên deck mới.
- Copy cấu trúc, vocabulary và metadata cá nhân; tạo word ID mới.
- Không copy SRS/mastery/session history và không thay đổi deck gốc.

## 9. Merge deck

- Có preview bắt buộc: source deck, tổng word, duplicate và output estimate.
- Ba lựa chọn: skip duplicates, merge metadata, keep duplicates.
- Fingerprint deterministic theo Korean + Vietnamese meaning.
- Merge metadata hợp nhất tag, accepted answers, accepted meanings, note conflicts và personal examples.
- SRS giữ mastery cao nhất, không mất wrong/correct/review count và dùng lịch review bảo thủ; Error Notebook tiếp tục nối bằng `wordId`.
- Source decks không bị xóa.

## 10. Split deck

- Có preview theo topic, selected word IDs hoặc số lượng.
- Deck mới giữ word ID để tiếp tục dùng cùng evidence SRS/mastery/error.
- Source deck và source words không bị xóa mặc định.
- Browser scenario đã tách 80 word chủ đề Work từ deck 500 word và xác nhận deck gốc vẫn có 500 word.

## 11. Bulk actions

- Vocabulary browser có checkbox và sticky bottom action bar thân thiện mobile.
- Hỗ trợ add tag, remove tag, add to deck, move sang deck và tạo deck từ selection.
- Move chỉ xóa khỏi source sau khi toàn bộ word đã thêm an toàn vào target; nếu có duplicate chưa xử lý thì dừng để tránh mất dữ liệu.

## 12. Multi-recall

- Mở rộng trực tiếp P82 Active Recall, không tạo learning engine mới.
- Modes: Vietnamese → Korean, Korean → Vietnamese, Listening → Korean và Mixed.
- Listening chỉ xuất hiện khi `speechSynthesis` khả dụng và tái sử dụng `speakKorean`.
- Korean → Vietnamese chuẩn hóa Unicode, hoa/thường, whitespace và `acceptedMeanings`.
- Mixed chỉ phân phối các mode khả dụng; retry giữ mode của word.
- Session history và personal vocabulary evidence ghi `mode`/`modeStats`; mastery chung vẫn do engine hiện tại quyết định.

## 13. Offline

- Folder, tags, notes, examples, deck operations, search/filter và learning chạy local-first.
- P1 CSS/JS được thêm vào route assets, service worker assets và P82 offline pack.
- Không cần API cho CRUD local.

## 14. CloudSync

- Tái sử dụng CloudSync revision, CAS, idempotent mutation và conflict retry hiện có.
- `vocabularyOrganization` là sync domain mới; vocabulary metadata tiếp tục nằm trong `vocabularyCollections`.
- Merge domain hợp nhất folder theo revision/timestamp, tag theo union, example theo ID và note theo latest + `noteConflicts`.

## 15. Privacy

- Folder, tag, note và personal example được lưu dưới user scope.
- Không auto-share, không trở thành public content, không đưa vào Teacher/Creator draft.
- Không gửi personal notes/examples/tags tới AI; P1 không gọi AI.

## 16. Security

- Mọi deck operation đi qua `P82DeckService.get/save`, kiểm tra owner hiện tại.
- Folder có `ownerId` và chỉ trả dữ liệu của current user.
- User A không thể đọc/sửa deck hoặc folder của User B qua service.
- Teacher/Admin không có đường đọc tự động personal metadata.

## 17. Performance

- Unit benchmark: 101 deck, 5.000 word, 10.000 tag assignments.
- Search/filter 5.000 word hoàn tất khoảng 493–957 ms trên môi trường test; lần xác minh cuối là 516 ms.
- UI chỉ render page hiện tại; bulk tag dùng một lần save deck thay vì save từng word.
- Production build audit: 35 direct assets / 1.18 MB và 137 lazy assets / 2.73 MB; P1 được lazy-load cùng vocabulary routes.

## 18. Accessibility

- Form có label/legend; focus-visible rõ; Korean dùng `lang="ko"`.
- Touch target tối thiểu 44 px, gồm checkbox bulk.
- Dark mode dùng design tokens hiện có; reduced-motion được hỗ trợ.
- Không horizontal overflow ở 360, 390, 430, 768, 1024, 1440 và 1920 px.

## 19. Browser tests

- `tests/p84-p1-personal-vocabulary-organization.browser.js`: PASS.
- Scenario A: 30 deck, move 10 deck vào folder.
- Scenario B/C: tag filter và note/example tồn tại qua reload.
- Scenario D: 3 source deck, 120 word, 14 duplicate, 106 output.
- Scenario E: split 80/500 và giữ source.
- Scenario F: mixed session 10, mode hợp lệ, wrong retry giữ mode.
- P84-P0, P82 và P83 responsive browser regression: PASS.

## 20. Regression

- Toàn bộ Node regression: 85/85 PASS.
- P78 native + Vercel optimization: PASS.
- P79, P80, P81, P82, P83 và P84-P0: PASS.
- P82 browser: 46 checks, 500-word import, persistence/SRS/offline/cloud conflict/AI privacy PASS.
- Production build, mobile web build và release-readiness audit: PASS.

## 21. Vercel function count

- Trước P84-P1: 7/12.
- Sau P84-P1: 7/12.
- Function impact: 0; không thêm Serverless Function.

## 22. Remaining issues

- Folder lồng nhau chưa triển khai; P1 chủ động dùng flat folder để giữ kiến trúc đơn giản.
- Dedicated visual conflict-review screen chưa có; dữ liệu conflict đã được bảo toàn và có thể resolve trong note editor.
- 500-deck benchmark riêng chưa chạy; test chính thức bao phủ 101 deck, 5.000 word và 10.000 tag assignments.
- Ngoài scope và chưa triển khai: Teacher Assignment/analytics, Weekly Report, Context Mode nâng cao, leaderboard, social, marketplace, gamification mới, AI avatar và community.
- P84-P2 và P84-P3 không được triển khai.
