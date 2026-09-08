// Model Registry — 改自 appUIRefiner/server/src/providers/model-capabilities-registry.ts
//
// 设计沿用 appUIRefiner 的三个核心原则:
//   1. 单一数据源: CAPABILITY_PRESETS 字典 + PROVIDER_MODEL_IDS 目录
//   2. 最长前缀匹配: 精确 → 前缀 → 默认值
//   3. 数据/逻辑分离: presets 是数据, get*() 是 API
//
// 调整点(场景差异):
//   - appUIRefiner 用于 chat agent,关注 reasoning/vision/structured output
//   - 本项目用于 agent EVALUATION,关注 temperature stability/cost/eval reliability
//   - 因此元数据字段不同(见 ModelCapabilities 注释)
//
// 缩量: 从 220 条 preset 缩到 ~12 条主流模型 + 4 个 provider (agentEvaluator demo 范围)

/**
 * @typedef {Object} ModelCapabilities
 * @property {number}  contextWindow          - 上下文窗口大小
 * @property {number}  maxOutputTokens        - 最大输出 token
 * @property {boolean} supportsTemperature    - 是否支持自定义 temperature(eval 关键!可重复性)
 * @property {[number, number]} temperatureRange  - temperature 范围
 * @property {boolean} supportsStructuredOutput   - 是否支持 JSON mode
 * @property {boolean} supportsVision        - 视觉能力(本 demo 不用,但保留)
 * @property {"message"|"parameter"} systemPromptMode - system prompt 传递方式
 * @property {string} [recommendation]       - 客户端展示的推荐语
 * @property {string} [evalRecommendation]  - 用于 eval 场景的推荐语(可与 general 不同)
 * @property {number} [evalReliability]      - eval 场景下的可靠性评分 0-1(越高越好)
 * @property {number} [evalCostPer1K]        - 每 1K token 的成本(USD),仅供排序参考
 * @property {string} [deprecated]          - 弃用提示,UI 标灰
 */

/** @type {Record<string, Partial<ModelCapabilities>>} */
const CAPABILITY_PRESETS = {
  // ── OpenAI ──
  "gpt-4o-mini": { contextWindow: 128_000, maxOutputTokens: 16_384, supportsTemperature: true, temperatureRange: [0, 2], supportsStructuredOutput: true, supportsVision: true, systemPromptMode: "message", recommendation: "OpenAI GPT-4o Mini (快速经济)", evalRecommendation: "首选 eval 模型: 便宜+快+稳定", evalReliability: 0.85, evalCostPer1K: 0.00015 },
  "gpt-4o":      { contextWindow: 128_000, maxOutputTokens: 16_384, supportsTemperature: true, temperatureRange: [0, 2], supportsStructuredOutput: true, supportsVision: true, systemPromptMode: "message", recommendation: "OpenAI GPT-4o (强)", evalReliability: 0.92, evalCostPer1K: 0.005 },
  "gpt-4.1-mini":{ contextWindow: 1_000_000, maxOutputTokens: 32_768, supportsTemperature: true, temperatureRange: [0, 2], supportsStructuredOutput: true, supportsVision: true, systemPromptMode: "message", evalRecommendation: "长 context eval 优选", evalReliability: 0.85, evalCostPer1K: 0.0004 },
  "gpt-":        { supportsTemperature: true, temperatureRange: [0, 2], supportsStructuredOutput: true, supportsVision: false, systemPromptMode: "message" },

  // ── Anthropic Claude ──
  "claude-haiku-4-5":  { contextWindow: 200_000, maxOutputTokens: 8_192, supportsTemperature: true, temperatureRange: [0, 1], supportsStructuredOutput: true, supportsVision: true, systemPromptMode: "message", recommendation: "Claude Haiku 4.5 (快速经济)", evalReliability: 0.88, evalCostPer1K: 0.001 },
  "claude-sonnet-4-5": { contextWindow: 200_000, maxOutputTokens: 16_384, supportsTemperature: true, temperatureRange: [0, 1], supportsStructuredOutput: true, supportsVision: true, systemPromptMode: "message", recommendation: "Claude Sonnet 4.5 (强)", evalReliability: 0.93, evalCostPer1K: 0.003 },
  "claude-opus-4":     { contextWindow: 1_000_000, maxOutputTokens: 32_768, supportsTemperature: true, temperatureRange: [0, 1], supportsStructuredOutput: true, supportsVision: true, systemPromptMode: "message", recommendation: "Claude Opus 4 (最强)", evalReliability: 0.95, evalCostPer1K: 0.015 },
  "claude-":           { supportsTemperature: true, temperatureRange: [0, 1], supportsStructuredOutput: true, supportsVision: true, systemPromptMode: "message" },

  // ── Google Gemini ──
  "gemini-2.5-flash":  { contextWindow: 1_000_000, maxOutputTokens: 65_536, supportsTemperature: true, temperatureRange: [0, 2], supportsStructuredOutput: true, supportsVision: true, systemPromptMode: "parameter", recommendation: "Gemini 2.5 Flash (快速)", evalReliability: 0.85, evalCostPer1K: 0.000075 },
  "gemini-2.5-pro":    { contextWindow: 1_000_000, maxOutputTokens: 65_536, supportsTemperature: true, temperatureRange: [0, 2], supportsStructuredOutput: true, supportsVision: true, systemPromptMode: "parameter", recommendation: "Gemini 2.5 Pro (强)", evalReliability: 0.92, evalCostPer1K: 0.00125 },
  "gemini-":           { contextWindow: 1_000_000, maxOutputTokens: 8_192, supportsTemperature: true, temperatureRange: [0, 2], supportsStructuredOutput: true, supportsVision: true, systemPromptMode: "parameter" },

  // ── DeepSeek ──
  "deepseek-v4-flash": { contextWindow: 1_000_000, maxOutputTokens: 384_000, supportsTemperature: true, temperatureRange: [0, 2], supportsStructuredOutput: true, supportsVision: false, systemPromptMode: "message", recommendation: "DeepSeek V4 Flash (极便宜)", evalReliability: 0.80, evalCostPer1K: 0.00005 },
  "deepseek-v4-pro":   { contextWindow: 1_000_000, maxOutputTokens: 384_000, supportsTemperature: true, temperatureRange: [0, 2], supportsStructuredOutput: true, supportsVision: false, systemPromptMode: "message", recommendation: "DeepSeek V4 Pro (强)", evalReliability: 0.90, evalCostPer1K: 0.0007 },
  "deepseek-":         { contextWindow: 65_536, maxOutputTokens: 8_192, supportsTemperature: true, temperatureRange: [0, 2], supportsStructuredOutput: false, supportsVision: false, systemPromptMode: "message" },

  // ── Qwen (通义千问) ──
  "qwen-plus": { contextWindow: 131_072, maxOutputTokens: 8_192, supportsTemperature: true, temperatureRange: [0, 2], supportsStructuredOutput: true, supportsVision: false, systemPromptMode: "message", recommendation: "通义千问 Plus (均衡)", evalReliability: 0.82, evalCostPer1K: 0.0004 },
  "qwen-max":  { contextWindow: 32_768, maxOutputTokens: 8_192, supportsTemperature: true, temperatureRange: [0, 2], supportsStructuredOutput: true, supportsVision: false, systemPromptMode: "message", recommendation: "通义千问 Max (强)", evalReliability: 0.88, evalCostPer1K: 0.002 },
  "qwen-":     { supportsTemperature: true, temperatureRange: [0, 2], supportsStructuredOutput: true, supportsVision: false, systemPromptMode: "message" },

  // ── GLM (智谱) ──
  "glm-4.6":      { contextWindow: 200_000, maxOutputTokens: 128_000, supportsTemperature: true, temperatureRange: [0, 1], supportsStructuredOutput: true, supportsVision: false, systemPromptMode: "message", recommendation: "智谱 GLM-4.6", evalReliability: 0.83, evalCostPer1K: 0.0006 },
  "glm-4-flash":  { contextWindow: 128_000, maxOutputTokens: 16_000, supportsTemperature: true, temperatureRange: [0, 1], supportsStructuredOutput: true, supportsVision: false, systemPromptMode: "message", recommendation: "智谱 GLM-4-Flash (快)", evalReliability: 0.78, evalCostPer1K: 0.0001 },
  "glm-":         { supportsTemperature: true, temperatureRange: [0, 1], supportsStructuredOutput: false, supportsVision: false, systemPromptMode: "message" },

  // ── Kimi (月之暗面) ──
  "kimi-k2.5": { contextWindow: 262_000, maxOutputTokens: 32_000, supportsTemperature: false, temperatureRange: [0, 1], supportsStructuredOutput: true, supportsVision: true, systemPromptMode: "message", recommendation: "Kimi K2.5 (长文)", evalReliability: 0.80, evalCostPer1K: 0.001, evalRecommendation: "⚠ 不支持 temperature, eval 不可重复" },
  "kimi-":     { supportsTemperature: false, temperatureRange: [0, 1], supportsStructuredOutput: true, supportsVision: false, systemPromptMode: "message" },

  // ── Doubao (豆包) ──
  "doubao-seed-1-6": { contextWindow: 262_000, maxOutputTokens: 32_000, supportsTemperature: true, temperatureRange: [0, 1], supportsStructuredOutput: true, supportsVision: true, systemPromptMode: "message", recommendation: "豆包 Seed 1.6 (中文强)", evalReliability: 0.85, evalCostPer1K: 0.0002 },
  "doubao-":         { supportsTemperature: true, temperatureRange: [0, 1], supportsStructuredOutput: true, supportsVision: false, systemPromptMode: "message" },

  // ── 通用兜底(任何未知 model 都按这套)──
};

/** @type {ModelCapabilities} */
const DEFAULT_CAPABILITIES = {
  contextWindow: 128_000,
  maxOutputTokens: 8_192,
  supportsTemperature: true,
  temperatureRange: [0, 2],
  supportsStructuredOutput: false,
  supportsVision: false,
  systemPromptMode: "message",
  evalReliability: 0.5,
  evalCostPer1K: 0.001,
};

/**
 * 获取模型能力。匹配逻辑: 精确匹配 → 最长前缀匹配 → 默认值。
 * @param {string} modelId
 * @returns {ModelCapabilities}
 */
function getModelCapabilities(modelId) {
  const normalized = (modelId || "").toLowerCase();

  // 精确匹配
  if (CAPABILITY_PRESETS[normalized]) {
    return { ...DEFAULT_CAPABILITIES, ...CAPABILITY_PRESETS[normalized] };
  }

  // 最长前缀匹配
  let bestMatch = null;
  for (const prefix of Object.keys(CAPABILITY_PRESETS)) {
    if (normalized.startsWith(prefix.toLowerCase())) {
      if (!bestMatch || prefix.length > bestMatch.length) {
        bestMatch = prefix;
      }
    }
  }

  if (bestMatch) {
    return { ...DEFAULT_CAPABILITIES, ...CAPABILITY_PRESETS[bestMatch] };
  }

  return { ...DEFAULT_CAPABILITIES };
}

/**
 * 获取单个模型的对外展示信息(给 UI 用)
 * @param {string} modelId
 */
function getModelInfo(modelId) {
  const caps = getModelCapabilities(modelId);
  const info = { id: modelId };
  if (caps.recommendation) info.recommendation = caps.recommendation;
  if (caps.evalRecommendation) info.evalRecommendation = caps.evalRecommendation;
  if (caps.evalReliability != null) info.evalReliability = caps.evalReliability;
  if (caps.evalCostPer1K != null) info.evalCostPer1K = caps.evalCostPer1K;
  if (caps.deprecated) info.deprecated = caps.deprecated;
  info.contextWindow = caps.contextWindow;
  info.maxOutputTokens = caps.maxOutputTokens;
  info.supportsTemperature = caps.supportsTemperature;
  info.temperatureRange = caps.temperatureRange;
  info.supportsStructuredOutput = caps.supportsStructuredOutput;
  info.supportsVision = caps.supportsVision;
  return info;
}

/**
 * 按 provider 分组的模型目录(给 UI 设置页 / 下拉用)
 * 单数据源: 既用于能力查询, 也用于客户端展示
 */
const PROVIDER_MODEL_IDS = {
  openai: [
    "gpt-4o-mini", "gpt-4o", "gpt-4.1-mini",
  ],
  anthropic: [
    "claude-haiku-4-5", "claude-sonnet-4-5", "claude-opus-4",
  ],
  google: [
    "gemini-2.5-flash", "gemini-2.5-pro",
  ],
  deepseek: [
    "deepseek-v4-flash", "deepseek-v4-pro",
  ],
  qwen: [
    "qwen-plus", "qwen-max",
  ],
  glm: [
    "glm-4.6", "glm-4-flash",
  ],
  moonshot: [
    "kimi-k2.5",
  ],
  volcengine: [
    "doubao-seed-1-6",
  ],
};

/**
 * 获取完整模型目录(给 UI 用)
 * @returns {Record<string, ReturnType<typeof getModelInfo>[]>}
 */
function getModelCatalog() {
  const result = {};
  for (const [provider, ids] of Object.entries(PROVIDER_MODEL_IDS)) {
    result[provider] = ids.map(getModelInfo);
  }
  return result;
}

/**
 * 给一个 eval 场景推荐最合适的模型
 * (按 evalReliability 高 + evalCostPer1K 低 排序)
 */
function recommendEvalModels(provider = null, limit = 5) {
  const all = [];
  for (const [p, ids] of Object.entries(PROVIDER_MODEL_IDS)) {
    if (provider && p !== provider) continue;
    for (const id of ids) {
      const info = getModelInfo(id);
      all.push({ ...info, provider: p });
    }
  }
  all.sort((a, b) => {
    // evalReliability 高优先, 同分时 cost 低优先
    const ar = a.evalReliability || 0.5;
    const br = b.evalReliability || 0.5;
    if (Math.abs(ar - br) > 0.05) return br - ar;
    return (a.evalCostPer1K || 1) - (b.evalCostPer1K || 1);
  });
  return all.slice(0, limit);
}

module.exports = {
  getModelCapabilities,
  getModelInfo,
  getModelCatalog,
  recommendEvalModels,
  PROVIDER_MODEL_IDS,
  CAPABILITY_PRESETS,
};
