# P68 AI QUALITY REPORT

## 1. AI Feature Audit

| Feature | Purpose | Input | Output | Cost | Risk |
|---|---|---|---|---|---|
| AI Coach | Giải thích và định hướng trong bài hiện tại | Câu hỏi và context học tối thiểu | Hướng dẫn cùng bước tiếp theo | Medium | Suy diễn dữ liệu hoặc khuyên chung chung |
| Sentence Correction | Sửa câu và giải thích lỗi | Một câu, level, lỗi liên quan | Câu sửa, giải thích, ví dụ | Medium | Sửa quá mức hoặc thiếu tự nhiên |
| Speaking Feedback | Giải thích transcript và điểm cục bộ | Câu mẫu, transcript, điểm, level | Điểm tốt, điểm sửa, câu luyện | High | Tuyên bố khả năng phân tích âm học không có bằng chứng |
| Weekly Report | Chuyển số liệu tuần thành hành động | Streak, phút học, điểm, kỹ năng yếu | Bằng chứng, điểm mạnh/yếu, tối đa ba hành động | Medium | Bịa số liệu hoặc nguyên nhân |
| Personalized Practice | Tạo bài bù lỗi | Level, bài hiện tại, lỗi gần đây | Câu hỏi, đáp án, giải thích | High | Đáp án sai hoặc lệch trình độ |
| Grammar Support | Giải thích cấu trúc trong ngữ cảnh | Câu hỏi, level, bài hiện tại | Quy tắc, khi dùng, ví dụ, cảnh báo | Medium | Bịa quy tắc hoặc ví dụ không tự nhiên |
| Learning Recommendation | Diễn đạt đề xuất từ engine hiện tại | Goal, SRS đến hạn, kỹ năng yếu, điểm gần đây | Một bước tiếp theo và bằng chứng | Low | Gọi AI cho quyết định rule engine đã giải quyết được |

Nguồn máy đọc được: `content/ai-quality-safety.json`. P68 không tạo menu hay chức năng AI mới.

## 2. AI Value Analysis

- High value: sửa câu, grammar support, personalized practice và speaking feedback có giới hạn bằng chứng.
- Medium value: AI Coach và Weekly Report, vì AI diễn đạt dữ liệu đã có nhưng không được tự tạo số liệu.
- Low value: Learning Recommendation. Rule-based Adaptive/Learning Engine vẫn là nguồn quyết định; AI chỉ diễn đạt khi thật sự cần.

## 3. Prompt Improvements

Mỗi task có contract riêng gồm route, output cap, allowlist context và cấu trúc đầu ra. Server tạo system instruction theo task, yêu cầu nói rõ bất định, không bịa quy tắc/nguồn/điểm TOPIK và không tuyên bố chấm âm học khi chỉ có transcript. Realtime voice tiếp tục dùng strict JSON schema.

## 4. Context Optimization

Client và server đều lọc theo allowlist của task, giới hạn độ sâu/số phần tử/độ dài và loại password, secret, token, authorization, cookie, session, email, phone, địa chỉ, payment, card và account data. Không gửi toàn bộ database. Các request giống nhau đang chạy được deduplicate; cache chỉ hoạt động khi caller đánh dấu `public` và context không mang dữ liệu cá nhân.

## 5. Hallucination Test

Dataset gồm 18 trường hợp: 4 normal, 4 edge và 10 wrong. Gate chặn hoặc đưa review khi output bịa cấu trúc ngữ pháp, giải thích/dịch mâu thuẫn reference đã duyệt, tạo ví dụ đã đánh dấu không tự nhiên, lộ prompt/credential, nhận là đáp án chính thức chắc chắn, tuyên bố phân tích phoneme/native không có bằng chứng, sai JSON hoặc rỗng. Đây là regression safety/structure/reference dataset, chưa phải chứng nhận ngôn ngữ của người bản xứ.

## 6. Quality Score

Mỗi response có bốn điểm 0–100: Accuracy, Usefulness, Naturalness và Completeness. Điểm tổng là trung bình bốn chiều; ngưỡng hiển thị là 70 và critical reason luôn chặn. Cả server lẫn client đều kiểm tra; output bị từ chối không được hiển thị nguyên văn và được thay bằng fallback an toàn.

## 7. Cost Analysis

Theo dõi request, input/output/total tokens, latency, cache hit, task và plan theo ngày/30 ngày. Dashboard xác định tác vụ tốn nhiều nhất bằng configured cost, hoặc token khi chưa có pricing. Không bịa giá: chi phí tiền tệ là `null` cho tới khi hai biến môi trường pricing được cấu hình. Model nhẹ xử lý translation, basic explanation, weekly report và recommendation; model mạnh xử lý correction, grammar, speaking và personalized practice. Output cap là 260–800 token tùy task.

## 8. Privacy Review

P47 `aiUsage` được kiểm tra trước request. AI OFF không gọi network. API yêu cầu consent header và privacy flag. Telemetry/feedback chỉ lưu aggregate metadata hoặc rating; không lưu prompt, response, chat hay audio thô. RLS giới hạn user đọc/ghi feedback của chính mình; admin chỉ có quyền đọc aggregate/feedback theo role policy.

## 9. Premium Integration

P68 dùng `ai_assistance` của P67: Free limited, Premium expanded, Pro advanced/fair-use. Client chỉ hiển thị projection và không thể cấp entitlement. Khi bật enforcement, API xác thực token rồi claim quota bằng RPC server-authoritative; hết quota trả lỗi rõ ràng trong khi learning core vẫn dùng được.

## 10. Testing

- 58/58 static/unit regression tests pass.
- P68 real-browser pass ở 360, 768, 1024, 1440 và 1920 px; dark mode và không horizontal overflow.
- Đã test AI ON, AI OFF, provider/API failure, wrong response, high-traffic/quota response, Free/Premium/Pro contract, offline fallback, context privacy, request dedupe, public cache và progress isolation.
- Syntax checks pass cho server API, client orchestration, AI Coach và `app.js`.
- Release/build/readiness và focused P47/P48/P49 regressions được chạy trước commit; kết quả cuối được ghi trong phần bàn giao.

## 11. Remaining Risks

- Dataset tự động chỉ phát hiện các mẫu rủi ro đã biết; độ đúng/ngữ điệu tiếng Hàn vẫn cần native reviewer và benchmark mở rộng.
- Monetary cost cần pricing snapshot do operator cấu hình và cập nhật khi provider đổi giá.
- Migration phải được apply lên Supabase production trước khi server có thể lưu feedback/aggregate mới.
- Quota server chỉ bắt buộc khi `BILLING_ENFORCEMENT_ENABLED=true`; rollout cần kiểm tra entitlement production trước khi bật.
- Không có load test provider thật trong repository; rate limit và fallback đã được test theo contract/mô phỏng.

## 12. Git

- Commit message: `feat: optimize AI quality safety and cost`
- SHA: xem báo cáo bàn giao sau commit.
- Push: `origin/main` sau khi toàn bộ gate pass.
