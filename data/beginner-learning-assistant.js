/* Tiếng Hàn - TamHoanq · connected beginner learning assistant */
(function beginnerLearningAssistant(global) {
  'use strict';
  const app = global.KLEARN_APP;
  if (!app) return;

  const { state, STORAGE_KEYS, render, setView, toast, escapeHtml, getUserProgress, userScoped, VocabularyService, DictionaryService, PracticeService, speakKorean } = app;
  const runtime = state.beginnerAssistant || (state.beginnerAssistant = {
    reviewStatus: 'due', reviewTopic: 'all', reviewMode: 'choice', reviewCount: 10, session: null, result: null
  });
  const now = () => new Date();
  const dayKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const firstName = () => String(state.currentUser?.fullName || '').trim().split(/\s+/).filter(Boolean).pop() || 'bạn';
  const lessons = () => Array.isArray(global.KLEARN_THEORY_LESSONS) ? global.KLEARN_THEORY_LESSONS : [];
  const progress = () => getUserProgress?.() || {};
  const completed = (lessonId) => Boolean(progress().lessonProgress?.[lessonId]?.completed);
  const cardId = (card) => card?.wordId || card?.id || '';
  const dictionaryWord = (card) => DictionaryService?.byId?.(cardId(card)) || null;
  const cardKorean = (card) => card?.korean || dictionaryWord(card)?.korean || '';
  const cardMeaning = (card) => card?.meaningVi || card?.meanings?.vi || dictionaryWord(card)?.meaningVi || dictionaryWord(card)?.meanings?.vi || '';
  const cardExample = (card) => card?.exampleKo || dictionaryWord(card)?.examples?.[0]?.korean || '';
  const cardTopic = (card) => card?.topicLabel || card?.topic || 'Khác';
  const normalize = (value) => String(value || '').normalize('NFC').trim().toLocaleLowerCase('vi-VN').replace(/\s+/g, ' ');

  function openLesson(lessonId) {
    if (!lessonId) return setView('courses');
    state.selectedLessonPreview = lessonId;
    state.lessonStep = 0; state.lessonCheck = null; state.lessonMiniAnswers = {}; state.lessonMiniResult = null;
    state.selectedWords = []; state.sentenceCorrect = completed(lessonId);
    setView('lesson');
  }

  function foundationAction() {
    const value = global.BeginnerFoundation?.progress?.() || {};
    const learned = new Set(value.learnedCharacters || []); const activities = new Set(value.completedActivities || []);
    if (!learned.has('ㅏ')) return { route: 'hangul-academy', title: 'Học nguyên âm ㅏ', detail: 'Nghe, nhận diện và luyện viết chữ đầu tiên.', progress: Math.round(learned.size / 40 * 100) };
    if (!learned.has('ㄱ')) return { route: 'hangul-academy', title: 'Học phụ âm ㄱ', detail: 'Chuẩn bị ghép âm tiết 가.', progress: Math.round(learned.size / 40 * 100) };
    if (!activities.has('syllable-ga')) return { route: 'syllable-builder', title: 'Ghép âm tiết 가', detail: 'Tự ghép phụ âm và nguyên âm.', progress: Math.round(learned.size / 40 * 100) };
    if (!activities.has('reading-first')) return { route: 'reading-first', title: 'Đọc từ đầu tiên', detail: 'Đi từ ký tự đến âm tiết và nghĩa.', progress: Math.round(learned.size / 40 * 100) };
    if (!activities.has('first-sentence')) return { route: 'first-sentence', title: 'Tạo câu tiếng Hàn đầu tiên', detail: 'Sắp xếp và hiểu từng thành phần.', progress: Math.round(learned.size / 40 * 100) };
    return { route: 'beginner-checkpoint', title: 'Checkpoint nhập môn', detail: 'Kiểm tra nền tảng trước TOPIK 1.', progress: Math.round(learned.size / 40 * 100) };
  }

  function currentAction() {
    if (state.currentUser?.learningTrack === 'foundation') return foundationAction();
    const level = Number(state.currentUser?.currentTopikLevel || 1);
    const levelLessons = lessons().filter((lesson) => Number(lesson.topikLevel) === level);
    const recentId = Object.entries(progress().lessonProgress || {}).filter(([, value]) => value?.updatedAt && !value.completed).sort((a, b) => new Date(b[1].updatedAt) - new Date(a[1].updatedAt))[0]?.[0];
    const lesson = levelLessons.find((item) => item.id === recentId) || levelLessons.find((item) => !completed(item.id)) || levelLessons[0];
    const done = levelLessons.filter((item) => completed(item.id)).length;
    return { lessonId: lesson?.id || '', title: lesson?.title || `Lộ trình TOPIK ${level}`, detail: lesson?.topic || 'Bài học tiếp theo theo lộ trình.', progress: Math.round(done / Math.max(1, levelLessons.length) * 100) };
  }

  function allActivity() {
    const service = global.StudyCalendarService?.activityByDay?.();
    if (service) return service;
    const days = {};
    const ensure = (date) => { const value = new Date(date); if (!date || Number.isNaN(value.getTime())) return null; const key = dayKey(value); return days[key] ||= { date: key, minutes: 0, lessons: 0, reviews: 0, practices: 0, tests: 0 }; };
    PracticeService?.getHistory?.().forEach((attempt) => { const day = ensure(attempt.completedAt); if (!day) return; day.minutes += Math.max(1, Math.round(Number(attempt.durationSeconds || 0) / 60)); day.practices += 1; if (/topik|exam/i.test(`${attempt.setId || ''} ${attempt.source || ''}`)) day.tests += 1; });
    Object.values(progress().lessonProgress || {}).forEach((item) => { if (!item.completed) return; const day = ensure(item.completedAt || item.updatedAt); if (!day) return; day.lessons += 1; day.minutes += Math.max(5, Number(item.studyMinutes || 0)); });
    return days;
  }

  function recentAchievements() {
    const achievements = userScoped?.(STORAGE_KEYS.achievements) || [];
    const milestones = global.MilestoneService?.all?.() || [];
    return [...achievements.map((item) => ({ title: item.title, icon: item.icon || '✓', at: item.unlockedAt || item.createdAt })), ...milestones.map((item) => ({ title: typeof item.title === 'string' ? item.title : item.title?.vi, icon: '✓', at: item.reachedAt }))]
      .filter((item) => item.title).sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0)).slice(0, 3);
  }

  function progressSnapshot() {
    const value = progress(); const history = PracticeService?.getHistory?.() || []; const activity = allActivity();
    const courseLessons = [...new Set((global.CurriculumService?.all?.() || []).flatMap((course) => course.lessonIds || []))];
    const completedLessons = Object.values(value.lessonProgress || {}).filter((item) => item.completed).length;
    const learnedWords = (state.srsData || []).filter((card) => card.status !== 'not_started' || Number(card.reviewCount || 0) > 0).length;
    const average = history.length ? Math.round(history.reduce((sum, item) => sum + Number(item.percentage || 0), 0) / history.length) : 0;
    const totalMinutes = Object.values(activity).reduce((sum, item) => sum + Number(item.minutes || 0), 0);
    const coursePercent = Math.round(courseLessons.filter(completed).length / Math.max(1, courseLessons.length) * 100);
    const week = [];
    for (let offset = 6; offset >= 0; offset -= 1) { const date = now(); date.setDate(date.getDate() - offset); const key = dayKey(date); week.push({ key, date, ...(activity[key] || { minutes: 0, lessons: 0, reviews: 0, practices: 0, tests: 0 }) }); }
    return { completedLessons, learnedWords, tests: history.length, average, totalMinutes, streak: Number(value.stats?.streak || 0), coursePercent, week, achievements: recentAchievements() };
  }

  function homeView() {
    const current = currentAction(); const stats = progressSnapshot(); const due = VocabularyService?.dueCards?.().length || 0; const errors = (global.ErrorNotebookService?.top?.(100) || []).filter((item) => !item.resolved).length; const achievement = stats.achievements[0];
    return `<div class="bla-shell"><section class="bla-home-hero section"><div><p class="eyebrow">TRỢ LÝ HỌC TẬP HÔM NAY</p><h1>Chào ${escapeHtml(firstName())}</h1><p>Một bước rõ ràng, sau đó ôn đúng phần bạn đang yếu.</p></div><span>🔥 <b>${stats.streak}</b> ngày</span></section><section class="bla-current section"><div class="bla-current-copy"><small>${current.lessonId || current.route !== 'beginner-checkpoint' ? 'BÀI ĐANG HỌC' : 'BƯỚC TIẾP THEO'}</small><h2>${escapeHtml(current.title)}</h2><p>${escapeHtml(current.detail)}</p><div class="bla-progress-label"><span>Tiến độ chặng hiện tại</span><b>${current.progress}%</b></div><div class="bar large"><span style="width:${current.progress}%"></span></div></div><button class="btn primary" ${current.lessonId ? `data-bla-lesson="${escapeHtml(current.lessonId)}"` : `data-view="${escapeHtml(current.route)}"`}>${current.progress ? 'Tiếp tục học' : 'Bắt đầu học'}</button></section><section class="bla-quick-actions section"><button data-bla-five><span>5′</span><b>Học nhanh 5 phút</b><small>Một phiên ngắn từ dữ liệu hiện tại</small></button><button data-view="beginner-vocabulary-review"><span>${due}</span><b>Ôn từ đến hạn</b><small>${due ? `${due} từ cần ôn hôm nay` : 'Chọn từ yếu hoặc từ yêu thích'}</small></button><button data-view="learning-path"><span>→</span><b>Lộ trình của tôi</b><small>Xem bài đã học, đang học và bị khóa</small></button></section><section class="bla-dashboard-preview section"><header><div><p class="eyebrow">TIẾN ĐỘ THẬT</p><h2>Bạn đang tiến như thế nào?</h2></div><button class="text-link" data-view="learning-progress">Xem chi tiết →</button></header><div><article><strong>${stats.completedLessons}</strong><span>Bài hoàn thành</span></article><article><strong>${stats.learnedWords}</strong><span>Từ đã học</span></article><article><strong>${stats.average || '—'}${stats.average ? '%' : ''}</strong><span>Điểm trung bình</span></article><article><strong>${stats.totalMinutes}</strong><span>Phút học</span></article></div></section><section class="bla-home-lower section"><article><p class="eyebrow">GỢI Ý TIẾP THEO</p><h2>${errors ? `Sửa ${Math.min(errors, 3)} lỗi gần đây` : due ? `Ôn ${Math.min(due, 10)} từ đến hạn` : 'Bắt đầu một mini test'}</h2><p>${errors ? 'Mở Sổ lỗi để xem lại câu sai và giải thích.' : due ? 'Ôn đúng hạn giúp giữ trí nhớ ổn định.' : 'Tạo thêm dữ liệu để trợ lý cá nhân hóa tốt hơn.'}</p><button class="btn secondary" data-view="${errors ? 'error-notebook' : due ? 'beginner-vocabulary-review' : 'quick-practice'}">Mở ngay</button></article><article><p class="eyebrow">THÀNH TỰU GẦN ĐÂY</p>${achievement ? `<div class="bla-achievement"><span>${escapeHtml(achievement.icon)}</span><div><b>${escapeHtml(achievement.title)}</b><small>Được ghi nhận từ hoạt động học thật</small></div></div><button class="text-link" data-view="achievements">Xem tất cả →</button>` : '<h2>Chưa có thành tựu mới</h2><p>Hoàn thành bài hoặc duy trì nhịp học để mở cột mốc đầu tiên.</p>'}</article></section></div>`;
  }

  function learningPathView() {
    const foundation = global.BeginnerFoundation?.progress?.() || {}; const foundationDone = Math.min(100, Math.round((foundation.learnedCharacters?.length || 0) / 40 * 100));
    const currentLevel = Number(state.currentUser?.currentTopikLevel || 1);
    const levels = [1, 2, 3, 4, 5, 6].map((level) => { const items = lessons().filter((lesson) => Number(lesson.topikLevel) === level); const done = items.filter((lesson) => completed(lesson.id)).length; const percent = Math.round(done / Math.max(1, items.length) * 100); const status = done === items.length && items.length ? 'completed' : level === currentLevel ? 'current' : level < currentLevel || done ? 'available' : 'locked'; return { level, items, done, percent, status, next: items.find((item) => !completed(item.id)) }; });
    return `<div class="bla-shell"><section class="section page-heading"><button class="back-link" data-view="home">← Trang chủ</button><p class="eyebrow">LỘ TRÌNH CÁ NHÂN</p><h1 class="headline">Từ Hangul đến TOPIK</h1><p class="subtle">Mỗi chặng hiển thị đúng trạng thái từ tiến độ đã lưu.</p></section><section class="bla-path-summary section"><div><b>${progressSnapshot().coursePercent}%</b><span>tiến độ khóa học</span></div><div class="bar large"><span style="width:${progressSnapshot().coursePercent}%"></span></div></section><section class="bla-path section"><article class="${state.currentUser?.learningTrack === 'foundation' ? 'current' : foundationDone >= 80 ? 'completed' : 'available'}"><span>${foundationDone >= 80 ? '✓' : '한'}</span><div><small>NỀN TẢNG</small><h2>Hangul cho người mới</h2><p>Chữ cái · ghép âm · 받침 · từ đầu tiên</p><div class="bar"><i style="width:${foundationDone}%"></i></div><em>${foundationDone}%</em></div><button class="btn secondary" data-view="foundation">${foundationDone ? 'Tiếp tục' : 'Bắt đầu'}</button></article>${levels.map((item) => `<article class="${item.status}"><span>${item.status === 'completed' ? '✓' : item.status === 'locked' ? '○' : item.level}</span><div><small>${item.status === 'completed' ? 'ĐÃ HOÀN THÀNH' : item.status === 'current' ? 'ĐANG HỌC' : item.status === 'locked' ? 'CHƯA MỞ' : 'CÓ THỂ HỌC'}</small><h2>TOPIK ${item.level}</h2><p>${item.done}/${item.items.length} bài · ${item.percent}%</p><div class="bar"><i style="width:${item.percent}%"></i></div></div>${item.status === 'locked' ? '<button class="btn secondary" disabled>Hoàn thành chặng trước</button>' : `<button class="btn ${item.status === 'current' ? 'primary' : 'secondary'}" ${item.next ? `data-bla-lesson="${item.next.id}"` : 'data-view="courses"'}>${item.next ? 'Học tiếp' : 'Xem lại'}</button>`}</article>`).join('')}</section></div>`;
  }

  function courseDetailView() {
    const course = global.CurriculumService?.get?.(state.selectedCourseId) || global.CurriculumService?.all?.()[0];
    if (!course) return '<section class="empty-state"><h1>Chưa có khóa học</h1></section>';
    const items = course.lessonIds.map((id) => global.CurriculumService.lesson(id)).filter(Boolean); let currentIndex = items.findIndex((item) => !completed(item.id)); if (currentIndex < 0) currentIndex = items.length;
    return `<div class="bla-shell"><section class="section page-heading"><button class="back-link" data-view="learning-path">← Lộ trình</button><p class="eyebrow">${escapeHtml(course.level)}</p><h1 class="headline">${escapeHtml(course.title)}</h1><p class="subtle">${escapeHtml(course.description)}</p><div class="bla-progress-label"><span>${course.progress.completed}/${course.progress.total} bài</span><b>${course.progress.percent}%</b></div><div class="bar large"><span style="width:${course.progress.percent}%"></span></div></section><section class="bla-course-lessons section">${items.length ? items.map((lesson, index) => { const value = progress().lessonProgress?.[lesson.id] || {}; const status = value.completed ? 'completed' : index === currentIndex ? 'current' : index > currentIndex ? 'locked' : 'available'; return `<button class="${status}" ${status === 'locked' ? 'disabled' : `data-bla-lesson="${lesson.id}"`}><span>${status === 'completed' ? '✓' : status === 'locked' ? '○' : String(index + 1).padStart(2, '0')}</span><div><small>${status === 'completed' ? 'ĐÃ HỌC' : status === 'current' ? (value.updatedAt ? 'ĐANG HỌC' : 'BẮT ĐẦU TỪ ĐÂY') : 'CHƯA MỞ'}</small><b>${escapeHtml(lesson.title)}</b><em>${lesson.estimatedMinutes || 10} phút${value.miniTestScore != null ? ` · Mini test ${value.miniTestScore}%` : ''}${value.recommendedReview ? ' · Nên ôn lại' : ''}</em></div><i>${status === 'locked' ? 'Khóa' : '›'}</i></button>`; }).join('') : '<div class="empty-state"><p>Chặng này dùng kho chiến thuật và đề TOPIK.</p><button class="btn primary" data-view="topik">Mở TOPIK</button></div>'}</section>${items[currentIndex] ? `<section class="bla-course-next section"><div><small>TIẾP TỤC HỌC</small><h2>${escapeHtml(items[currentIndex].title)}</h2></div><button class="btn primary" data-bla-lesson="${items[currentIndex].id}">Vào bài học</button></section>` : ''}</div>`;
  }

  function learningProgressView() {
    const stats = progressSnapshot(); const maxMinutes = Math.max(1, ...stats.week.map((item) => Number(item.minutes || 0)));
    return `<div class="bla-shell"><section class="section page-heading"><button class="back-link" data-view="home">← Trang chủ</button><p class="eyebrow">BẢNG TIẾN ĐỘ</p><h1 class="headline">Tiến bộ của bạn</h1><p class="subtle">Chỉ tổng hợp hoạt động đã lưu trên thiết bị hoặc đã đồng bộ.</p></section><section class="bla-stat-grid section"><article><strong>${stats.completedLessons}</strong><span>Bài đã hoàn thành</span></article><article><strong>${stats.learnedWords}</strong><span>Từ đã học</span></article><article><strong>${stats.tests}</strong><span>Bài kiểm tra</span></article><article><strong>${stats.average || '—'}${stats.average ? '%' : ''}</strong><span>Điểm trung bình</span></article><article><strong>${stats.totalMinutes}</strong><span>Phút học</span></article><article><strong>${stats.streak}</strong><span>Ngày liên tiếp</span></article></section><section class="bla-course-progress section"><header><div><p class="eyebrow">KHÓA HỌC</p><h2>Tiến độ tổng thể</h2></div><strong>${stats.coursePercent}%</strong></header><div class="bar large"><span style="width:${stats.coursePercent}%"></span></div><button class="text-link" data-view="learning-path">Xem lộ trình →</button></section><section class="bla-week-chart section"><header><div><p class="eyebrow">7 NGÀY GẦN ĐÂY</p><h2>Thời gian học mỗi ngày</h2></div><span>${stats.week.reduce((sum, item) => sum + Number(item.minutes || 0), 0)} phút</span></header><div class="bla-bars">${stats.week.map((item) => `<div><span><i style="height:${Math.max(item.minutes ? 10 : 2, Math.round(Number(item.minutes || 0) / maxMinutes * 100))}%"></i></span><b>${new Intl.DateTimeFormat('vi-VN', { weekday: 'short' }).format(item.date)}</b><small>${item.minutes || 0}′</small></div>`).join('')}</div></section><section class="bla-achievements section"><header><div><p class="eyebrow">THÀNH TỰU</p><h2>Cột mốc gần đây</h2></div><button class="text-link" data-view="achievements">Xem tất cả</button></header>${stats.achievements.length ? stats.achievements.map((item) => `<article><span>${escapeHtml(item.icon)}</span><div><b>${escapeHtml(item.title)}</b><small>${item.at ? new Intl.DateTimeFormat('vi-VN').format(new Date(item.at)) : 'Đã ghi nhận'}</small></div></article>`).join('') : '<p class="subtle">Chưa có cột mốc mới. Tiếp tục bài đang học để tạo bằng chứng đầu tiên.</p>'}</section></div>`;
  }

  function reviewCards() {
    const stamp = Date.now(); const favorites = new Set(DictionaryService?.favorites?.() || []);
    return (state.srsData || []).filter((card) => {
      const status = runtime.reviewStatus; const matchesStatus = status === 'all'
        || status === 'due' && card.nextReview && new Date(card.nextReview).getTime() <= stamp && card.status !== 'mastered'
        || status === 'new' && (!card.status || card.status === 'not_started')
        || status === 'learning' && ['learning', 'review'].includes(card.status)
        || status === 'mastered' && card.status === 'mastered'
        || status === 'wrong' && Number(card.wrongCount || 0) > 0
        || status === 'favorite' && favorites.has(cardId(card));
      return matchesStatus && (runtime.reviewTopic === 'all' || cardTopic(card) === runtime.reviewTopic);
    }).sort((a, b) => runtime.reviewStatus === 'wrong' ? Number(b.wrongCount || 0) - Number(a.wrongCount || 0) : new Date(a.nextReview || 0) - new Date(b.nextReview || 0));
  }

  function vocabularyReviewView() {
    const cards = reviewCards(); const topics = [...new Set((state.srsData || []).map(cardTopic))].sort();
    return `<div class="bla-shell"><section class="section page-heading"><button class="back-link" data-view="home">← Trang chủ</button><p class="eyebrow">ÔN TẬP CÁ NHÂN</p><h1 class="headline">Ôn từ theo cách bạn cần</h1><p class="subtle">Mọi câu trả lời cập nhật SRS thật; câu sai luôn có đáp án và giải thích.</p></section><section class="bla-review-filters section"><label>Nhóm từ<select id="blaReviewStatus">${[['due','Đến hạn'],['new','Mới học'],['learning','Đang học'],['mastered','Đã thuộc'],['wrong','Hay sai'],['favorite','Yêu thích'],['all','Tất cả']].map(([value, label]) => `<option value="${value}" ${runtime.reviewStatus === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label><label>Chủ đề<select id="blaReviewTopic"><option value="all">Tất cả chủ đề</option>${topics.map((topic) => `<option value="${escapeHtml(topic)}" ${runtime.reviewTopic === topic ? 'selected' : ''}>${escapeHtml(topic)}</option>`).join('')}</select></label><label>Số từ<select id="blaReviewCount">${[5, 10, 20, 30].map((count) => `<option value="${count}" ${runtime.reviewCount === count ? 'selected' : ''}>${count}</option>`).join('')}</select></label><strong>${cards.length} từ phù hợp</strong></section><section class="bla-review-modes section">${[['choice','A','Trắc nghiệm','Hàn → Việt'],['typing','가','Nhập đáp án','Việt → Hàn'],['listening','🔊','Nghe và chọn','Có tốc độ chậm'],['matching','↔','Ghép cặp','4 từ mỗi lượt']].map(([mode, icon, title, detail]) => `<button data-bla-review-mode="${mode}" ${!cards.length ? 'disabled' : ''}><span>${icon}</span><b>${title}</b><small>${detail}</small><em>Bắt đầu →</em></button>`).join('')}</section><section class="bla-review-links section"><button data-view="vocabulary-notebook"><span>★</span><div><b>Từ yêu thích của tôi</b><small>Lưu từ ở Từ điển rồi ôn lại tại đây</small></div></button><button data-view="my-vocabulary-p82"><span>MY</span><div><b>My Vocabulary</b><small>Deck cá nhân, import và SRS nâng cao</small></div></button></section>${!cards.length ? '<section class="empty-state"><h2>Nhóm này chưa có từ</h2><p>Chọn nhóm khác hoặc thêm từ từ Từ điển.</p><button class="btn primary" data-view="dictionary">Mở Từ điển</button></section>' : ''}</div>`;
  }

  function reviewOptions(card, cards) {
    const correct = cardMeaning(card); const distractors = cards.filter((item) => cardId(item) !== cardId(card)).map(cardMeaning).filter(Boolean);
    return [...new Set([correct, ...distractors])].slice(0, 4).sort((a, b) => (a.length + cardId(card).length) % 3 - (b.length + cardId(card).length) % 3);
  }

  function recordReview(card, correct, answer) {
    VocabularyService?.recordRecall?.(card, correct, answer, { source: `beginner-${runtime.session?.mode || 'review'}`, rating: correct ? 'remember' : 'forgot' });
    const value = progress(); value.daily.tasks.vocabulary = true; value.stats.wordsLearned = Math.max(Number(value.stats.wordsLearned || 0), (state.srsData || []).filter((item) => Number(item.reviewCount || 0) > 0).length); app.saveUserProgress?.(value);
    if (!correct) global.ErrorNotebookService?.add?.({ type: 'vocabulary', wordId: cardId(card), question: cardKorean(card), mistake: answer, correction: cardMeaning(card), explanation: cardExample(card) ? `Ví dụ: ${cardExample(card)}` : `${cardKorean(card)} nghĩa là “${cardMeaning(card)}”.`, source: 'beginner-vocabulary-review' });
  }

  function startReview(mode) {
    const all = reviewCards(); const count = mode === 'matching' ? Math.min(4, all.length) : Math.min(runtime.reviewCount, all.length);
    if (!count || (['choice', 'listening', 'matching'].includes(mode) && all.length < 2)) return toast('Cần ít nhất 2 từ phù hợp cho chế độ này.');
    runtime.reviewMode = mode; runtime.session = { mode, cards: all.slice(0, count), index: 0, correct: 0, wrong: 0, matched: [], selectedWordId: '', startedAt: new Date().toISOString(), completed: false }; runtime.result = null; setView('beginner-vocabulary-session');
  }

  function completeReviewSession() {
    if (!runtime.session) return; runtime.session.completed = true; runtime.session.completedAt = new Date().toISOString();
  }

  function matchingMarkup(session) {
    const remaining = session.cards.filter((card) => !session.matched.includes(cardId(card))); const reversed = [...session.cards].reverse();
    if (session.completed) return reviewCompleteMarkup(session);
    return `<section class="bla-matching section"><p>Chọn một từ tiếng Hàn, sau đó chọn nghĩa tương ứng.</p><div class="bla-match-grid"><div>${session.cards.map((card) => `<button class="${session.matched.includes(cardId(card)) ? 'matched' : session.selectedWordId === cardId(card) ? 'selected' : ''}" data-bla-match-word="${escapeHtml(cardId(card))}" ${session.matched.includes(cardId(card)) ? 'disabled' : ''} lang="ko">${escapeHtml(cardKorean(card))}</button>`).join('')}</div><div>${reversed.map((card) => `<button class="${session.matched.includes(cardId(card)) ? 'matched' : ''}" data-bla-match-meaning="${escapeHtml(cardId(card))}" ${session.matched.includes(cardId(card)) ? 'disabled' : ''}>${escapeHtml(cardMeaning(card))}</button>`).join('')}</div></div>${runtime.result ? `<div class="bla-review-feedback ${runtime.result.correct ? 'success' : 'error'}"><b>${runtime.result.correct ? '✓ Ghép đúng' : 'Chưa đúng'}</b><p>${escapeHtml(runtime.result.explanation)}</p></div>` : ''}<small>Còn ${remaining.length}/${session.cards.length} cặp</small></section>`;
  }

  function reviewCompleteMarkup(session) {
    const total = session.correct + session.wrong; const percent = Math.round(session.correct / Math.max(1, total) * 100);
    return `<section class="bla-review-complete section"><span>✓</span><p class="eyebrow">HOÀN THÀNH PHIÊN ÔN</p><h1>${percent}%</h1><p>${session.correct} lượt đúng · ${session.wrong} lượt sai. SRS và nhóm từ hay sai đã được cập nhật.</p><div><button class="btn primary" data-view="beginner-vocabulary-review">Chọn phiên khác</button><button class="btn secondary" data-view="home">Về Trang chủ</button></div></section>`;
  }

  function vocabularySessionView() {
    const session = runtime.session; if (!session) return vocabularyReviewView(); if (session.mode === 'matching') return `<div class="bla-shell"><section class="section page-heading"><button class="back-link" data-view="beginner-vocabulary-review">← Thoát</button><p class="eyebrow">GHÉP CẶP</p><h1 class="headline">Korean ↔ Tiếng Việt</h1></section>${matchingMarkup(session)}</div>`;
    if (session.completed || session.index >= session.cards.length) return `<div class="bla-shell">${reviewCompleteMarkup(session)}</div>`;
    const card = session.cards[session.index]; const result = runtime.result; const listening = session.mode === 'listening'; const typing = session.mode === 'typing'; const options = reviewOptions(card, session.cards);
    return `<div class="bla-shell"><section class="section page-heading"><button class="back-link" data-view="beginner-vocabulary-review">← Lưu và thoát</button><p class="eyebrow">${session.index + 1}/${session.cards.length} · ${session.mode}</p><div class="bar large"><span style="width:${Math.round(session.index / session.cards.length * 100)}%"></span></div></section><section class="bla-review-question section"><small>${typing ? 'TIẾNG VIỆT → TIẾNG HÀN' : listening ? 'NGHE → CHỌN NGHĨA' : 'TIẾNG HÀN → TIẾNG VIỆT'}</small>${listening ? `<div class="bla-listen-actions"><button data-bla-audio="${escapeHtml(cardKorean(card))}" data-rate="1">🔊 Bình thường</button><button data-bla-audio="${escapeHtml(cardKorean(card))}" data-rate="0.7">🐢 Chậm</button></div>` : `<h1 ${typing ? '' : 'lang="ko"'}>${escapeHtml(typing ? cardMeaning(card) : cardKorean(card))}</h1>`}${result ? `<div class="bla-review-feedback ${result.correct ? 'success' : 'error'}"><b>${result.correct ? '✓ Chính xác' : '✕ Chưa đúng'}</b>${!result.correct ? `<p>Bạn trả lời: <strong>${escapeHtml(result.answer || '(trống)')}</strong></p>` : ''}<p>Đáp án: <strong ${typing ? 'lang="ko"' : ''}>${escapeHtml(result.expected)}</strong></p><p>${escapeHtml(result.explanation)}</p><button class="btn primary" data-bla-review-next>${session.index === session.cards.length - 1 ? 'Xem kết quả' : 'Câu tiếp theo'}</button></div>` : typing ? `<form id="blaTypingForm"><label for="blaTypingAnswer">Nhập bằng Hangul</label><input id="blaTypingAnswer" name="answer" lang="ko" autocomplete="off" required autofocus><button class="btn primary">Kiểm tra</button></form>` : `<div class="answer-list">${options.map((option) => `<button class="answer-button" data-bla-review-answer="${escapeHtml(option)}">${escapeHtml(option)}</button>`).join('')}</div>`}</section></div>`;
  }

  function answerReview(answer) {
    const session = runtime.session; if (!session || runtime.result || session.completed) return; const card = session.cards[session.index]; const expected = session.mode === 'typing' ? cardKorean(card) : cardMeaning(card); const correct = normalize(answer) === normalize(expected);
    recordReview(card, correct, answer); session.correct += correct ? 1 : 0; session.wrong += correct ? 0 : 1; runtime.result = { correct, answer, expected, explanation: cardExample(card) ? `${cardKorean(card)} · ${cardMeaning(card)}. Ví dụ: ${cardExample(card)}` : `${cardKorean(card)} nghĩa là “${cardMeaning(card)}”.` }; render();
  }

  function nextReview() {
    const session = runtime.session; if (!session || !runtime.result) return; runtime.result = null; session.index += 1; if (session.index >= session.cards.length) completeReviewSession(); render();
  }

  function adaptiveTodayMarkup() {
    const goal = global.GoalTrackingService?.getGoal?.(); const plan = global.AdaptiveLearningEngine?.generateLearningSession?.({ availableMinutes: Number(goal?.dailyMinutes || state.currentUser?.studyMinutesPerDay || 15) }); const profile = global.AdaptiveLearningProfileService?.snapshot?.(); const weaknesses = global.WeaknessDetectionService?.detect?.({ learningProfile: profile })?.slice(0, 3) || [];
    if (!plan?.tasks?.length) return '';
    return `<section class="bla-adaptive-today daily-timeline section"><div class="daily-section-heading"><div><p class="eyebrow">HÔM NAY HỌC GÌ?</p><h2>${plan.minutes} phút theo dữ liệu của bạn</h2></div><span>TOPIK ${Number(goal?.targetLevel || profile?.targetTopikLevel || 2)}</span></div><ol>${plan.tasks.map((item, index) => `<li><time>${item.minutes}′</time><span>${index + 1}</span><div><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.reason)}</small></div></li>`).join('')}</ol><button class="btn primary full" data-bla-adaptive-start="${plan.minutes}">▶ BẮT ĐẦU HỌC HÔM NAY</button></section><section class="bla-adaptive-weakness daily-weakness-panel section"><div class="daily-section-heading"><div><p class="eyebrow">🧠 Bạn đang yếu gì?</p><h2>${weaknesses.length ? 'Ưu tiên cải thiện' : 'Cần thêm dữ liệu'}</h2></div><button class="text-link" data-view="adaptive-plan">Xem phân tích</button></div>${weaknesses.map((item) => `<article><span class="${item.priority}">${item.score}%</span><div><b>${escapeHtml(item.label)}</b><small>${escapeHtml(item.reason)}</small></div><button data-view="adaptive-plan">Luyện ngay</button></article>`).join('') || '<p class="subtle">Hoàn thành quiz hoặc đề TOPIK để nhận phân tích có căn cứ.</p>'}</section>`;
  }

  function chooseMatch(wordId, meaningId) {
    const session = runtime.session; if (!session || session.mode !== 'matching') return;
    if (wordId) { session.selectedWordId = wordId; runtime.result = null; return render(); }
    if (!meaningId || !session.selectedWordId) return;
    const card = session.cards.find((item) => cardId(item) === session.selectedWordId); const correct = session.selectedWordId === meaningId;
    recordReview(card, correct, cardMeaning(session.cards.find((item) => cardId(item) === meaningId)));
    session.correct += correct ? 1 : 0; session.wrong += correct ? 0 : 1;
    runtime.result = { correct, explanation: correct ? `${cardKorean(card)} = ${cardMeaning(card)}` : `${cardKorean(card)} nghĩa là “${cardMeaning(card)}”. Hãy thử ghép lại.` };
    if (correct) session.matched.push(session.selectedWordId); session.selectedWordId = '';
    if (session.matched.length === session.cards.length) completeReviewSession(); render();
  }

  const BeginnerLearningAssistantService = { currentAction, progress: progressSnapshot, reviewCards, startReview, openLesson };
  global.BeginnerLearningAssistantService = BeginnerLearningAssistantService;
  const assistantViews = { home: homeView, 'learning-path': learningPathView, 'learning-progress': learningProgressView, 'course-detail': courseDetailView, 'beginner-vocabulary-review': vocabularyReviewView, 'beginner-vocabulary-session': vocabularySessionView };
  const installViews = () => { global.KLEARN_EXTRA_VIEWS = { ...(global.KLEARN_EXTRA_VIEWS || {}), ...assistantViews }; };
  installViews();

  function bind() {
    if (state.currentView === 'home' && !global.document.querySelector('.bla-adaptive-today')) global.document.querySelector('.bla-home-hero')?.insertAdjacentHTML('afterend', adaptiveTodayMarkup());
    global.document.querySelector('[data-bla-adaptive-start]')?.addEventListener('click', (event) => { const service = global.DailyLearningExperienceService?.sessions; if (!service) return toast('Phiên học chưa sẵn sàng.'); service.start(Number(event.currentTarget.dataset.blaAdaptiveStart) || 15); setView('daily-session'); });
    global.document.querySelectorAll('[data-bla-lesson]').forEach((button) => { button.onclick = () => openLesson(button.dataset.blaLesson); });
    global.document.querySelector('[data-bla-five]')?.addEventListener('click', () => { const service = global.DailyLearningExperienceService?.sessions; if (!service) return toast('Phiên học nhanh chưa sẵn sàng.'); service.start(5); setView('daily-session'); });
    const status = global.document.getElementById('blaReviewStatus'); if (status) status.onchange = () => { runtime.reviewStatus = status.value; render(); };
    const topic = global.document.getElementById('blaReviewTopic'); if (topic) topic.onchange = () => { runtime.reviewTopic = topic.value; render(); };
    const count = global.document.getElementById('blaReviewCount'); if (count) count.onchange = () => { runtime.reviewCount = Number(count.value) || 10; render(); };
    global.document.querySelectorAll('[data-bla-review-mode]').forEach((button) => { button.onclick = () => startReview(button.dataset.blaReviewMode); });
    global.document.querySelectorAll('[data-bla-review-answer]').forEach((button) => { button.onclick = () => answerReview(button.dataset.blaReviewAnswer); });
    const typing = global.document.getElementById('blaTypingForm'); if (typing) typing.onsubmit = (event) => { event.preventDefault(); answerReview(new FormData(typing).get('answer')); };
    global.document.querySelector('[data-bla-review-next]')?.addEventListener('click', nextReview);
    global.document.querySelectorAll('[data-bla-audio]').forEach((button) => { button.onclick = () => speakKorean?.(button.dataset.blaAudio, Number(button.dataset.rate) || 1); });
    global.document.querySelectorAll('[data-bla-match-word]').forEach((button) => { button.onclick = () => chooseMatch(button.dataset.blaMatchWord, ''); });
    global.document.querySelectorAll('[data-bla-match-meaning]').forEach((button) => { button.onclick = () => chooseMatch('', button.dataset.blaMatchMeaning); });
  }

  const previousAfterRender = global.KLEARN_AFTER_RENDER;
  global.KLEARN_AFTER_RENDER = () => { previousAfterRender?.(); installViews(); if (state.currentUser) bind(); if (state.currentView === 'home' && !global.document.querySelector('.bla-shell') && !runtime.repairingHome) { runtime.repairingHome = true; render(); runtime.repairingHome = false; } };
  render();
})(window);
