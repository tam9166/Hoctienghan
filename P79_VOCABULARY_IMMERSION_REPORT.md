# P79 VOCABULARY IMMERSION REPORT

## 1. Architecture

- P79 là route module lazy-load gồm `content/vocabulary-immersion-system.json`, `data/vocabulary-immersion-system.js` và `vocabulary-immersion-system.css`.
- Learning Core vẫn là nguồn dữ liệu duy nhất: thẻ từ và bằng chứng P79 được ghi vào SRS hiện có qua `getUserSrs`, `saveUserSrs` và `VocabularyService.updateCard`.
- Không thêm database, bảng mastery, progress store hoặc sync domain song song.
- Module thư viện chỉ phụ thuộc Practical Study và Ecosystem Scale. Voice stack nặng chỉ tải khi mở `vocabulary-practice-p79`, tránh tăng cold path của trang Lessons.
- Bảy bề mặt được cung cấp: topic library, topic roadmap, learning page, multi-skill practice, personal collections, offline packs và analytics.
- Phiên bản ứng dụng được nâng lên `1.4.0-rc.1`, release ID `p79-vocabulary-immersion-system`.

## 2. Data model

- Thư viện có **17 chủ đề**: 9 TOPIK I và 8 TOPIK II theo đúng danh sách yêu cầu.
- Seed biên tập có **35 từ**, mỗi từ có Korean word, pronunciation, Vietnamese meaning, word type, topic, level, TOPIK level, example sentence, audio descriptor, offline-safe image descriptor, related words và common mistake.
- Đủ sáu loại từ: Danh từ, Động từ, Tính từ, Trạng từ, Cụm từ và Trợ từ.
- Topic trả `id`, `title`, `level`, `topikLevel`, `description`, `totalVocabulary`, số từ đang học, số từ hoàn thành và `completion`; số liệu được tính từ data thật thay vì hard-code.
- Audio seed dùng `tts:<korean>` và UI gọi speech service hiện có. Hình ảnh seed dùng emoji descriptor để luôn hoạt động offline và không phụ thuộc tài nguyên ngoài.
- Personal word được lưu trong `vocabularyCollections` hiện có; khi thêm từ, cùng một record được kích hoạt trong SRS thay vì tạo hệ thống ôn riêng.

## 3. Learning flow

- Luồng chính: **Topic → Vocabulary → Listening/Reading/Writing/Speaking/Context → Evidence mastery**.
- Learning page hiển thị từ Hàn, phát âm, loại từ, nghĩa, câu ví dụ, nút nghe, hình ảnh, từ liên quan và lỗi thường gặp.
- Listening phát từ rồi yêu cầu chọn nghĩa; Reading yêu cầu đọc hoặc nhập; Writing cho nghĩa rồi yêu cầu viết Hangul; Speaking dùng microphone/transcript với text fallback; Context điền từ vào câu.
- Mastery không dựa vào việc mở trang. Năm cấp lần lượt là Seen, Recognized, Listening mastered, Writing mastered và Usage mastered.
- Level 5 chỉ đạt khi có bằng chứng Reading → Listening → Writing và cả Speaking + Context; sau đó thẻ SRS mới chuyển `mastered` với mastery 100.
- Topic roadmap hiển thị số từ đã bắt đầu, số từ Level 5 và phần trăm hoàn thành. Topic Achievement chỉ được ghi vào achievement store hiện có khi toàn bộ từ trong topic đạt Level 5.

## 4. Integration

- **SRS:** activation, review count, correct/wrong count, streak, next review và status dùng chính thẻ SRS hiện hữu.
- **Mastery:** `immersionLevel` và `immersionEvidence` là phần mở rộng additive trên thẻ từ; không có mastery database thứ hai.
- **Adaptive Engine:** mỗi kết quả đúng/sai gọi `AdaptiveDifficultyService.record('vocabulary', ...)`.
- **Error Notebook:** câu sai được ghi với skill, word ID, correction, topic và common mistake.
- **Learning Journey:** mỗi lượt luyện phát `vocabulary_updated` mutation và research event, đồng thời cập nhật daily vocabulary/listening/speaking task trên progress hiện có.
- **Personal Vocabulary:** tạo collection và custom word qua `VocabularyCollectionService`; custom word có cùng SRS, practice và mastery flow.
- **Analytics:** Total words, active words, mastered words, weak words và topic progress được dẫn xuất từ content + SRS, không lưu aggregate giả.
- **Offline:** bốn pack TOPIK I, TOPIK II, Travel và Business dùng `MobileOfflineService` khi có; fallback metadata vẫn ghi vào `offlinePacks` hiện có và không xóa progress/SRS.
- **Mobile:** P79 được copy vào native web bundle; `mobile-app.config.json` nối Vocabulary Immersion với `VocabularyMasteryBridgeService`.

## 5. Testing

- Full unit/regression: **78/78 suites passed**.
- P79 unit pass: 17 topics, 35 words, six word types, complete word schema, five practice modes, sequential mastery, topic achievement, shared SRS, Adaptive, Error Notebook, Journey mutation, personal collection, analytics và four offline packs.
- P79 real-browser pass: **25 checks** tại 320, 360, 390, 430, 768, 1024 và 1440 px; tất cả bảy feature routes render, không horizontal overflow, dark mode và touch target đạt yêu cầu.
- Browser xác nhận Level 1 → Level 5, record được persist trong `klearn_srs`, custom collection dùng cùng SRS, offline topic vẫn render và marker progress/SRS cũ được giữ nguyên.
- P48 Learning Integrity pass cho new/existing/cloud/beginner/lesson/offline/audio data.
- P49 Performance/Scalability pass: cold requests **45**, decoded **1,215,812 bytes**, 10,000 history records, cloud truncation 1,000, search khoảng **2.5 ms**, listener **91 → 88**, offline fallback và responsive mobile pass.
- P73B Learning Effectiveness pass: Word Life, Active Recall, SRS integration, persistence, responsive và dark mode.
- P77 Premium và P78 Mobile regressions pass; P78 giữ progress, SRS và subscription với 28 browser checks.
- `npm run build --prefix mobile` và `npm run doctor --prefix mobile` pass cho `1.4.0-rc.1`; `npm audit --prefix mobile --audit-level=high` báo **0 vulnerabilities**.
- JSON parse, `node --check`, `git diff --check` và secret-pattern scan pass; Git chỉ cảnh báo chuyển đổi LF/CRLF trên Windows.

## 6. Remaining risks

- 35 từ là seed chất lượng để chứng minh toàn bộ flow, chưa phải corpus TOPIK production hàng nghìn từ; cần content pipeline mở rộng và editorial QA.
- Audio hiện dựa vào TTS của thiết bị, chưa có bộ thu âm giọng chuẩn cho từng từ; giọng/tính khả dụng offline khác nhau theo OS.
- Speaking hiện chấm theo transcript matching, chưa phải phoneme-level pronunciation scoring. Microphone luôn có text fallback nhưng cần QA thiết bị thật.
- Hình ảnh dùng offline-safe emoji descriptor, chưa phải bộ minh họa riêng đã kiểm tra bản quyền.
- P49 cold request đang đúng ngưỡng 45; feature tiếp theo phải tiếp tục lazy-load và không thêm asset vào cold shell tùy tiện.
- Native offline pack cần kiểm thử thiết bị thật cho storage pressure, pack removal, app upgrade và audio availability.
- Dữ liệu P79 additive được CloudSync giữ trong SRS/collection payload hiện có; cần kiểm thử nhiều thiết bị khi corpus và collection tăng lớn.

## 7. Git SHA

- Feature commit: `9d3bea5e828fe2c955e495a087754ef5c5929b1c`
- Commit message: `feat: build vocabulary immersion system`
- Branch: `main`
- Baseline P78 report commit: `798e2ad9ba14d0016d0a0d66722ba3938707cf77`

P79 chuyển phần từ vựng từ danh sách tra cứu thành một vòng học có chủ đề, đa kỹ năng và bằng chứng thành thạo, trong khi vẫn giữ nguyên một Learning Core duy nhất.
