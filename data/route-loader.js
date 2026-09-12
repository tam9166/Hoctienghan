/* Tiếng Hàn - TamHoanq · route-level asset loader (no user data). */
(() => {
  'use strict';
  const groups = Object.freeze({
    resources: { scripts: ['data/resource-library.js?v=1', 'data/content-review.js?v=2'] },
    topik: { scripts: ['data/topik-strategy.js?v=1'] },
    ai: { scripts: ['data/ai-coach.js?v=6', 'data/learning-memory.js?v=3', 'data/personal-intelligence.js?v=3', 'data/learning-intelligence-data.js?v=1', 'data/learning-intelligence.js?v=2'] },
    intelligenceMemory: { dependencies: ['ai'], styles: ['learning-intelligence-memory.css?v=1'], scripts: ['data/learning-intelligence-memory.js?v=1'] },
    realKoreanExperience: { dependencies: ['voice', 'conversation', 'languageMastery', 'practical'], styles: ['real-korean-experience.css?v=1'], scripts: ['data/real-korean-experience.js?v=1'] },
    practical: { scripts: ['data/practical-study.js?v=4'] },
    scale: { scripts: ['data/ecosystem-scale.js?v=8'] },
    conversation: { scripts: ['data/conversation-scenarios.js?v=1', 'data/conversation-simulator.js?v=1'] },
    context: { scripts: ['data/korean-context-data.js?v=1', 'data/korean-context-system.js?v=1'] },
    reading: { scripts: ['data/reading-expansion-data.js?v=1', 'data/reading-expansion.js?v=1'] },
    longTerm: { scripts: ['data/long-term-ecosystem-data.js?v=1', 'data/long-term-ecosystem.js?v=1'] },
    languageMastery: { styles: ['language-mastery.css?v=1'], scripts: ['data/language-mastery-data.js?v=1', 'data/language-mastery.js?v=1'] },
    immersion: { styles: ['immersion-motivation.css?v=1'], scripts: ['data/immersion-motivation-data.js?v=1', 'data/immersion-motivation.js?v=1'] },
    education: { styles: ['education-platform.css?v=1', 'education-ecosystem.css?v=1'], scripts: ['data/education-platform-data.js?v=2', 'data/education-platform.js?v=2', 'data/education-ecosystem-platform.js?v=1'] },
    immersive: { styles: ['immersive-world.css?v=1'], scripts: ['data/immersive-world-data.js?v=1', 'data/immersive-world.js?v=1'] },
    ecosystem: { styles: ['ecosystem-expansion.css?v=1'], scripts: ['data/ecosystem-expansion.js?v=2'] },
    analytics: { styles: ['learning-analytics.css?v=1'], scripts: ['data/learning-analytics-engine.js?v=1'] },
    realWorld: { styles: ['real-world-assistant.css?v=1'], scripts: ['data/real-world-assistant.js?v=2'] },
    content: { styles: ['advanced-content-platform.css?v=1'], scripts: ['data/advanced-content-platform.js?v=1'] },
    communityLearning: { styles: ['community-learning.css?v=1'], scripts: ['data/community-learning.js?v=1'] },
    enterprise: { styles: ['enterprise-platform.css?v=1'], scripts: ['data/enterprise-platform.js?v=1'] },
    retention: { dependencies: ['practical'], styles: ['retention-system.css?v=1'], scripts: ['data/retention-system.js?v=1'] },
    contentQuality: { dependencies: ['content'], styles: ['content-quality.css?v=1'], scripts: ['data/content-quality-system.js?v=2'] },
    aiInfra: { styles: ['ai-quality.css?v=1'], scripts: ['data/ai-infrastructure.js?v=5', 'data/ai-quality-optimization.js?v=1'] },
    globalLanguage: { styles: ['global-language-platform.css?v=1', 'global-language-core.css?v=1'], scripts: ['data/global-language-platform.js?v=2', 'data/global-language-core-v2.js?v=1'] },
    advancedAnalytics: { scripts: ['data/advanced-learning-analytics.js?v=1'] },
    edtech: { styles: ['edtech-business-intelligence.css?v=1'], scripts: ['data/edtech-business-intelligence.js?v=1'] },
    premium: { styles: ['premium-learning.css?v=1'], scripts: ['data/premium-learning-experience.js?v=1'] },
    globalAi: { styles: ['global-ai-companion.css?v=1'], scripts: ['data/global-ai-language-companion.js?v=1'] },
    voice: { dependencies: ['aiInfra'], styles: ['advanced-voice.css?v=2', 'realtime-voice-coach.css?v=1'], scripts: ['data/advanced-voice.js?v=2', 'data/realtime-voice-coach.js?v=1'] },
    aiContent: { dependencies: ['aiInfra'], styles: ['ai-content-creation.css?v=1'], scripts: ['data/ai-content-creation.js?v=1'] },
    community: { dependencies: ['communityLearning'], styles: ['community-ecosystem.css?v=1'], scripts: ['data/community-ecosystem.js?v=1'] },
    monetization: { dependencies: ['enterprise'], styles: ['monetization-foundation.css?v=1', 'premium-monetization.css?v=1'], scripts: ['data/monetization-foundation.js?v=1', 'data/premium-monetization-architecture.js?v=1'] },
    futureLanguage: { styles: ['future-language-platform.css?v=1'], scripts: ['data/future-language-platform.js?v=1'] },
    science: { styles: ['learning-science.css?v=1'], scripts: ['data/learning-science-engine.js?v=1'] },
    career: { styles: ['career-learning.css?v=1'], scripts: ['data/career-learning-ecosystem.js?v=2'] },
    agents: { styles: ['ai-agent-architecture.css?v=1'], scripts: ['data/ai-agent-architecture.js?v=1'] },
    aiLanguageOs: { dependencies: ['ai', 'intelligenceMemory', 'aiInfra', 'globalAi', 'agents', 'globalLanguage', 'advancedAnalytics', 'content'], styles: ['ai-language-os.css?v=1'], scripts: ['data/ai-language-operating-system.js?v=1'] },
    immersiveKorean: { dependencies: ['immersive'], styles: ['immersive-korean-world.css?v=2'], scripts: ['data/immersive-korean-world.js?v=2'] },
    marketplace: { styles: ['global-education-marketplace.css?v=1'], scripts: ['data/global-education-marketplace.js?v=1'] },
    outcomes: { styles: ['learning-outcomes.css?v=1'], scripts: ['data/learning-outcomes.js?v=1'] },
    growth: { styles: ['product-growth.css?v=1'], scripts: ['data/product-growth.js?v=1'] },
    demo: { styles: ['product-demo.css?v=1'], scripts: ['data/product-demo.js?v=1'] },
    competitiveContent: { styles: ['content-competitive.css?v=1'], scripts: ['data/content-competitive-upgrade.js?v=1'] }
  });

  const routeGroups = new Map();
  const routes = (names, groupNames) => names.split(' ').filter(Boolean).forEach((route) => routeGroups.set(route, groupNames));
  routes('resources resource-view videos video-view review-dashboard support', ['resources']);
  routes('strategy-lab strategy-detail topik-strategy-center', ['topik']);
  routes('ai-coach adaptive-plan personal-report journey-intelligence', ['aiLanguageOs']);
  routes('ai-language-os', ['aiLanguageOs']);
  routes('learning-intelligence-memory learning-diagnostic learning-prescription learning-goal-simulator', ['intelligenceMemory']);
  routes('real-korean-experience pronunciation-lab-vn sentence-mining media-learning-real real-conversation-lab real-shadowing-lab', ['realKoreanExperience']);
  routes('placement onboarding-result', ['intelligenceMemory']);
  routes('grammar-compare grammar-notebook typing-trainer repair-path focus-study chapter-checkpoint study-calendar progress-timeline achievements admin-content vocabulary-collections sentence-builder real-life-missions study-settings error-notebook manual-review-queue offline-packs shadowing-recorder', ['practical', 'scale']);
  routes('conversation-simulator', ['conversation']);
  routes('natural-korean', ['context']);
  routes('reading-lab reading-session word-network collocation-trainer dictation-master', ['context', 'reading']);
  routes('topik-strategy-center real-goal-planner learning-journal teacher-review manual-review-queue teacher-workspace community-hub personal-report', ['longTerm']);
  routes('language-mastery subtitle-learning vocabulary-image-memory grammar-mastery', ['languageMastery']);
  routes('immersion-journey survival-kit media-learning slang-dictionary daily-korean-feed monthly-challenge achievement-room personal-portfolio', ['immersion']);
  routes('education-platform teacher-dashboard organization-center education-assignments education-feedback course-builder organization-analytics education-content education-ecosystem assessment-center creator-workflow school-report education-certificates', ['education']);
  routes('immersive-world virtual-korean-city immersive-session roleplay-game debate-studio career-korean university-life travel-simulator voice-world speaking-journey learning-avatar-research', ['immersive']);
  routes('ecosystem-expansion real-korean-life life-simulator document-reader address-number-trainer language-science korean-thinking skill-world career-purpose career-practice learning-architecture', ['ecosystem']);
  routes('analytics progress-reports learning-outcomes student-progress-report', ['analytics', 'advancedAnalytics', 'outcomes']);
  routes('teacher-outcomes', ['education', 'outcomes']);
  routes('growth-center', ['retention', 'monetization', 'community', 'outcomes', 'growth']);
  routes('invite-friends', ['monetization', 'community', 'growth']);
  routes('growth-analytics', ['retention', 'growth']);
  routes('product-experiments', ['growth']);
  routes('demo demo-center', ['demo']);
  routes('vietnamese-korean-core', ['competitiveContent']);
  routes('real-world-assistant korean-document-assistant korean-menu-reader korean-sign-reader real-world-guide survival-checklist', ['realWorld']);
  routes('content-platform content-explorer content-detail korean-notebook content-feedback', ['content']);
  routes('learning-community study-groups community-challenge peer-practice community-questions community-profile community-safety', ['communityLearning']);
  routes('enterprise-platform subscription-center premium-features school-management center-dashboard course-marketplace certification-center partner-api admin-analytics language-platform', ['enterprise', 'edtech', 'premium', 'growth']);
  routes('retention-center weekly-review monthly-reflection goal-milestones retention-analytics', ['retention']);
  routes('content-quality-dashboard', ['content', 'contentQuality']);
  routes('language-exchange community-moderation', ['community']);
  routes('business-center billing-center organization-plans revenue-center crm-center', ['enterprise', 'monetization']);
  routes('premium-center subscription-admin', ['monetization']);
  routes('future-language-platform cross-language-lab language-brain future-integrations global-course-marketplace', ['globalLanguage', 'futureLanguage']);
  routes('global-language-platform global-language-profiles global-exam-framework global-language-comparison global-expansion', ['globalLanguage']);
  routes('global-language-onboarding global-writing-system global-content-packs global-language-search global-adaptive-plan', ['globalLanguage']);
  routes('learning-science active-recall interleaved-practice concept-mastery', ['science']);
  routes('career-center career-vocabulary workplace-scenarios workplace-scenario job-interview-trainer korean-resume-builder business-email-writing presentation-coach workplace-culture career-report', ['career']);
  routes('advanced-voice voice-session voice-history voice-goals voice-report realtime-voice-coach voice-coach-session voice-coach-journey', ['voice']);
  routes('ai-content-studio', ['aiContent']);
  routes('immersive-daily-life immersive-story immersive-culture-game immersive-readiness immersive-scenarios immersive-progress-map', ['immersiveKorean']);
  routes('global-education-marketplace marketplace-course marketplace-teacher creator-studio marketplace-moderation creator-revenue marketplace-certificates', ['enterprise', 'marketplace']);
  // Extension modules decorate these base hubs and must run after the base module.
  routes('content-platform content-explorer content-detail korean-notebook content-feedback content-quality-dashboard', ['contentQuality']);
  routes('learning-community', ['community']);
  routes('immersive-world', ['immersiveKorean']);

  // Category pages load their discovery extensions only after the user enters them.
  routes('lessons', ['resources', 'practical', 'scale', 'conversation', 'context', 'reading', 'languageMastery', 'immersion', 'immersive', 'ecosystem', 'realWorld', 'content', 'career', 'immersiveKorean', 'marketplace', 'competitiveContent', 'realKoreanExperience']);
  routes('review', ['practical', 'scale', 'science']);
  routes('topik', ['topik', 'analytics', 'advancedAnalytics', 'science', 'outcomes']);
  routes('practice speaking-hub', ['voice', 'realKoreanExperience']);
  routes('home', ['growth']);
  routes('profile', ['longTerm', 'education', 'communityLearning', 'enterprise', 'retention', 'contentQuality', 'globalLanguage', 'edtech', 'premium', 'aiContent', 'community', 'monetization', 'futureLanguage', 'outcomes', 'growth', 'intelligenceMemory']);
  routes('search', ['resources', 'practical', 'context', 'content', 'competitiveContent', 'globalLanguage']);
  const discoveryRoutes = new Set(['lessons', 'review', 'topik', 'practice', 'speaking-hub', 'profile', 'search']);

  const assetPromises = new Map(); const groupPromises = new Map(); const loadedGroups = new Set();
  const absolute = (asset) => new URL(asset, document.baseURI).href;
  function loadStyle(asset) {
    const key = absolute(asset); if (assetPromises.has(key)) return assetPromises.get(key);
    const existing = [...document.styleSheets].some((sheet) => sheet.href === key);
    const promise = existing ? Promise.resolve() : new Promise((resolve, reject) => { const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = asset; link.dataset.routeAsset = asset; link.onload = resolve; link.onerror = () => { assetPromises.delete(key); link.remove(); reject(new Error(`Không tải được giao diện ${asset}`)); }; document.head.appendChild(link); });
    assetPromises.set(key, promise); return promise;
  }
  function loadScript(asset) {
    const key = absolute(asset); if (assetPromises.has(key)) return assetPromises.get(key);
    const existing = [...document.scripts].some((script) => script.src === key);
    const promise = existing ? Promise.resolve() : new Promise((resolve, reject) => { const script = document.createElement('script'); script.src = asset; script.async = false; script.dataset.routeAsset = asset; script.onload = resolve; script.onerror = () => { assetPromises.delete(key); script.remove(); reject(new Error(`Không tải được chức năng ${asset}`)); }; document.body.appendChild(script); });
    assetPromises.set(key, promise); return promise;
  }
  function loadGroup(name) {
    if (loadedGroups.has(name)) return Promise.resolve(); if (groupPromises.has(name)) return groupPromises.get(name);
    const definition = groups[name]; if (!definition) return Promise.resolve();
    const promise = (async () => { for (const dependency of definition.dependencies || []) await loadGroup(dependency); await Promise.all((definition.styles || []).map(loadStyle)); for (const script of definition.scripts || []) await loadScript(script); loadedGroups.add(name); })().catch((error) => { groupPromises.delete(name); throw error; });
    groupPromises.set(name, promise); return promise;
  }
  function pendingFor(route) { return (routeGroups.get(route) || []).filter((name) => !loadedGroups.has(name)); }

  window.KLEARN_ROUTE_LOADER = Object.freeze({
    groups,
    groupsFor(route) { return [...(routeGroups.get(route) || [])]; },
    blocking(route) { return !discoveryRoutes.has(route); },
    needs(route) { return pendingFor(route).length > 0; },
    load(route) { const pending = pendingFor(route); return pending.length ? Promise.all(pending.map(loadGroup)) : null; },
    loadGroup,
    loaded() { return [...loadedGroups]; }
  });
})();
