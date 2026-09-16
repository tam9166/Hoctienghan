/* Tiếng Hàn - TamHoanq · P75 Content Intelligence Platform */
(function buildContentIntelligencePlatform(global) {
  'use strict';
  const app = global.KLEARN_APP;
  if (!app) return;

  const { state, storage, STORAGE_KEYS, getUserProgress, getUserSrs, PracticeService, LearnerProfileService, AccessControlService, render, setView, toast, escapeHtml } = app;
  const STORE_KEY = STORAGE_KEYS.contentIntelligence || 'klearn_content_intelligence';
  const routes = new Set(['content-intelligence', 'content-operations', 'content-performance', 'content-gaps', 'content-pack-manager']);
  const runtime = state.contentIntelligence || (state.contentIntelligence = { config: null, loading: null, entities: [], selectedId: '', error: '' });
  const now = () => new Date().toISOString();
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const clean = (value, limit = 1200) => String(value == null ? '' : value).normalize('NFC').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit);
  const clamp = (value) => Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  const localize = (value) => typeof value === 'string' ? value : value?.vi || value?.en || value?.['zh-CN'] || '';
  const safeObject = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const difficultyFromLevel = (value) => { const text = clean(value, 40).toLowerCase(); if (/foundation|topik[_ ]?0|beginner/.test(text)) return 'Beginner'; if (/topik[_ ]?1|elementary/.test(text)) return 'Elementary'; if (/topik[_ ]?[23]|intermediate/.test(text)) return 'Intermediate'; return /topik[_ ]?[4-6]|advanced/.test(text) ? 'Advanced' : 'Elementary'; };
  const levelFromValue = (value) => { const text = clean(value, 40); const match = text.match(/TOPIK[_ ]?([0-6])/i); if (match) return Number(match[1]) === 0 ? 'Foundation' : `TOPIK ${match[1]}`; if (/foundation|beginner/i.test(text)) return 'Foundation'; if (/elementary/i.test(text)) return 'TOPIK 1'; if (/intermediate/i.test(text)) return 'TOPIK 2'; if (/advanced/i.test(text)) return 'TOPIK 4'; return 'TOPIK 1'; };
  const contentText = (item) => clean([localize(item.title), localize(item.summary), item.korean, localize(item.meaning), JSON.stringify(item.body || {})].join(' '), 12000);

  const ContentIntelligenceConfigService = {
    hydrate(value) {
      const valid = value?.schemaVersion === 1 && value.status === 'approved' && value.verified === true && Array.isArray(value.entitySchema?.types) && Array.isArray(value.workflow?.statuses) && Array.isArray(value.seedEntities) && Array.isArray(value.packs);
      if (!valid) throw new Error('P75 content intelligence quality gate failed');
      runtime.config = Object.freeze(value); runtime.error = ''; return runtime.config;
    },
    load() {
      if (runtime.config) return Promise.resolve(runtime.config);
      if (runtime.loading) return runtime.loading;
      if (typeof global.fetch !== 'function') return Promise.resolve(null);
      runtime.loading = global.fetch('./content/content-intelligence-platform.json', { cache: 'default' }).then((response) => { if (!response.ok) throw new Error(`Content intelligence ${response.status}`); return response.json(); }).then((value) => this.hydrate(value)).then(() => ContentEntityRegistryService.refresh()).catch((error) => { runtime.error = clean(error.message); toast?.('Không thể tải Content Intelligence.'); return null; }).finally(() => { runtime.loading = null; if (routes.has(state.currentView)) render(); });
      return runtime.loading;
    },
    get: () => runtime.config
  };

  function normalizeEntity(item = {}, source = 'legacy') {
    const types = runtime.config?.entitySchema?.types || ['lesson', 'vocabulary', 'grammar', 'listening', 'reading', 'writing', 'speaking', 'culture', 'story'];
    const aliases = { word: 'vocabulary', audio: 'listening', example: 'grammar', quiz: 'lesson', exercise: 'lesson' };
    const rawType = aliases[item.type] || item.type || 'lesson'; const type = types.includes(rawType) ? rawType : 'lesson';
    const statusAliases = { review: 'human_review', in_review: 'human_review', deprecated: 'archived' };
    const status = statusAliases[item.review_status || item.reviewStatus || item.status] || item.review_status || item.reviewStatus || item.status || 'draft';
    const id = clean(item.id || `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, 160);
    const level = levelFromValue(item.level || item.difficulty);
    return Object.freeze({
      id, type, title: clean(localize(item.title) || item.korean || id, 240), level,
      topic: clean(item.topic || item.context || item.tags?.[0] || 'general', 120),
      skill: clean(item.skill || ({ vocabulary: 'vocabulary', grammar: 'grammar', listening: 'listening', reading: 'reading', writing: 'writing', speaking: 'speaking', culture: 'culture', story: 'reading' })[type] || 'general', 60),
      difficulty: ['Beginner', 'Elementary', 'Intermediate', 'Advanced'].includes(item.difficulty) ? item.difficulty : difficultyFromLevel(item.difficulty || level),
      author: clean(item.author || item.createdBy?.displayName || item.source || 'TamHoanq curriculum', 160),
      review_status: (runtime.config?.workflow?.statuses || []).includes(status) ? status : 'draft',
      version: Math.max(1, Number(item.version) || 1), created_at: item.created_at || item.createdAt || now(), updated_at: item.updated_at || item.updatedAt || now(),
      source_id: clean(item.source_id || item.sourceId || id, 160), source, summary: clean(localize(item.summary) || localize(item.meaning), 1000),
      body: clone(safeObject(item.body)), audio_url: clean(item.audio_url || item.audioUrl, 500), quality: clone(safeObject(item.quality)), verified: item.verified === true || status === 'approved' || status === 'published'
    });
  }

  const ContentEntityRegistryService = {
    collectLegacy() {
      const rows = [];
      (global.KLEARN_THEORY_LESSONS || []).forEach((item) => rows.push(normalizeEntity({ ...item, type: 'lesson', review_status: 'published' }, 'theory-lessons')));
      (global.KLEARN_VOCABULARY || []).forEach((item) => rows.push(normalizeEntity({ ...item, type: 'vocabulary', review_status: 'published' }, 'vocabulary-bank')));
      (global.AdvancedContentService?.raw?.() || []).forEach((item) => rows.push(normalizeEntity(item, 'advanced-content-platform')));
      (runtime.config?.seedEntities || []).forEach((item) => rows.push(normalizeEntity(item, 'p75-registry')));
      return rows;
    },
    async refresh() {
      await global.AdvancedContentService?.load?.().catch?.(() => null);
      const rows = this.collectLegacy();
      if (global.ContentRepository?.list) {
        try { const result = await global.ContentRepository.list({ page: 1, pageSize: 1000 }); (result.items || []).forEach((item) => rows.push(normalizeEntity(item, 'content-repository'))); } catch (_) { /* Offline registry remains usable. */ }
      }
      const priority = { 'p75-registry': 1, 'theory-lessons': 2, 'vocabulary-bank': 2, 'advanced-content-platform': 3, 'content-repository': 4 };
      const byId = new Map(); rows.forEach((item) => { const current = byId.get(item.id); if (!current || (priority[item.source] || 0) >= (priority[current.source] || 0)) byId.set(item.id, item); });
      runtime.entities = [...byId.values()].sort((a, b) => a.type.localeCompare(b.type) || a.title.localeCompare(b.title)); return this.all();
    },
    all() { if (!runtime.entities.length && runtime.config) runtime.entities = this.collectLegacy(); return runtime.entities.slice(); },
    byId(id) { const item = this.all().find((entry) => entry.id === id); return item ? clone(item) : ContentWorkspaceService.current(id); },
    validate(item) { const normalized = normalizeEntity(item, item.source || 'authoring-workspace'); const missing = (runtime.config?.entitySchema?.required || []).filter((key) => normalized[key] == null || normalized[key] === ''); return { valid: missing.length === 0, missing, entity: normalized }; },
    migrationAudit() { const all = this.all(); const required = runtime.config?.entitySchema?.required || []; return { total: all.length, types: Object.fromEntries((runtime.config?.entitySchema?.types || []).map((type) => [type, all.filter((item) => item.type === type).length])), invalid: all.filter((item) => required.some((key) => item[key] == null || item[key] === '')).map((item) => item.id), preservesIds: all.every((item) => item.id === item.source_id), mutatesLearningData: false }; }
  };

  const ContentPermissionService = {
    role() { return AccessControlService?.role?.() || 'student'; },
    scopes() { const metadata = global.SupabaseService?.session?.user?.app_metadata || state.currentUser?.app_metadata || {}; return Array.isArray(metadata.content_scopes) ? metadata.content_scopes : ['*']; },
    inScope(entity) { const scopes = this.scopes(); return scopes.includes('*') || scopes.includes(entity?.type) || scopes.includes(entity?.topic); },
    canCreate(type = 'lesson') { return ['content_creator', 'content_editor', 'admin', 'super_admin'].includes(this.role()) && this.inScope({ type }); },
    canEdit(entity) { return ['content_creator', 'content_editor', 'admin', 'super_admin'].includes(this.role()) && this.inScope(entity); },
    canReview(entity) { return ['teacher', 'reviewer', 'content_editor', 'admin', 'super_admin'].includes(this.role()) && this.inScope(entity); },
    canApprove(entity) { return ['reviewer', 'content_editor', 'admin', 'super_admin'].includes(this.role()) && this.inScope(entity); },
    canPublish(entity) { return ['admin', 'super_admin'].includes(this.role()) && this.inScope(entity); },
    assert(action, entity = {}) { const allowed = ({ create: this.canCreate(entity.type), edit: this.canEdit(entity), review: this.canReview(entity), approve: this.canApprove(entity), publish: this.canPublish(entity), archive: this.canPublish(entity) })[action] === true; if (!allowed) throw new Error(`Bạn không có quyền ${action} nội dung này.`); return true; }
  };

  const ContentWorkspaceService = {
    read() { const value = storage.get(STORE_KEY, { schemaVersion: 1, records: [] }); return value && Array.isArray(value.records) ? value : { schemaVersion: 1, records: [] }; },
    write(value) { const payload = { schemaVersion: 1, records: (value.records || []).slice(0, 1000), updatedAt: now(), authoritative: false }; storage.set(STORE_KEY, payload); return payload; },
    all() { return this.read().records.map(clone); },
    current(id) { const record = this.all().find((item) => item.id === id); return record ? clone(record.current) : null; },
    history(id) { const record = this.all().find((item) => item.id === id); return (record?.versions || []).map(clone).sort((a, b) => b.version - a.version); },
    create(input) { ContentPermissionService.assert('create', input); const check = ContentEntityRegistryService.validate({ ...input, review_status: 'draft', version: 1, created_at: now(), updated_at: now(), source: 'authoring-workspace' }); if (!check.valid) throw new Error(`Thiếu trường: ${check.missing.join(', ')}`); if (this.current(check.entity.id) || ContentEntityRegistryService.all().some((item) => item.id === check.entity.id)) throw new Error('Content ID đã tồn tại.'); const record = { id: check.entity.id, current: clone(check.entity), versions: [{ version: 1, snapshot: clone(check.entity), change: 'Created', createdAt: now(), actorRole: ContentPermissionService.role() }], workflow: [{ from: null, to: 'draft', at: now(), actorRole: ContentPermissionService.role() }] }; this.write({ ...this.read(), records: [record, ...this.all()] }); return clone(record.current); },
    revise(id, changes = {}, change = 'Updated content') {
      const existing = this.current(id) || ContentEntityRegistryService.byId(id); if (!existing) throw new Error('Không tìm thấy content.'); ContentPermissionService.assert('edit', existing);
      const immutable = new Set(['id', 'created_at', 'source_id']); const safeChanges = Object.fromEntries(Object.entries(changes).filter(([key]) => !immutable.has(key)));
      const next = normalizeEntity({ ...existing, ...safeChanges, id: existing.id, source_id: existing.source_id, created_at: existing.created_at, updated_at: now(), version: Number(existing.version || 1) + 1, review_status: 'draft' }, 'authoring-workspace');
      const store = this.read(); const prior = store.records.find((item) => item.id === id); const versions = [...(prior?.versions || [{ version: existing.version, snapshot: clone(existing), change: 'Imported immutable baseline', createdAt: existing.updated_at, actorRole: 'migration' }]), { version: next.version, snapshot: clone(next), change: clean(change, 300), createdAt: now(), actorRole: ContentPermissionService.role() }];
      const record = { id, current: clone(next), versions, workflow: [...(prior?.workflow || []), { from: existing.review_status, to: 'draft', at: now(), actorRole: ContentPermissionService.role(), reason: 'new-version' }] };
      this.write({ ...store, records: [record, ...store.records.filter((item) => item.id !== id)] }); return clone(next);
    },
    transition(id, target, note = '') {
      const entity = this.current(id) || ContentEntityRegistryService.byId(id); if (!entity) throw new Error('Không tìm thấy content.'); const transitions = runtime.config?.workflow?.transitions?.[entity.review_status] || []; if (!transitions.includes(target)) throw new Error(`Không thể chuyển ${entity.review_status} → ${target}.`);
      if (target === 'ai_review') ContentPermissionService.assert('edit', entity); else if (target === 'human_review') ContentPermissionService.assert('review', entity); else if (target === 'approved') ContentPermissionService.assert('approve', entity); else if (target === 'published') ContentPermissionService.assert('publish', entity); else if (target === 'archived') ContentPermissionService.assert('archive', entity); else ContentPermissionService.assert('edit', entity);
      if (target === 'published' && entity.review_status !== 'approved') throw new Error('Chỉ content đã human-approved mới được publish.');
      const store = this.read(); const prior = store.records.find((item) => item.id === id) || { id, current: clone(entity), versions: [{ version: entity.version, snapshot: clone(entity), change: 'Imported immutable baseline', createdAt: entity.updated_at, actorRole: 'migration' }], workflow: [] };
      const current = { ...clone(entity), review_status: target, updated_at: now(), human_approved: target === 'approved' || target === 'published' ? true : entity.human_approved === true };
      const record = { ...prior, current, workflow: [...prior.workflow, { from: entity.review_status, to: target, note: clean(note, 500), at: now(), actorRole: ContentPermissionService.role() }] };
      this.write({ ...store, records: [record, ...store.records.filter((item) => item.id !== id)] }); return clone(current);
    }
  };

  const ContentDifficultyEngine = {
    assess(entity) {
      const text = contentText(entity); const sentences = text.split(/[.!?。！？]+/).filter(Boolean); const avgLength = sentences.length ? sentences.reduce((sum, value) => sum + value.length, 0) / sentences.length : text.length; const grammarComplexity = (text.match(/(지만|는데|으면서|더라도|도록|거든|ㄹ수록|기 때문에)/g) || []).length; const topik = Number((entity.level || '').match(/\d/)?.[0] || 0); const score = clamp(12 + topik * 12 + Math.min(28, avgLength / 2) + Math.min(24, grammarComplexity * 8)); const predicted = score < 28 ? 'Beginner' : score < 50 ? 'Elementary' : score < 73 ? 'Intermediate' : 'Advanced'; return { score, predicted, declared: entity.difficulty, fit: predicted === entity.difficulty, signals: { averageSentenceLength: Math.round(avgLength), grammarComplexity, topikLevel: topik }, confidence: text.length >= 80 ? 82 : 56, advisoryOnly: true };
    }
  };

  const ContentPerformanceService = {
    evidence(entity) {
      const history = PracticeService?.getHistory?.() || []; const matches = history.filter((item) => [item.contentId, item.lessonId, item.setId, item.sourceId].filter(Boolean).includes(entity.id) || item.contentIds?.includes?.(entity.id));
      const progress = getUserProgress?.() || {}; const lesson = progress.lessonProgress?.[entity.id]; const researchEvents = global.UserResearchService?.all?.()?.events || [];
      const views = researchEvents.filter((item) => ['content_viewed', 'lesson_started'].includes(item.event) && (item.properties?.contentId === entity.id || item.properties?.lessonId === entity.id)).length;
      const started = views + (lesson ? 1 : 0) + matches.length; const completed = matches.filter((item) => item.completedAt || item.status === 'completed').length + (lesson?.completed ? 1 : 0); const scores = matches.map((item) => Number(item.percentage ?? item.score)).filter(Number.isFinite);
      const errors = matches.flatMap((item) => item.wrongQuestionIds || item.errors || []).map(String); const commonErrors = Object.entries(errors.reduce((map, id) => ({ ...map, [id]: (map[id] || 0) + 1 }), {})).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, count]) => ({ id, count }));
      const srs = (getUserSrs?.() || state.srsData || []).filter((card) => [card.contentId, card.lessonId, card.sourceId, card.wordId, card.id].includes(entity.id));
      return { contentId: entity.id, views, started, completed, completionRate: started ? Math.round(completed / started * 100) : null, dropRate: started ? Math.max(0, 100 - Math.round(completed / started * 100)) : null, averageScore: scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : null, commonErrors, reviewFrequency: srs.reduce((sum, card) => sum + Number(card.reviewCount || 0), 0), sampleSize: Math.max(started, matches.length, srs.length), status: Math.max(started, matches.length, srs.length) ? 'measured' : 'collecting' };
    },
    all(limit = Infinity) { return ContentEntityRegistryService.all().slice(0, Number.isFinite(limit) ? limit : undefined).map((entity) => ({ entity, performance: this.evidence(entity) })); },
    weak(limit = 200) { return this.all(limit).filter(({ performance }) => performance.sampleSize > 0 && ((performance.completionRate != null && performance.completionRate < 60) || (performance.averageScore != null && performance.averageScore < 60))).sort((a, b) => (a.performance.averageScore ?? 101) - (b.performance.averageScore ?? 101)); }
  };

  const ContentLearningEffectivenessService = {
    measure(entity) {
      const external = global.ContentEffectivenessService?.summary?.(entity.id) || null; const cards = (getUserSrs?.() || state.srsData || []).filter((card) => [card.contentId, card.lessonId, card.sourceId, card.wordId, card.id].includes(entity.id)); const nowMs = Date.now();
      const recalled = (days) => { const eligible = cards.filter((card) => nowMs - new Date(card.lastReviewed || card.updatedAt || card.createdAt || 0).getTime() >= days * 86400000); if (!eligible.length) return { value: null, sampleSize: 0 }; const good = eligible.filter((card) => Number(card.mastery || 0) >= 60 || Number(card.correctCount || 0) > Number(card.wrongCount || 0)).length; return { value: Math.round(good / eligible.length * 100), sampleSize: eligible.length }; };
      const r7 = recalled(7); const r30 = recalled(30); const score = external?.retention ?? r30.value ?? r7.value;
      return { contentId: entity.id, status: score == null ? 'collecting' : 'measured', remembered: external?.remembered || 0, used: external?.used || 0, improved: external?.improved || 0, retention7: r7.value, retention30: r30.value, learningEffectiveness: score == null ? null : clamp(score), sampleSize: Math.max(external?.sampleSize || 0, r7.sampleSize, r30.sampleSize), sources: ['SRS', 'Mastery evidence', 'Adaptive learning events'] };
    }
  };

  const ContentQualityIntelligenceService = {
    score(entity) {
      const legacy = safeObject(entity.quality); const verified = global.VerifiedContentService?.score?.(entity.id); const difficulty = ContentDifficultyEngine.assess(entity); const effectiveness = ContentLearningEffectivenessService.measure(entity);
      const dimensions = {
        accuracy: Number.isFinite(Number(legacy.accuracy ?? legacy.grammarAccuracy ?? verified?.dimensions?.accuracy)) ? clamp(legacy.accuracy ?? legacy.grammarAccuracy ?? verified.dimensions.accuracy) : (entity.verified ? 90 : null),
        naturalness: Number.isFinite(Number(legacy.naturalness ?? legacy.exampleQuality ?? verified?.dimensions?.naturalness)) ? clamp(legacy.naturalness ?? legacy.exampleQuality ?? verified.dimensions.naturalness) : null,
        difficultyFit: difficulty.fit ? Math.max(75, difficulty.confidence) : Math.max(35, 100 - Math.abs(difficulty.score - ({ Beginner: 20, Elementary: 40, Intermediate: 65, Advanced: 85 })[entity.difficulty])),
        exampleQuality: Number.isFinite(Number(legacy.exampleQuality)) ? clamp(legacy.exampleQuality) : null,
        audioQuality: entity.type === 'listening' || entity.audio_url ? (Number.isFinite(Number(legacy.audioQuality)) ? clamp(legacy.audioQuality) : null) : null,
        learningEffectiveness: effectiveness.learningEffectiveness
      };
      const weights = runtime.config?.qualityModel?.weights || {}; const measured = Object.entries(dimensions).filter(([, value]) => value != null); const weight = measured.reduce((sum, [key]) => sum + Number(weights[key] || 0), 0); const score = weight ? Math.round(measured.reduce((sum, [key, value]) => sum + value * Number(weights[key] || 0), 0) / weight) : null;
      return { contentId: entity.id, score, dimensions, evidenceCoverage: Math.round(measured.length / Object.keys(dimensions).length * 100), status: score == null ? 'collecting' : score >= Number(runtime.config?.qualityModel?.publishThreshold || 80) && measured.length >= 4 ? 'ready' : 'needs-review', effectiveness, rule: 'Missing evidence is excluded, never replaced with a fabricated score.' };
    },
    checklist(type) { return [...(runtime.config?.reviewChecklists?.[type] || [])]; }
  };

  const AIContentIntelligenceAssistant = {
    review(entity) {
      ContentPermissionService.assert('edit', entity); const difficulty = ContentDifficultyEngine.assess(entity); const quality = ContentQualityIntelligenceService.score(entity); const issues = [];
      if (!difficulty.fit) issues.push(`Độ khó khai báo ${entity.difficulty}, hệ thống gợi ý ${difficulty.predicted}.`); if (quality.dimensions.naturalness == null) issues.push('Chưa có bằng chứng human review về độ tự nhiên.'); if ((entity.type === 'listening' || entity.audio_url) && quality.dimensions.audioQuality == null) issues.push('Chưa có bằng chứng kiểm tra audio.'); if (contentText(entity).length < 40) issues.push('Nội dung quá ngắn để đánh giá chắc chắn.');
      const confidence = clamp((difficulty.confidence + quality.evidenceCoverage) / 2); return { contentId: entity.id, confidence, issues, suggestions: issues.length ? ['Bổ sung bằng chứng và gửi Human Review.', 'Kiểm tra ví dụ với reviewer đủ quyền.'] : ['Có thể gửi Human Review.'], advisoryOnly: true, sourceOfTruth: false, canPublish: false, nextStatus: 'human_review' };
    },
    publish() { throw new Error('AI Content Assistant không được phép publish.'); }
  };

  const ContentRecommendationIntelligenceService = {
    recommend(limit = 5) {
      const profile = LearnerProfileService?.get?.() || {}; const weakness = profile.weakSkills?.[0] || Object.entries(profile.skillScores || {}).sort((a, b) => Number(a[1]) - Number(b[1]))[0]?.[0] || 'listening'; const userLevel = Number(state.currentUser?.currentTopikLevel || 0); const candidates = ContentEntityRegistryService.all().filter((item) => ['approved', 'published'].includes(item.review_status) && Number((item.level.match(/\d/) || [0])[0]) <= Math.max(1, userLevel + 1)).sort((a, b) => Number(b.skill === weakness) - Number(a.skill === weakness)).slice(0, 40);
      return candidates.map((entity) => { const quality = ContentQualityIntelligenceService.score(entity); const performance = ContentPerformanceService.evidence(entity); const effectiveness = quality.effectiveness; const skillMatch = entity.skill === weakness ? 30 : 0; const score = (quality.score ?? 50) * .5 + skillMatch + (effectiveness.learningEffectiveness ?? 50) * .2; let reason = entity.skill === weakness ? `Củng cố kỹ năng ${weakness} đang yếu.` : 'Phù hợp level và đã qua quality gate.'; if (effectiveness.sampleSize >= Number(runtime.config?.privacy?.minimumCohortSize || 20) && effectiveness.learningEffectiveness != null) reason += ` Dữ liệu tổng hợp ${effectiveness.sampleSize} lượt cho thấy retention ${effectiveness.learningEffectiveness}%.`; else reason += ' Chưa đủ cohort để đưa ra tuyên bố cải thiện theo nhóm.'; return { entity, score: Math.round(score), reason, evidence: { quality: quality.score, effectiveness: effectiveness.learningEffectiveness, sampleSize: effectiveness.sampleSize, completionRate: performance.completionRate } }; }).sort((a, b) => b.score - a.score).slice(0, limit);
    }
  };

  const ContentGapAnalysisService = {
    analyze() { const all = ContentEntityRegistryService.all().filter((item) => ['approved', 'published'].includes(item.review_status)); const results = []; Object.entries(runtime.config?.gapTargets || {}).forEach(([level, targets]) => Object.entries(targets).forEach(([type, expected]) => { const current = all.filter((item) => item.level === level && item.type === type).length; results.push({ level, type, expected, current, gap: Math.max(0, Number(expected) - current), status: current >= Number(expected) ? 'covered' : 'missing' }); })); return results.sort((a, b) => b.gap - a.gap || a.level.localeCompare(b.level)); },
    missing() { return this.analyze().filter((item) => item.gap > 0); }
  };

  const ContentPackIntelligenceService = {
    catalog() { const offline = global.OfflinePackService?.catalog?.() || []; return (runtime.config?.packs || []).map((pack) => { const linked = offline.find((item) => item.id === pack.offlinePackId); const entities = ContentEntityRegistryService.all().filter((item) => item.level === pack.level && pack.skills.includes(item.skill)); return { ...clone(pack), contentIds: entities.map((item) => item.id), contentCount: entities.length, estimatedSize: linked?.estimatedSize || 'Tính khi đóng gói', lessonIds: linked?.lessonIds || [], exerciseIds: linked?.exerciseIds || [], audioAssets: linked?.audioAssets || [], assets: linked?.assets || [], offlineStatus: linked ? global.OfflinePackService.status(linked) : 'metadata-only', downloadReady: Boolean(linked) }; }); },
    download(id) { const pack = this.catalog().find((item) => item.id === id); if (!pack?.downloadReady) throw new Error('Gói này mới có metadata, chưa có payload offline được duyệt.'); return global.OfflinePackService.download(pack.offlinePackId); }
  };

  const ContentAdminDashboardService = {
    snapshot() { const entities = ContentEntityRegistryService.all(); const reports = global.ContentScienceFeedbackService?.all?.() || []; const sampled = ContentPerformanceService.all(160); const weak = sampled.filter(({ performance }) => performance.sampleSize > 0 && ((performance.completionRate != null && performance.completionRate < 60) || (performance.averageScore != null && performance.averageScore < 60))).sort((a, b) => (a.performance.averageScore ?? 101) - (b.performance.averageScore ?? 101)); return { total: entities.length, needsReview: entities.filter((item) => ['draft', 'ai_review', 'human_review'].includes(item.review_status)).length, reportedErrors: reports.filter((item) => !['resolved', 'closed'].includes(item.status)).length, popular: sampled.filter(({ performance }) => performance.views || performance.started).sort((a, b) => (b.performance.views + b.performance.started) - (a.performance.views + a.performance.started)).slice(0, 5), weak: weak.slice(0, 5), published: entities.filter((item) => item.review_status === 'published').length, analyticsSampled: sampled.length }; }
  };

  function loading() { ContentIntelligenceConfigService.load(); return '<section class="section empty-state"><h1>Đang tải Content Intelligence…</h1><p>Chuẩn hóa registry mà không thay đổi dữ liệu học.</p></section>'; }
  function heading(back, eyebrow, title, detail) { return `<section class="section page-heading p75-heading"><button class="back-link" data-view="${back}">←</button><p class="eyebrow">${escapeHtml(eyebrow)}</p><h1 class="headline">${escapeHtml(title)}</h1><p class="subtle">${escapeHtml(detail)}</p></section>`; }
  function metric(label, value, detail = '') { return `<article><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(detail)}</small></article>`; }
  function hubView() {
    if (!runtime.config) return loading(); const audit = ContentEntityRegistryService.migrationAudit(); const entities = ContentEntityRegistryService.all(); const reports = global.ContentScienceFeedbackService?.all?.() || []; const admin = ContentPermissionService.canReview({ type: '*' }); const dashboard = admin ? ContentAdminDashboardService.snapshot() : { needsReview: entities.filter((item) => ['draft', 'ai_review', 'human_review'].includes(item.review_status)).length, reportedErrors: reports.filter((item) => !['resolved', 'closed'].includes(item.status)).length, weak: [] }; const recommendations = ContentRecommendationIntelligenceService.recommend(3);
    return `${heading('content-platform', 'P75 · CONTENT INTELLIGENCE', 'Kho nội dung có thể vận hành ở quy mô lớn', 'Một registry chung cho quality, version, hiệu quả học và offline pack; ID học cũ được giữ nguyên.')}<section class="section p75-metrics">${metric('Content Entity', audit.total, `${Object.values(audit.types).filter(Boolean).length}/9 loại có dữ liệu`)}${metric('Cần review', dashboard.needsReview, 'Draft · AI Review · Human Review')}${metric('Báo lỗi mở', dashboard.reportedErrors, 'Từ feedback loop')}${metric('Content yếu', dashboard.weak.length, 'Chỉ dựa trên evidence')}</section><section class="section p75-action-grid"><button data-view="content-performance"><b>Hiệu quả & quality</b><span>Completion · score · retention 7/30</span></button><button data-view="content-gaps"><b>Content Gap</b><span>Phát hiện level/kỹ năng còn thiếu</span></button><button data-view="content-pack-manager"><b>Content Pack</b><span>Beginner · TOPIK · Business · Travel</span></button>${admin ? '<button data-view="content-operations"><b>Content Operations</b><span>Workflow · version · permission</span></button>' : ''}</section><section class="section p75-panel"><div class="section-heading"><div><p class="eyebrow">RECOMMENDATION</p><h2 class="section-title">Nội dung phù hợp nhất lúc này</h2></div><span>Quality + outcome + weakness</span></div>${recommendations.map((item) => `<article class="p75-row"><div><b>${escapeHtml(item.entity.title)}</b><small>${escapeHtml(item.entity.type)} · ${escapeHtml(item.entity.level)} · ${escapeHtml(item.entity.skill)}</small><p>${escapeHtml(item.reason)}</p></div><strong>${item.score}</strong></article>`).join('') || '<div class="empty-state">Chưa đủ content đã duyệt để đề xuất.</div>'}</section>`;
  }
  function operationsView() {
    if (!runtime.config) return loading(); if (!ContentPermissionService.canReview({ type: '*' })) return `${heading('content-intelligence', 'SECURITY', 'Khu vực giới hạn', `Role ${ContentPermissionService.role()} không có quyền Content Operations.`)}<section class="empty-state section"><p>Quyền được lấy từ Supabase app_metadata, không từ localStorage.</p></section>`;
    const entities = ContentEntityRegistryService.all().slice(0, 40); return `${heading('content-intelligence', 'CMS FOUNDATION', 'Content Operations', 'Create → AI Review → Human Review → Approved → Published. AI không có quyền publish.')}<section class="section p75-workflow">${runtime.config.workflow.statuses.map((status, index) => `<div><span>${index + 1}</span><b>${escapeHtml(status)}</b></div>`).join('<i>→</i>')}</section><section class="section p75-table"><header><b>Content</b><b>Version</b><b>Status</b><b>Quality</b></header>${entities.map((entity) => { const quality = ContentQualityIntelligenceService.score(entity); return `<article><span><b>${escapeHtml(entity.title)}</b><small>${escapeHtml(entity.type)} · ${escapeHtml(entity.id)}</small></span><span>v${entity.version}<small>${ContentWorkspaceService.history(entity.id).length || 1} snapshot</small></span><span>${escapeHtml(entity.review_status)}</span><span>${quality.score == null ? 'Collecting' : `${quality.score}/100`}<small>${quality.evidenceCoverage}% evidence</small></span></article>`; }).join('')}</section>`;
  }
  function performanceView() {
    if (!runtime.config) return loading(); const all = ContentPerformanceService.all(60); return `${heading('content-intelligence', 'CONTENT PERFORMANCE', 'Hiệu quả nội dung', 'Không dùng lượt mở làm kết quả học; retention và usage chỉ xuất hiện khi có bằng chứng.')}<section class="section p75-table"><header><b>Content</b><b>Completion</b><b>Score</b><b>Retention</b></header>${all.map(({ entity, performance }) => { const effectiveness = ContentLearningEffectivenessService.measure(entity); return `<article><span><b>${escapeHtml(entity.title)}</b><small>${escapeHtml(entity.type)} · n=${performance.sampleSize}</small></span><span>${performance.completionRate == null ? 'Collecting' : `${performance.completionRate}%`}<small>drop ${performance.dropRate == null ? '—' : `${performance.dropRate}%`}</small></span><span>${performance.averageScore == null ? '—' : performance.averageScore}<small>${performance.commonErrors.length} nhóm lỗi</small></span><span>${effectiveness.learningEffectiveness == null ? 'Collecting' : `${effectiveness.learningEffectiveness}%`}<small>7d ${effectiveness.retention7 ?? '—'} · 30d ${effectiveness.retention30 ?? '—'}</small></span></article>`; }).join('')}</section>`;
  }
  function gapsView() { if (!runtime.config) return loading(); const gaps = ContentGapAnalysisService.analyze(); return `${heading('content-intelligence', 'GAP ANALYSIS', 'Khoảng trống nội dung', 'So sánh coverage đã duyệt với mục tiêu tối thiểu theo level và loại content.')}<section class="section p75-gap-grid">${gaps.map((item) => `<article class="${item.status}"><span>${escapeHtml(item.level)}</span><b>${escapeHtml(item.type)}</b><strong>${item.current}/${item.expected}</strong><small>${item.gap ? `Thiếu ${item.gap}` : 'Đủ coverage'}</small></article>`).join('')}</section>`; }
  function packsView() { if (!runtime.config) return loading(); return `${heading('content-intelligence', 'P74 × P75', 'Content Pack Manager', 'Metadata nhỏ ở localStorage; payload lesson/exercise/audio nằm trong Cache Storage.')}<section class="section p75-pack-grid">${ContentPackIntelligenceService.catalog().map((pack) => `<article><span>${escapeHtml(pack.level)}</span><h2>${escapeHtml(pack.title)}</h2><p>${escapeHtml(pack.skills.join(' · '))}</p><dl><div><dt>Content</dt><dd>${pack.contentCount}</dd></div><div><dt>Size</dt><dd>${escapeHtml(pack.estimatedSize)}</dd></div><div><dt>Offline</dt><dd>${escapeHtml(pack.offlineStatus)}</dd></div></dl><button class="btn ${pack.downloadReady ? 'primary' : 'secondary'}" data-p75-download="${escapeHtml(pack.id)}" ${pack.downloadReady ? '' : 'disabled'}>${pack.downloadReady ? 'Tải / cập nhật' : 'Chờ payload duyệt'}</button></article>`).join('')}</section>`; }

  Object.assign(global, { ContentIntelligenceConfigService, ContentEntityRegistryService, ContentPermissionService, ContentWorkspaceService, ContentDifficultyEngine, ContentQualityIntelligenceService, AIContentIntelligenceAssistant, ContentPerformanceService, ContentLearningEffectivenessService, ContentRecommendationIntelligenceService, ContentGapAnalysisService, ContentPackIntelligenceService, ContentAdminDashboardService, ContentIntelligencePlatform: { config: ContentIntelligenceConfigService, registry: ContentEntityRegistryService, permissions: ContentPermissionService, workspace: ContentWorkspaceService, difficulty: ContentDifficultyEngine, quality: ContentQualityIntelligenceService, assistant: AIContentIntelligenceAssistant, performance: ContentPerformanceService, effectiveness: ContentLearningEffectivenessService, recommendations: ContentRecommendationIntelligenceService, gaps: ContentGapAnalysisService, packs: ContentPackIntelligenceService, dashboard: ContentAdminDashboardService, version: 'p75-v1' } });
  global.KLEARN_EXTRA_VIEWS = { ...(global.KLEARN_EXTRA_VIEWS || {}), 'content-intelligence': hubView, 'content-operations': operationsView, 'content-performance': performanceView, 'content-gaps': gapsView, 'content-pack-manager': packsView };
  const previousAfterRender = global.KLEARN_AFTER_RENDER;
  global.KLEARN_AFTER_RENDER = () => {
    previousAfterRender?.(); if (!state.currentUser) return;
    if (['content-platform', 'admin-content'].includes(state.currentView) && !global.document?.querySelector('.p75-entry')) global.document?.querySelector('.page-heading')?.insertAdjacentHTML('afterend', '<section class="section p75-entry"><div><small>P75 · CONTENT INTELLIGENCE</small><h2>Quality, version và hiệu quả học trong một hệ thống</h2><p>Giữ nguyên content ID và tiến độ hiện có.</p></div><button class="btn primary" data-view="content-intelligence">Mở nền tảng</button></section>');
    global.document?.querySelectorAll('.p75-entry [data-view], .p75-action-grid [data-view]').forEach((button) => { button.onclick = () => setView(button.dataset.view); });
    global.document?.querySelectorAll('[data-p75-download]').forEach((button) => { button.onclick = async () => { button.disabled = true; try { await ContentPackIntelligenceService.download(button.dataset.p75Download); toast?.('Đã tải content pack.'); } catch (error) { toast?.(error.message); } render(); }; });
  };
  ContentIntelligenceConfigService.load();
})(window);
