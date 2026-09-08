// Evidence Pack 生成器 — 严格对齐 PRD §4.3 结构
//
// 关键字段:
//   - pulled_sources: 实际拉到的 source + DLP 决策
//   - dlp_decision: DLP rule log
//   - llm_input_context: LLM 实际看到的输入(post-DLP)
//   - llm_output: LLM 实际输出
//   - diff: 关键!展示"output 包含 input 没有的字符串"→ 幻觉补全证据
//   - trust_score, gate_decision, gate_evaluator: 决策结果

function buildLLMOnlyStrings(llm_input, llm_output, ruleLog) {
  // 主路径: 用 ruleLog 中的 span("绩效 A"、"涨薪 8%" 这种整体片段)做检测 —
  // 这些是 dlp-behavior 评估器已验证的"被 DLP 截掉的原文",
  // 在 llm_output 中如出现,即"幻觉补全"的最强证据。
  const redactedSpans = (ruleLog || []).map((r) => r.before);
  const echoedFromRuleLog = [...new Set(redactedSpans.filter((span) => llm_output.includes(span)))];

  // 补充: 简单 token 化,捕一些 ruleLog 没覆盖的额外幻觉
  // (例如 LLM 完全自由发挥,未命中任何 DLP 规则但仍是幻觉)
  const tokenize = (s) => s.split(/[\s,。;、]+/).filter((t) => t.length >= 2);
  const inputTokens = new Set(tokenize(llm_input));
  const outputTokens = tokenize(llm_output);
  const extra = outputTokens.filter((t) => !inputTokens.has(t) && t.length >= 2 && !echoedFromRuleLog.some((s) => s.includes(t)));

  return [...echoedFromRuleLog, ...extra];
}

function build({ query, agent_id, tenant_id, pulledSources, llmInput, llmOutput, evaluations, gate, ruleLog }) {
  const trustEval = evaluations.find((e) => e.name === "trust");
  const dlpEval = evaluations.find((e) => e.name === "dlp-behavior");

  const llm_only_strings = buildLLMOnlyStrings(llmInput, llmOutput, ruleLog);

  return {
    evidence_id: `ev-${Date.now()}-${Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0")}`,
    agent_id,
    tenant_id,
    timestamp: new Date().toISOString(),
    query,
    pulled_sources: pulledSources.map((s) => ({
      id: s.id,
      type: s.type,
      decision: s.decision,
      rule: s.ruleLog?.[0]?.rule || "none",
    })),
    dlp_decision: {
      rule_log: ruleLog,
      summary: `${ruleLog.length} 处脱敏`,
    },
    llm_input_context: llmInput,
    llm_output: llmOutput,
    diff: {
      llm_only_strings,
      in_input: llm_only_strings.length === 0,
      interpretation: llm_only_strings.length === 0
        ? "无幻觉补全 — LLM 输出内容均在 input 中可见"
        : `幻觉补全 — LLM 输出包含 ${llm_only_strings.length} 个 input 中不存在的字符串: ${llm_only_strings.slice(0, 3).join("、")} 等`,
    },
    trust_score: trustEval?.score ?? 0.0,
    gate_decision: gate.decision,
    gate_evaluator: "agent-evaluator-platform",
    evaluations,  // 7 维全量,便于 dashboard 查看
    audit: {
      evaluator: "agent-evaluator-platform v0.1",
      human_review_required: gate.decision === "BLOCKED",
      evidence_complete: true,
    },
  };
}

module.exports = { build };
