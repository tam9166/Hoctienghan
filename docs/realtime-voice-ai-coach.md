# P57 — Real-time Voice AI Language Coach

## Kiến trúc

P57 là extension của `AdvancedVoiceLearningService` P36, không phải speaking system hoặc chatbot mới.

```text
Microphone / text fallback
          |
VoiceCaptureService (audio tạm thời + ko-KR transcript)
          |
VoiceAnalysisService
  | phoneme/syllable/consonant/vowel/batchim
  | speed/pause/intonation/confidence
          |
SpeakingHistoryService + CloudSync (không có audio)
          |
VoiceCoachFeedbackService
  | context tối thiểu + 2 lượt gần nhất
  | AI orchestration / quality gate
  | deterministic fallback
          |
Role-play response + 30/90-day journey
```

## Phân tích và giới hạn độ chính xác

- Nếu có acoustic provider đã kiểm định, P36 có thể dùng provider đó. Mặc định browser dùng SpeechRecognition transcript alignment và local audio-signal heuristics.
- Mỗi âm tiết Hangul được tách thành phụ âm đầu, nguyên âm và batchim. Đây là ước tính hỗ trợ học tập, không phải điểm phoneme chính thức.
- Fluency dùng tốc độ âm tiết, số/độ dài khoảng dừng, duration fit và voiced ratio. Confidence kết hợp recognition confidence, độ phù hợp từ khóa và độ dài câu.
- Naturalness AI bị neo trong phạm vi ±20 điểm so với local score. AI không được sửa điểm phoneme, batchim hoặc acoustic.

## AI quality và cost control

- Task riêng: `realtime_voice_feedback`, strong route, prompt `p57-voice-feedback-v1`.
- Server chỉ cho tối đa 320 output tokens, đặt `store: false` và dùng Responses Structured Outputs với strict JSON Schema gồm `replyKo`, `feedbackVi`, `correctionKo`, `naturalness`, `reason`, `confidence`.
- Client kiểm tra JSON, Korean response, confidence, score range, unsupported claims và orchestration quality status.
- Budget trên thiết bị: 12 request/ngày, 8.000 estimated tokens/ngày, 4 giây giữa các request, 6 lượt/phiên và 2 lượt context gần nhất.
- Audio blob/frames không gửi đến endpoint AI, không ghi localStorage và không nằm trong `learning_sync`.

## Memory và privacy

Memory chỉ lưu topic count, âm yếu và cụm từ mong đợi thường thiếu. Speaking attempt lưu transcript, điểm và signal summary như P36; raw audio không được lưu. Dữ liệu user-scoped tiếp tục đi qua CloudSync hiện có. User tắt AI trong Privacy Center sẽ luôn nhận deterministic fallback.

## Fallback

Offline, hết budget, provider lỗi, invalid JSON hoặc quality gate không đạt đều dùng phản hồi cục bộ dựa trên từ khóa, đuôi câu, fluency và câu mẫu đã duyệt. Speaking attempt vẫn được chấm, lưu và hiển thị; user cũng luôn có thể quay lại Voice Lab P36.

## QA

- Unit: component decomposition, AI validation/rejection, role-play, memory, budget, 30/90 journey và offline fallback.
- Browser: 360/768/1024/1440/1920, dark mode, overflow, touch targets, text fallback và local persistence.
- Manual real-device release gate: microphone grant/deny, noisy room, interrupted recognition, Korean locale, slow/offline network, iOS/Android background/resume và explicit AI opt-out.
