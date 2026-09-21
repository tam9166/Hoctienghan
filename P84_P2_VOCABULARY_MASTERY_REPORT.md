# P84-P2 Vocabulary Mastery & Real Usage Report

## 1. Audit

- Vocabulary tiếp tục dùng schema P82/P84-P1: `korean`, `meaning`, `example`, `acceptedAnswers`, `acceptedMeanings`, `personalExamples`, topic/tags và provenance.
- Trước P84-P2 đã có system example và personal example; câu không có example được giữ nguyên, không sinh dữ liệu giả.
- Audio dùng `speechSynthesis`/`speakKorean`; phát âm dùng SpeechRecognition và Speaking Room hiện có. Khi thiết bị không hỗ trợ, giao diện báo unavailable.
- Recall evidence, mastery, SRS, wrong count và Error Notebook đã tồn tại. P84-P2 chỉ đọc/phân tích và ghi attempt qua pipeline P82/VocabularyService.
- Trước P84-P2 chưa có word relation có nguồn/confidence và chưa có context/confusion review chuyên biệt.

## 2. Context Mode

- Thêm Context Learning dựa trên example có thật trong word.
- Câu hỏi fill-blank thay đúng từ mục tiêu bằng `______`.
- Không tạo câu giả khi không tìm thấy từ trong example.
- Wrong answer được đưa lại cuối queue và giữ nguyên context mode.

## 3. Sentence Learning

- Dùng system example và `personalExamples` của P84-P1.
- Câu cá nhân hiển thị nhãn `My Example` và được xử lý tại thiết bị.
- Example do AI, nếu được gọi, yêu cầu consent và nhãn `AI Generated`; không gọi là Official Example.

## 4. Word Family

- Thêm relation model trong domain `klearn_vocabulary_organization`.
- Fields: source/related word ID và text, `relationType`, `confidence`, `source`, owner/deck, timestamps.
- Relation types: `family`, `similar`, `opposite`, `derived`.
- Chỉ relation do người dùng xác nhận có nhãn `Verified relationship`; phát hiện tự động luôn là `Suggested relationship`.

## 5. Confusing Words

- Phát hiện gợi ý từ gần nhau bằng edit distance trong chính deck của user.
- Relation similar/opposite kết hợp wrong evidence để hiện cảnh báo “Bạn đang nhầm nhóm từ này”.
- Confusion Practice đưa hai từ liên quan, nghĩa mục tiêu và ghi sai vào Error Notebook hiện có.

## 6. Weakness Analysis

- Vocabulary Health theo deck: total, mastered, learning, weak.
- Weak categories: meaning, typing, confusion, context.
- Word breakdown: Meaning, Typing, Context, Listening.
- Breakdown chỉ diễn giải `modeStats`, mastery, SRS và Error Notebook hiện có; không tạo mastery engine mới.

## 7. Review Intelligence

- Xếp ưu tiên: SRS overdue, frequently wrong, confusing words, context weakness, low confidence.
- Review types: meaning, typing, listening, context, confusion và mixed.
- Mixed Review chỉ phân phối mode mà thiết bị và dữ liệu hiện tại hỗ trợ.
- Attempt ghi qua `P82LearningSessionService.recordRecall`, `VocabularyService`, AdaptiveDifficulty và Error Notebook hiện có.

## 8. Audio

- Listening Recall dùng SpeechSynthesis hiện có: nghe rồi nhập Korean.
- Không fake audio. Thiết bị không có SpeechSynthesis nhận `Audio unavailable` và mode bị loại khỏi mixed review.

## 9. Pronunciation

- Reuse SpeechRecognition/Speaking Room qua hành động Listen và Speak & compare.
- Không tạo pronunciation hoặc phoneme scoring engine mới.

## 10. Privacy

- AI mặc định không chạy.
- AI example yêu cầu cả explicit consent và privacy preference `aiUsage=true`.
- Personal notes/personal examples không được đưa vào prompt AI; prompt chỉ dùng từ mục tiêu sau consent.

## 11. Offline

- Context, relation, health, confusion và review chạy client-side từ dữ liệu có sẵn.
- CSS/JS P84-P2 đã có trong service worker và P82 offline pack.
- AI generation không phải dependency của Context Learning.

## 12. CloudSync

- Tái sử dụng domain user-scoped `klearn_vocabulary_organization` và CloudSync CAS/revision/conflict retry hiện có.
- Schema v2 merge folders, `wordRelations` theo ID/timestamp và `reviewHistory` theo ID/timestamp.
- Relation/review save đều schedule CloudSync; không lưu binary/audio.

## 13. Security

- Relation chỉ tham chiếu hai từ trong cùng deck thuộc user hiện tại.
- Dữ liệu owner-scoped; không thêm API hoặc server secret.
- Nội dung render qua escaping; input được normalize, giới hạn length và relation type allowlist.

## 14. Performance

- Không sinh hàng nghìn câu và không gọi AI trong review.
- Health/recommendation chuẩn bị card/error/relation index một lần cho cả deck.
- Benchmark 5.000 words: Vocabulary Health 210 ms; Review ranking 158 ms.

## 15. Tests

- Unit P84-P2 pass: context, fill blank, personal example, relations, similarity, confusion, weakness, audio fallback, mixed review, wrong retry, AI disabled, offline, privacy, CloudSync, SRS/mastery/error integrity và performance.
- Browser P84-P2 pass ở 360, 390, 430, 768, 1024, 1440 và 1920 px.
- Real-user scenarios pass: `학교` fill blank; `빌리다/빌려주다` confusion practice; listening review khi audio capability tồn tại.
- Full Node suite: 86 passed, 0 failed.
- Production build, release readiness và mobile native tests pass.

## 16. Regression

- Browser regression pass: P78, P79, P80, P81, P82, P83, P84-P0 và P84-P1.
- P82 SRS/mastery/error session, P84-P0 daily action và P84-P1 organization/multi-recall vẫn pass.
- Working data không reset mastery, SRS, wrong count, notes, examples hoặc tags.

## 17. Vercel Count

- Vercel Hobby Functions: **7/12**.
- P84-P2 thêm **0** function; toàn bộ logic mới chạy client/local.
- Functions hiện tại: `api/ai/feedback.js`, `billing.js`, `chat.js`, `commerce.js`, `config.js`, `health.js`, `version.js`.

## 18. Remaining Issues

- Context question hiện ưu tiên fill-blank; multiple choice, contextual meaning, word recognition và short translation chưa bật vì dữ liệu chưa đủ đồng nhất.
- AI example có consent/privacy contract nhưng chưa có màn hình generation/review riêng.
- Suggested relation chỉ dùng lexical similarity trong deck; không tuyên bố quan hệ ngữ nghĩa khi chưa được xác nhận.
- Pronunciation tiếp tục dùng Speaking Room hiện có, không có engine chấm âm vị mới.
- Chưa tự động thêm Vocabulary Mission vào Learning Journey; người học vẫn có Smart Review trực tiếp.
- Teacher Assignment/Analytics, Social, Community, Marketplace, Gamification, Leaderboard và AI Avatar nằm ngoài scope và không được triển khai.
- P84-P3 không được triển khai.
