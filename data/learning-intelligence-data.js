/* Tiếng Hàn - TamHoanq — verified data for the personal learning intelligence layer */
(function registerLearningIntelligenceData(global) {
  'use strict';
  global.KLEARN_LEARNING_INTELLIGENCE_DATA = Object.freeze({
    exampleQuality: Object.freeze([
      { id: 'example-school-go', korean: '학교에 가요.', meaningVi: 'Tôi đi đến trường.', topikLevel: 1, naturalScore: 97, difficulty: 'easy', frequency: 5, situation: 'daily-life', verified: true, source: 'curriculum-topik-1' },
      { id: 'example-time-spend', korean: '주말에 가족과 시간을 보내요.', meaningVi: 'Cuối tuần tôi dành thời gian với gia đình.', topikLevel: 1, naturalScore: 94, difficulty: 'easy', frequency: 4, situation: 'daily-life', verified: true, source: 'curriculum-topik-1' },
      { id: 'example-polite-thanks', korean: '도와주셔서 감사합니다.', meaningVi: 'Cảm ơn vì đã giúp tôi.', topikLevel: 2, naturalScore: 96, difficulty: 'medium', frequency: 4, situation: 'work', verified: true, source: 'curriculum-topik-2' },
      { id: 'example-cafe-order', korean: '아메리카노 한 잔 주세요.', meaningVi: 'Cho tôi một ly Americano.', topikLevel: 1, naturalScore: 98, difficulty: 'easy', frequency: 5, situation: 'cafe', verified: true, source: 'curriculum-topik-1' },
      { id: 'example-cause', korean: '비가 와서 집에 있어요.', meaningVi: 'Vì trời mưa nên tôi ở nhà.', topikLevel: 2, naturalScore: 91, difficulty: 'medium', frequency: 4, situation: 'daily-life', verified: true, source: 'curriculum-topik-2' },
      { id: 'example-office-schedule', korean: '회의는 오후 세 시에 시작합니다.', meaningVi: 'Cuộc họp bắt đầu lúc ba giờ chiều.', topikLevel: 3, naturalScore: 90, difficulty: 'hard', frequency: 3, situation: 'office', verified: true, source: 'curriculum-topik-3' }
    ]),
    grammarDependencies: Object.freeze([
      { id: 'grammar-copula', korean: '이에요/예요', titleVi: 'Đuôi là…', descriptionVi: 'Giới thiệu hoặc xác định danh từ ở mức lịch sự thân thiện.', prerequisiteIds: [], nextIds: ['grammar-topic'], topikLevel: 1 },
      { id: 'grammar-topic', korean: '은/는', titleVi: 'Trợ từ chủ đề', descriptionVi: 'Đánh dấu chủ đề đang được nói đến.', prerequisiteIds: ['grammar-copula'], nextIds: ['grammar-subject'], topikLevel: 1 },
      { id: 'grammar-subject', korean: '이/가', titleVi: 'Trợ từ chủ ngữ', descriptionVi: 'Đánh dấu chủ thể hoặc thông tin mới trong câu.', prerequisiteIds: ['grammar-topic'], nextIds: ['grammar-object'], topikLevel: 1 },
      { id: 'grammar-object', korean: '을/를', titleVi: 'Trợ từ tân ngữ', descriptionVi: 'Đánh dấu đối tượng của hành động.', prerequisiteIds: ['grammar-subject'], nextIds: ['grammar-past'], topikLevel: 1 },
      { id: 'grammar-past', korean: '았/었어요', titleVi: 'Quá khứ lịch sự', descriptionVi: 'Nói về một việc đã xảy ra.', prerequisiteIds: ['grammar-object'], nextIds: [], topikLevel: 1 }
    ]),
    vocabularyImportance: Object.freeze({
      '학교': { frequencyScore: 5, topikLevel: 1 }, '가다': { frequencyScore: 5, topikLevel: 1 }, '먹다': { frequencyScore: 5, topikLevel: 1 },
      '시간': { frequencyScore: 5, topikLevel: 1 }, '가족': { frequencyScore: 4, topikLevel: 1 }, '감사하다': { frequencyScore: 4, topikLevel: 1 },
      '학생': { frequencyScore: 4, topikLevel: 1 }, '공부하다': { frequencyScore: 5, topikLevel: 1 }, '친구': { frequencyScore: 4, topikLevel: 1 }
    }),
    dailyFeed: Object.freeze([
      { id: 'feed-01', dateKey: '01', phrase: '괜찮아요.', translation: 'Không sao đâu.', cultureNote: 'Đây là cách nói lịch sự tự nhiên trong hầu hết tình huống hằng ngày.', reading: '오늘은 괜찮아요. 내일 다시 해요.', readingTranslation: 'Hôm nay không sao. Ngày mai làm lại nhé.', vocabulary: { korean: '다시', meaning: 'lại, một lần nữa' }, verified: true, source: 'curriculum-topik-1' },
      { id: 'feed-02', dateKey: '02', phrase: '잘 부탁드립니다.', translation: 'Mong được giúp đỡ.', cultureNote: 'Thường dùng khi bắt đầu hợp tác, vào lớp hoặc làm quen trong bối cảnh trang trọng.', reading: '처음 뵙겠습니다. 잘 부탁드립니다.', readingTranslation: 'Rất vui được gặp bạn lần đầu. Mong được giúp đỡ.', vocabulary: { korean: '처음', meaning: 'lần đầu' }, verified: true, source: 'curriculum-topik-1' },
      { id: 'feed-03', dateKey: '03', phrase: '잠시만요.', translation: 'Xin chờ một chút.', cultureNote: 'Dùng để xin người khác đợi hoặc báo hiệu bạn cần một chút thời gian.', reading: '잠시만요. 확인해 볼게요.', readingTranslation: 'Xin chờ một chút. Tôi sẽ kiểm tra.', vocabulary: { korean: '확인하다', meaning: 'kiểm tra, xác nhận' }, verified: true, source: 'curriculum-topik-1' },
      { id: 'feed-04', dateKey: '04', phrase: '어떻게 지내세요?', translation: 'Dạo này bạn thế nào?', cultureNote: 'Một câu hỏi thân thiện, lịch sự khi lâu ngày gặp lại.', reading: '요즘 어떻게 지내세요?', readingTranslation: 'Dạo này bạn thế nào?', vocabulary: { korean: '요즘', meaning: 'dạo này' }, verified: true, source: 'curriculum-topik-1' },
      { id: 'feed-05', dateKey: '05', phrase: '천천히 말씀해 주세요.', translation: 'Hãy nói chậm một chút.', cultureNote: 'Cách nhờ người khác nói chậm, lịch sự và hữu ích khi giao tiếp thực tế.', reading: '한국어를 잘 못해요. 천천히 말씀해 주세요.', readingTranslation: 'Tôi chưa giỏi tiếng Hàn. Hãy nói chậm một chút.', vocabulary: { korean: '천천히', meaning: 'chậm rãi' }, verified: true, source: 'curriculum-topik-1' },
      { id: 'feed-06', dateKey: '06', phrase: '맛있게 드세요.', translation: 'Chúc ngon miệng.', cultureNote: 'Nói với người chuẩn bị ăn; người ăn thường đáp lại 잘 먹겠습니다 trước bữa ăn.', reading: '여기 음식이 정말 맛있어요.', readingTranslation: 'Đồ ăn ở đây thật sự ngon.', vocabulary: { korean: '음식', meaning: 'đồ ăn, thức ăn' }, verified: true, source: 'curriculum-topik-1' },
      { id: 'feed-07', dateKey: '07', phrase: '수고하셨어요.', translation: 'Bạn đã vất vả rồi.', cultureNote: 'Lời ghi nhận công sức, thường nghe ở trường học và nơi làm việc.', reading: '오늘도 수고하셨어요. 내일 만나요.', readingTranslation: 'Hôm nay bạn cũng đã vất vả rồi. Hẹn gặp ngày mai.', vocabulary: { korean: '내일', meaning: 'ngày mai' }, verified: true, source: 'curriculum-topik-1' }
    ]),
    audioSpeeds: Object.freeze([
      { id: 'slow', rate: 0.7, label: { vi: 'Chậm', en: 'Slow', 'zh-CN': '慢速' } },
      { id: 'normal', rate: 1, label: { vi: 'Bình thường', en: 'Normal', 'zh-CN': '正常' } },
      { id: 'native', rate: 1.18, label: { vi: 'Tự nhiên', en: 'Native', 'zh-CN': '母语速度' } }
    ])
  });
})(window);
