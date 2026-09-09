# Chính sách quyền riêng tư — bản chuẩn bị phát hành

> Trạng thái: draft. Product owner phải bổ sung ngày hiệu lực, pháp nhân/chủ thể vận hành, email hỗ trợ và public HTTPS URL trước khi đưa lên store.

Tiếng Hàn - TamHoanq lưu dữ liệu cần thiết để cung cấp tài khoản và trải nghiệm học: email/tài khoản đăng nhập, tiến độ bài học, SRS, mastery, lịch sử luyện tập, cài đặt và nội dung người dùng chủ động lưu. Dữ liệu cloud được liên kết với tài khoản Supabase; chế độ local-first vẫn hoạt động trên thiết bị.

Ứng dụng chỉ sử dụng AI khi người dùng cho phép. Nội dung cần xử lý được gửi qua API của ứng dụng theo chính sách hiện có; password, access token và toàn bộ cơ sở dữ liệu học không được đưa vào AI context. Telemetry là tùy chọn và không theo dõi người dùng ngoài ứng dụng.

Camera và microphone chỉ được mở sau thao tác của người dùng. Ảnh quét menu/biển báo được xử lý tạm thời và không tự upload hoặc lưu. Bản ghi giọng nói không được đưa vào CloudSync trừ khi một tính năng tương lai giải thích rõ và có consent mới.

Push notification là opt-in. Token thiết bị được lưu tách khỏi dữ liệu học để gửi review, daily mission hoặc goal reminder; người dùng có thể tắt thông báo và thu hồi đăng ký. Ứng dụng không sử dụng token cho quảng cáo hay tracking.

Người dùng có thể quản lý CloudSync/AI/telemetry, xuất dữ liệu và yêu cầu xóa tài khoản trong Privacy Center. Yêu cầu xóa cloud cần được backend xác minh trước khi thực thi; ứng dụng không yêu cầu người dùng xóa localStorage để xử lý sự cố.

Không bán dữ liệu cá nhân, không dùng quảng cáo theo dõi và không lưu credential trong repository hoặc public app bundle. Nhà cung cấp hạ tầng hiện gồm Supabase và dịch vụ AI do product owner cấu hình; danh sách/retention/subprocessor phải được pháp lý xác nhận trước launch.

Liên hệ quyền riêng tư: **[BỔ SUNG EMAIL THUỘC DOMAIN CHÍNH THỨC]**.
