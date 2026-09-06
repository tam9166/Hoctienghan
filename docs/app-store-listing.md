# Tiếng Hàn - TamHoanq — App Store preparation

## Store metadata

- Tên: **Tiếng Hàn - TamHoanq**
- Danh mục: **Education**
- Subtitle: **Học Hangul, giao tiếp và luyện TOPIK**
- Mô tả ngắn: **Lộ trình tiếng Hàn cho người Việt, từ Hangul đến TOPIK, với ôn tập thông minh và học ngoại tuyến.**
- Từ khóa: `học tiếng Hàn, Hangul, TOPIK, từ vựng, luyện nghe, luyện nói`

## Mô tả dài dự kiến

Tiếng Hàn - TamHoanq giúp người Việt học theo lộ trình rõ ràng: bắt đầu với Hangul, xây nền từ vựng và ngữ pháp, luyện bốn kỹ năng, rồi chuẩn bị cho TOPIK. Người học có thể tải từng gói bài để học khi mạng yếu, ôn đúng lúc bằng SRS và theo dõi tiến độ cá nhân. Camera reader xử lý nội dung ngay trên thiết bị khi trình duyệt hỗ trợ và không tự tải ảnh lên máy chủ.

## Asset checklist

- Icon nguồn: `icons/logo-source.svg`
- PWA icon: `icons/icon-192.png`, `icons/icon-512.png`
- Apple touch icon: `icons/apple-touch-icon.png`
- Android adaptive icon foreground/background: cần xuất từ logo nguồn khi tạo wrapper.
- iOS AppIcon set: cần xuất từ logo nguồn khi tạo Xcode project.
- Screenshots: cần chụp từ build release trên thiết bị/emulator; không dùng mockup để thay thế ảnh sản phẩm thật.

Các màn hình bắt buộc khi chụp: Home cá nhân hóa, bài Hangul, ôn SRS, luyện nói, TOPIK và offline pack. Kiểm tra bản 360×800, tablet và dark mode trước khi chụp store.

## Release checklist

- Hoàn thiện privacy policy URL và khai báo Data Safety/App Privacy.
- Kiểm tra quyền microphone, camera và notification có purpose string rõ ràng.
- Xác minh account deletion/data export, restore purchase (nếu có subscription) và deep link shortcut.
- Test background audio bằng asset có quyền sử dụng trên thiết bị khóa màn hình.
- Dùng secret manager cho signing key, push key và store credential; không commit secret.
