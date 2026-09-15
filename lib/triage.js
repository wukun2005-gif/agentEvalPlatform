// Triage — 失败分类 + 修复草稿生成
// 输入: evidence pack + 评估结果
// 输出: { category, root_cause, suggested_fix, auto_applicable, related_failure_id }
//
// root_cause / suggested_fix 的内容来自 playbook,那里是 { zh, en } 双语对象,
// 由这里按 lang 解析成字符串后再返回。

const playbook = require("../data/playbook");
const { t, pick } = require("./i18n");

function triage({ evidence, evaluations }, lang = "zh") {
  const failed = evaluations.filter((e) => !e.passed);
  if (failed.length === 0) {
    return { status: "PASS", message: t(lang, "triage.noFailure") };
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
      message: t(lang, "triage.unknown", { name: primary.name }),
    };
  }

  return {
    status: "TRIAGED",
    failure_id: `fail-${evidence.evidence_id}`,
    primary_dimension: primary.name,
    category: entry.category,
    severity: entry.severity,
    root_cause: pick(lang, entry.root_cause),
    suggested_fix: {
      type: entry.suggested_fix.type,
      patch: pick(lang, entry.suggested_fix.patch),
      reason: pick(lang, entry.suggested_fix.reason),
    },
    auto_applicable: entry.auto_applicable,
    all_failed: failed.map((f) => ({
      dimension: f.name,
      reason: f.reason,
    })),
  };
}

module.exports = { triage };
