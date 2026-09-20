# P83 — Smart Document & Image Vocabulary Import Report

Ngày kiểm tra: 20/09/2026
Repository: `tam9166/Hoctienghan`
Phạm vi: chỉ P83; không triển khai P84.

## 1. Existing P82 audit

P82 đã có deck CRUD, import CSV/TXT/JSON, duplicate modes, topic thủ công/AI suggestion, Focus Session, shuffle, Vietnamese → Korean recall, Korean validation, retry đến hết queue, Mastery/SRS, Error Notebook, Adaptive, offline pack và CloudSync. P83 dùng trực tiếp `P82DeckService` và `P82ImportService.importIntoDeck`; không tạo deck store, SRS, notebook, mastery hoặc classroom mới.

Audit cũng xác nhận OCR cũ chỉ là `TextDetector` tùy trình duyệt, mobile đã có Capacitor Camera, P76 đã có Creator draft → Automated Check → Human Review → Admin Publish và Classroom Assignment, `/api/chat` là AI endpoint phù hợp để mở rộng. Trước P83 không có parser XLSX/DOCX/PDF thật.

## 2. Supported formats

| Format | Trạng thái thực tế | Xử lý |
|---|---|---|
| CSV | Hỗ trợ thật | Client-side, header/row mapping |
| XLSX | Hỗ trợ thật | OOXML ZIP local, chọn worksheet trước extraction |
| TXT | Hỗ trợ thật | Cặp `-`, `:`, `,`, tab và dòng xen kẽ |
| JSON | Hỗ trợ thật | Array hoặc `{ "words": [...] }`; malformed trả `JSON_INVALID` |
| DOC | Nhận diện nhưng không parse | Thông báo Save as DOCX; không conversion server-side |
| DOCX | Hỗ trợ thật | OOXML local; ưu tiên table, sau đó paragraph/list/heading context |
| PDF text | Hỗ trợ thật | PDF.js text layer, page tracking, scan detection |
| PDF scan | Hỗ trợ có điều kiện | Phát hiện thật; user chọn trang rồi dùng AI OCR nếu consent/network/provider sẵn sàng |
| JPG/JPEG/PNG/WEBP | Hỗ trợ thật | Decode/quality/preview; OCR local nếu `TextDetector`, nếu không thì AI OCR opt-in hoặc nhập tay |

Các loại khác, executable, MIME/signature mismatch, Office OLE cũ, PDF có mật khẩu và tài liệu hỏng bị từ chối. “Hỗ trợ ảnh” không đồng nghĩa OCR luôn sẵn sàng: khả năng OCR được hiển thị trung thực theo thiết bị và AI preference.

## 3. CSV

Giữ semantics P82 và bổ sung pipeline P83 bắt buộc review. Nhận Korean, Meaning, WordType, Topic, Example, Note; tự phát hiện `,`, `;`, quoted CSV và header aliases. Thiếu topic giữ `Chưa phân loại` để dùng AI suggestion P82, không tự xác nhận.

## 4. XLSX

Parser dùng `fflate 0.8.2` (MIT) để giải OOXML ZIP, sau đó DOMParser đọc workbook, relationships, shared strings, inline strings, rows/cells và column references. UI bắt buộc chọn worksheet; sheet khác không bị tự nhập. Có giới hạn giải nén 80 MB để giảm zip-bomb risk.

## 5. TXT

Nhận các mẫu `학교 - trường học`, `학교 : trường học`, CSV/tab và cặp dòng Korean/meaning. Dòng mơ hồ không được tự nhập; sentence dài được đánh dấu `sentence_not_word`/`needs_review`.

## 6. JSON

Nhận array hoặc object có `words`. Dữ liệu được normalize/sanitize và vẫn phải review. JSON malformed hoặc schema sai trả `JSON_INVALID`, không import một phần.

## 7. DOC

Legacy `.doc`/OLE được nhận diện bằng signature nhưng không parse. UI/error nói rõ: “.doc chưa được hỗ trợ trực tiếp; vui lòng Save as .docx.” Không dùng converter server-side và không giả vờ hỗ trợ.

## 8. DOCX

Parser đọc `word/document.xml`, table rows/cells, paragraphs, headings, bullet/number metadata. Table được ưu tiên; nếu không có bảng, parser dùng paragraph pairs. Mapping thiếu/không chắc chuyển sang review. Korean/English/Vietnamese/Korean POS (`명사`, `동사`, `형용사`...) được normalize về type P82.

## 9. PDF

`pdfjs-dist 5.4.624` legacy browser build (Apache-2.0) được self-host cùng worker. Mỗi page đọc text layer riêng, tạo `sourcePage`, không render HTML tài liệu. Test browser thật xác nhận cả PDF text-layer và PDF trắng/scan. PDF hỏng/mật khẩu bị chặn.

## 10. Image

JPG, JPEG, PNG và WEBP được kiểm signature, decode bằng `createImageBitmap`, resize/compress trong browser và hiển thị original preview từ data URL chỉ nằm trong RAM. Nhiều ảnh được kết hợp vào cùng draft nhưng giữ `sourceImage`, order và fingerprint riêng.

## 11. OCR

Hai tầng OCR:

- On-device: `TextDetector` khi browser cung cấp; không upload.
- AI OCR: user bấm rõ ràng, AI preference phải bật, confirm disclosure, gửi tối đa 3 ảnh/batch qua `/api/chat` task `document_ocr`, Responses API structured JSON; không `store` và không thêm Function.

AI OCR luôn gán `needs_review`, confidence tối đa 0.85 và không auto-import. Nếu local/AI OCR không khả dụng, user vẫn có thể thêm/sửa mục thủ công.

## 12. Scanned PDF

Page có text dưới ngưỡng được đánh dấu scan. UI liệt kê page scan và bắt user nhập page/range cần OCR; hệ thống không tự render toàn bộ PDF. Chỉ page đã chọn mới render JPEG rồi đi qua cùng AI OCR/review flow.

## 13. Multi-image

File picker nhận nhiều file, tối đa 30 nguồn/lần và 10 MB/ảnh. Browser E2E đã chạy 5 ảnh hỗn hợp PNG/JPG/JPEG/WEBP trong cùng một lần import cùng XLSX, DOCX và hai PDF.

## 14. Extraction

Pipeline là: validate → extract → preview → validate rows → user review → explicit confirm → P82 import. Structure engine chỉ tạo candidate khi nhận diện được cặp Korean/meaning; không biến toàn paragraph thành vocabulary. Korean bắt buộc có Hangul trước commit.

## 15. Topic detection

Topic có trong file được giữ. Topic thiếu trở thành `Chưa phân loại`; sau import dùng lại P82 AI classification theo batch và bắt người dùng confirm/reject. OCR AI có thể đề xuất topic/type trong structured output nhưng vẫn là suggestion trong review.

## 16. Review

Review screen là bắt buộc. Có edit Korean/meaning/type/topic/example, include/exclude, delete, merge, bulk topic/type, confidence/issues, pagination 50 rows và final confirmation. Low-confidence/OCR rows cần thêm confirm riêng. Reprocess hỏi giữ hay bỏ user edits và merge lại theo provenance key.

## 17. Provenance

Mỗi word đã xác nhận lưu `sourceType`, `sourceFileName`, `sourcePage`, `sourceImage`, `sourceSection`, `sourceOrder`, `sourceFingerprint`, `extractionMethod`, `extractionConfidence`, `reviewStatus`, `importedAt`. P82 SRS card và Error Notebook record giữ source fields liên quan. Import history giữ source metadata, không giữ binary.

## 18. Student workflow

Student chọn một/nhiều file → xem processing/errors → chọn sheet/page OCR khi cần → review → tạo deck mới hoặc thêm vào deck hiện có → mở deck P82 → chọn topic/count → Focus Session → retry wrong items → Mastery/SRS. Không biến upload thành official content.

## 19. Teacher workflow

Sau review/import, Teacher/Creator có thể tạo P76 vocabulary draft. Draft vẫn phải đi qua Automated Check, Human Review và Admin Publish. Classroom assignment mở route/service P76 hiện có; P83 không tạo classroom hoặc publish shortcut.

## 20. Offline

Parser OOXML/PDF/P83 module có offline pack riêng. Deck/vocabulary đã import học offline bằng P82. Local parsing/OCR có thể chạy offline theo capability; UI ghi rõ AI OCR vẫn cần network/consent. Learning core không phụ thuộc AI.

## 21. CloudSync

P83 không thêm storage key cho file, image hay PDF. Binary, PDF document handle và preview data URL chỉ ở runtime `Map`; CloudSync chỉ nhận deck, normalized vocabulary và provenance metadata thông qua P82 collection merge/revision flow. Existing progress/SRS/mastery không bị reset.

## 22. Privacy

AI disabled không gửi ảnh/document/vocabulary/learning context lên AI. Parse CSV/XLSX/TXT/JSON/DOCX/PDF vẫn local. AI OCR cần user action, privacy gate, consent header và confirm disclosure. Camera dùng `saveToGallery: false`.

## 23. Security

Validation dùng extension + signature/MIME family + size + empty/binary/encoding/decode/document checks. Error families: `IMPORT_FILE_TYPE_UNSUPPORTED`, `IMPORT_FILE_TOO_LARGE`, `IMPORT_FILE_EMPTY`, `IMPORT_FILE_CORRUPTED`, `IMPORT_FILE_READ_FAILED`, `IMPORT_FILE_PROCESSING_FAILED`, `JSON_INVALID`. Không execute file, không inject/render document HTML, mọi extracted string được sanitize/escape. API chỉ chấp nhận JPEG/PNG/WEBP data URL, tối đa 3 ảnh, 900k chars/ảnh, 2.4M chars/batch, rate limit và structured schema.

## 24. Performance

Rows giới hạn 5,000 và render 50/page. Sources xử lý tuần tự với progress/cancel checks; AI OCR batch 3. Images resize tối đa 1,400 px rồi giảm tiếp tới payload bound. PDF parse theo page, chỉ render page OCR được chọn. P82 regression đo 5,000-row parse khoảng 148 ms và import khoảng 672 ms trên máy test.

## 25. Vercel Functions

Không tạo endpoint mới. Mở rộng `/api/chat` hiện có cho `document_ocr`. Audit hiện tại: **7/12 Functions**, giữ nguyên P78:

`api/ai/feedback.js`, `api/billing.js`, `api/chat.js`, `api/commerce.js`, `api/config.js`, `api/health.js`, `api/version.js`.

## 26. Testing

- Repository unit/integration: 83/83 test files pass sau regression.
- P83 unit: validation, text structure, reviewed commit, provenance, P76 bridge, OCR JSON quality contract, license và 7/12 cap.
- P82 regression: CSV/TXT/JSON, 5,000 rows, AI topics, focus retry, SRS/Error/Adaptive/offline/CloudSync.
- Browser E2E Edge: XLSX 2 sheets, DOCX table, CSV, PDF scan, PDF text layer, 5 images PNG/JPG/JPEG/WEBP, reprocess preserving edits, commit/provenance/P82 learning/offline.
- Responsive: 360, 390, 430, 768, 1024, 1440, 1920; no horizontal overflow; controls 44 px.
- Production build audit pass; release-readiness pass; Vercel function audit 7/12.

AI provider live OCR không được gọi trong local test vì môi trường không có/không sử dụng production `OPENAI_API_KEY`; contract, privacy gate, image bounds, structured-response validator và fallback đã được test. Đây không được báo cáo như live-provider pass.

## 27. Real user scenarios

- A — PDF/large deck: PDF text pipeline, P82 500/5,000 row performance, topic/focus/retry/mastery/SRS được test theo từng lớp; chưa dùng một fixture PDF thật chứa đúng 500 từ.
- B — 5 photos: E2E 5 ảnh mixed formats qua validation/quality/multi-source/review/deck; live AI OCR provider chưa chạy local.
- C — Teacher DOCX: DOCX table extraction + reviewed P82 deck + P76 draft/assignment bridge pass; permission vẫn do P76 enforce.
- D — Scanned PDF: scan detection và page-select OCR offer pass; OCR output contract/review pass, live provider phụ thuộc deployment key.
- E — AI disabled: local DOCX parser/manual review/P82 deck/offline learning không phụ thuộc AI.

## 28. Remaining issues

- `TextDetector` không có trên mọi browser; AI OCR là fallback có consent/network/key, không cam kết OCR 100%.
- Rotation angle/crop/layout phức tạp chỉ được cảnh báo bằng resolution/contrast/sharpness/orientation/aspect và confidence; chưa có deskew/CV table model local.
- PDF table reconstruction chỉ dựa text order; bảng PDF phức tạp cần review/AI OCR.
- `.doc` legacy, password PDF và server-side Office conversion không hỗ trợ.
- Import History không giữ binary nên reprocess sau khi rời phiên phải chọn lại file; đây là chủ đích privacy/storage.
- Large-file coverage dùng 5,000 structured rows và multi-source fixtures; chưa benchmark PDF 100 page hoặc 20 ảnh trên thiết bị cấu hình thấp.
- Release warnings hiện tại cần kiểm tra ở môi trường deploy: `PRODUCTION_URL`, Supabase production config và `OPENAI_API_KEY`.
- Commit SHA, push và production deployment sẽ được cập nhật sau khi release pipeline hoàn tất.

## Definition of Done summary

P83 đạt flow bắt buộc, parser local, scan/image handling, review/provenance, new/existing deck, P82 learning core, P76 teacher bridge, offline/privacy/security/performance và Function cap. Các giới hạn capability/provider được công bố rõ, không giả vờ hỗ trợ.
