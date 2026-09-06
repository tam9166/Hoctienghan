/* Tiếng Hàn - TamHoanq · P37 AI-assisted content creation with mandatory human approval */
(function aiContentCreationModule(global) {
  'use strict';
  const app = global.KLEARN_APP;
  if (!app) return;
  const { state, storage, render, setView, toast, escapeHtml } = app;
  const STORE_KEY = 'klearn_ai_content_drafts';
  const routes = new Set(['ai-content-studio']);
  const runtime = { config: null, loading: null, selectedId: '', busy: false, cloudDrafts: [], cloudLoaded: false };
  const now = () => new Date().toISOString();
  const clean = (value, limit = 2000) => String(value == null ? '' : value).normalize('NFC').replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, limit);
  const object = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const uuid = () => global.crypto?.randomUUID?.() || 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => { const value = Math.floor(Math.random() * 16); return (character === 'x' ? value : (value & 3) | 8).toString(16); });
  const role = () => global.RolePermissionService?.role?.() || app.AccessControlService?.role?.() || 'student';
  const actorId = () => global.SupabaseService?.session?.user?.id || state.currentUser?.id || 'local-staff';
  const forbidden = (value) => /(api[_ -]?key|password|secret|access[_ -]?token|bearer\s+[a-z0-9._-]+|ignore\s+(all\s+)?previous|system\s+prompt)/i.test(String(value || ''));
  const normalize = (value) => clean(value, 8000).toLocaleLowerCase().replace(/[^a-z0-9가-힣\s]/gi, ' ').replace(/\s+/g, ' ').trim();
  const words = (value) => new Set(normalize(value).split(' ').filter(Boolean));
  const similarity = (a, b) => { const left = words(a); const right = words(b); if (!left.size || !right.size) return 0; const common = [...left].filter((item) => right.has(item)).length; return common / (left.size + right.size - common); };
  const logEntry = (action, notes = '') => ({ action, notes: clean(notes, 500), actorId: actorId(), actorRole: role(), at: now() });

  const AIContentCreationConfigService = {
    hydrate(value) {
      if (!value?.verified || value.reviewStatus !== 'approved' || value.aiCanPublish !== false || value.aiCanChangeCurriculum !== false || !value.humanApprovalRequired) throw new Error('AI content configuration quality gate failed');
      runtime.config = value;
      const infra = global.KLEARN_AI_INFRASTRUCTURE;
      if (infra) {
        infra.promptVersions = { ...infra.promptVersions, content_lesson: value.promptVersions.lesson, content_example: value.promptVersions.example, content_difficulty: value.promptVersions.difficulty, content_translation: value.promptVersions.translation, content_audio_script: value.promptVersions.audio, content_quiz: value.promptVersions.quiz, curriculum_advice: value.promptVersions.curriculum };
        infra.routing = { ...infra.routing, simple: [...new Set([...(infra.routing?.simple || []), 'content_difficulty', 'content_translation'])], strong: [...new Set([...(infra.routing?.strong || []), 'content_lesson', 'content_example', 'content_audio_script', 'content_quiz', 'curriculum_advice'])] };
      }
      return value;
    },
    load() {
      if (runtime.config) return Promise.resolve(runtime.config);
      if (runtime.loading) return runtime.loading;
      if (typeof global.fetch !== 'function') return Promise.resolve(null);
      runtime.loading = global.fetch('./content/ai-content-creation.json', { cache: 'default' }).then((response) => { if (!response.ok) throw new Error(`AI content config ${response.status}`); return response.json(); }).then((value) => this.hydrate(value)).catch((error) => { toast?.(`Không thể tải Content Studio: ${error.message}`); return null; }).finally(() => { runtime.loading = null; if (routes.has(state.currentView)) render(); });
      return runtime.loading;
    },
    get() { return runtime.config; }
  };

  const AIContentAccessService = {
    role,
    canCreate() { return ['content_editor', 'admin'].includes(role()); },
    canReview() { return ['reviewer', 'content_editor', 'admin'].includes(role()); },
    canPublish() { return role() === 'admin'; },
    require(action) { const allowed = action === 'publish' ? this.canPublish() : action === 'review' ? this.canReview() : this.canCreate(); if (!allowed) throw new Error('Bạn không có quyền thực hiện thao tác nội dung này.'); return true; }
  };

  const AIContentDraftRepository = {
    local() { const value = storage.get(STORE_KEY, {}); const scoped = Array.isArray(value) ? value.filter((item) => item.createdBy === actorId()) : value?.[actorId()]; return Array.isArray(scoped) ? scoped : []; },
    all() { const merged = new Map(runtime.cloudDrafts.map((item) => [item.id, item])); this.local().forEach((item) => merged.set(item.id, item)); return [...merged.values()].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)); },
    byId(id) { return this.all().find((item) => item.id === id) || null; },
    save(draft) {
      const item = clone(draft); item.updatedAt = now();
      const value = storage.get(STORE_KEY, {}); const scopes = value && typeof value === 'object' && !Array.isArray(value) ? value : {}; scopes[actorId()] = [item, ...this.local().filter((entry) => entry.id !== item.id)].slice(0, 500); storage.set(STORE_KEY, scopes);
      this.sync(item); return item;
    },
    sync(item) {
      const client = global.SupabaseService?.client; const session = global.SupabaseService?.session;
      if (!client?.from || !session?.user?.id || !AIContentAccessService.canReview()) return;
      const row = { id: item.id, content_type: item.type, title: item.title, difficulty: item.level, prompt_version: item.promptVersion, model_route: item.modelRoute, generation_payload: { tool: item.tool, sourceIds: item.sourceIds || [], generationSource: item.generationSource }, draft_payload: item.payload, status: item.status, quality_score: item.quality?.score || 0, duplicate_report: item.duplicate || {}, workflow_history: (item.history || []).slice(-100), human_approved: Boolean(item.humanApproved), created_by: item.createdBy, reviewed_by: item.reviewedBy || null, review_notes: item.reviewNotes || '', published_content_id: item.publishedContentId || null, created_at: item.createdAt, updated_at: item.updatedAt };
      const table = client.from('ai_content_drafts'); const request = item.createdBy === session.user.id ? table.upsert(row) : table.update(row).eq('id', item.id); request.then(() => {}, () => {});
    },
    async loadCloud() { const client = global.SupabaseService?.client; if (!client?.from || !global.SupabaseService?.session?.user?.id || !AIContentAccessService.canReview()) return []; const { data, error } = await client.from('ai_content_drafts').select('id,content_type,title,difficulty,prompt_version,model_route,generation_payload,draft_payload,status,quality_score,duplicate_report,workflow_history,human_approved,created_by,reviewed_by,review_notes,published_content_id,created_at,updated_at').order('updated_at', { ascending: false }).limit(500); if (error) throw error; runtime.cloudDrafts = (data || []).map((row) => { const sourceIds = row.generation_payload?.sourceIds || []; const duplicate = row.duplicate_report || {}; const score = Number(row.quality_score || 0); return { id: row.id, type: row.content_type, tool: row.generation_payload?.tool || row.content_type, title: row.title, level: row.difficulty, promptVersion: row.prompt_version, modelRoute: row.model_route, generationSource: row.generation_payload?.generationSource || 'ai-assisted', sourceIds, payload: row.draft_payload || {}, status: row.status, quality: { score, readyForReview: score >= 60, readyForApproval: score >= 80 && sourceIds.length > 0 && duplicate.risk !== 'high', humanApprovalRequired: true }, duplicate, aiGenerated: true, verified: false, humanApproved: Boolean(row.human_approved), published: row.status === 'published', createdBy: row.created_by, reviewedBy: row.reviewed_by, reviewNotes: row.review_notes, publishedContentId: row.published_content_id, createdAt: row.created_at, updatedAt: row.updated_at, history: row.workflow_history || [] }; }); runtime.cloudLoaded = true; return runtime.cloudDrafts; },
    clearForTests() { const value = storage.get(STORE_KEY, {}); if (value && typeof value === 'object' && !Array.isArray(value)) { delete value[actorId()]; storage.set(STORE_KEY, value); } else storage.set(STORE_KEY, {}); }
  };

  function parseJson(reply) {
    const raw = clean(reply, 12000).replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    try { return object(JSON.parse(raw)); } catch (_) { const match = raw.match(/\{[\s\S]*\}/); if (!match) return null; try { return object(JSON.parse(match[0])); } catch (_) { return null; } }
  }
  function safeInput(input = {}) {
    const result = {};
    Object.entries(object(input)).slice(0, 20).forEach(([key, value]) => { if (Array.isArray(value)) result[clean(key, 60)] = value.slice(0, 30).map((item) => clean(item, 240)); else result[clean(key, 60)] = clean(value, 2500); });
    if (forbidden(JSON.stringify(result))) throw new Error('Nội dung có chuỗi nhạy cảm hoặc chỉ dẫn không an toàn.');
    return result;
  }
  function fallbackPayload(tool, input) {
    const topic = input.topic || input.pattern || 'Chủ đề tiếng Hàn'; const level = input.level || 'TOPIK_1';
    if (tool === 'lesson') return { title: topic, objective: input.objective || `Hiểu và sử dụng ${topic}`, sections: [{ title: 'Khởi động', content: `Kích hoạt kiến thức nền về ${topic}.` }, { title: 'Giải thích', content: 'Biên tập viên bổ sung nội dung chuẩn từ nguồn tham chiếu.' }, { title: 'Thực hành', content: 'Tạo hoạt động có đáp án và giải thích.' }], level, editorChecklist: ['Đối chiếu curriculum', 'Kiểm tra tiếng Hàn', 'Bổ sung nguồn'] };
    if (tool === 'example') return { title: `Câu ví dụ · ${topic}`, level, examples: Array.from({ length: Math.min(8, Math.max(1, Number(input.count) || 3)) }, (_, index) => ({ korean: `${topic} · 예문 ${index + 1}`, translation: 'Cần người biên tập hoàn thiện bản dịch tự nhiên.', usage: 'Bản nháp — chưa dùng cho người học.' })) };
    if (tool === 'audio') return { title: `Audio script · ${topic}`, level, pace: input.pace || 'normal', turns: [{ speaker: 'A', korean: `${topic}에 대해 이야기해요.`, direction: 'Rõ, tốc độ phù hợp cấp độ.' }, { speaker: 'B', korean: '네, 좋아요.', direction: 'Ngắt tự nhiên.' }], audioGenerated: false };
    if (tool === 'quiz') return { title: `Quiz · ${topic}`, level, questions: [{ type: 'mcq', prompt: `${topic}: chọn đáp án phù hợp`, options: ['A', 'B', 'C', 'D'], answerIndex: 0, explanation: 'Biên tập viên xác minh đáp án.' }, { type: 'fill_blank', prompt: `${topic}: ____`, answer: topic, explanation: 'Biên tập viên xác minh đáp án.' }] };
    if (tool === 'curriculum') return { title: `Đề xuất cấu trúc · ${topic}`, level, proposal: [{ order: 1, title: topic, rationale: input.goal || 'Phục vụ mục tiêu đã chọn.' }], advisoryOnly: true, curriculumChanged: false };
    return { title: topic, level, notes: 'Cần người biên tập kiểm tra.' };
  }

  const AIContentDuplicateService = {
    candidates() {
      const advanced = global.AdvancedContentService?.raw?.() || [];
      const authored = global.ContentRepository?.drafts?.() || [];
      return [...advanced, ...authored, ...AIContentDraftRepository.all()].map((item) => ({ id: item.id, title: item.title?.vi || item.title || '', text: JSON.stringify(item.payload || item.body || item.summary || item.korean || '') }));
    },
    detect(candidate, threshold = .72) {
      const target = `${candidate.title || ''} ${JSON.stringify(candidate.payload || {})}`;
      const matches = this.candidates().filter((item) => item.id !== candidate.id).map((item) => ({ id: item.id, title: item.title, similarity: Number(similarity(target, `${item.title} ${item.text}`).toFixed(2)) })).filter((item) => item.similarity >= threshold).sort((a, b) => b.similarity - a.similarity).slice(0, 10);
      const existingGroups = global.DuplicateDetectionService?.groups?.() || []; const exactIds = new Set(existingGroups.flatMap((group) => group.items || []).map((item) => item.id)); const exactMatches = matches.filter((item) => exactIds.has(item.id));
      return { checkedAt: now(), threshold, risk: matches.some((item) => item.similarity >= .9) ? 'high' : matches.length ? 'review' : 'low', matches, exactMatches, reusedQualityDetector: Boolean(global.DuplicateDetectionService) };
    }
  };

  const AIDifficultyCheckerService = {
    check(content, claimedLevel = 'TOPIK_1') {
      const config = AIContentCreationConfigService.get(); const text = clean(typeof content === 'string' ? content : JSON.stringify(content), 12000); const sentences = text.split(/[.!?。]|다\s/g).map((item) => item.trim()).filter(Boolean); const hangulCounts = sentences.map((item) => [...item].filter((character) => /[가-힣]/.test(character)).length); const averageLength = hangulCounts.length ? hangulCounts.reduce((sum, value) => sum + value, 0) / hangulCounts.length : 0; const guidance = config?.levelGuidance?.[claimedLevel] || { maxSentenceLength: 34 }; const ratio = averageLength / Math.max(1, guidance.maxSentenceLength); const suggestedIndex = ratio > 1.8 ? Math.min(6, Number(claimedLevel.split('_')[1] || 1) + 2) : ratio > 1.2 ? Math.min(6, Number(claimedLevel.split('_')[1] || 1) + 1) : Number(claimedLevel.split('_')[1] || 1); const suggestedLevel = `TOPIK_${suggestedIndex}`; return { claimedLevel, suggestedLevel, confidence: text.length < 25 ? 45 : Math.min(92, Math.round(65 + sentences.length * 3)), averageSentenceLength: Number(averageLength.toFixed(1)), fit: suggestedLevel === claimedLevel ? 'fit' : 'review', reasons: suggestedLevel === claimedLevel ? ['Độ dài câu phù hợp ngưỡng tham khảo.'] : ['Độ dài câu vượt ngưỡng cấp độ đã chọn.'], humanDecisionRequired: true };
    },
    async assess(content, claimedLevel = 'TOPIK_1') { AIContentAccessService.require('create'); const local = this.check(content, claimedLevel); const input = clean(typeof content === 'string' ? content : JSON.stringify(content), 4000); if (forbidden(input)) throw new Error('Nội dung có chỉ dẫn không an toàn.'); if (!global.AIOrchestrationService?.request) return { ...local, source: 'local-heuristic' }; const response = await global.AIOrchestrationService.request({ task: 'content_difficulty', input: `Đánh giá level ${claimedLevel}. Trả JSON {suggestedLevel,confidence,reasons}. Nội dung: ${input}`, context: { currentTopikLevel: Number(claimedLevel.split('_')[1] || 1) }, language: 'vi' }); const parsed = !response.fallback ? parseJson(response.reply) : null; const suggested = AIContentCreationConfigService.get()?.levels?.includes(parsed?.suggestedLevel) ? parsed.suggestedLevel : local.suggestedLevel; return { ...local, suggestedLevel: suggested, confidence: Math.min(95, Math.max(0, Number(parsed?.confidence) || local.confidence)), reasons: Array.isArray(parsed?.reasons) ? parsed.reasons.slice(0, 6).map((item) => clean(item, 240)) : local.reasons, fit: suggested === claimedLevel ? 'fit' : 'review', source: parsed ? 'ai-assisted-and-local-guarded' : 'local-heuristic', promptVersion: response.promptVersion, humanDecisionRequired: true }; }
  };

  const AITranslationReviewerService = {
    review({ korean = '', translation = '', level = 'TOPIK_1' } = {}) { const source = clean(korean, 2000); const target = clean(translation, 2000); const issues = []; if (!source || !target) issues.push('Thiếu câu gốc hoặc bản dịch.'); if (source && target && normalize(source) === normalize(target)) issues.push('Bản dịch trùng nguyên văn nguồn.'); if (/\b(nó là|tôi thì|cái việc)\b/i.test(target)) issues.push('Có dấu hiệu dịch sát; cần kiểm tra độ tự nhiên tiếng Việt.'); return { level, score: Math.max(0, 100 - issues.length * 28 - (!/[가-힣]/.test(source) ? 30 : 0)), natural: issues.length === 0, issues, status: 'human_review', machineReviewed: true, source: 'local-language-guard', humanDecisionRequired: true }; },
    async reviewWithAI(input = {}) { AIContentAccessService.require('create'); const safe = safeInput(input); const local = this.review(safe); if (!global.AIOrchestrationService?.request) return local; const response = await global.AIOrchestrationService.request({ task: 'content_translation', input: `Kiểm tra độ tự nhiên bản dịch Việt. Trả JSON {score,natural,issues,suggestion}. Korean: ${safe.korean}. Vietnamese: ${safe.translation}.`, context: { currentTopikLevel: Number((safe.level || 'TOPIK_1').split('_')[1] || 1) }, language: 'vi' }); const parsed = !response.fallback ? parseJson(response.reply) : null; return { ...local, score: Math.min(local.score, Math.max(0, Number(parsed?.score) || local.score)), natural: local.natural && parsed?.natural !== false, issues: [...new Set([...local.issues, ...(Array.isArray(parsed?.issues) ? parsed.issues.map((item) => clean(item, 240)) : [])])].slice(0, 8), suggestion: clean(parsed?.suggestion, 500), source: parsed ? 'ai-assisted-and-local-guarded' : local.source, promptVersion: response.promptVersion, status: 'human_review', humanDecisionRequired: true }; }
  };

  const AIContentQualityScoreService = {
    score(draft) {
      const weights = AIContentCreationConfigService.get()?.qualityWeights || { completeness: 25, levelFit: 20, sourceTraceability: 20, languageQuality: 20, originality: 15 };
      const payloadText = JSON.stringify(draft.payload || {}); const difficulty = draft.difficulty || AIDifficultyCheckerService.check(payloadText, draft.level); const duplicate = draft.duplicate || AIContentDuplicateService.detect(draft); const checks = { completeness: Boolean(draft.title && payloadText.length > 80), levelFit: difficulty.fit === 'fit', sourceTraceability: Boolean(draft.sourceIds?.length), languageQuality: /[가-힣]/.test(payloadText) && (!draft.translationReview || draft.translationReview.score >= 70), originality: duplicate.risk !== 'high' }; const score = Object.entries(checks).reduce((sum, [key, pass]) => sum + (pass ? Number(weights[key] || 0) : 0), 0); return { score, checks, readyForReview: score >= 60, readyForApproval: score >= 80 && Object.values(checks).every(Boolean), autoApproved: false, humanApprovalRequired: true };
    }
  };

  const AIContentGenerationService = {
    async request(tool, rawInput = {}) {
      AIContentAccessService.require('create'); const input = safeInput(rawInput); const config = AIContentCreationConfigService.get(); if (!config) throw new Error('Content Studio chưa sẵn sàng.');
      if (!config.allowedContentTypes.includes(tool) && tool !== 'curriculum') throw new Error('Công cụ tạo nội dung không hợp lệ.');
      const sourceIds = (input.sourceIds || []).filter(Boolean).slice(0, 20); const task = ({ lesson: 'content_lesson', example: 'content_example', audio: 'content_audio_script', quiz: 'content_quiz', curriculum: 'curriculum_advice' })[tool];
      const instruction = `Tạo JSON bản nháp ${tool} tiếng Hàn cấp ${input.level || 'TOPIK_1'}. Chủ đề: ${input.topic || input.pattern || ''}. Mục tiêu: ${input.objective || input.goal || ''}. Chỉ dùng nguồn tham chiếu được chọn: ${sourceIds.join(', ') || 'chưa có'}. Không tự thay đổi curriculum, không tuyên bố approved/published. Trả về JSON object có title và nội dung có cấu trúc.`;
      let response = null;
      if (global.AIOrchestrationService?.request) response = await global.AIOrchestrationService.request({ task, input: instruction, messages: [{ role: 'user', content: instruction }], context: { currentTopikLevel: Number((input.level || 'TOPIK_1').split('_')[1] || 1), approvedReferenceIds: sourceIds }, language: 'vi' });
      const parsed = !response?.fallback ? parseJson(response?.reply) : null; const payload = parsed && Object.keys(parsed).length ? parsed : fallbackPayload(tool, input); const createdAt = now();
      let draft = { id: uuid(), type: tool, tool, title: clean(payload.title || input.topic || `${tool} draft`, 160), level: input.level || 'TOPIK_1', status: 'ai_draft', payload, sourceIds, aiGenerated: true, verified: false, humanApproved: false, published: false, generationSource: parsed ? 'ai-assisted' : 'template-fallback', promptVersion: response?.promptVersion || config.promptVersions[tool], modelRoute: response?.modelRoute || 'local-fallback', createdBy: actorId(), createdAt, updatedAt: createdAt, history: [logEntry('ai_draft_created', parsed ? 'AI-assisted structured draft' : 'Safe local scaffold')] };
      draft.difficulty = AIDifficultyCheckerService.check(payload, draft.level); draft.duplicate = AIContentDuplicateService.detect(draft); draft.quality = AIContentQualityScoreService.score(draft); draft = AIContentDraftRepository.save(draft); runtime.selectedId = draft.id; return draft;
    }
  };

  const AILessonAssistantService = { create: (input) => AIContentGenerationService.request('lesson', input) };
  const AIExampleGeneratorService = { generate: (input) => AIContentGenerationService.request('example', input) };
  const AIAudioScriptGeneratorService = { generate: (input) => AIContentGenerationService.request('audio', input) };
  const AIQuizGeneratorService = { generate: (input) => AIContentGenerationService.request('quiz', input) };
  const CurriculumAssistantService = { suggest: (input) => AIContentGenerationService.request('curriculum', input), apply() { throw new Error('AI không có quyền thay đổi curriculum. Đề xuất phải được xử lý thủ công.'); }, canMutateCurriculum: false };

  const HumanApprovalWorkflowService = {
    transition(id, status, notes = '') { const draft = AIContentDraftRepository.byId(id); if (!draft) throw new Error('Không tìm thấy bản nháp.'); const allowed = { ai_draft: ['human_review'], human_review: ['needs_revision', 'approved'], needs_revision: ['human_review'], approved: ['published'], published: [] }; if (!allowed[draft.status]?.includes(status)) throw new Error(`Không thể chuyển ${draft.status} → ${status}.`); draft.status = status; draft.reviewNotes = clean(notes, 1000); draft.history = [...(draft.history || []), logEntry(status, notes)]; if (status === 'approved') { draft.humanApproved = true; draft.reviewedBy = actorId(); draft.reviewedAt = now(); } return AIContentDraftRepository.save(draft); },
    submit(id, notes = '') { AIContentAccessService.require('create'); const draft = AIContentDraftRepository.byId(id); if (!draft?.quality?.readyForReview) throw new Error('Bản nháp chưa đạt ngưỡng để gửi review.'); return this.transition(id, 'human_review', notes); },
    requestChanges(id, notes) { AIContentAccessService.require('review'); if (!clean(notes)) throw new Error('Cần ghi rõ nội dung phải chỉnh sửa.'); return this.transition(id, 'needs_revision', notes); },
    approve(id, notes = '') { AIContentAccessService.require('review'); const draft = AIContentDraftRepository.byId(id); if (!draft?.quality?.readyForApproval) throw new Error('Quality gate chưa đạt; chưa thể phê duyệt.'); return this.transition(id, 'approved', notes); },
    async publish(id) { AIContentAccessService.require('publish'); const draft = AIContentDraftRepository.byId(id); if (!draft?.humanApproved || draft.status !== 'approved' || draft.aiGenerated !== true) throw new Error('Chỉ bản nháp đã được người duyệt phê duyệt mới có thể publish.'); const publishedContentId = `ai-content-${draft.id}`; if (global.ContentAdminService?.save) await global.ContentAdminService.save({ id: publishedContentId, type: draft.type === 'example' ? 'exercise' : draft.type, title: draft.title, verified: true, difficulty: draft.level, source: `human-reviewed:${(draft.sourceIds || []).join(',') || 'editorial'}`, reviewStatus: 'approved', body: { ...draft.payload, aiDraftId: draft.id, humanApprovedAt: draft.reviewedAt } }); draft.publishedContentId = publishedContentId; draft.published = true; return this.transition(id, 'published', 'Published by admin after human approval'); }
  };

  function heading(back, eyebrow, title, subtitle) { return `<div class="page-heading"><button class="back-btn" data-view="${back}" aria-label="Quay lại">←</button><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p>${subtitle}</p></div></div>`; }
  const statusLabel = (status) => ({ ai_draft: 'AI draft', human_review: 'Human review', needs_revision: 'Needs revision', approved: 'Approved', published: 'Published' })[status] || status;
  function preview(draft) { if (!draft) return '<div class="empty-state"><h3>Chưa có bản nháp</h3><p>Chọn một công cụ để tạo draft có cấu trúc.</p></div>'; const quality = draft.quality || { score: 0, checks: {} }; return `<div class="ai-draft-preview"><div><span class="ai-status">${escapeHtml(statusLabel(draft.status))}</span><h3>${escapeHtml(draft.title)}</h3><small>${escapeHtml(draft.level)} · ${escapeHtml(draft.promptVersion)} · ${escapeHtml(draft.generationSource)}</small></div><div class="ai-quality-meter" aria-label="Quality ${quality.score}%"><i style="width:${quality.score}%"></i></div><b>Quality score ${quality.score}/100</b><pre>${escapeHtml(JSON.stringify(draft.payload, null, 2))}</pre><div class="ai-check-grid"><article><small>Level fit</small><b>${draft.difficulty?.fit === 'fit' ? '✓' : '!'}</b></article><article><small>Duplicate</small><b>${escapeHtml(draft.duplicate?.risk || '—')}</b></article><article><small>Sources</small><b>${draft.sourceIds?.length || 0}</b></article><article><small>Auto publish</small><b>Không</b></article></div><div class="ai-studio-tools"><button class="btn secondary" data-ai-check-level="${draft.id}">AI level check</button><button class="btn secondary" data-ai-check-translation="${draft.id}">Review translation</button></div>${draft.translationReview ? `<small>Translation review: ${draft.translationReview.score}/100 · ${escapeHtml(draft.translationReview.source)}</small>` : ''}</div>`; }
  function queueMarkup() { const drafts = AIContentDraftRepository.all(); if (!drafts.length) return '<div class="empty-state"><h3>Hàng đợi đang trống</h3><p>Bản nháp mới sẽ xuất hiện ở đây.</p></div>'; return `<div class="ai-draft-queue">${drafts.map((item) => `<article class="ai-draft-card"><div><span class="ai-status">${escapeHtml(statusLabel(item.status))}</span><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.type)} · ${escapeHtml(item.level)} · Quality ${item.quality?.score || 0}</small></div><div class="actions"><button class="btn secondary" data-ai-select="${item.id}">Xem</button>${item.status === 'ai_draft' ? `<button class="btn primary" data-ai-submit="${item.id}">Gửi review</button>` : ''}${item.status === 'human_review' && AIContentAccessService.canReview() ? `<button class="btn secondary" data-ai-revise="${item.id}">Yêu cầu sửa</button><button class="btn primary" data-ai-approve="${item.id}">Duyệt</button>` : ''}${item.status === 'approved' && AIContentAccessService.canPublish() ? `<button class="btn primary" data-ai-publish="${item.id}">Publish</button>` : ''}</div></article>`).join('')}</div>`; }
  function studioView() {
    if (!AIContentAccessService.canCreate() && !AIContentAccessService.canReview()) return `${heading('profile', 'P37 · CONTENT OPERATIONS', 'AI Content Studio', 'Khu vực này chỉ dành cho đội ngũ nội dung.') }<section class="ai-content-denied section"><span>🔒</span><h2>Không có quyền truy cập</h2><p>Vai trò Student/Teacher không thể xem bản nháp nội bộ.</p></section>`;
    if (!runtime.config) return `${heading('profile', 'P37 · CONTENT OPERATIONS', 'AI Content Studio', 'Đang tải cấu hình quality gate…')}<section class="empty-state section"><h2>Đang chuẩn bị studio</h2></section>`;
    if (!runtime.cloudLoaded && global.SupabaseService?.session?.user?.id) { runtime.cloudLoaded = true; global.setTimeout?.(() => AIContentDraftRepository.loadCloud().then(() => render()).catch(() => {}), 0); }
    const selected = AIContentDraftRepository.byId(runtime.selectedId) || AIContentDraftRepository.all()[0];
    return `${heading('profile', 'P37 · HUMAN-GUIDED AUTHORING', 'AI Content Studio', 'Tạo nhanh bản nháp, kiểm định và phê duyệt bởi con người trước khi xuất bản.')}<div class="ai-content-studio section"><section class="ai-content-guard"><div><b>AI chỉ hỗ trợ soạn thảo</b><p>Không tự quyết định curriculum · không tự phê duyệt · không tự publish.</p></div><span>Human approval required</span></section><div class="ai-workflow">${runtime.config.workflow.map((step, index) => `<span class="${selected?.status === step ? 'active' : ''}">${index + 1}. ${escapeHtml(statusLabel(step))}</span>`).join('')}</div><div class="ai-studio-grid"><section class="ai-studio-panel"><h2>Tạo bản nháp</h2><p>Context chỉ gồm thông tin nhập và ID nguồn đã duyệt — không gửi toàn bộ database.</p><form class="ai-studio-form" id="aiContentForm"><label>TOPIK level<select name="level">${runtime.config.levels.map((item) => `<option>${item}</option>`).join('')}</select></label><label>Số lượng<input name="count" type="number" min="1" max="8" value="3"></label><label class="wide">Chủ đề / grammar<input name="topic" required maxlength="160" placeholder="Ví dụ: 은/는 cho TOPIK 1"></label><label class="wide">Mục tiêu<textarea name="objective" maxlength="1200" placeholder="Người học phân biệt và dùng đúng trong câu đơn giản"></textarea></label><label class="wide">Nguồn curriculum đã duyệt (ID, cách nhau bằng dấu phẩy)<input name="sourceIds" maxlength="800" placeholder="grammar-topic-particle, lesson-topik1-03"></label><div class="ai-studio-tools"><button class="btn primary" data-ai-generate="lesson">Draft lesson</button><button class="btn secondary" data-ai-generate="example">Câu ví dụ</button><button class="btn secondary" data-ai-generate="audio">Audio script</button><button class="btn secondary" data-ai-generate="quiz">Quiz</button><button class="btn secondary" data-ai-generate="curriculum">Curriculum advice</button></div></form><p class="ai-curriculum-notice">Curriculum Assistant chỉ tạo đề xuất đọc-only. Không có hàm apply hoặc quyền ghi curriculum.</p></section><section class="ai-studio-panel"><h2>Bản nháp đang chọn</h2>${preview(selected)}</section></div><section class="ai-studio-panel"><h2>Human approval queue</h2><p>Mọi chuyển trạng thái đều ghi actor, role, timestamp và review note.</p>${queueMarkup()}</section></div>`;
  }

  async function act(button, handler) { if (runtime.busy) return; runtime.busy = true; button.disabled = true; try { await handler(); render(); } catch (error) { toast?.(clean(error.message || 'Không thể thực hiện thao tác.', 180)); button.disabled = false; } finally { runtime.busy = false; } }
  Object.assign(global, { AIContentCreationConfigService, AIContentAccessService, AIContentDraftRepository, AIContentGenerationService, AILessonAssistantService, AIExampleGeneratorService, AIDifficultyCheckerService, AITranslationReviewerService, AIAudioScriptGeneratorService, AIQuizGeneratorService, AIContentDuplicateService, CurriculumAssistantService, AIContentQualityScoreService, HumanApprovalWorkflowService, AIContentCreationPlatform: { config: AIContentCreationConfigService, access: AIContentAccessService, drafts: AIContentDraftRepository, lesson: AILessonAssistantService, examples: AIExampleGeneratorService, difficulty: AIDifficultyCheckerService, translation: AITranslationReviewerService, audioScript: AIAudioScriptGeneratorService, quiz: AIQuizGeneratorService, duplicates: AIContentDuplicateService, curriculum: CurriculumAssistantService, quality: AIContentQualityScoreService, workflow: HumanApprovalWorkflowService, version: 'p37-v1' } });
  global.KLEARN_EXTRA_VIEWS = { ...(global.KLEARN_EXTRA_VIEWS || {}), 'ai-content-studio': studioView };
  const previousAfterRender = global.KLEARN_AFTER_RENDER;
  global.KLEARN_AFTER_RENDER = () => {
    previousAfterRender?.(); if (!global.document || !state.currentUser) return;
    if (['profile', 'admin-content', 'content-platform', 'content-quality-dashboard'].includes(state.currentView) && AIContentAccessService.canCreate() && !global.document.querySelector('[data-ai-studio-entry]')) { const markup = `<section class="ai-studio-entry section" data-ai-studio-entry><div><b>AI Content Studio</b><p>Draft có cấu trúc · quality gate · human approval</p></div><button class="btn primary" data-view="ai-content-studio">Mở studio</button></section>`; const headingNode = global.document.querySelector('.page-heading'); if (headingNode) headingNode.insertAdjacentHTML('afterend', markup); else global.document.getElementById('app')?.insertAdjacentHTML('afterbegin', markup); }
    global.document.querySelector('[data-ai-studio-entry] [data-view]')?.addEventListener('click', () => setView('ai-content-studio'));
    if (state.currentView !== 'ai-content-studio') return;
    global.document.querySelectorAll('[data-ai-generate]').forEach((button) => { button.onclick = (event) => { event.preventDefault(); act(button, async () => { const form = global.document.getElementById('aiContentForm'); const data = new FormData(form); const input = { topic: data.get('topic'), pattern: data.get('topic'), objective: data.get('objective'), goal: data.get('objective'), level: data.get('level'), count: data.get('count'), sourceIds: String(data.get('sourceIds') || '').split(',').map((item) => item.trim()).filter(Boolean) }; await AIContentGenerationService.request(button.dataset.aiGenerate, input); toast?.('Đã tạo bản nháp. Cần người duyệt trước khi publish.'); }); }; });
    global.document.querySelectorAll('[data-ai-select]').forEach((button) => { button.onclick = () => { runtime.selectedId = button.dataset.aiSelect; render(); }; });
    global.document.querySelector('[data-ai-check-level]')?.addEventListener('click', (event) => act(event.currentTarget, async () => { const draft = AIContentDraftRepository.byId(event.currentTarget.dataset.aiCheckLevel); draft.difficulty = await AIDifficultyCheckerService.assess(draft.payload, draft.level); draft.quality = AIContentQualityScoreService.score(draft); AIContentDraftRepository.save(draft); }));
    global.document.querySelector('[data-ai-check-translation]')?.addEventListener('click', (event) => act(event.currentTarget, async () => { const draft = AIContentDraftRepository.byId(event.currentTarget.dataset.aiCheckTranslation); const example = draft.payload?.examples?.[0] || draft.payload || {}; draft.translationReview = await AITranslationReviewerService.reviewWithAI({ korean: example.korean || draft.payload?.korean || '', translation: example.translation || draft.payload?.translation || '', level: draft.level }); draft.quality = AIContentQualityScoreService.score(draft); AIContentDraftRepository.save(draft); }));
    global.document.querySelectorAll('[data-ai-submit]').forEach((button) => { button.onclick = () => act(button, async () => { HumanApprovalWorkflowService.submit(button.dataset.aiSubmit); toast?.('Đã gửi tới hàng đợi human review.'); }); });
    global.document.querySelectorAll('[data-ai-revise]').forEach((button) => { button.onclick = () => act(button, async () => HumanApprovalWorkflowService.requestChanges(button.dataset.aiRevise, 'Cần biên tập lại theo quality gate.')); });
    global.document.querySelectorAll('[data-ai-approve]').forEach((button) => { button.onclick = () => act(button, async () => { HumanApprovalWorkflowService.approve(button.dataset.aiApprove, 'Đã được người phụ trách nội dung kiểm tra.'); toast?.('Đã phê duyệt bởi con người.'); }); });
    global.document.querySelectorAll('[data-ai-publish]').forEach((button) => { button.onclick = () => act(button, async () => { await HumanApprovalWorkflowService.publish(button.dataset.aiPublish); toast?.('Đã publish nội dung được human-approved.'); }); });
  };
  AIContentCreationConfigService.load();
  if (state.currentUser) render();
})(window);
