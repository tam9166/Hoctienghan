/* K-Learn VN — local-first long-term learning memory and knowledge graph */
(function () {
  'use strict';
  const app = window.KLEARN_APP;
  if (!app) return;
  const { storage, state, STORAGE_KEYS, render, escapeHtml, normalizeSearch, userScoped, saveUserScoped, LearnerProfileService, CloudSyncService } = app;
  const uid = () => state.currentUser?.id || '';
  const now = () => new Date().toISOString();
  const clean = (value, limit = 600) => String(value || '').trim().slice(0, limit);
  const hash = (value) => { let h = 2166136261; for (const char of String(value)) { h ^= char.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
  const tokens = (value) => normalizeSearch(value).split(/[^\p{L}\p{N}ㄱ-ㅎㅏ-ㅣ가-힣/()-]+/u).filter((item) => item.length > 1);
  const memoryKey = STORAGE_KEYS.aiMemory;
  const progressKey = STORAGE_KEYS.knowledgeProgress;

  const LearningMemoryService = {
    all() { return userScoped(memoryKey); },
    upsert(input = {}, options = {}) {
      if (!uid()) return null;
      const type = clean(input.type || 'weak_knowledge', 40); const topic = clean(input.topic || 'general', 120); const content = clean(input.content);
      if (!content) return null;
      const id = input.id || `memory-${hash(`${type}|${normalizeSearch(topic)}`)}`;
      const list = this.all(); const existing = list.find((item) => item.id === id || (item.type === type && normalizeSearch(item.topic) === normalizeSearch(topic)));
      const next = { ...(existing || {}), id, user_id: uid(), type, topic, content, confidence: Math.max(Number(existing?.confidence || 0), Math.min(1, Number(input.confidence ?? .6))), importance: Math.max(Number(existing?.importance || 0), Math.min(5, Number(input.importance || 3))), times_reviewed: Math.max(1, Number(existing?.times_reviewed || 0) + (options.increment ? 1 : 0)), created_at: existing?.created_at || input.created_at || now(), last_used_at: options.used ? now() : (existing?.last_used_at || null), updated_at: now(), source: clean(input.source || existing?.source || 'learning-signal', 80) };
      const unchanged = existing && ['content','confidence','importance','source'].every((key) => existing[key] === next[key]) && !options.increment && !options.used;
      if (unchanged) return existing;
      saveUserScoped(memoryKey, [next, ...list.filter((item) => item.id !== existing?.id && item.id !== id)].sort((a, b) => b.importance - a.importance || new Date(b.updated_at) - new Date(a.updated_at)), 120);
      return next;
    },
    captureQuery(query = '') {
      const text = clean(query, 1000); const normalized = normalizeSearch(text); if (!text) return [];
      const results = []; const grammar = ['은/는', '이/가', '을/를', '-(으)려고 하다', '려고 하다'].find((item) => text.includes(item));
      if (grammar && /(phan biet|nham|kho|khong hieu|hay sai|sai)/i.test(normalized)) results.push(this.upsert({ type: 'weak_knowledge', topic: grammar.includes('은/는') || grammar.includes('이/가') ? '은/는 vs 이/가' : grammar, content: grammar.includes('은/는') || grammar.includes('이/가') ? 'Hay nhầm 은/는 và 이/가' : `Đang gặp khó khăn với ${grammar}`, confidence: .72, importance: 4, source: 'ai-question' }, { increment: true }));
      if (/ví dụ thực tế|tình huống thực tế/i.test(text)) results.push(this.upsert({ type: 'learning_preference', topic: 'example_style', content: 'Học tốt hơn với ví dụ thực tế', confidence: .82, importance: 3, source: 'explicit-preference' }, { increment: true }));
      if (/giải thích.*tiếng việt|tiếng việt.*giải thích/i.test(text)) results.push(this.upsert({ type: 'learning_preference', topic: 'explanation_language', content: 'Ưu tiên giải thích bằng tiếng Việt', confidence: .95, importance: 4, source: 'explicit-preference' }, { increment: true }));
      const topik = text.match(/topik\s*([1-6])/i); if (topik) results.push(this.upsert({ type: 'learning_goal', topic: 'topik', content: `Mục tiêu TOPIK ${topik[1]}`, confidence: .9, importance: 5, source: 'ai-question' }));
      return results.filter(Boolean);
    },
    touch(ids = []) { const wanted = new Set(ids); if (!wanted.size) return; const list = this.all(); const stamp = Date.now(); let changed = false; list.forEach((item) => { if (wanted.has(item.id) && (!item.last_used_at || stamp - new Date(item.last_used_at).getTime() > 3600000)) { item.last_used_at = now(); item.updated_at = item.last_used_at; changed = true; } }); if (changed) saveUserScoped(memoryKey, list, 120); },
    captureError(error = {}, options = {}) { const topic = clean(error.question || error.type || 'mistake', 120); return this.upsert({ type: Number(error.count || 1) >= 2 ? 'repeated_mistake' : 'weak_knowledge', topic, content: clean(error.mistake || error.question), confidence: Math.min(.98, .55 + Number(error.count || 1) * .08), importance: Math.min(5, 2 + Math.ceil(Number(error.count || 1) / 2)), source: 'error-notebook' }, { increment: options.increment !== false }); },
    refreshDerived() {
      if (!uid()) return;
      const profile = LearnerProfileService.get() || {}; const target = Number(profile.targetTopikLevel || state.currentUser?.targetTopikLevel || 2);
      this.upsert({ type: 'learning_goal', topic: 'topik', content: `Mục tiêu TOPIK ${target}`, confidence: .98, importance: 5, source: 'learner-profile' });
      this.upsert({ type: 'learning_preference', topic: 'explanation_language', content: 'Ưu tiên giải thích bằng tiếng Việt', confidence: .9, importance: 3, source: 'app-language' });
      this.upsert({ type: 'learning_preference', topic: 'learning_style', content: `Phong cách học: ${profile.learningStyle || 'visual'}`, confidence: .98, importance: 4, source: 'learner-profile' });
      this.upsert({ type: 'learning_preference', topic: 'learning_mode', content: `Chế độ học: ${profile.learningMode || 'casual'}`, confidence: .98, importance: 4, source: 'learner-profile' });
      this.upsert({ type: 'learning_preference', topic: 'explanation_style', content: `Cách giải thích: ${profile.explanationStyle || 'step-by-step'}`, confidence: .98, importance: 4, source: 'learner-profile' });
      (profile.strengths || []).slice(0, 3).forEach((skill) => this.upsert({ type: 'strong_knowledge', topic: skill, content: `${skill} là kỹ năng mạnh`, confidence: .75, importance: 3, source: 'mastery-analysis' }));
      (profile.weakSkills || []).slice(0, 3).forEach((skill) => this.upsert({ type: 'weak_knowledge', topic: skill, content: `${skill} cần được củng cố`, confidence: .78, importance: 4, source: 'mastery-analysis' }));
      (profile.weakGrammar || []).slice(0, 5).forEach((item) => this.upsert({ type: 'weak_knowledge', topic: item.topic || item, content: `Ngữ pháp cần ôn: ${item.topic || item}`, confidence: .82, importance: 4, source: 'grammar-analysis' }));
      (profile.weakVocabulary || []).slice(0, 8).forEach((item) => this.upsert({ type: 'weak_knowledge', topic: item.korean || item.id || 'vocabulary', content: `Từ hay quên: ${item.korean || item.id}`, confidence: .8, importance: 3, source: 'srs-analysis' }));
      (window.ErrorNotebookService?.top?.(10) || []).filter((item) => Number(item.count || 1) >= 2).forEach((item) => this.captureError(item, { increment: false }));
    },
    summary() { const list = this.all(); const by = (type) => list.filter((item) => item.type === type).slice(0, 5); return { strengths: by('strong_knowledge'), weaknesses: [...by('repeated_mistake'), ...by('weak_knowledge')].slice(0, 5), preferences: by('learning_preference'), goals: by('learning_goal') }; }
  };

  const CORE_NODES = [
    { id: 'korean', type: 'root', label: '한국어', level: 'ALL', related: ['grammar', 'vocabulary'] },
    { id: 'grammar', type: 'category', label: 'Grammar', level: 'ALL', related: ['grammar_particles', 'grammar_eun_neun', 'grammar_i_ga', 'grammar_eul_reul', 'grammar_euryeogo'] },
    { id: 'grammar_particles', type: 'grammar_cluster', label: 'Trợ từ chủ đề và chủ ngữ', level: 'TOPIK1', related: ['grammar_eun_neun', 'grammar_i_ga', 'grammar_eul_reul'] },
    { id: 'grammar_eun_neun', type: 'grammar', label: '은/는', level: 'TOPIK1', related: ['grammar_i_ga', 'grammar_eul_reul', 'grammar_particles'], aliases: ['trợ từ chủ đề'] },
    { id: 'grammar_i_ga', type: 'grammar', label: '이/가', level: 'TOPIK1', related: ['grammar_eun_neun', 'grammar_eul_reul', 'grammar_particles'], aliases: ['trợ từ chủ ngữ'] },
    { id: 'grammar_eul_reul', type: 'grammar', label: '을/를', level: 'TOPIK1', related: ['grammar_eun_neun', 'grammar_i_ga', 'grammar_particles'], aliases: ['trợ từ tân ngữ'] },
    { id: 'grammar_euryeogo', type: 'grammar', label: '-(으)려고 하다', level: 'TOPIK2', related: ['grammar', 'vocab_study'], aliases: ['려고 하다', 'mục đích'] },
    { id: 'vocabulary', type: 'category', label: 'Vocabulary', level: 'ALL', related: ['vocab_school', 'vocab_student', 'vocab_teacher', 'vocab_class', 'vocab_study'] },
    { id: 'vocab_school', type: 'vocabulary', label: '학교', meaning: 'trường học', level: 'TOPIK1', topic: 'school', related: ['vocab_student', 'vocab_teacher', 'vocab_class', 'vocab_study'] },
    { id: 'vocab_student', type: 'vocabulary', label: '학생', meaning: 'học sinh', level: 'TOPIK1', topic: 'school', related: ['vocab_school', 'vocab_teacher', 'vocab_class', 'vocab_study'] },
    { id: 'vocab_teacher', type: 'vocabulary', label: '선생님', meaning: 'giáo viên', level: 'TOPIK1', topic: 'school', related: ['vocab_school', 'vocab_student', 'vocab_class'] },
    { id: 'vocab_class', type: 'vocabulary', label: '수업', meaning: 'lớp học', level: 'TOPIK1', topic: 'school', related: ['vocab_school', 'vocab_student', 'vocab_study'] },
    { id: 'vocab_study', type: 'vocabulary', label: '공부', meaning: 'học tập', level: 'TOPIK1', topic: 'school', related: ['vocab_school', 'vocab_student', 'vocab_class', 'grammar_euryeogo'] }
  ];
  let nodeCache = null; let weaknessCache = { signature: '', value: [] };
  const KnowledgeGraphService = {
    nodes() { if (nodeCache) return nodeCache; const seen = new Set(CORE_NODES.map((node) => node.label)); const entries = (window.KLEARN_DICTIONARY || []).filter((item) => item?.korean && !seen.has(item.korean)).slice(0, 1600); const groups = new Map(); entries.forEach((item) => { const topic = clean(item.topic || item.tags?.[0] || 'general', 80); const id = `dict_${clean(item.id || hash(item.korean), 100)}`; if (!groups.has(topic)) groups.set(topic, []); groups.get(topic).push(id); }); const dynamic = entries.map((item) => { const topic = clean(item.topic || item.tags?.[0] || 'general', 80); const id = `dict_${clean(item.id || hash(item.korean), 100)}`; return { id, type: 'vocabulary', label: item.korean, meaning: item.meanings?.vi || item.meaningVi || '', level: `TOPIK${Number(item.topikLevel || 1)}`, topic, related: (groups.get(topic) || []).filter((other) => other !== id).slice(0, 6) }; }); nodeCache = [...CORE_NODES, ...dynamic]; return nodeCache; },
    progress() { return userScoped(progressKey); },
    get(query) { const q = normalizeSearch(query); if (!q) return null; return this.nodes().find((node) => node.id === query || [node.label, node.meaning, ...(node.aliases || [])].filter(Boolean).some((value) => normalizeSearch(value).includes(q) || q.includes(normalizeSearch(value)))) || null; },
    related(query, limit = 8) { const node = typeof query === 'object' ? query : this.get(query); if (!node) return []; const ids = new Set(node.related || []); return this.nodes().filter((item) => ids.has(item.id)).slice(0, limit); },
    record(nodeId, outcome = {}) { if (!uid() || !this.nodes().some((node) => node.id === nodeId)) return null; const list = this.progress(); const current = list.find((item) => item.node_id === nodeId); const correct = Boolean(outcome.correct); const next = { ...(current || {}), id: current?.id || `knowledge-${uid()}-${nodeId}`, user_id: uid(), node_id: nodeId, attempts: Number(current?.attempts || 0) + 1, correct_count: Number(current?.correct_count || 0) + (correct ? 1 : 0), wrong_count: Number(current?.wrong_count || 0) + (correct ? 0 : 1), mastery: Math.max(0, Math.min(100, Number(current?.mastery || 0) + (correct ? 8 : -12))), last_practiced: now(), updated_at: now() }; saveUserScoped(progressKey, [next, ...list.filter((item) => item.node_id !== nodeId)], 500); return next; },
    weaknessAnalysis() {
      const errors = window.ErrorNotebookService?.top?.(50) || []; const memories = LearningMemoryService.all().filter((item) => ['weak_knowledge','repeated_mistake'].includes(item.type)); const progress = this.progress(); const signature = `${errors.map((item) => `${item.id}:${item.count}:${item.resolved}`).join('|')}#${memories.map((item) => `${item.id}:${item.updated_at}`).join('|')}#${progress.map((item) => `${item.node_id}:${item.updated_at}`).join('|')}`; if (weaknessCache.signature === signature) return weaknessCache.value;
      const value = this.nodes().map((node) => { const terms = [node.label, node.meaning, ...(node.aliases || [])].filter(Boolean).map(normalizeSearch); const errorCount = errors.filter((item) => terms.some((term) => normalizeSearch(`${item.question} ${item.mistake} ${item.correction}`).includes(term))).reduce((sum, item) => sum + Number(item.count || 1), 0); const memoryCount = memories.filter((item) => terms.some((term) => normalizeSearch(`${item.topic} ${item.content}`).includes(term))).length; const saved = progress.find((item) => item.node_id === node.id); const weaknessScore = errorCount * 2 + memoryCount * 2 + (saved && (saved.mastery < 50 || saved.wrong_count >= 2) ? 2 : 0); return { ...node, weaknessScore, mastery: saved?.mastery ?? null }; }).filter((node) => node.weaknessScore > 0).sort((a, b) => b.weaknessScore - a.weaknessScore || a.id.localeCompare(b.id)); weaknessCache = { signature, value }; return value;
    },
    isWeakTopic(topic) { const q = normalizeSearch(topic); return this.weaknessAnalysis().some((node) => normalizeSearch(`${node.id} ${node.label} ${node.topic || ''}`).includes(q) || q.includes(normalizeSearch(node.label))); },
    context(query = '', limit = 6) { const direct = this.get(query); const candidates = direct ? [direct, ...this.related(direct, limit)] : this.weaknessAnalysis(); const progress = this.progress(); return candidates.slice(0, limit).map((node) => ({ id: node.id, type: node.type, label: node.label, related: (node.related || []).slice(0, 6), mastery: progress.find((item) => item.node_id === node.id)?.mastery ?? null })); }
  };

  const MemoryRetrievalService = {
    retrieve(query = '', options = {}) { const limit = Math.max(1, Math.min(10, Number(options.limit || 6))); const queryTokens = new Set(tokens(query)); const graphTerms = new Set(KnowledgeGraphService.context(query, 6).flatMap((node) => tokens(`${node.id} ${node.label}`))); const scored = LearningMemoryService.all().map((item) => { const itemTokens = tokens(`${item.topic} ${item.content} ${item.type}`); const overlap = itemTokens.filter((token) => queryTokens.has(token) || graphTerms.has(token)).length; const alwaysRelevant = item.type === 'learning_goal' || item.type === 'learning_preference'; return { item, score: overlap * 4 + Number(item.importance || 0) + (alwaysRelevant ? 2 : 0) + (item.type === 'repeated_mistake' ? 2 : 0) }; }).filter(({ score }) => score > 2).sort((a, b) => b.score - a.score || new Date(b.item.updated_at) - new Date(a.item.updated_at)).slice(0, limit); LearningMemoryService.touch(scored.map(({ item }) => item.id)); return scored.map(({ item }) => ({ id: item.id, type: item.type, topic: item.topic, content: item.content, confidence: item.confidence, importance: item.importance, source: item.source })); }
  };

  function dnaCard() { const dna = LearningMemoryService.summary(); const graph = KnowledgeGraphService.weaknessAnalysis().slice(0, 3); const chips = (items, fallback) => items.length ? items.map((item) => `<span class="memory-chip">${escapeHtml(item.content || item)}</span>`).join('') : `<span class="subtle">${fallback}</span>`; return `<section class="card section learning-dna"><div class="section-heading"><div><p class="eyebrow">Hồ sơ học tập</p><h2 class="section-title">Xu hướng học tập</h2></div><span class="sync-status">${LearningMemoryService.all().length} ghi nhớ</span></div><div class="dna-grid"><div><h3>✓ Điểm mạnh</h3><div class="memory-chip-list">${chips(dna.strengths, 'Đang thu thập dữ liệu')}</div></div><div><h3>⚠ Điểm yếu</h3><div class="memory-chip-list">${chips(dna.weaknesses, 'Chưa có tín hiệu rõ')}</div></div><div><h3>Phong cách học</h3><div class="memory-chip-list">${chips(dna.preferences, 'Chưa ghi nhận lựa chọn')}</div></div><div><h3>Chủ đề cần cải thiện</h3><div class="memory-chip-list">${graph.length ? graph.map((node) => `<span class="memory-chip">${escapeHtml(node.label)} · ${node.weaknessScore}</span>`).join('') : '<span class="subtle">Chưa phát hiện điểm yếu rõ</span>'}</div></div></div><p class="subtle">Chỉ lưu tín hiệu học tập quan trọng theo tài khoản; không lưu password, token hoặc toàn bộ hội thoại.</p></section>`; }
  function coachMemoryCard() { const memories = MemoryRetrievalService.retrieve('grammar vocabulary speaking listening goal', { limit: 3 }); const graph = KnowledgeGraphService.weaknessAnalysis()[0]; return `<section class="card section memory-insight"><p class="eyebrow">Ghi nhớ học tập</p><h2 class="section-title">Điểm cần lưu ý</h2>${memories.length ? `<ul>${memories.map((item) => `<li>${escapeHtml(item.content)}</li>`).join('')}</ul>` : '<p class="subtle">Hệ thống sẽ ghi nhận điểm yếu, mục tiêu và sở thích khi có đủ dữ liệu.</p>'}${graph ? `<p class="subtle">Nội dung đang được ưu tiên <b>${escapeHtml(graph.label)}</b> và các kiến thức liên quan.</p>` : ''}</section>`; }

  window.LearningMemoryService = LearningMemoryService;
  window.MemoryRetrievalService = MemoryRetrievalService;
  window.KnowledgeGraphService = KnowledgeGraphService;
  const previousAfterRender = window.KLEARN_AFTER_RENDER;
  window.KLEARN_AFTER_RENDER = () => { previousAfterRender?.(); if (!state.currentUser) return; LearningMemoryService.refreshDerived(); if (state.currentView === 'profile' && !document.querySelector('.learning-dna')) document.getElementById('app')?.insertAdjacentHTML('afterbegin', dnaCard()); if (state.currentView === 'ai-coach' && !document.querySelector('.memory-insight')) document.getElementById('app')?.insertAdjacentHTML('afterbegin', coachMemoryCard()); };
  render();
})();
