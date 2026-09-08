# User support

## Kênh và phân loại

In-app route `#support` là điểm tiếp nhận chính. Trước launch, product owner phải cấu hình một email support thuộc domain thật trong kênh vận hành; không hardcode email cá nhân trong source.

| Loại | Ví dụ | Phản hồi ban đầu |
|---|---|---|
| Account/Auth | không đăng nhập, email confirm | 1 ngày làm việc |
| Data/Sync | tiến độ không đồng bộ | 4 giờ, chuyển SEV nếu diện rộng |
| Content | sai nghĩa, audio, ví dụ | 2 ngày làm việc |
| Billing | premium/payment foundation | 1 ngày làm việc; không hứa refund khi payment chưa tích hợp |
| Privacy/Security | export/delete/rò rỉ | ngay lập tức, theo Incident Response |

## Thông tin được phép hỏi

- Version và commit từ `/api/version`.
- Thiết bị/trình duyệt, thời điểm, route và bước tái hiện.
- Trạng thái online/offline và sync badge.

Không yêu cầu password, OTP, access/refresh token, API key, full database dump, raw private journal/chat/audio. Screenshot phải được user tự kiểm tra thông tin nhạy cảm.

## Triage

1. Gắn category, severity, module, version và reproducibility.
2. Tìm duplicate; liên kết incident nếu nhiều user bị ảnh hưởng.
3. Trả lời workaround an toàn; không bảo user xóa localStorage/reset dữ liệu.
4. Xác minh fix bằng test và release ID, sau đó đóng ticket với ghi chú.
