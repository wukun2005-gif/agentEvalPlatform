// Cost evaluator — token 计数 + 估算美元
// 价格从 model-registry.js 查(单数据源)
// 真实生产按 model tier 计费( gpt-4o-mini vs gpt-4o 价差 30x )

const modelRegistry = require("../model-registry");

function evaluate({ usage, model }) {
  const tokens = usage?.total_tokens || 0;
  const inputTokens = usage?.prompt_tokens || 0;
  const outputTokens = usage?.completion_tokens || 0;

  // 从 registry 查 model 的价格;查不到时用 gpt-4o-mini 作为 fallback
  const caps = model ? modelRegistry.getModelCapabilities(model) : null;
  const usdPer1K = caps?.evalCostPer1K || 0.00015;
  // 粗估:每 1K token 单价(不区分 input/output,精度足够 demo)
  const usd = (tokens * usdPer1K) / 1000;

  const passed = tokens < 4000;
  return {
    name: "cost",
    score: passed ? 0.9 : 0.3,
    passed,
    reason: `${tokens} tokens · $${usd.toFixed(6)} (model=${model || "default"}, $${usdPer1K}/1K, target < 4000 tokens)`,
    usage,
    usd,
    model,
  };
}

module.exports = { evaluate };
