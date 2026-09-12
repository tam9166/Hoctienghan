(function (global) {
  'use strict';

  const courseTemplates = [
    {
      id: 'business-korean', title: 'Business Korean', track: 'business', difficulty: 'TOPIK 2',
      description: 'Giao tiếp công sở, tin nhắn công việc và cuộc họp cơ bản.',
      modules: [
        { title: 'Chào hỏi nơi làm việc', items: ['lesson:office-greetings', 'vocabulary:office-core'] },
        { title: 'Tin nhắn và lịch hẹn', items: ['grammar:request-polite', 'lesson:meeting-schedule'] },
        { title: 'Cuộc họp cơ bản', items: ['audio:meeting-short', 'test:business-checkpoint'] }
      ]
    },
    {
      id: 'travel-korean', title: 'Travel Korean', track: 'travel', difficulty: 'TOPIK 1',
      description: 'Tiếng Hàn thực tế cho sân bay, di chuyển, nhà hàng và mua sắm.',
      modules: [
        { title: 'Đến Hàn Quốc', items: ['lesson:airport-arrival', 'vocabulary:transport'] },
        { title: 'Ăn uống và mua sắm', items: ['lesson:restaurant-order', 'grammar:please-give-me'] },
        { title: 'Xử lý tình huống', items: ['audio:travel-help', 'test:travel-checkpoint'] }
      ]
    },
    {
      id: 'topik-course', title: 'TOPIK', track: 'topik', difficulty: 'TOPIK 1',
      description: 'Lộ trình nghe, đọc, từ vựng và chiến thuật theo mục tiêu TOPIK.',
      modules: [
        { title: 'Nền tảng đề thi', items: ['lesson:topik-format', 'vocabulary:topik-core'] },
        { title: 'Nghe và đọc', items: ['audio:topik-listening', 'lesson:topik-reading'] },
        { title: 'Đánh giá', items: ['test:topik-mock'] }
      ]
    }
  ];

  const capabilities = Object.freeze({
    student: ['view_own_learning', 'view_own_assignments', 'view_own_feedback'],
    teacher: ['view_own_learning', 'view_own_assignments', 'view_own_feedback', 'view_teacher_dashboard', 'manage_class', 'assign_content', 'review_submission', 'build_course', 'create_organization'],
    reviewer: ['view_own_learning', 'view_own_assignments', 'view_own_feedback', 'review_content'],
    content_editor: ['view_own_learning', 'view_own_assignments', 'view_own_feedback', 'review_content', 'manage_content'],
    content_creator: ['view_own_learning', 'view_own_assignments', 'view_own_feedback', 'build_course', 'manage_content'],
    center_admin: ['view_own_learning', 'view_own_assignments', 'view_own_feedback', 'view_teacher_dashboard', 'manage_class', 'assign_content', 'review_submission', 'build_course', 'create_organization', 'manage_organization'],
    admin: ['view_own_learning', 'view_own_assignments', 'view_own_feedback', 'view_teacher_dashboard', 'manage_class', 'assign_content', 'review_submission', 'build_course', 'create_organization', 'manage_organization', 'manage_content', 'review_content'],
    super_admin: ['view_own_learning', 'view_own_assignments', 'view_own_feedback', 'view_teacher_dashboard', 'manage_class', 'assign_content', 'review_submission', 'build_course', 'create_organization', 'manage_organization', 'manage_content', 'review_content']
  });

  global.KLEARN_EDUCATION_PLATFORM_DATA = Object.freeze({
    courseTemplates,
    capabilities,
    organizationTypes: Object.freeze(['school', 'center']),
    assignmentTypes: Object.freeze(['lesson', 'vocabulary', 'test']),
    feedbackTypes: Object.freeze(['writing', 'speaking']),
    contentTypes: Object.freeze(['lesson', 'grammar', 'vocabulary', 'audio', 'test']),
    difficulties: Object.freeze(['Level 0', 'TOPIK 1', 'TOPIK 2', 'TOPIK 3', 'TOPIK 4', 'TOPIK 5', 'TOPIK 6']),
    reviewStatuses: Object.freeze(['draft', 'in_review', 'approved', 'deprecated'])
  });
})(window);
