(function (global) {
  'use strict';

  const step = (id, npc, translation, modelAnswer, meaningGroups, grammar, contextKeywords, goal) => Object.freeze({
    id, npc, translation, modelAnswer, meaningGroups, grammarChecks: grammar.map(([grammarId, label, any]) => ({ id: grammarId, label, any })),
    naturalPatterns: [modelAnswer, ...modelAnswer.split(' ').filter((part) => part.length > 2)], contextKeywords, goal
  });
  const mission = (id, world, title, koreanTitle, icon, level, place, role, description, steps) => Object.freeze({ id, world, title, koreanTitle, icon, level, place, role, description, steps: Object.freeze(steps) });

  const missions = [
    mission('city-restaurant', 'city', 'Nhà hàng', '식당', '혹️', 'Beginner', 'Restaurant', 'Khách hàng', 'Vào quán, gọi món và hỏi thêm nước.', [
      step('restaurant-1', '어서 오세요. 몇 분이세요?', 'Xin chào, bạn đi mấy người?', '두 명이에요.', [['명'], ['두', '한', '세']], [['counter', 'Số đếm người', ['명']]], ['명'], '인원을 말하세요.'),
      step('restaurant-2', '무엇을 드릴까요?', 'Bạn muốn gọi món gì?', '비빔밥 하나랑 물 주세요.', [['주세요'], ['비빔밥', '불고기', '라면']], [['juseyo', '주세요', ['주세요']]], ['물', '비빔밥', '불고기'], '음식과 음료를 주문하세요.')
    ]),
    mission('city-airport', 'city', 'Sân bay', '공항', '✈', 'Beginner', 'Airport', 'Hành khách', 'Làm thủ tục và tìm cổng ra máy bay.', [
      step('airport-1', '여권을 보여 주세요.', 'Vui lòng cho xem hộ chiếu.', '네, 여기 있습니다.', [['네'], ['여기', '여권']], [['formal', 'Dạng trang trọng', ['습니다', '요']]], ['여권', '여기'], '여권을 건네주세요.'),
      step('airport-2', '탑승구는 12번입니다.', 'Cổng lên máy bay số 12.', '12번 탑승구는 어디에 있어요?', [['탑승구'], ['어디']], [['location', 'Hỏi vị trí', ['어디', '에']]], ['탑승구', '어디'], '탑승구의 위치를 물어보세요.')
    ]),
    mission('city-school', 'city', 'Trường học', '학교', '学', 'Beginner', 'School', 'Học viên mới', 'Giới thiệu bản thân và hỏi phòng học.', [
      step('school-1', '안녕하세요. 이름이 뭐예요?', 'Xin chào, bạn tên gì?', '저는 민수예요. 반갑습니다.', [['저는'], ['예요', '이에요']], [['topic', '은/는', ['는', '은']], ['copula', '이에요/예요', ['예요', '이에요']]], ['이름', '반갑'], '자기소개를 하세요.'),
      step('school-2', '첫 수업은 3층에서 해요.', 'Buổi học đầu ở tầng 3.', '3층 교실이 어디예요?', [['3층', '교실'], ['어디']], [['location', 'Hỏi vị trí', ['어디']]], ['교실', '어디'], '교실을 찾으세요.')
    ]),
    mission('city-hospital', 'city', 'Bệnh viện', '병원', '十', 'Beginner', 'Hospital', 'Bệnh nhân', 'Mô tả triệu chứng cơ bản và nghe hướng dẫn.', [
      step('hospital-1', '어디가 아프세요?', 'Bạn đau ở đâu?', '머리가 아프고 열이 나요.', [['아프'], ['머리', '배', '목', '열']], [['subject', '이/가', ['이', '가']]], ['아프', '열', '머리', '목'], '증상을 말하세요.'),
      step('hospital-2', '언제부터 아팠어요?', 'Bạn đau từ khi nào?', '어제 밤부터 아팠어요.', [['부터'], ['어제', '오늘', '일주일']], [['from-time', '부터', ['부터']]], ['어제', '오늘', '밤'], '증상이 시작된 시간을 말하세요.')
    ]),
    mission('roleplay-student', 'roleplay', 'Du học sinh mới', '새로 온 유학생', '◇', 'Intermediate', 'Campus', 'Du học sinh', 'Hoàn tất đăng ký và làm quen bạn cùng lớp.', [
      step('student-1', '수강 신청은 다 했어요?', 'Bạn đã đăng ký môn xong chưa?', '아직 못 했어요. 좀 도와줄 수 있어요?', [['아직', '못'], ['도와']], [['request', 'Nhờ giúp', ['수 있어요', '도와']]], ['수강', '도와'], '도움을 요청하세요.'),
      step('student-2', '이 수업은 과제가 많아요.', 'Môn này có nhiều bài tập.', '그래요? 그럼 같이 공부해요.', [['같이'], ['공부']], [['suggestion', 'Rủ cùng làm', ['같이', '해요']]], ['과제', '공부'], '같이 공부하자고 제안하세요.')
    ]),
    mission('roleplay-employee', 'roleplay', 'Nhân viên mới', '신입 사원', '▣', 'Intermediate', 'Office', 'Nhân viên', 'Chào đội nhóm và xác nhận việc đầu tiên.', [
      step('employee-1', '오늘부터 같이 일하게 됐네요.', 'Từ hôm nay chúng ta làm việc cùng nhau.', '안녕하십니까. 잘 부탁드립니다.', [['부탁'], ['안녕']], [['formal', 'Kính ngữ công việc', ['습니다', '니다']]], ['일', '부탁'], '첫인사를 하세요.'),
      step('employee-2', '먼저 이 보고서를 확인해 주세요.', 'Trước tiên hãy kiểm tra báo cáo này.', '네, 오늘 오후까지 확인하겠습니다.', [['확인'], ['오늘', '오후']], [['future', 'Cam kết -겠습니다', ['겠습니다']]], ['보고서', '확인'], '일정을 확인하세요.')
    ]),
    mission('roleplay-traveler', 'roleplay', 'Du lịch Hàn Quốc', '한국 여행', '旅', 'Beginner', 'Seoul', 'Khách du lịch', 'Đi từ sân bay về khách sạn và nhận phòng.', [
      step('traveler-1', '어디까지 가세요?', 'Bạn đi đến đâu?', '명동에 있는 호텔까지 가 주세요.', [['호텔'], ['가 주세요']], [['destination', '에/까지', ['에', '까지']]], ['명동', '호텔'], '목적지를 말하세요.'),
      step('traveler-2', '예약하셨습니까?', 'Bạn đã đặt phòng chưa?', '네, 도푸 이름으로 예약했어요.', [['예약'], ['이름']], [['as-name', 'Dưới tên', ['이름으로']]], ['예약', '이름'], '예약 이름을 말하세요.')
    ]),
    mission('career-interview', 'career', 'Phỏng vấn', '면접', '◎', 'Advanced', 'Company', 'Ứng viên', 'Giới thiệu kinh nghiệm và giải thích lý do ứng tuyển.', [
      step('interview-1', '자기소개를 간단히 해 주세요.', 'Hãy giới thiệu ngắn gọn.', '저는 마케팅 분야에서 3년 간 일한 경험이 있습니다.', [['경험'], ['년', '분야']], [['experience', 'Kinh nghiệm', ['경험이 있습니다']]], ['경험', '분야'], '경력을 소개하세요.'),
      step('interview-2', '왜 우리 회사에 지원했습니까?', 'Vì sao bạn ứng tuyển công ty chúng tôi?', '제 경험을 활용하여 한국 시장에 기여하고 싶습니다.', [['지원', '기여'], ['싶습니다']], [['intention', 'Mong muốn', ['고 싶습니다']]], ['회사', '시장', '경험'], '지원 동기를 설명하세요.')
    ]),
    mission('career-meeting', 'career', 'Cuộc họp', '회의', '▦', 'Advanced', 'Meeting room', 'Thành viên nhóm', 'Đề xuất giải pháp và thống nhất thời hạn.', [
      step('meeting-1', '일정이 늦어진 원인이 무엇입니까?', 'Nguyên nhân chậm tiến độ là gì?', '요구 사항이 자주 변경된 것이 가장 큰 원인입니다.', [['원인'], ['변경', '요구']], [['formal', 'Dạng trang trọng', ['입니다']]], ['일정', '원인', '변경'], '원인을 설명하세요.'),
      step('meeting-2', '어떻게 해결하면 좋을까요?', 'Nên giải quyết thế nào?', '우선순위를 정하고 변경 절차를 명확히 해야 합니다.', [['우선순위', '절차'], ['해야']], [['must', 'Cần phải', ['해야 합니다']]], ['해결', '우선순위', '절차'], '해결책을 제안하세요.')
    ]),
    mission('career-email', 'career', 'Email công việc', '업무 이메일', '✉', 'Intermediate', 'Office', 'Người gửi', 'Viết tiêu đề, lời chào và yêu cầu lịch sự.', [
      step('email-1', '자료를 언제까지 보낼 수 있어요?', 'Có thể gửi tài liệu trước khi nào?', '안녕하세요. 요청하신 자료는 금요일까지 보내드리겠습니다.', [['자료'], ['금요일', '보내']], [['formal-future', 'Cam kết lịch sự', ['드리겠습니다', '겠습니다']]], ['자료', '보내'], '이메일 답장을 작성하세요.')
    ]),
    mission('university-class', 'university', 'Trong lớp', '강의실', '▤', 'Intermediate', 'Classroom', 'Sinh viên', 'Hỏi lại phần chưa hiểu và xác nhận bài tập.', [
      step('class-1', '이 부분 이해했어요?', 'Bạn đã hiểu phần này chưa?', '아직 잘 모르겠습니다. 한 번 더 설명해 주세요.', [['모르'], ['설명']], [['request', 'Yêu cầu lịch sự', ['주세요']]], ['이해', '설명'], '다시 설명해 달라고 하세요.'),
      step('class-2', '과제는 다음 주 월요일까지예요.', 'Hạn bài tập là thứ Hai tuần sau.', '네, 다음 주 월요일까지 제출하겠습니다.', [['제출'], ['월요일']], [['deadline', 'Xác nhận hạn', ['까지']]], ['과제', '제출'], '과제 마감일을 확인하세요.')
    ]),
    mission('university-friend', 'university', 'Trò chuyện với bạn', '친구와 대화', '人', 'Beginner', 'Cafeteria', 'Bạn cùng lớp', 'Rủ bạn ăn trưa và nói về môn học.', [
      step('friend-1', '오늘 점심 같이 먹을래요?', 'Hôm nay ăn trưa cùng không?', '좋아요. 학식에서 같이 먹어요.', [['좋'], ['같이', '먹']], [['place-action', '에서', ['에서']]], ['점심', '학식'], '제안에 답하세요.'),
      step('friend-2', '오늘 수업 어땠어요?', 'Buổi học hôm nay thế nào?', '재미있었지만 좀 어려웠어요.', [['재미', '어려'], ['지만']], [['contrast', '-지만', ['지만']]], ['수업', '어려'], '수업 감상을 말하세요.')
    ]),
    mission('university-campus', 'university', 'Trong khuôn viên', '캠퍼스', '○', 'Beginner', 'Campus', 'Sinh viên', 'Tìm thư viện và hỏi giờ mở cửa.', [
      step('campus-1', '무엇을 찾으세요?', 'Bạn đang tìm gì?', '도서관을 찾고 있어요.', [['도서관'], ['찾']], [['object', '을/를', ['을', '를']]], ['도서관', '찾'], '찾는 곳을 말하세요.'),
      step('campus-2', '도서관은 오른쪽 건물이에요.', 'Thư viện ở tòa bên phải.', '몇 시에 문을 닫아요?', [['몇 시'], ['문', '닫']], [['time', 'Hỏi giờ', ['몇 시']]], ['도서관', '시'], '운영 시간을 물어보세요.')
    ]),
    mission('travel-booking', 'travel', 'Đặt phòng', '예약', '□', 'Intermediate', 'Hotel', 'Khách', 'Đặt phòng và xác nhận ngày.', [
      step('booking-1', '어떤 방을 원하세요?', 'Bạn muốn phòng nào?', '두 명이 머물 수 있는 방을 예약하고 싶어요.', [['방', '예약'], ['두 명']], [['want', 'Mong muốn', ['고 싶어요']]], ['방', '예약'], '필요한 객실을 말하세요.'),
      step('booking-2', '몇 박으로 예약할까요?', 'Bạn đặt mấy đêm?', '금요일부터 일요일까지 2박이에요.', [['박'], ['부터', '까지']], [['range', 'Từ…đến', ['부터', '까지']]], ['금요일', '일요일'], '숙박 기간을 말하세요.')
    ]),
    mission('travel-ordering', 'travel', 'Gọi món', '주문', '◇', 'Beginner', 'Restaurant', 'Khách', 'Hỏi món gợi ý và gọi món.', [
      step('ordering-1', '주문하시겠어요?', 'Bạn gọi món chứ?', '네, 이 집에서 가장 인기 있는 메뉴가 뭐예요?', [['인기', '메뉴'], ['뭐']], [['subject', '이/가', ['가', '이']]], ['메뉴', '인기'], '추천 메뉴를 물어보세요.'),
      step('ordering-2', '비빔밥을 많이 찾으세요.', 'Nhiều người chọn bibimbap.', '그럼 비빔밥 하나 주세요.', [['비빔밥'], ['주세요']], [['request', '주세요', ['주세요']]], ['비빔밥'], '메뉴를 주문하세요.')
    ]),
    mission('travel-directions', 'travel', 'Hỏi đường', '길 묻기', '→', 'Beginner', 'Street', 'Khách du lịch', 'Hỏi đường và xác nhận cách di chuyển.', [
      step('directions-1', '무엇을 도와드릴까요?', 'Tôi giúp gì được cho bạn?', '경복궁에 가고 싶은데 어떻게 가요?', [['경복궁'], ['어떻게', '가']], [['want', 'Muốn đi', ['고 싶']]], ['경복궁', '어떻게'], '길을 물어보세요.'),
      step('directions-2', '지하철 3호선을 타세요.', 'Hãy đi tàu điện tuyến 3.', '어디에서 내려야 해요?', [['어디'], ['내려']], [['must', 'Phải', ['야 해요']]], ['지하철', '내려'], '내릴 역을 물어보세요.')
    ]),
    mission('voice-daily', 'voice', 'Trò chuyện hằng ngày', '일상 대화', '●', 'Beginner', 'Open space', 'Chính bạn', 'Trả lời mở bằng text hoặc giọng nói.', [
      step('voice-1', '오늘 어떤 하루를 보냈어요?', 'Hôm nay bạn đã có một ngày thế nào?', '오늘은 바빠지만 보람 있는 하루였어요.', [['오늘'], ['하루', '바쁘', '좋', '힘들']], [['past', 'Kể về ngày đã qua', ['었어요', '았어요', '했어요']]], ['오늘', '하루'], '오늘을 설명하세요.'),
      step('voice-2', '내일은 무엇을 하고 싶어요?', 'Ngày mai bạn muốn làm gì?', '내일은 산책하고 한국어를 공부하고 싶어요.', [['내일'], ['고 싶']], [['want', 'Mong muốn', ['고 싶어요']]], ['내일', '공부', '산책'], '내일 계획을 말하세요.')
    ])
  ];

  const debateTopics = Object.freeze([
    { id: 'remote-work', title: 'Làm việc từ xa', korean: '재택근무는 출근보다 효율적인가?', opening: '재택근무가 더 효율적이라는 의견에 동의하세요?', keywords: ['동의', '반대', '효율', '소통'], connectors: ['하지만', '그러나', '때문에', '따라서'] },
    { id: 'online-class', title: 'Học online', korean: '온라인 수업은 대면 수업을 대체할 수 있는가?', opening: '온라인 수업이 대면 수업보다 더 좋다고 생각하세요?', keywords: ['수업', '장점', '단점', '집중'], connectors: ['하지만', '반면에', '때문에', '예를 들면'] },
    { id: 'public-transport', title: 'Giao thông công cộng', korean: '대중교통 이용을 늘려야 하는가?', opening: '도시에서 자가용보다 대중교통을 우선해야 할까요?', keywords: ['대중교통', '환경', '편리', '비용'], connectors: ['하지만', '때문에', '그러므로', '예를 들면'] }
  ]);

  global.KLEARN_IMMERSIVE_WORLD_DATA = Object.freeze({
    missions: Object.freeze(missions), debateTopics,
    worlds: Object.freeze([
      { id: 'city', title: 'Virtual Korean City', subtitle: 'Restaurant · Airport · School · Hospital', icon: '城', view: 'virtual-korean-city' },
      { id: 'roleplay', title: 'Roleplay Game', subtitle: 'Du học sinh · Nhân viên · Du lịch', icon: '◇', view: 'roleplay-game' },
      { id: 'career', title: 'Career Korean', subtitle: 'Interview · Meeting · Email', icon: '▣', view: 'career-korean' },
      { id: 'university', title: 'University Life', subtitle: 'Class · Friends · Campus', icon: '学', view: 'university-life' },
      { id: 'travel', title: 'Travel Simulator', subtitle: 'Booking · Ordering · Directions', icon: '旅', view: 'travel-simulator' },
      { id: 'voice', title: 'Voice World', subtitle: 'Hội thoại mở · voice/text fallback', icon: '●', view: 'voice-world' }
    ])
  });
})(window);
