# Mobile native application

Thư mục này chứa Capacitor shell có thể tái tạo cho Android/iOS của **Tiếng Hàn - TamHoanq**. Web app vẫn là nguồn UI và dữ liệu chính; wrapper chỉ cung cấp capability hệ điều hành qua các service trong `mobile-app.config.json`.

## Nguyên tắc tích hợp

- Không tạo database hay format tiến độ riêng cho mobile. Auth, CloudSync, SRS, Mastery và History tiếp tục dùng service hiện tại.
- Notification chỉ được xin quyền sau thao tác rõ ràng của người dùng. Chính sách trong `content/mobile-experience.json` giới hạn 2 thông báo/ngày, cách nhau ít nhất 6 giờ và giữ yên lặng 22:00–07:00.
- Camera được xử lý cục bộ; ảnh và text không được tự upload hoặc lưu.
- Background audio chỉ bật với URL audio thật qua HTML Audio + Media Session. Speech synthesis không được quảng bá là audio chạy khi khóa màn hình.
- Offline pack dùng Cache Storage và `OfflinePackService`; không ghi audio/blob lớn vào localStorage hoặc CloudSync.

## Build shell

```bash
npm ci
npm run build
npm run doctor
npx cap add android
npm run configure:android
npx cap add ios
npm run configure:ios
npx cap sync
```

`npm run build:release` yêu cầu `MOBILE_API_BASE_URL` dùng HTTPS. Thư mục `www/`, `android/` và `ios/` được sinh lại và không commit. Cấu hình signing, FCM/APNs, privacy declaration và store credential phải ở secret manager/CI.

Trạng thái hiện tại là **reproducible native shell**: source bridge, dependency lock và unsigned validation pipeline đã sẵn sàng. Chưa có binary đã ký hoặc store listing được phát hành. Xem [tài liệu P56](../docs/mobile-native-ecosystem.md).
