# TOPIK Exam Repository

Module P80 cung cấp bốn luồng: **Kho đề**, **Thi thử**, **Luyện theo dạng** và **Kết quả**. Dữ liệu mặc định nằm tại `content/topik-exam-intelligence-system.json`, hoạt động offline và được lưu local-first theo người dùng qua `klearn_exam_attempts`.

## Quy tắc nguồn và bản quyền

- `official-schedule` chỉ là metadata lịch thi. Không được xem là bằng chứng rằng đề hoặc đáp án đã được công bố.
- Chỉ nội dung `available` có `answerVerification` là `verified-original` hoặc `verified-official` mới được bắt đầu và chấm điểm.
- `verified-official` bắt buộc có `answer_source_url`; `verified-original` phải ghi rõ là nội dung tự biên soạn.
- Không scrape, tải lại hoặc nhúng đề thi có bản quyền nếu chưa có quyền phân phối.
- Điểm của nội dung tự biên soạn luôn là điểm luyện tập ước tính, không phải kết quả TOPIK chính thức.

Các nguồn metadata hiện tại:

- Lịch thi Việt Nam: <https://online.iigvietnam.com/lich-thi-tieng-han>
- Hướng dẫn thao tác IBT chính thức: <https://www.topik.go.kr/asset/vendor/tutorial/exam1/listen_exam.html>

## Import an toàn

Kiểm tra JSON hoặc CSV cục bộ, không truy cập mạng:

```bash
node scripts/import-topik-exams.js path/to/exams.json
node scripts/import-topik-exams.js path/to/exams.csv --print
```

Importer từ chối nội dung `available` khi đáp án chưa xác minh, đáp án chính thức thiếu URL nguồn, hoặc nguồn lịch thi bị gắn nhầm thành nội dung đề.

## Supabase và RLS

Migration `supabase/migrations/20260926_topik_exam_repository.sql` tạo kho chuẩn hóa cho exam/source/section/question/option/answer/explanation và dữ liệu attempt/user-answer.

- Người học chỉ đọc nội dung đã xuất bản và chỉ quản lý bài làm của chính mình (`auth.uid() = user_id`).
- Chỉ vai trò `reviewer` hoặc `admin` được ghi/sửa/xóa nội dung đề và khóa đáp án.
- Metadata kỳ thi có thể xuất bản khi chưa có nội dung; câu hỏi, đáp án và giải thích chỉ được đọc khi đề có quyền phân phối và đã xuất bản.

Ứng dụng hiện tiếp tục đồng bộ local-first qua record `examAttempts`; schema chuẩn hóa là nền để chuyển từng attempt sang bảng riêng mà không phá dữ liệu cũ.

## Kiểm thử

```bash
node tests/p80-topik-exam-intelligence-system.test.js
node tests/p80-topik-exam-intelligence-responsive.browser.js
```

Kiểm thử bao phủ contract nội dung, lọc PBT/IBT, chặn đề metadata-only, timer/resume/mark, chấm đáp án xác minh, chữa đề, Error Notebook theo thao tác người dùng, lịch sử, offline và RLS tách dữ liệu người dùng.
