# P77 PREMIUM MONETIZATION REPORT

## 1. Subscription Model

- Chuẩn hóa ba plan sản phẩm: `free`, `premium`, `teacher_pro`; cấu hình nằm trong `content/premium-monetization-platform.json` để có thể thêm plan/feature mà không hard-code UI.
- Free giữ Beginner Foundation, TOPIK 1 cơ bản, SRS, Learning Journey và Basic Report.
- Premium mở TOPIK nâng cao, AI Speaking nâng cao, Advanced Learning Report, Offline Pack mở rộng, Career Korean và Premium Course.
- Teacher Pro mở Creator Studio nâng cao, Classroom, Student Analytics và Course Management.
- Plan `pro` từ P67 được giữ làm legacy alias sang Premium; dữ liệu subscription cũ không bị mất.

## 2. Data Architecture

- `commercial_subscriptions` có đủ ID, user, plan/tier, status, start/end date, provider, auto-renew và created timestamp; status hỗ trợ `trial`, `active`, `expired`, `cancelled`, `pending`.
- Thêm resource entitlement, purchase history, course learning progress, creator balance, mock payment session, trial lifecycle event và conversion aggregate.
- Existing user được thêm record Free bằng `insert ... on conflict do nothing`; migration không sửa Auth, progress, SRS, Mastery, Adaptive hoặc CloudSync.
- Course P76 được mở rộng bằng access level, price, currency, creator/revenue share, subscription eligibility, landing slug, preview lesson, sales count và gross revenue; owner hiện tại được giữ nguyên.

## 3. Premium Access

- `p77_check_resource_access` là RPC security-definer kiểm tra subscription hiện hành và purchase đã hoàn tất.
- Resource Free luôn được phép; Premium Course có thể mở bằng subscription hợp lệ hoặc purchase riêng; Teacher Pro chỉ mở đúng entitlement Teacher Pro.
- UI preview chỉ dùng để trình bày. `BackendEntitlementService.clientCanGrant()` luôn false và mọi unlock trả phí phải có kết quả server-verified.
- Subscription hết hạn/pending fallback về Free, không khóa dữ liệu hay Learning Core.

## 4. Payment Layer

- Payment Provider interface gồm `createCheckout`, `verifyTransaction`, `refund`, `normalizeEvent`.
- Registry hiện kích hoạt Mock Provider; adapter slot đã chuẩn bị cho Stripe, Google Play, Apple Store và Vietnam gateway.
- Mock checkout subscription không cấp entitlement; mock course purchase chỉ unlock sau RPC server và dùng idempotency key.
- Live payment/payout bị tắt cho tới khi có credentials, signed webhook và store-policy review.

## 5. Trial System

- Premium trial 7 ngày, một lần/account, không cần payment method, không auto-charge và `auto_renew=false`.
- Chỉ account mới trong cửa sổ 30 ngày được trial.
- API băm installation integrity token bằng HMAC trước khi gửi vào database, giúp hạn chế nhiều account trên cùng installation mà không lưu định danh thiết bị thô.
- Theo dõi đủ `trial_started`, `trial_completed`, `trial_expired`, `converted`; trigger lifecycle ghi event khi subscription chuyển trạng thái.

## 6. Creator Revenue Foundation

- Premium Course mặc định revenue share 70% creator / 30% platform, có thể cấu hình trong giới hạn server.
- Purchase transaction cập nhật atomically `sales_count`, `gross_revenue`, `creator_balance` và `platform_revenue`.
- Creator không thể mua course của chính mình; price và revenue share được snapshot vào purchase history.
- Đây là revenue estimate/ledger foundation; thanh toán tiền thật cho creator chưa được bật.

## 7. Business Dashboard

- Admin RPC trả Total Users, Premium Users, Revenue, Subscription Status, Popular Courses và Creator Performance.
- Teacher/Creator RPC trả students aggregate, course count, starts, completions, completion rate, sales và revenue estimate.
- Teacher dashboard không trả learner ID, email, progress cá nhân hay dữ liệu học riêng tư; response đánh dấu `aggregate_only_no_learner_identity`.
- UI có Premium Benefits, plan comparison, Premium Course landing/preview, My Purchases, Admin Business và Teacher Business.

## 8. Security

- RLS được bật cho toàn bộ bảng P77; purchase/balance/trial/dashboard đều user/role scoped.
- Không lưu card number, CVC, payment secret hoặc provider secret; purchase chỉ lưu provider transaction ID.
- Purchase RPC khóa course row bằng `FOR UPDATE`, kiểm tra ownership/status/price và chống lặp bằng unique idempotency key.
- Creator ownership từ P76 là immutable; migration không thay đổi content owner.
- Client không có đường grant subscription, xác nhận payment hoặc publish entitlement.

## 9. Migration

- Migration: `supabase/migrations/20260917_p77_premium_monetization_platform.sql`.
- Additive migration giữ nguyên user hiện tại, learning history, achievement, SRS, mastery, adaptive state và CloudSync.
- Existing users nhận Free mặc định; existing subscriptions và legacy `pro` tiếp tục hoạt động.
- Migration production vẫn cần được apply qua Supabase deployment pipeline trước khi bật API P77.

## 10. Testing

- Unit/regression: **76/76 suites passed**.
- P77 unit test bao phủ plan/status, expiration, Free access, backend entitlement, Teacher Pro, legacy plan, trial, course preview/purchase, creator revenue, purchase history, dashboards, privacy và migration preservation.
- Payment infrastructure test bao phủ provider interface, mock adapter, server verification, HMAC trial integrity, idempotent purchase contract và secret scan.
- Real-browser P77 pass tại **360, 390, 430, 768, 1024, 1440, 1920 px**, dark mode, không horizontal overflow, touch target tối thiểu 44px, Free/Premium/Teacher Pro/expired và course preview.
- Browser regression P67, P75 và P76 pass; progress và SRS fixtures không đổi.
- P49 offline lazy-route browser check vẫn fail ở fallback của route Advanced Voice (không thuộc file P77); các unit performance/offline và P77 offline-preservation assertions vẫn pass. Cần xử lý trong mobile/offline hardening tiếp theo.
- `git diff --check`: pass; chỉ có cảnh báo LF/CRLF của Git trên Windows.

## 11. Remaining Risks

- Mock Provider chỉ phục vụ kiến trúc/test, không phải thanh toán thật.
- Signed webhook, refund reconciliation, tax/invoice, chargeback và creator payout/KYC chưa triển khai.
- Trial anti-abuse là account + installation hash foundation, chưa thay thế risk engine/device attestation production.
- Conversion daily cần scheduled aggregation job; dashboard hiện đọc ledger/aggregate hiện có.
- Course completion rate cần Learning Core ghi `commercial_course_learning_progress` khi production course player được nối hoàn chỉnh.
- P49 Advanced Voice offline lazy-route fallback cần được sửa và chạy lại trong P78 Offline First.

## 12. Git SHA

- Feature commit: `df65a1148a916506c7756db8ae85610e3ec716f3`
- Commit message: `feat: build premium monetization platform`
- Branch: `main`
- Remote deployment chưa thực hiện trong bước này; Supabase migration và production environment cần pipeline bên ngoài repository.

Learning Quality vẫn là trung tâm: Free giữ trải nghiệm học thật, UI không spam nâng cấp, và không có mutation thương mại nào được phép xóa hoặc khóa dữ liệu học hiện có.
