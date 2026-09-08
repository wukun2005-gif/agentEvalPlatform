// Accuracy evaluator — 字符串 diff
// 输出中有多少 token 在 input 中可见 → 衡量"准确性"
//
// 阈值说明:demo 阶段简单 token diff 会把 LLM 的合理概括(比如"3 个客户项目" vs input
// 里的"完成率 100%")也判成"不在 input"。真实生产用 LLM-as-judge 做语义判断。
// 这里阈值放宽到 0.15 — 容忍合理概括,只抓硬性幻觉。

function evaluate({ llm_input, llm_output }) {
  const tokenize = (s) => s.split(/[\s,。;、]+/).filter((t) => t.length >= 2);
  const inputTokens = new Set(tokenize(llm_input));
  const outputTokens = tokenize(llm_output);
  if (outputTokens.length === 0) {
    return { name: "accuracy", score: 0.5, passed: true, reason: "输出为空" };
  }
  const hit = outputTokens.filter((t) => inputTokens.has(t)).length;
  const ratio = hit / outputTokens.length;
  const passed = ratio >= 0.15;  // demo 阈值,Phase C 用 LLM-as-judge 替换
  return {
    name: "accuracy",
    score: ratio,
    passed,
    reason: `输出 token 中 ${(ratio * 100).toFixed(0)}% 在 input 中可见 (${hit}/${outputTokens.length})`,
  };
}

module.exports = { evaluate };
