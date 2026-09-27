# P2 UX FIX REPORT

## UX-005
PASS
Changes:
- Chuẩn hóa các thuật ngữ learner-facing bằng tiếng Việt trong ProductLanguageService.
- Bổ sung giải thích lần đầu cho SRS: “SRS — hệ thống nhắc bạn ôn từ đúng lúc để nhớ lâu hơn.”
- Giữ nguyên TOPIK và Hangul.

## UX-006
PASS
Changes:
- Listening Studio mặc định ẩn nghĩa tiếng Việt, ưu tiên Hangul và âm thanh.
- Nút chuyển đổi hiển thị “Hiện nghĩa tiếng Việt/Ẩn nghĩa tiếng Việt”.
- Preference `listeningMeaning` được lưu trong settings hiện có; không ảnh hưởng mode học khác.

## UX-007
PASS
Changes:
- Mini test sai câu có primary “Câu tiếp theo” và action theo ngữ cảnh: Sổ lỗi, Ôn lại từ, Xem ngữ pháp.
- Error Notebook vẫn dedupe theo fingerprint hiện có; không tạo hệ thống lưu lỗi mới.

## UX-008
PASS
Changes:
- Error Notebook hiển thị loại lỗi tiếng Việt và timestamp dạng `dd/mm/yyyy, hh:mm`.
- Lưu thêm lesson/source metadata cần thiết.
- Source hợp lệ có “Mở câu gốc”; source thiếu/không hợp lệ hiển thị “Không thể mở bài gốc”.

## UX-009
PASS
Changes:
- SRS beginner có giải thích “đến hạn”, một primary queue “ÔN HÔM NAY”, và empty-state dẫn tới học từ mới.
- Giữ nguyên thuật toán SRS và các queue phụ hiện có.

## UX-011
PASS
Changes:
- Adaptive task và contextual advisor có reason + CTA trực tiếp.
- Mapping chỉ dùng route/module đã tồn tại; TOPIK sửa về `topik-intelligence-p80`.

## UX-012
PASS
Changes:
- Ẩn AI operator telemetry khỏi learner UI.
- P68 quality/cost logic và analytics vẫn giữ nguyên; summary chỉ render cho reviewer có quyền.

## UX-013
PASS
Changes:
- Thêm một cụm “ÔN & THI” ổn định trên Home với SRS, Sổ lỗi, TOPIK, Offline và Tiến độ.
- Không thêm bottom-nav item mới và không tạo destination trùng.

## UX-014
PASS
Changes:
- Learning Plan dùng progressive disclosure cho “Vì sao app đề xuất?” và “Mục tiêu & lộ trình”.
- “HÔM NAY HỌC GÌ?” và CTA học hôm nay vẫn là nội dung chính.

## UX-015
PASS
Changes:
- Offline vocabulary pack hiển thị metadata từ pack thật (`vocabularyIds`, `lessonIds`).
- Pack chỉ chứa từ vựng không còn bị mô tả là `0 lessons`; copy nêu rõ không chứa bài học.

## UX-016
PASS
Changes:
- Bổ sung route render fallback: “Không thể mở trang này.” với “Thử lại” và “Về trang chủ”.
- Giữ route loader fallback hiện có cho lỗi tải/offline.
- Entry point ổn định cho TOPIK, SRS, Sổ lỗi, Offline và Tiến độ đã được kiểm tra trên Home.

## Tests

Unit:
- 94/94 static test files pass, gồm P2 contract tests 10/10.
- `node --check` cho toàn bộ file JavaScript đã sửa: PASS.
- `git diff --check`: PASS.

Browser:
- P2 journey suite: PASS (navigation hub, Korean-first listening, preference, Error Notebook, Adaptive, telemetry, route fallback).
- P1 responsive regression: PASS.
- P80 responsive: PASS.
- P81 responsive: PASS.
- P84-P0 responsive: PASS.
- P49 Offline: PASS.

Responsive:
- P2 route journey kiểm tra 320, 360, 390, 430, 768, 1024, 1440 và 1920 px: PASS; không overflow ngang.

SRS:
- P84-P0 và beginner SRS contract: PASS.

TOPIK:
- P80/P81 responsive suites: PASS.

Adaptive:
- Adaptive responsive suite và direct CTA mapping: PASS.

Offline:
- P49 Offline PWA suite: PASS; offline metadata contract: PASS.

Supabase:
- Không thay đổi migration, schema, RLS hoặc sync logic; Supabase/RLS static regression: PASS.

P1 Regression:
- P1 browser suite: PASS.

Follow-up:
- `p79-vocabulary-immersion-responsive.browser.js` legacy harness không kết thúc trong một lần chạy môi trường này; P79 unit contract vẫn PASS và không thay đổi selector/logic P79 trong P2.

## Git

Commit:
- `fix: refine secondary UX audit issues`

Push:
- `origin/main`

Working tree:
- Sẽ xác nhận CLEAN sau commit và push.

## Files changed

- `app.js`
- `data/adaptive-engine.js`
- `data/ai-coach.js`
- `data/ai-quality-optimization.js`
- `data/beginner-learning-assistant.js`
- `data/global-ai-language-companion.js`
- `data/practical-study.js`
- `data/vocabulary-daily-action.js`
- `styles.css`
- `tests/p2-ux-fixes.test.js`
- `tests/p2-ux-fixes-responsive.browser.js`
- `P2_UX_FIX_REPORT.md`

No database migration, Supabase schema/RLS, source learning algorithm, user data, or API secret was changed.
