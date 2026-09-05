/* Tiếng Hàn - TamHoanq — curated language mastery content */
(function exposeLanguageMasteryData(global) {
  'use strict';

  global.KLEARN_LANGUAGE_MASTERY_DATA = Object.freeze({
    subtitleScenes: Object.freeze([
      {
        id: 'subtitle-cafe-order', level: 'Beginner', topic: 'Quán cà phê', setting: 'cafe', verified: true,
        title: { vi: 'Gọi đồ uống', en: 'Ordering a drink', 'zh-CN': '点饮料' },
        lines: [
          { speaker: 'Nhân viên', korean: '어서 오세요. 주문하시겠어요?', translation: { vi: 'Chào bạn. Bạn muốn gọi món chứ?', en: 'Welcome. Would you like to order?', 'zh-CN': '欢迎光临。您要点单吗？' }, segments: [{ text: '어서 오세요. ', type: 'word', key: '어서 오세요' }, { text: '주문', type: 'word', key: '주문' }, { text: '하시겠어요?', type: 'grammar', key: '-시겠어요?' }] },
          { speaker: 'Người học', korean: '아메리카노 한 잔 주세요.', translation: { vi: 'Cho tôi một cốc Americano.', en: 'One Americano, please.', 'zh-CN': '请给我一杯美式咖啡。' }, segments: [{ text: '아메리카노', type: 'word', key: '아메리카노' }, { text: ' 한 잔 ', type: 'word', key: '한 잔' }, { text: '주세요.', type: 'grammar', key: '-주세요' }] },
          { speaker: 'Nhân viên', korean: '따뜻한 걸로 드릴까요?', translation: { vi: 'Tôi làm loại nóng cho bạn nhé?', en: 'Would you like it hot?', 'zh-CN': '给您热的可以吗？' }, segments: [{ text: '따뜻한', type: 'word', key: '따뜻하다' }, { text: ' 걸로 ', type: 'grammar', key: '-(으)로' }, { text: '드릴까요?', type: 'grammar', key: '-(으)ㄹ까요?' }] }
        ]
      },
      {
        id: 'subtitle-directions', level: 'TOPIK 1', topic: 'Hỏi đường', setting: 'street', verified: true,
        title: { vi: 'Tìm ga tàu điện', en: 'Finding the subway station', 'zh-CN': '寻找地铁站' },
        lines: [
          { speaker: 'Người học', korean: '실례합니다. 지하철역이 어디예요?', translation: { vi: 'Xin lỗi, ga tàu điện ở đâu ạ?', en: 'Excuse me, where is the subway station?', 'zh-CN': '打扰一下，地铁站在哪里？' }, segments: [{ text: '실례합니다. ', type: 'word', key: '실례합니다' }, { text: '지하철역', type: 'word', key: '지하철역' }, { text: '이 ', type: 'grammar', key: '이/가' }, { text: '어디예요?', type: 'word', key: '어디' }] },
          { speaker: 'Người qua đường', korean: '이 길로 쭉 가세요.', translation: { vi: 'Hãy đi thẳng theo đường này.', en: 'Go straight along this road.', 'zh-CN': '沿着这条路一直走。' }, segments: [{ text: '이 길', type: 'word', key: '길' }, { text: '로 ', type: 'grammar', key: '-(으)로' }, { text: '쭉 ', type: 'word', key: '쭉' }, { text: '가세요.', type: 'grammar', key: '-(으)세요' }] },
          { speaker: 'Người học', korean: '걸어서 몇 분 걸려요?', translation: { vi: 'Đi bộ mất khoảng bao nhiêu phút?', en: 'How many minutes does it take on foot?', 'zh-CN': '走路要几分钟？' }, segments: [{ text: '걸어서 ', type: 'word', key: '걸어서' }, { text: '몇 분 ', type: 'word', key: '몇 분' }, { text: '걸려요?', type: 'word', key: '걸리다' }] }
        ]
      },
      {
        id: 'subtitle-work-meeting', level: 'TOPIK 2', topic: 'Công việc', setting: 'office', verified: true,
        title: { vi: 'Đổi lịch họp', en: 'Rescheduling a meeting', 'zh-CN': '更改会议时间' },
        lines: [
          { speaker: 'Đồng nghiệp', korean: '오늘 회의를 세 시로 바꿀 수 있을까요?', translation: { vi: 'Hôm nay có thể đổi cuộc họp sang ba giờ không?', en: 'Could we move today’s meeting to three?', 'zh-CN': '今天的会议可以改到三点吗？' }, segments: [{ text: '오늘 ', type: 'word', key: '오늘' }, { text: '회의', type: 'word', key: '회의' }, { text: '를 ', type: 'grammar', key: '을/를' }, { text: '세 시로 ', type: 'grammar', key: '-(으)로' }, { text: '바꿀 수 있을까요?', type: 'grammar', key: '-(으)ㄹ 수 있다' }] },
          { speaker: 'Người học', korean: '네, 세 시가 더 좋습니다.', translation: { vi: 'Vâng, ba giờ thì tốt hơn.', en: 'Yes, three o’clock works better.', 'zh-CN': '好的，三点更合适。' }, segments: [{ text: '네, ', type: 'word', key: '네' }, { text: '세 시', type: 'word', key: '세 시' }, { text: '가 ', type: 'grammar', key: '이/가' }, { text: '더 좋습니다.', type: 'word', key: '좋다' }] }
        ]
      }
    ]),
    wordNotes: Object.freeze({
      '어서 오세요': { meaning: 'Xin chào / mời vào', partOfSpeech: 'expression', example: '어서 오세요. 여기 앉으세요.' },
      '주문': { meaning: 'gọi món, đơn gọi món', partOfSpeech: 'noun', example: '주문할게요.' },
      '아메리카노': { meaning: 'cà phê Americano', partOfSpeech: 'noun', example: '아메리카노를 마셔요.' },
      '한 잔': { meaning: 'một cốc / một ly', partOfSpeech: 'counter phrase', example: '커피 한 잔 주세요.' },
      '따뜻하다': { meaning: 'ấm, nóng vừa', partOfSpeech: 'adjective', example: '따뜻한 차를 마셔요.' },
      '실례합니다': { meaning: 'xin lỗi / cho phép tôi hỏi', partOfSpeech: 'expression', example: '실례합니다. 길 좀 물어볼게요.' },
      '지하철역': { meaning: 'ga tàu điện ngầm', partOfSpeech: 'noun', example: '지하철역에 가요.' },
      '어디': { meaning: 'đâu, ở đâu', partOfSpeech: 'pronoun', example: '화장실이 어디예요?' },
      '길': { meaning: 'đường', partOfSpeech: 'noun', example: '이 길로 가세요.' },
      '쭉': { meaning: 'thẳng, liên tục', partOfSpeech: 'adverb', example: '쭉 가세요.' },
      '걸어서': { meaning: 'bằng cách đi bộ', partOfSpeech: 'adverb', example: '걸어서 십 분이에요.' },
      '몇 분': { meaning: 'bao nhiêu phút', partOfSpeech: 'phrase', example: '몇 분 걸려요?' },
      '걸리다': { meaning: 'mất (thời gian)', partOfSpeech: 'verb', example: '한 시간 걸려요.' },
      '오늘': { meaning: 'hôm nay', partOfSpeech: 'noun', example: '오늘 회의가 있어요.' },
      '회의': { meaning: 'cuộc họp', partOfSpeech: 'noun', example: '회의를 시작해요.' },
      '네': { meaning: 'vâng', partOfSpeech: 'response', example: '네, 알겠습니다.' },
      '세 시': { meaning: 'ba giờ', partOfSpeech: 'time phrase', example: '세 시에 만나요.' },
      '좋다': { meaning: 'tốt, thích hợp', partOfSpeech: 'adjective', example: '이 시간이 좋아요.' }
    }),
    grammarNotes: Object.freeze({
      '-시겠어요?': { explanation: 'Cách hỏi ý định lịch sự, thường dùng với khách.', usage: '주문하시겠어요?' },
      '-주세요': { explanation: 'Dùng để yêu cầu hoặc gọi món một cách lịch sự.', usage: '물 한 병 주세요.' },
      '-(으)로': { explanation: 'Chỉ hướng đi, phương tiện hoặc sự thay đổi sang một lựa chọn.', usage: '이 길로 가세요.' },
      '-(으)ㄹ까요?': { explanation: 'Đề nghị hoặc hỏi ý kiến nhẹ nhàng.', usage: '같이 갈까요?' },
      '이/가': { explanation: 'Đánh dấu chủ ngữ hoặc thông tin được nhấn mạnh.', usage: '지하철역이 어디예요?' },
      '-(으)세요': { explanation: 'Đuôi đề nghị/mệnh lệnh lịch sự.', usage: '여기 앉으세요.' },
      '을/를': { explanation: 'Đánh dấu tân ngữ của hành động.', usage: '회의를 시작해요.' },
      '-(으)ㄹ 수 있다': { explanation: 'Diễn tả khả năng “có thể làm”.', usage: '바꿀 수 있어요.' }
    }),
    imageVocabulary: Object.freeze([
      { id: 'image-school', korean: '학교', meaning: 'trường học', visual: '🏫', color: '#DDF3FF', audio: '학교', example: '학교에서 공부해요.', category: 'Học tập' },
      { id: 'image-company', korean: '회사', meaning: 'công ty', visual: '🏢', color: '#E7E5FF', audio: '회사', example: '회사에 가요.', category: 'Công việc' },
      { id: 'image-train', korean: '지하철', meaning: 'tàu điện ngầm', visual: '🚇', color: '#FFE8D1', audio: '지하철', example: '지하철을 타요.', category: 'Du lịch' },
      { id: 'image-coffee', korean: '커피', meaning: 'cà phê', visual: '☕', color: '#F2E4D5', audio: '커피', example: '커피를 마셔요.', category: 'Ăn uống' },
      { id: 'image-movie', korean: '영화', meaning: 'phim', visual: '🎬', color: '#FFE2E8', audio: '영화', example: '주말에 영화를 봐요.', category: 'Giải trí' },
      { id: 'image-map', korean: '지도', meaning: 'bản đồ', visual: '🗺️', color: '#E0F4DF', audio: '지도', example: '지도를 봐요.', category: 'Du lịch' },
      { id: 'image-family', korean: '가족', meaning: 'gia đình', visual: '👨‍👩‍👧', color: '#FFF2C9', audio: '가족', example: '가족을 사랑해요.', category: 'Gia đình' },
      { id: 'image-book', korean: '책', meaning: 'sách', visual: '📚', color: '#E2EDFF', audio: '책', example: '책을 읽어요.', category: 'Học tập' }
    ]),
    grammarBank: Object.freeze([
      { id: 'grammar_eun_neun', pattern: '은/는', title: 'Trợ từ chủ đề', explanation: 'Đặt chủ đề đang được nói tới hoặc tạo sắc thái đối chiếu.', common: ['저는 학생이에요.', '오늘은 날씨가 좋아요.'], wrong: [{ text: '저가 학생이에요.', correction: '저는 학생이에요.', reason: 'Câu giới thiệu bản thân thường đặt 저는 làm chủ đề.' }], realUsage: '저는 괜찮아요. 먼저 드세요.' },
      { id: 'grammar_i_ga', pattern: '이/가', title: 'Trợ từ chủ ngữ', explanation: 'Đánh dấu chủ thể mang thông tin mới hoặc đối tượng được hỏi.', common: ['누가 왔어요?', '비가 와요.'], wrong: [{ text: '날씨는 좋아요? — 네, 날씨는 좋아요.', correction: '네, 날씨가 좋아요.', reason: 'Trong câu trả lời mô tả, 가 tự nhiên hơn khi nêu thông tin.' }], realUsage: '뭐가 제일 맛있어요?' },
      { id: 'grammar_e_eseo', pattern: '에 / 에서', title: 'Vị trí và nơi diễn ra hành động', explanation: '에 chỉ đích đến hoặc nơi tồn tại; 에서 chỉ nơi hành động xảy ra.', common: ['학교에 가요.', '학교에서 공부해요.'], wrong: [{ text: '학교에 공부해요.', correction: '학교에서 공부해요.', reason: '공부하다 là hành động nên dùng 에서.' }], realUsage: '카페에서 만날까요?' },
      { id: 'grammar_ieyo_yeyo', pattern: '이에요/예요', title: '“Là” ở dạng 해요체', explanation: 'Dùng 이에요 sau phụ âm cuối và 예요 sau nguyên âm.', common: ['학생이에요.', '의사예요.'], wrong: [{ text: '저는 의사이에요.', correction: '저는 의사예요.', reason: '의사 kết thúc bằng nguyên âm nên dùng 예요.' }], realUsage: '이거 뭐예요?' }
    ])
  });
})(window);
