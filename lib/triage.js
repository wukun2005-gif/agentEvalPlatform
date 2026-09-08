// Triage — 失败分类 + 修复草稿生成
// 输入: evidence pack + 评估结果
// 输出: { category, root_cause, suggested_fix, auto_applicable, related_failure_id }

const playbook = require("../data/playbook");

function triage({ evidence, evaluations }) {
  const failed = evaluations.filter((e) => !e.passed);
  if (failed.length === 0) {
    return { status: "PASS", message: "无失败,无需 triage" };
  }

  // 优先级: high severity 优先 (dlp-behavior > source-scoping > accuracy > trust > ...)
  const severityOrder = { high: 0, medium: 1, low: 2 };
  const sorted = [...failed].sort((a, b) => {
    const sa = severityOrder[playbook[a.name]?.severity] ?? 3;
    const sb = severityOrder[playbook[b.name]?.severity] ?? 3;
    return sa - sb;
  });

  const primary = sorted[0];
  const entry = playbook[primary.name];

  if (!entry) {
    return {
      status: "UNKNOWN_FAILURE",
      failed_dimensions: failed.map((f) => f.name),
      message: `未知 failure: ${primary.name},无对应 playbook`,
    };
  }

  return {
    status: "TRIAGED",
    failure_id: `fail-${evidence.evidence_id}`,
    primary_dimension: primary.name,
    category: entry.category,
    severity: entry.severity,
    root_cause: entry.root_cause,
    suggested_fix: entry.suggested_fix,
    auto_applicable: entry.auto_applicable,
    all_failed: failed.map((f) => ({
      dimension: f.name,
      reason: f.reason,
    })),
  };
}

module.exports = { triage };
