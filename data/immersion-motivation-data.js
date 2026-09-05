/* Tiếng Hàn - TamHoanq — verified, copyright-safe immersion content */
(function exposeImmersionMotivationData(global) {
  'use strict';
  global.KLEARN_IMMERSION_DATA = Object.freeze({
    survivalLessons: Object.freeze([
      { id: 'survival-airport', icon: '✈', place: 'Sân bay', level: 'Beginner', context: 'Làm thủ tục và tìm cổng lên máy bay.', phrases: [
        { korean: '체크인은 어디에서 해요?', meaning: 'Tôi làm thủ tục ở đâu?', usage: 'Hỏi nhân viên tại sảnh đi.', prompt: 'Bạn muốn hỏi nơi làm thủ tục.', accepted: ['체크인은 어디에서 해요', '체크인 어디에서 해요'] },
        { korean: '탑승구가 어디예요?', meaning: 'Cổng lên máy bay ở đâu?', usage: 'Dùng sau khi đã có thẻ lên máy bay.', prompt: 'Bạn muốn tìm cổng lên máy bay.', accepted: ['탑승구가 어디예요', '탑승구 어디예요'] },
        { korean: '짐을 부치고 싶어요.', meaning: 'Tôi muốn ký gửi hành lý.', usage: 'Nói tại quầy check-in.', prompt: 'Bạn muốn ký gửi hành lý.', accepted: ['짐을 부치고 싶어요'] }
      ] },
      { id: 'survival-restaurant', icon: '匙', place: 'Nhà hàng', level: 'Beginner', context: 'Gọi món, hỏi món và thanh toán.', phrases: [
        { korean: '이거 하나 주세요.', meaning: 'Cho tôi một phần này.', usage: 'Chỉ vào món trong menu khi gọi.', prompt: 'Bạn muốn gọi một phần món này.', accepted: ['이거 하나 주세요'] },
        { korean: '안 매운 음식이 있어요?', meaning: 'Có món nào không cay không?', usage: 'Hỏi trước khi gọi món.', prompt: 'Bạn cần hỏi món không cay.', accepted: ['안 매운 음식이 있어요', '맵지 않은 음식이 있어요'] },
        { korean: '계산해 주세요.', meaning: 'Làm ơn tính tiền.', usage: 'Nói với nhân viên sau bữa ăn.', prompt: 'Bạn muốn thanh toán.', accepted: ['계산해 주세요', '계산 부탁드립니다'] }
      ] },
      { id: 'survival-hospital', icon: '＋', place: 'Bệnh viện', level: 'TOPIK 1', context: 'Mô tả triệu chứng cơ bản và hỏi nơi tiếp nhận.', phrases: [
        { korean: '머리가 아파요.', meaning: 'Tôi bị đau đầu.', usage: 'Mô tả triệu chứng với nhân viên y tế.', prompt: 'Bạn cần nói mình đau đầu.', accepted: ['머리가 아파요'] },
        { korean: '어디로 가야 해요?', meaning: 'Tôi phải đi đâu?', usage: 'Hỏi quầy hướng dẫn.', prompt: 'Bạn không biết phải đến khoa nào.', accepted: ['어디로 가야 해요'] },
        { korean: '약을 언제 먹어요?', meaning: 'Tôi uống thuốc khi nào?', usage: 'Hỏi cách dùng thuốc.', prompt: 'Bạn muốn biết thời điểm uống thuốc.', accepted: ['약을 언제 먹어요', '약은 언제 먹어요'] }
      ] },
      { id: 'survival-bank', icon: '₩', place: 'Ngân hàng', level: 'TOPIK 1', context: 'Mở tài khoản và thực hiện giao dịch đơn giản.', phrases: [
        { korean: '계좌를 만들고 싶어요.', meaning: 'Tôi muốn mở tài khoản.', usage: 'Nói tại quầy tiếp nhận.', prompt: 'Bạn muốn mở tài khoản ngân hàng.', accepted: ['계좌를 만들고 싶어요'] },
        { korean: '송금하고 싶어요.', meaning: 'Tôi muốn chuyển tiền.', usage: 'Yêu cầu giao dịch chuyển khoản.', prompt: 'Bạn muốn chuyển tiền.', accepted: ['송금하고 싶어요'] },
        { korean: '수수료가 얼마예요?', meaning: 'Phí dịch vụ là bao nhiêu?', usage: 'Hỏi trước khi xác nhận giao dịch.', prompt: 'Bạn muốn hỏi phí.', accepted: ['수수료가 얼마예요'] }
      ] },
      { id: 'survival-housing', icon: '⌂', place: 'Thuê nhà', level: 'TOPIK 2', context: 'Xem phòng, hỏi tiền thuê và điều kiện hợp đồng.', phrases: [
        { korean: '방을 보러 왔어요.', meaning: 'Tôi đến để xem phòng.', usage: 'Nói khi gặp chủ nhà hoặc môi giới.', prompt: 'Bạn đến xem phòng.', accepted: ['방을 보러 왔어요'] },
        { korean: '월세가 얼마예요?', meaning: 'Tiền thuê hàng tháng là bao nhiêu?', usage: 'Hỏi rõ chi phí mỗi tháng.', prompt: 'Bạn muốn hỏi tiền thuê tháng.', accepted: ['월세가 얼마예요'] },
        { korean: '관리비가 포함돼요?', meaning: 'Phí quản lý đã được bao gồm chưa?', usage: 'Xác nhận chi phí trước khi ký.', prompt: 'Bạn muốn hỏi phí quản lý có được tính trong giá.', accepted: ['관리비가 포함돼요', '관리비 포함이에요'] }
      ] }
    ]),
    mediaLessons: Object.freeze([
      { id: 'media-friends', category: 'Đời thường', title: 'Bạn bè hẹn gặp', sourceNote: 'Hội thoại giáo dục do TamHoanq biên soạn', dialogue: ['오늘 저녁에 시간 있어?', '응, 일곱 시쯤 만나자.', '좋아. 이따 봐!'], translation: ['Tối nay cậu có thời gian không?', 'Ừ, gặp nhau khoảng bảy giờ nhé.', 'Được. Gặp sau nhé!'], vocabulary: [['쯤', 'khoảng'], ['이따', 'lát nữa']], grammar: [['-자', 'Rủ hoặc đề nghị thân mật: “hãy/cùng…”']] },
      { id: 'media-office', category: 'Công sở', title: 'Xác nhận tài liệu', sourceNote: 'Hội thoại giáo dục do TamHoanq biên soạn', dialogue: ['자료 확인하셨어요?', '네, 방금 이메일로 보냈습니다.', '감사합니다. 확인해 볼게요.'], translation: ['Bạn đã kiểm tra tài liệu chưa?', 'Vâng, tôi vừa gửi qua email.', 'Cảm ơn. Tôi sẽ kiểm tra.'], vocabulary: [['자료', 'tài liệu'], ['방금', 'vừa mới']], grammar: [['-아/어 보다', 'Thử làm một hành động hoặc xem xét.']] },
      { id: 'media-travel', category: 'Du lịch', title: 'Chuyến tàu cuối', sourceNote: 'Hội thoại giáo dục do TamHoanq biên soạn', dialogue: ['막차가 몇 시예요?', '열한 시 반이에요.', '그럼 아직 시간이 있네요.'], translation: ['Chuyến cuối lúc mấy giờ?', 'Mười một giờ rưỡi.', 'Vậy thì vẫn còn thời gian.'], vocabulary: [['막차', 'chuyến xe/tàu cuối'], ['아직', 'vẫn, vẫn còn']], grammar: [['-네요', 'Thể hiện nhận ra hoặc cảm thán về thông tin mới.']] }
    ]),
    slang: Object.freeze([
      { id: 'slang-kkk', korean: 'ㅋㅋㅋ', meaning: 'Tiếng cười trong tin nhắn, gần với “haha”.', when: 'Tin nhắn hoặc bình luận thân mật với bạn bè.', intimacy: 'Rất thân mật', avoid: 'Email công việc, trao đổi trang trọng hoặc với người lớn tuổi chưa thân.', example: '진짜 웃겨 ㅋㅋㅋ' },
      { id: 'slang-daebak', korean: '대박', meaning: 'Tuyệt quá, đỉnh thật; đôi khi là “không thể tin được”.', when: 'Phản ứng trước điều bất ngờ hoặc rất ấn tượng.', intimacy: 'Thân mật', avoid: 'Báo cáo và văn bản chính thức.', example: '와, 이 노래 대박이다!' },
      { id: 'slang-heol', korean: '헐', meaning: 'Ôi / thật sao; phản ứng ngạc nhiên hoặc sửng sốt.', when: 'Hội thoại thân mật và chat.', intimacy: 'Rất thân mật', avoid: 'Khi cần thể hiện sự đồng cảm nghiêm túc hoặc trong công việc.', example: '헐, 벌써 끝났어?' },
      { id: 'slang-jmt', korean: '존맛', meaning: 'Cách nói lóng nhấn mạnh món ăn rất ngon.', when: 'Bạn bè thân hoặc bình luận mạng xã hội.', intimacy: 'Rất suồng sã', avoid: 'Người lạ, người lớn tuổi và mọi bối cảnh trang trọng.', example: '여기 떡볶이 진짜 존맛이야.' },
      { id: 'slang-tmi', korean: 'TMI', meaning: 'Thông tin quá chi tiết hoặc không cần thiết.', when: 'Nói đùa khi ai đó chia sẻ quá nhiều chi tiết.', intimacy: 'Thân mật', avoid: 'Phê bình trực diện khiến người khác mất mặt.', example: '그건 조금 TMI인데?' }
    ]),
    dailyFeed: Object.freeze([
      { phrase: ['천천히 말씀해 주세요.', 'Xin hãy nói chậm.'], culture: 'Ở Hàn Quốc, thêm 주세요 giúp yêu cầu nghe mềm và lịch sự hơn.', reading: ['아침에 지하철을 타고 회사에 가요.', 'Buổi sáng tôi đi tàu điện ngầm đến công ty.'] },
      { phrase: ['잘 먹겠습니다.', 'Tôi xin phép ăn ngon miệng.'], culture: 'Thường nói trước bữa ăn để thể hiện sự trân trọng người chuẩn bị món.', reading: ['오늘 점심은 김치찌개예요.', 'Bữa trưa hôm nay là canh kimchi.'] },
      { phrase: ['수고하셨습니다.', 'Bạn đã vất vả rồi.'], culture: 'Dùng sau khi cùng hoàn thành công việc; cần chú ý quan hệ vai vế.', reading: ['회의가 끝나서 모두 집에 갔어요.', 'Cuộc họp kết thúc nên mọi người đã về nhà.'] },
      { phrase: ['괜찮아요.', 'Không sao / tôi ổn.'], culture: 'Một câu rất linh hoạt: từ chối nhẹ, trấn an hoặc nói mình ổn.', reading: ['비가 오지만 산책을 했어요.', 'Trời mưa nhưng tôi đã đi dạo.'] },
      { phrase: ['어떻게 지내세요?', 'Dạo này bạn thế nào?'], culture: 'Lịch sự hơn 잘 지내?; phù hợp khi lâu ngày gặp lại người chưa quá thân.', reading: ['주말에 오랜 친구를 만났어요.', 'Cuối tuần tôi gặp một người bạn lâu năm.'] },
      { phrase: ['잠시만요.', 'Xin chờ một chút.'], culture: 'Dùng để xin thời gian hoặc nhẹ nhàng thu hút sự chú ý.', reading: ['지금 표를 확인하고 있어요.', 'Bây giờ tôi đang kiểm tra vé.'] },
      { phrase: ['다녀오겠습니다.', 'Tôi đi rồi sẽ về.'], culture: 'Người rời nhà hoặc nơi làm việc nói với người còn lại.', reading: ['가족에게 인사하고 학교에 갔어요.', 'Tôi chào gia đình rồi đi học.'] }
    ])
  });
})(window);
