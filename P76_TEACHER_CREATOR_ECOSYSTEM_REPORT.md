# P76 TEACHER CREATOR ECOSYSTEM REPORT

## 1. Role System

- Chuẩn hóa 5 vai trò sản phẩm: Learner, Teacher, Creator, Reviewer và Admin.
- Quyền được khai báo tập trung trong `content/teacher-creator-ecosystem.json` và kiểm tra lại ở service trước mọi mutation.
- Teacher có thể tạo lớp, assignment, study plan, course và lesson draft; Creator có thể author nội dung/course của chính mình; Reviewer duyệt nội dung của người khác; Admin mới có quyền publish.
- Supabase RLS và workflow trigger là lớp cưỡng chế phía server. UI không phải nguồn phân quyền duy nhất.

## 2. Teacher Profile

- Thêm hồ sơ chuyên môn gồm display name, avatar, bio, teaching experience, specialization, languages và certification.
- Service chỉ lưu/đọc whitelist trên; email, password, token và dữ liệu học riêng tư không thuộc model công khai.
- RLS chỉ cho Teacher/Creator/Admin quản lý hồ sơ của chính họ.

## 3. Creator Studio

- Creator Studio hiển thị số content Draft, Pending Review, Published và Rejected.
- Content Creation Tool hỗ trợ Vocabulary, Grammar, Listening, Reading, Speaking, Writing và Culture.
- Mọi draft bắt buộc có title, level, skill, learning objective, explanation, example và exercise.
- Dashboard Creator bổ sung learners, completion rate, rating, feedback, content views, drop-off, common mistakes và learning outcome.
- Metadata Free/Premium/subscription eligible đã có; payment vẫn bị tắt đúng phạm vi P76.

## 4. Course Builder

- Course có title, description, level, goal, thumbnail và category.
- Service cưỡng chế cấu trúc `Course → Chapter → Lesson → Exercise/Assessment` và kiểm tra parent type.
- Course/node giữ ownership; creator khác không thể sửa.
- Lesson/exercise có thể tham chiếu content ID, không sao chép hoặc thay đổi dữ liệu học của learner.

## 5. Review Workflow

- Pipeline đã triển khai: `Draft → Automated Check → Pending Review → Approved/Rejected → Published`.
- Automated Check kiểm tra required fields, độ dài giải thích, example, level, audio presence cho Listening/Speaking và duplicate title.
- Reviewer phải khác creator. Checklist gồm accuracy, naturalness, difficulty, example quality, audio quality và learning objective.
- Chỉ Admin/Super Admin có thể chuyển content đã approved sang published.
- AI Assistant chỉ đưa grammar/example/level/duplicate/improvement advisory; `publish()` luôn bị từ chối.

## 6. Quality Control

- Creator Quality Score dùng trọng số: content quality 40%, student completion 20%, learning improvement 25%, review history 15%.
- Dimension thiếu bằng chứng bị để trống, không tạo số giả.
- Views chỉ đo reach và không được dùng như learning outcome.
- Learner có màn hình rate lesson, report issue và gửi feedback gắn với content; creator nhận feedback an toàn đã bỏ learner identity.
- Nội dung hệ thống cũ được ánh xạ owner `TamHoanq`, status `verified`, giữ nguyên ID và progress.

## 7. Classroom Mode

- Teacher có thể tạo Class, thêm Student ID, tạo Assignment và Study Plan.
- Dashboard lớp tổng hợp students, shared progress, average progress, study minutes, mistake count và weak skills.
- Progress snapshot chỉ chấp nhận whitelist: studentId, displayName, progress, studyMinutes, weakSkill, mistakeCount và updatedAt.
- Password, email, journal, chat và recording bị loại khỏi classroom snapshot.
- Teacher chỉ quản lý classroom thuộc ownership của mình; cloud vẫn áp dụng organization/class RLS của P69.

## 8. Analytics

- Aggregate theo content gồm views, learner count, starts, completions, drop-offs, score, improvement và common errors.
- Creator chỉ thấy analytics của content thuộc ownership của mình.
- Supabase table lưu aggregate theo ngày, không lưu learner identity.
- Feedback summary RPC trả tổng số/rating/open issues cho owner hoặc reviewer/admin, không trả learner ID.

## 9. Security

- Ownership được kiểm tra ở app service và Supabase RLS.
- Creator ID là immutable; creator không thể update content/course của creator khác.
- Human reviewer phải khác creator; publish bắt buộc old status là approved và có reviewer evidence.
- Audit log ghi actor, role, action, entity, detail và timestamp; không ghi secret.
- Migration không chạm Auth credential, CloudSync payload, SRS, Mastery, Adaptive state hoặc learner progress.
- Secret scan cho file P76: không phát hiện secret/service-role/private key pattern.

## 10. Testing

- Unit/regression: **74/74 suites passed**.
- P76 unit test: role permissions, profile whitelist, teacher authoring, ownership, automated check, self-review denial, reviewer approval, Admin publish, course hierarchy, feedback privacy, analytics, classroom isolation và migration preservation đều pass.
- Real-browser P76: **360, 390, 430, 768, 1024, 1440, 1920 px**; dark mode pass; không horizontal overflow; touch target đạt tối thiểu 44 px.
- Draft workflow giữ đúng trạng thái sau reload.
- Dữ liệu progress và SRS fixture không thay đổi.
- Browser regressions P49 performance/lazy/offline, P69 education/classroom, P74 product delight và P75 content intelligence đều pass.
- `git diff --check`: pass; chỉ có cảnh báo line-ending LF/CRLF của Git trên Windows, không có whitespace error.

## 11. Remaining Risks

- Migration `20260916_p76_teacher_creator_ecosystem.sql` phải được apply vào Supabase production trước khi bật authoring cloud cho người dùng thật.
- Role provisioning phải được thực hiện ở server/admin; client không tự nâng role.
- Analytics daily cần pipeline/server job nạp aggregate thực tế; UI hiển thị `Collecting` khi chưa đủ bằng chứng.
- Automated audio check hiện xác nhận asset presence; naturalness/pronunciation/audio quality cuối cùng vẫn cần human reviewer.
- Learner count theo aggregate ngày cần quy tắc dedup server để tránh cộng trùng qua nhiều ngày.
- Payment chưa được tích hợp; P76 chỉ lưu revenue eligibility metadata.

## 12. Git SHA

- Feature commit: `1c3f0f797316ba1c7b38c2ed2f284fe673605a6e`
- Commit message: `feat: build teacher and creator ecosystem`
- Branch: `main`
- Push: thành công tới `origin/main` (`https://github.com/tam9166/Hoctienghan.git`).
- Deployment: source đã lên GitHub; Supabase production migration/deployment cần pipeline môi trường thực thi bên ngoài repository.

Learning Quality > Content Quantity được giữ làm nguyên tắc: creator không tự publish, AI không quyết định curriculum, quality gate bắt buộc và learning outcome có trọng số cao hơn lượt xem.
