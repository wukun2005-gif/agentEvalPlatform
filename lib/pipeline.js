// Pipeline 编排 — 6 步(支持 streaming 模式,逐帧返回中间结果)
//   1. Pull(数据拉取)
//   2. DLP(数据脱敏)
//   3. LLM(生成回答)
//   4. Trust(可信度 + 幻觉补全检测)
//   5. Evaluate(7 维评估)
//   6. Gate(决策)
//
// 用法:
//   - await run() → 一次性返回完整结果
//   - await runStream({ onStep }) → 每完成一步调 onStep,前端可以逐帧渲染

const pullSource = require("./pull-source");
const dlp = require("./dlp");
const llmClient = require("./llm-client");
const evaluators = require("./evaluators");
const gate = require("./gate");
const evidencePack = require("./evidence-pack");
const { t } = require("./i18n");

async function run({ query, agent, tenant, policy = "block", model, lang = "zh" }) {
  const steps = [];
  const t0 = Date.now();

  const pullResult = pullSource.decidePlan(query, agent, tenant, lang);
  steps.push({ name: "pull", label: t(lang, "step.pull"), data: pullResult });

  const redacted = dlp.applyDLP(pullResult.actual, tenant, lang);
  const allRuleLog = redacted.flatMap((s) => s.ruleLog || []);
  const llmInput = dlp.buildLLMContext(redacted);
  steps.push({ name: "dlp", label: t(lang, "step.dlp"), data: { original: pullResult.actual, redacted, ruleLog: allRuleLog, llmInput } });

  const llmRes = await llmClient.callLLM({ messages: [{ role: "user", content: query }], query, model, lang });
  steps.push({ name: "llm", label: t(lang, "step.llm"), data: { content: llmRes.content, usage: llmRes.usage, latency_ms: llmRes.latency_ms, source: llmRes.source, model: model || llmRes.model, llmInput } });

  steps.push({ name: "trust", label: t(lang, "step.trust"), data: { source: t(lang, "trust.source") } });

  const wallMs = Date.now() - t0;
  const evaluations = evaluators.runAll({
    query, llm_input: llmInput, llm_output: llmRes.content, ruleLog: allRuleLog,
    agent, tenant, pulledSources: pullResult.actual,
    usage: llmRes.usage, llmLatencyMs: llmRes.latency_ms, wallMs,
    model: model || llmRes.model,
    lang,
  });
  steps.push({ name: "evaluate", label: t(lang, "step.evaluate"), data: evaluations });

  const gateResult = gate.decide(evaluations, policy);
  steps.push({ name: "gate", label: t(lang, "step.gate"), data: gateResult });

  const evidence = evidencePack.build({
    query, agent_id: agent.id, tenant_id: tenant.id,
    pulledSources: redacted, llmInput, llmOutput: llmRes.content,
    evaluations, gate: gateResult, ruleLog: allRuleLog, lang,
  });

  return { steps, evidence, gate: gateResult, evaluations, llm_usage: llmRes.usage, wall_ms: wallMs, model: model || llmRes.model };
}

// 逐帧流式:每完成一步就 emit 一次
async function runStream({ query, agent, tenant, policy = "block", onStep, delayMs = 200, model, lang = "zh" }) {
  const t0 = Date.now();
  const emit = (step) => {
    if (onStep) onStep(step);
  };
  const sleep = () => new Promise((r) => setTimeout(r, delayMs));

  // 1. Pull
  const pullResult = pullSource.decidePlan(query, agent, tenant, lang);
  emit({ kind: "step", step: { name: "pull", label: t(lang, "step.pull"), data: pullResult } });
  await sleep();

  // 2. DLP
  const redacted = dlp.applyDLP(pullResult.actual, tenant, lang);
  const allRuleLog = redacted.flatMap((s) => s.ruleLog || []);
  const llmInput = dlp.buildLLMContext(redacted);
  emit({ kind: "step", step: { name: "dlp", label: t(lang, "step.dlp"), data: { original: pullResult.actual, redacted, ruleLog: allRuleLog, llmInput } } });
  await sleep();

  // 3. LLM
  const llmRes = await llmClient.callLLM({ messages: [{ role: "user", content: query }], query, model, lang });
  emit({ kind: "step", step: { name: "llm", label: t(lang, "step.llm"), data: { content: llmRes.content, usage: llmRes.usage, latency_ms: llmRes.latency_ms, source: llmRes.source, model: model || llmRes.model } } });
  await sleep();

  // 4. Trust
  emit({ kind: "step", step: { name: "trust", label: t(lang, "step.trust"), data: { source: t(lang, "trust.source") } } });
  await sleep();

  // 5. Evaluate
  const wallMs = Date.now() - t0;
  const evaluations = evaluators.runAll({
    query, llm_input: llmInput, llm_output: llmRes.content, ruleLog: allRuleLog,
    agent, tenant, pulledSources: pullResult.actual,
    usage: llmRes.usage, llmLatencyMs: llmRes.latency_ms, wallMs,
    model: model || llmRes.model,
    lang,
  });
  emit({ kind: "step", step: { name: "evaluate", label: t(lang, "step.evaluate"), data: evaluations } });
  await sleep();

  // 6. Gate
  const gateResult = gate.decide(evaluations, policy);
  emit({ kind: "step", step: { name: "gate", label: t(lang, "step.gate"), data: gateResult } });

  // Evidence Pack
  const evidence = evidencePack.build({
    query, agent_id: agent.id, tenant_id: tenant.id,
    pulledSources: redacted, llmInput, llmOutput: llmRes.content,
    evaluations, gate: gateResult, ruleLog: allRuleLog, lang,
  });

  emit({ kind: "done", evidence, gate: gateResult, evaluations, wall_ms: wallMs, llm_usage: llmRes.usage, model: model || llmRes.model });
  return { evidence, gate: gateResult, evaluations, wall_ms: wallMs };
}

module.exports = { run, runStream };
