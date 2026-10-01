# V4 Remediation — Date Determinism & Local Backup Quota

Ngày: 2026-10-01
Phạm vi: chỉ xử lý `learning-intelligence.test.js` và `QuotaExceededError` khi tạo local backup. Không xử lý Auth, RLS, multi-device, offline E2E, audio, TOPIK production hoặc PWA.

## A. `learning-intelligence.test.js`

### Root cause

Test dùng `Date.now()` thật trong fixture. Khi chạy ngày 2026-10-01, fixture `now - 2 ngày` rơi vào tháng 09 nhưng assertion vẫn kỳ vọng một attempt trong tháng hiện tại. Đây là test không deterministic, không phải bằng chứng production logic sai.

### Cách sửa

- Tiêm `FixedDate` vào VM của test; production module không bị thay đổi.
- Dùng mốc cố định `2026-10-15T12:00:00.000Z` cho fixture mặc định.
- Bổ sung kiểm thử cùng ngày, 1/3/7/30 ngày trước, đầu/cuối tháng, đầu/cuối tuần và timestamp UTC/local-offset.
- Chạy lại với `TZ=America/Los_Angeles` và `TZ=Asia/Tokyo`.

Kết quả: `learning-intelligence.test.js` PASS ở cả timezone kiểm tra.

## B. Local backup quota

### Root cause

`BackupService.create()` ghi trực tiếp danh sách backup vào `klearn_learning_backups`. Khi `storage.set()` trả quota error, hàm vẫn trả entry như thể backup thành công; UI chỉ có retry/quản lý dữ liệu và chưa có đường xuất backup trực tiếp.

### Cách sửa

- Backup thử ghi đầy đủ trước.
- Nếu quota đầy, compact snapshot (`compaction: v1`), giữ dữ liệu quan trọng (`progress`, `SRS`, session/settings cần thiết), bỏ các profile list dẫn xuất và giới hạn lịch sử backup gần nhất, sau đó retry.
- Không xóa progress, SRS, Error Notebook hoặc learning data.
- Nếu retry vẫn thất bại, trả `null`, phát sự kiện lỗi với `code=QUOTA_EXCEEDED` và `fallback=export`; không báo backup thành công giả.
- UI hiển thị rõ storage quota, thêm nút `Xuất bản sao lưu` dùng download JSON không cần ghi thêm vào localStorage.
- Phân loại storage failure: `QUOTA_EXCEEDED`, `SECURITY_ERROR`, `MALFORMED_DATA`, `STORAGE_UNAVAILABLE`; dữ liệu lỗi không còn bị âm thầm `removeItem`.

### Test mô phỏng

- Quota luôn đầy: backup trả `null`, checkpoint/progress vẫn còn, fallback export được phát.
- Quota tạm thời: compact + retry thành công.

## Kiểm thử hồi quy

- **94/94 test files PASS**.
- `node scripts/verify-production-build.js`: PASS.
- `node scripts/release-readiness.js`: PASS; còn cảnh báo cấu hình deployment Supabase/AI theo thiết kế hiện tại.
- `node scripts/vercel-function-audit.js`: PASS (7/12 functions được audit).
- `node --check app.js`: PASS.
- `node --check data/production-stability.js`: PASS.
- `git diff --check`: PASS.
- Secret scan: PASS.

## Trạng thái triển khai

Trạng thái trước deploy đã được ghi nhận ở phần remediation ban đầu. Bản sửa hiện đã được commit/push; kết quả production sau deploy được cập nhật bên dưới.

Files thay đổi:

- `app.js`
- `data/production-stability.js`
- `tests/learning-intelligence.test.js`
- `tests/production-stability.test.js`

## Production Deployment

Commit: `a63e618af724` (`fix: stabilize learning intelligence and storage quota recovery`)
Deployment: production domain reachable; `/api/version` and `/api/health` report the new commit.
Date: 2026-10-01.

## Production Health

`/api/health`: HTTP 200, `status=ok`, `backend=ok`, `database.status=ok`, latency observed 216 ms, no secret or stack-trace leak.
`/api/version`: HTTP 200, version `1.5.0-rc.1`, release `p80-topik-exam-intelligence-system`, schema 13, commit `a63e618af724`, environment `production`, region `iad1`.

Smoke `/`, `/manifest.json` and `/sw.js`: HTTP 200. No Vercel protection page or unexpected 5xx observed.

## Learning Intelligence

Local: **PASS** — 94/94 test files, fixed clock and boundary coverage.
Production: **PARTIAL** — Home, Adaptive Assistant, Profile, Progress Report and Daily Session rendered without `NaN`, `undefined`, `Invalid Date`, `RangeError` or `Infinity`. A clean multi-date/timezone production mutation was not performed. Existing demo profile data remained visible.

## Quota Recovery

Local: **PASS** — quota simulation covers compact/retry, hard failure, fallback event and preservation of recovery checkpoint.
Production: **PARTIALLY VERIFIED** — an existing browser profile reproduced `QuotaExceededError` and the app preserved visible learning data. The browser still served the previous Service Worker-cached UI (old warning text, no `Xuất bản sao lưu` button), while direct HTTP assets for commit `a63e618af724` contain the new compact/export code. Therefore the deployed quota recovery UX and export button are **NOT VERIFIED** in this runtime; no storage-filling workaround was attempted.

## Data Safety

Progress: **PARTIAL** — visible after the existing quota warning.
SRS: **PARTIAL** — due cards remained visible.
Error Notebook: **PARTIAL** — existing error remained visible.
Learning Session: **PARTIAL** — daily session route remained renderable.
No data-loss event was observed; a clean test-account trigger-and-compare was not performed.

## Backup Export

**NOT VERIFIED** on production. Local fallback/export tests pass, but the active browser profile served the stale cached banner and no safe file export was triggered.

## Regression

94/94: **PASS**
Build: **PASS**
Readiness: **PASS**
Production: **CONDITIONAL** — smoke health is good, but Service Worker cache prevented proof that the new quota UX is the runtime presented to users.

## Issues

P0: **NONE OBSERVED**.
P1: **CONDITIONAL** — production browser cache served stale app assets after deployment; quota recovery UX is not proven on the runtime currently presented.
P2: **PARTIALLY VERIFIED** — quota warning and data preservation observed; compact/retry/export production path remains unverified.
P3: **NONE OBSERVED** beyond the cache-related verification gap.

## Final Status

**CONDITIONAL**

Production deployment and health are PASS. The release cannot be called fully PASS for these two fixes until a fresh production runtime (with the updated Service Worker/assets) visibly shows the quota recovery UX and a safe test-profile export can be verified.
# Final Re-Validation

Date: 2026-10-01

## Service Worker

Status: **PASS**

Evidence:

- Production `/api/version` returned commit `2cf10cdd6f7a`.
- Production `/sw.js` returned `klearn-v106` with no-store headers.
- Existing profile reload rendered the current quota copy, including
  “Xuất bản sao lưu”; the old quota copy was not rendered after the update.
- Fresh production tab rendered the same current application assets with no
  console errors.

## Learning Intelligence

Status: **PASS**

Test data:

- Existing controlled demo/test browser profile contained progress, vocabulary,
  SRS due items, Error Notebook evidence, mock history and learning profile
  signals. No separate authenticated account was created during this read-only
  validation.
- An adaptive recommendation materialized into the SRS review route and one
  correct vocabulary answer was recorded without a crash.

Date validation:

- Dashboard, Progress, Learning Profile, Today Plan and Adaptive routes all
  rendered production content.
- No `Invalid Date`, `NaN`, `Infinity`, `undefined`, `RangeError`, `TypeError`,
  blank screen or application-error copy appeared.
- A browser reload and a second fresh production tab preserved valid dates,
  progress, SRS counts, weaknesses and recommendations.

Recommendation:

- Learning Profile showed skill evidence and a tracked weakness.
- Today Plan showed concrete SRS/listening/Error Notebook/next-lesson actions.
- Adaptive Assistant showed a dated plan with actionable “Mở” controls; the
  SRS control opened a real review session.

## Quota Recovery

Status: **CONDITIONAL**

Normal backup:

- Production automatically attempted the daily/weekly backup path. The
  existing controlled profile was already storage-constrained, so the runtime
  emitted a user-safe quota warning rather than crashing.
- Existing progress, SRS, Error Notebook and session state remained visible.

Quota simulation:

- Safe controlled simulation in `tests/production-stability.test.js` passed
  `QuotaExceededError` handling without filling or deleting real production
  storage.
- The production implementation distinguishes `QUOTA_EXCEEDED`,
  `SECURITY_ERROR`, `MALFORMED_DATA` and `STORAGE_UNAVAILABLE`.

Compact / retry:

- Controlled simulation verified compact snapshot `v1` and retry behavior.

Fallback:

- Controlled simulation verified the explicit export fallback and safe failure
  notification. The production quota copy exposes “Xuất bản sao lưu”.

Export:

- The current production profile exposed the new export CTA during the prior
  Service Worker revalidation, but this run could not capture a browser download
  event from the in-app browser. No JSON file was accepted as verified evidence.
- A controlled browser quota override was unavailable; storage was not filled or
  deleted to force the condition.

Data safety:

- No progress, SRS, Error Notebook or learning-session loss was observed before
  or after the quota warnings. The profile remained usable and the SRS task
  continued to a real answer.

## Regression

- 94/94 tests: PASS
- Build/readiness: PASS
- Function audit: PASS (7/12)
- Service Worker simulation: PASS
- Offline app shell/Home after the SW fix: PASS (previous production run)
- Adaptive/SRS/Error Notebook route checks: PASS

## Production

- Commit: `2cf10cdd6f7a` (report-only commit after SW fix `c1cd19928e49`)
- Health: HTTP 200
- Database: `ok`
- Runtime: production domain rendered current assets and Learning Intelligence
  routes without runtime exceptions.

## Final

Learning Intelligence: **PASS**

Quota Recovery: **CONDITIONAL** — controlled failure handling and data safety
pass, but production JSON export could not be captured in this browser session.

Overall: **CONDITIONAL**
