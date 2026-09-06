/* Tiếng Hàn - TamHoanq · P22 Enterprise Education Platform */
(function buildEnterprisePlatform(global) {
  'use strict';
  const app = global.KLEARN_APP;
  if (!app) return;
  const { state, STORAGE_KEYS, render, setView, toast, escapeHtml, userScoped, saveUserScoped, AccessControlService } = app;
  const STORE_KEY = STORAGE_KEYS.enterprisePlatform || 'klearn_enterprise_platform';
  const routes = new Set(['enterprise-platform', 'subscription-center', 'premium-features', 'school-management', 'center-dashboard', 'course-marketplace', 'certification-center', 'partner-api', 'admin-analytics', 'language-platform']);
  const runtime = state.enterprisePlatformRuntime || (state.enterprisePlatformRuntime = { content: null, loading: false, error: '' });
  const now = () => new Date().toISOString();
  const language = () => global.document?.documentElement?.lang === 'en' ? 'en' : global.document?.documentElement?.lang?.startsWith('zh') ? 'zh-CN' : 'vi';
  const localize = (value) => value && typeof value === 'object' && !Array.isArray(value) ? (value[language()] || value.vi || value.en || '') : String(value || '');
  const copy = (vi, en, zh) => localize({ vi, en, 'zh-CN': zh });
  const clean = (value, max = 160) => String(value || '').normalize('NFC').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
  const emptyStore = () => ({ version: 1, enrollments: [], courseProgress: {}, certificates: [], targetLanguage: 'ko' });
  const store = () => { const saved = userScoped(STORE_KEY)[0]; return saved && typeof saved === 'object' && !Array.isArray(saved) ? { ...emptyStore(), ...saved, enrollments: Array.isArray(saved.enrollments) ? saved.enrollments : [], courseProgress: saved.courseProgress && typeof saved.courseProgress === 'object' ? saved.courseProgress : {}, certificates: Array.isArray(saved.certificates) ? saved.certificates : [] } : emptyStore(); };
  const save = (value) => { const next = { ...emptyStore(), ...value, version: 1, updatedAt: now() }; saveUserScoped(STORE_KEY, [next], 1); return next; };
  const update = (mutator) => { const current = store(); return save(mutator(current) || current); };

  const EnterpriseContentService = {
    hydrate(value) { if (value?.verified !== true || value.reviewStatus !== 'approved' || !Array.isArray(value.plans) || !Array.isArray(value.marketplaceCourses) || !Array.isArray(value.productLanguages)) throw new Error('Enterprise content quality gate failed'); runtime.content = value; runtime.error = ''; return value; },
    async load() { if (runtime.content) return runtime.content; if (runtime.loading) return runtime.loading; runtime.loading = fetch('./content/enterprise-platform.json', { cache: 'default' }).then((response) => { if (!response.ok) throw new Error(`Enterprise content ${response.status}`); return response.json(); }).then((value) => this.hydrate(value)).catch((error) => { runtime.error = error.message || 'Enterprise content unavailable'; return null; }).finally(() => { runtime.loading = false; if (routes.has(state.currentView)) render(); }); return runtime.loading; }
  };

  const SubscriptionService = {
    metadata() { return global.SupabaseService?.session?.user?.app_metadata || {}; },
    tier() { const metadata = this.metadata(); const value = metadata.subscription_tier || metadata.subscription?.tier; return value === 'premium' ? 'premium' : 'free'; },
    status() { const metadata = this.metadata(); const tier = this.tier(); const raw = metadata.subscription_status || metadata.subscription?.status; const allowed = ['active', 'trialing', 'past_due', 'canceled', 'inactive']; return { tier, status: tier === 'free' ? 'none' : (allowed.includes(raw) ? raw : 'inactive'), source: tier === 'free' && !raw ? 'default' : 'cloud-metadata', paymentEnabled: false }; },
    activeTier() { const value = this.status(); return value.tier === 'premium' && ['active', 'trialing'].includes(value.status) ? 'premium' : 'free'; },
    plan() { return runtime.content?.plans?.find((item) => item.id === this.activeTier()) || runtime.content?.plans?.find((item) => item.id === 'free') || null; },
    entitlements() { return new Set(this.plan()?.features || ['core_learning', 'standard_practice', 'basic_progress']); },
    can(feature) { return this.entitlements().has(feature); }
  };

  const PremiumFeatureService = {
    all() { return runtime.content?.premiumFeatures || []; },
    access(featureId) { return { featureId, allowed: SubscriptionService.can(featureId), tier: SubscriptionService.tier(), source: SubscriptionService.status().source }; }
  };

  const CourseMarketplaceService = {
    catalog() { return (runtime.content?.marketplaceCourses || []).filter((item) => item.verified === true && item.status === 'approved'); },
    course(courseId) { return this.catalog().find((item) => item.id === courseId) || null; },
    accessible(course) { return Boolean(course && (course.access === 'free' || SubscriptionService.can('premium_courses'))); },
    enrollments() { return store().enrollments; },
    enrolled(courseId) { return this.enrollments().find((item) => item.courseId === courseId) || null; },
    enroll(courseId) { const course = this.course(courseId); if (!course || !this.accessible(course)) return null; const previous = this.enrolled(courseId); if (previous) return previous; const enrollment = { id: `p22-enrollment-${courseId}`, courseId, status: 'active', enrolledAt: now() }; update((value) => ({ ...value, enrollments: [enrollment, ...value.enrollments] })); return enrollment; },
    progress(courseId) { return Math.max(0, Math.min(100, Number(store().courseProgress[courseId]) || 0)); },
    recordProgress(courseId, progress) { if (!this.enrolled(courseId)) return null; const next = Math.max(this.progress(courseId), Math.max(0, Math.min(100, Math.round(Number(progress) || 0)))); update((value) => ({ ...value, courseProgress: { ...value.courseProgress, [courseId]: next } })); return next; }
  };

  const CertificationService = {
    definitions() { return runtime.content?.certificates || []; },
    all() { return store().certificates; },
    definition(certificateId) { return this.definitions().find((item) => item.id === certificateId) || null; },
    eligible(certificateId) { const item = this.definition(certificateId); return Boolean(item && CourseMarketplaceService.progress(item.courseId) >= Number(item.minimumProgress || 100)); },
    issue(certificateId) { const definition = this.definition(certificateId); if (!definition || !this.eligible(certificateId)) return null; const previous = this.all().find((item) => item.certificateId === certificateId); if (previous) return previous; const userPart = clean(state.currentUser?.id, 32).replace(/[^a-z0-9]/gi, '').slice(-8).toUpperCase() || 'LEARNER'; const certificate = { id: `p22-certificate-${certificateId}`, certificateId, courseId: definition.courseId, title: localize(definition.title), learnerId: state.currentUser?.id, issuedAt: now(), verificationCode: `TH-${userPart}-${Date.now().toString(36).toUpperCase()}`, status: 'local-preview' }; update((value) => ({ ...value, certificates: [certificate, ...value.certificates] })); return certificate; }
  };

  const SchoolManagementService = {
    role() { return AccessControlService?.role?.() || 'student'; },
    canManage() { return ['teacher', 'admin'].includes(this.role()); },
    organizations() { return this.canManage() ? (global.OrganizationService?.all?.() || []) : []; },
    classes() { return this.canManage() ? (global.OrganizationService?.classes?.() || []) : []; },
    openManagement() { if (!this.canManage()) return false; setView('organization-center'); return true; },
    openDashboard() { if (!this.canManage()) return false; setView('teacher-dashboard'); return true; }
  };

  const CenterAnalyticsService = {
    available() { return SchoolManagementService.canManage(); },
    snapshot() { if (!this.available()) return null; const classes = SchoolManagementService.classes(); const summaries = classes.map((item) => global.TeacherDashboardService?.analytics?.(item.id) || { students: 0, averageProgress: 0, studyMinutes: 0, mistakeCount: 0 }); return { organizations: SchoolManagementService.organizations().length, classes: classes.length, students: summaries.reduce((sum, item) => sum + Number(item.students || 0), 0), studyMinutes: summaries.reduce((sum, item) => sum + Number(item.studyMinutes || 0), 0), averageProgress: summaries.length ? Math.round(summaries.reduce((sum, item) => sum + Number(item.averageProgress || 0), 0) / summaries.length) : 0, dataScope: 'organization-summary-only' }; }
  };

  const PartnerApiService = {
    manifest() { return runtime.content?.partnerApi || null; },
    enabled() { return false; },
    documentationPath() { return 'docs/partner-api-v1.openapi.json'; },
    canManage() { return AccessControlService?.role?.() === 'admin'; }
  };

  const AdminAnalyticsService = {
    available() { return AccessControlService?.role?.() === 'admin'; },
    snapshot() { if (!this.available()) return null; const center = CenterAnalyticsService.snapshot() || { organizations: 0, classes: 0, students: 0, studyMinutes: 0 }; return { users: null, retention: null, learningActivity: center.studyMinutes, organizations: center.organizations, classes: center.classes, source: 'local-aggregate-preview', piiIncluded: false }; }
  };

  const ProductLanguageService = {
    all() { return runtime.content?.productLanguages || []; },
    current() { return this.all().find((item) => item.id === store().targetLanguage) || this.all()[0] || null; },
    set(languageId) { if (!this.all().some((item) => item.id === languageId && item.contentStatus === 'active')) return null; update((value) => ({ ...value, targetLanguage: languageId })); return this.current(); }
  };

  const heading = (back, eyebrow, title, description) => `<section class="ep-heading section"><button class="back-btn" data-view="${back}">←</button><div><small>${eyebrow}</small><h1>${title}</h1><p>${description}</p></div></section>`;
  const loadingView = () => `<section class="empty-state section"><h2>${copy('Đang tải nền tảng thương mại…', 'Loading commercial platform…', '正在加载商业平台…')}</h2></section>`;
  const denied = (title) => `${heading('enterprise-platform', 'ROLE-BASED ACCESS', title, copy('Quyền này được xác thực từ Supabase app metadata.', 'This permission is verified from Supabase app metadata.', '此权限通过 Supabase 应用元数据验证。'))}<section class="ep-denied section"><span>🔒</span><div><h2>${copy('Không có quyền truy cập', 'Access denied', '无访问权限')}</h2><p>${copy('Tài khoản hiện tại không thể mở dữ liệu quản trị.', 'The current account cannot open administrative data.', '当前账户无法访问管理数据。')}</p></div></section>`;

  function platformView() { if (!runtime.content) return loadingView(); const subscription = SubscriptionService.status(); const role = SchoolManagementService.role(); return `${heading('profile', 'P22 · ENTERPRISE EDUCATION', copy('Nền tảng sẵn sàng thương mại hóa', 'Commercialization-ready foundation', '商业化基础平台'), copy('Subscription, trường học, marketplace, chứng nhận và tích hợp đối tác trong một kiến trúc an toàn.', 'Subscription, schools, marketplace, certification and partner integration in a safe architecture.', '以安全架构整合订阅、学校、课程市场、认证与合作伙伴集成。'))}<section class="ep-status section"><div><small>${copy('GÓI HIỆN TẠI', 'CURRENT PLAN', '当前方案')}</small><b>${subscription.tier === 'premium' ? 'Premium' : 'Free'}</b><span>${subscription.status}</span></div><div><small>${copy('VAI TRÒ GIÁO DỤC', 'EDUCATION ROLE', '教育角色')}</small><b>${role}</b><span>${copy('Xác thực bằng cloud metadata', 'Cloud metadata verified', '云端元数据验证')}</span></div><div><small>${copy('THANH TOÁN', 'PAYMENTS', '支付')}</small><b>${copy('Chưa bật', 'Not enabled', '未启用')}</b><span>${copy('Chỉ chuẩn bị trạng thái subscription', 'Subscription state only', '仅准备订阅状态')}</span></div></section><section class="ep-launch-grid section"><button data-view="subscription-center"><span>◐</span><b>Free / Premium</b><small>${copy('Entitlement và trạng thái gói', 'Entitlements and plan status', '权益与方案状态')}</small></button><button data-view="course-marketplace"><span>▤</span><b>${copy('Kho khóa học', 'Course marketplace', '课程市场')}</b><small>${copy('Chỉ nội dung approved + verified', 'Approved and verified only', '仅已批准和验证内容')}</small></button><button data-view="certification-center"><span>✓</span><b>${copy('Chứng nhận', 'Certification', '认证')}</b><small>${copy('Dựa trên tiến độ thật', 'Based on real progress', '基于真实进度')}</small></button><button data-view="school-management"><span>校</span><b>${copy('Quản lý trường học', 'School management', '学校管理')}</b><small>${copy('Tái sử dụng tổ chức và lớp hiện có', 'Reuses existing organizations and classes', '复用现有组织和班级')}</small></button><button data-view="center-dashboard"><span>▥</span><b>${copy('Dashboard trung tâm', 'Center dashboard', '中心仪表板')}</b><small>${copy('Snapshot tổng hợp, không dữ liệu thô', 'Aggregate snapshots, no raw data', '汇总快照，无原始数据')}</small></button><button data-view="partner-api"><span>{ }</span><b>Partner API</b><small>${copy('Hợp đồng v1, chưa phát hành key', 'v1 contract, no keys issued', 'v1 契约，尚未发放密钥')}</small></button><button data-view="admin-analytics"><span>∑</span><b>Admin Analytics</b><small>${copy('Users, retention, learning activity', 'Users, retention, learning activity', '用户、留存、学习活动')}</small></button><button data-view="language-platform"><span>文</span><b>${copy('Mở rộng ngôn ngữ', 'Language expansion', '语言扩展')}</b><small>Korean · Japanese · Chinese</small></button></section>`; }

  function subscriptionView() { if (!runtime.content) return loadingView(); const current = SubscriptionService.status(); return `${heading('enterprise-platform', 'SUBSCRIPTION SYSTEM', copy('Quyền lợi rõ ràng, không thanh toán giả', 'Clear entitlements, no simulated payment', '清晰权益，不模拟支付'), copy('Gói chỉ được đọc từ metadata cloud do backend quản lý; app không cho tự nâng cấp.', 'Plans are read from backend-managed cloud metadata; the app cannot self-upgrade.', '方案来自后端管理的云元数据；应用无法自行升级。'))}<section class="ep-plan-grid section">${runtime.content.plans.map((plan) => `<article class="${plan.id === current.tier ? 'current' : ''}"><header><h2>${localize(plan.name)}</h2>${plan.id === current.tier ? `<span>${copy('Hiện tại', 'Current', '当前')}</span>` : ''}</header><p>${localize(plan.description)}</p><ul>${plan.features.map((feature) => `<li>✓ ${feature.replaceAll('_', ' ')}</li>`).join('')}</ul>${plan.id === 'premium' && current.tier === 'free' ? `<small>${copy('Thanh toán chưa được tích hợp. Không có giao dịch nào được tạo.', 'Payments are not integrated. No transaction is created.', '尚未集成支付，不会创建交易。')}</small>` : ''}</article>`).join('')}</section><section class="ep-feature-list section"><h2>Premium Features</h2>${PremiumFeatureService.all().map((item) => { const access = PremiumFeatureService.access(item.id); return `<article><span>${access.allowed ? '✓' : '○'}</span><div><b>${localize(item.title)}</b><p>${localize(item.description)}</p></div><em>${access.allowed ? copy('Đã mở', 'Included', '已包含') : 'Premium'}</em></article>`; }).join('')}</section>`; }

  function marketplaceView() { if (!runtime.content) return loadingView(); return `${heading('enterprise-platform', 'COURSE MARKETPLACE FOUNDATION', copy('Khóa học đã kiểm duyệt', 'Reviewed course catalog', '已审核课程目录'), copy('Không có mua hàng trong app; quyền Premium chỉ kiểm tra entitlement.', 'There is no in-app purchase; Premium access only checks entitlements.', '应用内不购买；高级访问仅检查权益。'))}<section class="ep-course-grid section">${CourseMarketplaceService.catalog().map((course) => { const accessible = CourseMarketplaceService.accessible(course); const enrollment = CourseMarketplaceService.enrolled(course.id); const progress = CourseMarketplaceService.progress(course.id); return `<article><header><span>${escapeHtml(course.difficulty)} · ${course.access}</span><em>✓ verified</em></header><h2>${localize(course.title)}</h2><p>${localize(course.description)}</p><dl><div><dt>${copy('Đơn vị', 'Provider', '提供方')}</dt><dd>${escapeHtml(course.provider)}</dd></div><div><dt>Modules</dt><dd>${course.modules}</dd></div></dl>${enrollment ? `<div class="ep-progress"><i style="width:${progress}%"></i></div><small>${progress}% ${copy('hoàn thành', 'complete', '完成')}</small>` : ''}<button class="btn ${accessible ? 'primary' : 'secondary'}" data-market-enroll="${course.id}" ${enrollment || !accessible ? 'disabled' : ''}>${enrollment ? copy('Đã tham gia', 'Enrolled', '已加入') : accessible ? copy('Tham gia khóa', 'Enroll', '加入课程') : 'Premium'}</button></article>`; }).join('')}</section>`; }

  function certificationView() { if (!runtime.content) return loadingView(); return `${heading('enterprise-platform', 'CERTIFICATION SYSTEM', copy('Chứng nhận dựa trên bằng chứng học tập', 'Evidence-based certification', '基于学习证据的认证'), copy('Bản hiện tại là preview cục bộ; backend cần ký trước khi dùng để xác minh bên ngoài.', 'Current certificates are local previews; backend signing is required for external verification.', '当前证书为本地预览；外部验证需要后端签名。'))}<section class="ep-certificate-list section">${CertificationService.definitions().map((item) => { const existing = CertificationService.all().find((value) => value.certificateId === item.id); const eligible = CertificationService.eligible(item.id); const progress = CourseMarketplaceService.progress(item.courseId); return `<article><span class="ep-seal">TH</span><div><small>${progress}% / ${item.minimumProgress}%</small><h2>${localize(item.title)}</h2><p>${existing ? `${escapeHtml(existing.verificationCode)} · local preview` : eligible ? copy('Đã đủ điều kiện tạo preview.', 'Eligible to create a preview.', '可创建预览。') : copy('Hoàn thành khóa học để đủ điều kiện.', 'Complete the course to become eligible.', '完成课程后可获得资格。')}</p></div><button class="btn secondary" data-certificate-issue="${item.id}" ${!eligible || existing ? 'disabled' : ''}>${existing ? copy('Đã tạo', 'Created', '已创建') : copy('Tạo preview', 'Create preview', '创建预览')}</button></article>`; }).join('')}</section>`; }

  function schoolView() { if (!SchoolManagementService.canManage()) return denied(copy('Quản lý trường học', 'School management', '学校管理')); return `${heading('enterprise-platform', 'SCHOOL MANAGEMENT', copy('School và Center dùng chung nền tảng lớp học', 'Shared school and center class foundation', '学校与中心共享班级基础'), copy('Tổ chức, lớp và roster tiếp tục dùng Education Platform hiện có.', 'Organizations, classes and rosters continue using the existing Education Platform.', '组织、班级和名单继续使用现有教育平台。'))}<section class="ep-management-summary section"><article><small>${copy('ĐƠN VỊ', 'ORGANIZATIONS', '组织')}</small><b>${SchoolManagementService.organizations().length}</b></article><article><small>${copy('LỚP HỌC', 'CLASSES', '班级')}</small><b>${SchoolManagementService.classes().length}</b></article><button class="btn primary" data-open-school-management>${copy('Mở quản lý lớp', 'Open class management', '打开班级管理')}</button></section>`; }

  function centerView() { if (!CenterAnalyticsService.available()) return denied(copy('Dashboard trung tâm', 'Center dashboard', '中心仪表板')); const value = CenterAnalyticsService.snapshot(); return `${heading('enterprise-platform', 'CENTER DASHBOARD', copy('Tổng quan tiến độ học viên', 'Student progress overview', '学员进度概览'), copy('Chỉ dùng snapshot tổng hợp; không đọc journal, chat hay recording.', 'Uses aggregate snapshots only; journals, chats and recordings are excluded.', '仅使用汇总快照；不读取日志、聊天或录音。'))}<section class="ep-metrics section"><article><small>${copy('Đơn vị', 'Organizations', '组织')}</small><b>${value.organizations}</b></article><article><small>${copy('Lớp', 'Classes', '班级')}</small><b>${value.classes}</b></article><article><small>${copy('Học viên', 'Students', '学员')}</small><b>${value.students}</b></article><article><small>${copy('Tiến độ TB', 'Avg progress', '平均进度')}</small><b>${value.averageProgress}%</b></article></section><section class="ep-data-boundary section"><b>${copy('Ranh giới dữ liệu', 'Data boundary', '数据边界')}</b><p>${value.dataScope} · ${copy('Không chứa PII hoặc nội dung cá nhân thô.', 'No PII or raw personal content.', '不含个人身份信息或原始私人内容。')}</p><button class="btn secondary" data-open-center-dashboard>${copy('Xem dashboard giáo viên', 'Open teacher dashboard', '打开教师仪表板')}</button></section>`; }

  function partnerView() { if (!runtime.content) return loadingView(); const api = PartnerApiService.manifest(); return `${heading('enterprise-platform', 'PARTNER API FOUNDATION', copy('Hợp đồng tích hợp trước khi phát hành API', 'Integration contract before API launch', 'API 发布前的集成契约'), copy('Không có endpoint hoặc credential thật được bật trong trình duyệt.', 'No live endpoint or credential is enabled in the browser.', '浏览器中未启用真实端点或凭据。'))}<section class="ep-api-card section"><header><div><small>${api.version} · ${api.status}</small><h2>${api.authentication}</h2></div><span>${PartnerApiService.enabled() ? 'active' : copy('Chưa kích hoạt', 'Not enabled', '未启用')}</span></header><div class="ep-scope-list">${api.scopes.map((scope) => `<code>${scope}</code>`).join('')}</div><ul>${api.principles.map((item) => `<li>✓ ${escapeHtml(item)}</li>`).join('')}</ul><a class="btn secondary" href="${PartnerApiService.documentationPath()}" target="_blank" rel="noopener">OpenAPI v1</a></section>`; }

  function adminView() { if (!AdminAnalyticsService.available()) return denied('Admin Analytics'); const value = AdminAnalyticsService.snapshot(); return `${heading('enterprise-platform', 'ADMIN ANALYTICS', copy('Chỉ số vận hành có ranh giới', 'Bounded operational analytics', '有边界的运营分析'), copy('Nền tảng chỉ hiển thị aggregate; không dùng dữ liệu giả khi backend chưa có.', 'Only aggregates are shown; unavailable backend metrics are not fabricated.', '仅显示汇总数据；后端不可用时不伪造指标。'))}<section class="ep-metrics section"><article><small>Users</small><b>${value.users ?? '—'}</b></article><article><small>Retention</small><b>${value.retention ?? '—'}</b></article><article><small>Learning activity</small><b>${value.learningActivity}′</b></article><article><small>Organizations</small><b>${value.organizations}</b></article></section><p class="ep-data-note section">${copy('— nghĩa là backend analytics chưa được kết nối, không phải 0 người dùng.', '— means backend analytics is not connected; it does not mean zero users.', '— 表示尚未连接后端分析，并非用户数为零。')}</p>`; }

  function languageView() { if (!runtime.content) return loadingView(); const current = ProductLanguageService.current(); return `${heading('enterprise-platform', 'MULTI-LANGUAGE EXPANSION', copy('Tách ngôn ngữ nội dung khỏi ngôn ngữ giao diện', 'Separate content language from interface language', '分离内容语言与界面语言'), copy('Korean đang hoạt động; Japanese và Chinese có schema sẵn nhưng chưa giả vờ có curriculum.', 'Korean is active; Japanese and Chinese have schema support but no fabricated curriculum.', '韩语已启用；日语和中文已有架构支持，但不虚构课程。'))}<section class="ep-language-grid section">${ProductLanguageService.all().map((item) => `<article class="${current?.id === item.id ? 'current' : ''}"><span>${item.id.toUpperCase()}</span><h2>${escapeHtml(item.nativeName)}</h2><p>${escapeHtml(item.name)}</p><dl><div><dt>Content</dt><dd>${item.contentStatus}</dd></div><div><dt>Interface</dt><dd>${item.interfaceStatus}</dd></div></dl><button class="btn secondary" data-product-language="${item.id}" ${item.contentStatus !== 'active' || current?.id === item.id ? 'disabled' : ''}>${current?.id === item.id ? copy('Đang dùng', 'Current', '当前') : copy('Chưa phát hành', 'Not released', '未发布')}</button></article>`).join('')}</section>`; }

  global.SubscriptionService = SubscriptionService;
  global.PremiumFeatureService = PremiumFeatureService;
  global.CourseMarketplaceService = CourseMarketplaceService;
  global.CertificationService = CertificationService;
  global.SchoolManagementService = SchoolManagementService;
  global.CenterAnalyticsService = CenterAnalyticsService;
  global.PartnerApiService = PartnerApiService;
  global.AdminAnalyticsService = AdminAnalyticsService;
  global.ProductLanguageService = ProductLanguageService;
  global.EnterpriseContentService = EnterpriseContentService;
  global.KLEARN_EXTRA_VIEWS = { ...(global.KLEARN_EXTRA_VIEWS || {}), 'enterprise-platform': platformView, 'subscription-center': subscriptionView, 'premium-features': subscriptionView, 'school-management': schoolView, 'center-dashboard': centerView, 'course-marketplace': marketplaceView, 'certification-center': certificationView, 'partner-api': partnerView, 'admin-analytics': adminView, 'language-platform': languageView };

  const previousSearch = global.GlobalSearchService?.search?.bind(global.GlobalSearchService);
  if (previousSearch) global.GlobalSearchService.search = (query) => { const result = previousSearch(query); const normalized = String(query || '').toLocaleLowerCase('vi'); if (/premium|subscription|thương mại|marketplace|chứng nhận|certificate|partner|trường học|trung tâm/.test(normalized)) result.studyTools = [...(result.studyTools || []), { id: 'enterprise-platform', title: copy('Nền tảng thương mại', 'Commercial platform', '商业平台'), subtitle: 'Free · Premium · School · Marketplace · API', route: 'enterprise-platform' }]; return result; };

  const previousAfterRender = global.KLEARN_AFTER_RENDER;
  global.KLEARN_AFTER_RENDER = () => {
    previousAfterRender?.();
    if (!state.currentUser) return;
    if (routes.has(state.currentView)) EnterpriseContentService.load();
    if (state.currentView === 'profile' && !global.document.querySelector('[data-enterprise-platform-entry]')) global.document.querySelector('.profile-head, .personal-profile, .profile-quick-actions, .profile-action-list, #app > .section')?.insertAdjacentHTML('afterend', `<section class="ep-profile-entry section" data-enterprise-platform-entry><div><span>P22 · ${SubscriptionService.tier()}</span><h2>${copy('Nền tảng thương mại', 'Commercial platform', '商业平台')}</h2><p>${copy('Gói dịch vụ, trường học, marketplace và chứng nhận.', 'Plans, schools, marketplace and certification.', '方案、学校、课程市场与认证。')}</p></div><button class="btn primary" data-open-enterprise>${copy('Mở', 'Open', '打开')}</button></section>`);
    global.document.querySelector('[data-open-enterprise]')?.addEventListener('click', () => setView('enterprise-platform'));
    global.document.querySelector('[data-open-school-management]')?.addEventListener('click', () => SchoolManagementService.openManagement());
    global.document.querySelector('[data-open-center-dashboard]')?.addEventListener('click', () => SchoolManagementService.openDashboard());
    global.document.querySelectorAll('[data-market-enroll]').forEach((button) => { button.onclick = () => { const result = CourseMarketplaceService.enroll(button.dataset.marketEnroll); toast(result ? copy('Đã tham gia khóa học.', 'Course enrolled.', '已加入课程。') : copy('Khóa này cần entitlement Premium.', 'This course requires Premium entitlement.', '此课程需要高级权益。')); render(); }; });
    global.document.querySelectorAll('[data-certificate-issue]').forEach((button) => { button.onclick = () => { const result = CertificationService.issue(button.dataset.certificateIssue); toast(result ? copy('Đã tạo bản preview chứng nhận.', 'Certificate preview created.', '已创建证书预览。') : copy('Chưa đủ điều kiện.', 'Not eligible yet.', '尚未符合条件。')); render(); }; });
    global.document.querySelectorAll('[data-product-language]').forEach((button) => { button.onclick = () => { ProductLanguageService.set(button.dataset.productLanguage); render(); }; });
  };
  EnterpriseContentService.load();
})(window);
