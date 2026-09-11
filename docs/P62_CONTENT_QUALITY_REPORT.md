# P62 CONTENT QUALITY REPORT

Ngày audit: 2026-09-11

Phạm vi: content tĩnh và content runtime đang được app tải từ `data/`, `content/` và các quality-governance migration.

Phương pháp: audit cấu trúc chỉ đọc bằng `node scripts/audit-content-quality.js --details`, đối chiếu source code, migration và browser test. Không có nghĩa từ, TOPIK level, ví dụ hay đáp án nào được tự động sửa.

> Lưu ý: `VALID` trong báo cáo chỉ có nghĩa là mục đó có đủ bằng chứng quality-review hiện có trong repository. Audit tự động không thay thế native reviewer và không chứng minh tính đúng tiếng Hàn của các mục chưa được duyệt.

## 1. Content Inventory

Inventory có 6.764 record runtime. Một khái niệm có thể xuất hiện ở nhiều kho, ví dụ vocabulary bank và dictionary, nên đây là số record cần quản trị chứ không phải số khái niệm duy nhất.

| Type | Records | Kết quả chính |
| --- | ---: | --- |
| Vocabulary | 1.011 | 1.000 bank + 3 CMS + 8 advanced-content |
| Lesson | 128 | 120 theory lesson, 3 CMS, 5 advanced-content |
| Grammar | 5 | 2 CMS + 3 advanced-content |
| Example sentence | 9 | Advanced-content examples |
| Audio | 3 | CMS metadata, đều dùng browser speech synthesis |
| Listening | 320 | Runtime questions sinh từ template |
| Speaking | 22 | 10 speaking modes + 12 roleplay scenarios |
| Writing | 20 | Writing prompts TOPIK 1–6 |
| TOPIK question | 2.400 | 160 bộ TOPIK × 15 câu, sinh từ template |
| Other practice question | 1.330 | Beginner, EPS, vocabulary, grammar practice |
| Dictionary | 1.510 | 1.000 base + 510 derived/common records |
| Quiz / exercise | 6 | CMS Level 0, TOPIK 1–2 |

| Classification | Records |
| --- | ---: |
| VALID | 3 |
| NEEDS REVIEW | 6.002 |
| DUPLICATE | 111 |
| MISSING DATA | 648 |
| INCORRECT | 0 |

Không phát hiện lỗi cấu trúc đủ chắc chắn để tự động gắn `INCORRECT`. Con số 0 không có nghĩa toàn bộ nội dung đúng; phần lớn chưa có bằng chứng human review.

### Inventory queue mẫu

Full queue được tạo lại bằng `node scripts/audit-content-quality.js --details`.

| Content ID | Type | Level | Status | Issue |
| --- | --- | --- | --- | --- |
| `lesson-cafe-order` | lesson | Beginner | approved | VALID; có quality review đã duyệt |
| `grammar-topic-particle` | grammar | Beginner | approved | VALID; native/grammar/example/difficulty checked |
| `ex-topic-beginner` | example | Beginner | approved | VALID; có review và version history |
| `freq-학교` | vocabulary | Unknown | review | Audio 78/100, example check chưa hoàn tất |
| `v-01-18` | vocabulary | TOPIK 1 | unreviewed | DUPLICATE surface + meaning; cần phân biệt homonym/duplicate |
| `topik-1-01` | lesson | TOPIK 1 | unreviewed | Thiếu vocabulary, example, listening, reading; grammar còn placeholder |
| `cms-beginner-batchim` | lesson | TOPIK 0 | draft | Chưa verified, thiếu reviewer và version timestamps |
| `cms-t1-audio-intro` | audio | TOPIK 1 | approved | Browser TTS, thiếu reviewer/timestamps |
| `t1-01-q01` | TOPIK question | TOPIK 1 | unreviewed | Sinh từ template, chưa có editorial review/source đề |
| `roleplay-restaurant` | speaking | Unmapped | unreviewed | Thiếu level và review metadata |
| `phrase-generated-1` | dictionary | TOPIK 1 | unreviewed | Derived tự động, thiếu usage example |

## 2. Vocabulary Issues

- 1.000/1.000 từ có nghĩa tiếng Việt, part of speech và TOPIK level hợp lệ về mặt schema.
- 33 nhóm trùng surface form, tương ứng 67 record; cần reviewer phân biệt đồng âm/đa nghĩa với duplicate thật.
- 22 nhóm trùng cả surface form và nghĩa, tương ứng 44 record.
- 45 nhóm dùng cùng normalized Vietnamese meaning giữa các từ khác nhau; đây là hàng đợi kiểm tra sắc thái, không được tự gộp.
- 986 romanization dùng `automatic-fallback`, chưa được phép coi là curated.
- 1.000/1.000 ví dụ dùng cùng template `오늘의 표현은 …입니다.`; không thiếu trường nhưng chất lượng ngữ cảnh thấp.
- `audioText` chỉ là đầu vào cho TTS thiết bị, không phải native recording.
- TOPIK level 1–6 đều hợp lệ về range; độ phù hợp thực tế vẫn cần reviewer.

Không sửa nghĩa, POS, level, duplicate hoặc ví dụ trong đợt này.

## 3. Grammar Issues

- `grammar-topic-particle` có đầy đủ evidence và là grammar record duy nhất đạt VALID.
- `grammar-polite-request` chưa có record trong content-quality review queue.
- `grammar-action-link` đang ở trạng thái review.
- Hai grammar CMS (`cms-t1-topic-particle`, `cms-t2-purpose`) có nghĩa và một ví dụ nhưng thiếu reviewer, created/updated timestamps, phần lỗi thường gặp và phần so sánh cấu trúc dễ nhầm.
- 120 theory lessons dùng cùng mô tả grammar khái quát, chưa có form/ending/particle cụ thể theo từng lesson.

## 4. Beginner Content Review

Flow trong `data/beginner-foundation.js` đúng thứ tự nhận thức cơ bản: Hangul → âm tiết → đọc từ → nghĩa → từ đầu tiên → câu đầu tiên → checkpoint. Nội dung giới hạn batchim cơ bản, không hard-lock TOPIK 1 và không bắt người mới làm TOPIK test.

Khoảng trống:

- Các mảng Hangul, minimal pairs, batchim và checkpoint đang nằm trong code, chưa có content ID/version/reviewer riêng.
- 6 CMS Level 0 đều thiếu created/updated timestamps và reviewer evidence; `cms-beginner-batchim` còn ở draft.
- Hướng dẫn âm dùng mô tả gần âm tiếng Việt và TTS thiết bị; cần native reviewer xác nhận trước khi gắn nhãn audio chuẩn.
- Romanization hỗ trợ người mới và có toggle, nhưng chưa có policy tự động giảm dần theo level.

## 5. Audio Review

Không tìm thấy file audio `.mp3`, `.wav`, `.ogg`, `.m4a`, `.aac` hoặc `.webm` trong repository.

| Origin | Verified records |
| --- | ---: |
| Native recording | 0 |
| AI voice | 0 |
| Browser/device TTS references | 3.579 inventory rows |
| Missing/unclassified speaking rows | 12 |

App hiện ghi rõ “Giọng đọc thiết bị” và “không phải bản thu người bản xứ” ở Dictionary; không phát hiện nhãn “Native Audio” sai trong UI. `lesson-workplace-report` vẫn để draft và ghi rõ đang chờ native-speaker audio.

## 6. TOPIK Review

- 2.400 câu TOPIK runtime được tạo theo template; 0 câu có metadata chứng minh là đề TOPIK chính thức.
- Tất cả 2.400 câu có answer explanation theo validator.
- Range level TOPIK 1–6 có cấu trúc hợp lệ, nhưng chưa có reviewer evidence ở cấp từng câu.
- Không phát hiện UI tuyên bố đây là đề thi thật; tuy nhiên cần source/provenance rõ hơn trước khi sử dụng cho đánh giá chuẩn hóa.
- 120 theory lessons tương ứng TOPIK 1–6 còn là lesson shell, không nên tính là content hoàn chỉnh.

## 7. AI Content Workflow

Workflow hiện có trong `20260906_ai_content_creation.sql` đã tuân thủ:

`AI Draft → Human Review → Approved → Admin Publish`

- AI không có quyền publish.
- Approved/published bắt buộc `human_approved = true` và có `reviewed_by`.
- Curriculum proposal từ AI không thể publish.
- P62 không sinh thêm lesson/example/quiz bằng AI.

## 8. Content Versioning

Trước P62, versioning đầy đủ chỉ có trong advanced-content sample; 18 CMS records có `version` nhưng thiếu created/updated timestamps và immutable history.

Migration P62 bổ sung:

- `learning_content_versions` lưu snapshot phiên bản cũ.
- Thay đổi body/title/difficulty/source/audio bắt buộc tăng version.
- Lưu `change_summary`, `changed_by`, `changed_at`.
- Tách reviewer approval khỏi admin publish bằng `reviewed_by`, `reviewed_at`, `published_at`.
- Giữ các item đã approved trước đây hiển thị bình thường bằng backfill `published_at`.

## 9. Issues Found

### P0

- 2.400 câu TOPIK chưa có source và human review ở cấp câu; không đủ bằng chứng dùng làm đề chuẩn hóa.
- 120 theory lessons thiếu vocabulary/example/listening/reading và dùng grammar placeholder.

### P1

- 1.000 vocabulary examples lặp một template, chưa cung cấp ngữ cảnh thực tế.
- 986 romanization tự động chưa được native/editor review.
- Quality-review coverage chỉ 4/6.764 records; 3 record approved.
- 510 dictionary records thiếu usage example; 500 record là derived generation cần review.
- 33 nhóm duplicate surface cần phân loại thủ công.

### P2

- CMS content thiếu reviewer evidence và version timestamps.
- `content_editor` được app dùng nhưng constraint role cũ của database chưa cho phép.
- Romanization chưa tự giảm theo Beginner/Intermediate/Advanced.
- 12 roleplay speaking chưa map level.

### P3

- Chưa có native audio asset trong repository.
- Các quality dimensions Accuracy/Completeness/Difficulty Match/Naturalness chưa có dữ liệu đầy đủ cho đa số content.

## 10. Fixed Items

- Thêm validator P62 chỉ đọc, bao phủ 6.764 runtime records và xuất full inventory có `Content ID / Type / Level / Status / Issue`.
- Thêm schema cho bốn quality dimensions: Accuracy, Completeness, Difficulty Match, Naturalness.
- Thêm role `content_editor` vào content governance.
- Thêm workflow quyền tối thiểu: Content Editor tạo/sửa draft; Reviewer review/approve; Admin publish.
- Thêm immutable content version history và bắt buộc tăng version khi sửa nội dung.
- Thêm loại phản hồi “Câu hỏi hoặc đáp án sai” vào UI/schema.
- Giữ public chỉ đọc content đã approved, verified và published.
- Số linguistic content được tự động sửa: **0**.

## 11. Remaining Issues

- Cần native Korean reviewer và Vietnamese editor xử lý từng queue, bắt đầu từ P0.
- Cần nhập source/provenance cho từng TOPIK question; content không rõ nguồn phải giữ nhãn practice, không gắn đề thật.
- Cần thay template vocabulary example theo từng batch đã duyệt; không generate/publish hàng loạt.
- Cần quyết định canonical record cho duplicate sau khi xét nghĩa và context.
- Cần chuyển beginner inline data sang CMS có version/reviewer mà không đổi content ID đang liên kết progress.
- Cần thu hoặc cấp phép native audio; đến khi có, tiếp tục ghi nhãn Device TTS.
- Migration P62 phải được review và chạy trên Supabase trước khi workflow server có hiệu lực.

## 12. Tests

- 53/53 unit/contract test files passed.
- P62 audit test passed: inventory, classifications, audio transparency, TOPIK source status, versioning, RBAC và learner-data isolation.
- Existing content-quality + advanced-content tests passed.
- Browser test passed ở 360 / 768 / 1024 / 1440 / 1920, dark mode, no horizontal overflow, trust panel, report persistence và admin privacy.
- P48 browser regression passed cho new/existing/cloud/beginner/lesson/offline/audio integrity.
- P47 browser regression passed cho auth/privacy/CAS CloudSync conflict retry.
- `git diff --check`: chạy ở bước bàn giao cuối.

## 13. Git

- Branch: `main`
- Base SHA trước P62: `f5883d57ebc2703c677be3c02b637b8cc4632ae9`
- Commit message: `feat: build content quality validation system`
- SHA: ghi trong báo cáo bàn giao sau khi tạo commit (không thể tự tham chiếu SHA của chính file này).
- Push: thực hiện lên `origin/main` sau khi toàn bộ checks cuối pass; không force push.
