# Incident response

## Severity

- **SEV-1:** app không truy cập được, mất/rò rỉ dữ liệu, Auth sai quyền, backup/restore thất bại khi cần.
- **SEV-2:** Auth/CloudSync/TOPIK hỏng diện rộng, API lỗi cao, performance nghiêm trọng.
- **SEV-3:** một module có fallback hoặc lỗi UI không mất dữ liệu.

## Vai trò

- Incident commander: ra quyết định và giữ timeline.
- Technical lead: chẩn đoán, rollback/fix.
- Communications lead: status update và user support.
- Scribe: ghi evidence, action, decision và timestamp.

Một người có thể kiêm nhiệm khi team nhỏ, nhưng phải ghi rõ ai đang giữ vai trò.

## Quy trình 15 phút đầu

1. Xác nhận alert, release, region và phạm vi; không dùng dữ liệu user thật để debug công khai.
2. Mở incident record: `INC-YYYYMMDD-NNN`, severity, owner, startedAt.
3. Freeze deployment. Nếu liên quan release gần nhất, rollback artifact Vercel trước.
4. Nếu nghi rò rỉ: thu hồi/rotate key tại provider, không ghi key vào issue/chat.
5. Nếu database: chuyển sang read-only/maintenance theo khả năng, bảo toàn backup và audit log.
6. Cập nhật trạng thái theo chu kỳ: SEV-1 15 phút, SEV-2 30 phút, SEV-3 khi có thay đổi quan trọng.

## Khôi phục và hậu kiểm

- Chạy smoke test, P47 data safety, Auth, CloudSync, offline queue và 360/1440 responsive.
- Theo dõi tối thiểu 30 phút sau recovery.
- Postmortem không quy lỗi trong 3 ngày làm việc: impact, root cause, detection gap, timeline, action owner/deadline.
- Không đóng incident khi chưa xác nhận dữ liệu user không bị mất hoặc đã có kế hoạch khôi phục.
