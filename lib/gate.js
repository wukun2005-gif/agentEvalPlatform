// Gate 决策引擎
//
// 策略:demo 默认 block(最有戏剧性,也最符合 PRD 立场)
//   - 任一 DLP / source-scoping 失败 → BLOCK
//   - trust / quality 失败 → SOFT_BLOCK
//   - 全过 → PASS
//
// Phase A 只用 block 策略 + DLP 评估,简化实现。

function decide(evaluations, policy = "block") {
  const failed = evaluations.filter((e) => !e.passed);
  const failed_dimensions = failed.map((e) => e.name);

  let decision = "PASS";
  let severity = 0.0;

  if (failed.length > 0) {
    if (policy === "log-only") {
      decision = "PASS";
    } else if (policy === "soft-block") {
      decision = failed.some((e) => e.name === "dlp-behavior" || e.name === "source-scoping")
        ? "BLOCKED"
        : "SOFT_BLOCKED";
    } else {
      // block
      decision = "BLOCKED";
      severity = 1.0;
    }
  }

  return {
    decision,
    failed_dimensions,
    severity,
    policy,
  };
}

module.exports = { decide };
