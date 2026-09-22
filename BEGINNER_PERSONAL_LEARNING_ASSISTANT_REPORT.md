# Báo cáo nâng cấp Trợ lý học tiếng Hàn cá nhân

## Kết quả

App đã có một luồng học liên tục dành cho người Việt mới bắt đầu:

`Trang chủ → bài nên học → bài học 8 bước → mini test 5 câu → giải thích lỗi → lưu SRS/Sổ lỗi → ôn tập → xem tiến độ`

Không xóa hay thay thế các hệ thống cũ. Phần nâng cấp dùng lại Curriculum, SRS, Practice History, Error Notebook, Hangul Foundation, Daily Session, Achievement và Cloud Sync hiện có.

## Phần đã nâng cấp

- Trang chủ trợ lý: chào người học, streak, bài hiện tại, CTA tiếp tục, học nhanh 5 phút, từ đến hạn, gợi ý theo lỗi sai và thành tựu gần nhất.
- Lộ trình liên kết Hangul → TOPIK 1–6, có trạng thái hoàn thành, đang học, có thể học và chưa mở khóa.
- Danh sách bài học theo tuần tự, hiển thị điểm mini test và khuyến nghị ôn lại.
- Mỗi bài có 8 bước và mini test 5 câu. Câu sai hiển thị đáp án, giải thích và được ghi vào Error Notebook.
- Audio câu ví dụ và câu nghe có tốc độ bình thường `1×` và chậm `0.7×`.
- Khu ôn từ vựng có các bộ lọc: đến hạn, mới, đang học, đã thuộc, hay sai, yêu thích, tất cả; lọc thêm theo chủ đề và số lượng.
- Bốn chế độ ôn hoạt động thật: trắc nghiệm Hàn→Việt, nhập Việt→Hàn, nghe và chọn, ghép cặp.
- Sau mỗi câu ôn, SRS cập nhật mastery, lịch ôn, số lần đúng/sai; câu sai được đồng bộ sang Sổ lỗi.
- Bảng tiến độ dùng dữ liệu đã lưu: bài hoàn thành, từ đã học, số bài kiểm tra, điểm trung bình, phút học, streak, % khóa học và biểu đồ 7 ngày.
- Giao diện responsive theo desktop/tablet/mobile, CTA lớn, bottom navigation giữ nguyên và thanh đầu trang không tràn ở màn hình nhỏ.
- Tài nguyên mới được lazy-load theo route và đưa vào offline cache, không làm vượt performance budget hiện tại.

## Tính liên kết dữ liệu

- Hoàn thành bài: lưu điểm mini test, thời gian học, mastery, trạng thái nên ôn, mở bài kế tiếp và thêm từ của bài vào SRS.
- Trả lời sai: tăng `wrongCount`, giảm mastery, lên lịch ôn sớm và ghi giải thích vào Error Notebook.
- Trả lời đúng: tăng mastery, chuỗi nhớ và giãn lịch ôn theo SRS.
- Trang chủ, lộ trình và dashboard đọc lại cùng dữ liệu này; refresh trang không làm mất tiến độ.

## Kiểm thử

- Kiểm tra cú pháp JavaScript cho app, route loader, service worker và module mới: đạt.
- Kiểm tra giao diện thật bằng Edge headless ở kích thước mobile 500×900: đạt.
- Kiểm tra route lộ trình trong DOM trình duyệt: đạt.
- Regression suite: **92/92 test đạt**, bao gồm SRS, adaptive learning, content platform, TOPIK P80–P81, vocabulary P82–P84, offline và performance budget.

## Phụ thuộc còn lại

- Luồng học chính hoạt động không cần backend. Dữ liệu được lưu local-first và chỉ đồng bộ đa thiết bị khi Supabase đã được cấu hình.
- Audio hiện dùng Korean TTS của thiết bị. Cấu trúc đã sẵn sàng thay bằng file thu âm native khi có kho audio.
- Không thêm chấm phát âm phức tạp vì yêu cầu hiện tại ưu tiên nghe → lặp lại → ghi nhớ.
