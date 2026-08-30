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

  Object.assign(topicSources, {
    community: ['공동체:cộng đồng','주민:cư dân','복지:phúc lợi','봉사:tình nguyện','갈등:xung đột','협력:hợp tác','소속감:cảm giác thuộc về','다문화:đa văn hóa','세대:thế hệ','계층:tầng lớp','지역:địa phương','참여:sự tham gia','기부:quyên góp','배려:sự quan tâm','연대:tinh thần đoàn kết','고립:sự cô lập','불평등:bất bình đẳng','공익:lợi ích công','시민:công dân','자치:tự quản'],
    environment_advanced: ['기후:khí hậu','온실가스:khí nhà kính','탄소중립:trung hòa carbon','재생에너지:năng lượng tái tạo','생태계:hệ sinh thái','생물다양성:đa dạng sinh học','오염:ô nhiễm','미세먼지:bụi mịn','폐기물:chất thải','재활용:tái chế','자원:tài nguyên','가뭄:hạn hán','홍수:lũ lụt','해수면:mực nước biển','멸종:tuyệt chủng','보존:bảo tồn','친환경:thân thiện môi trường','지속가능성:tính bền vững','배출량:lượng phát thải','환경정책:chính sách môi trường'],
    economy_advanced: ['경기:tình hình kinh tế','물가:giá cả','인플레이션:lạm phát','금리:lãi suất','투자:đầu tư','소비:tiêu dùng','수요:nhu cầu','공급:nguồn cung','수출:xuất khẩu','수입:nhập khẩu','무역:thương mại','환율:tỷ giá','성장률:tốc độ tăng trưởng','실업률:tỷ lệ thất nghiệp','소득:thu nhập','세금:thuế','재정:tài chính công','예산:ngân sách','부채:nợ','경기침체:suy thoái kinh tế'],
    technology_advanced: ['인공지능:trí tuệ nhân tạo','알고리즘:thuật toán','데이터:dữ liệu','자동화:tự động hóa','로봇:robot','플랫폼:nền tảng','보안:bảo mật','개인정보:thông tin cá nhân','가상현실:thực tế ảo','반도체:chất bán dẫn','통신:viễn thông','혁신:đổi mới','디지털화:số hóa','접근성:khả năng tiếp cận','정보격차:khoảng cách số','저작권:bản quyền','개발자:nhà phát triển','사용자:người dùng','기술윤리:đạo đức công nghệ','상용화:thương mại hóa'],
    education_advanced: ['교육과정:chương trình giáo dục','평가:đánh giá','입시:thi tuyển sinh','학습자:người học','교수법:phương pháp giảng dạy','문해력:năng lực đọc hiểu','창의성:tính sáng tạo','비판적사고:tư duy phản biện','평생교육:giáo dục suốt đời','의무교육:giáo dục bắt buộc','사교육:giáo dục tư','공교육:giáo dục công','학업성취:thành tích học tập','교육격차:khoảng cách giáo dục','진로:định hướng nghề nghiệp','장학제도:chế độ học bổng','토론:thảo luận','교재:giáo trình','학습동기:động lực học tập','교육철학:triết lý giáo dục'],
    society_advanced: ['고령화:già hóa','저출산:tỷ lệ sinh thấp','도시화:đô thị hóa','인구:nhân khẩu','이주:di cư','노동시장:thị trường lao động','복지제도:hệ thống phúc lợi','양극화:phân cực xã hội','주거문제:vấn đề nhà ở','범죄:tội phạm','안전망:mạng lưới an sinh','가구:hộ gia đình','세대갈등:xung đột thế hệ','성평등:bình đẳng giới','사회통합:hòa nhập xã hội','인권:nhân quyền','편견:định kiến','차별:phân biệt đối xử','사회적책임:trách nhiệm xã hội','삶의질:chất lượng cuộc sống'],
    culture_advanced: ['전통:truyền thống','유산:di sản','정체성:bản sắc','관습:phong tục','의례:nghi lễ','대중문화:văn hóa đại chúng','문화재:di sản văn hóa','보존하다:bảo tồn','계승하다:kế thừa','창작:sáng tác','예술성:tính nghệ thuật','다양성:tính đa dạng','세계화:toàn cầu hóa','지역문화:văn hóa địa phương','문화교류:giao lưu văn hóa','가치관:hệ giá trị','상징:biểu tượng','해석:diễn giải','미학:mỹ học','문화산업:công nghiệp văn hóa'],
    media: ['언론:truyền thông báo chí','보도:đưa tin','기사:bài báo','취재:tác nghiệp','편집:biên tập','여론:dư luận','사실확인:xác minh sự thật','가짜뉴스:tin giả','매체:phương tiện truyền thông','방송사:đài truyền hình','독자:độc giả','시청자:khán giả','광고:quảng cáo','논평:bình luận','보도자료:thông cáo báo chí','언론자유:tự do báo chí','공정성:tính công bằng','신뢰도:độ tin cậy','확산:sự lan truyền','구독:đăng ký theo dõi'],
    law: ['법률:pháp luật','제도:chế độ','권리:quyền lợi','의무:nghĩa vụ','규정:quy định','위반:vi phạm','처벌:xử phạt','재판:xét xử','판결:phán quyết','증거:bằng chứng','변호사:luật sư','검사:công tố viên','법원:tòa án','소송:tố tụng','계약법:luật hợp đồng','보호하다:bảo vệ','합법적:hợp pháp','불법:bất hợp pháp','책임:trách nhiệm','법치주의:pháp quyền'],
    public_policy: ['정책:chính sách','행정:hành chính','정부:chính phủ','지방정부:chính quyền địa phương','공공기관:cơ quan công','규제:quản lý quy định','개혁:cải cách','시행:thực thi','지원책:biện pháp hỗ trợ','정책효과:hiệu quả chính sách','이해관계:lợi ích liên quan','합의:đồng thuận','공청회:điều trần công khai','투명성:tính minh bạch','책무성:trách nhiệm giải trình','의사결정:ra quyết định','우선순위:thứ tự ưu tiên','복지정책:chính sách phúc lợi','산업정책:chính sách công nghiệp','공공서비스:dịch vụ công'],
    research: ['가설:giả thuyết','이론:lý thuyết','방법론:phương pháp luận','분석:phân tích','자료수집:thu thập dữ liệu','표본:mẫu nghiên cứu','변수:biến số','상관관계:tương quan','인과관계:quan hệ nhân quả','검증:kiểm chứng','관찰:quan sát','실험:thí nghiệm','설문조사:khảo sát','통계:thống kê','결론:kết luận','한계:hạn chế','선행연구:nghiên cứu trước','학술지:tạp chí học thuật','논문:luận văn bài báo','연구윤리:đạo đức nghiên cứu'],
    business_advanced: ['경영:quản trị','전략:chiến lược','마케팅:marketing','브랜드:thương hiệu','고객가치:giá trị khách hàng','시장점유율:thị phần','경쟁력:năng lực cạnh tranh','수익:lợi nhuận','비용:chi phí','매출:doanh thu','조직문화:văn hóa tổ chức','인사관리:quản trị nhân sự','성과:hiệu suất','협상:đàm phán','창업:khởi nghiệp','기업가:tinh thần doanh nhân','공급망:chuỗi cung ứng','품질관리:quản lý chất lượng','지배구조:cơ cấu quản trị','사회공헌:đóng góp xã hội'],
    psychology: ['심리:tâm lý','인지:nhận thức','감정:cảm xúc','동기:động lực','행동:hành vi','기억:trí nhớ','주의력:sự chú ý','스트레스:căng thẳng','자존감:lòng tự trọng','공감:sự đồng cảm','성격:tính cách','습관:thói quen','편향:thiên kiến','의사소통:giao tiếp','대인관계:quan hệ cá nhân','회복탄력성:khả năng phục hồi','불안:lo âu','만족감:cảm giác hài lòng','욕구:nhu cầu','자기효능감:niềm tin năng lực bản thân'],
    linguistics: ['언어학:ngôn ngữ học','음운:âm vị','형태소:hình vị','통사론:cú pháp học','의미론:ngữ nghĩa học','화용론:ngữ dụng học','방언:phương ngữ','억양:ngữ điệu','어휘력:vốn từ','문맥:ngữ cảnh','담화:diễn ngôn','언어습득:tiếp thu ngôn ngữ','모국어:tiếng mẹ đẻ','외래어:từ ngoại lai','번역:biên dịch','통역:phiên dịch','언어변화:biến đổi ngôn ngữ','표준어:ngôn ngữ chuẩn','존댓말:kính ngữ','뉘앙스:sắc thái'],
    idioms: ['손이 크다:hào phóng','눈이 높다:kén chọn','귀가 얇다:dễ nghe theo','입이 무겁다:kín miệng','발이 넓다:quan hệ rộng','마음이 놓이다:yên lòng','고개를 끄덕이다:gật đầu đồng ý','한숨을 쉬다:thở dài','눈길을 끌다:thu hút chú ý','발 벗고 나서다:tích cực đứng ra','손에 익다:quen tay','입을 모으다:đồng thanh','귀를 기울이다:lắng nghe','마음을 먹다:quyết tâm','기를 쓰다:cố hết sức','선을 넘다:vượt giới hạn','빛을 보다:gặt hái kết quả','뿌리를 내리다:bén rễ','고비를 넘기다:vượt qua thời điểm khó','머리를 맞대다:cùng bàn bạc'],
    literature: ['문학:văn học','소설:tiểu thuyết','시:thơ','수필:tản văn','작가:tác giả','화자:người kể','서술:tự sự','인물:nhân vật','배경:bối cảnh','갈등:mâu thuẫn','주제:chủ đề','상징성:tính biểu tượng','비유:ẩn dụ so sánh','운율:nhịp điệu','문체:văn phong','독창성:tính độc đáo','감상:thưởng thức cảm nhận','비평:phê bình','서사:cốt truyện tự sự','고전:tác phẩm kinh điển'],
    science: ['과학:khoa học','물질:vật chất','에너지:năng lượng','중력:trọng lực','유전자:gene','세포:tế bào','진화:tiến hóa','우주:vũ trụ','행성:hành tinh','기후변화:biến đổi khí hậu','관측:quan trắc','측정:đo lường','현상:hiện tượng','원리:nguyên lý','증명:chứng minh','발견:phát hiện','생명체:sinh vật','화학반응:phản ứng hóa học','물리학:vật lý học','과학기술:khoa học công nghệ']
  });

  const topicLabels = {
    hangul: 'Hangul cơ bản', greetings: 'Chào hỏi', numbers: 'Số', family: 'Gia đình', time: 'Thời gian', school: 'Trường học',
    study_abroad: 'Du học', food: 'Đồ ăn', restaurant: 'Nhà hàng', shopping: 'Mua sắm', transport: 'Giao thông', housing: 'Nhà ở',
    weather: 'Thời tiết', health: 'Sức khỏe', hospital: 'Bệnh viện', work: 'Công việc', office: 'Công sở', eps_factory: 'EPS / Nhà máy',
    safety: 'An toàn lao động', travel: 'Du lịch', banking: 'Ngân hàng', phone: 'Điện thoại', emotions: 'Cảm xúc', verbs: 'Động từ',
    adjectives: 'Tính từ', body: 'Cơ thể', post_office: 'Bưu điện', appointments: 'Hẹn gặp', entertainment: 'K-Drama / K-Pop',
    daily_life: 'Đời sống tại Hàn Quốc', adverbs: 'Trạng từ', interview: 'Phỏng vấn', topik: 'TOPIK', community: 'Cộng đồng',
    environment_advanced: 'Môi trường nâng cao', economy_advanced: 'Kinh tế', technology_advanced: 'Công nghệ', education_advanced: 'Giáo dục',
    society_advanced: 'Xã hội', culture_advanced: 'Văn hóa', media: 'Truyền thông', law: 'Pháp luật', public_policy: 'Chính sách công',
    research: 'Nghiên cứu', business_advanced: 'Kinh doanh', psychology: 'Tâm lý học', linguistics: 'Ngôn ngữ học', idioms: 'Thành ngữ', literature: 'Văn học', science: 'Khoa học'
  };

  const verbTopics = new Set(['verbs', 'work', 'office']);
  const adjectiveTopics = new Set(['adjectives', 'emotions', 'weather']);
  const beginnerTopics = new Set(['hangul', 'greetings', 'numbers', 'family', 'time', 'school', 'food', 'restaurant', 'shopping', 'transport', 'housing', 'weather', 'health']);
  const topik2Topics = new Set(['study_abroad', 'hospital', 'work', 'office', 'eps_factory', 'safety', 'travel', 'banking', 'phone', 'emotions']);
  const topik4Topics = new Set(['community', 'environment_advanced', 'economy_advanced', 'technology_advanced', 'education_advanced', 'society_advanced']);
  const topik5Topics = new Set(['culture_advanced', 'media', 'law', 'public_policy', 'research', 'business_advanced']);
  const synonymMap = { 행복하다: ['기쁘다'], 기쁘다: ['행복하다'], 증가: ['늘어남'], 감소: ['줄어듦'], 중요하다: ['중대하다'], 협력: ['협동'], 해결: ['해소'], 의견: ['견해'] };
  const antonymMap = { 좋다: ['나쁘다'], 크다: ['작다'], 많다: ['적다'], 빠르다: ['느리다'], 쉽다: ['어렵다'], 증가: ['감소'], 수출: ['수입'], 합법적: ['불법'] };
  const items = [];

  Object.entries(topicSources).forEach(([topic, entries], topicIndex) => {
    entries.forEach((entry, wordIndex) => {
      const separator = entry.indexOf(':');
      const korean = entry.slice(0, separator);
      const meaningVi = entry.slice(separator + 1);
      const topikLevel = beginnerTopics.has(topic) ? 1 : topik2Topics.has(topic) ? 2 : topik4Topics.has(topic) ? 4 : topik5Topics.has(topic) ? 5 : topic in topicLabels && ['culture_advanced','media','law','public_policy','research','business_advanced','psychology','linguistics','idioms','literature','science'].includes(topic) ? 6 : 3;
      const level = topic.startsWith('eps') || topic === 'safety' ? 'EPS' : topikLevel <= 2 ? 'TOPIK I' : 'TOPIK II';
      const partOfSpeech = topic === 'adverbs' ? 'adverb' : verbTopics.has(topic) || korean.endsWith('하다') || korean.includes(' ')
        ? 'verb'
        : adjectiveTopics.has(topic) || /다$/.test(korean) ? 'adjective' : 'noun';
      items.push({
        id: `v-${String(topicIndex + 1).padStart(2, '0')}-${String(wordIndex + 1).padStart(2, '0')}`,
        korean,
        meaningVi,
        level,
        topikLevel,
        topic,
        topicLabel: topicLabels[topic],
        partOfSpeech,
        exampleKo: `오늘의 표현은 “${korean}”입니다.`,
        exampleVi: `Biểu đạt hôm nay là “${meaningVi}”.`,
        audioText: korean,
        synonyms: synonymMap[korean] || [],
        antonyms: antonymMap[korean] || [],
        difficulty: topikLevel <= 2 ? 1 : topikLevel <= 4 ? 2 : 3,
        tags: [topic, `topik-${topikLevel}`, level.toLowerCase().replace(/\s+/g, '-')]
      });
    });
  });

  global.KLEARN_VOCABULARY = Object.freeze(items);
})(window);
