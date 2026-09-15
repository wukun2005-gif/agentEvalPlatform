// State — 持久化 + 历史 evidence 池
// demo 不是生产,但要有"history" 让 dashboard 不空
// 真实生产会换成 DB

const fs = require("fs");
const path = require("path");
const { t, normalizeLang } = require("./i18n");

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

// seed 出来的 demo query 是"给用户看的文案",所以也要分语言
const SEED_QUERIES = {
  zh: [
    { q: "上周销售业绩", gate: "PASS", tenant: "contoso", agent: "my-sales-summarizer-v3" },
    { q: "张三的 Q3 总结", gate: "PASS", tenant: "contoso", agent: "my-sales-summarizer-v3" },
    { q: "Q4 财务回顾", gate: "PASS", tenant: "contoso", agent: "external-hr-insights" },
    { q: "李四最近表现", gate: "BLOCKED", tenant: "contoso", agent: "external-hr-insights", reason: "DLP_BEHAVIOR" },
    { q: "客户名单更新", gate: "PASS", tenant: "contoso", agent: "my-sales-summarizer-v3" },
    { q: "EU 区域销售", gate: "BLOCKED", tenant: "contoso-eu", agent: "my-sales-summarizer-v3", reason: "SOURCE_SCOPING" },
    { q: "Q3 OKR 进度", gate: "PASS", tenant: "contoso-eu", agent: "external-hr-insights" },
    { q: "本周会议安排", gate: "PASS", tenant: "contoso", agent: "my-sales-summarizer-v3" },
  ],
  en: [
    { q: "Last week's sales performance", gate: "PASS", tenant: "contoso", agent: "my-sales-summarizer-v3" },
    { q: "Zhang San's Q3 summary", gate: "PASS", tenant: "contoso", agent: "my-sales-summarizer-v3" },
    { q: "Q4 financial review", gate: "PASS", tenant: "contoso", agent: "external-hr-insights" },
    { q: "Li Si's recent performance", gate: "BLOCKED", tenant: "contoso", agent: "external-hr-insights", reason: "DLP_BEHAVIOR" },
    { q: "Customer list update", gate: "PASS", tenant: "contoso", agent: "my-sales-summarizer-v3" },
    { q: "EU regional sales", gate: "BLOCKED", tenant: "contoso-eu", agent: "my-sales-summarizer-v3", reason: "SOURCE_SCOPING" },
    { q: "Q3 OKR progress", gate: "PASS", tenant: "contoso-eu", agent: "external-hr-insights" },
    { q: "This week's meeting schedule", gate: "PASS", tenant: "contoso", agent: "my-sales-summarizer-v3" },
  ],
};

const SEED_ID_PREFIX = "ev-seed-";

// seed 里用 category(SDLP_BEHAVIOR)当 failure 名会和 playbook 的键对不上,
// 导致 Triage 页把 seed 出来的失败判成 "未知 failure";这里映射回 evaluator 维度名。
const REASON_TO_DIMENSION = {
  DLP_BEHAVIOR: "dlp-behavior",
  SOURCE_SCOPING: "source-scoping",
};

function buildSeedRows(lang) {
  const list = SEED_QUERIES[normalizeLang(lang)] || SEED_QUERIES.zh;
  const now = Date.now();
  return list.map((s, i) => ({
    evidence_id: `${SEED_ID_PREFIX}${now}-${i.toString().padStart(3, "0")}`,
    agent_id: s.agent,
    tenant_id: s.tenant,
    timestamp: new Date(now - (list.length - i) * 3600_000).toISOString(),
    query: s.q,
    gate_decision: s.gate,
    trust_score: s.gate === "PASS" ? 0.85 : 0.45,
    evaluations: s.gate === "PASS"
      ? [{ name: "dlp-behavior", passed: true, reason: t(lang, "seed.reason.pass") }]
      : [{
          name: REASON_TO_DIMENSION[s.reason] || s.reason || "dlp-behavior",
          passed: false,
          reason: t(lang, "seed.reason.fail"),
        }],
    llm_model: "fixture",
  }));
}

function seedDemoData(lang = "zh") {
  if (state.history.length > 0) return; // 已有数据,不 seed
  // 注入一批历史 evidence,让 dashboard "lived-in"
  state.history.push(...buildSeedRows(lang));
  state.seedLang = normalizeLang(lang);
  saveState();
}

/**
 * 语言变了以后,把 demo seed 出来的历史换成本语言的版本。
 * 只动 evidence_id 以 ev-seed- 开头的行 —— 真实跑出来的 evidence 一概不碰。
 */
function reseedLocale(lang) {
  const target = normalizeLang(lang);
  if (state.seedLang === target) return false;
  const real = state.history.filter((e) => !String(e.evidence_id || "").startsWith(SEED_ID_PREFIX));
  state.history = [...buildSeedRows(target), ...real]
    .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
  state.seedLang = target;
  saveState();
  return true;
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
  reseedLocale,
};
