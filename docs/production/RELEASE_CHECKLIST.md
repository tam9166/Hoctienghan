# Production release checklist

## 1. Scope & version

- [ ] `version.json` dùng SemVer, channel/release ID đúng.
- [ ] Release notes nêu user impact, migration, rollback và known issues.
- [ ] Git tag khớp chính xác `v<version>`; working tree sạch.

## 2. Quality gates

- [ ] CI xanh: syntax, production build, readiness và tất cả `tests/*.test.js`.
- [ ] Browser QA: 360/768/1024/1440/1920, light/dark, no overflow.
- [ ] P47 Auth/data safety, P49 offline/PWA/performance và P50 product polish đạt.
- [ ] Demo flow refresh/offline đạt; không có console error blocker.
- [ ] Accessibility: keyboard, focus, labels, contrast và reduced motion.

## 3. Data & security

- [ ] Tất cả Supabase migrations đã apply trên staging và production theo thứ tự.
- [ ] RLS/role tests đạt; anon key là publishable, không có service-role trên client.
- [ ] Secret scan đạt; environment secrets có owner và rotation date.
- [ ] Backup mới nhất thành công; restore drill còn trong chu kỳ.
- [ ] Privacy/terms/support contact đã được product owner/pháp lý phê duyệt.

## 4. Infrastructure

- [ ] Domain, DNS, TLS, canonical redirect và Supabase OAuth redirect allowlist đúng.
- [ ] GitHub `production` environment có approval và secrets.
- [ ] Vercel production variables đầy đủ; `/api/health` không degraded.
- [ ] `PRODUCTION_URL` repository variable đã bật production monitor.
- [ ] Incident commander/on-call và support owner đã được chỉ định.

## 5. Deploy & verify

- [ ] Environment approval đã được duyệt.
- [ ] Deployment URL smoke test đạt trước canonical domain.
- [ ] Home, register/login, lesson, review, AI fallback, analytics và support đã kiểm tra.
- [ ] Refresh/offline/service worker update từ release trước đã kiểm tra.
- [ ] Theo dõi health/error/latency tối thiểu 30 phút.

## 6. Rollback

- [ ] Ghi deployment ID ổn định trước.
- [ ] Migration có kế hoạch forward-fix/restore; không rollback phá hủy user data.
- [ ] Khi smoke test thất bại: dừng promote, rollback artifact, mở incident và thông báo support.

Release chỉ được go khi mọi blocker đã check. Mục chưa đủ bằng chứng không được tự động đánh dấu đạt.
