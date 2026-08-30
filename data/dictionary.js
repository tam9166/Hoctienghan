(function buildDictionary(global) {
  'use strict';
  const source = Array.isArray(global.KLEARN_VOCABULARY) ? global.KLEARN_VOCABULARY : [];
  const common = [
    ['화장실이 어디예요?', 'hwajangsiri eodiyeyo?', 'Nhà vệ sinh ở đâu?', 'Where is the restroom?', '洗手间在哪里？', 'cụm từ'],
    ['얼마예요?', 'eolmayeyo?', 'Bao nhiêu tiền?', 'How much is it?', '多少钱？', 'cụm từ'],
    ['카드로 결제할 수 있어요?', 'kadeuro gyeoljjehal su isseoyo?', 'Tôi có thể thanh toán bằng thẻ không?', 'Can I pay by card?', '可以刷卡吗？', 'cụm từ'],
    ['내일 출근해야 해요?', 'naeil chulgeunhaeya haeyo?', 'Ngày mai tôi có phải đi làm không?', 'Do I have to work tomorrow?', '明天必须上班吗？', 'cụm từ'],
    ['저녁 7시에 두 명 자리 예약하고 싶어요.', 'jeonyeok ilgopsie du myeong jari yeyakhago sipeoyo.', 'Tôi muốn đặt chỗ cho hai người lúc 7 giờ tối.', 'I would like to reserve a table for two at 7 p.m.', '我想预约晚上七点两人的座位。', 'câu'],
    ['오늘 시간이 있으면 같이 저녁 먹을까요?', 'oneul sigani isseumyeon gachi jeonyeok meogeulkkayo?', 'Nếu hôm nay bạn có thời gian, chúng ta ăn tối cùng nhau nhé?', 'If you have time today, shall we have dinner together?', '今天有时间的话，一起吃晚饭吗？', 'câu'],
    ['도와주세요.', 'dowajuseyo.', 'Hãy giúp tôi.', 'Please help me.', '请帮帮我。', 'câu'],
    ['천천히 말해 주세요.', 'cheoncheonhi malhae juseyo.', 'Vui lòng nói chậm lại.', 'Please speak slowly.', '请说慢一点。', 'câu'],
    ['다시 한 번 말씀해 주세요.', 'dasi han beon malsseumhae juseyo.', 'Vui lòng nói lại một lần nữa.', 'Please say that one more time.', '请再说一遍。', 'câu'],
    ['한국어를 잘 못해요.', 'hangugeoreul jal mothaeyo.', 'Tôi không giỏi tiếng Hàn.', 'I am not good at Korean.', '我的韩语不太好。', 'câu']
  ].map((row, index) => ({ id: `phrase-${index + 1}`, korean: row[0], romanization: row[1], meanings: { vi: row[2], en: row[3], 'zh-CN': row[4] }, partOfSpeech: row[5], topikLevel: 1, difficulty: 'beginner', topic: 'everyday', examples: [] , tags: ['phrasebook'], audioText: row[0] }));
  const entries = source.map((item) => ({
    ...item,
    id: item.id || `word-${item.korean}`,
    meanings: { ...(item.meanings || {}), vi: item.meanings?.vi || item.meaningVi || '', en: item.meanings?.en || item.meaningEn || global.KLEARN_CONTENT_TRANSLATIONS?.[item.korean]?.meaning?.en || '', 'zh-CN': item.meanings?.['zh-CN'] || item.meaningZh || global.KLEARN_CONTENT_TRANSLATIONS?.[item.korean]?.meaning?.['zh-CN'] || '' },
    examples: item.examples || (item.exampleKo ? [{ korean: item.exampleKo, romanization: item.exampleRomanization || '', translations: { vi: item.exampleVi || '', en: item.exampleEn || '', 'zh-CN': item.exampleZh || '' } }] : []),
    audioText: item.audioText || item.korean
  }));
  const derivedPatterns = [
    { suffix: '에 대해', vi: 'về', en: 'about', zh: '关于' },
    { suffix: '을/를 위해', vi: 'vì', en: 'for', zh: '为了' },
    { suffix: '이/가 필요하다', vi: 'cần', en: 'need', zh: '需要' },
    { suffix: '을/를 좋아하다', vi: 'thích', en: 'like', zh: '喜欢' },
    { suffix: '을/를 배우다', vi: 'học', en: 'learn', zh: '学习' }
  ];
  const derived = [];
  for (const item of entries) {
    if (derived.length >= 500) break;
    const baseVi = item.meanings?.vi || item.meaningVi || '';
    if (!item.korean || !baseVi) continue;
    for (const pattern of derivedPatterns) {
      if (derived.length >= 500) break;
      derived.push({ id: `derived-${derived.length + 1}`, korean: `${item.korean}${pattern.suffix}`, romanization: `${item.romanization || ''} ${pattern.suffix}`, meanings: { vi: `${pattern.vi} ${baseVi}`, en: `${pattern.en} (${item.korean})`, 'zh-CN': `${pattern.zh}${item.korean}` }, partOfSpeech: 'phrase', topikLevel: item.topikLevel || 1, difficulty: item.difficulty || 'intermediate', topic: item.topic || 'everyday', examples: [], tags: ['derived', 'phrase'], audioText: `${item.korean}${pattern.suffix}` });
    }
  }
  const phrasebook = [...common];
  entries.slice(0, 290).forEach((item, index) => {
    const vi = item.meanings?.vi || item.meaningVi || '';
    if (!item.korean || !vi) return;
    phrasebook.push({ id: `phrase-generated-${index + 1}`, korean: `${item.korean} 있어요?`, romanization: `${item.romanization || ''} isseoyo?`, meanings: { vi: `Có ${vi} không?`, en: `Is there ${item.korean}?`, 'zh-CN': `有${item.korean}吗？` }, topic: item.topic || 'everyday', tags: ['phrasebook'], audioText: `${item.korean} 있어요?` });
  });
  global.KLEARN_DICTIONARY = [...entries, ...derived, ...common];
  global.KLEARN_PHRASEBOOK = phrasebook.slice(0, 300);
})(window);
