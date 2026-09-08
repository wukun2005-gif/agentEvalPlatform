// Quality evaluator — Phase B 简化版:用启发式规则
// 真实生产会用 LLM-as-judge(另一个 LLM 评这个 LLM 的输出),Phase C 接入

function evaluate({ llm_output, query }) {
  // 启发式: 输出长度合理(>= 10 字)、不重复、回答了 query 关键词
  const lengthOk = llm_output.length >= 10 && llm_output.length <= 2000;
  const keywordsHit = query
    .split(/[\s,。;、?？]+/)
    .filter((w) => w.length >= 2)
    .some((w) => llm_output.includes(w));

  const passed = lengthOk;
  return {
    name: "quality",
    score: passed ? 0.85 : 0.4,
    passed,
    reason: passed
      ? `输出长度 ${llm_output.length} 合理,关键词命中: ${keywordsHit ? "是" : "否"}`
      : `输出长度异常: ${llm_output.length}`,
  };
}

module.exports = { evaluate };
