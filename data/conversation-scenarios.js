/* Expandable conversation curriculum. UI and evaluation logic live elsewhere. */
(function (global) {
  'use strict';
  const turn = (id, npc, npcMeaning, modelAnswer, options = {}) => Object.freeze({
    id, npc, npcMeaning, modelAnswer,
    meaningGroups: options.meaningGroups || [],
    grammarChecks: options.grammarChecks || [],
    naturalPatterns: options.naturalPatterns || [],
    contextKeywords: options.contextKeywords || [],
    coaching: options.coaching || ''
  });
  const scenario = (id, level, topic, situation, dialogue, expectedSkills, grammarIds, vocabularyIds) => Object.freeze({ id, level, topic, situation, dialogue: Object.freeze(dialogue), expectedSkills: Object.freeze(expectedSkills), grammarIds: Object.freeze(grammarIds), vocabularyIds: Object.freeze(vocabularyIds) });
  const grammar = (id, label, any) => Object.freeze({ id, label, any });

  global.KLEARN_CONVERSATION_SCENARIOS = Object.freeze([
    scenario('beginner-greeting', 'Beginner', 'greeting', { vi: 'Chào người hàng xóm mới', en: 'Greet a new neighbor', 'zh-CN': '向新邻居问好' }, [
      turn('greet-1', '안녕하세요? 처음 뵙겠습니다.', 'Xin chào, rất vui được gặp bạn.', '안녕하세요? 저도 반갑습니다.', { meaningGroups: [['안녕하세요', '안녕'], ['반갑습니다', '반가워요']], grammarChecks: [grammar('grammar_polite_ending', 'Đuôi câu lịch sự', ['요', '습니다'])], naturalPatterns: ['반갑습니다', '반가워요'], contextKeywords: ['안녕', '반갑'] }),
      turn('greet-2', '오늘 날씨가 좋네요. 산책하세요?', 'Hôm nay trời đẹp. Bạn đi dạo à?', '네, 공원에서 산책해요.', { meaningGroups: [['네', '맞아요'], ['산책']], grammarChecks: [grammar('grammar_eyo', 'Đuôi 요', ['요'])], naturalPatterns: ['산책해요', '맞아요'], contextKeywords: ['산책', '공원'] })
    ], ['speaking', 'listening', 'politeness'], ['grammar_polite_ending'], ['vocab_greeting', 'vocab_walk']),

    scenario('beginner-self-introduction', 'Beginner', 'self-introduction', { vi: 'Giới thiệu bản thân trong lớp học', en: 'Introduce yourself in class', 'zh-CN': '在课堂上自我介绍' }, [
      turn('intro-1', '안녕하세요. 이름이 뭐예요?', 'Xin chào. Bạn tên là gì?', '안녕하세요. 저는 민수예요.', { meaningGroups: [['저는', '제 이름은'], ['예요', '이에요', '입니다']], grammarChecks: [grammar('grammar_eun_neun', '은/는', ['은', '는']), grammar('grammar_copula', '이에요/예요', ['이에요', '예요', '입니다'])], naturalPatterns: ['예요', '이에요'], contextKeywords: ['저', '이름'] }),
      turn('intro-2', '어느 나라에서 왔어요?', 'Bạn đến từ nước nào?', '저는 베트남에서 왔어요.', { meaningGroups: [['베트남', '한국', '중국', '일본'], ['왔어요', '왔습니다']], grammarChecks: [grammar('grammar_eseo', '에서', ['에서'])], naturalPatterns: ['에서 왔어요'], contextKeywords: ['나라', '베트남', '한국', '중국', '일본'] }),
      turn('intro-3', '무슨 일을 하세요?', 'Bạn làm nghề gì?', '저는 학생이에요.', { meaningGroups: [['학생', '회사원', '선생님', '일해요'], ['이에요', '예요', '입니다', '일해요']], grammarChecks: [grammar('grammar_copula', '이에요/예요', ['이에요', '예요', '입니다', '일해요'])], naturalPatterns: ['이에요', '예요'], contextKeywords: ['학생', '회사원', '선생님', '일'], coaching: '“저는 학생입니다” đúng ngữ pháp; trong hội thoại thân thiện có thể nói “저는 학생이에요”.' })
    ], ['speaking', 'grammar', 'vocabulary'], ['grammar_eun_neun', 'grammar_copula', 'grammar_eseo'], ['vocab_name', 'vocab_country', 'vocab_student']),

    scenario('beginner-ordering', 'Beginner', 'restaurant', { vi: 'Gọi món tại quán ăn', en: 'Order at a restaurant', 'zh-CN': '在餐厅点餐' }, [
      turn('order-1', '어서 오세요. 몇 분이세요?', 'Xin chào. Có bao nhiêu người?', '두 명이에요.', { meaningGroups: [['명', '사람'], ['두', '한', '세', '네']], grammarChecks: [grammar('grammar_counter', 'Số đếm + 명', ['명'])], naturalPatterns: ['명이에요', '명입니다'], contextKeywords: ['명'] }),
      turn('order-2', '무엇을 드릴까요?', 'Bạn muốn gọi món gì?', '비빔밥 하나 주세요.', { meaningGroups: [['주세요'], ['비빔밥', '김치찌개', '불고기', '라면']], grammarChecks: [grammar('grammar_juseyo', '주세요', ['주세요'])], naturalPatterns: ['하나 주세요', '주세요'], contextKeywords: ['비빔밥', '김치찌개', '불고기', '라면'] }),
      turn('order-3', '음료도 필요하세요?', 'Bạn có cần đồ uống không?', '네, 물도 주세요.', { meaningGroups: [['네', '아니요'], ['물', '커피', '음료']], grammarChecks: [grammar('grammar_do', '도', ['도']), grammar('grammar_juseyo', '주세요', ['주세요'])], naturalPatterns: ['도 주세요'], contextKeywords: ['물', '커피', '음료'] })
    ], ['speaking', 'numbers', 'politeness'], ['grammar_counter', 'grammar_juseyo', 'grammar_do'], ['vocab_food', 'vocab_drink']),

    scenario('beginner-shopping', 'Beginner', 'shopping', { vi: 'Mua áo trong cửa hàng', en: 'Buy a shirt in a store', 'zh-CN': '在商店买衣服' }, [
      turn('shop-1', '어떤 옷을 찾으세요?', 'Bạn đang tìm loại quần áo nào?', '검은색 셔츠를 찾고 있어요.', { meaningGroups: [['셔츠', '옷', '바지', '치마'], ['찾']], grammarChecks: [grammar('grammar_eul_reul', '을/를', ['을', '를'])], naturalPatterns: ['찾고 있어요', '찾아요'], contextKeywords: ['셔츠', '옷', '바지', '치마'] }),
      turn('shop-2', '이 셔츠는 어떠세요?', 'Chiếc áo này thế nào?', '좋아요. 입어 봐도 돼요?', { meaningGroups: [['좋', '마음에 들어요'], ['입어', '사이즈']], grammarChecks: [grammar('grammar_permission', '-아/어도 돼요?', ['도 돼요', '봐도 돼요'])], naturalPatterns: ['입어 봐도 돼요', '마음에 들어요'], contextKeywords: ['셔츠', '입어', '사이즈'] })
    ], ['speaking', 'vocabulary', 'politeness'], ['grammar_eul_reul', 'grammar_permission'], ['vocab_clothes', 'vocab_color']),

    scenario('beginner-directions', 'Beginner', 'directions', { vi: 'Hỏi đường đến ga tàu điện', en: 'Ask the way to the subway', 'zh-CN': '询问去地铁站的路' }, [
      turn('direction-1', '무엇을 도와드릴까요?', 'Tôi có thể giúp gì cho bạn?', '지하철역이 어디에 있어요?', { meaningGroups: [['지하철역', '역'], ['어디']], grammarChecks: [grammar('grammar_i_ga', '이/가', ['이', '가']), grammar('grammar_e', '에', ['에'])], naturalPatterns: ['어디에 있어요', '어디예요'], contextKeywords: ['지하철', '역', '어디'] }),
      turn('direction-2', '여기에서 쭉 가서 오른쪽으로 가세요.', 'Từ đây đi thẳng rồi rẽ phải.', '감사합니다. 걸어서 얼마나 걸려요?', { meaningGroups: [['감사'], ['얼마나', '몇 분']], grammarChecks: [grammar('grammar_eoseo', '-어서', ['어서'])], naturalPatterns: ['얼마나 걸려요', '몇 분 걸려요'], contextKeywords: ['걸어', '걸려요', '분'] })
    ], ['speaking', 'listening', 'directions'], ['grammar_i_ga', 'grammar_e'], ['vocab_station', 'vocab_direction']),

    scenario('beginner-price', 'Beginner', 'price', { vi: 'Hỏi giá ở chợ', en: 'Ask a price at a market', 'zh-CN': '在市场询价' }, [
      turn('price-1', '어서 오세요. 무엇을 찾으세요?', 'Xin chào. Bạn đang tìm gì?', '사과를 사고 싶어요.', { meaningGroups: [['사과', '과일'], ['사고 싶어요', '주세요']], grammarChecks: [grammar('grammar_go_sipeoyo', '-고 싶어요', ['고 싶어요'])], naturalPatterns: ['사고 싶어요'], contextKeywords: ['사과', '과일'] }),
      turn('price-2', '사과는 한 봉지에 오천 원이에요.', 'Táo giá 5.000 won một túi.', '조금 비싸네요. 얼마예요?', { meaningGroups: [['얼마'], ['비싸', '가격']], grammarChecks: [grammar('grammar_eyo', 'Đuôi 요', ['요'])], naturalPatterns: ['얼마예요', '비싸네요'], contextKeywords: ['얼마', '원', '가격'] })
    ], ['speaking', 'numbers', 'shopping'], ['grammar_go_sipeoyo'], ['vocab_price', 'vocab_fruit']),

    scenario('intermediate-interview', 'Intermediate', 'interview', { vi: 'Phỏng vấn xin việc', en: 'Job interview', 'zh-CN': '求职面试' }, [
      turn('interview-1', '자기소개를 간단히 해 주세요.', 'Hãy giới thiệu ngắn gọn về bạn.', '저는 마케팅 분야에서 삼 년 동안 일한 경험이 있습니다.', { meaningGroups: [['저는', '제'], ['경험', '일']], grammarChecks: [grammar('grammar_experience', '경험이 있다', ['경험이 있습니다', '경험이 있어요'])], naturalPatterns: ['경험이 있습니다'], contextKeywords: ['경험', '분야', '일'] }),
      turn('interview-2', '왜 우리 회사에 지원했습니까?', 'Tại sao bạn ứng tuyển công ty chúng tôi?', '한국 시장에서 제 경험을 활용하고 싶어서 지원했습니다.', { meaningGroups: [['지원'], ['싶어서', '때문에', '관심']], grammarChecks: [grammar('grammar_cause', '-아서/어서', ['아서', '어서', '때문에'])], naturalPatterns: ['지원했습니다'], contextKeywords: ['회사', '지원', '경험'] }),
      turn('interview-3', '본인의 강점은 무엇입니까?', 'Điểm mạnh của bạn là gì?', '제 강점은 문제를 끝까지 해결하는 책임감입니다.', { meaningGroups: [['강점'], ['책임', '문제', '협업', '소통']], grammarChecks: [grammar('grammar_formal_copula', '입니다', ['입니다'])], naturalPatterns: ['강점은', '입니다'], contextKeywords: ['강점', '책임', '협업', '소통'] })
    ], ['speaking', 'formal-register', 'work'], ['grammar_experience', 'grammar_cause'], ['vocab_interview', 'vocab_experience']),

    scenario('intermediate-work', 'Intermediate', 'work', { vi: 'Trao đổi tiến độ công việc', en: 'Discuss work progress', 'zh-CN': '讨论工作进度' }, [
      turn('work-1', '보고서는 어디까지 진행됐어요?', 'Báo cáo đã tiến triển đến đâu?', '초안은 끝났고 지금 자료를 확인하고 있어요.', { meaningGroups: [['초안', '보고서'], ['확인', '완료', '끝']], grammarChecks: [grammar('grammar_go', '-고', ['고'])], naturalPatterns: ['하고 있어요', '끝났고'], contextKeywords: ['보고서', '자료', '확인'] }),
      turn('work-2', '오늘 오후까지 보낼 수 있을까요?', 'Có thể gửi trước chiều nay không?', '네, 세 시까지 보내겠습니다.', { meaningGroups: [['네', '가능'], ['시', '오늘', '오후'], ['보내']], grammarChecks: [grammar('grammar_future_formal', '-겠습니다', ['겠습니다', '수 있어요'])], naturalPatterns: ['보내겠습니다'], contextKeywords: ['보내', '시', '오후'] })
    ], ['speaking', 'work', 'time'], ['grammar_go', 'grammar_future_formal'], ['vocab_report', 'vocab_deadline']),

    scenario('intermediate-appointment', 'Intermediate', 'appointment', { vi: 'Đổi lịch hẹn', en: 'Reschedule an appointment', 'zh-CN': '更改预约时间' }, [
      turn('appointment-1', '금요일 약속은 괜찮으세요?', 'Lịch hẹn thứ Sáu có ổn không?', '죄송하지만 금요일에는 시간이 없어요.', { meaningGroups: [['죄송', '미안'], ['금요일'], ['시간이 없', '어려워']], grammarChecks: [grammar('grammar_jiman', '-지만', ['지만'])], naturalPatterns: ['죄송하지만'], contextKeywords: ['금요일', '시간'] }),
      turn('appointment-2', '그러면 언제가 편하세요?', 'Vậy khi nào bạn thuận tiện?', '토요일 오전으로 바꿀 수 있을까요?', { meaningGroups: [['토요일', '월요일', '화요일', '수요일', '목요일', '일요일'], ['바꿀', '변경']], grammarChecks: [grammar('grammar_eul_su', '-을 수 있을까요?', ['수 있을까요', '수 있어요'])], naturalPatterns: ['바꿀 수 있을까요'], contextKeywords: ['오전', '오후', '요일'] })
    ], ['speaking', 'scheduling', 'politeness'], ['grammar_jiman', 'grammar_eul_su'], ['vocab_appointment', 'vocab_weekday']),

    scenario('intermediate-opinion', 'Intermediate', 'opinion', { vi: 'Trao đổi ý kiến về học trực tuyến', en: 'Discuss online learning', 'zh-CN': '讨论在线学习' }, [
      turn('opinion-1', '온라인 수업에 대해 어떻게 생각하세요?', 'Bạn nghĩ gì về học trực tuyến?', '시간을 절약할 수 있어서 편리하다고 생각해요.', { meaningGroups: [['생각'], ['편리', '좋', '도움', '어렵']], grammarChecks: [grammar('grammar_go_saenggak', '-다고 생각하다', ['다고 생각', '라고 생각'])], naturalPatterns: ['다고 생각해요'], contextKeywords: ['온라인', '수업', '시간'] }),
      turn('opinion-2', '단점도 있을까요?', 'Có nhược điểm nào không?', '직접 질문하기 어렵다는 단점이 있어요.', { meaningGroups: [['단점', '어렵', '불편']], grammarChecks: [grammar('grammar_daneun', '-다는', ['다는', '라는'])], naturalPatterns: ['단점이 있어요'], contextKeywords: ['질문', '소통', '집중', '단점'] })
    ], ['speaking', 'reasoning', 'grammar'], ['grammar_go_saenggak', 'grammar_daneun'], ['vocab_online_class', 'vocab_opinion']),

    scenario('advanced-presentation', 'Advanced', 'presentation', { vi: 'Mở đầu bài thuyết trình', en: 'Open a presentation', 'zh-CN': '演讲开场' }, [
      turn('presentation-1', '발표를 시작해 주시겠습니까?', 'Bạn có thể bắt đầu bài thuyết trình không?', '안녕하십니까. 오늘은 한국의 직장 문화에 대해 발표하겠습니다.', { meaningGroups: [['오늘'], ['발표'], ['대해']], grammarChecks: [grammar('grammar_formal_future', '-겠습니다', ['겠습니다'])], naturalPatterns: ['안녕하십니까', '발표하겠습니다'], contextKeywords: ['문화', '주제', '발표'] }),
      turn('presentation-2', '발표의 핵심 내용을 먼저 설명해 주세요.', 'Hãy giải thích nội dung chính trước.', '핵심은 소통 방식과 업무 예절의 차이를 이해하는 것입니다.', { meaningGroups: [['핵심'], ['소통', '업무', '예절', '차이']], grammarChecks: [grammar('grammar_geosida', '-는 것입니다', ['것입니다', '점입니다'])], naturalPatterns: ['핵심은', '것입니다'], contextKeywords: ['핵심', '소통', '업무'] })
    ], ['speaking', 'presentation', 'formal-register'], ['grammar_formal_future', 'grammar_geosida'], ['vocab_presentation', 'vocab_work_culture']),

    scenario('advanced-debate', 'Advanced', 'debate', { vi: 'Tranh luận về làm việc từ xa', en: 'Debate remote work', 'zh-CN': '讨论远程办公' }, [
      turn('debate-1', '재택근무가 더 효율적이라는 의견에 동의하세요?', 'Bạn có đồng ý rằng làm việc từ xa hiệu quả hơn?', '부분적으로 동의하지만 모든 업무에 적합하지는 않습니다.', { meaningGroups: [['동의', '반대'], ['하지만', '그러나']], grammarChecks: [grammar('grammar_jiman', '-지만', ['지만', '그러나'])], naturalPatterns: ['동의하지만', '생각합니다'], contextKeywords: ['재택근무', '업무', '효율'] }),
      turn('debate-2', '그렇게 생각하는 근거는 무엇입니까?', 'Cơ sở cho ý kiến đó là gì?', '협업이 필요한 업무에서는 즉각적인 소통이 어렵기 때문입니다.', { meaningGroups: [['때문'], ['협업', '소통', '업무']], grammarChecks: [grammar('grammar_ttaemun', '-기 때문입니다', ['기 때문입니다', '때문입니다'])], naturalPatterns: ['기 때문입니다'], contextKeywords: ['근거', '협업', '소통'] })
    ], ['speaking', 'argumentation', 'formal-register'], ['grammar_jiman', 'grammar_ttaemun'], ['vocab_remote_work', 'vocab_collaboration']),

    scenario('advanced-meeting', 'Advanced', 'meeting', { vi: 'Đề xuất giải pháp trong cuộc họp', en: 'Propose a solution in a meeting', 'zh-CN': '在会议中提出解决方案' }, [
      turn('meeting-1', '일정이 늦어진 원인을 어떻게 보십니까?', 'Bạn nhìn nhận nguyên nhân chậm tiến độ thế nào?', '요구 사항이 여러 번 변경된 것이 가장 큰 원인이라고 봅니다.', { meaningGroups: [['원인'], ['변경', '일정', '요구']], grammarChecks: [grammar('grammar_dago_boda', '-다고 보다', ['다고 봅니다', '라고 봅니다'])], naturalPatterns: ['원인이라고 봅니다'], contextKeywords: ['일정', '원인', '변경'] }),
      turn('meeting-2', '문제를 해결하려면 무엇이 필요할까요?', 'Cần gì để giải quyết vấn đề?', '우선순위를 정하고 변경 절차를 명확히 할 필요가 있습니다.', { meaningGroups: [['필요'], ['우선순위', '절차', '명확']], grammarChecks: [grammar('grammar_eul_piryo', '-을 필요가 있다', ['필요가 있습니다', '필요합니다'])], naturalPatterns: ['필요가 있습니다'], contextKeywords: ['해결', '우선순위', '절차'] })
    ], ['speaking', 'meetings', 'problem-solving'], ['grammar_dago_boda', 'grammar_eul_piryo'], ['vocab_schedule', 'vocab_process'])
  ]);
})(window);
