/* Tiếng Hàn - TamHoanq — curated reading, word-network, collocation and dictation content */
(function buildReadingExpansionData(global) {
  'use strict';
  const approve = (items, difficulty) => Object.freeze(items.map((item) => ({ contentVersion: 1, verified: true, source: 'TamHoanq curriculum', reviewStatus: 'approved', difficulty, ...item })));
  const readings = [
    {
      id: 'read-beginner-self', level: 'Beginner', title: 'Tôi là học sinh', topic: 'Giới thiệu', estimatedMinutes: 2,
      segments: [
        { text: '저', word: '저', meaning: 'tôi (khiêm nhường)' }, { text: '는', grammar: '은/는', explanation: 'Đánh dấu chủ đề của câu.' }, { text: ' 학생', word: '학생', meaning: 'học sinh; sinh viên' }, { text: '이에요.', grammar: '이에요/예요', explanation: '“Là” ở dạng lịch sự đời thường; dùng 이에요 sau phụ âm.' },
        { text: '\n한국어', word: '한국어', meaning: 'tiếng Hàn' }, { text: '를', grammar: '을/를', explanation: 'Đánh dấu tân ngữ.' }, { text: ' 공부해요.', word: '공부하다', meaning: 'học' }
      ],
      questions: [{ id: 'q1', prompt: 'Người nói đang làm gì?', options: ['Đi làm', 'Học tiếng Hàn', 'Ăn cơm'], answer: 1 }]
    },
    {
      id: 'read-beginner-day', level: 'Beginner', title: 'Một ngày đơn giản', topic: 'Sinh hoạt', estimatedMinutes: 2,
      segments: [
        { text: '아침', word: '아침', meaning: 'buổi sáng' }, { text: '에', grammar: '에', explanation: 'Đánh dấu thời điểm.' }, { text: ' 밥', word: '밥', meaning: 'cơm; bữa ăn' }, { text: '을', grammar: '을/를', explanation: 'Đánh dấu tân ngữ.' }, { text: ' 먹어요.', word: '먹다', meaning: 'ăn' },
        { text: '\n그리고 ', plain: true }, { text: '학교', word: '학교', meaning: 'trường học' }, { text: '에', grammar: '에', explanation: 'Đánh dấu đích đến.' }, { text: ' 가요.', word: '가다', meaning: 'đi' }
      ],
      questions: [{ id: 'q1', prompt: 'Sau khi ăn sáng, người nói đi đâu?', options: ['Công ty', 'Trường học', 'Nhà hàng'], answer: 1 }]
    },
    {
      id: 'read-topik1-library', level: 'TOPIK 1', title: 'Cuối tuần ở thư viện', topic: 'Học tập', estimatedMinutes: 4,
      segments: [
        { text: '민수', word: '민수', meaning: 'Min-su (tên người)' }, { text: '는', grammar: '은/는', explanation: 'Nêu Min-su làm chủ đề.' }, { text: ' 주말마다 ', plain: true }, { text: '도서관', word: '도서관', meaning: 'thư viện' }, { text: '에서', grammar: '에서', explanation: 'Nơi hành động học diễn ra.' }, { text: ' 공부합니다.', word: '공부하다', meaning: 'học' },
        { text: '\n도서관', word: '도서관', meaning: 'thư viện' }, { text: '은', grammar: '은/는', explanation: 'Đưa thư viện thành chủ đề.' }, { text: ' 조용하고 ', word: '조용하다', meaning: 'yên tĩnh' }, { text: '책', word: '책', meaning: 'sách' }, { text: '이', grammar: '이/가', explanation: 'Đánh dấu “sách” là chủ ngữ.' }, { text: ' 많습니다.', word: '많다', meaning: 'nhiều' }
      ],
      questions: [
        { id: 'q1', prompt: '민수는 어디에서 공부합니까?', options: ['학교', '도서관', '회사'], answer: 1 },
        { id: 'q2', prompt: '도서관은 어떻습니까?', options: ['조용합니다', '비쌉니다', '작습니다'], answer: 0 }
      ]
    },
    {
      id: 'read-topik1-appointment', level: 'TOPIK 1', title: 'Cuộc hẹn chiều nay', topic: 'Hẹn gặp', estimatedMinutes: 4,
      segments: [
        { text: '오늘 ', plain: true }, { text: '친구', word: '친구', meaning: 'bạn' }, { text: '와', grammar: '와/과', explanation: 'Nối danh từ với nghĩa “cùng/với”.' }, { text: ' 약속', word: '약속', meaning: 'cuộc hẹn; lời hứa' }, { text: '이', grammar: '이/가', explanation: 'Đánh dấu chủ ngữ.' }, { text: ' 있어요.', word: '있다', meaning: 'có; tồn tại' },
        { text: '\n오후 세 시', word: '오후', meaning: 'buổi chiều' }, { text: '에', grammar: '에', explanation: 'Đánh dấu thời điểm.' }, { text: ' 카페', word: '카페', meaning: 'quán cà phê' }, { text: '에서', grammar: '에서', explanation: 'Nơi hành động gặp diễn ra.' }, { text: ' 만날 거예요.', word: '만나다', meaning: 'gặp' }
      ],
      questions: [
        { id: 'q1', prompt: '몇 시에 만납니까?', options: ['오전 세 시', '오후 세 시', '오후 다섯 시'], answer: 1 },
        { id: 'q2', prompt: '어디에서 만납니까?', options: ['카페', '학교', '집'], answer: 0 }
      ]
    },
    {
      id: 'read-topik2-environment', level: 'TOPIK 2+', title: 'Thói quen bảo vệ môi trường', topic: 'Môi trường', estimatedMinutes: 7,
      segments: [
        { text: '최근 ', plain: true }, { text: '환경', word: '환경', meaning: 'môi trường' }, { text: '을', grammar: '을/를', explanation: 'Đánh dấu đối tượng cần bảo vệ.' }, { text: ' 보호하기 위해', grammar: '-기 위해', explanation: 'Diễn tả mục đích: “để làm việc gì”.' }, { text: ' 작은 ', plain: true }, { text: '습관', word: '습관', meaning: 'thói quen' }, { text: '을', grammar: '을/를', explanation: 'Đánh dấu tân ngữ.' }, { text: ' 실천하는 사람이 늘고 있다.', word: '실천하다', meaning: 'thực hành; thực hiện' },
        { text: '\n예를 들어, 장을 볼 때 ', plain: true }, { text: '비닐봉지', word: '비닐봉지', meaning: 'túi ni-lông' }, { text: ' 대신', grammar: '대신', explanation: '“Thay vì/thay cho” một lựa chọn khác.' }, { text: ' 장바구니를 사용하거나 가까운 거리는 걸어간다.', plain: true },
        { text: '\n이런 행동은 사소해 보이지만 많은 사람이 함께하면 큰 변화를 만들 수 있다.', plain: true }
      ],
      questions: [
        { id: 'q1', prompt: 'Đâu là ví dụ được nêu trong bài?', options: ['Dùng thêm túi ni-lông', 'Dùng túi đi chợ', 'Luôn đi ô tô'], answer: 1 },
        { id: 'q2', prompt: 'Ý chính của đoạn là gì?', options: ['Hành động nhỏ cùng nhau có thể tạo thay đổi lớn', 'Bảo vệ môi trường rất tốn kém', 'Chỉ chính phủ mới tạo được thay đổi'], answer: 0 }
      ]
    },
    {
      id: 'read-topik2-work', level: 'TOPIK 2+', title: 'Giao tiếp hiệu quả tại công sở', topic: 'Công việc', estimatedMinutes: 7,
      segments: [
        { text: '회사', word: '회사', meaning: 'công ty' }, { text: '에서', grammar: '에서', explanation: 'Nơi hoạt động giao tiếp diễn ra.' }, { text: ' 일을 잘하기 위해서는 업무 능력뿐만 아니라 ', plain: true }, { text: '의사소통', word: '의사소통', meaning: 'giao tiếp' }, { text: ' 능력도 중요하다.', plain: true },
        { text: '\n특히 의견이 다를 때 상대방의 말을 끝까지 듣고 자신의 생각을 분명하게 설명해야 한다.', plain: true },
        { text: '\n문제가 생겼을 때', grammar: '-(으)ㄹ 때', explanation: 'Diễn tả thời điểm hoặc tình huống “khi…”.' }, { text: '는 책임을 피하기보다 해결 방법을 함께 찾는 태도가 필요하다.', plain: true }
      ],
      questions: [
        { id: 'q1', prompt: 'Ngoài năng lực công việc, điều gì quan trọng?', options: ['Năng lực giao tiếp', 'Làm việc một mình', 'Tránh mọi ý kiến khác'], answer: 0 },
        { id: 'q2', prompt: 'Khi có vấn đề, thái độ nào cần thiết?', options: ['Tránh trách nhiệm', 'Cùng tìm cách giải quyết', 'Không nói gì'], answer: 1 }
      ]
    }
  ];

  const wordNetworks = [
    { id: 'network-eat', root: '먹다', meaning: 'ăn', forms: [{ korean: '먹어요', label: 'Hiện tại lịch sự' }, { korean: '먹었어요', label: 'Quá khứ lịch sự' }, { korean: '먹고 싶어요', label: 'Muốn ăn' }], related: [{ korean: '밥', label: 'cơm / bữa ăn' }, { korean: '음식', label: 'đồ ăn' }, { korean: '먹방', label: 'nội dung phát sóng ăn uống' }], collocations: [{ korean: '밥을 먹다', meaning: 'ăn cơm' }, { korean: '약을 먹다', meaning: 'uống thuốc' }, { korean: '아침을 먹다', meaning: 'ăn sáng' }] },
    { id: 'network-study', root: '공부하다', meaning: 'học', forms: [{ korean: '공부해요', label: 'Hiện tại lịch sự' }, { korean: '공부했어요', label: 'Quá khứ lịch sự' }, { korean: '공부하고 싶어요', label: 'Muốn học' }], related: [{ korean: '학교', label: 'trường học' }, { korean: '학생', label: 'học sinh / sinh viên' }, { korean: '수업', label: 'tiết học' }], collocations: [{ korean: '한국어를 공부하다', meaning: 'học tiếng Hàn' }, { korean: '도서관에서 공부하다', meaning: 'học ở thư viện' }] },
    { id: 'network-time', root: '시간', meaning: 'thời gian', forms: [{ korean: '시간이 있어요', label: 'Có thời gian' }, { korean: '시간이 없어요', label: 'Không có thời gian' }], related: [{ korean: '약속', label: 'cuộc hẹn' }, { korean: '일정', label: 'lịch trình' }, { korean: '날짜', label: 'ngày tháng' }], collocations: [{ korean: '시간을 보내다', meaning: 'dành/trải qua thời gian' }, { korean: '시간을 지키다', meaning: 'đúng giờ' }, { korean: '시간이 걸리다', meaning: 'mất thời gian' }] },
    { id: 'network-exercise', root: '운동', meaning: 'việc tập thể dục', forms: [{ korean: '운동하다', label: 'tập thể dục' }, { korean: '운동해요', label: 'Tập thể dục (lịch sự)' }], related: [{ korean: '건강', label: 'sức khỏe' }, { korean: '몸', label: 'cơ thể' }, { korean: '쉬다', label: 'nghỉ ngơi' }], collocations: [{ korean: '운동을 하다', meaning: 'tập thể dục' }, { korean: '매일 운동하다', meaning: 'tập thể dục mỗi ngày' }] }
  ];

  const collocations = [
    { id: 'col-exercise', prompt: '운동', particle: '을', choices: ['하다', '먹다', '마시다'], answer: '하다', natural: '운동을 하다', explanation: '운동하다 hoặc 운동을 하다 đều tự nhiên.' },
    { id: 'col-time', prompt: '시간', particle: '을', choices: ['보내다', '먹다', '입다'], answer: '보내다', natural: '시간을 보내다', explanation: '보내다 kết hợp với 시간을 để nói dành/trải qua thời gian.' },
    { id: 'col-photo', prompt: '사진', particle: '을', choices: ['찍다', '자다', '읽다'], answer: '찍다', natural: '사진을 찍다', explanation: '사진을 찍다 nghĩa là chụp ảnh.' },
    { id: 'col-medicine', prompt: '약', particle: '을', choices: ['먹다', '타다', '쓰다'], answer: '먹다', natural: '약을 먹다', explanation: 'Tiếng Hàn dùng 먹다 với thuốc uống.' },
    { id: 'col-promise', prompt: '약속', particle: '을', choices: ['지키다', '마시다', '입다'], answer: '지키다', natural: '약속을 지키다', explanation: '약속을 지키다 nghĩa là giữ lời hứa/đúng hẹn.' },
    { id: 'col-mistake', prompt: '실수', particle: '를', choices: ['하다', '먹다', '보다'], answer: '하다', natural: '실수를 하다', explanation: '실수하다 hoặc 실수를 하다 nghĩa là mắc lỗi.' }
  ];

  const dictations = [
    { id: 'dict-beginner-1', level: 'Beginner', text: '저는 학생이에요.', meaning: 'Tôi là học sinh/sinh viên.' },
    { id: 'dict-beginner-2', level: 'Beginner', text: '아침에 밥을 먹어요.', meaning: 'Tôi ăn cơm vào buổi sáng.' },
    { id: 'dict-topik1-1', level: 'TOPIK 1', text: '주말에는 도서관에서 공부해요.', meaning: 'Cuối tuần tôi học ở thư viện.' },
    { id: 'dict-topik1-2', level: 'TOPIK 1', text: '오후 세 시에 친구를 만나요.', meaning: 'Tôi gặp bạn lúc 3 giờ chiều.' },
    { id: 'dict-topik2-1', level: 'TOPIK 2+', text: '환경을 보호하기 위해 대중교통을 이용해요.', meaning: 'Tôi dùng phương tiện công cộng để bảo vệ môi trường.' },
    { id: 'dict-topik2-2', level: 'TOPIK 2+', text: '문제가 생기면 해결 방법을 함께 찾아야 해요.', meaning: 'Khi có vấn đề, chúng ta cần cùng tìm cách giải quyết.' }
  ];

  global.KLEARN_READING_EXPANSION = Object.freeze({
    schemaVersion: 1,
    readings: approve(readings, 'mixed'),
    wordNetworks: approve(wordNetworks, 'TOPIK_1'),
    collocations: approve(collocations, 'TOPIK_1'),
    dictations: approve(dictations, 'mixed')
  });
})(window);
