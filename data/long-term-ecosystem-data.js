/* Tiếng Hàn - TamHoanq — curated long-term learning ecosystem content */
(function buildLongTermEcosystemData(global) {
  'use strict';
  const approved = (items) => Object.freeze(items.map((item) => Object.freeze({ verified: true, source: 'TamHoanq curriculum', reviewStatus: 'approved', contentVersion: 1, ...item })));

  const strategyModules = approved([
    { id: 'listening', icon: '듣', title: 'Chiến thuật nghe', summary: 'Đọc lựa chọn trước, xác định ý định và giữ nhịp theo audio.', steps: ['Đọc nhanh đáp án trước khi audio bắt đầu.', 'Đánh dấu khác biệt về người, nơi, thời gian và hành động.', 'Nếu lỡ một câu, chọn theo bằng chứng đã nghe rồi chuyển ngay.', 'Dùng lượt soát để kiểm tra câu còn phân vân, không đổi đáp án chỉ vì cảm giác.'], mistakes: ['Cố dịch từng từ nên mất câu tiếp theo.', 'Bị một từ trùng với đáp án đánh lạc hướng.', 'Không chú ý phủ định và đuôi câu.'] },
    { id: 'reading', icon: '읽', title: 'Chiến thuật đọc', summary: 'Đọc câu hỏi trước, tìm bằng chứng và giới hạn thời gian cho mỗi đoạn.', steps: ['Đọc yêu cầu để biết cần tìm chi tiết, ý chính hay suy luận.', 'Quét danh từ và động từ chính trước khi dịch chi tiết.', 'Gạch bằng chứng hỗ trợ đáp án.', 'Đánh dấu câu tốn thời gian và quay lại sau.'], mistakes: ['Chọn phương án đúng một phần nhưng không trả lời câu hỏi.', 'Dùng kiến thức ngoài bài để suy luận.', 'Dừng quá lâu ở một từ mới không quyết định đáp án.'] },
    { id: 'time', icon: '시', title: 'Phân bổ thời gian', summary: 'Dùng ngân sách thời gian theo phần và luôn chừa một lượt soát.', steps: ['Nghe: theo đúng nhịp audio và tô đáp án ngay sau mỗi câu.', 'Đọc: dành khoảng 70% thời gian cho lượt đầu, 20% cho câu đánh dấu, 10% để soát.', 'Viết TOPIK II: lập ý trước, viết theo cấu trúc, chừa thời gian kiểm tra trợ từ và đuôi câu.', 'Nếu vượt ngân sách của một câu, đánh dấu và chuyển tiếp.'], mistakes: ['Không có mốc chuyển câu rõ ràng.', 'Dành hết thời gian cho câu khó đầu phần.', 'Nộp bài mà không soát phủ định, số liệu hoặc ô đáp án.'] },
    { id: 'patterns', icon: '형', title: 'Dạng câu thường gặp', summary: 'Nhận diện chức năng câu hỏi trước khi giải nội dung.', steps: ['Nghe: chọn tranh/ý nghĩa, phản hồi phù hợp, nội dung hội thoại.', 'Đọc: biển báo, điền chỗ trống, sắp xếp câu, ý chính và suy luận.', 'Viết TOPIK II: hoàn thành câu, mô tả dữ liệu và bài luận có bố cục.', 'Mở Strategy Lab để luyện đúng dạng câu có trong ngân hàng đề.'], mistakes: ['Luyện đề nhưng không ghi lại dạng câu sai.', 'Dùng một chiến thuật cho mọi loại câu.', 'Chỉ xem đáp án mà không xác định bằng chứng.'] },
    { id: 'mistakes', icon: '검', title: 'Lỗi phổ biến', summary: 'Biến lỗi thành quy tắc kiểm tra ngắn trước khi chọn đáp án.', steps: ['Gắn nhãn lỗi: thiếu từ khóa, sai ngữ pháp, thiếu thời gian hay suy luận quá mức.', 'Viết một quy tắc sửa có thể áp dụng lại.', 'Đưa câu hoặc cấu trúc vào Hàng ôn thủ công.', 'Làm lại sau một khoảng cách thay vì lặp ngay liên tục.'], mistakes: ['Chỉ nhìn điểm tổng mà không phân loại lỗi.', 'Ôn tất cả như nhau thay vì ưu tiên lỗi lặp.', 'Bỏ qua câu đoán đúng nhưng không hiểu bằng chứng.'] }
  ]);

  const goalTemplates = approved([
    { id: 'study-korea', icon: '🎓', title: 'Tôi muốn du học Hàn', focus: ['Hangul và giao tiếp học đường', 'TOPIK theo yêu cầu đầu vào', 'Nghe giảng và viết học thuật'], outcomes: { 3: 'Nền tảng giao tiếp học đường và kế hoạch TOPIK rõ ràng', 6: 'Phản xạ học đường, đọc tài liệu ngắn và luyện đề định kỳ', 12: 'Lộ trình toàn diện cho TOPIK, lớp học và đời sống du học' } },
    { id: 'work-korea', icon: '🏭', title: 'Tôi muốn làm việc tại Hàn', focus: ['An toàn và chỉ dẫn nơi làm việc', 'Giao tiếp với quản lý và đồng nghiệp', 'Từ vựng nghề nghiệp / EPS-TOPIK'], outcomes: { 3: 'Giao tiếp sinh tồn và hiểu chỉ dẫn cơ bản', 6: 'Xử lý hội thoại công việc thường gặp và luyện EPS đều đặn', 12: 'Năng lực công việc, đời sống và chiến lược thi được củng cố' } },
    { id: 'career-korean', icon: '💼', title: 'Tôi muốn dùng tiếng Hàn trong công việc', focus: ['Kính ngữ và giao tiếp công sở', 'Email, lịch hẹn và báo cáo', 'Thuyết trình và trao đổi ý kiến'], outcomes: { 3: 'Mẫu câu công sở cốt lõi và lịch sự phù hợp', 6: 'Viết email, tham gia họp ngắn và xử lý lịch hẹn', 12: 'Giao tiếp nghề nghiệp độc lập hơn trong nhiều tình huống' } },
    { id: 'daily-life', icon: '🏠', title: 'Tôi muốn sống tự tin tại Hàn', focus: ['Mua sắm, giao thông và y tế', 'Nhà ở và thủ tục đời sống', 'Hội thoại tự nhiên theo tình huống'], outcomes: { 3: 'Xử lý các nhu cầu hằng ngày bằng câu ngắn', 6: 'Duy trì hội thoại đời sống và giải quyết vấn đề quen thuộc', 12: 'Tự tin hơn trong phần lớn tình huống sinh hoạt thực tế' } }
  ]);

  const roadmapPhases = Object.freeze({
    3: Object.freeze([
      { range: 'Tháng 1', title: 'Nền tảng dùng được', ratio: 34 },
      { range: 'Tháng 2', title: 'Luyện trong tình huống', ratio: 33 },
      { range: 'Tháng 3', title: 'Checkpoint đời thật', ratio: 33 }
    ]),
    6: Object.freeze([
      { range: 'Tháng 1–2', title: 'Xây nền và từ cốt lõi', ratio: 30 },
      { range: 'Tháng 3–4', title: 'Tăng nghe, đọc và phản xạ', ratio: 35 },
      { range: 'Tháng 5', title: 'Ứng dụng theo mục tiêu', ratio: 20 },
      { range: 'Tháng 6', title: 'Đánh giá và củng cố', ratio: 15 }
    ]),
    12: Object.freeze([
      { range: 'Tháng 1–3', title: 'Nền tảng bền vững', ratio: 25 },
      { range: 'Tháng 4–6', title: 'Mở rộng đầu vào', ratio: 25 },
      { range: 'Tháng 7–9', title: 'Tăng đầu ra thực tế', ratio: 25 },
      { range: 'Tháng 10–11', title: 'Mô phỏng mục tiêu', ratio: 17 },
      { range: 'Tháng 12', title: 'Checkpoint và kế hoạch tiếp', ratio: 8 }
    ])
  });

  const communityEvents = approved([
    { id: 'event-reading-week', type: 'challenge', title: '7 ngày đọc tiếng Hàn', description: 'Hoàn thành một bài Reading Lab mỗi ngày.', durationDays: 7, target: 7, metric: 'reading' },
    { id: 'event-srs-50', type: 'challenge', title: 'Ôn 50 từ đúng hạn', description: 'Hoàn thành 50 lượt ôn SRS trong thời gian sự kiện.', durationDays: 14, target: 50, metric: 'srs-review' },
    { id: 'event-real-sentence', type: 'learning-event', title: 'Tuần câu dùng thật', description: 'Tự viết 5 câu phù hợp với mục tiêu đời thật.', durationDays: 7, target: 5, metric: 'sentence' }
  ]);

  global.KLEARN_LONG_TERM_DATA = Object.freeze({ strategyModules, goalTemplates, roadmapPhases, communityEvents });
})(window);
