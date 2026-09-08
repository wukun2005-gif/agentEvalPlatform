// State — 持久化 + 历史 evidence 池
// demo 不是生产,但要有"history" 让 dashboard 不空
// 真实生产会换成 DB

const fs = require("fs");
const path = require("path");

const STATE_FILE = path.join(__dirname, "..", "data", "state.json");
const MAX_HISTORY = 200;

let state = loadState();

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
    }
  } catch (e) {
    // ignore
  }
  return { history: [], triage_actions: [] };
}

function saveState() {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (e) {
    console.error("[state] save failed:", e.message);
  }
}

function recordEvidence(evidence, agent, tenant) {
  // 简化为只存关键字段,避免 state.json 过大
  const compact = {
    evidence_id: evidence.evidence_id,
    agent_id: evidence.agent_id,
    tenant_id: evidence.tenant_id,
    timestamp: evidence.timestamp,
    query: evidence.query,
    gate_decision: evidence.gate_decision,
    trust_score: evidence.trust_score,
    evaluations: evidence.evaluations,
    llm_model: process.env.LLM_MODEL || "fixture",
  };
  state.history.unshift(compact);
  if (state.history.length > MAX_HISTORY) {
    state.history = state.history.slice(0, MAX_HISTORY);
  }
  saveState();
  return compact;
}

function getHistory(filter = {}) {
  let items = state.history;
  if (filter.agentId) items = items.filter((e) => e.agent_id === filter.agentId);
  if (filter.tenantId) items = items.filter((e) => e.tenant_id === filter.tenantId);
  if (filter.limit) items = items.slice(0, filter.limit);
  return items;
}

function getEvidenceById(id) {
  return state.history.find((e) => e.evidence_id === id);
}

function getRecentFailures(limit = 10) {
  return state.history
    .filter((e) => e.gate_decision === "BLOCKED")
    .slice(0, limit);
}

function recordTriageAction({ evidenceId, action, before, after }) {
  state.triage_actions.unshift({
    id: `act-${Date.now()}`,
    evidence_id: evidenceId,
    action,
    before,
    after,
    timestamp: new Date().toISOString(),
  });
  if (state.triage_actions.length > MAX_HISTORY) {
    state.triage_actions = state.triage_actions.slice(0, MAX_HISTORY);
  }
  saveState();
}

function applyFix({ evidenceId, patch }) {
  recordTriageAction({
    evidenceId,
    action: "apply_fix",
    before: null,
    after: { patch },
  });
  return { status: "applied", evidence_id: evidenceId };
}

function reset() {
  state = { history: [], triage_actions: [] };
  saveState();
}

function seedDemoData() {
  if (state.history.length > 0) return; // 已有数据,不 seed
  // 注入一批历史 evidence,让 dashboard "lived-in"
  const now = Date.now();
  const seedQueries = [
    { q: "上周销售业绩", gate: "PASS", tenant: "contoso", agent: "my-sales-summarizer-v3" },
    { q: "张三的 Q3 总结", gate: "PASS", tenant: "contoso", agent: "my-sales-summarizer-v3" },
    { q: "Q4 财务回顾", gate: "PASS", tenant: "contoso", agent: "external-hr-insights" },
    { q: "李四最近表现", gate: "BLOCKED", tenant: "contoso", agent: "external-hr-insights", reason: "DLP_BEHAVIOR" },
    { q: "客户名单更新", gate: "PASS", tenant: "contoso", agent: "my-sales-summarizer-v3" },
    { q: "EU 区域销售", gate: "BLOCKED", tenant: "contoso-eu", agent: "my-sales-summarizer-v3", reason: "SOURCE_SCOPING" },
    { q: "Q3 OKR 进度", gate: "PASS", tenant: "contoso-eu", agent: "external-hr-insights" },
    { q: "本周会议安排", gate: "PASS", tenant: "contoso", agent: "my-sales-summarizer-v3" },
  ];

  for (let i = 0; i < seedQueries.length; i++) {
    const s = seedQueries[i];
    const evidence_id = `ev-seed-${now}-${i.toString().padStart(3, "0")}`;
    state.history.push({
      evidence_id,
      agent_id: s.agent,
      tenant_id: s.tenant,
      timestamp: new Date(now - (seedQueries.length - i) * 3600_000).toISOString(),
      query: s.q,
      gate_decision: s.gate,
      trust_score: s.gate === "PASS" ? 0.85 : 0.45,
      evaluations: s.gate === "PASS"
        ? [{ name: "dlp-behavior", passed: true, reason: "无截断" }]
        : [{ name: s.reason || "dlp-behavior", passed: false, reason: "seeded failure" }],
      llm_model: "fixture",
    });
  }
  saveState();
}

module.exports = {
  recordEvidence,
  getHistory,
  getEvidenceById,
  getRecentFailures,
  recordTriageAction,
  applyFix,
  reset,
  seedDemoData,
};
