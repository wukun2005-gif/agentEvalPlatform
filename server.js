// server.js — Phase B 完整版
// API:
//   GET  /api/info
//   GET  /api/tenants
//   GET  /api/agents
//   GET  /api/agents/:id/dashboard
//   POST /api/run
//   GET  /api/evidence/:id
//   GET  /api/history
//   GET  /api/failures
//   POST /api/triage
//   POST /api/run-stream
//   POST /api/run-fixtures
//   GET  /api/drift
//   POST /api/reset
//   GET  /api/models
//   GET  /api/models/:id
//   GET  /api/models/recommend/eval
//
// 语言: 前端切换中/英后,请求会带 ?lang=en 或 body.lang="en"。
// 所有"生成给用户看的文案"(步骤标签、评估 reason、Triage 草稿、Drift 根因、
// provider 描述、fixture 演示内容)都随 lang 切换。

// 加载 .env(若存在) — 不影响无 .env 的 demo 体验
try { require("dotenv").config(); } catch (e) { /* dotenv 是可选的 */ }

const express = require("express");
const path = require("path");
const pipeline = require("./lib/pipeline");
const corpusMod = require("./data/fixtures/corpus");
const llmClient = require("./lib/llm-client");
const state = require("./lib/state");
const triage = require("./lib/triage");
const drift = require("./lib/drift");
const modelRegistry = require("./lib/model-registry");
const settingsStore = require("./lib/settings-store");
const i18n = require("./lib/i18n");

// 启动时: 1) seed demo 数据  2) 把 DB 里的 API keys 灌到内存 keyStore
state.seedDemoData("zh");
settingsStore.warmupKeyStore();

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/** 从 query / body 里取语言,默认 zh */
function reqLang(req) {
  const raw = (req.body && req.body.lang) || req.query.lang;
  return i18n.normalizeLang(raw);
}

const llmMode = llmClient.getMode();
const modelName = process.env.LLM_MODEL || "fixture-default";
console.log(`[agentEvaluator] LLM mode: ${llmMode.toUpperCase()} (${modelName})`);
console.log(`[agentEvaluator] 2 tenants, ${Object.keys(corpusMod.agents).length} agents, ${Object.keys(corpusMod.sources).length} sources, ${state.getHistory().length} history records`);
console.log(`[agentEvaluator] open http://localhost:3000`);

// ——— Info / 列表 ———
app.get("/api/info", (req, res) => {
  const lang = reqLang(req);
  const corpus = corpusMod.forLang(lang);
  // demo seed 的历史是"给用户看的文案",语言变了就换成本语言版本(真实 evidence 不动)
  state.reseedLocale(lang);

  const appSettings = settingsStore.getAppSettings();
  // 当前 default provider: llm_global.defaultProviderId > 第一个有 key 的 provider > openai
  let defaultProvider = "openai";
  let defaultModel = "gpt-4o-mini";
  const lg = appSettings.llm_global || {};
  if (lg.defaultProviderId) defaultProvider = lg.defaultProviderId;
  if (lg.defaultModelId) defaultModel = lg.defaultModelId;
  const providerCfg = (appSettings.providers || {})[defaultProvider] || {};
  const hasKey = !!settingsStore.getApiKey(defaultProvider);

  res.json({
    lang,
    llmMode: llmClient.getMode(),
    model: defaultModel,
    provider: defaultProvider,
    baseUrl: providerCfg.baseUrl || "",
    hasApiKey: hasKey,
    tenants: Object.values(corpus.tenants),
    agents: Object.values(corpus.agents),
    historyCount: state.getHistory().length,
  });
});

// ——— Run pipeline ———
app.post("/api/run", async (req, res) => {
  try {
    const { query, agentId = "my-sales-summarizer-v3", tenantId = "contoso", model } = req.body;
    const lang = reqLang(req);
    if (!query) return res.status(400).json({ error: "query is required" });

    const corpus = corpusMod.forLang(lang);
    const agent = corpus.agents[agentId];
    const tenant = corpus.tenants[tenantId];
    if (!agent || !tenant) return res.status(400).json({ error: "agent or tenant not found" });

    const result = await pipeline.run({ query, agent, tenant, model, lang });
    const compact = state.recordEvidence(result.evidence, agent, tenant);
    result.evidence.compact = compact;
    res.json(result);
  } catch (err) {
    console.error("[/api/run] error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ——— Run pipeline (SSE streaming,逐帧) ———
// Phase C:前端用 EventSource 接收,每步 200ms,带"动画感"
app.post("/api/run-stream", async (req, res) => {
  const { query, agentId = "my-sales-summarizer-v3", tenantId = "contoso", delayMs = 200, model } = req.body;
  const lang = reqLang(req);
  const corpus = corpusMod.forLang(lang);
  const agent = corpus.agents[agentId];
  const tenant = corpus.tenants[tenantId];
  if (!agent || !tenant) return res.status(400).json({ error: "agent or tenant not found" });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  try {
    await pipeline.runStream({
      query, agent, tenant, model, lang,
      delayMs: parseInt(delayMs) || 200,
      onStep: (step) => {
        res.write(`data: ${JSON.stringify(step)}\n\n`);
      },
    });
    res.end();
  } catch (e) {
    res.write(`data: ${JSON.stringify({ kind: "error", error: e.message })}\n\n`);
    res.end();
  }
});

// ——— Run all fixtures (一键充实 dashboard) ———
const FIXTURE_RUNS = {
  zh: [
    { q: "上周我们组完成了哪些项目", tenant: "contoso", agent: "my-sales-summarizer-v3" },
    { q: "张三最近表现", tenant: "contoso", agent: "my-sales-summarizer-v3" },
    { q: "EU 合规审计近况", tenant: "contoso-eu", agent: "my-sales-summarizer-v3" },
    { q: "test-latency-fail", tenant: "contoso", agent: "external-hr-insights" },
    { q: "上周我们组完成了哪些项目", tenant: "contoso", agent: "external-hr-insights" },
    { q: "张三最近表现", tenant: "contoso-eu", agent: "external-hr-insights" },
  ],
  en: [
    { q: "What did our team complete last week?", tenant: "contoso", agent: "my-sales-summarizer-v3" },
    { q: "How has Zhang San been performing lately?", tenant: "contoso", agent: "my-sales-summarizer-v3" },
    { q: "EU compliance audit status", tenant: "contoso-eu", agent: "my-sales-summarizer-v3" },
    { q: "test-latency-fail", tenant: "contoso", agent: "external-hr-insights" },
    { q: "What did our team complete last week?", tenant: "contoso", agent: "external-hr-insights" },
    { q: "How has Zhang San been performing lately?", tenant: "contoso-eu", agent: "external-hr-insights" },
  ],
};

app.post("/api/run-fixtures", async (req, res) => {
  const lang = reqLang(req);
  const corpus = corpusMod.forLang(lang);
  const fixtures = FIXTURE_RUNS[lang] || FIXTURE_RUNS.zh;
  const results = [];
  for (const f of fixtures) {
    try {
      const agent = corpus.agents[f.agent];
      const tenant = corpus.tenants[f.tenant];
      const r = await pipeline.run({ query: f.q, agent, tenant, lang });
      state.recordEvidence(r.evidence, agent, tenant);
      results.push({ query: f.q, gate: r.gate.decision });
    } catch (e) {
      results.push({ query: f.q, error: e.message });
    }
  }
  res.json({ ran: results.length, results });
});

// ——— History / Failures ———
app.get("/api/history", (req, res) => {
  const { agentId, tenantId, limit = 50 } = req.query;
  res.json(state.getHistory({ agentId, tenantId, limit: parseInt(limit) }));
});

// 按 ID 查单条 evidence(完整版,供审计详情页用)
app.get("/api/evidence/:id", (req, res) => {
  const found = state.getEvidenceById(req.params.id);
  if (!found) return res.status(404).json({ error: "evidence not found" });
  res.json(found);
});

app.get("/api/failures", (req, res) => {
  res.json(state.getRecentFailures(parseInt(req.query.limit || 10)));
});

// ——— Triage + Apply Fix ———
app.post("/api/triage", (req, res) => {
  const { evidence } = req.body;
  if (!evidence) return res.status(400).json({ error: "evidence required" });
  const result = triage.triage({ evidence, evaluations: evidence.evaluations || [] }, reqLang(req));
  res.json(result);
});

// ——— Drift ———
app.get("/api/drift", (req, res) => {
  const dim = req.query.dim || "tenant";
  const lang = reqLang(req);
  const history = state.getHistory();
  res.json(drift.computeDrift(history, dim, lang));
});

// ——— Reset ———
app.post("/api/reset", (req, res) => {
  const lang = reqLang(req);
  state.reset();
  state.seedDemoData(lang);
  res.json({ ok: true, lang });
});

// ——— Model Registry (改自 appUIRefiner) ———
// 完整目录
app.get("/api/models", (req, res) => {
  const lang = reqLang(req);
  res.json({
    catalog: modelRegistry.getModelCatalog(lang),
    providers: Object.keys(modelRegistry.PROVIDER_MODEL_IDS),
  });
});

// 单个模型详情
app.get("/api/models/:id", (req, res) => {
  const id = decodeURIComponent(req.params.id);
  res.json(modelRegistry.getModelInfo(id, reqLang(req)));
});

// 给 eval 场景推荐模型
app.get("/api/models/recommend/eval", (req, res) => {
  const provider = req.query.provider || null;
  const limit = parseInt(req.query.limit) || 5;
  res.json(modelRegistry.recommendEvalModels(provider, limit, reqLang(req)));
});

// ——— Settings API (改自 appUIRefiner/server/src/routes/settings.ts) ———
// 注意路由顺序: /api/settings/app 必须在 /api/settings/:key 之前
// 否则 :key 会把 "app" 匹配成 key 名,导致 /api/settings/app 永远返回 value:null

app.get("/api/settings/app", (_req, res) => {
  try {
    const app = settingsStore.getAppSettings();
    // 脱敏
    const providers = {};
    for (const [pid, cfg] of Object.entries(app.providers || {})) {
      providers[pid] = {
        ...cfg,
        apiKey: cfg.apiKey ? maskApiKey(cfg.apiKey) : "",
        hasApiKey: !!settingsStore.getApiKey(pid),
      };
    }
    res.json({ ok: true, providers, llm_global: app.llm_global || null });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 通用 KV 接口 — key 形如 "provider_openai" / "llm_global"
app.get("/api/settings", (_req, res) => {
  try {
    const settings = settingsStore.getAllSettings();
    const masked = {};
    for (const [k, v] of Object.entries(settings)) {
      if (k.startsWith("provider_") && v && typeof v === "object") {
        masked[k] = { ...v, apiKey: v.apiKey ? maskApiKey(v.apiKey) : "" };
      } else {
        masked[k] = v;
      }
    }
    res.json({ ok: true, settings: masked });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/api/settings/:key", (req, res) => {
  try {
    const v = settingsStore.getSetting(req.params.key);
    if (!v) return res.json({ ok: true, value: null });
    // 脱敏
    if (req.params.key.startsWith("provider_") && v && typeof v === "object") {
      return res.json({ ok: true, value: { ...v, apiKey: v.apiKey ? maskApiKey(v.apiKey) : "" } });
    }
    res.json({ ok: true, value: v });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.put("/api/settings/:key", (req, res) => {
  try {
    const value = req.body && req.body.value !== undefined
      ? req.body.value
      : (req.body && Object.keys(req.body).length > 0 ? req.body : null);
    if (value === null) return res.status(400).json({ ok: false, error: "value required" });
    settingsStore.setSetting(req.params.key, value);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.delete("/api/settings/:key", (req, res) => {
  try {
    settingsStore.deleteSetting(req.params.key);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 批量更新所有 provider(沿用 appUIRefiner /api/settings/providers 模式)
app.post("/api/settings/providers", (req, res) => {
  try {
    const { providers, llm_global } = req.body || {};
    settingsStore.setAppSettings({ providers, llm_global });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});


app.post("/api/settings/reset", (_req, res) => {
  settingsStore.clearAllSettings();
  res.json({ ok: true });
});

// ——— Provider Models (沿用 appUIRefiner /api/providers/:id/models) ———
// 静态目录(从 model-registry) — displayName / desc 也分语言
const PROVIDER_PRESETS = {
  zh: [
    { id: "openai", displayName: "OpenAI", desc: "GPT-4o / GPT-4o-mini", baseUrl: "https://api.openai.com/v1", keyPlaceholder: "sk-..." },
    { id: "anthropic", displayName: "Anthropic", desc: "Claude 系列", baseUrl: "https://api.anthropic.com", keyPlaceholder: "sk-ant-..." },
    { id: "google", displayName: "Google", desc: "Gemini 系列", baseUrl: "https://generativelanguage.googleapis.com/v1beta", keyPlaceholder: "AIza..." },
    { id: "deepseek", displayName: "DeepSeek", desc: "深度求索", baseUrl: "https://api.deepseek.com", keyPlaceholder: "sk-..." },
    { id: "qwen", displayName: "Qwen", desc: "阿里通义千问 (DashScope)", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", keyPlaceholder: "sk-..." },
    { id: "glm", displayName: "GLM", desc: "智谱 AI", baseUrl: "https://open.bigmodel.cn/api/paas/v4", keyPlaceholder: "your-glm-key" },
    { id: "moonshot", displayName: "Kimi", desc: "Moonshot / 月之暗面", baseUrl: "https://api.moonshot.cn/v1", keyPlaceholder: "sk-..." },
    { id: "volcengine", displayName: "火山引擎", desc: "字节跳动 · 火山引擎", baseUrl: "https://ark.cn-beijing.volces.com/api/v3", keyPlaceholder: "sk-..." },
    { id: "bailian", displayName: "百炼", desc: "阿里云百炼 (千问+三方模型)", baseUrl: "https://ws-3vv2b1h4akmem3xz.cn-beijing.maas.aliyuncs.com/compatible-mode/v1", keyPlaceholder: "sk-..." },
    { id: "gemini", displayName: "Gemini", desc: "Google AI Studio (免费)", baseUrl: "https://generativelanguage.googleapis.com/v1beta", keyPlaceholder: "AIza..." },
    { id: "mimo", displayName: "MiMo", desc: "小米 Token Plan", baseUrl: "https://token-plan-cn.xiaomimimo.com/v1", keyPlaceholder: "sk-..." },
    { id: "minimax", displayName: "MiniMax", desc: "MiniMax", baseUrl: "https://api.minimax.chat/v1", keyPlaceholder: "your-minimax-key" },
    { id: "bedrock", displayName: "AWS Bedrock", desc: "AWS Bedrock OpenAI-Compatible API", baseUrl: "https://bedrock-mantle.us-east-1.api.aws/v1", keyPlaceholder: "bedrock-api-key" },
    { id: "openrouter", displayName: "OpenRouter", desc: "统一 API 聚合数百模型", baseUrl: "https://openrouter.ai/api/v1", keyPlaceholder: "sk-or-v1-..." },
    { id: "opencode", displayName: "OpenCode Zen", desc: "OpenCode 官方精选模型网关", baseUrl: "https://opencode.ai/zen/v1", keyPlaceholder: "opencode-zen-key" },
  ],
  en: [
    { id: "openai", displayName: "OpenAI", desc: "GPT-4o / GPT-4o-mini", baseUrl: "https://api.openai.com/v1", keyPlaceholder: "sk-..." },
    { id: "anthropic", displayName: "Anthropic", desc: "Claude family", baseUrl: "https://api.anthropic.com", keyPlaceholder: "sk-ant-..." },
    { id: "google", displayName: "Google", desc: "Gemini family", baseUrl: "https://generativelanguage.googleapis.com/v1beta", keyPlaceholder: "AIza..." },
    { id: "deepseek", displayName: "DeepSeek", desc: "DeepSeek AI", baseUrl: "https://api.deepseek.com", keyPlaceholder: "sk-..." },
    { id: "qwen", displayName: "Qwen", desc: "Alibaba Qwen (DashScope)", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", keyPlaceholder: "sk-..." },
    { id: "glm", displayName: "GLM", desc: "Zhipu AI", baseUrl: "https://open.bigmodel.cn/api/paas/v4", keyPlaceholder: "your-glm-key" },
    { id: "moonshot", displayName: "Kimi", desc: "Moonshot AI", baseUrl: "https://api.moonshot.cn/v1", keyPlaceholder: "sk-..." },
    { id: "volcengine", displayName: "Volcengine", desc: "ByteDance Volcengine", baseUrl: "https://ark.cn-beijing.volces.com/api/v3", keyPlaceholder: "sk-..." },
    { id: "bailian", displayName: "Model Studio", desc: "Alibaba Cloud Model Studio (Qwen + third-party models)", baseUrl: "https://ws-3vv2b1h4akmem3xz.cn-beijing.maas.aliyuncs.com/compatible-mode/v1", keyPlaceholder: "sk-..." },
    { id: "gemini", displayName: "Gemini", desc: "Google AI Studio (free)", baseUrl: "https://generativelanguage.googleapis.com/v1beta", keyPlaceholder: "AIza..." },
    { id: "mimo", displayName: "MiMo", desc: "Xiaomi Token Plan", baseUrl: "https://token-plan-cn.xiaomimimo.com/v1", keyPlaceholder: "sk-..." },
    { id: "minimax", displayName: "MiniMax", desc: "MiniMax", baseUrl: "https://api.minimax.chat/v1", keyPlaceholder: "your-minimax-key" },
    { id: "bedrock", displayName: "AWS Bedrock", desc: "AWS Bedrock OpenAI-Compatible API", baseUrl: "https://bedrock-mantle.us-east-1.api.aws/v1", keyPlaceholder: "bedrock-api-key" },
    { id: "openrouter", displayName: "OpenRouter", desc: "Unified API aggregating hundreds of models", baseUrl: "https://openrouter.ai/api/v1", keyPlaceholder: "sk-or-v1-..." },
    { id: "opencode", displayName: "OpenCode Zen", desc: "OpenCode's curated model gateway", baseUrl: "https://opencode.ai/zen/v1", keyPlaceholder: "opencode-zen-key" },
  ],
};

app.get("/api/providers/presets", (req, res) => {
  const lang = reqLang(req);
  res.json({ ok: true, presets: PROVIDER_PRESETS[lang] || PROVIDER_PRESETS.zh });
});

app.get("/api/providers/:providerId/models", (req, res) => {
  // 静态目录(沿用 model-registry)
  const catalog = modelRegistry.getModelCatalog(reqLang(req));
  const list = catalog[req.params.providerId] || [];
  res.json({ ok: true, providerId: req.params.providerId, models: list.map((m) => m.id) });
});

// 真实查询 provider 可用模型(需要 key, 真去调 /models endpoint)
app.post("/api/providers/:providerId/models", async (req, res) => {
  const { providerId } = req.params;
  const { apiKey, baseUrl } = req.body || {};
  const key = apiKey || settingsStore.getApiKey(providerId);
  if (!key) return res.status(400).json({ ok: false, error: "apiKey required" });

  const base = baseUrl
    || settingsStore.getEffectiveConfig(providerId, "baseUrl")
    || "https://api.openai.com/v1";
  try {
    const r = await fetch(`${base}/models`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      return res.status(502).json({ ok: false, error: `HTTP ${r.status}: ${text.slice(0, 200)}` });
    }
    const data = await r.json();
    const models = (data.data || data.models || []).map((m) => m.id || m);
    res.json({ ok: true, providerId, models });
  } catch (e) {
    res.status(502).json({ ok: false, error: e.message });
  }
});

// 验证 key 真的能调通(沿用 appUIRefiner /verify-model)
app.post("/api/providers/:providerId/verify-model", async (req, res) => {
  const { providerId } = req.params;
  const { apiKey, baseUrl, modelId } = req.body || {};
  const key = apiKey || settingsStore.getApiKey(providerId);
  if (!key || !modelId) return res.status(400).json({ ok: false, error: "apiKey and modelId required" });

  const base = baseUrl
    || settingsStore.getEffectiveConfig(providerId, "baseUrl")
    || "https://api.openai.com/v1";
  try {
    const r = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: modelId, messages: [{ role: "user", content: "hi" }], max_tokens: 1 }),
      signal: AbortSignal.timeout(10_000),
    });
    if (r.ok) {
      res.json({ ok: true, providerId, modelId, message: i18n.t(reqLang(req), "verify.ok") });
    } else {
      const text = await r.text().catch(() => "");
      res.json({ ok: false, providerId, modelId, error: `HTTP ${r.status}: ${text.slice(0, 200)}` });
    }
  } catch (e) {
    res.json({ ok: false, providerId, modelId, error: e.message });
  }
});

/** API key 脱敏 */
function maskApiKey(key) {
  if (!key || key.length < 12) return "****";
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[agentEvaluator] open http://localhost:${PORT}`);
});
