(function buildVocabularyBank(global) {
  'use strict';

  const topicSources = {
    hangul: ['글자:chữ cái','자음:phụ âm','모음:nguyên âm','받침:phụ âm cuối','소리:âm thanh','발음:phát âm','음절:âm tiết','단어:từ vựng','문장:câu','뜻:ý nghĩa','읽기:đọc','쓰기:viết','듣기:nghe','말하기:nói','연습:luyện tập','문법:ngữ pháp','표현:biểu đạt','질문:câu hỏi','대답:câu trả lời','한국어:tiếng Hàn'],
    greetings: ['안녕하세요:xin chào','감사합니다:cảm ơn','죄송합니다:xin lỗi','괜찮아요:không sao','반갑습니다:rất vui được gặp','안녕히 가세요:tạm biệt người đi','안녕히 계세요:tạm biệt người ở lại','처음 뵙겠습니다:lần đầu gặp mặt','잘 지내세요?:bạn khỏe không?','네:vâng','아니요:không','어서 오세요:mời vào','또 만나요:hẹn gặp lại','좋은 아침이에요:chào buổi sáng','잘 부탁드립니다:nhờ bạn giúp đỡ','실례합니다:xin phép','잠깐만요:xin chờ một chút','여보세요:a lô','축하합니다:chúc mừng','환영합니다:chào mừng'],
    numbers: ['일:một Hán-Hàn','이:hai Hán-Hàn','삼:ba Hán-Hàn','사:bốn Hán-Hàn','오:năm Hán-Hàn','육:sáu Hán-Hàn','칠:bảy Hán-Hàn','팔:tám Hán-Hàn','구:chín Hán-Hàn','십:mười Hán-Hàn','하나:một thuần Hàn','둘:hai thuần Hàn','셋:ba thuần Hàn','넷:bốn thuần Hàn','다섯:năm thuần Hàn','여섯:sáu thuần Hàn','일곱:bảy thuần Hàn','여덟:tám thuần Hàn','아홉:chín thuần Hàn','스물:hai mươi thuần Hàn'],
    family: ['가족:gia đình','아버지:bố','어머니:mẹ','부모님:bố mẹ','아들:con trai','딸:con gái','형:anh trai của nam','오빠:anh trai của nữ','누나:chị gái của nam','언니:chị gái của nữ','동생:em','남동생:em trai','여동생:em gái','할아버지:ông','할머니:bà','남편:chồng','아내:vợ','부부:vợ chồng','친척:họ hàng','아이:trẻ em'],
    time: ['시간:thời gian','시:giờ','분:phút','초:giây','오늘:hôm nay','어제:hôm qua','내일:ngày mai','아침:buổi sáng','점심:buổi trưa','저녁:buổi tối','밤:ban đêm','주:tuần','주말:cuối tuần','월요일:thứ Hai','화요일:thứ Ba','수요일:thứ Tư','목요일:thứ Năm','금요일:thứ Sáu','토요일:thứ Bảy','일요일:Chủ nhật'],
    school: ['학교:trường học','학생:học sinh','선생님:giáo viên','교실:phòng học','책:sách','공책:vở','연필:bút chì','볼펜:bút bi','지우개:cục tẩy','가방:cặp sách','수업:tiết học','숙제:bài tập về nhà','시험:kỳ thi','문제:câu hỏi bài thi','정답:đáp án đúng','성적:điểm số','도서관:thư viện','칠판:bảng','공부하다:học','가르치다:dạy'],
    study_abroad: ['유학:du học','대학교:đại học','대학원:cao học','학과:khoa ngành','전공:chuyên ngành','장학금:học bổng','등록금:học phí','기숙사:ký túc xá','비자:thị thực','입학:nhập học','졸업:tốt nghiệp','학기:học kỳ','교환학생:sinh viên trao đổi','유학생:sinh viên quốc tế','신청하다:đăng ký','제출하다:nộp','서류:hồ sơ','면접:phỏng vấn','연구:nghiên cứu','강의:bài giảng'],
    food: ['음식:đồ ăn','밥:cơm','김치:kimchi','불고기:thịt nướng bulgogi','비빔밥:cơm trộn','국:canh','찌개:món hầm','고기:thịt','생선:cá','채소:rau','과일:trái cây','물:nước','우유:sữa','커피:cà phê','차:trà','빵:bánh mì','달걀:trứng','소금:muối','설탕:đường','맛있다:ngon'],
    restaurant: ['식당:nhà hàng','메뉴:thực đơn','주문:đặt món','손님:khách','직원:nhân viên','자리:chỗ ngồi','예약:đặt chỗ','계산:tính tiền','영수증:hóa đơn','포장:mang về','배달:giao hàng','숟가락:thìa','젓가락:đũa','접시:đĩa','컵:cốc','맵다:cay','짜다:mặn','달다:ngọt','싱겁다:nhạt','드시다:dùng bữa kính ngữ'],
    shopping: ['시장:chợ','가게:cửa hàng','백화점:trung tâm bách hóa','가격:giá cả','돈:tiền','현금:tiền mặt','카드:thẻ','할인:giảm giá','사이즈:kích cỡ','색깔:màu sắc','옷:quần áo','신발:giày','바지:quần','치마:váy','셔츠:áo sơ mi','사다:mua','팔다:bán','비싸다:đắt','싸다:rẻ','바꾸다:đổi'],
    transport: ['교통:giao thông','버스:xe buýt','지하철:tàu điện ngầm','택시:taxi','기차:tàu hỏa','비행기:máy bay','자동차:ô tô','자전거:xe đạp','정류장:trạm xe','역:ga','공항:sân bay','표:vé','길:đường','신호등:đèn giao thông','횡단보도:vạch qua đường','타다:lên xe','내리다:xuống xe','갈아타다:chuyển tuyến','출발하다:khởi hành','도착하다:đến nơi'],
    housing: ['집:nhà','방:phòng','거실:phòng khách','부엌:nhà bếp','화장실:nhà vệ sinh','침실:phòng ngủ','문:cửa','창문:cửa sổ','침대:giường','책상:bàn học','의자:ghế','냉장고:tủ lạnh','세탁기:máy giặt','에어컨:điều hòa','월세:tiền thuê tháng','보증금:tiền đặt cọc','이사:chuyển nhà','주소:địa chỉ','층:tầng','엘리베이터:thang máy'],
    weather: ['날씨:thời tiết','봄:mùa xuân','여름:mùa hè','가을:mùa thu','겨울:mùa đông','비:mưa','눈:tuyết','바람:gió','구름:mây','하늘:bầu trời','기온:nhiệt độ','덥다:nóng','춥다:lạnh','따뜻하다:ấm','시원하다:mát','맑다:trong','흐리다:u ám','습하다:ẩm','장마:mùa mưa','태풍:bão'],
    health: ['건강:sức khỏe','몸:cơ thể','머리:đầu','얼굴:khuôn mặt','눈:mắt','코:mũi','입:miệng','귀:tai','손:tay','발:chân','배:bụng','등:lưng','아프다:đau','감기:cảm cúm','열:sốt','기침:ho','약:thuốc','운동:vận động','쉬다:nghỉ','낫다:khỏi bệnh'],
    hospital: ['병원:bệnh viện','의사:bác sĩ','간호사:y tá','환자:bệnh nhân','진료:khám bệnh','예약:đặt lịch','응급실:phòng cấp cứu','약국:nhà thuốc','처방전:đơn thuốc','주사:mũi tiêm','수술:phẫu thuật','검사:xét nghiệm','치료:điều trị','증상:triệu chứng','보험:bảo hiểm','신분증:giấy tờ tùy thân','알레르기:dị ứng','혈압:huyết áp','상처:vết thương','붕대:băng gạc'],
    work: ['일:công việc','회사:công ty','직장:nơi làm việc','직원:nhân viên','사장님:giám đốc/chủ','팀장님:trưởng nhóm','동료:đồng nghiệp','회의:cuộc họp','업무:nhiệm vụ','출근:đi làm','퇴근:tan làm','휴가:kỳ nghỉ','월급:lương tháng','계약:hợp đồng','경력:kinh nghiệm','지원하다:ứng tuyển','보고하다:báo cáo','확인하다:xác nhận','준비하다:chuẩn bị','완료하다:hoàn thành'],
    office: ['사무실:văn phòng','컴퓨터:máy tính','프린터:máy in','서류:tài liệu','파일:tệp','이메일:email','전화:điện thoại','일정:lịch trình','마감:hạn chót','자료:dữ liệu','복사하다:sao chép','인쇄하다:in','저장하다:lưu','보내다:gửi','받다:nhận','서명하다:ký tên','발표하다:thuyết trình','협력하다:hợp tác','출장:đi công tác','명함:danh thiếp'],
    eps_factory: ['공장:nhà máy','작업장:khu làm việc','기계:máy móc','설비:thiết bị','공구:dụng cụ','망치:búa','드라이버:tua vít','용접:hàn','조립:lắp ráp','포장:đóng gói','제품:sản phẩm','부품:linh kiện','재료:vật liệu','창고:kho','생산:sản xuất','검사:kiểm tra','고장:hỏng hóc','수리:sửa chữa','작동하다:vận hành','멈추다:dừng'],
    safety: ['안전:an toàn','위험:nguy hiểm','주의:chú ý','금지:cấm','보호구:đồ bảo hộ','안전모:mũ bảo hộ','장갑:găng tay','보안경:kính bảo hộ','마스크:khẩu trang','안전화:giày bảo hộ','소화기:bình chữa cháy','비상구:lối thoát hiểm','화재:hỏa hoạn','사고:tai nạn','신고하다:báo cáo','대피하다:sơ tán','끄다:tắt','켜다:bật','만지다:chạm','미끄럽다:trơn trượt'],
    travel: ['여행:du lịch','관광:tham quan','호텔:khách sạn','여권:hộ chiếu','짐:hành lý','지도:bản đồ','안내소:quầy hướng dẫn','관광지:điểm du lịch','사진:ảnh','해변:bãi biển','산:núi','바다:biển','섬:đảo','표를 예약하다:đặt vé','묵다:lưu trú','구경하다:tham quan','출입국:xuất nhập cảnh','환전하다:đổi tiền','기념품:quà lưu niệm','축제:lễ hội'],
    banking: ['은행:ngân hàng','계좌:tài khoản','통장:sổ ngân hàng','송금:chuyển tiền','입금:nộp tiền','출금:rút tiền','잔액:số dư','수수료:phí dịch vụ','환율:tỷ giá','ATM:máy ATM','비밀번호:mật khẩu','신용카드:thẻ tín dụng','체크카드:thẻ ghi nợ','대출:khoản vay','이자:lãi suất','창구:quầy giao dịch','번호표:phiếu số','돈을 찾다:rút tiền','돈을 보내다:gửi tiền','확인증:giấy xác nhận'],
    phone: ['전화기:điện thoại','휴대폰:điện thoại di động','번호:số','통화:cuộc gọi','문자:tin nhắn','연락:liên lạc','충전:sạc pin','배터리:pin','인터넷:internet','와이파이:wifi','앱:ứng dụng','사진을 찍다:chụp ảnh','전화를 걸다:gọi điện','전화를 받다:nghe điện thoại','끊다:cúp máy','메시지를 보내다:gửi tin','비행기 모드:chế độ máy bay','화면:màn hình','고객센터:trung tâm khách hàng','연결되다:được kết nối'],
    emotions: ['기분:tâm trạng','행복하다:hạnh phúc','기쁘다:vui','슬프다:buồn','화나다:giận','걱정하다:lo lắng','무섭다:sợ','놀라다:ngạc nhiên','피곤하다:mệt','심심하다:chán','재미있다:thú vị','재미없다:không thú vị','편하다:thoải mái','불편하다:bất tiện','좋아하다:thích','싫어하다:ghét','사랑하다:yêu','그립다:nhớ nhung','긴장하다:căng thẳng','부끄럽다:xấu hổ'],
    verbs: ['가다:đi','오다:đến','먹다:ăn','마시다:uống','보다:xem','듣다:nghe','읽다:đọc','쓰다:viết','말하다:nói','배우다:học','만나다:gặp','살다:sống','일하다:làm việc','자다:ngủ','일어나다:thức dậy','만들다:làm tạo','열다:mở','닫다:đóng','기다리다:chờ','도와주다:giúp đỡ'],
    adjectives: ['좋다:tốt','나쁘다:xấu','크다:lớn','작다:nhỏ','많다:nhiều','적다:ít','빠르다:nhanh','느리다:chậm','쉽다:dễ','어렵다:khó','새롭다:mới','오래되다:cũ lâu','깨끗하다:sạch','더럽다:bẩn','조용하다:yên tĩnh','시끄럽다:ồn ào','가깝다:gần','멀다:xa','친절하다:thân thiện','중요하다:quan trọng'],
    body: ['몸:cơ thể','머리:đầu','얼굴:khuôn mặt','목:cổ','어깨:vai','팔:cánh tay','손:bàn tay','손가락:ngón tay','가슴:ngực','배:bụng','허리:eo lưng','등:lưng','다리:chân','무릎:đầu gối','발:bàn chân','발가락:ngón chân','피:máu','뼈:xương','피부:da','심장:tim'],
    post_office: ['우체국:bưu điện','우편:thư tín','편지:thư','엽서:bưu thiếp','소포:bưu kiện','택배:chuyển phát','봉투:phong bì','우표:tem','주소:địa chỉ','우편번호:mã bưu chính','보내는 사람:người gửi','받는 사람:người nhận','등기우편:thư bảo đảm','항공편:đường hàng không','배송:giao hàng','배송비:phí giao hàng','무게:trọng lượng','저울:cân','붙이다:dán','도착하다:đến nơi'],
    appointments: ['약속:cuộc hẹn','시간:thời gian','장소:địa điểm','일정:lịch trình','날짜:ngày tháng','가능하다:có thể','정하다:quyết định','만나다:gặp','기다리다:chờ','늦다:muộn','취소하다:hủy','변경하다:thay đổi','연기하다:hoãn','확인하다:xác nhận','예약하다:đặt lịch','이번 주:tuần này','다음 주:tuần sau','몇 시:mấy giờ','어디에서:ở đâu','시간이 되다:có thời gian'],
    entertainment: ['드라마:phim truyền hình','영화:phim điện ảnh','음악:âm nhạc','노래:bài hát','가수:ca sĩ','배우:diễn viên','공연:buổi biểu diễn','콘서트:hòa nhạc','팬:người hâm mộ','방송:chương trình phát sóng','자막:phụ đề','장면:cảnh phim','주인공:nhân vật chính','내용:nội dung','춤:điệu nhảy','연기:diễn xuất','유행:trào lưu','표를 사다:mua vé','감상하다:thưởng thức','추천하다:giới thiệu đề xuất'],
    daily_life: ['생활:đời sống','일상:sinh hoạt thường ngày','동네:khu phố','주민:cư dân','쓰레기:rác','분리수거:phân loại rác','관리비:phí quản lý','전기:điện','수도:nước máy','가스:ga','편의점:cửa hàng tiện lợi','세탁소:tiệm giặt','미용실:tiệm làm tóc','목욕탕:nhà tắm công cộng','공원:công viên','배달:giao hàng','민원:thủ tục phản ánh','외국인등록증:thẻ người nước ngoài','적응하다:thích nghi','이웃:hàng xóm'],
    adverbs: ['아주:rất','너무:quá','정말:thật sự','조금:một chút','많이:nhiều','잘:tốt giỏi','못:không thể','빨리:nhanh','천천히:chậm rãi','항상:luôn luôn','자주:thường xuyên','가끔:thỉnh thoảng','거의:hầu như','벌써:đã rồi','아직:vẫn chưa','먼저:trước tiên','나중에:sau này','함께:cùng nhau','바로:ngay lập tức','특히:đặc biệt'],
    interview: ['면접:phỏng vấn','지원자:ứng viên','면접관:người phỏng vấn','자기소개:giới thiệu bản thân','이력서:sơ yếu lý lịch','경력:kinh nghiệm','장점:điểm mạnh','단점:điểm yếu','능력:năng lực','자격증:chứng chỉ','지원 동기:lý do ứng tuyển','희망 연봉:mức lương mong muốn','질문:câu hỏi','답변:câu trả lời','긴장하다:căng thẳng','준비하다:chuẩn bị','채용:tuyển dụng','합격하다:trúng tuyển','불합격하다:không trúng tuyển','근무 조건:điều kiện làm việc'],
    topik: ['사회:xã hội','문화:văn hóa','경제:kinh tế','환경:môi trường','교육:giáo dục','기술:công nghệ','정보:thông tin','연구:nghiên cứu','결과:kết quả','원인:nguyên nhân','문제점:vấn đề tồn tại','해결:giải quyết','변화:thay đổi','증가:tăng','감소:giảm','영향:ảnh hưởng','관계:quan hệ','경험:kinh nghiệm','의견:ý kiến','목적:mục đích']
  };

  const topicLabels = {
    hangul: 'Hangul cơ bản', greetings: 'Chào hỏi', numbers: 'Số', family: 'Gia đình', time: 'Thời gian', school: 'Trường học',
    study_abroad: 'Du học', food: 'Đồ ăn', restaurant: 'Nhà hàng', shopping: 'Mua sắm', transport: 'Giao thông', housing: 'Nhà ở',
    weather: 'Thời tiết', health: 'Sức khỏe', hospital: 'Bệnh viện', work: 'Công việc', office: 'Công sở', eps_factory: 'EPS / Nhà máy',
    safety: 'An toàn lao động', travel: 'Du lịch', banking: 'Ngân hàng', phone: 'Điện thoại', emotions: 'Cảm xúc', verbs: 'Động từ',
    adjectives: 'Tính từ', body: 'Cơ thể', post_office: 'Bưu điện', appointments: 'Hẹn gặp', entertainment: 'K-Drama / K-Pop',
    daily_life: 'Đời sống tại Hàn Quốc', adverbs: 'Trạng từ', interview: 'Phỏng vấn', topik: 'TOPIK'
  };

  const verbTopics = new Set(['verbs', 'work', 'office']);
  const adjectiveTopics = new Set(['adjectives', 'emotions', 'weather']);
  const beginnerTopics = new Set(['hangul', 'greetings', 'numbers', 'family', 'time', 'school', 'food', 'restaurant', 'shopping', 'transport', 'housing', 'weather', 'health']);
  const items = [];

  Object.entries(topicSources).forEach(([topic, entries], topicIndex) => {
    entries.forEach((entry, wordIndex) => {
      const separator = entry.indexOf(':');
      const korean = entry.slice(0, separator);
      const meaningVi = entry.slice(separator + 1);
      const level = beginnerTopics.has(topic) ? 'Beginner' : topic === 'topik' ? 'TOPIK II' : topic.startsWith('eps') || topic === 'safety' ? 'EPS' : 'TOPIK I';
      const partOfSpeech = topic === 'adverbs' ? 'adverb' : verbTopics.has(topic) || korean.endsWith('하다') || korean.includes(' ')
        ? 'verb'
        : adjectiveTopics.has(topic) || /다$/.test(korean) ? 'adjective' : 'noun';
      items.push({
        id: `v-${String(topicIndex + 1).padStart(2, '0')}-${String(wordIndex + 1).padStart(2, '0')}`,
        korean,
        meaningVi,
        level,
        topic,
        topicLabel: topicLabels[topic],
        partOfSpeech,
        exampleKo: `오늘의 표현은 “${korean}”입니다.`,
        exampleVi: `Biểu đạt hôm nay là “${meaningVi}”.`,
        audioText: korean,
        tags: [topic, level.toLowerCase().replace(/\s+/g, '-')]
      });
    });
  });

  global.KLEARN_VOCABULARY = Object.freeze(items);
})(window);
