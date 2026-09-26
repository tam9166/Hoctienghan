# UX P1 FIX REPORT

## P1-01 Progress Route

- Đã chuẩn hóa ngày từ Study Calendar và dữ liệu legacy bằng fallback an toàn.
- Ngày không hợp lệ hiển thị `—` hoặc `Đã ghi nhận`, không còn làm crash route `#learning-progress`.

## P1-02 Today Plan Mobile

- CTA “BẮT ĐẦU HỌC HÔM NAY” nằm ngay sau tiêu đề Today Plan, trước danh sách nhiệm vụ.
- Đã kiểm tra 320/360/390/430px và không tạo horizontal overflow.

## P1-03 Registration Timing

- Thêm `sample-lesson` public route: người dùng chưa đăng nhập có thể học thử và làm quick check.
- Hoàn tất học thử mới đề xuất đăng ký để lưu tiến độ; route cá nhân hóa vẫn yêu cầu auth.
- Học thử không ghi, sửa hoặc xóa dữ liệu local.

## P1-04 Profile / Assistant

- Profile có learner summary và nhóm chi tiết kỹ thuật được đóng mặc định bằng `<details>`.
- Assistant có summary hướng hành động; công cụ nâng cao/chi tiết AI nằm trong disclosure riêng.

## P1-05 SRS Quota Recovery

- Bắt `QuotaExceededError`, giữ payload ghi lỗi trong bộ nhớ phiên và hiển thị banner tiếng Việt.
- Có “Thử lại” và “Quản lý dữ liệu”; không tự động xóa SRS hay dữ liệu học.
- `saveUserSrs` chỉ schedule CloudSync khi local write thành công.

## Tests

- `node tests/ux-p1-fixes.test.js` — pass 5/5 contract tests.
- `node tests/ux-p1-fixes-responsive.browser.js` — pass: sample lesson, invalid Progress date, 360px Today Plan, Profile, Assistant, SRS quota recovery.
- Toàn bộ static `tests/*.test.js` — pass.

## Browser

- P79 responsive — pass.
- P80 responsive — pass.
- P81 responsive — pass.
- Adaptive assistant responsive — pass.
- Product UX responsive — pass tại 360/768/1024/1440/1920px.
- P84-P0 vocabulary daily action — pass sau khi bổ sung anchor tương thích cho compact Home.

## Regression

- `git diff --check` — pass.
- `node scripts/release-readiness.js` — pass; chỉ còn cảnh báo môi trường production đã có từ trước.
- Không migration/database/Supabase/UI logic ngoài phạm vi P1 được thay đổi.
- Full sweep 62 browser suites đã được chạy; các suite legacy còn báo selector Home/engagement cũ hoặc cold decoded budget P49, không liên quan 5 lỗi P1 và không được mở rộng thành P2 trong task này.

## Git

- Commit: `fix: resolve critical UX audit issues`
- Push: `origin/main`
