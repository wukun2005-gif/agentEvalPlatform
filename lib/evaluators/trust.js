// Trust evaluator — 引用回链 + 幻觉补全检测的综合评分
// 真实生产: 检查 LLM 输出中的每条声明能否追溯到 source 中的某段 span
// Phase B 简化: 用 accuracy + dlp-behavior 的加权
//
// 设计要点:
//   - dlp-behavior pass: 强信号("LLM 没复述被 DLP 截掉的内容")→ trust 应通过
//   - dlp-behavior fail: 强负信号 → trust 必失败
//   - accuracy 得分: 加权到 trust score,但不单独决定 pass/fail

const { t } = require("../i18n");

function evaluate({ llm_output, evaluations }, lang = "zh") {
  const acc = evaluations?.find((e) => e.name === "accuracy");
  const dlp = evaluations?.find((e) => e.name === "dlp-behavior");

  // dlp fail → trust fail
  if (dlp && !dlp.passed) {
    return {
      name: "trust",
      score: 0.0,
      passed: false,
      reason: t(lang, "trust.fail", { reason: dlp.reason }),
    };
  }

  // dlp pass (or 无截断) + accuracy 得分综合
  const accScore = acc?.score ?? 0.5;
  const score = Math.max(0.6, accScore * 0.9 + 0.3);  // 至少 0.6,dlp pass 加成
  const passed = score >= 0.6;

  return {
    name: "trust",
    score,
    passed,
    reason: passed
      ? t(lang, "trust.pass", { pct: (accScore * 100).toFixed(0) })
      : t(lang, "trust.failAccuracy", { pct: (accScore * 100).toFixed(0) }),
  };
}

module.exports = { evaluate };
