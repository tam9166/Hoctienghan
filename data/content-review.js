(function (global) {
  const reviews = [
    { contentId: 'grammar-topic-particles', contentType: 'resource', status: 'reviewed', authorId: 'content-team', reviewerId: null, reviewedAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z', version: 1, reviewNotes: 'Biên soạn nội bộ; chưa gắn tài khoản reviewer.' },
    { contentId: 'vocab-daily-life', contentType: 'resource', status: 'reviewed', authorId: 'content-team', reviewerId: null, reviewedAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z', version: 1, reviewNotes: 'Biên soạn nội bộ; chưa gắn tài khoản reviewer.' },
    { contentId: 'audio-shadowing-starter', contentType: 'resource', status: 'published', authorId: 'content-team', reviewerId: null, reviewedAt: null, updatedAt: '2026-09-01T00:00:00.000Z', version: 1, reviewNotes: 'Audio dùng browser TTS, không phải bản thu người thật.' },
    { contentId: 'video-topic-particles', contentType: 'video lesson', status: 'draft', authorId: 'content-team', reviewerId: null, reviewedAt: null, updatedAt: '2026-09-01T00:00:00.000Z', version: 1, reviewNotes: 'Chưa có video URL được cấp quyền.' },
    { contentId: 'video-listening-routine', contentType: 'video lesson', status: 'draft', authorId: 'content-team', reviewerId: null, reviewedAt: null, updatedAt: '2026-09-01T00:00:00.000Z', version: 1, reviewNotes: 'Chưa có video URL được cấp quyền.' },
    { contentId: 'topic-particle', contentType: 'lesson', status: 'in_review', authorId: 'content-team', reviewerId: null, reviewedAt: null, updatedAt: '2026-09-01T00:00:00.000Z', version: 2, reviewNotes: 'Chờ reviewer kiểm tra ví dụ và bản dịch.' },
    { contentId: 'strategy-listening-detail', contentType: 'TOPIK strategy', status: 'needs_revision', authorId: 'content-team', reviewerId: null, reviewedAt: null, updatedAt: '2026-09-01T00:00:00.000Z', version: 1, reviewNotes: 'Cần bổ sung nguồn tham khảo trước khi xuất bản.' },
    { contentId: 'question-bank-practice', contentType: 'question set', status: 'published', authorId: 'content-team', reviewerId: null, reviewedAt: null, updatedAt: '2026-09-01T00:00:00.000Z', version: 1, reviewNotes: 'Practice content; không phải đề thi thật.' }
  ];
  global.KLEARN_CONTENT_REVIEWS = Object.freeze(reviews);
})(window);
