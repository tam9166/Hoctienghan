# Backup & restore strategy

## Mục tiêu

- RPO launch: 24 giờ với daily backup; mục tiêu sau launch là PITR nếu yêu cầu RPO ngắn hơn.
- RTO launch: 4 giờ, phụ thuộc dung lượng database và thời gian restore của nhà cung cấp.
- Mọi restore phải được kiểm tra trên project cô lập trước khi chuyển traffic.

## Lớp bảo vệ

1. **Thiết bị:** local-first checkpoint hàng giờ, daily/weekly snapshots hiện có; không thay thế backup server.
2. **Supabase managed backup:** xác nhận plan và retention trong Database > Backups. Pro/Team/Enterprise có daily managed backups; bật PITR nếu business RPO yêu cầu.
3. **Logical off-site backup:** nếu plan không có managed retention phù hợp, chạy `supabase db dump`/`pg_dump`, mã hóa trước khi lưu, giữ credential ngoài repo.
4. **Storage objects:** backup database không khôi phục object đã xóa trong Storage. Khi app bật upload audio/tệp thật, phải thêm inventory và object backup riêng.

## Lịch

- Hàng ngày: kiểm tra backup mới nhất và job status.
- Hàng tuần: logical backup mã hóa nếu chính sách yêu cầu.
- Hàng tháng: kiểm tra khả năng đọc artifact, checksum và retention.
- Hàng quý: restore drill sang project cô lập, chạy migrations, RLS tests và smoke test.

## Restore runbook

1. Dừng write/deploy; ghi recovery point và incident ID.
2. Chọn backup/PITR point ngay trước sự cố.
3. Restore sang project cô lập; không overwrite production khi chưa xác minh.
4. Kiểm tra schema/migration, Auth, RLS, `learning_sync`, row counts và sample owner access.
5. Chạy production smoke test và kiểm tra CloudSync conflict/CAS.
6. Chuyển cấu hình production hoặc restore production trong maintenance window.
7. Xác nhận user data, theo dõi queue, ghi actual RPO/RTO và postmortem.

Không commit dump, database URL, access token hoặc encryption key. Tham khảo: [Supabase Database Backups](https://supabase.com/docs/guides/platform/backups).
