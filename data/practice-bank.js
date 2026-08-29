(function buildPracticeBank(global) {
  'use strict';

  const vocabulary = global.KLEARN_VOCABULARY || [];
  const levelLabels = { Beginner: 'Beginner', TOPIK_I: 'TOPIK I', TOPIK_II: 'TOPIK II', EPS: 'EPS-TOPIK', VOCABULARY: 'Theo chủ đề' };
  const skillLabels = { vocabulary: 'Từ vựng', grammar: 'Ngữ pháp', listening: 'Nghe', reading: 'Đọc', mixed: 'Tổng hợp' };
  const levelTopics = {
    Beginner: ['Hangul', 'Chào hỏi', 'Gia đình', 'Đồ ăn', 'Số đếm', 'Thời gian', 'Mua sắm', 'Hỏi đường', 'Nhà ở', 'Sức khỏe'],
    TOPIK_I: ['Trợ từ', 'Thì của động từ', 'Hội thoại', 'Biển báo', 'Thông báo', 'Đọc hiểu', 'Kính ngữ', 'Mua sắm', 'Giao thông', 'Đời sống'],
    TOPIK_II: ['Từ học thuật', 'Liên kết câu', 'Suy luận', 'Bài báo ngắn', 'Công sở', 'Email', 'Phỏng vấn', 'Văn hóa xã hội', 'Giáo dục', 'Việc làm'],
    EPS: ['Công xưởng', 'Máy móc', 'Dụng cụ', 'An toàn', 'PPE', 'Tăng ca', 'Lương', 'Ký túc xá', 'Báo lỗi', 'Phòng cháy'],
    VOCABULARY: ['Chào hỏi', 'Gia đình', 'Trường học', 'Du học', 'Nhà ở', 'Ăn uống', 'Nhà hàng', 'Mua sắm', 'Giao thông', 'Thời tiết', 'Sức khỏe', 'Bệnh viện', 'Công việc', 'Công sở', 'Phỏng vấn', 'Du lịch', 'Ngân hàng', 'Bưu điện', 'Hẹn gặp', 'Điện thoại', 'K-Drama/K-Pop', 'Đời sống tại Hàn Quốc', 'EPS', 'TOPIK']
  };
  const topicKeys = ['greetings', 'family', 'school', 'study_abroad', 'housing', 'food', 'restaurant', 'shopping', 'transport', 'weather', 'health', 'hospital', 'work', 'office', 'interview', 'travel', 'banking', 'post_office', 'appointments', 'phone', 'entertainment', 'daily_life', 'eps_factory', 'topik'];

  const grammarTemplates = {
    Beginner: [
      ['저___ 베트남 사람입니다.', ['는', '은', '이', '을'], '는', '저 không có patchim nên dùng trợ từ chủ đề 는.', '은/는'],
      ['책___ 책상 위에 있습니다.', ['이', '가', '를', '는'], '이', '책 có patchim nên dùng 이 để đánh dấu chủ ngữ.', '이/가'],
      ['저는 김치___ 먹습니다.', ['를', '을', '가', '에'], '를', '김치 không có patchim nên tân ngữ dùng 를.', '을/를'],
      ['교실에 학생이 ___.', ['있습니다', '없습니다', '입니다', '갑니다'], '있습니다', '있다 diễn tả sự tồn tại: trong lớp có học sinh.', '있다/없다'],
      ['이것은 제 가방___.', ['입니다', '있습니다', '갑니다', '합니다'], '입니다', '이다 dùng để xác định “đây là cặp của tôi”.', '이다'],
      ['“15” trong số Hán-Hàn là gì?', ['십오', '열다섯', '오십', '다섯'], '십오', '10 là 십, 5 là 오; ghép lại thành 십오.', 'số Hán-Hàn'],
      ['“Ba người” dùng số thuần Hàn là gì?', ['세 명', '삼 명', '셋 명', '세 개'], '세 명', '셋 biến thành 세 khi đứng trước đơn vị đếm 명.', 'số thuần Hàn'],
      ['A: 안녕하세요? B: ___', ['안녕하세요', '미안해요', '아니요', '잘 자요'], '안녕하세요', 'Đáp lại lời chào lịch sự bằng 안녕하세요.', 'chào hỏi']
    ],
    TOPIK_I: [
      ['어제 친구를 ___.', ['만났어요', '만나요', '만날 거예요', '만나세요'], '만났어요', '어제 là hôm qua nên dùng quá khứ 만났어요.', 'quá khứ'],
      ['내일 도서관에 ___.', ['갈 거예요', '갔어요', '가고 있어요', '가세요'], '갈 거예요', '내일 chỉ tương lai nên dùng -(으)ㄹ 거예요.', 'tương lai'],
      ['저는 밥을 먹___ 커피를 마셔요.', ['고', '지만', '어서', '으면'], '고', '-고 nối hai hành động theo thứ tự hoặc liệt kê.', '-고'],
      ['비가 오___ 우산이 없어요.', ['지만', '고', '아서', '세요'], '지만', '-지만 diễn tả sự tương phản: trời mưa nhưng không có ô.', '-지만'],
      ['배가 아파___ 병원에 갔어요.', ['서', '지만', '고', '면'], '서', '-아서/어서 diễn tả nguyên nhân dẫn đến hành động sau.', '-아서/어서'],
      ['여기에서 잠깐 ___.', ['기다리세요', '기다렸어요', '기다릴까요', '기다립니다만'], '기다리세요', '-(으)세요 dùng để yêu cầu/đề nghị lịch sự.', '-(으)세요'],
      ['할머니께서 진지를 ___.', ['드세요', '먹어요', '먹어', '마셔요'], '드세요', '드시다 là kính ngữ của 먹다.', 'kính ngữ'],
      ['저는 한국어___ 공부합니다.', ['를', '은', '가', '에'], '를', '한국어 không có patchim nên dùng tân ngữ 를.', 'trợ từ']
    ],
    TOPIK_II: [
      ['노력한 ___ 좋은 결과를 얻을 수 있었다.', ['덕분에', '탓에', '바람에', '대신에'], '덕분에', '-(으)ㄴ 덕분에 dùng khi nguyên nhân đem lại kết quả tích cực.', 'ngữ pháp sắc thái'],
      ['회의가 길어지는 ___ 약속 시간에 늦었다.', ['바람에', '덕분에', '대신에', '듯이'], '바람에', '-는 바람에 thường dẫn tới kết quả không mong muốn.', 'nguyên nhân'],
      ['이 정책은 비용을 줄이는 ___ 효율성도 높였다.', ['동시에', '반면에', '대신에', '끝에'], '동시에', '동시에 thể hiện hai kết quả xảy ra cùng lúc.', 'liên kết câu'],
      ['충분히 검토한 ___ 결정을 내리겠습니다.', ['후에', '반면에', '탓에', '듯하다'], '후에', '-(으)ㄴ 후에 diễn tả hành động sau khi đã hoàn tất việc trước.', 'thứ tự'],
      ['상황이 예상보다 심각한 ___.', ['것으로 보인다', '적이 있다', '수밖에 없다면', '데다가'], '것으로 보인다', '-는 것으로 보인다 dùng để đưa ra nhận định có căn cứ.', 'suy luận'],
      ['지원자는 관련 경력이 있는 사람을 ___ 선발한다.', ['대상으로', '비롯해', '통해', '관해'], '대상으로', 'N을/를 대상으로 nghĩa là lấy N làm đối tượng.', 'từ học thuật'],
      ['문제를 해결하려면 원인을 정확히 ___ 한다.', ['파악해야', '파악하곤', '파악하더라도', '파악하느라'], '파악해야', '-아/어야 하다 diễn tả điều kiện bắt buộc.', 'biểu hiện bắt buộc'],
      ['그 제안은 현실성이 부족하다는 ___ 받았다.', ['평가를', '영향을', '관계를', '원인을'], '평가를', '평가를 받다 là kết hợp từ tự nhiên: nhận đánh giá.', 'kết hợp từ']
    ],
    EPS: [
      ['작업할 때 안전모를 꼭 ___.', ['쓰세요', '입으세요', '신으세요', '끼세요'], '쓰세요', 'Mũ bảo hộ dùng động từ 쓰다; 쓰세요 là yêu cầu lịch sự.', 'PPE'],
      ['기계가 고장 나면 즉시 전원을 ___.', ['끄세요', '켜세요', '올리세요', '열어 주세요'], '끄세요', 'Khi máy hỏng phải tắt nguồn ngay để bảo đảm an toàn.', 'báo lỗi thiết bị'],
      ['바닥이 미끄러우니 ___ 하십시오.', ['주의', '출근', '포장', '조립'], '주의', '주의하십시오 nghĩa là “hãy chú ý/cẩn thận”.', 'an toàn'],
      ['불이 났을 때 가장 먼저 해야 할 일은?', ['비상벨을 누른다', '창고로 간다', '기계를 계속 돌린다', '문을 잠근다'], '비상벨을 누른다', 'Khi cháy cần báo động và làm theo chỉ dẫn sơ tán.', 'phòng cháy'],
      ['오늘 두 시간 더 일했습니다. 이것을 ___라고 합니다.', ['연장 근무', '조퇴', '결근', '휴가'], '연장 근무', 'Làm thêm ngoài giờ gọi là 연장 근무 hoặc 잔업.', 'tăng ca'],
      ['손을 보호하기 위해 무엇을 착용합니까?', ['안전 장갑', '안전모', '마스크', '귀마개'], '안전 장갑', 'Găng tay bảo hộ dùng để bảo vệ bàn tay.', 'PPE'],
      ['관리자에게 기계 이상을 ___.', ['보고하세요', '예약하세요', '환전하세요', '계산하세요'], '보고하세요', 'Khi thiết bị bất thường cần báo cáo cho quản lý.', 'giao tiếp nơi làm việc'],
      ['월급은 보통 어디로 받습니까?', ['은행 계좌', '비상구', '작업대', '공구함'], '은행 계좌', 'Lương thường được chuyển vào tài khoản ngân hàng.', 'lương']
    ]
  };

  function rotateOptions(options, correctAnswer, seed) {
    const copy = [...options];
    const shift = seed % copy.length;
    return [...copy.slice(shift), ...copy.slice(0, shift)];
  }

  function distractorsFor(item, pool, seed) {
    const candidates = pool.filter((candidate) => candidate.id !== item.id && candidate.meaningVi !== item.meaningVi);
    return [0, 1, 2].map((offset) => candidates[(seed * 7 + offset * 11) % candidates.length]);
  }

  function vocabularyQuestion(context, index) {
    const pool = context.vocabPool.length >= 8 ? context.vocabPool : vocabulary;
    const item = pool[(context.seed * 15 + index * 13) % pool.length];
    const distractors = distractorsFor(item, pool, context.seed + index);
    const mode = index % 5;
    let prompt;
    let options;
    let correctAnswer;
    let questionType;
    let audioText = '';
    if (mode === 1) {
      prompt = `Từ tiếng Hàn nào có nghĩa là “${item.meaningVi}”?`;
      options = [item.korean, ...distractors.map((word) => word.korean)];
      correctAnswer = item.korean;
      questionType = 'vi_to_ko';
    } else if (mode === 2) {
      prompt = 'Nghe từ sau và chọn nghĩa đúng.';
      options = [item.meaningVi, ...distractors.map((word) => word.meaningVi)];
      correctAnswer = item.meaningVi;
      questionType = 'listening_multiple_choice';
      audioText = item.audioText;
    } else if (mode === 3) {
      prompt = `Điền từ phù hợp: 오늘의 표현은 “___”입니다. (${item.meaningVi})`;
      options = [item.korean, ...distractors.map((word) => word.korean)];
      correctAnswer = item.korean;
      questionType = 'fill_blank';
    } else {
      prompt = `“${item.korean}” có nghĩa là gì?`;
      options = [item.meaningVi, ...distractors.map((word) => word.meaningVi)];
      correctAnswer = item.meaningVi;
      questionType = 'ko_to_vi';
    }
    return {
      prompt,
      options: rotateOptions(options, correctAnswer, context.seed + index),
      correctAnswer,
      explanationVi: `${item.korean} nghĩa là “${item.meaningVi}”. Ví dụ: ${item.exampleKo}`,
      koreanText: item.korean,
      translationVi: item.meaningVi,
      audioText,
      questionType,
      topic: item.topicLabel,
      skill: mode === 2 ? 'listening' : 'vocabulary',
      tags: [...item.tags, 'vocabulary']
    };
  }

  function grammarQuestion(context, index) {
    const level = context.level === 'VOCABULARY' ? 'Beginner' : context.level;
    const templates = grammarTemplates[level] || grammarTemplates.TOPIK_I;
    const template = templates[(context.seed + index) % templates.length];
    return {
      prompt: template[0],
      options: rotateOptions(template[1], template[2], context.seed + index),
      correctAnswer: template[2],
      explanationVi: template[3],
      koreanText: template[0],
      translationVi: '',
      audioText: '',
      questionType: 'grammar_multiple_choice',
      topic: template[4],
      skill: 'grammar',
      tags: [template[4], 'grammar', context.level.toLowerCase()]
    };
  }

  function readingQuestion(context, index) {
    const item = context.vocabPool[(context.seed * 3 + index * 5) % context.vocabPool.length] || vocabulary[index % vocabulary.length];
    const isAdvanced = context.level === 'TOPIK_II';
    const isEps = context.level === 'EPS';
    const passages = isEps
      ? [
        ['작업 전에 보호구를 확인하십시오. 기계에 이상이 있으면 관리자에게 바로 보고해야 합니다.', 'Đâu là hành động đúng?', ['Kiểm tra đồ bảo hộ trước khi làm', 'Tự sửa máy khi chưa được phép', 'Bỏ qua dấu hiệu bất thường', 'Tháo đồ bảo hộ khi máy chạy'], 'Kiểm tra đồ bảo hộ trước khi làm', 'Đoạn văn yêu cầu kiểm tra đồ bảo hộ và báo quản lý khi máy bất thường.'],
        ['오늘은 주문량이 많아서 두 시간 연장 근무를 합니다. 저녁 식사는 회사에서 제공합니다.', 'Thông tin nào đúng?', ['Hôm nay làm thêm hai giờ', 'Hôm nay được nghỉ', 'Nhân viên tự chuẩn bị bữa tối', 'Đơn hàng hôm nay ít'], 'Hôm nay làm thêm hai giờ', '연장 근무를 합니다 nghĩa là làm thêm giờ.']
      ]
      : isAdvanced
        ? [
          ['최근에는 환경을 생각해 일회용품 사용을 줄이는 사람이 늘고 있다. 작은 실천이지만 사회 전체에 긍정적인 변화를 만들 수 있다.', 'Ý chính của đoạn văn là gì?', ['Thói quen nhỏ có thể tạo thay đổi tích cực', 'Đồ dùng một lần luôn tiện lợi hơn', 'Chỉ doanh nghiệp mới bảo vệ môi trường', 'Mọi người không quan tâm môi trường'], 'Thói quen nhỏ có thể tạo thay đổi tích cực', 'Đoạn văn nhấn mạnh giá trị của những hành động nhỏ nhằm giảm đồ dùng một lần.'],
          ['회사는 직원들의 업무 효율을 높이기 위해 유연 근무제를 도입했다. 직원들은 출퇴근 시간을 조정할 수 있게 되었다.', 'Có thể suy ra điều gì?', ['Nhân viên có thể điều chỉnh giờ đi làm', 'Công ty giảm toàn bộ lương', 'Nhân viên không cần làm việc', 'Công ty đóng cửa văn phòng'], 'Nhân viên có thể điều chỉnh giờ đi làm', '유연 근무제 cho phép điều chỉnh thời gian bắt đầu và kết thúc công việc.']
        ]
        : [
          [`민수 씨는 아침에 학교에 갑니다. 오후에는 도서관에서 ${item.korean}을(를) 공부합니다.`, 'Min-su học ở đâu vào buổi chiều?', ['Ở thư viện', 'Ở nhà hàng', 'Ở bệnh viện', 'Ở ngân hàng'], 'Ở thư viện', '도서관에서 nghĩa là “ở thư viện”.'],
          ['안내: 도서관은 오전 9시에 열고 오후 6시에 닫습니다. 일요일은 쉽니다.', 'Thông tin nào đúng?', ['Thư viện nghỉ Chủ nhật', 'Thư viện mở lúc 6 giờ', 'Thư viện mở cả đêm', 'Thư viện nghỉ thứ Hai'], 'Thư viện nghỉ Chủ nhật', '일요일은 쉽니다 nghĩa là nghỉ vào Chủ nhật.']
        ];
    const passage = passages[(context.seed + index) % passages.length];
    return {
      prompt: passage[1],
      options: rotateOptions(passage[2], passage[3], context.seed + index),
      correctAnswer: passage[3],
      explanationVi: passage[4],
      koreanText: passage[0],
      translationVi: '',
      audioText: context.skill === 'listening' ? passage[0] : '',
      questionType: context.skill === 'listening' ? 'listening_comprehension' : 'reading_comprehension',
      topic: context.topic,
      skill: context.skill === 'listening' ? 'listening' : 'reading',
      tags: [context.topic, context.skill]
    };
  }

  function buildQuestion(set, questionIndex) {
    const context = {
      ...set,
      seed: set.seed,
      vocabPool: set.vocabPool
    };
    const skillCycle = set.skill === 'mixed' ? ['vocabulary', 'grammar', 'listening', 'reading'] : [set.skill, 'vocabulary', set.skill, 'grammar', 'reading'];
    const selectedSkill = skillCycle[questionIndex % skillCycle.length];
    let content;
    if (selectedSkill === 'grammar' && set.level !== 'VOCABULARY') content = grammarQuestion(context, questionIndex);
    else if (selectedSkill === 'reading' || selectedSkill === 'listening') content = readingQuestion({ ...context, skill: selectedSkill }, questionIndex);
    else content = vocabularyQuestion(context, questionIndex);
    return Object.freeze({
      id: `${set.id}-q${String(questionIndex + 1).padStart(2, '0')}`,
      setId: set.id,
      level: set.level,
      category: set.category,
      skill: content.skill,
      topic: content.topic,
      difficulty: set.difficulty,
      questionType: content.questionType,
      prompt: content.prompt,
      options: content.options,
      correctAnswer: content.correctAnswer,
      explanationVi: content.explanationVi,
      koreanText: content.koreanText,
      translationVi: content.translationVi,
      audioText: content.audioText,
      tags: content.tags
    });
  }

  const groupConfigs = [
    { level: 'Beginner', count: 20, prefix: 'beg', category: 'level' },
    { level: 'TOPIK_I', count: 30, prefix: 't1', category: 'topik' },
    { level: 'TOPIK_II', count: 25, prefix: 't2', category: 'topik' },
    { level: 'EPS', count: 15, prefix: 'eps', category: 'eps' },
    { level: 'VOCABULARY', count: 24, prefix: 'voc', category: 'topic' }
  ];
  const skills = ['vocabulary', 'grammar', 'listening', 'reading', 'mixed'];
  const sets = [];

  groupConfigs.forEach((config, groupIndex) => {
    for (let index = 0; index < config.count; index += 1) {
      const skill = config.level === 'VOCABULARY' ? 'vocabulary' : skills[index % skills.length];
      const topic = levelTopics[config.level][index % levelTopics[config.level].length];
      const topicKey = config.level === 'VOCABULARY' ? topicKeys[index % topicKeys.length] : config.level === 'EPS' ? (index % 2 ? 'safety' : 'eps_factory') : null;
      const filtered = vocabulary.filter((item) => topicKey ? item.topic === topicKey : config.level === 'Beginner' ? item.level === 'Beginner' : config.level === 'EPS' ? item.level === 'EPS' : item.level !== 'EPS');
      sets.push(Object.freeze({
        id: `${config.prefix}-${String(index + 1).padStart(2, '0')}`,
        title: `${levelLabels[config.level]} · ${skillLabels[skill]} ${String(index + 1).padStart(2, '0')}`,
        level: config.level,
        levelLabel: levelLabels[config.level],
        category: config.category,
        skill,
        skillLabel: skillLabels[skill],
        topic,
        difficulty: (index % 3) + 1,
        questionCount: 15,
        seed: groupIndex * 100 + index + 1,
        vocabPool: filtered.length >= 8 ? filtered : vocabulary
      }));
    }
  });

  const publicSets = sets.map(({ vocabPool, ...set }) => Object.freeze(set));
  const internalById = new Map(sets.map((set) => [set.id, set]));
  global.KLEARN_PRACTICE_BANK = Object.freeze({
    sets: Object.freeze(publicSets),
    totalSetCount: sets.length,
    totalQuestionCount: sets.length * 15,
    distribution: Object.freeze(groupConfigs.reduce((result, config) => ({ ...result, [config.level]: config.count }), {})),
    getQuestions(setId) {
      const set = internalById.get(setId);
      return set ? Object.freeze(Array.from({ length: set.questionCount }, (_, index) => buildQuestion(set, index))) : Object.freeze([]);
    },
    getQuestion(questionId) {
      const setId = questionId.slice(0, questionId.lastIndexOf('-q'));
      return this.getQuestions(setId).find((question) => question.id === questionId) || null;
    }
  });
})(window);
