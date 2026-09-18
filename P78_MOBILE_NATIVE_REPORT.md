# P78 MOBILE NATIVE REPORT

## 1. Architecture

- Giữ một Learning Core dùng chung cho Web, Android và iOS; native shell dùng Capacitor 8, không fork business logic học tập sang một codebase riêng.
- Contract trung tâm nằm tại `content/mobile-native-platform.json`; service orchestration nằm tại `data/mobile-native-platform.js`; bridge plugin nằm tại `mobile/src/native-plugins.js`.
- Native bundle được tạo bởi `mobile/scripts/build-web.mjs`, còn cấu hình project Android/iOS được áp dụng bằng `mobile/scripts/configure-generated.mjs`.
- Luồng Auth Supabase trên native dùng `SecureStorageAdapter`, đưa session vào iOS Keychain/Android Keystore thay vì local storage thường.
- P78 được lazy-load trên Web để không tăng critical path của trải nghiệm desktop; các rule thiết yếu của bottom navigation vẫn nằm trong critical mobile CSS.

## 2. Mobile UX

- Tối ưu các màn hình Home, Learn, Practice, Speaking và Profile tại **320, 360, 390 và 430 px**.
- Touch target tối thiểu **48 px**, có safe-area inset, bottom spacing và bố cục một tay cho điện thoại nhỏ.
- Mobile Experience Center trình bày trạng thái offline, audio, microphone, notification, biometric, storage và deep link bằng ngôn ngữ dễ hiểu.
- Dark mode, progress, SRS, subscription và Learning Core hiện có được giữ nguyên; không tạo luồng mobile làm mất hay ghi đè dữ liệu học.
- Bộ screenshot store tiếng Việt đã được tạo và kiểm tra trực quan tại `mobile/store/screenshots/vi/` cho 5 bề mặt chính.

## 3. Navigation

- Bottom navigation cố định gồm đúng 5 mục: **Home, Learn, Practice, Speaking, Profile**.
- Navigation xử lý safe area, active state, keyboard/viewport nhỏ và không gây horizontal overflow.
- Deep-link allowlist chỉ nhận các route `lesson`, `course`, `challenge`, `achievement`; URL ngoài allowlist không được điều hướng vào app.
- P78 có route `mobile-native-p78` và entry trong Profile, đồng thời giữ tương thích với route loader/offline shell hiện có.

## 4. Audio System

- Audio service hỗ trợ nguồn network và filesystem/cache, có offline source fallback và các tốc độ phát được khai báo trong contract.
- Android được cấu hình foreground media/audio; iOS được cấu hình background audio mode.
- Native bridge hỗ trợ status bar, splash screen và haptic feedback để phản hồi thao tác không phụ thuộc browser API.
- Build/doctor xác nhận plugin bundle native **271,157 bytes**, dưới budget đã đặt.

## 5. Speaking Experience

- Luồng Speaking khai báo rõ microphone permission, recording state, visualizer, retry và text fallback khi microphone bị từ chối hoặc không khả dụng.
- Android có `RECORD_AUDIO`; iOS có microphone usage description.
- Audio nói của người học không được persist mặc định; service chỉ duy trì state cần thiết cho phiên luyện tập.
- Browser P78 kiểm tra text fallback, speaking surface và bảo toàn progress/SRS; kiểm thử thiết bị thật vẫn là điều kiện trước khi phát hành store.

## 6. Offline

- Service Worker precache các asset P78; route module/CSS được lazy-load nhưng có offline fallback.
- Download manager quản lý pack và dung lượng; audio có thể ưu tiên filesystem/cache khi offline.
- Watchdog lazy-route P49 đã được sửa để không treo vô hạn khi offline; browser regression xác nhận offline banner và fallback đều hoạt động.
- Không thay đổi schema Learning Core, lịch sử học, SRS hoặc cloud sync hiện có.

## 7. Notification

- Người dùng có thể bật/tắt reminder và chọn thời gian; preference được lưu cục bộ và không ép opt-in.
- Android khai báo `POST_NOTIFICATIONS`; nền tảng đã có contract cho notification permission và preference.
- Push production chưa bật vì cần FCM/APNs credentials, server scheduling, token lifecycle và kiểm thử delivery thực tế.

## 8. Performance

- P78 route và CSS không nằm trong direct critical bundle của desktop; được nạp theo route/Profile entry.
- Native doctor pass với bundle budget; P49 stress regression pass với 10,000 history items và 1,000 cloud records.
- Browser P49 ghi nhận search khoảng **5.2 ms**, listener ổn định **71 → 71**, heap khoảng **4,755,040 bytes** trong fixture kiểm thử.
- Critical static budget pass với **28 direct scripts** và **7 direct styles**; browser ghi nhận 8 styles sau runtime/lazy load.

## 9. Security

- Native Supabase session dùng secure storage backed by Keychain/Keystore; biometric chỉ mở khóa phiên trên thiết bị và không thay thế server authorization.
- Biometric plugin, `USE_BIOMETRIC`, iOS Face ID usage description và secure-storage adapter đã được nối vào native shell.
- Deep links dùng allowlist; analytics dùng event allowlist, cần consent và không gửi private learning content.
- iOS App Transport Security giữ HTTPS; không nhúng production secret vào repository.
- `npm audit --prefix mobile --audit-level=high` báo **0 vulnerabilities**; secret scan không phát hiện credential pattern.

## 10. Store Readiness

- Store contract gồm `mobile/store/metadata.json`, `privacy.json`, `screenshots.json`, privacy manifest và 5 screenshot tiếng Việt.
- Android project đã configure/sync với 13 plugin native và build thành công:
  - Debug APK: `mobile/android/app/build/outputs/apk/debug/app-debug.apk` — **11,695,467 bytes** — SHA-256 `ECA445629D2497A5E99AF26326C02ABC4793230888F41041C8C250BE74522F90`.
  - Release validation AAB: `mobile/android/app/build/outputs/bundle/release/app-release.aab` — **8,335,744 bytes** — SHA-256 `3DE6D5437E8805244260D01A1136C8B6AA05F759D4A2E92B01B895824A79FBB3`.
- iOS project đã generate/configure/sync; GitHub Actions có macOS simulator build bằng `xcodebuild` với code signing tắt.
- Chưa thể tạo archive iOS trên máy Windows hiện tại. AAB hiện là artifact validation chưa ký để phát hành; production API URL, signing key, Apple/Google credentials, FCM/APNs và store submission thuộc bước release của owner.

## 11. Testing

- Unit/regression: **77/77 suites passed**; P78 unit được chạy lại sau thay đổi secure-biometric cuối và pass.
- P78 real-browser: **28 checks passed** tại 320/360/390/430 px trên Home, Lessons, Review, Speaking Hub, AI Coach, Profile và Mobile Native Center; xác nhận 5 nav items, touch target 48 px, mic fallback, deep link, progress/SRS/subscription preservation.
- P75, P76 và P77 responsive regressions pass tại các viewport từ mobile tới 1920 px.
- P49 performance/offline browser regression pass: không overflow ở 360/390/430 px, nav hiện diện, offline banner/fallback hoạt động và listener không tăng.
- `npm run build --prefix mobile`, `npm run doctor --prefix mobile`, `npm run configure:android`, `npx cap sync android`, Android Gradle APK/AAB build, `npm run configure:ios` và `npx cap sync ios` đều pass.
- `node --check` cho JavaScript liên quan và `git diff --check` pass; Git chỉ cảnh báo quy đổi LF/CRLF trên Windows.

## 12. Remaining Risks

- Chưa chạy Xcode archive/iOS simulator vì host hiện tại là Windows; workflow macOS cần chạy trên CI trước release.
- Chưa có emulator/physical-device matrix cho microphone, background audio, biometric, deep link, notification, offline download, low-storage và OS upgrade.
- Cần cấu hình production `MOBILE_API_BASE_URL`; AAB validation hiện được tạo từ bundle development với API base URL trống.
- Cần Android release signing, Apple certificates/provisioning, App Store Connect/Play Console credentials, privacy questionnaire và store review.
- Push notification cần FCM/APNs credentials và backend scheduler; analytics production cần consent policy/endpoint thực tế.
- Cần accessibility audit với TalkBack/VoiceOver và QA mạng yếu trên thiết bị thật trước khi tuyên bố production store release.

## 13. Git SHA

- Feature commit: `fd799de93d661bdf3a854c3f3397006817450aa9`
- Commit message: `feat: build mobile native experience platform`
- Branch: `main`
- Baseline P77 report commit: `8fbd303c50014017c40fad3ef9a8a944c3e8948c`

P78 hoàn thành nền tảng mobile native có source/build/test evidence và artifact Android kiểm chứng được. Trạng thái hiện tại là **release-candidate foundation**, chưa phải store release production cho đến khi hoàn tất signing, credentials, CI macOS và device QA nêu trên.
