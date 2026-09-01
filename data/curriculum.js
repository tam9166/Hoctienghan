/* Curriculum layer: courses are derived from the existing theory lesson bank. */
(() => {
  'use strict';
  const app = window.KLEARN_APP;
  if (!app) return;
  const { state, getUserProgress, MasteryService } = app;
  const lessons = () => Array.isArray(window.KLEARN_THEORY_LESSONS) ? window.KLEARN_THEORY_LESSONS : [];
  const definitions = [
    { id: 'foundation', title: 'Nền tảng tiếng Hàn', level: 'Foundation', description: 'Hangul, phát âm và cấu trúc câu cơ bản.', predicate: (lesson) => lesson.topikLevel === 1 && lesson.lessonNumber <= 3, prerequisites: [] },
    { id: 'beginner', title: 'Tiếng Hàn sơ cấp', level: 'Beginner', description: 'Xây nền TOPIK I với các chủ đề giao tiếp quen thuộc.', predicate: (lesson) => [1, 2].includes(lesson.topikLevel), prerequisites: ['foundation'] },
    { id: 'intermediate', title: 'Tiếng Hàn trung cấp', level: 'Intermediate', description: 'Đọc hiểu, liên kết câu và diễn đạt ý kiến ở TOPIK II.', predicate: (lesson) => [3, 4].includes(lesson.topikLevel), prerequisites: ['beginner'] },
    { id: 'advanced', title: 'Tiếng Hàn nâng cao', level: 'Advanced', description: 'Ngôn ngữ học thuật, lập luận và văn bản chuyên sâu.', predicate: (lesson) => [5, 6].includes(lesson.topikLevel), prerequisites: ['intermediate'] },
    { id: 'exam-preparation', title: 'Chuẩn bị thi TOPIK', level: 'Exam preparation', description: 'Chiến thuật theo kỹ năng và mock exam có phân tích.', predicate: () => false, prerequisites: ['beginner'] }
  ];
  const progressFor = (course) => {
    const progress = getUserProgress(); const items = course.lessonIds.map((id) => progress.lessonProgress?.[id] || {});
    const completed = items.filter((item) => item.completed || item.masteryStatus === 'mastered').length;
    const active = items.filter((item) => item.updatedAt && !item.completed).length;
    return { completed, total: items.length, percent: items.length ? Math.round(completed / items.length * 100) : 0, status: !items.length ? 'not_started' : completed >= items.length ? 'completed' : completed || active ? 'in_progress' : 'not_started', nextLessonId: course.lessonIds.find((id) => !progress.lessonProgress?.[id]?.completed) || course.lessonIds[course.lessonIds.length - 1] || null };
  };
  const courses = () => definitions.map((definition) => { const courseLessons = lessons().filter(definition.predicate); const course = { ...definition, lessonIds: courseLessons.map((lesson) => lesson.id), estimatedMinutes: courseLessons.reduce((sum, lesson) => sum + Number(lesson.estimatedMinutes || 10), 0) }; return { ...course, progress: progressFor(course) }; });
  const service = {
    all: courses,
    get(id) { return courses().find((course) => course.id === id) || null; },
    progress(id) { return this.get(id)?.progress || { completed: 0, total: 0, percent: 0, status: 'not_started', nextLessonId: null }; },
    lesson(id) { return lessons().find((lesson) => lesson.id === id) || null; },
    mastery(id) { const lesson = this.lesson(id); return lesson ? MasteryService.lesson(getUserProgress().lessonProgress?.[id] || {}) : { score: 0, status: 'not_started' }; }
  };
  window.CurriculumService = service;
  window.KLEARN_CURRICULUM = definitions;
  app.render();
})();
