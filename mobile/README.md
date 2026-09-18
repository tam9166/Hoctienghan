# P78 Mobile Native Experience Platform

Thư mục này chứa Capacitor 8 shell có thể tái tạo cho Android/iOS của **Tiếng Hàn - TamHoanq**. Mobile dùng cùng UI component, Auth, CloudSync, SRS, Adaptive Engine, AI Coach, Content và Subscription với Web/PWA; wrapper chỉ cung cấp capability hệ điều hành qua các service trong `mobile-app.config.json`.

## Nguyên tắc tích hợp

- Không tạo database hay format tiến độ riêng cho mobile. Auth, CloudSync, SRS, Mastery và History tiếp tục dùng service hiện tại.
- Notification chỉ được xin quyền sau thao tác rõ ràng của người dùng. Chính sách trong `content/mobile-experience.json` giới hạn 2 thông báo/ngày, cách nhau ít nhất 6 giờ và giữ yên lặng 22:00–07:00.
- Camera được xử lý cục bộ; ảnh và text không được tự upload hoặc lưu.
- Background audio chỉ bật với URL audio thật qua HTML Audio + Media Session. Speech synthesis không được quảng bá là audio chạy khi khóa màn hình.
- Offline pack dùng Cache Storage và `OfflinePackService`; không ghi audio/blob lớn vào localStorage hoặc CloudSync.
- Phiên Supabase native dùng Keychain/Keystore qua secure-storage adapter. Biometric chỉ mở lại phiên hiện hữu và không nhận/lưu dữ liệu sinh trắc học.
- Bottom navigation có 5 mục ở mobile: Home, Learn, Practice, AI, Profile. Hợp đồng P78 kiểm tra 320/360/390/430 px và touch target 48 px.
- Audio thật có thể cache vào native filesystem, phát nền và đổi tốc độ; microphone luôn fallback về text nếu thiếu quyền hoặc phần cứng.
- Deep link chỉ nhận các target allowlist: lesson, course, challenge, achievement.

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

Artifact Android cục bộ có thể tạo bằng `mobile/android/gradlew.bat assembleDebug bundleRelease` sau khi add/sync Android. iOS archive validation phải chạy trên macOS bằng workflow `Mobile native`; signing và upload store vẫn cần credential của chủ sở hữu.

Metadata, privacy declaration và danh sách screenshot nằm trong `mobile/store/`. Screenshot được tạo lại bằng `node scripts/capture-store-screenshots.mjs http://127.0.0.1:4173/` khi app đang được serve.

`npm run build:release` yêu cầu `MOBILE_API_BASE_URL` dùng HTTPS. Thư mục `www/`, `android/` và `ios/` được sinh lại và không commit. Cấu hình signing, FCM/APNs, privacy declaration và store credential phải ở secret manager/CI.

Trạng thái hiện tại là **release foundation**: source bridge, dependency lock, store metadata và unsigned Android/iOS validation pipeline đã sẵn sàng. Chưa có binary ký hoặc store listing được phát hành; đó là ranh giới cần credential và phê duyệt của chủ sở hữu. Xem [tài liệu nền P56](../docs/mobile-native-ecosystem.md).
