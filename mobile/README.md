# Mobile application foundation

Thư mục này mô tả contract cho wrapper Android/iOS của **Tiếng Hàn - TamHoanq**. Web app vẫn là nguồn UI và dữ liệu chính; wrapper native chỉ cung cấp capability của hệ điều hành qua các service được khai báo trong `mobile-app.config.json`.

## Nguyên tắc tích hợp

- Không tạo database hay format tiến độ riêng cho mobile. Auth, CloudSync, SRS và Mastery tiếp tục dùng service hiện tại.
- Notification chỉ được xin quyền sau thao tác rõ ràng của người dùng. Chính sách trong `content/mobile-experience.json` giới hạn 2 thông báo/ngày, cách nhau ít nhất 6 giờ và giữ yên lặng 22:00–07:00.
- Camera được xử lý cục bộ; ảnh và text không được tự upload hoặc lưu.
- Background audio chỉ bật với URL audio thật qua HTML Audio + Media Session. Speech synthesis không được quảng bá là audio chạy khi khóa màn hình.
- Offline pack dùng Cache Storage và `OfflinePackService`; không ghi audio/blob lớn vào localStorage hoặc CloudSync.

## Tạo wrapper sau này

1. Chọn Capacitor (hoặc wrapper tương thích) và dùng app id `com.tamhoanq.korean`.
2. Build web production vào một thư mục riêng rồi cập nhật `webDir`; không trỏ native build vào repository source.
3. Map các bridge service trong config sang plugin Android/iOS, giữ fallback web trong `data/mobile-experience.js`.
4. Cấu hình signing, push provider, privacy declarations và store credentials ở secret manager/CI. Không commit các giá trị đó.
5. Chạy regression Auth, CloudSync, offline, notification, camera và audio trên thiết bị thật trước khi phát hành.

Trạng thái hiện tại là **foundation-ready**: PWA và contract đã sẵn sàng, nhưng chưa sinh project Xcode/Gradle và chưa tuyên bố có binary native.
