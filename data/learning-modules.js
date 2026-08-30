(function buildLearningModules(global) {
  'use strict';

  const practiceTypes = [
    ['ko_to_vi', 'Chọn nghĩa Hàn → Việt', 'vocabulary'], ['vi_to_ko', 'Chọn từ Việt → Hàn', 'vocabulary'], ['fill_blank', 'Điền từ vào chỗ trống', 'vocabulary'],
    ['synonym', 'Chọn từ đồng nghĩa', 'vocabulary'], ['antonym', 'Chọn từ trái nghĩa', 'vocabulary'], ['particle', 'Chọn trợ từ', 'grammar'],
    ['sentence_ending', 'Chọn đuôi câu', 'grammar'], ['grammar_structure', 'Chọn cấu trúc ngữ pháp', 'grammar'], ['correct_sentence', 'Chọn câu đúng ngữ pháp', 'grammar'],
    ['find_error', 'Tìm câu sai', 'grammar'], ['order_words', 'Sắp xếp từ thành câu', 'grammar'], ['order_paragraph', 'Sắp xếp câu thành đoạn', 'reading'],
    ['join_clauses', 'Nối hai vế câu', 'grammar'], ['equivalent_sentence', 'Chọn câu đồng nghĩa', 'reading'], ['situational_expression', 'Chọn cách diễn đạt phù hợp', 'grammar'],
    ['complete_dialogue', 'Hoàn thành hội thoại', 'reading'], ['appropriate_response', 'Chọn câu đáp lại phù hợp', 'listening'], ['read_sign', 'Đọc biển báo', 'reading'],
    ['read_notice', 'Đọc thông báo', 'reading'], ['read_ad', 'Đọc quảng cáo', 'reading'], ['read_email', 'Đọc email', 'reading'],
    ['short_passage', 'Đọc đoạn văn ngắn', 'reading'], ['long_passage', 'Đọc đoạn văn dài', 'reading'], ['main_idea', 'Chọn ý chính', 'reading'],
    ['true_false_info', 'Tìm thông tin đúng/sai', 'reading'], ['inference', 'Suy luận nội dung', 'reading'], ['insert_sentence', 'Chèn câu vào đoạn văn', 'reading'],
    ['listen_meaning', 'Nghe → chọn ý nghĩa', 'listening'], ['listen_response', 'Nghe → chọn câu trả lời', 'listening'], ['listen_dialogue', 'Nghe hội thoại → chọn nội dung', 'listening'],
    ['listen_long', 'Nghe đoạn dài → chọn ý chính', 'listening'], ['listening_dictation', 'Chính tả nghe', 'listening'], ['write_word', 'Viết từ theo nghĩa', 'writing'],
    ['guided_sentence', 'Viết câu theo từ gợi ý', 'writing'], ['rewrite_sentence', 'Viết lại câu', 'writing'], ['complete_sentence', 'Hoàn thành câu', 'writing'],
    ['short_writing', 'Viết đoạn ngắn', 'writing'], ['chart_writing', 'Mô tả biểu đồ TOPIK', 'writing'], ['read_aloud', 'Đọc thành tiếng', 'speaking'],
    ['pattern_speaking', 'Luyện nói theo mẫu', 'speaking'], ['open_answer', 'Trả lời câu hỏi mở', 'speaking'], ['roleplay', 'Roleplay', 'speaking'],
    ['shadowing', 'Shadowing', 'speaking'], ['quick_response', 'Phản xạ hội thoại', 'speaking'], ['mixed_exam', 'Đề tổng hợp', 'mixed']
  ].map(([id, label, skill], index) => Object.freeze({ id, number: index + 1, label, skill }));

  const speakingModes = [
    ['word', 'Phát âm từ', '학교', 'trường học'],
    ['sentence', 'Phát âm câu', '오늘 날씨가 정말 좋네요.', 'Hôm nay thời tiết thật đẹp.'],
    ['shadowing', 'Shadowing', '천천히 따라 말해 보세요.', 'Hãy thử nói theo thật chậm.'],
    ['paragraph', 'Đọc đoạn văn', '저는 아침마다 지하철을 타고 회사에 갑니다.', 'Mỗi sáng tôi đi tàu điện ngầm đến công ty.'],
    ['conversation', 'Hội thoại', '안녕하세요. 무엇을 도와드릴까요?', 'Xin chào, tôi có thể giúp gì cho bạn?'],
    ['question', 'Trả lời câu hỏi', '주말에 보통 무엇을 합니까?', 'Cuối tuần bạn thường làm gì?'],
    ['roleplay', 'Roleplay', '어서 오세요. 몇 분이세요?', 'Chào mừng quý khách. Có mấy người ạ?'],
    ['quick', 'Phản xạ nhanh', '지금 몇 시예요?', 'Bây giờ là mấy giờ?'],
    ['challenge', 'Speaking challenge', '한국에서 이루고 싶은 목표를 말해 보세요.', 'Hãy nói về mục tiêu bạn muốn đạt được tại Hàn Quốc.'],
    ['topik', 'Nói theo TOPIK level', '환경을 보호하기 위해 할 수 있는 일을 설명해 보세요.', 'Hãy giải thích việc có thể làm để bảo vệ môi trường.']
  ].map(([id, label, korean, vietnamese], index) => Object.freeze({ id, label, korean, vietnamese, topikLevel: Math.min(6, Math.floor(index / 2) + 1) }));

  const roleplays = [
    ['restaurant', 'Nhà hàng', '어서 오세요. 몇 분이세요?', ['두 명', '자리', '예약']],
    ['shopping', 'Mua sắm', '어떤 것을 찾으세요?', ['찾아요', '가격', '사이즈']],
    ['interview', 'Phỏng vấn', '지원 동기를 말씀해 주세요.', ['지원', '경험', '목표']],
    ['office', 'Công sở', '자료를 오늘까지 보낼 수 있어요?', ['자료', '보내다', '오늘']],
    ['hospital', 'Bệnh viện', '어디가 불편하세요?', ['아파요', '증상', '부터']],
    ['school', 'Trường học', '어떤 수업을 신청하고 싶어요?', ['수업', '신청', '한국어']],
    ['study', 'Du học', '왜 한국에서 공부하고 싶어요?', ['유학', '전공', '배우다']],
    ['job', 'Xin việc', '관련 경력이 있으세요?', ['경력', '일하다', '년']],
    ['factory', 'Nhà máy', '기계에 어떤 문제가 있어요?', ['고장', '멈추다', '보고']],
    ['directions', 'Hỏi đường', '어디까지 가세요?', ['역', '오른쪽', '길']],
    ['bank', 'Ngân hàng', '무슨 업무를 보러 오셨어요?', ['송금', '계좌', '신분증']],
    ['housing', 'Thuê nhà', '어떤 방을 찾으세요?', ['월세', '보증금', '방']]
  ].map(([id, title, appLine, keywords]) => Object.freeze({ id, title, appLine, keywords }));

  const writingModes = [
    ['word', 'Viết từ'], ['sentence', 'Viết câu'], ['complete', 'Hoàn thành câu'], ['rewrite', 'Viết lại câu'], ['arrange', 'Sắp xếp câu'],
    ['translate', 'Dịch Việt → Hàn'], ['keywords', 'Viết theo từ khóa'], ['paragraph', 'Viết đoạn văn'], ['diary', 'Viết nhật ký'], ['topik', 'TOPIK Writing']
  ].map(([id, label]) => Object.freeze({ id, label }));

  const writingPrompts = [
    ['w1-01',1,'word','Trường học','Viết từ tiếng Hàn có nghĩa “trường học”.',['학교'],['학교'],'학교','Ghi nhớ thứ tự âm tiết 학 + 교.'],
    ['w1-02',1,'sentence','Giới thiệu','Viết một câu giới thiệu tên của bạn.',['저는','입니다'],['저는','입니다'],'저는 민수입니다.','Dùng 저는 + tên + 입니다.'],
    ['w1-03',1,'complete','Sinh hoạt','Hoàn thành câu: 저는 매일 한국어를 ___.',['공부'],['공부'],'저는 매일 한국어를 공부합니다.','Chọn động từ 공부하다 và chia lịch sự.'],
    ['w2-01',2,'translate','Cuối tuần','Dịch: Cuối tuần tôi gặp bạn.',['주말','친구'],['주말','친구','만나다'],'주말에 친구를 만나요.','Chú ý 에 cho thời gian và 를 cho tân ngữ.'],
    ['w2-02',2,'keywords','Kế hoạch','Viết 2 câu dùng: 내일, 도서관, 공부하다.',['내일','도서관','공부'],['내일','도서관','공부'],'내일 도서관에 갈 거예요. 거기에서 한국어를 공부할 거예요.','Dùng -(으)ㄹ 거예요 cho kế hoạch.'],
    ['w2-03',2,'rewrite','Nguyên nhân','Nối hai câu bằng -아서/어서: 배가 아파요. 병원에 가요.',['아파서'],['아파서','병원'],'배가 아파서 병원에 가요.','Bỏ 요 ở vế đầu rồi gắn -아서/어서.'],
    ['w2-04',2,'arrange','Sắp xếp câu','Sắp xếp và viết thành câu đúng: 친구를 / 주말에 / 만나요 / 저는.',['저는','만나요'],['저는','주말에','친구를','만나요'],'저는 주말에 친구를 만나요.','Thứ tự cơ bản: chủ đề + thời gian + tân ngữ + động từ.'],
    ['w3-01',3,'paragraph','Du học','Viết 3–5 câu về lý do bạn muốn du học Hàn Quốc.',['유학','한국','공부'],['유학','한국','공부'],'저는 한국 문화를 좋아해서 한국에서 유학하고 싶습니다. 한국어를 더 깊이 공부하고 제 전공 지식도 넓히고 싶습니다.','Nêu lý do, mục tiêu và kế hoạch.'],
    ['w3-02',3,'diary','Nhật ký','Viết nhật ký ngắn về một ngày đáng nhớ.',['오늘','느낌'],['오늘','기분','친구'],'오늘 친구와 한강에 갔다. 날씨가 좋아서 기분이 정말 좋았다.','Giữ thì quá khứ nhất quán.'],
    ['w3-03',3,'topik','TOPIK hoàn thành câu','Hoàn thành ý: 건강을 지키기 위해서는 ___.',['위해서는'],['운동','식습관'],'건강을 지키기 위해서는 규칙적으로 운동하고 건강한 음식을 먹어야 한다.','Dùng cấu trúc nghĩa vụ -아/어야 한다.'],
    ['w4-01',4,'paragraph','Công nghệ','Viết 120–180 ký tự về lợi ích và hạn chế của học trực tuyến.',['장점','단점'],['온라인','장점','단점'],'온라인 학습은 시간과 장소의 제약이 적다는 장점이 있다. 반면에 학습자가 집중력을 유지하기 어렵다는 단점도 있다.','Chia đoạn thành ưu điểm, hạn chế và kết luận.'],
    ['w4-02',4,'topik','TOPIK nội dung ngắn','Viết thông báo ngắn về việc thay đổi thời gian họp.',['회의','변경'],['회의','시간','변경'],'내일 회의 시간이 오후 두 시에서 세 시로 변경되었습니다. 참석자들은 시간을 확인해 주시기 바랍니다.','Nêu thời gian cũ, mới và yêu cầu.'],
    ['w4-03',4,'rewrite','Sắc thái','Viết lại câu dùng -(으)ㄴ/는 반면에 để đối chiếu thành thị và nông thôn.',['반면에'],['도시','농촌'],'도시는 교통이 편리한 반면에 농촌은 자연환경이 쾌적하다.','Hai vế cần có nội dung đối chiếu rõ.'],
    ['w5-01',5,'topik','Mô tả biểu đồ','Số người dùng phương tiện công cộng tăng từ 40% lên 65% trong ba năm. Hãy mô tả xu hướng.',['증가','비율'],['증가','40%','65%'],'자료에 따르면 대중교통 이용자의 비율은 3년 동안 40%에서 65%로 증가했다. 이는 환경 의식의 확산과 관련이 있는 것으로 보인다.','Nêu số liệu, xu hướng và nguyên nhân có thể.'],
    ['w5-02',5,'paragraph','Môi trường','Viết đoạn lập luận về việc giảm đồ nhựa dùng một lần.',['환경','일회용품'],['환경','일회용품','감소'],'일회용품은 편리하지만 환경에 큰 부담을 준다. 따라서 개인의 실천과 함께 기업의 책임 있는 생산 방식이 필요하다.','Có luận điểm, lý do và giải pháp.'],
    ['w5-03',5,'topik','Bài luận','Viết 200–300 ký tự: Làm việc từ xa ảnh hưởng thế nào đến năng suất?',['생산성','재택근무'],['재택근무','생산성','소통'],'재택근무는 이동 시간을 줄여 생산성을 높일 수 있다. 그러나 협업과 소통이 부족해질 가능성도 있으므로 적절한 운영 기준이 필요하다.','Trình bày cả hai mặt trước kết luận.'],
    ['w6-01',6,'topik','Giáo dục','Phân tích vai trò của tư duy phản biện trong giáo dục hiện đại.',['비판적 사고','교육'],['교육','비판적','근거'],'현대 교육은 지식 전달을 넘어 정보를 비판적으로 검토하는 능력을 길러야 한다. 학습자는 다양한 근거를 비교함으로써 합리적인 판단을 내릴 수 있다.','Dùng khái niệm rõ và lập luận có căn cứ.'],
    ['w6-02',6,'topik','Xã hội','Viết bài phân tích ngắn về già hóa dân số và chính sách xã hội.',['고령화','정책'],['고령화','복지','정책'],'고령화는 노동 인구 감소와 복지 비용 증가를 동시에 초래한다. 지속 가능한 정책을 위해서는 세대 간 부담을 균형 있게 조정해야 한다.','Phân tích nguyên nhân, tác động và hướng giải quyết.'],
    ['w6-03',6,'topik','Học thuật','Viết kết luận cho bài nghiên cứu về tác động của công nghệ tới giao tiếp.',['연구','결과'],['연구','기술','소통'],'연구 결과는 기술이 소통의 범위를 넓히는 동시에 관계의 깊이를 약화시킬 수 있음을 보여 준다. 후속 연구에서는 세대별 차이를 검토할 필요가 있다.','Tóm tắt phát hiện và gợi ý nghiên cứu tiếp theo.']
  ].map(([id, level, type, topic, prompt, requirements, keywords, sampleAnswer, tipsVi]) => Object.freeze({ id, level, type, topic, prompt, requirements, keywords, sampleAnswer, tipsVi }));

  global.KLEARN_MODULE_DATA = Object.freeze({
    practiceTypes: Object.freeze(practiceTypes), speakingModes: Object.freeze(speakingModes), roleplays: Object.freeze(roleplays),
    writingModes: Object.freeze(writingModes), writingPrompts: Object.freeze(writingPrompts)
  });
})(window);
