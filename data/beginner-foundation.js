/* Tiếng Hàn - TamHoanq · Level 0 beginner foundation (local-first) */
(function beginnerFoundationModule(global) {
  'use strict';
  const app = global.KLEARN_APP;
  if (!app) return;

  const { state, render, setView, toast, escapeHtml, getUserProgress, saveUserProgress, getUserSrs, saveUserSrs, updateCurrentUser, MasteryService, DictionaryService, emitLearningMutation } = app;
  const now = () => new Date().toISOString();
  const uniq = (items) => [...new Set(items)];
  const firstName = (name = '') => name.trim().split(/\s+/).filter(Boolean).pop() || 'bạn';

  const CHARACTER_GROUPS = Object.freeze([
    {
      id: 'vowels', title: 'Nguyên âm', short: 'Nguyên âm',
      items: [
        ['ㅏ','a','아기','em bé'], ['ㅑ','ya','야구','bóng chày'], ['ㅓ','eo','어머니','mẹ'], ['ㅕ','yeo','여자','phụ nữ'], ['ㅗ','o','오이','dưa leo'],
        ['ㅛ','yo','요리','nấu ăn'], ['ㅜ','u','우유','sữa'], ['ㅠ','yu','유리','kính'], ['ㅡ','eu','음악','âm nhạc'], ['ㅣ','i','이름','tên']
      ]
    },
    {
      id: 'consonants', title: 'Phụ âm', short: 'Phụ âm',
      items: [
        ['ㄱ','g/k','가방','cặp sách'], ['ㄴ','n','나라','đất nước'], ['ㄷ','d/t','다리','chân'], ['ㄹ','r/l','라디오','radio'], ['ㅁ','m','마음','tấm lòng'],
        ['ㅂ','b/p','바다','biển'], ['ㅅ','s','사람','người'], ['ㅇ','ng / âm câm','아이','trẻ em'], ['ㅈ','j','저','tôi'], ['ㅊ','ch','차','trà'],
        ['ㅋ','kh bật hơi','코','mũi'], ['ㅌ','th bật hơi','토끼','thỏ'], ['ㅍ','ph bật hơi','포도','nho'], ['ㅎ','h','하나','một']
      ]
    },
    {
      id: 'compound-vowels', title: 'Nguyên âm ghép', short: 'Âm ghép',
      items: [
        ['ㅐ','ae','개','chó'], ['ㅔ','e','게','cua'], ['ㅒ','yae','얘기','câu chuyện'], ['ㅖ','ye','예','vâng'], ['ㅘ','wa','과자','bánh snack'],
        ['ㅙ','wae','왜','tại sao'], ['ㅚ','oe','회사','công ty'], ['ㅝ','wo','원','won'], ['ㅞ','we','웨이터','bồi bàn'], ['ㅟ','wi','위','phía trên'], ['ㅢ','ui','의자','ghế']
      ]
    },
    {
      id: 'double-consonants', title: 'Phụ âm đôi', short: 'Âm đôi',
      items: [
        ['ㄲ','kk căng','꿈','giấc mơ'], ['ㄸ','tt căng','딸','con gái'], ['ㅃ','pp căng','빵','bánh mì'], ['ㅆ','ss căng','쌀','gạo'], ['ㅉ','jj căng','짜다','mặn']
      ]
    },
    {
      id: 'syllables', title: 'Âm tiết', short: 'Âm tiết',
      items: [
        ['가','ga','가방','cặp sách'], ['나','na','나라','đất nước'], ['다','da','다리','chân'], ['라','ra','라디오','radio'], ['마','ma','마음','tấm lòng'], ['바','ba','바다','biển']
      ]
    }
  ].map((group) => ({ ...group, items: group.items.map(([char, sound, example, meaning]) => ({ char, sound, pronunciation: `Đọc gần âm “${sound}”; nghe mẫu và bắt chước ngắn, rõ.`, example, meaning })) })));

  const CORE_CHARACTERS = CHARACTER_GROUPS.filter((group) => group.id !== 'syllables').flatMap((group) => group.items);
  const CORE_CHARACTER_TOTAL = CORE_CHARACTERS.length;
  const SYLLABLE_EXERCISES = Object.freeze([
    { id: 'ga', pieces: ['ㄱ','ㅏ'], answer: '가', sound: '가', hint: 'Phụ âm đầu ㄱ đứng bên trái nguyên âm dọc ㅏ.' },
    { id: 'na', pieces: ['ㄴ','ㅏ'], answer: '나', sound: '나', hint: 'Ghép ㄴ với ㅏ để tạo 나.' },
    { id: 'mo', pieces: ['ㅁ','ㅗ'], answer: '모', sound: '모', hint: 'Nguyên âm ngang ㅗ nằm dưới phụ âm đầu.' },
    { id: 'han', pieces: ['ㅎ','ㅏ','ㄴ'], answer: '한', sound: '한', hint: 'ㄴ ở dưới là 받침 (phụ âm cuối).' }
  ]);
  const MINIMAL_PAIRS = Object.freeze([
    { id: 'eo-o', choices: ['ㅓ','ㅗ'], targets: ['ㅓ','ㅗ'], note: 'ㅓ mở về sau; ㅗ tròn môi.' },
    { id: 'eu-u', choices: ['ㅡ','ㅜ'], targets: ['ㅡ','ㅜ'], note: 'ㅡ kéo ngang môi; ㅜ tròn môi.' },
    { id: 'g-k-kk', choices: ['ㄱ','ㅋ','ㄲ'], targets: ['ㄱ','ㅋ','ㄲ'], note: 'Âm thường → bật hơi → căng.' },
    { id: 'd-t-tt', choices: ['ㄷ','ㅌ','ㄸ'], targets: ['ㄷ','ㅌ','ㄸ'], note: 'Nghe lượng hơi và độ căng.' },
    { id: 'b-p-pp', choices: ['ㅂ','ㅍ','ㅃ'], targets: ['ㅂ','ㅍ','ㅃ'], note: 'Âm thường → bật hơi → căng.' }
  ]);
  const BATCHIM_STAGES = Object.freeze([
    { id: 'batchim-basic', label: '1. Cơ bản', title: '받침 là gì?', examples: [['가','không có 받침'],['각','ㄱ là 받침']], body: '받침 là phụ âm nằm ở đáy khối âm tiết. Hãy nhìn vị trí trước khi đọc.' },
    { id: 'batchim-single', label: '2. 받침 đơn', title: 'Đọc phụ âm cuối đơn', examples: [['각','k'],['간','n'],['감','m'],['갈','l']], body: 'Ở bước đầu, chỉ luyện ㄱ, ㄴ, ㅁ, ㄹ trong từ ngắn.' },
    { id: 'batchim-reading', label: '3. Quy tắc đọc', title: 'Đọc gọn ở cuối âm tiết', examples: [['밥','pap'],['옷','ot'],['꽃','kkot']], body: 'Không thêm nguyên âm sau 받침. Dừng âm ngắn và gọn.' },
    { id: 'batchim-linking', label: '4. Nối âm cơ bản', title: 'Nối sang ㅇ câm', examples: [['한국어','한구거'],['먹어요','머거요']], body: 'Khi âm tiết sau bắt đầu bằng ㅇ câm, 받침 thường được nối sang âm tiết sau. Chỉ học mẫu cơ bản ở Level 0.' }
  ]);
  const FIRST_SENTENCE_PARTS = Object.freeze([
    { text: '저', meaning: 'tôi', note: 'Đại từ lịch sự, phù hợp cho người mới.' },
    { text: '는', meaning: 'thì / còn', note: 'Trợ từ chủ đề sau từ không có 받침.' },
    { text: '학생', meaning: 'học sinh', note: 'Danh từ nói về vai trò hoặc nghề nghiệp.' },
    { text: '이에요', meaning: 'là', note: 'Dùng sau danh từ có 받침 như 학생.' }
  ]);
  const CHECKPOINT_QUESTIONS = Object.freeze([
    { skill: 'Nhận diện chữ', prompt: 'Chọn nguyên âm đọc gần “a”.', options: ['ㅏ','ㅓ','ㅗ'], answer: 'ㅏ' },
    { skill: 'Nhận diện chữ', prompt: 'Chọn phụ âm ㄱ.', options: ['ㄴ','ㄱ','ㅁ'], answer: 'ㄱ' },
    { skill: 'Ghép âm', prompt: 'ㄱ + ㅏ tạo thành âm tiết nào?', options: ['나','가','고'], answer: '가' },
    { skill: 'Ghép âm', prompt: 'ㅁ + ㅗ tạo thành âm tiết nào?', options: ['모','마','무'], answer: '모' },
    { skill: 'Đọc', prompt: 'Từ nào được ghép từ 나 + 라?', options: ['나라','나무','사람'], answer: '나라' },
    { skill: 'Đọc', prompt: '받침 nằm ở vị trí nào trong khối âm tiết?', options: ['trên cùng','bên ngoài','phía dưới'], answer: 'phía dưới' },
    { skill: 'Nghe', prompt: 'Nghe âm rồi chọn.', audio: 'ㅗ', options: ['ㅓ','ㅗ','ㅜ'], answer: 'ㅗ' },
    { skill: 'Nghe', prompt: 'Nghe âm rồi chọn.', audio: '가', options: ['나','가','다'], answer: '가' },
    { skill: 'Từ cơ bản', prompt: '나라 có nghĩa là gì?', options: ['đất nước','trường học','gia đình'], answer: 'đất nước' },
    { skill: 'Từ cơ bản', prompt: '학생 có nghĩa là gì?', options: ['giáo viên','học sinh','nhân viên'], answer: 'học sinh' }
  ]);
  const BEGINNER_PLACEMENT = Object.freeze([
    { prompt: 'Chọn chữ đọc gần “a”.', options: ['ㅏ','ㅓ','ㅗ'], answer: 0 },
    { prompt: 'ㄱ + ㅏ tạo thành chữ nào?', options: ['나','가','다'], answer: 1 },
    { prompt: '나라 có nghĩa là gì?', options: ['đất nước','con người','trường học'], answer: 0 },
    { prompt: '학생 có nghĩa là gì?', options: ['gia đình','học sinh','đồ ăn'], answer: 1 },
    { prompt: '저는 학생이에요. có nghĩa gần nhất là gì?', options: ['Tôi là học sinh.','Tôi đi học.','Đây là trường học.'], answer: 0 }
  ]);

  const runtime = {
    groupId: 'vowels', character: 'ㅏ', characterFeedback: null,
    syllableIndex: 0, syllableSelected: [], syllableHistory: [], syllableFeedback: null,
    readingStage: 0, minimalIndex: 0, minimalTargetIndex: 0, minimalFeedback: null,
    wordLimit: 50, wordGroup: 'all', sentenceSelected: [], sentenceFeedback: null,
    checkpointResult: null
  };

  function foundationProgress() {
    const progress = getUserProgress();
    const value = progress.foundation && typeof progress.foundation === 'object' ? progress.foundation : {};
    return {
      learnedCharacters: Array.isArray(value.learnedCharacters) ? value.learnedCharacters : [],
      completedActivities: Array.isArray(value.completedActivities) ? value.completedActivities : [],
      firstWords: Array.isArray(value.firstWords) ? value.firstWords : [],
      checkpoint: value.checkpoint && typeof value.checkpoint === 'object' ? value.checkpoint : null,
      updatedAt: value.updatedAt || null
    };
  }

  function saveFoundation(changes) {
    const progress = getUserProgress();
    progress.foundation = { ...foundationProgress(), ...changes, updatedAt: now() };
    saveUserProgress(progress);
    return progress.foundation;
  }

  function completeActivity(activityId) {
    const current = foundationProgress();
    saveFoundation({ completedActivities: uniq([...current.completedActivities, activityId]) });
    MasteryService?.updateLesson?.(`foundation-${activityId}`, 100, { completed: true, foundation: true });
  }

  function learnCharacter(character) {
    const current = foundationProgress();
    saveFoundation({ learnedCharacters: uniq([...current.learnedCharacters, character]) });
    MasteryService?.updateLesson?.(`foundation-character-${character}`, 100, { completed: true, foundation: true });
  }

  function recordHandwriting(character) {
    if (state.currentUser?.learningTrack !== 'foundation') return;
    completeActivity(`handwriting-${character}`);
  }

  function heading(eyebrow, title, subtitle, back = 'foundation') {
    return `<section class="section page-heading foundation-heading"><button class="back-link" data-view="${back}">← Nhập môn</button><p class="eyebrow">${eyebrow}</p><h1 class="headline">${title}</h1><p class="subtle">${subtitle}</p></section>`;
  }

  function roadmapStrip(active = 'level-0') {
    const steps = [['level-0','Level 0'],['topik-1','TOPIK 1'],['topik-2','TOPIK 2'],['topik-3','TOPIK 3'],['topik-more','TOPIK 4–6']];
    return `<div class="foundation-roadmap-strip" aria-label="Lộ trình học">${steps.map(([id, label], index) => `<span class="${id === active ? 'active' : ''}">${index ? '<i aria-hidden="true">→</i>' : ''}<b>${label}</b></span>`).join('')}</div>`;
  }

  function nextFoundationStep() {
    const progress = foundationProgress();
    const learned = new Set(progress.learnedCharacters);
    const completed = new Set(progress.completedActivities);
    if (state.currentUser?.foundationEntry === 'reading-first' && !completed.has('reading-first')) return { view: 'reading-first', eyebrow: 'Bài tiếp theo', title: 'Luyện đọc âm tiết đầu tiên', detail: 'Đọc từ ký tự đến từ hoàn chỉnh.' };
    if (state.currentUser?.foundationEntry === 'first-words' && progress.firstWords.length < 10) return { view: 'first-words', eyebrow: 'Bài tiếp theo', title: '50 từ đầu tiên', detail: 'Bắt đầu từ các chủ đề quen thuộc.' };
    if (!learned.has('ㅏ')) return { view: 'hangul-academy', char: 'ㅏ', eyebrow: 'Bài tiếp theo', title: 'Nguyên âm ㅏ', detail: 'Nghe, nhận diện và luyện viết chữ đầu tiên.' };
    if (!learned.has('ㄱ')) return { view: 'hangul-academy', char: 'ㄱ', eyebrow: 'Bài tiếp theo', title: 'Phụ âm ㄱ', detail: 'Học âm đầu để chuẩn bị ghép 가.' };
    if (!completed.has('syllable-ga')) return { view: 'syllable-builder', eyebrow: 'Bài tiếp theo', title: 'Ghép chữ 가', detail: 'Tự ghép ㄱ + ㅏ bằng chạm hoặc click.' };
    if (!completed.has('handwriting-가')) return { view: 'handwriting', char: '가', eyebrow: 'Bài tiếp theo', title: 'Viết chữ 가', detail: 'Luyện 3 lượt với hướng dẫn giảm dần.' };
    if (!completed.has('reading-first')) return { view: 'reading-first', eyebrow: 'Bài tiếp theo', title: 'Đọc từ 나라', detail: 'Ký tự → âm tiết → từ → nghĩa.' };
    if (!completed.has('first-sentence')) return { view: 'first-sentence', eyebrow: 'Bài tiếp theo', title: 'Câu tiếng Hàn đầu tiên', detail: 'Tự xếp 저는 학생이에요.' };
    return { view: 'beginner-checkpoint', eyebrow: 'Bước cuối Level 0', title: 'Checkpoint nhập môn', detail: 'Kiểm tra nhẹ, không khóa lộ trình.' };
  }

  function homeView() {
    const progress = foundationProgress();
    const next = nextFoundationStep();
    const count = progress.learnedCharacters.filter((char) => CORE_CHARACTERS.some((item) => item.char === char)).length;
    const pct = Math.round(count / CORE_CHARACTER_TOTAL * 100);
    return `<section class="foundation-home section">
      <div class="foundation-welcome"><div><p class="eyebrow">Level 0 · Nhập môn tiếng Hàn</p><h1 class="headline">Chào ${escapeHtml(firstName(state.currentUser?.fullName || ''))}</h1><p>Chậm, rõ và từng bước. Hôm nay chỉ cần hoàn thành một bài.</p></div><span class="foundation-level-badge">0</span></div>
      ${roadmapStrip()}
      <article class="foundation-next-card"><div><small>${next.eyebrow}</small><h2>${escapeHtml(next.title)}</h2><p>${escapeHtml(next.detail)}</p></div><button class="btn primary" data-foundation-next="${next.view}" data-character="${next.char || ''}">Học ngay</button></article>
      <div class="foundation-progress-card"><div class="section-heading"><div><small>Tiến độ Hangul</small><strong>${count}/${CORE_CHARACTER_TOTAL} ký tự</strong></div><b>${pct}%</b></div><div class="bar large"><span style="width:${pct}%"></span></div></div>
      <section class="foundation-home-actions"><button data-view="foundation"><span>가</span><b>Xem lộ trình nhập môn</b><small>8 chặng học thực hành</small></button><button data-view="first-words"><span>50</span><b>Từ đầu tiên</b><small>${progress.firstWords.length} từ đã chọn học</small></button></section>
    </section>`;
  }

  function foundationView() {
    const progress = foundationProgress();
    const learned = progress.learnedCharacters.length;
    const cards = [
      ['hangul-academy','01','Hangul Academy','Nguyên âm, phụ âm, âm ghép và âm đôi.', learned],
      ['syllable-builder','02','Ghép chữ Hangul','Tự ghép phụ âm và nguyên âm thành âm tiết.', progress.completedActivities.includes('syllable-ga') ? 1 : 0],
      ['reading-first','03','Đọc trước, hiểu sau','Ký tự → âm tiết → từ → nghĩa.', progress.completedActivities.includes('reading-first') ? 1 : 0],
      ['batchim-academy','04','Batchim Academy','Phụ âm cuối và nối âm cơ bản.', progress.completedActivities.filter((id) => id.startsWith('batchim-')).length],
      ['minimal-pairs','05','Luyện âm dễ nhầm','Nghe và phân biệt 5 nhóm âm.', progress.completedActivities.filter((id) => id.startsWith('minimal-')).length],
      ['first-words','06','50 / 100 từ đầu tiên','Học theo 6 chủ đề và đưa vào SRS.', progress.firstWords.length],
      ['first-sentence','07','Câu đầu tiên','Tự xếp và hiểu từng phần của câu.', progress.completedActivities.includes('first-sentence') ? 1 : 0],
      ['beginner-checkpoint','08','Checkpoint nhập môn','Kiểm tra mềm trước TOPIK 1.', progress.checkpoint ? progress.checkpoint.score : 0]
    ];
    return `${heading('Level 0', 'Nhập môn tiếng Hàn', 'Từ chưa biết Hangul đến sẵn sàng bắt đầu TOPIK 1.', 'home')}${roadmapStrip()}<section class="foundation-module-list section">${cards.map(([view, number, title, description, value]) => `<button class="foundation-module" data-view="${view}"><span class="foundation-module-number">${number}</span><span><b>${title}</b><small>${description}</small></span><em>${Number(value) ? 'Đang học' : 'Bắt đầu'} →</em></button>`).join('')}</section>`;
  }

  function roadmapView() {
    const progress = foundationProgress();
    const pct = Math.round(progress.learnedCharacters.length / CORE_CHARACTER_TOTAL * 100);
    return `${heading('Lộ trình học', 'Từ Level 0 đến TOPIK', 'Level 0 là bước chuẩn bị; TOPIK 1–6 hiện tại được giữ nguyên.', 'home')}${roadmapStrip()}<section class="card section foundation-roadmap-detail"><div class="foundation-roadmap-level current"><span>Hiện tại</span><h2>Level 0 · Nhập môn tiếng Hàn</h2><p>Đọc Hangul, ghép chữ, học 100 từ và viết câu đầu tiên.</p><div class="bar"><span style="width:${pct}%"></span></div><small>${progress.learnedCharacters.length}/${CORE_CHARACTER_TOTAL} ký tự · ${pct}%</small><button class="btn primary" data-view="foundation">Tiếp tục Level 0</button></div>${[1,2,3,4,5,6].map((level) => `<div class="foundation-roadmap-level upcoming"><span>Bước tiếp theo</span><h3>TOPIK ${level}</h3><p>Chương trình TOPIK hiện tại không thay đổi.</p></div>`).join('')}</section>`;
  }

  function hangulAcademyView() {
    const group = CHARACTER_GROUPS.find((item) => item.id === runtime.groupId) || CHARACTER_GROUPS[0];
    const detail = group.items.find((item) => item.char === runtime.character) || group.items[0];
    const progress = foundationProgress();
    const learned = new Set(progress.learnedCharacters);
    const alternatives = group.items.filter((item) => item.char !== detail.char).slice(0, 3).map((item) => item.char);
    const quizOptions = [detail.char, ...alternatives].sort((a, b) => a.codePointAt(0) % 3 - b.codePointAt(0) % 3);
    return `${heading('Bước 1', 'Hangul Academy', 'Học mặt chữ bằng nghe, nhận diện và luyện tay — không học thuộc lý thuyết suông.')}
      <div class="foundation-tabs section" role="tablist">${CHARACTER_GROUPS.map((item) => `<button class="${item.id === group.id ? 'active' : ''}" data-hangul-group="${item.id}">${item.short}</button>`).join('')}</div>
      <section class="hangul-layout section"><div class="hangul-character-grid" aria-label="${group.title}">${group.items.map((item) => `<button class="hangul-tile ${item.char === detail.char ? 'active' : ''} ${learned.has(item.char) ? 'learned' : ''}" data-hangul-character="${item.char}"><b lang="ko">${item.char}</b><small>${escapeHtml(item.sound)}</small></button>`).join('')}</div>
      <article class="card hangul-focus"><div class="hangul-focus-char" lang="ko">${detail.char}</div><div><p class="eyebrow">${group.title}</p><h2>Âm ${escapeHtml(detail.sound)}</h2><p>${escapeHtml(detail.pronunciation)}</p><p><b lang="ko">${detail.example}</b> · ${escapeHtml(detail.meaning)}</p></div><div class="hangul-actions"><button class="btn secondary" data-speak="${detail.char}">🔊 Nghe âm</button><button class="btn secondary" data-foundation-write="${detail.char}">✍ Luyện viết</button></div>
      <div class="recognition-quiz"><strong>Nhận diện: đâu là âm “${escapeHtml(detail.sound)}”?</strong><div>${quizOptions.map((option) => `<button data-character-answer="${option}" class="${runtime.characterFeedback?.answer === option ? (runtime.characterFeedback.correct ? 'correct' : 'wrong') : ''}">${option}</button>`).join('')}</div>${runtime.characterFeedback ? `<p class="${runtime.characterFeedback.correct ? 'success-text' : 'error-text'}">${runtime.characterFeedback.correct ? `Đúng! Đã lưu ${detail.char} vào tiến độ.` : `Chưa đúng. Hãy nhìn lại ${detail.char} và thử lần nữa.`}</p>` : ''}</div></article></section>`;
  }

  function syllableBuilderView() {
    const exercise = SYLLABLE_EXERCISES[runtime.syllableIndex % SYLLABLE_EXERCISES.length];
    const built = runtime.syllableFeedback?.correct ? exercise.answer : runtime.syllableSelected.join(' + ');
    return `${heading('Bước 2', 'Ghép chữ Hangul', 'Chạm trên mobile hoặc click trên desktop để tự tạo khối âm tiết.')}
      <section class="card section syllable-workbench"><div class="syllable-target"><small>Mục tiêu</small><strong lang="ko">${exercise.answer}</strong><button class="audio-btn" data-speak="${exercise.sound}" aria-label="Nghe ${exercise.answer}">🔊</button></div><p>${escapeHtml(exercise.hint)}</p>
      <div class="syllable-pieces">${exercise.pieces.map((piece, index) => `<button data-syllable-piece="${escapeHtml(piece)}" data-piece-index="${index}">${piece}</button>`).join('')}</div><div class="syllable-build-zone" aria-live="polite">${built || '<span>Chạm các mảnh theo đúng thứ tự</span>'}</div>
      <div class="action-row"><button class="btn secondary" data-syllable-undo ${runtime.syllableHistory.length ? '' : 'disabled'}>Hoàn tác</button><button class="btn secondary" data-syllable-reset>Đặt lại</button><button class="btn primary" data-syllable-check>Ghép chữ</button></div>
      ${runtime.syllableFeedback ? `<div class="foundation-feedback ${runtime.syllableFeedback.correct ? 'correct' : 'wrong'}"><b>${runtime.syllableFeedback.correct ? `Chính xác: ${exercise.pieces.join(' + ')} → ${exercise.answer}` : 'Thứ tự chưa đúng.'}</b><p>${runtime.syllableFeedback.correct ? 'Bạn đã tự tạo một âm tiết.' : 'Hoàn tác hoặc đặt lại rồi thử lại.'}</p>${runtime.syllableFeedback.correct ? `<button class="btn secondary" data-foundation-write="${exercise.answer}">✍ Viết ${exercise.answer}</button>` : ''}</div>` : ''}
      <div class="foundation-step-dots">${SYLLABLE_EXERCISES.map((_, index) => `<button class="${index === runtime.syllableIndex ? 'active' : ''}" data-syllable-index="${index}" aria-label="Bài ${index + 1}"></button>`).join('')}</div></section>`;
  }

  function readingFirstView() {
    const steps = [
      { label: 'Ký tự', ko: 'ㄴ + ㅏ', note: 'Nhận diện từng chữ trước.' },
      { label: 'Âm tiết', ko: '나 + 라', note: 'Đọc từng khối âm tiết.' },
      { label: 'Từ', ko: '나라', note: 'Nối hai âm tiết: na-ra.' },
      { label: 'Nghĩa', ko: '나라 = đất nước', note: 'Chỉ mở nghĩa sau khi đã đọc.' }
    ];
    return `${heading('Bước 3', 'Đọc trước, hiểu sau', 'Luồng học ưu tiên âm thanh và mặt chữ trước khi mở nghĩa.')}
      <section class="section reading-ladder">${steps.map((step, index) => `<article class="reading-step ${index <= runtime.readingStage ? 'visible' : 'locked'}"><span>${index + 1}</span><small>${step.label}</small><b lang="ko">${index <= runtime.readingStage ? step.ko : '•••'}</b><p>${index <= runtime.readingStage ? step.note : 'Hoàn thành bước trước để mở.'}</p>${index === runtime.readingStage && index < steps.length - 1 ? `<button class="btn primary" data-reading-next>Đã đọc, tiếp tục</button>` : ''}${index === runtime.readingStage && index === steps.length - 1 ? `<button class="btn primary" data-reading-complete>Hoàn thành bài đọc</button>` : ''}</article>`).join('')}</section><div class="section action-row"><button class="btn secondary" data-speak="나라">🔊 Nghe 나라</button><button class="btn secondary" data-reading-reset>Đọc lại từ đầu</button></div>`;
  }

  function batchimAcademyView() {
    const completed = new Set(foundationProgress().completedActivities);
    return `${heading('Bước 4', 'Batchim Academy', 'Chỉ học 받침 cơ bản và nối âm đơn giản; chưa đưa quy tắc nâng cao.')}
      <section class="foundation-stage-list section">${BATCHIM_STAGES.map((stage) => `<article class="card batchim-stage ${completed.has(stage.id) ? 'completed' : ''}"><div><small>${stage.label}</small><h2>${stage.title}</h2><p>${stage.body}</p></div><div class="batchim-examples">${stage.examples.map(([ko, sound]) => `<button data-speak="${ko}"><b lang="ko">${ko}</b><span>${sound}</span><em>🔊</em></button>`).join('')}</div><button class="btn ${completed.has(stage.id) ? 'secondary' : 'primary'}" data-batchim-complete="${stage.id}">${completed.has(stage.id) ? '✓ Đã học' : 'Tôi đã luyện xong'}</button></article>`).join('')}</section>`;
  }

  function minimalPairsView() {
    const pair = MINIMAL_PAIRS[runtime.minimalIndex % MINIMAL_PAIRS.length];
    const target = pair.targets[runtime.minimalTargetIndex % pair.targets.length];
    return `${heading('Bước 5', 'Luyện âm dễ nhầm', 'Nghe trước, chọn âm sau, rồi đọc feedback ngắn.')}
      <section class="card section minimal-pair-card"><div class="test-progress"><span>Nhóm ${runtime.minimalIndex + 1}/${MINIMAL_PAIRS.length}</span><span>${escapeHtml(pair.choices.join(' · '))}</span></div><button class="minimal-listen" data-speak="${target}"><span>🔊</span><b>Nghe âm</b><small>Có thể nghe lại nhiều lần</small></button><div class="minimal-options">${pair.choices.map((choice) => `<button data-minimal-answer="${choice}" class="${runtime.minimalFeedback?.answer === choice ? (runtime.minimalFeedback.correct ? 'correct' : 'wrong') : ''}">${choice}</button>`).join('')}</div>${runtime.minimalFeedback ? `<div class="foundation-feedback ${runtime.minimalFeedback.correct ? 'correct' : 'wrong'}"><b>${runtime.minimalFeedback.correct ? 'Bạn nghe đúng.' : `Đáp án là ${target}.`}</b><p>${pair.note}</p><button class="btn primary" data-minimal-next>Âm tiếp theo</button></div>` : '<p class="subtle">Chọn ký tự tương ứng với âm vừa nghe.</p>'}</section>`;
  }

  const WORD_GROUPS = Object.freeze([
    ['family','Gia đình'], ['school','Trường học'], ['numbers','Số'], ['housing','Đồ vật'], ['verbs','Hành động'], ['food','Ăn uống']
  ]);
  function firstWordBank() {
    const source = global.KLEARN_VOCABULARY || [];
    const buckets = WORD_GROUPS.map(([topic]) => source.filter((word) => word.topic === topic).slice(0, 20));
    const result = [];
    for (let index = 0; index < 20; index += 1) buckets.forEach((bucket) => { if (bucket[index] && result.length < 100) result.push(bucket[index]); });
    return result;
  }

  function firstWordsView() {
    const all = firstWordBank().slice(0, runtime.wordLimit);
    const words = runtime.wordGroup === 'all' ? all : all.filter((word) => word.topic === runtime.wordGroup);
    const learned = new Set(foundationProgress().firstWords);
    return `${heading('Bước 6', `${runtime.wordLimit} từ đầu tiên`, 'Học theo chủ đề quen thuộc. Mỗi từ chọn học sẽ được đưa vào SRS hiện tại.')}
      <div class="foundation-word-controls section"><div class="segmented"><button class="${runtime.wordLimit === 50 ? 'active' : ''}" data-word-limit="50">50 từ</button><button class="${runtime.wordLimit === 100 ? 'active' : ''}" data-word-limit="100">100 từ</button></div><label>Chủ đề<select id="foundationWordGroup"><option value="all">Tất cả</option>${WORD_GROUPS.map(([id, label]) => `<option value="${id}" ${runtime.wordGroup === id ? 'selected' : ''}>${label}</option>`).join('')}</select></label></div>
      <section class="first-word-grid section">${words.map((word) => `<article class="first-word-card ${learned.has(word.id) ? 'learned' : ''}"><button class="word-audio" data-speak="${escapeHtml(word.audioText || word.korean)}">🔊</button><b lang="ko">${escapeHtml(word.korean)}</b><small>${escapeHtml(word.romanization || '')}</small><p>${escapeHtml(word.meaningVi || '')}</p><button class="btn secondary" data-foundation-word="${word.id}">${learned.has(word.id) ? '✓ Đang học trong SRS' : 'Học từ này'}</button></article>`).join('')}</section>`;
  }

  function firstSentenceView() {
    const sentence = runtime.sentenceSelected.join('');
    return `${heading('Bước 7', 'Câu tiếng Hàn đầu tiên', 'Hiểu từng mảnh nhỏ, không đưa ngữ pháp phức tạp.')}
      <section class="section first-sentence-explain"><div class="sentence-model"><b lang="ko">저는 학생이에요.</b><button data-speak="저는 학생이에요">🔊 Nghe câu</button></div>${FIRST_SENTENCE_PARTS.map((part) => `<article><b lang="ko">${part.text}</b><span>${part.meaning}</span><p>${part.note}</p></article>`).join('')}</section>
      <section class="card section sentence-workbench"><h2>Tự xếp câu</h2><div class="sentence-build-zone">${sentence || '<span>Chạm từng mảnh theo đúng thứ tự</span>'}</div><div class="sentence-pieces">${[...FIRST_SENTENCE_PARTS].reverse().map((part) => `<button data-sentence-part="${part.text}" ${runtime.sentenceSelected.includes(part.text) ? 'disabled' : ''}>${part.text}</button>`).join('')}</div><div class="action-row"><button class="btn secondary" data-sentence-reset>Đặt lại</button><button class="btn primary" data-sentence-check>Kiểm tra</button></div>${runtime.sentenceFeedback ? `<div class="foundation-feedback ${runtime.sentenceFeedback.correct ? 'correct' : 'wrong'}"><b>${runtime.sentenceFeedback.correct ? 'Chính xác! 저는 학생이에요.' : 'Chưa đúng thứ tự.'}</b><p>${runtime.sentenceFeedback.correct ? 'Bạn vừa viết câu tiếng Hàn đầu tiên: “Tôi là học sinh.”' : 'Bắt đầu bằng 저, thêm 는, rồi 학생 và 이에요.'}</p></div>` : ''}</section>`;
  }

  function checkpointView() {
    const saved = foundationProgress().checkpoint;
    if (runtime.checkpointResult) {
      const result = runtime.checkpointResult;
      return `${heading('Checkpoint Level 0', 'Kết quả nhập môn', 'Điểm số chỉ dùng để gợi ý ôn tập, không khóa bất kỳ nội dung nào.')}
        <section class="card section checkpoint-result"><div class="checkpoint-score">${result.score}<small>/100</small></div><h2>${result.score >= 80 ? 'Bạn đã sẵn sàng học TOPIK 1' : 'Bạn đang tiến bộ đúng hướng'}</h2><p>${result.score >= 80 ? 'Bạn đã nhận diện, ghép và đọc được nền tảng cần thiết.' : `Nên ôn thêm: ${escapeHtml(result.weak.join(', ') || 'Hangul cơ bản')}. Bạn vẫn có thể bắt đầu TOPIK 1 bất cứ lúc nào.`}</p><div class="action-row"><button class="btn secondary" data-checkpoint-review>Ôn Level 0</button><button class="btn primary" data-start-topik-one>Bắt đầu TOPIK 1</button></div></section>`;
    }
    return `${heading('Bước 8', 'Checkpoint nhập môn', '10 câu ngắn: nhận diện chữ, ghép âm, đọc, nghe và từ cơ bản. Không hard lock.')}${saved ? `<p class="section checkpoint-last">Lần gần nhất: <b>${saved.score}/100</b></p>` : ''}
      <form id="beginnerCheckpointForm" class="section beginner-checkpoint-form">${CHECKPOINT_QUESTIONS.map((question, index) => `<fieldset class="card checkpoint-question"><legend><span>${index + 1}</span>${question.skill}</legend><h2>${question.prompt}</h2>${question.audio ? `<button type="button" class="audio-btn" data-speak="${question.audio}">🔊 Nghe</button>` : ''}<div class="answer-list">${question.options.map((option) => `<label class="answer-button"><input type="radio" name="q${index}" value="${escapeHtml(option)}" required><span>${escapeHtml(option)}</span></label>`).join('')}</div></fieldset>`).join('')}<button class="btn primary full" type="submit">Xem kết quả</button></form>`;
  }

  function beginnerPlacementView() {
    const placement = state.currentUser?.beginnerPlacement || { index: 0, answers: [], score: 0 };
    const index = Math.min(placement.index || 0, BEGINNER_PLACEMENT.length - 1);
    const question = BEGINNER_PLACEMENT[index];
    return `<section class="onboarding-page"><div class="onboarding-top"><span class="brand-lockup"><span class="brand-mini">TH</span><span class="brand-small">Tiếng Hàn - TamHoanq</span></span><span class="step-label">3 / 3 · Kiểm tra nhập môn</span></div><div class="bar onboarding-bar"><span style="width:${Math.round((index + 1) / BEGINNER_PLACEMENT.length * 100)}%"></span></div><div class="onboarding-copy"><h1 class="headline">Chọn điểm bắt đầu phù hợp</h1><p class="subtle">Chỉ có Hangul và từ cơ bản — đây không phải bài kiểm tra TOPIK.</p></div><div class="test-progress"><span>${index + 1}/${BEGINNER_PLACEMENT.length}</span><span>${placement.score || 0} điểm</span></div><section class="card question-card"><h2>${question.prompt}</h2><div class="answer-list">${question.options.map((option, answerIndex) => `<button class="answer-button" data-beginner-placement-answer="${answerIndex}"><span>${String.fromCharCode(65 + answerIndex)}</span>${option}</button>`).join('')}</div></section></section>`;
  }

  function answerBeginnerPlacement(answerIndex) {
    const placement = { ...(state.currentUser?.beginnerPlacement || { index: 0, answers: [], score: 0 }) };
    const question = BEGINNER_PLACEMENT[placement.index] || BEGINNER_PLACEMENT[0];
    placement.answers = [...(placement.answers || []), answerIndex];
    if (answerIndex === question.answer) placement.score = Number(placement.score || 0) + 1;
    placement.index = Number(placement.index || 0) + 1;
    if (placement.index >= BEGINNER_PLACEMENT.length) {
      const entry = placement.score <= 1 ? 'hangul-academy' : placement.score <= 3 ? 'reading-first' : 'first-words';
      const level = placement.score <= 1 ? 'Level 0' : placement.score <= 3 ? 'Beginner Reading' : 'Beginner Words';
      updateCurrentUser({ onboardingStep: 'result', level, learningTrack: 'foundation', foundationLevel: 0, foundationEntry: entry, beginnerPlacement: placement });
      state.selectedLevel = level;
      setView('onboarding-result');
      return;
    }
    updateCurrentUser({ onboardingStep: 'beginner-placement', beginnerPlacement: placement });
    render();
  }

  function addFirstWord(wordId) {
    const current = foundationProgress();
    const selected = uniq([...current.firstWords, wordId]);
    saveFoundation({ firstWords: selected });
    const entry = DictionaryService?.byId?.(wordId);
    if (entry) DictionaryService.addToSrs(entry, { source: 'foundation-first-word' });
    else {
      const cards = getUserSrs(); const stamp = new Date().toISOString();
      saveUserSrs(cards.map((card) => (card.wordId === wordId || card.id === wordId) ? { ...card, status: card.status === 'mastered' ? 'mastered' : 'learning', nextReview: stamp, activatedAt: card.activatedAt || stamp, foundationWord: true } : card));
      emitLearningMutation?.('vocabulary_updated', wordId, { action: 'activated', source: 'foundation-first-word' }, `vocabulary_updated:${state.currentUser.id}:${wordId}:${stamp}`);
      emitLearningMutation?.('srs_updated', wordId, { status: 'learning' }, `srs_updated:${state.currentUser.id}:${wordId}:${stamp}`);
    }
    toast('Đã thêm từ vào SRS.');
  }

  function bind() {
    document.querySelectorAll('[data-beginner-placement-answer]').forEach((button) => { button.onclick = () => answerBeginnerPlacement(Number(button.dataset.beginnerPlacementAnswer)); });
    document.querySelectorAll('[data-foundation-next]').forEach((button) => { button.onclick = () => { if (button.dataset.character) { runtime.character = button.dataset.character; runtime.groupId = CHARACTER_GROUPS.find((group) => group.items.some((item) => item.char === runtime.character))?.id || 'vowels'; state.handwritingCharacter = button.dataset.character; } if (button.dataset.foundationNext === 'handwriting') state.handwritingStage = 1; setView(button.dataset.foundationNext); }; });
    document.querySelectorAll('[data-hangul-group]').forEach((button) => { button.onclick = () => { runtime.groupId = button.dataset.hangulGroup; runtime.character = CHARACTER_GROUPS.find((group) => group.id === runtime.groupId)?.items[0]?.char || 'ㅏ'; runtime.characterFeedback = null; render(); }; });
    document.querySelectorAll('[data-hangul-character]').forEach((button) => { button.onclick = () => { runtime.character = button.dataset.hangulCharacter; runtime.characterFeedback = null; render(); }; });
    document.querySelectorAll('[data-character-answer]').forEach((button) => { button.onclick = () => { const correct = button.dataset.characterAnswer === runtime.character; runtime.characterFeedback = { answer: button.dataset.characterAnswer, correct }; if (correct) { learnCharacter(runtime.character); toast(`Đã học ${runtime.character}.`); } render(); }; });
    document.querySelectorAll('[data-foundation-write]').forEach((button) => { button.onclick = () => { state.handwritingCharacter = button.dataset.foundationWrite; state.handwritingStage = 1; setView('handwriting'); }; });
    document.querySelectorAll('[data-syllable-piece]').forEach((button) => { button.onclick = () => { runtime.syllableHistory.push([...runtime.syllableSelected]); runtime.syllableSelected.push(button.dataset.syllablePiece); runtime.syllableFeedback = null; render(); }; });
    document.querySelector('[data-syllable-undo]')?.addEventListener('click', () => { runtime.syllableSelected = runtime.syllableHistory.pop() || []; runtime.syllableFeedback = null; render(); });
    document.querySelector('[data-syllable-reset]')?.addEventListener('click', () => { runtime.syllableSelected = []; runtime.syllableHistory = []; runtime.syllableFeedback = null; render(); });
    document.querySelector('[data-syllable-check]')?.addEventListener('click', () => { const exercise = SYLLABLE_EXERCISES[runtime.syllableIndex % SYLLABLE_EXERCISES.length]; const correct = runtime.syllableSelected.join('') === exercise.pieces.join(''); runtime.syllableFeedback = { correct }; if (correct) completeActivity(`syllable-${exercise.id}`); render(); });
    document.querySelectorAll('[data-syllable-index]').forEach((button) => { button.onclick = () => { runtime.syllableIndex = Number(button.dataset.syllableIndex); runtime.syllableSelected = []; runtime.syllableHistory = []; runtime.syllableFeedback = null; render(); }; });
    document.querySelector('[data-reading-next]')?.addEventListener('click', () => { runtime.readingStage = Math.min(3, runtime.readingStage + 1); render(); });
    document.querySelector('[data-reading-reset]')?.addEventListener('click', () => { runtime.readingStage = 0; render(); });
    document.querySelector('[data-reading-complete]')?.addEventListener('click', () => { completeActivity('reading-first'); toast('Đã hoàn thành bài đọc đầu tiên.'); setView('foundation'); });
    document.querySelectorAll('[data-batchim-complete]').forEach((button) => { button.onclick = () => { completeActivity(button.dataset.batchimComplete); toast('Đã lưu tiến độ Batchim.'); render(); }; });
    document.querySelectorAll('[data-minimal-answer]').forEach((button) => { button.onclick = () => { const pair = MINIMAL_PAIRS[runtime.minimalIndex % MINIMAL_PAIRS.length]; const target = pair.targets[runtime.minimalTargetIndex % pair.targets.length]; const correct = button.dataset.minimalAnswer === target; runtime.minimalFeedback = { answer: button.dataset.minimalAnswer, correct }; if (correct) completeActivity(`minimal-${pair.id}`); render(); }; });
    document.querySelector('[data-minimal-next]')?.addEventListener('click', () => { const pair = MINIMAL_PAIRS[runtime.minimalIndex % MINIMAL_PAIRS.length]; runtime.minimalTargetIndex += 1; if (runtime.minimalTargetIndex >= pair.targets.length) { runtime.minimalTargetIndex = 0; runtime.minimalIndex = (runtime.minimalIndex + 1) % MINIMAL_PAIRS.length; } runtime.minimalFeedback = null; render(); });
    document.querySelectorAll('[data-word-limit]').forEach((button) => { button.onclick = () => { runtime.wordLimit = Number(button.dataset.wordLimit) || 50; render(); }; });
    const wordGroup = document.getElementById('foundationWordGroup'); if (wordGroup) wordGroup.onchange = () => { runtime.wordGroup = wordGroup.value; render(); };
    document.querySelectorAll('[data-foundation-word]').forEach((button) => { button.onclick = () => { addFirstWord(button.dataset.foundationWord); render(); }; });
    document.querySelectorAll('[data-sentence-part]').forEach((button) => { button.onclick = () => { runtime.sentenceSelected.push(button.dataset.sentencePart); runtime.sentenceFeedback = null; render(); }; });
    document.querySelector('[data-sentence-reset]')?.addEventListener('click', () => { runtime.sentenceSelected = []; runtime.sentenceFeedback = null; render(); });
    document.querySelector('[data-sentence-check]')?.addEventListener('click', () => { const correct = runtime.sentenceSelected.join('') === '저는학생이에요'; runtime.sentenceFeedback = { correct }; if (correct) completeActivity('first-sentence'); render(); });
    const checkpointForm = document.getElementById('beginnerCheckpointForm'); if (checkpointForm) checkpointForm.onsubmit = (event) => { event.preventDefault(); const form = new FormData(checkpointForm); let correct = 0; const skills = {}; CHECKPOINT_QUESTIONS.forEach((question, index) => { const ok = form.get(`q${index}`) === question.answer; correct += ok ? 1 : 0; if (!skills[question.skill]) skills[question.skill] = { correct: 0, total: 0 }; skills[question.skill].total += 1; skills[question.skill].correct += ok ? 1 : 0; }); const score = correct * 10; const weak = Object.entries(skills).filter(([, value]) => value.correct / value.total < .8).map(([skill]) => skill); const result = { score, correct, total: CHECKPOINT_QUESTIONS.length, weak, completedAt: now(), readyForTopik1: score >= 80 }; saveFoundation({ checkpoint: result }); runtime.checkpointResult = result; render(); };
    document.querySelector('[data-checkpoint-review]')?.addEventListener('click', () => { runtime.checkpointResult = null; setView('foundation'); });
    document.querySelector('[data-start-topik-one]')?.addEventListener('click', () => { updateCurrentUser({ learningTrack: 'topik', foundationCompleted: true, level: 'TOPIK I', currentTopikLevel: 1, targetTopikLevel: 1 }); toast('Đã chuyển sang lộ trình TOPIK 1.'); setView('lessons'); });
  }

  const previousAfterRender = global.KLEARN_AFTER_RENDER;
  global.KLEARN_AFTER_RENDER = () => { previousAfterRender?.(); bind(); };
  global.BeginnerFoundation = { homeView, roadmapView, learningView: foundationView, recordHandwriting, progress: foundationProgress };
  global.KLEARN_EXTRA_VIEWS = {
    ...(global.KLEARN_EXTRA_VIEWS || {}),
    foundation: foundationView,
    'hangul-academy': hangulAcademyView,
    'syllable-builder': syllableBuilderView,
    'reading-first': readingFirstView,
    'batchim-academy': batchimAcademyView,
    'minimal-pairs': minimalPairsView,
    'first-words': firstWordsView,
    'first-sentence': firstSentenceView,
    'beginner-checkpoint': checkpointView,
    'beginner-placement': beginnerPlacementView
  };
  const handwriting = global.KLEARN_HANDWRITING?.characters;
  if (Array.isArray(handwriting)) CHARACTER_GROUPS.find((group) => group.id === 'syllables').items.forEach((item) => { if (!handwriting.includes(item.char)) handwriting.push(item.char); });
  render();
})(window);
