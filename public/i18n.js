// i18n.js — 国际化模块，支持中文/英文

const translations = {
  zh: {
    // 通用
    appTitle: 'agentEvaluator',
    appSubtitle: 'Realtime Eval Gate · tenant-internal',
    checking: 'checking…',
    resetBtn: '↻ Reset',
    resetConfirm: 'Reset 会清空所有 evidence 历史并重新 seed demo 数据。继续？',
    saveAll: '💾 Save All',
    loadLiveModels: '🔄 Load Live Models',
    clearAll: '🗑 Clear All',
    close: '✕ 关闭',
    save: '💾 Save',
    saving: '保存中…',
    saved: '已保存。回到应用即可开始对话。',
    saveError: '保存失败：',
    autoSaveError: '自动保存失败：',
    resetError: '清空失败：',
    resetSuccess: '已清空 — 下次请求回 fixture 模式',
    resetConfirmMsg: '确认清空所有 LLM 配置? 这会删除 user_settings 中所有 provider_* 和 llm_global',
    modelsLoading: '加载中…',
    modelsLoaded: '在线获取到',
    modelsFailed: '获取失败：',
    modelsRequestFailed: '请求失败：',
    verifyFailed: '验证请求失败：',
    verifySuccess: '验证通过',
    verifyError: '验证失败',
    keyRequired: '请先填写该 Provider 的 API Key，再在线拉取模型列表',
    keyAndModelRequired: '请先填写 API Key 并勾选模型',
    
    // 语言切换
    switchToEnglish: 'Switch to English',
    switchToChinese: '切换到中文',

    // 侧边栏
    settingsSection: 'Settings',
    tenantLabel: 'Tenant',
    agentLabel: 'Agent',
    llmSection: 'LLM',
    llmSettings: '⚙ LLM Settings',
    
    // 导航
    playground: 'Playground',
    dashboard: 'Dashboard',
    triage: 'Triage',
    drift: 'Drift',
    evidencePack: 'Evidence Pack',
    
    // Playground 页面
    playgroundTitle: '▶ Playground',
    playgroundDemoBtn: '▶ 一键演示',
    playgroundSubtitle: '输入 query → <b>逐帧</b>走完 6 步管线 → 看到 Gate 决策 + Evidence Pack',
    queryPlaceholder: '输入 query, 或点下方示例',
    runBtn: 'Run ▶',
    exampleLabel: '示例:',
    exampleTip: '💡 示例使用预设 fixture（确保演示效果）；自定义 query 调用你配置的 LLM',
    streaming: 'Streaming…',
    running: 'RUNNING…',
    runningMeta: '6 步管线逐帧执行中',
    waitingPipeline: '(等待管线完成…)',
    pipelineError: 'Pipeline error: ',
    expand: '…展开',
    collapse: '收起',
    timeout: '⚠ 超时',
    hallucination: '幻觉补全',
    
    // Dashboard 页面
    dashboardTitle: '📊 Agent Dashboard',
    dashboardSubtitle: '当前 tenant / agent 的健康度、最近失败',
    runFixtures: '▶ Run all fixtures(充实 dashboard)',
    fixturesRunning: 'Running…',
    fixturesDone: '✅ 跑了',
    fixturesUnit: '个 fixture,刷新中…',
    fixturesLast: '✅ 上次: 跑了',
    fixturesUnitLast: '个 fixture',
    totalEvals: 'Total Evals (tenant)',
    passRateLifetime: 'Pass Rate (lifetime)',
    passRate24h: 'Pass Rate (24h)',
    recentFailures: 'Recent Failures',
    noEvidence: '暂无 evidence。点上方 "Run all fixtures" 一键充实,或去 Replay 跑 query。',
    recentEvidence: 'Recent Evidence',
    time: 'Time',
    query: 'Query',
    decision: 'Decision',
    trust: 'Trust',
    failedDims: 'Failed Dims',
    viewEvidence: '查看 Evidence →',
    
    // Triage 页面
    triageTitle: '🩺 Failure Triage',
    triageSubtitle: '每个失败自动对照 playbook 分类 + 给出修复草稿',
    triageLoading: 'Loading…',
    triageHealthy: '无失败 — 平台健康',
    topFailures: 'Top 5 Recent Failures (auto-triaged)',
    category: 'Category',
    severity: 'Severity',
    rootCause: 'Root cause',
    suggestedFix: 'Suggested fix',
    viewEvidencePack: '查看 Evidence Pack →',
    
    // Drift 页面
    driftTitle: '📈 Drift Detection',
    driftSubtitle: '跨时间 / 模型 / 租户的通过率漂移 — 平台先于客户发现',
    driftBy: 'Drift by',
    noDrift: '✅ 无漂移告警',
    driftAlertTitle: '⚠',
    driftSampleSize: '样本',
    driftFailCount: '失败',
    driftTopFailing: '主失败维度',
    driftRootCause: '🧠 根因候选',
    driftPassRate: '通过率',
    driftDimTenant: '租户',
    driftDimTime: '时间',
    driftDimModel: '模型',
    
    // Evidence Pack 页面
    evidencePackTitle: '📋 Evidence Pack',
    evidencePackSubtitle: '结构化、可被合规官签字认可的审计记录',
    evidenceNotFound: 'Evidence',
    notFound: 'not found',
    recentEvidenceList: '最近 50 条 Evidence',
    evidenceId: 'Evidence ID',
    tenant: 'Tenant',
    agent: 'Agent',
    details: '详情 →',
    backToList: '← 返回列表',
    print: '🖨 Print',
    gateBlocked: '⛔ Gate Blocked — Human Review Required',
    failedDimensions: '失败维度',
    rootCauseInterpretation: '🧠 根因',
    gatePassed: '✅ Gate Passed',
    gatePassedDesc: '全部评估通过,响应已交付给用户',
    evaluationDimensions: '7 维评估',
    dimension: '维度',
    result: '结果',
    score: '分数',
    reason: '原因',
    fullJsonAudit: '完整 JSON (审计 / SIEM 接入用)',
    
    // LLM Settings 模态框
    settingsTitle: '模型设置',
    settingsHint: '与 appUIRefiner 相同的配置体系：填写 Key → 勾选模型（勾选顺序即回退链）→ 设默认 → 验证。\n卡片和回退链均支持<b>拖拽排序</b>。所有输入<b>自动保存到服务端</b>（停顿约 1 秒即写入，刷新/重启不丢），本机另有草稿兜底。',
    providerDesc: 'Provider',
    baseUrl: 'Base URL',
    apiKey: 'API Key',
    apiKeyPlaceholder: '填写 API Key',
    optionalModels: '可选模型（勾选加入回退链）',
    modelSearch: '搜索模型，如 qwen3.8',
    noModelDirectory: '暂无模型目录，填 Key 后可在线拉取',
    noMatchingModels: '无匹配',
    noMatchingModelsTry: '的模型（共',
    noMatchingModelsTryEnd: '个模型）。可尝试更短关键字，或点「在线拉取」获取最新列表。',
    fetchModels: '在线拉取',
    fetchingModels: '获取中…',
    modelCount: '显示',
    modelCountOf: '/',
    modelCountModels: '个模型',
    verified: '已验证 ✓',
    verifyModel: '验证模型连通',
    setDefault: '设默认',
    defaultModel: '默认',
    fallbackChain: '回退链',
    fallbackChainItems: '项，可拖拽排序',
    fallbackChainDesc: '：带「默认」标记的模型为管线首选；其余按此顺序依次作为回退',
    dragHandle: '⠿',
    
    // 示例查询
    exampleHallucination: '幻觉补全',
    exampleNormalPass: '正常 PASS',
    exampleCrossTenant: '跨租户越权',
    exampleSourceScoping: 'Source Scoping',
    exampleLatency: 'Latency 超时',
    exampleCost: 'Cost 超预算',
    
    // 步骤标签
    stepPull: 'Pull Sources',
    stepDLP: 'DLP Redact',
    stepLLM: 'LLM Generate',
    stepTrust: 'Trust Score',
    stepEvaluate: 'Evaluate',
    stepGate: 'Gate Decision',
    
    // 其他
    sources: '来源',
    original: '原始',
    redacted: '脱敏后',
    llmInput: '查看 LLM 输入 context',
    chars: 'chars',
    model: 'model',
    wallMs: 'wall',
    evalsCount: '维评估',
    failed: 'failed',
    none: '无',
    policy: '策略',
    decisionField: '决策',
    times: '次',
    pulledSources: '拉到',
    hitRules: '命中',
    rulesUnit: '条规则',
    redactedLabel: '[已脱敏]',
    viewOriginalVsRedacted: '查看原始内容 vs 脱敏后',
    evPackJsonAudit: '📋 Evidence Pack (审计 JSON)',
    dragCardTitle: '拖拽调整卡片顺序',
    dragChainTitle: '拖拽调整回退顺序',
    supportsSO: '支持结构化输出（DSL 管线推荐）',
    supportsFC: '支持函数调用',
    noModelDirHint: '暂无模型目录，填 Key 后可在线拉取',
    autoSaveError: '自动保存失败：',
    serverCheckHint: '（请确认 server 正在运行，终端里 npm run dev 是否正常）',
    
    // Demo overlay
    demoInput: '输入:',
    demoClickRun: '点击 Run 执行管线',
    demoIntro: 'Agent Evaluation Platform — 企业 AI 助手的 agent 质量门控',
    demoQueryIntro: '输入 query,agent 会自动执行 6 步管线评估',
    demoExample: '示例',
    demoExample1: '幻觉补全 — LLM 复述了被 DLP 截断的内容',
    demoExample2: '正常 PASS — 所有评估通过',
    demoExample3: '跨租户越权 — Contoso 租户试图访问 EU 数据',
    demoExample4: 'Source Scoping — 1P Agent 访问 people 类型被拒',
    demoExample5: 'Latency 超时 — 响应 8 秒,超过 5 秒 P95 阈值',
    demoExample6: 'Cost 超预算(长文) — 5100 tokens,质量与成本双双告警',
    demoGateBlocked1: 'Gate: BLOCKED — DLP 检测到 LLM 输出了被截断的「绩效 A」「涨薪 8%」',
    demoGatePass: 'Gate: PASS — 7 维评估全部 ✅',
    demoGateBlocked3: 'Gate: BLOCKED — source owner=contoso-eu ≠ tenant=contoso,跨租户访问被拒',
    demoGateBlocked4: 'Gate: BLOCKED — 1P Agent 的 allowedSources 不含 people 类型',
    demoGateBlocked5: 'Gate: BLOCKED — 仅 latency 失败;accuracy 等 6 维仍通过,精确归因不误伤',
    demoGateBlocked6: 'Gate: BLOCKED — Cost 5100 tokens + Quality 检测到重复内容',
    demoConfirmTenant: '确认当前 Tenant: Contoso (非 EU)',
    demoConfirmAgent: '确认 Agent: Sales Summarizer (1P)',
    demoEvPack1: '每次评估都生成 Evidence Pack — 合规官可直接签字的审计记录',
    demoEvPack2: '记录了完整决策过程: 拉源 → DLP → LLM → Trust → 评估 → Gate',
    demoDash1: 'Dashboard — 所有 agent 的整体健康度',
    demoDash2: '通过率、24h 趋势、最近失败一目了然',
    demoTriage1: 'Triage — 失败自动分类 + 修复草稿',
    demoTriage2: '从「翻 trace 找根因」降到「审草稿决定采纳」',
    demoDrift1: 'Drift — 跨时间 / 模型 / 租户的通过率漂移',
    demoDrift2: '平台先于客户发现衰退:告警 + 候选根因',
    demoSummary1: '6 步管线 · 7 维评估 · Evidence Pack · 自动 Triage · Drift 监控',
    demoSummary2: 'Agent Evaluation Platform — 让每个 agent 的回答都可审计',
  },
  
  en: {
    // Common
    appTitle: 'agentEvaluator',
    appSubtitle: 'Realtime Eval Gate · tenant-internal',
    checking: 'checking…',
    resetBtn: '↻ Reset',
    resetConfirm: 'Reset will clear all evidence history and re-seed demo data. Continue?',
    saveAll: '💾 Save All',
    loadLiveModels: '🔄 Load Live Models',
    clearAll: '🗑 Clear All',
    close: '✕ Close',
    save: '💾 Save',
    saving: 'Saving…',
    saved: 'Saved. Return to app to start conversation.',
    saveError: 'Save failed: ',
    autoSaveError: 'Auto-save failed: ',
    resetError: 'Reset failed: ',
    resetSuccess: 'Cleared — next request will return to fixture mode',
    resetConfirmMsg: 'Confirm clearing all LLM configuration? This will delete all provider_* and llm_global from user_settings',
    modelsLoading: 'Loading…',
    modelsLoaded: 'Fetched',
    modelsFailed: 'Fetch failed: ',
    modelsRequestFailed: 'Request failed: ',
    verifyFailed: 'Verify request failed: ',
    verifySuccess: 'Verified',
    verifyError: 'Verification failed',
    keyRequired: 'Please fill in the API Key for this Provider first, then fetch model list online',
    keyAndModelRequired: 'Please fill in API Key and select a model',
    
    // Language switch
    switchToEnglish: 'Switch to English',
    switchToChinese: 'Switch to Chinese',

    // Sidebar
    settingsSection: 'Settings',
    tenantLabel: 'Tenant',
    agentLabel: 'Agent',
    llmSection: 'LLM',
    llmSettings: '⚙ LLM Settings',
    
    // Navigation
    playground: 'Playground',
    dashboard: 'Dashboard',
    triage: 'Triage',
    drift: 'Drift',
    evidencePack: 'Evidence Pack',
    
    // Playground page
    playgroundTitle: '▶ Playground',
    playgroundDemoBtn: '▶ One-click Demo',
    playgroundSubtitle: 'Enter query → <b>frame-by-frame</b> run 6-step pipeline → see Gate decision + Evidence Pack',
    queryPlaceholder: 'Enter query, or click example below',
    runBtn: 'Run ▶',
    exampleLabel: 'Examples:',
    exampleTip: '💡 Examples use preset fixtures (to ensure demo effect); custom queries call your configured LLM',
    streaming: 'Streaming…',
    running: 'RUNNING…',
    runningMeta: '6-step pipeline executing frame-by-frame',
    waitingPipeline: '(Waiting for pipeline to complete…)',
    pipelineError: 'Pipeline error: ',
    expand: '…expand',
    collapse: 'collapse',
    timeout: '⚠ Timeout',
    hallucination: 'Hallucination',
    
    // Dashboard page
    dashboardTitle: '📊 Agent Dashboard',
    dashboardSubtitle: 'Current tenant / agent health status, recent failures',
    runFixtures: '▶ Run all fixtures (populate dashboard)',
    fixturesRunning: 'Running…',
    fixturesDone: '✅ Ran',
    fixturesUnit: 'fixtures, refreshing…',
    fixturesLast: '✅ Last: ran',
    fixturesUnitLast: 'fixtures',
    totalEvals: 'Total Evals (tenant)',
    passRateLifetime: 'Pass Rate (lifetime)',
    passRate24h: 'Pass Rate (24h)',
    recentFailures: 'Recent Failures',
    noEvidence: 'No evidence yet. Click "Run all fixtures" above to populate, or go to Replay to run queries.',
    recentEvidence: 'Recent Evidence',
    time: 'Time',
    query: 'Query',
    decision: 'Decision',
    trust: 'Trust',
    failedDims: 'Failed Dims',
    viewEvidence: 'View Evidence →',
    
    // Triage page
    triageTitle: '🩺 Failure Triage',
    triageSubtitle: 'Each failure is automatically categorized against playbook + fix draft provided',
    triageLoading: 'Loading…',
    triageHealthy: 'No failures — platform healthy',
    topFailures: 'Top 5 Recent Failures (auto-triaged)',
    category: 'Category',
    severity: 'Severity',
    rootCause: 'Root cause',
    suggestedFix: 'Suggested fix',
    viewEvidencePack: 'View Evidence Pack →',
    
    // Drift page
    driftTitle: '📈 Drift Detection',
    driftSubtitle: 'Pass rate drift across time / model / tenant — platform detects before customers',
    driftBy: 'Drift by',
    noDrift: '✅ No drift alerts',
    driftAlertTitle: '⚠',
    driftSampleSize: 'Sample',
    driftFailCount: 'Failures',
    driftTopFailing: 'Top failing dim',
    driftRootCause: '🧠 Suspected root cause',
    driftPassRate: 'Pass rate',
    driftDimTenant: 'Tenant',
    driftDimTime: 'Time',
    driftDimModel: 'Model',
    
    // Evidence Pack page
    evidencePackTitle: '📋 Evidence Pack',
    evidencePackSubtitle: 'Structured audit records signable by compliance officers',
    evidenceNotFound: 'Evidence',
    notFound: 'not found',
    recentEvidenceList: 'Recent 50 Evidence',
    evidenceId: 'Evidence ID',
    tenant: 'Tenant',
    agent: 'Agent',
    details: 'Details →',
    backToList: '← Back to list',
    print: '🖨 Print',
    gateBlocked: '⛔ Gate Blocked — Human Review Required',
    failedDimensions: 'Failed dimensions',
    rootCauseInterpretation: '🧠 Root cause',
    gatePassed: '✅ Gate Passed',
    gatePassedDesc: 'All evaluations passed, response delivered to user',
    evaluationDimensions: '7-Dimension Evaluation',
    dimension: 'Dimension',
    result: 'Result',
    score: 'Score',
    reason: 'Reason',
    fullJsonAudit: 'Full JSON (for audit / SIEM integration)',
    
    // LLM Settings Modal
    settingsTitle: 'Model Settings',
    settingsHint: 'Same configuration system as appUIRefiner: fill Key → select models (selection order = fallback chain) → set default → verify.\nCards and fallback chain support <b>drag-and-drop sorting</b>. All inputs <b>auto-saved to server</b> (about 1 second delay, persists on refresh/restart), with local draft as fallback.',
    providerDesc: 'Provider',
    baseUrl: 'Base URL',
    apiKey: 'API Key',
    apiKeyPlaceholder: 'Enter API Key',
    optionalModels: 'Optional models (select to add to fallback chain)',
    modelSearch: 'Search models, e.g. qwen3.8',
    noModelDirectory: 'No model directory yet, fill Key to fetch online',
    noMatchingModels: 'No matching',
    noMatchingModelsTry: 'models (total',
    noMatchingModelsTryEnd: 'models). Try shorter keywords, or click "Fetch online" for latest list.',
    fetchModels: 'Fetch online',
    fetchingModels: 'Fetching…',
    modelCount: 'Showing',
    modelCountOf: '/',
    modelCountModels: 'models',
    verified: 'Verified ✓',
    verifyModel: 'Verify model connectivity',
    setDefault: 'Set default',
    defaultModel: 'Default',
    fallbackChain: 'Fallback chain',
    fallbackChainItems: 'items, drag to reorder',
    fallbackChainDesc: ': model marked "Default" is pipeline first choice; others follow in this order as fallback',
    dragHandle: '⠿',
    
    // Example queries
    exampleHallucination: 'Hallucination',
    exampleNormalPass: 'Normal PASS',
    exampleCrossTenant: 'Cross-tenant access',
    exampleSourceScoping: 'Source Scoping',
    exampleLatency: 'Latency timeout',
    exampleCost: 'Cost over budget',
    
    // Step labels
    stepPull: 'Pull Sources',
    stepDLP: 'DLP Redact',
    stepLLM: 'LLM Generate',
    stepTrust: 'Trust Score',
    stepEvaluate: 'Evaluate',
    stepGate: 'Gate Decision',
    
    // Other
    sources: 'Sources',
    original: 'Original',
    redacted: 'Redacted',
    llmInput: 'View LLM input context',
    chars: 'chars',
    model: 'model',
    wallMs: 'wall',
    evalsCount: 'evaluations',
    failed: 'failed',
    none: 'none',
    policy: 'policy',
    decisionField: 'Decision',
    times: 'times',
    pulledSources: 'Pulled',
    hitRules: 'Hit',
    rulesUnit: 'rules',
    redactedLabel: '[REDACTED]',
    viewOriginalVsRedacted: 'View original vs redacted',
    evPackJsonAudit: '📋 Evidence Pack (Audit JSON)',
    dragCardTitle: 'Drag to reorder cards',
    dragChainTitle: 'Drag to reorder fallback chain',
    supportsSO: 'Supports structured output (DSL pipeline recommended)',
    supportsFC: 'Supports function calling',
    noModelDirHint: 'No model directory yet, fill Key to fetch online',
    autoSaveError: 'Auto-save failed: ',
    serverCheckHint: ' (please confirm server is running, check terminal npm run dev)',
    
    // Demo overlay
    demoInput: 'Input:',
    demoClickRun: 'Click Run to execute pipeline',
    demoIntro: 'Agent Evaluation Platform — Quality gate for enterprise AI agents',
    demoQueryIntro: 'Enter a query, agent automatically runs 6-step pipeline evaluation',
    demoExample: 'Example',
    demoExample1: 'Hallucination — LLM repeated DLP-redacted content',
    demoExample2: 'Normal PASS — All evaluations passed',
    demoExample3: 'Cross-tenant access — Contoso tenant tries to access EU data',
    demoExample4: 'Source Scoping — 1P Agent access to people type denied',
    demoExample5: 'Latency timeout — Response 8s, exceeds 5s P95 threshold',
    demoExample6: 'Cost over budget (long text) — 5100 tokens, quality & cost alerts',
    demoGateBlocked1: 'Gate: BLOCKED — DLP caught the LLM re-emitting the redacted "Performance A" / "salary increase of 8%"',
    demoGatePass: 'Gate: PASS — All 7 evaluations ✅',
    demoGateBlocked3: 'Gate: BLOCKED — source owner=contoso-eu ≠ tenant=contoso, cross-tenant access denied',
    demoGateBlocked4: 'Gate: BLOCKED — 1P Agent allowedSources does not include people type',
    demoGateBlocked5: 'Gate: BLOCKED — Only latency failed; accuracy and 5 other dims passed, precise attribution',
    demoGateBlocked6: 'Gate: BLOCKED — Cost 5100 tokens + Quality detected duplicate content',
    demoConfirmTenant: 'Confirm Tenant: Contoso (non-EU)',
    demoConfirmAgent: 'Confirm Agent: Sales Summarizer (1P)',
    demoEvPack1: 'Each evaluation generates Evidence Pack — audit record for compliance officer sign-off',
    demoEvPack2: 'Complete decision process recorded: Pull → DLP → LLM → Trust → Evaluate → Gate',
    demoDash1: 'Dashboard — Overall health of all agents',
    demoDash2: 'Pass rate, 24h trend, recent failures at a glance',
    demoTriage1: 'Triage — Automatic failure classification + fix draft',
    demoTriage2: 'From "digging through traces for root cause" to "reviewing draft for approval"',
    demoDrift1: 'Drift — Pass rate drift across time / model / tenant',
    demoDrift2: 'Platform detects degradation before customers: alerts + suspected root cause',
    demoSummary1: '6-step pipeline · 7-dim evaluation · Evidence Pack · Auto Triage · Drift monitoring',
    demoSummary2: 'Agent Evaluation Platform — Making every agent response auditable',
  }
};

// ── 不是"可翻译的文案"、而是"随语言一起换的演示数据" ──
// 示例 query 要真的发给服务端,所以必须和该语言的 fixture/pullRules 一一对应,
// 不能只翻标签。幻觉高亮串同理:中文模式高亮 "绩效 A",英文模式要高亮 "Performance A"。
const EXAMPLE_QUERIES = {
  zh: [
    '张三最近表现',
    '上周我们组完成了哪些项目',
    'EU 合规审计近况',
    '员工绩效列表',
    '帮我写一份详细的技术方案文档',
    '写一篇长文',
  ],
  en: [
    'How has Zhang San been performing lately?',
    'What did our team complete last week?',
    'EU compliance audit status',
    'Employee performance list',
    'Write me a detailed technical design doc',
    'Write a long essay',
  ],
};

const HALLUCINATION_SPANS = {
  zh: ['绩效 A', '涨薪 8%'],
  en: ['Performance A', 'salary increase of 8%'],
};

// 当前语言
let currentLang = localStorage.getItem('agent-evaluator-lang') || 'zh';

/** 当前语言下的示例 query 列表(按 pill 顺序) */
export function exampleQueries(lang = currentLang) {
  return EXAMPLE_QUERIES[lang] || EXAMPLE_QUERIES.zh;
}

/** 当前语言下的"幻觉补全"特征串 */
export function hallucinationSpans(lang = currentLang) {
  return HALLUCINATION_SPANS[lang] || HALLUCINATION_SPANS.zh;
}

/** 给 URL 追加当前语言参数(服务端据此生成文案) */
export function withLang(url) {
  return `${url}${url.includes('?') ? '&' : '?'}lang=${currentLang}`;
}

/** fetch 包装: 自动带上当前语言 */
export function apiFetch(url, init) {
  const opts = { ...(init || {}) };
  if (opts.body && typeof opts.body === 'string') {
    try {
      opts.body = JSON.stringify({ ...JSON.parse(opts.body), lang: currentLang });
    } catch { /* 非 JSON body,原样透传 */ }
  }
  return fetch(withLang(url), opts);
}

// 获取翻译
export function t(key) {
  return translations[currentLang][key] || translations.zh[key] || key;
}

// 获取当前语言
export function getLang() {
  return currentLang;
}

// 设置语言
export function setLang(lang) {
  if (lang === 'zh' || lang === 'en') {
    currentLang = lang;
    localStorage.setItem('agent-evaluator-lang', lang);
    // 触发语言变化事件
    window.dispatchEvent(new CustomEvent('langchange', { detail: { lang } }));
  }
}

// 切换语言
export function toggleLang() {
  setLang(currentLang === 'zh' ? 'en' : 'zh');
}

// 导出
export default {
  t, getLang, setLang, toggleLang,
  exampleQueries, hallucinationSpans, withLang, apiFetch,
};