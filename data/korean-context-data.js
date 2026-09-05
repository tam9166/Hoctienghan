/* Tiếng Hàn - TamHoanq — curated Korean context and natural usage data */
(function buildKoreanContextData(global) {
  'use strict';
  const approve = (items, difficulty = 'TOPIK_1') => items.map((item) => ({ contentVersion: 1, verified: true, difficulty, source: 'TamHoanq curriculum', reviewStatus: 'approved', ...item }));

  const vocabulary = [
    {
      id: 'context-gamsahamnida', korean: '감사합니다', meaningVi: 'cảm ơn', topic: 'greetings',
      politeness: 'Trang trọng, lịch sự', register: '합니다체',
      whenUsed: ['Cảm ơn người lạ hoặc người lớn tuổi', 'Trong công việc, dịch vụ và tình huống trang trọng'],
      whoUses: ['Người nói với khách hàng, đồng nghiệp hoặc người chưa thân'], situations: ['người lạ', 'công việc', 'dịch vụ'],
      avoid: ['Với bạn thân, thường tự nhiên hơn khi nói 고마워 hoặc 고마워요.'],
      collocations: [{ korean: '정말 감사합니다.', meaning: 'Thật sự cảm ơn.' }, { korean: '도와주셔서 감사합니다.', meaning: 'Cảm ơn vì đã giúp tôi.' }],
      invalidUsage: [], koreanUsuallySay: '고마워요 với người quen nhưng vẫn cần lịch sự; 고마워 với bạn thân.'
    },
    {
      id: 'context-school', korean: '학교', meaningVi: 'trường học', topic: 'school', politeness: 'Trung tính', register: 'Danh từ',
      whenUsed: ['Nói về trường học, việc đi học hoặc hoạt động diễn ra tại trường'], whoUses: ['Mọi đối tượng'], situations: ['trường học', 'học tập'], avoid: [],
      collocations: [{ korean: '학교에 가다', meaning: 'đi đến trường' }, { korean: '학교에서 공부하다', meaning: 'học ở trường' }, { korean: '학교에 다니다', meaning: 'theo học tại trường' }],
      invalidUsage: [{ korean: '학교를 먹다', reason: '먹다 (ăn) không kết hợp với 학교.' }], koreanUsuallySay: '학교에 다녀요 khi nói “tôi đang đi học/theo học ở một trường”.'
    },
    {
      id: 'context-bap', korean: '밥', meaningVi: 'cơm; bữa ăn', topic: 'food', politeness: 'Trung tính', register: 'Danh từ',
      whenUsed: ['Chỉ cơm đã nấu hoặc một bữa ăn nói chung'], whoUses: ['Mọi đối tượng'], situations: ['ăn uống', 'chào hỏi thân mật'], avoid: [],
      collocations: [{ korean: '밥을 먹다', meaning: 'ăn cơm / ăn một bữa' }, { korean: '밥 먹었어요?', meaning: 'Bạn ăn cơm chưa?' }],
      invalidUsage: [{ korean: '밥을 마시다', reason: '밥 là thức ăn nên dùng 먹다, không dùng 마시다.' }], koreanUsuallySay: '밥 먹었어요? có thể là lời hỏi thăm thân tình, không nhất thiết là lời mời ăn.'
    },
    {
      id: 'context-company', korean: '회사', meaningVi: 'công ty', topic: 'work', politeness: 'Trung tính', register: 'Danh từ',
      whenUsed: ['Nói về công ty hoặc nơi làm việc'], whoUses: ['Nhân viên và người đi làm'], situations: ['công việc', 'giới thiệu bản thân'], avoid: [],
      collocations: [{ korean: '회사에 다니다', meaning: 'làm việc cho một công ty' }, { korean: '회사에서 일하다', meaning: 'làm việc ở công ty' }, { korean: '회사에 출근하다', meaning: 'đi làm/đến công ty' }],
      invalidUsage: [{ korean: '회사를 공부하다', reason: 'Muốn nói học về công ty, cần nêu lĩnh vực cụ thể; 공부하다 không đi trực tiếp với 회사.' }], koreanUsuallySay: '회사에 다녀요 để nói tự nhiên “tôi đang đi làm ở công ty”.'
    },
    {
      id: 'context-appointment', korean: '약속', meaningVi: 'lời hứa; cuộc hẹn', topic: 'appointments', politeness: 'Trung tính', register: 'Danh từ',
      whenUsed: ['Nói về cuộc hẹn hoặc lời đã hứa'], whoUses: ['Mọi đối tượng'], situations: ['hẹn gặp', 'lịch cá nhân'], avoid: [],
      collocations: [{ korean: '약속을 잡다', meaning: 'sắp xếp một cuộc hẹn' }, { korean: '약속을 지키다', meaning: 'giữ lời hứa/đúng hẹn' }, { korean: '약속이 있다', meaning: 'có hẹn' }],
      invalidUsage: [{ korean: '약속을 가다', reason: 'Nói 약속에 가다 (đến cuộc hẹn) hoặc 약속 장소에 가다.' }], koreanUsuallySay: '오늘 약속이 있어요 khi muốn nói “hôm nay tôi có hẹn”.'
    },
    {
      id: 'context-friend', korean: '친구', meaningVi: 'bạn', topic: 'friends', politeness: 'Trung tính', register: 'Danh từ',
      whenUsed: ['Chỉ bạn bè, thường là người ngang tuổi hoặc quan hệ thân'], whoUses: ['Mọi đối tượng'], situations: ['quan hệ cá nhân', 'giới thiệu'], avoid: ['Không mặc định gọi người lớn tuổi mới quen là 친구.'],
      collocations: [{ korean: '친구를 만나다', meaning: 'gặp bạn' }, { korean: '친구와 이야기하다', meaning: 'nói chuyện với bạn' }], invalidUsage: [], koreanUsuallySay: '친한 친구 để nhấn mạnh “bạn thân”.'
    }
  ];

  const grammar = [
    {
      id: 'grammar-eun-neun', expression: '은/는', title: 'Trợ từ chủ đề', lessonTopics: ['Ngữ pháp cơ bản', 'Giới thiệu bản thân'], politeness: 'Không quyết định mức lịch sự',
      whenUsed: ['Nêu chủ đề hoặc tạo đối chiếu'], whoUses: ['Mọi đối tượng'], situations: ['giới thiệu', 'so sánh'],
      examples: [{ korean: '저는 학생이에요.', meaning: 'Còn tôi thì là học sinh/sinh viên.' }], koreanUsuallySay: 'Trong hội thoại, chủ ngữ/chủ đề có thể được lược khi hai bên đã hiểu.'
    },
    {
      id: 'grammar-i-ga', expression: '이/가', title: 'Trợ từ chủ ngữ', lessonTopics: ['Ngữ pháp cơ bản'], politeness: 'Không quyết định mức lịch sự',
      whenUsed: ['Đánh dấu chủ ngữ hoặc đưa thông tin mới'], whoUses: ['Mọi đối tượng'], situations: ['miêu tả', 'trả lời ai/cái gì'],
      examples: [{ korean: '비가 와요.', meaning: 'Trời mưa.' }], koreanUsuallySay: '비 와요 cũng rất tự nhiên khi ngữ cảnh đã rõ.'
    },
    {
      id: 'grammar-e-eseo', expression: '에 / 에서', title: 'Nơi đến và nơi diễn ra hành động', lessonTopics: ['Địa điểm', 'Trường học'], politeness: 'Không quyết định mức lịch sự',
      whenUsed: ['에: đích đến hoặc nơi tồn tại', '에서: nơi một hành động diễn ra'], whoUses: ['Mọi đối tượng'], situations: ['địa điểm', 'di chuyển'],
      examples: [{ korean: '학교에 가요.', meaning: 'Tôi đi đến trường.' }, { korean: '학교에서 공부해요.', meaning: 'Tôi học ở trường.' }], koreanUsuallySay: 'Chọn trợ từ theo vai trò của địa điểm, không chỉ theo nghĩa tiếng Việt “ở”.'
    },
    {
      id: 'grammar-juseyo', expression: '-아/어 주세요', title: 'Nhờ hoặc yêu cầu lịch sự', lessonTopics: ['Nhà hàng', 'Mua sắm', 'Dịch vụ'], politeness: '해요체 lịch sự',
      whenUsed: ['Nhờ ai làm việc gì', 'Gọi món hoặc yêu cầu dịch vụ'], whoUses: ['Khách hàng và người cần nhờ giúp'], situations: ['nhà hàng', 'mua sắm', 'dịch vụ'],
      examples: [{ korean: '천천히 말해 주세요.', meaning: 'Xin hãy nói chậm.' }], koreanUsuallySay: '주세요 thường tự nhiên hơn mệnh lệnh trực tiếp trong tình huống dịch vụ.'
    }
  ];

  const naturalExpressions = [
    { id: 'natural-hello', textbook: '안녕하세요.', natural: '안녕!', close: '안녕!', register: '반말', situation: 'Bạn bè hoặc người nhỏ tuổi', note: 'Không dùng 안녕 với cấp trên hay người lạ chỉ vì câu ngắn hơn.', politeness: 'Thân mật' },
    { id: 'natural-okay', textbook: '괜찮습니다.', natural: '괜찮아요.', close: '괜찮아.', register: '해요체', situation: 'Hội thoại hằng ngày lịch sự', note: '괜찮습니다 vẫn phù hợp trong thông báo, công việc trang trọng hoặc trả lời chính thức.', politeness: 'Lịch sự đời thường' },
    { id: 'natural-what-doing', textbook: '무엇을 하고 있습니까?', natural: '뭐 하고 있어요?', close: '뭐 해?', register: '해요체', situation: 'Hỏi người quen đang làm gì', note: '뭐 해? chỉ phù hợp khi quan hệ cho phép dùng 반말.', politeness: 'Lịch sự đời thường' },
    { id: 'natural-meal', textbook: '식사하셨습니까?', natural: '밥 먹었어요?', close: '밥 먹었어?', register: '해요체', situation: 'Hỏi thăm người quen', note: 'Đây có thể là lời hỏi thăm; với khách hàng hoặc dịp trang trọng vẫn dùng 식사하셨어요?', politeness: 'Lịch sự thân thiện' },
    { id: 'natural-delicious', textbook: '정말 맛있습니다.', natural: '진짜 맛있어요.', close: '진짜 맛있어.', register: '해요체', situation: 'Khen món ăn trong đời thường', note: '정말 trung tính hơn; 진짜 tạo cảm giác hội thoại, nhưng tránh lạm dụng trong văn viết trang trọng.', politeness: 'Lịch sự đời thường' },
    { id: 'natural-understand', textbook: '알겠습니다.', natural: '알겠어요.', close: '알았어.', register: '해요체', situation: 'Xác nhận đã hiểu với người quen', note: 'Ở công sở với cấp trên, 알겠습니다 thường an toàn và chuyên nghiệp hơn.', politeness: 'Lịch sự đời thường' },
    { id: 'natural-sorry', textbook: '죄송합니다.', natural: '미안해요.', close: '미안.', register: '해요체', situation: 'Xin lỗi người quen', note: '죄송합니다 phù hợp hơn với người lạ, cấp trên hoặc lỗi nghiêm túc.', politeness: 'Lịch sự thân thiện' },
    { id: 'natural-thanks', textbook: '감사합니다.', natural: '고마워요.', close: '고마워.', register: '해요체', situation: 'Cảm ơn người quen', note: 'Với khách hàng, người lạ hoặc bối cảnh công việc, 감사합니다 vẫn là lựa chọn tự nhiên.', politeness: 'Lịch sự thân thiện' }
  ];

  const formalityLevels = [
    { id: 'formal-polite', korean: '합니다체', group: '존댓말', label: 'Lịch sự trang trọng', example: '괜찮습니다.', use: 'Công việc chính thức, thông báo, dịch vụ trang trọng và lần đầu gặp.' },
    { id: 'haeyoche', korean: '해요체', group: '존댓말', label: 'Lịch sự đời thường', example: '괜찮아요.', use: 'Lựa chọn an toàn trong phần lớn hội thoại hằng ngày với người chưa thân.' },
    { id: 'banmal', korean: '반말', group: '비격식', label: 'Thân mật', example: '괜찮아.', use: 'Chỉ dùng khi hai bên thân, ngang hàng hoặc người lớn nói với người nhỏ hơn trong quan hệ phù hợp.' }
  ];

  global.KLEARN_KOREAN_CONTEXT = Object.freeze({
    schemaVersion: 1,
    reviewedAt: '2026-09-05',
    vocabulary: Object.freeze(approve(vocabulary)),
    grammar: Object.freeze(approve(grammar)),
    naturalExpressions: Object.freeze(approve(naturalExpressions)),
    formalityLevels: Object.freeze(approve(formalityLevels))
  });
})(window);
