# V7 Regression & Accessibility Fix Report

Ngày kiểm tra: 2026-10-03  
Phạm vi: chỉ sửa lỗi test retention và accessible name của `#dictionaryPos`.

## Tóm tắt

Hai lỗi phát hiện trong Production Validation V7 đã được xử lý ở local. Không thay đổi Supabase, database, RLS, Auth, SRS algorithm, learning data hoặc production deployment.

## 1. `retention-system.test.js`

### Failure trước khi sửa

- Assertion: `completed today suppresses reminder`.
- Expected: `null`.
- Actual: reminder object `{ id: "reminder-2026-10-03", ... }`.
- Test lấy mốc hiện tại bằng `Date.now()` và tạo sự kiện “today” bằng `Date.now() - 86400000`.

### Root cause

Retention production dùng ngày theo calendar local (`dayKey()` và khoảng thời gian end-exclusive), không dùng phép trừ cố định 24 giờ để quyết định “hôm nay”. Vì vậy sự kiện được đặt lùi đúng 24 giờ có thể rơi vào ngày local trước đó, đặc biệt quanh UTC offset hoặc ranh giới ngày/tháng. Test cũng phụ thuộc real clock của máy chạy test.

### Fix

- Thêm `TestDate` với fixed clock `2026-10-03T12:00:00.000Z` vào VM context của test.
- Tạo các mốc quá khứ bằng calendar arithmetic (`setDate`) trên fixed clock.
- Đặt sự kiện “today” trước fixed reference 60 giây để chắc chắn nằm trong cùng local calendar day và trong khoảng end-exclusive.
- Không thay đổi production retention behavior, không bỏ assertion, không skip test và không tăng timeout.

## 2. Accessibility `#dictionaryPos`

### Root cause

`#dictionaryPos` là native `<select>` nhưng không có accessible name được liên kết bằng `<label>` hoặc ARIA.

### Fix

Thêm các label ẩn thị giác bằng class `.sr-only` đã có sẵn:

- `label[for="dictionarySearch"]`: `Từ cần tra`
- `label[for="dictionaryPos"]`: `Loại từ`

Native select, CSS/layout, keyboard semantics và handler `dictionaryPos.onchange` hiện có được giữ nguyên. Local DOM xác nhận mỗi label liên kết đúng một control (`getByLabel` count = 1); control vẫn là `<select>` native.

## Kiểm thử

| Check | Before | After |
|---|---:|---:|
| `retention-system.test.js` | FAIL | PASS |
| Accessibility `#dictionaryPos` | FAIL | PASS |
| Full regression | 94/95 | 95/95 |
| Build (`verify-production-build.js`) | — | PASS |
| Readiness (`release-readiness.js`) | — | PASS |
| Syntax (`app.js`, both changed tests) | — | PASS |
| Function audit | — | PASS (7/12 audited functions; command exit 0) |
| Secret scan (readiness audit) | — | PASS |
| `git diff --check` | — | PASS (chỉ có cảnh báo LF→CRLF của Git) |

### Test evidence

- `node tests/retention-system.test.js`: PASS.
- `node tests/p2-ux-fixes.test.js`: 11/11 PASS, gồm accessibility contract cho `#dictionaryPos`.
- Full suite: 95 test files, 95 PASS, 0 FAIL.
- Retention test cũng PASS với `TZ=UTC`, `TZ=America/Los_Angeles` và `TZ=Asia/Ho_Chi_Minh`.
- Local browser: `/dictionary` có accessible labels `Từ cần tra` và `Loại từ`; `#dictionaryPos` vẫn là native `SELECT`.

## Files changed

- `app.js` — thêm label accessible cho hai dictionary controls.
- `tests/retention-system.test.js` — fixed clock và calendar-based fixtures.
- `tests/p2-ux-fixes.test.js` — regression assertion cho accessible names.
- `V7_REGRESSION_ACCESSIBILITY_FIX_REPORT.md` — báo cáo này.

Không sửa file Supabase/database/RLS/Auth/SRS/learning data và không thay đổi module ngoài phạm vi yêu cầu.

## Kết quả cuối

- Retention test: **PASS**
- Accessibility: **PASS**
- Regression: **95/95 PASS**
- Build: **PASS**
- Readiness: **PASS**
- Syntax: **PASS**
- Secret scan: **PASS**
- Diff check: **PASS**
- Production: **NOT VALIDATED** (theo yêu cầu; không deploy)
- Commit: **NOT CREATED**
- Push: **NOT DONE**
