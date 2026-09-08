// Accuracy evaluator — LLM-as-judge (mockup)
// 用 LLM 判断输出是否准确基于输入内容
//
// 真实生产会调用 LLM 做语义判断，这里用规则 mockup 模拟 LLM-as-judge 行为：
// 1. 检查输出是否包含输入中不存在的关键信息（幻觉）
// 2. 检查输出是否与输入语义一致

function evaluate({ llm_input, llm_output, ruleLog }) {
  if (!llm_output || llm_output.length === 0) {
    return { name: "accuracy", score: 0.5, passed: true, reason: "输出为空" };
  }

  // Mockup LLM-as-judge: 检查是否复述了被 DLP 截断的内容
  const redactedSpans = (ruleLog || []).map((r) => r.span).filter(Boolean);
  const echoedSpans = redactedSpans.filter((span) => llm_output.includes(span));
  
  if (echoedSpans.length > 0) {
    // LLM 复述了被截断的内容 → 幻觉补全
    return {
      name: "accuracy",
      score: 0.0,
      passed: false,
      reason: `LLM 复述了 ${echoedSpans.length} 处被 DLP 截断的原文: ${echoedSpans.join("、")} — 幻觉补全`,
      judge: "mock-llm-as-judge",
    };
  }

  // Mockup LLM-as-judge: 检查输出与输入的语义一致性
  // 简化版：检查输出中是否有输入中完全没有的实体/数字
  // 先过滤掉列表编号（如 "1. 背景"、"2、目标"）— 这些是格式化文本，不是幻觉数据
  const listNumberPattern = /^\d+[.、．]\s*/gm;
  const outputWithoutListNumbers = llm_output.replace(listNumberPattern, "");
  const inputNumbers = (llm_input.match(/\d+/g) || []);
  const outputNumbers = (outputWithoutListNumbers.match(/\d+/g) || []);
  const hallucinatedNumbers = outputNumbers.filter((n) => !inputNumbers.includes(n));
  
  // 允许少量合理推断（如"3 个"vs 输入中的列表）
  const hallucinationRatio = hallucinatedNumbers.length / Math.max(outputNumbers.length, 1);
  
  if (hallucinationRatio > 0.5 && outputNumbers.length > 2) {
    return {
      name: "accuracy",
      score: 0.3,
      passed: false,
      reason: `LLM 输出包含 ${hallucinatedNumbers.length} 个输入中不存在的数字: ${hallucinatedNumbers.slice(0, 3).join("、")} 等 — 可能幻觉`,
      judge: "mock-llm-as-judge",
    };
  }

  // 通过
  return {
    name: "accuracy",
    score: 0.85,
    passed: true,
    reason: "LLM 输出与输入语义一致，未检测到幻觉",
    judge: "mock-llm-as-judge",
  };
}

module.exports = { evaluate };
