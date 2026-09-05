/* Tiếng Hàn - TamHoanq — immersion and motivation journey */
(function buildImmersionMotivation(global) {
  'use strict';
  const app = global.KLEARN_APP;
  const content = global.KLEARN_IMMERSION_DATA;
  if (!app || !content) return;

  const { state, STORAGE_KEYS, render, setView, toast, escapeHtml, userScoped, saveUserScoped, getUserProgress, PracticeService, MasteryService, CloudSyncService, speakKorean } = app;
  const runtime = state.immersionMotivation || (state.immersionMotivation = { survivalId: '', survivalPhrase: 0, survivalResult: null, mediaId: '', mediaTranslation: true, slangQuery: '' });
  const uid = () => state.currentUser?.id || '';
  const now = () => new Date().toISOString();
  const dayKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const monthKey = (date = new Date()) => dayKey(date).slice(0, 7);
  const normalize = (value) => String(value || '').normalize('NFKC').toLocaleLowerCase().replace(/[.,!?…~]/g, '').replace(/\s+/g, ' ').trim();
  const record = () => {
    const value = userScoped(STORAGE_KEYS.immersionMotivation)[0];
    return value && typeof value === 'object' ? value : {};
  };
  const save = (changes = {}, reason = 'immersion-motivation') => {
    const next = { ...record(), ...changes, userId: uid(), updatedAt: now() };
    saveUserScoped(STORAGE_KEYS.immersionMotivation, [next], 5);
    CloudSyncService?.schedule?.(reason);
    return next;
  };
  const currentSurvival = () => content.survivalLessons.find((item) => item.id === runtime.survivalId) || content.survivalLessons[0];
  const currentMedia = () => content.mediaLessons.find((item) => item.id === runtime.mediaId) || content.mediaLessons[0];

  const SurvivalKitService = {
    catalog: () => content.survivalLessons,
    progress: record,
    select(id) { runtime.survivalId = content.survivalLessons.some((item) => item.id === id) ? id : content.survivalLessons[0].id; runtime.survivalPhrase = 0; runtime.survivalResult = null; return currentSurvival(); },
    evaluate(answer, lesson = currentSurvival(), index = runtime.survivalPhrase) {
      const phrase = lesson.phrases[index] || lesson.phrases[0]; const input = normalize(answer);
      const exact = phrase.accepted.some((item) => normalize(item) === input);
      const targetTokens = normalize(phrase.korean).split(' '); const hits = targetTokens.filter((token) => input.includes(token)).length;
      const score = exact ? 100 : Math.round(hits / Math.max(1, targetTokens.length) * 80);
      const result = { lessonId: lesson.id, phraseIndex: index, answer: String(answer || '').trim().slice(0, 300), target: phrase.korean, score, correct: score >= 70, createdAt: now() };
      runtime.survivalResult = result;
      const attempts = [result, ...(record().survivalAttempts || [])].slice(0, 100);
      const completedPhraseIds = result.correct ? [...new Set([...(record().completedPhraseIds || []), `${lesson.id}:${index}`])] : (record().completedPhraseIds || []);
      save({ survivalAttempts: attempts, completedPhraseIds, lastSurvivalId: lesson.id }, 'survival-practice');
      if (result.correct) MasteryService?.updateLesson?.(`survival:${lesson.id}`, score, { kind: 'real-life-language' });
      return result;
    },
    completeLesson(id = currentSurvival().id) { const completedSurvivalIds = [...new Set([...(record().completedSurvivalIds || []), id])]; return save({ completedSurvivalIds, lastSurvivalId: id }, 'survival-complete'); }
  };

  const MediaLearningService = {
    catalog: () => content.mediaLessons,
    select(id) { runtime.mediaId = content.mediaLessons.some((item) => item.id === id) ? id : content.mediaLessons[0].id; return currentMedia(); },
    complete(id = currentMedia().id) { const completedMediaIds = [...new Set([...(record().completedMediaIds || []), id])]; MasteryService?.updateLesson?.(`media:${id}`, 80, { kind: 'media-dialogue' }); return save({ completedMediaIds, lastMediaId: id }, 'media-learning'); }
  };

  const DailyKoreanFeedService = {
    today(date = new Date()) { const serial = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000); return { ...content.dailyFeed[((serial % content.dailyFeed.length) + content.dailyFeed.length) % content.dailyFeed.length], date: dayKey(date) }; },
    completed(date = new Date()) { return (record().feedDays || []).includes(dayKey(date)); },
    complete(date = new Date()) { const key = dayKey(date); return save({ feedDays: [...new Set([...(record().feedDays || []), key])].sort() }, 'daily-korean-feed'); }
  };

  const MonthlyChallengeService = {
    current(date = new Date()) {
      const key = monthKey(date); const saved = (record().challenges || []).find((item) => item.month === key);
      const ownDays = [...new Set([...(saved?.days || []), ...(record().feedDays || [])])].filter((day) => day.startsWith(key));
      const calendarDays = Object.values(global.StudyCalendarService?.activityByDay?.() || {}).filter((item) => item.date?.startsWith(key) && Number(item.minutes || 0) > 0).map((item) => item.date);
      const days = [...new Set([...ownDays, ...calendarDays])].sort(); const target = Math.min(30, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate());
      return { month: key, joinedAt: saved?.joinedAt || null, days, target, progress: days.length, percentage: Math.min(100, Math.round(days.length / target * 100)), completedAt: saved?.completedAt || (days.length >= target ? now() : null) };
    },
    join(date = new Date()) { const item = this.current(date); if (!item.joinedAt) item.joinedAt = now(); const challenges = [item, ...(record().challenges || []).filter((entry) => entry.month !== item.month)]; save({ challenges }, 'monthly-challenge'); return item; },
    checkIn(date = new Date()) { const item = this.current(date); const key = dayKey(date); item.joinedAt = item.joinedAt || now(); item.days = [...new Set([...item.days, key])].sort(); item.progress = item.days.length; item.percentage = Math.min(100, Math.round(item.progress / item.target * 100)); if (item.progress >= item.target) item.completedAt = item.completedAt || now(); const challenges = [item, ...(record().challenges || []).filter((entry) => entry.month !== item.month)]; save({ challenges }, 'monthly-challenge-checkin'); return item; }
  };

  const AchievementRoomService = {
    certificates() {
      const saved = record().certificates || []; const byId = new Map(saved.map((item) => [item.id, item])); const progress = getUserProgress();
      if (progress.foundation?.checkpoint?.readyForTopik1 && !byId.has('foundation-ready')) byId.set('foundation-ready', { id: 'foundation-ready', title: 'Sẵn sàng TOPIK 1', detail: 'Hoàn thành Beginner Checkpoint.', earnedAt: progress.foundation.checkpoint.completedAt || now(), type: 'in-app' });
      (PracticeService?.getHistory?.() || []).filter((item) => Number(item.percentage || 0) >= 80 && /TOPIK/i.test(`${item.level || ''} ${item.setTitle || ''}`)).forEach((item) => { const level = `${item.level || item.setTitle}`.match(/[1-6]/)?.[0] || 'Practice'; const id = `topik-practice-${level}`; if (!byId.has(id)) byId.set(id, { id, title: `TOPIK ${level} Practice 80%+`, detail: 'Chứng nhận luyện tập trong ứng dụng.', earnedAt: item.completedAt || now(), type: 'practice' }); });
      const result = [...byId.values()]; if (result.length !== saved.length) save({ certificates: result }, 'achievement-certificates'); return result;
    },
    summary() { const badges = global.AchievementService?.all?.() || []; const milestones = global.MilestoneService?.refresh?.() || global.MilestoneService?.all?.() || []; const certificates = this.certificates(); return { badges, milestones, certificates, unlocked: badges.filter((item) => item.unlocked || item.unlockedAt).length }; }
  };

  const PersonalPortfolioService = {
    snapshot() {
      const progress = getUserProgress(); const attempts = progress.pronunciationAttempts || []; const achievements = AchievementRoomService.summary(); const mastered = (state.srsData || []).filter((item) => item.status === 'mastered').length;
      return { level: state.currentUser?.currentTopikLevel ? `TOPIK ${state.currentUser.currentTopikLevel}` : state.currentUser?.learningTrack === 'foundation' ? 'Level 0' : 'Beginner', vocabulary: { total: state.srsData?.length || 0, mastered }, speaking: { attempts: attempts.length, average: attempts.length ? Math.round(attempts.reduce((sum, item) => sum + Number(item.score || 0), 0) / attempts.length) : 0 }, achievement: achievements };
    }
  };

  function heading(back, eyebrow, title, subtitle) { return `<section class="section page-heading"><button class="back-link" data-view="${back}">← Quay lại</button><p class="eyebrow">${escapeHtml(eyebrow)}</p><h1 class="headline">${escapeHtml(title)}</h1><p class="subtle">${escapeHtml(subtitle)}</p></section>`; }
  function immersionHubView() {
    const challenge = MonthlyChallengeService.current(); const portfolio = PersonalPortfolioService.snapshot(); const feed = DailyKoreanFeedService.today();
    const items = [['旅','Korean Survival Kit','5 tình huống thiết yếu','survival-kit'],['▤','Learn Korean Through Media','Hội thoại nguyên bản · không video bản quyền','media-learning'],['ㅋ','Slang Dictionary','Ý nghĩa · lúc dùng · độ thân mật','slang-dictionary'],['日','Daily Korean Feed',feed.phrase[0],'daily-korean-feed'],['30','Thử thách tháng',`${challenge.progress}/${challenge.target} ngày`,'monthly-challenge'],['◇','Achievement Room',`${portfolio.achievement.unlocked} huy hiệu`,'achievement-room'],['人','Personal Portfolio',`${portfolio.level} · ${portfolio.vocabulary.mastered} từ mastered`,'personal-portfolio'],['◎','Nhiệm vụ thực tế','Tự giới thiệu · gọi món','real-life-missions'],['記','Nhật ký học tập','Điều đã học · khó khăn · mục tiêu','learning-journal'],['↗','Learning Timeline','Ngày bắt đầu → 100 từ → TOPIK','progress-timeline']];
    return `${heading('lessons','P2 · Immersion & Motivation','Hành trình tiếng Hàn của bạn','Học trong ngữ cảnh thật, duy trì nhịp mỗi ngày và lưu lại những cột mốc có bằng chứng.')}<section class="immersion-journey-strip section"><div><small>HÔM NAY</small><b lang="ko">${escapeHtml(feed.phrase[0])}</b><span>${escapeHtml(feed.phrase[1])}</span></div><div><small>THÁNG NÀY</small><b>${challenge.progress}/${challenge.target} ngày</b><span>Thử thách học tiếng Hàn</span></div><div><small>HÀNH TRÌNH</small><b>${portfolio.achievement.unlocked}</b><span>huy hiệu thật đã mở</span></div></section><section class="immersion-tool-grid section">${items.map(([icon,title,description,view]) => `<button data-view="${view}"><span>${icon}</span><div><b>${escapeHtml(title)}</b><small>${escapeHtml(description)}</small></div><i>›</i></button>`).join('')}</section>`;
  }
  function survivalKitView() {
    const selected = currentSurvival(); const progress = record(); const completed = new Set(progress.completedSurvivalIds || []); const phrase = selected.phrases[runtime.survivalPhrase % selected.phrases.length]; const result = runtime.survivalResult;
    return `${heading('immersion-journey','Korean Survival Kit','Tiếng Hàn để xử lý việc thật','Mỗi bài gồm câu thiết yếu, giọng đọc ko-KR, bối cảnh sử dụng và bài thực hành.')}<nav class="survival-tabs section">${content.survivalLessons.map((item) => `<button class="${item.id === selected.id ? 'active' : ''}" data-survival-id="${item.id}"><span>${item.icon}</span><b>${escapeHtml(item.place)}</b><small>${completed.has(item.id) ? '✓ Hoàn thành' : item.level}</small></button>`).join('')}</nav><section class="survival-workspace section"><aside><span class="survival-place-icon">${selected.icon}</span><p class="eyebrow">${escapeHtml(selected.place)} · ${escapeHtml(selected.level)}</p><h2>${escapeHtml(selected.context)}</h2><ol>${selected.phrases.map((item,index) => `<li class="${index === runtime.survivalPhrase ? 'active' : ''} ${(progress.completedPhraseIds || []).includes(`${selected.id}:${index}`) ? 'done' : ''}"><button data-survival-phrase="${index}"><span>${index + 1}</span><b lang="ko">${escapeHtml(item.korean)}</b></button></li>`).join('')}</ol></aside><article><small>PHRASE ${runtime.survivalPhrase + 1}/${selected.phrases.length}</small><h2 lang="ko">${escapeHtml(phrase.korean)}</h2><p class="survival-meaning">${escapeHtml(phrase.meaning)}</p><button class="audio-inline" data-immersion-speak="${escapeHtml(phrase.korean)}">🔊 Nghe câu</button><div class="survival-context"><span>KHI NÀO DÙNG</span><p>${escapeHtml(phrase.usage)}</p></div><form id="survivalPracticeForm"><label><span>TÌNH HUỐNG</span>${escapeHtml(phrase.prompt)}<input name="answer" lang="ko" autocomplete="off" maxlength="300" placeholder="Nhập câu tiếng Hàn…" required></label><button class="btn primary" type="submit">Kiểm tra</button></form>${result ? `<div class="survival-feedback ${result.correct ? 'correct' : 'retry'}"><b>${result.correct ? `✓ Phù hợp · ${result.score}%` : `Thử lại · ${result.score}%`}</b><span>Câu gợi ý: <i lang="ko">${escapeHtml(phrase.korean)}</i></span></div>` : ''}<button class="btn secondary full" data-survival-complete>Hoàn thành bài ${escapeHtml(selected.place)}</button></article></section>`;
  }
  function mediaLearningView() {
    const selected = currentMedia(); const completed = new Set(record().completedMediaIds || []);
    return `${heading('immersion-journey','Learn Korean Through Media','Học từ một đoạn hội thoại','Nội dung hội thoại do TamHoanq biên soạn; ứng dụng không nhúng hoặc lưu video có bản quyền.')}<nav class="media-tabs section">${content.mediaLessons.map((item) => `<button class="${item.id === selected.id ? 'active' : ''}" data-media-id="${item.id}"><span>${escapeHtml(item.category)}</span><b>${escapeHtml(item.title)}</b><small>${completed.has(item.id) ? '✓ Đã học' : '3 câu thoại'}</small></button>`).join('')}</nav><section class="media-lesson section"><header><div><p class="eyebrow">${escapeHtml(selected.category)}</p><h2>${escapeHtml(selected.title)}</h2><small>${escapeHtml(selected.sourceNote)}</small></div><button class="btn secondary" data-media-translation>${runtime.mediaTranslation ? 'Ẩn bản dịch' : 'Hiện bản dịch'}</button></header><div class="media-dialogue">${selected.dialogue.map((line,index) => `<article><span>${index + 1}</span><div><b lang="ko">${escapeHtml(line)}</b>${runtime.mediaTranslation ? `<p>${escapeHtml(selected.translation[index])}</p>` : ''}</div><button data-immersion-speak="${escapeHtml(line)}">▶</button></article>`).join('')}</div><div class="media-notes"><section><h3>Từ mới</h3>${selected.vocabulary.map(([word,meaning]) => `<p><b lang="ko">${escapeHtml(word)}</b><span>${escapeHtml(meaning)}</span><button data-immersion-speak="${escapeHtml(word)}">🔊</button></p>`).join('')}</section><section><h3>Grammar</h3>${selected.grammar.map(([pattern,explanation]) => `<p><b lang="ko">${escapeHtml(pattern)}</b><span>${escapeHtml(explanation)}</span></p>`).join('')}</section></div><button class="btn primary full" data-media-complete>${completed.has(selected.id) ? '✓ Đã lưu tiến độ' : 'Hoàn thành bài media'}</button></section>`;
  }
  function slangDictionaryView() {
    const query = normalize(runtime.slangQuery); const items = content.slang.filter((item) => !query || normalize(`${item.korean} ${item.meaning} ${item.when}`).includes(query));
    return `${heading('immersion-journey','Slang Dictionary','Tiếng lóng dùng đúng người, đúng lúc','Các biểu đạt thân mật không nên được dùng mặc định trong công việc hoặc với người chưa thân.')}<label class="slang-search section"><span>⌕</span><input id="slangSearch" value="${escapeHtml(runtime.slangQuery)}" placeholder="Tìm ㅋㅋㅋ, 대박, ý nghĩa…"></label><section class="slang-list section">${items.map((item) => `<article><header><h2 lang="ko">${escapeHtml(item.korean)}</h2><button data-immersion-speak="${escapeHtml(item.example)}">🔊</button></header><p>${escapeHtml(item.meaning)}</p><dl><div><dt>Khi dùng</dt><dd>${escapeHtml(item.when)}</dd></div><div><dt>Mức độ</dt><dd>${escapeHtml(item.intimacy)}</dd></div><div><dt>Tránh dùng</dt><dd>${escapeHtml(item.avoid)}</dd></div></dl><blockquote lang="ko">${escapeHtml(item.example)}</blockquote></article>`).join('') || '<div class="empty-state">Không tìm thấy tiếng lóng phù hợp.</div>'}</section>`;
  }
  function dailyFeedView() {
    const feed = DailyKoreanFeedService.today(); const done = DailyKoreanFeedService.completed();
    return `${heading('immersion-journey',`Daily Korean Feed · ${feed.date}`,'Một chút tiếng Hàn mỗi ngày','Nội dung được biên soạn và luân phiên cố định theo ngày; không random hoặc sinh bằng AI.')}<section class="daily-korean-card section"><div class="daily-feed-number">日</div><article><span>PHRASE</span><h2 lang="ko">${escapeHtml(feed.phrase[0])}</h2><p>${escapeHtml(feed.phrase[1])}</p><button data-immersion-speak="${escapeHtml(feed.phrase[0])}">🔊 Nghe phrase</button></article><article><span>CULTURE</span><h3>💡 Cách dùng trong đời thật</h3><p>${escapeHtml(feed.culture)}</p></article><article><span>MINI READING</span><h3 lang="ko">${escapeHtml(feed.reading[0])}</h3><p>${escapeHtml(feed.reading[1])}</p><button data-immersion-speak="${escapeHtml(feed.reading[0])}">▶ Nghe bài đọc</button></article><button class="btn primary full" data-feed-complete ${done ? 'disabled' : ''}>${done ? '✓ Đã hoàn thành hôm nay' : 'Đánh dấu đã học hôm nay'}</button></section>`;
  }
  function monthlyChallengeView() {
    const challenge = MonthlyChallengeService.current(); const todayDone = challenge.days.includes(dayKey()); const monthDays = Array.from({length:challenge.target},(_,index) => `${challenge.month}-${String(index + 1).padStart(2,'0')}`);
    return `${heading('immersion-journey','Monthly Challenge','30 ngày học tiếng Hàn','Mỗi ngày chỉ được ghi nhận một lần. Tiến độ cũng tính những ngày có hoạt động thật trong Lịch học.')}<section class="monthly-challenge-card section"><header><div><p>${challenge.month}</p><h2>${challenge.progress}/${challenge.target} ngày</h2></div><strong>${challenge.percentage}%</strong></header><div class="bar large"><span style="width:${challenge.percentage}%"></span></div><div class="challenge-calendar">${monthDays.map((day,index) => `<span class="${challenge.days.includes(day) ? 'done' : day === dayKey() ? 'today' : ''}" title="${day}">${challenge.days.includes(day) ? '✓' : index + 1}</span>`).join('')}</div>${challenge.joinedAt ? `<button class="btn primary full" data-challenge-checkin ${todayDone ? 'disabled' : ''}>${todayDone ? '✓ Hôm nay đã được ghi nhận' : 'Xác nhận đã học hôm nay'}</button>` : '<button class="btn primary full" data-challenge-join>Tham gia thử thách</button>'}<small>Không có leaderboard và không tự đăng thành tích.</small></section>`;
  }
  function achievementRoomView() {
    const summary = AchievementRoomService.summary();
    return `${heading('immersion-journey','Achievement Room','Phòng thành tích','Huy hiệu, cột mốc và chứng nhận chỉ xuất hiện từ tiến độ học hoặc kết quả luyện tập thật.')}<section class="achievement-room-summary section"><div><b>${summary.unlocked}/${summary.badges.length}</b><span>Badge</span></div><div><b>${summary.milestones.length}</b><span>Milestone</span></div><div><b>${summary.certificates.length}</b><span>Certificate</span></div></section><section class="achievement-room-columns section"><article><h2>Badge</h2>${summary.badges.map((item) => `<div class="achievement-room-item ${item.unlocked || item.unlockedAt ? 'earned' : 'locked'}"><span>${item.unlocked || item.unlockedAt ? item.icon : '○'}</span><div><b>${escapeHtml(item.title)}</b><small>${item.unlockedAt ? new Intl.DateTimeFormat('vi-VN').format(new Date(item.unlockedAt)) : 'Chưa đạt'}</small></div></div>`).join('')}</article><article><h2>Milestone</h2>${summary.milestones.length ? summary.milestones.slice().reverse().map((item) => `<div class="achievement-room-item earned"><span>✓</span><div><b>${escapeHtml(typeof item.title === 'string' ? item.title : item.title?.vi || '')}</b><small>${item.reachedAt ? new Intl.DateTimeFormat('vi-VN').format(new Date(item.reachedAt)) : ''}</small></div></div>`).join('') : '<p class="subtle">Cột mốc đầu tiên sẽ xuất hiện khi có tiến độ thật.</p>'}</article><article><h2>Certificate</h2>${summary.certificates.length ? summary.certificates.map((item) => `<div class="certificate-card"><span>TH</span><div><small>IN-APP LEARNING RECORD</small><b>${escapeHtml(item.title)}</b><p>${escapeHtml(item.detail)}</p><time>${new Intl.DateTimeFormat('vi-VN').format(new Date(item.earnedAt))}</time></div></div>`).join('') : '<p class="subtle">Hoàn thành Beginner Checkpoint hoặc đạt 80%+ bài luyện TOPIK để nhận chứng nhận trong ứng dụng.</p>'}<p class="certificate-note">Chứng nhận này ghi nhận hoạt động học trong TamHoanq, không phải chứng chỉ TOPIK chính thức.</p></article></section>`;
  }
  function portfolioView() {
    const portfolio = PersonalPortfolioService.snapshot(); const latest = portfolio.achievement.milestones.slice().sort((a,b) => new Date(b.reachedAt) - new Date(a.reachedAt))[0];
    return `${heading('immersion-journey','Personal Portfolio','Hồ sơ học tiếng Hàn','Bản tổng hợp riêng tư từ Level, SRS, Speaking và các thành tích thực tế của bạn.')}<section class="portfolio-hero section"><div class="portfolio-monogram">TH</div><div><span>TIẾNG HÀN · TAMHOANQ</span><h2>${escapeHtml(state.currentUser?.fullName || state.currentUser?.name || 'Người học')}</h2><p>${escapeHtml(portfolio.level)}</p></div></section><section class="portfolio-metrics section"><article><span>LEVEL</span><b>${escapeHtml(portfolio.level)}</b><small>Lộ trình hiện tại</small></article><article><span>VOCABULARY</span><b>${portfolio.vocabulary.mastered}</b><small>${portfolio.vocabulary.total} từ trong SRS</small></article><article><span>SPEAKING</span><b>${portfolio.speaking.average}%</b><small>${portfolio.speaking.attempts} lượt đã lưu</small></article><article><span>ACHIEVEMENT</span><b>${portfolio.achievement.unlocked}</b><small>${portfolio.achievement.certificates.length} certificate</small></article></section><section class="portfolio-next section"><div><p class="eyebrow">Cột mốc gần nhất</p><h2>${escapeHtml(latest ? (typeof latest.title === 'string' ? latest.title : latest.title?.vi || '') : 'Bắt đầu hành trình')}</h2><p>${latest?.reachedAt ? new Intl.DateTimeFormat('vi-VN').format(new Date(latest.reachedAt)) : 'Tiến độ mới sẽ tự xuất hiện ở đây.'}</p></div><div><button class="btn secondary" data-view="achievement-room">Mở Achievement Room</button><button class="btn primary" data-view="progress-timeline">Xem Learning Timeline</button></div></section>`;
  }

  function enhanceExistingViews() {
    if (state.currentView === 'lessons' && !document.querySelector('.immersion-journey-entry')) {
      const markup = `<button class="learning-directory-item immersion-journey-entry" data-view="immersion-journey"><span>旅</span><div><b>Hành trình trải nghiệm</b><small>Survival · Media · Slang · Daily Feed</small></div><i>›</i></button>`;
      const directory = document.querySelector('.learning-directory');
      if (directory) directory.insertAdjacentHTML('afterbegin', markup); else document.querySelector('.page-heading')?.insertAdjacentHTML('afterend', `<section class="section immersion-foundation-entry">${markup}</section>`);
    }
    if (state.currentView === 'home' && !document.querySelector('.daily-korean-home-entry')) { const feed = DailyKoreanFeedService.today(); document.querySelector('.daily-home-header,.home-hero,.page-heading')?.insertAdjacentHTML('afterend', `<button class="daily-korean-home-entry section" data-view="daily-korean-feed"><span>오늘의 한국어</span><b lang="ko">${escapeHtml(feed.phrase[0])}</b><small>${escapeHtml(feed.phrase[1])}</small><i>›</i></button>`); }
    if (state.currentView === 'profile' && !document.querySelector('.portfolio-entry')) document.querySelector('.personal-profile,.profile-head,.page-heading,#app')?.insertAdjacentHTML('afterend', `<button class="portfolio-entry section" data-view="personal-portfolio"><span>TH</span><div><b>Personal Portfolio</b><small>Level · Vocabulary · Speaking · Achievement</small></div><i>›</i></button>`);
  }
  function bind() {
    document.querySelectorAll('[data-immersion-speak]').forEach((button) => { button.onclick = () => speakKorean(button.dataset.immersionSpeak); });
    document.querySelectorAll('[data-survival-id]').forEach((button) => { button.onclick = () => { SurvivalKitService.select(button.dataset.survivalId); render(); }; });
    document.querySelectorAll('[data-survival-phrase]').forEach((button) => { button.onclick = () => { runtime.survivalPhrase = Number(button.dataset.survivalPhrase) || 0; runtime.survivalResult = null; render(); }; });
    const survivalForm = document.getElementById('survivalPracticeForm'); if (survivalForm) survivalForm.onsubmit = (event) => { event.preventDefault(); SurvivalKitService.evaluate(new FormData(survivalForm).get('answer')); render(); };
    document.querySelector('[data-survival-complete]')?.addEventListener('click', () => { SurvivalKitService.completeLesson(); toast('Đã lưu tiến độ Survival Kit.'); render(); });
    document.querySelectorAll('[data-media-id]').forEach((button) => { button.onclick = () => { MediaLearningService.select(button.dataset.mediaId); render(); }; });
    document.querySelector('[data-media-translation]')?.addEventListener('click', () => { runtime.mediaTranslation = !runtime.mediaTranslation; render(); });
    document.querySelector('[data-media-complete]')?.addEventListener('click', () => { MediaLearningService.complete(); toast('Đã lưu bài media.'); render(); });
    const slangSearch = document.getElementById('slangSearch'); if (slangSearch) slangSearch.oninput = () => { runtime.slangQuery = slangSearch.value; render(); };
    document.querySelector('[data-feed-complete]')?.addEventListener('click', () => { DailyKoreanFeedService.complete(); MonthlyChallengeService.checkIn(); toast('Đã ghi nhận bài học hôm nay.'); render(); });
    document.querySelector('[data-challenge-join]')?.addEventListener('click', () => { MonthlyChallengeService.join(); toast('Đã tham gia thử thách tháng.'); render(); });
    document.querySelector('[data-challenge-checkin]')?.addEventListener('click', () => { MonthlyChallengeService.checkIn(); toast('Đã ghi nhận ngày học.'); render(); });
  }

  global.SurvivalKitService = SurvivalKitService;
  global.MediaLearningService = MediaLearningService;
  global.DailyKoreanFeedService = DailyKoreanFeedService;
  global.MonthlyChallengeService = MonthlyChallengeService;
  global.AchievementRoomService = AchievementRoomService;
  global.PersonalPortfolioService = PersonalPortfolioService;
  global.KLEARN_EXTRA_VIEWS = { ...(global.KLEARN_EXTRA_VIEWS || {}), 'immersion-journey': immersionHubView, 'survival-kit': survivalKitView, 'media-learning': mediaLearningView, 'slang-dictionary': slangDictionaryView, 'daily-korean-feed': dailyFeedView, 'monthly-challenge': monthlyChallengeView, 'achievement-room': achievementRoomView, 'personal-portfolio': portfolioView };
  const previousAfterRender = global.KLEARN_AFTER_RENDER;
  global.KLEARN_AFTER_RENDER = () => { previousAfterRender?.(); if (!state.currentUser) return; enhanceExistingViews(); bind(); };
  render();
})(window);
