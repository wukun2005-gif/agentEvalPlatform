// Drift Detection — 跨时间/模型/租户漂移
// Phase B 简化: 对一个 agent 在多个 evidence pack 上的通过率做对比
// 真实生产: z-score、CUSUM、季节性分解等

const { t } = require("./i18n");

function computeDrift(history, dimension = "time", lang = "zh") {
  if (!history || history.length < 4) {
    return {
      drift_score: 0,
      alerts: [],
      message: t(lang, "drift.insufficient", { n: history?.length || 0 }),
    };
  }

  // 按 dimension 分组
  const groups = groupBy(history, dimension);
  const alerts = [];

  for (const [key, evs] of Object.entries(groups)) {
    if (evs.length < 2) continue;
    const passRate = evs.filter((e) => e.gate_decision === "PASS").length / evs.length;
    const failCount = evs.length - evs.filter((e) => e.gate_decision === "PASS").length;

    // 统计各 evaluator 失败数
    const failuresByEval = {};
    for (const ev of evs) {
      if (ev.gate_decision === "BLOCKED") {
        for (const e of ev.evaluations || []) {
          if (!e.passed) {
            failuresByEval[e.name] = (failuresByEval[e.name] || 0) + 1;
          }
        }
      }
    }

    if (passRate < 0.95) {
      const topFailingEval = Object.entries(failuresByEval).sort((a, b) => b[1] - a[1])[0];
      alerts.push({
        group: key,
        dimension,
        pass_rate: (passRate * 100).toFixed(1) + "%",
        sample_size: evs.length,
        fail_count: failCount,
        top_failing_eval: topFailingEval?.[0] || "unknown",
        top_failing_count: topFailingEval?.[1] || 0,
        suspected_root_cause: inferRootCause(topFailingEval?.[0], key, lang),
      });
    }
  }

  return {
    drift_score: alerts.length > 0 ? 1.0 - alerts.reduce((acc, a) => acc + parseFloat(a.pass_rate), 0) / alerts.length : 0,
    alerts,
    message: alerts.length === 0 ? t(lang, "drift.noAlert") : t(lang, "drift.alerts", { n: alerts.length }),
  };
}

function groupBy(items, key) {
  if (key === "time") {
    // 按小时分桶
    const buckets = {};
    for (const e of items) {
      const hour = e.timestamp?.slice(0, 13) || "unknown";
      buckets[hour] = (buckets[hour] || []).concat(e);
    }
    return buckets;
  }
  if (key === "model") {
    const buckets = {};
    for (const e of items) {
      const m = e.llm_model || "default";
      buckets[m] = (buckets[m] || []).concat(e);
    }
    return buckets;
  }
  if (key === "tenant") {
    const buckets = {};
    for (const e of items) {
      const tid = e.tenant_id || "default";
      buckets[tid] = (buckets[tid] || []).concat(e);
    }
    return buckets;
  }
  return { all: items };
}

function inferRootCause(evalName, groupKey, lang = "zh") {
  if (evalName === "dlp-behavior") {
    if (groupKey.includes("eu")) return t(lang, "drift.cause.eu");
    return t(lang, "drift.cause.dlp");
  }
  if (evalName === "source-scoping") return t(lang, "drift.cause.scoping");
  if (evalName === "latency") return t(lang, "drift.cause.latency");
  if (evalName === "accuracy") return t(lang, "drift.cause.accuracy");
  return t(lang, "drift.cause.generic", { name: evalName });
}

module.exports = { computeDrift };
