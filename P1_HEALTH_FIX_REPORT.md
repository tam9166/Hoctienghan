# P1 Production Health Fix Report

Ngày kiểm tra: 2026-09-27  
Production Domain: [https://hoctienghan-eight.vercel.app](https://hoctienghan-eight.vercel.app)  
Deployed commit trước khi sửa: `93e3e1064ccbf66617de6b11a698d60340b92403`

## Phạm vi

Chỉ xử lý P1 của `GET /api/health`. Không thay đổi Adaptive CTA, SRS, TOPIK, Error Notebook, vocabulary/listening, UI, schema, migration hoặc RLS.

## Kết luận nguyên nhân

Root cause đã được xác minh trong `api/health.js`:

1. Health probe cũ gọi `GET ${SUPABASE_URL}/rest/v1/` bằng `SUPABASE_ANON_KEY`.
2. Production Supabase trả HTTP 401 với thông báo `Secret API key required` cho endpoint gốc này. Đây là endpoint yêu cầu secret key, trong khi ứng dụng được thiết kế dùng public/publishable key.
3. `api/health.js` coi mọi phản hồi không `2xx`/`404` là `database.status = degraded`, sau đó trả HTTP 503.

Đây là lỗi probe/API compatibility, không phải bằng chứng database production bị unreachable hoặc public key hết hạn.

## Bằng chứng production (read-only)

Các kiểm tra dùng đúng domain canonical và không ghi dữ liệu:

| Kiểm tra | Kết quả |
|---|---|
| `GET /api/config` | HTTP 200, `configured: true`; chỉ ghi nhận tên cấu hình, không ghi giá trị bí mật |
| `GET https://oqtpefymwmoesvsbojah.supabase.co/rest/v1/` với public key | HTTP 401, `Secret API key required` |
| `GET /auth/v1/settings` với public key | HTTP 200 |
| `GET /rest/v1/learning_sync?select=user_id&limit=0` với public key | HTTP 200, `[]` |
| Cùng truy vấn với key giả | HTTP 401, `Invalid API key` |
| `GET /rest/v1/user_learning_records?select=user_id&limit=0` unauthenticated | HTTP 401, permission denied (phù hợp RLS/privilege boundary) |
| `GET /api/health` trước bản sửa | HTTP 503, `database.status = degraded` |

Probe mới dùng truy vấn zero-row tới bảng `learning_sync` bắt buộc của local schema:

```text
/rest/v1/learning_sync?select=user_id&limit=0
```

Probe không đọc payload học tập, không cần service-role/secret key và vẫn giữ lỗi auth/5xx/timeout là degraded hoặc unreachable.

## Thay đổi mã nguồn

- `api/health.js`: thay probe PostgREST root bằng zero-row probe; thêm `Accept: application/json`; giữ timeout 2.5 giây và giữ HTTP 503 cho lỗi thực.
- `tests/production-launch-readiness.test.js`: thêm regression test xác nhận URL/header probe và trường hợp database reachable trả HTTP 200.

Không thay đổi Supabase, database, migration, policy/RLS, UI hoặc các module học tập khác.

## Environment / Supabase / RLS

Tên biến liên quan:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `OPENAI_API_KEY`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`
- `VERCEL_TOKEN`

Runtime `/api/config` cho thấy hai biến public Supabase đang được cấu hình hợp lệ ở production; giá trị key không được ghi vào báo cáo. `OPENAI_API_KEY` không cấu hình chỉ tạo `degradedFeatures: ["ai"]`, không phải nguyên nhân P1 database.

RLS/isolaton chỉ được kiểm tra read-only ở mức public boundary: bảng record cá nhân từ chối anon access; truy vấn zero-row legacy sync không trả dữ liệu. Chưa có test account/auth session được ủy quyền để xác nhận toàn bộ owner-vs-other-user matrix trên production, nên phần đó không đánh dấu PASS.

## Kiểm thử local sau bản sửa

- `node --check api/health.js` — PASS
- `node --check tests/production-launch-readiness.test.js` — PASS
- `node tests/production-launch-readiness.test.js` — PASS
- `node tests/production-stability.test.js` — PASS
- Toàn bộ static/unit suite — **94/94 PASS**
- `node scripts/release-readiness.js` — PASS
- `node scripts/verify-production-build.js` — PASS
- `node scripts/vercel-function-audit.js` — PASS (7/12 functions)
- `git diff --check` — PASS
- Secret scan trên diff — PASS; không có secret mới

Local mocked reachable probe trả HTTP 200; mocked 500 vẫn trả HTTP 503.

## Deployment blocker

Bản sửa chưa được deploy. Workspace không có Vercel CLI và các biến quyền triển khai `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` đều không hiện diện. Vì vậy không thể:

- deploy bản sửa lên Production;
- kiểm tra hậu triển khai `GET /api/health` trên canonical domain;
- xác nhận `/`, `/api/version`, `/manifest.json`, `/sw.js` đang chạy commit mới.

Không sử dụng deployment-specific URL, không lấy token/cookie/credential và không sửa workaround trên production.

Canonical domain được kiểm tra lại trước khi deploy (2026-09-27T05:26Z): `/api/health` vẫn HTTP 503 trên commit cũ `93e3e1064ccb`; `/`, `/api/version`, `/manifest.json` và `/sw.js` lần lượt trả HTTP 200. Đây chỉ là baseline của deployment cũ, không phải post-deploy validation của bản sửa.

## Production post-push validation

Commit `c42e1130fdb041072a2348d8ee1a6a82d765b5d6` đã được push thành công lên `origin/main`. GitHub ghi nhận Vercel context `success` với mô tả `Deployment has completed`; CI và Mobile Native workflow cũng hoàn tất thành công.

Kiểm tra trực tiếp canonical domain lúc 2026-09-27T05:50Z:

- `/api/health` — HTTP 200; `status: ok`; `backend: ok`; `database.status: ok`; `database.latencyMs: 195`.
- `/api/version` — HTTP 200; release commit `c42e1130fdb0`; environment `production`.
- `/` — HTTP 200, app HTML/title hợp lệ.
- `/manifest.json` — HTTP 200, JSON PWA hợp lệ.
- `/sw.js` — HTTP 200, JavaScript service worker hợp lệ.
- Health response không chứa secret, service-role key hoặc stack trace. `ai: unconfigured` chỉ là degraded feature không làm fail health.

## Trạng thái cuối

| Hạng mục | Trạng thái |
|---|---|
| Root cause | PASS — đã xác minh |
| Supabase connection | PARTIAL — public API/database probe reachable; authenticated DB matrix chưa xác minh |
| Environment | PARTIAL — runtime configured; Vercel dashboard/values chưa kiểm tra được |
| RLS | PARTIAL — anon boundary đã kiểm tra; cross-user authenticated matrix chưa kiểm tra |
| `/api/health` local fix | PASS |
| Production runtime sau fix | PASS — canonical domain đã trả HTTP 200 |
| Security | PASS — không thêm secret, không dùng service-role |
| Regression | PASS — 94/94 |
| Commit | PASS — `c42e1130fdb041072a2348d8ee1a6a82d765b5d6` |
| Push | PASS — `origin/main` |
| Overall | **PASS** — P1 health fix đã xác nhận trên production |

P1 production validation hoàn tất với `GET https://hoctienghan-eight.vercel.app/api/health` trả HTTP 200 và `database.status = ok`; các endpoint smoke bắt buộc cũng đã PASS.
