// 7 维 evaluators 索引
// Phase B: 全部实装。顺序: 1) dlp-behavior 核心 → 2) accuracy → 3) source-scoping
//          4) trust(综合) → 5) quality → 6) latency → 7) cost

const dlpBehavior = require("./dlp-behavior");
const accuracy = require("./accuracy");
const sourceScoping = require("./source-scoping");
const trust = require("./trust");
const quality = require("./quality");
const latency = require("./latency");
const cost = require("./cost");

function runAll(params) {
  const {
    llm_input,
    llm_output,
    ruleLog,
    agent,
    tenant,
    pulledSources,
    usage,
    llmLatencyMs,
    wallMs,
    model,
  } = params;

  // 1. dlp-behavior
  const dlp = dlpBehavior.evaluate({ llm_input, llm_output, ruleLog });

  // 2. accuracy
  const acc = accuracy.evaluate({ llm_input, llm_output });

  // 3. source-scoping
  const scoping = sourceScoping.evaluate({ agent, tenant, pulledSources });

  // 4. trust(依赖 dlp + accuracy)
  const tr = trust.evaluate({ llm_output, evaluations: [dlp, acc] });

  // 5. quality
  const q = quality.evaluate({ llm_output, query: params.query });

  // 6. latency
  const lat = latency.evaluate({ llmLatencyMs, wallMs });

  // 7. cost
  const c = cost.evaluate({ usage, model });

  return [dlp, acc, scoping, tr, q, lat, c];
}

module.exports = { runAll };
