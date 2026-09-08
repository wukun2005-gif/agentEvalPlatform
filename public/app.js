// app.js — Phase D: 5 页 SPA 路由 + LLM Settings modal

import { renderReplay } from "./components/replay.js";
import { renderDashboard } from "./components/dashboard.js";
import { renderTriage } from "./components/triage.js";
import { renderDrift } from "./components/drift.js";
import { renderCompliance } from "./components/compliance.js";
import "./components/settings.js";

const ROUTES = {
  replay: renderReplay,
  dashboard: renderDashboard,
  triage: renderTriage,
  drift: renderDrift,
  compliance: renderCompliance,
};

const content = document.getElementById("content");

(async function init() {
  const info = await fetch("/api/info").then((r) => r.json());
  const modeLabel = document.getElementById("modeLabel");
  modeLabel.textContent = `LLM: ${info.llmMode.toUpperCase()} · ${info.model}`;
  document.getElementById("modeDot").classList.add(info.llmMode);

  // sidebar LLM 状态
  const llmStatus = document.getElementById("llmStatus");
  const keyMark = info.hasApiKey ? "🔑" : "○";
  llmStatus.textContent = `${keyMark} ${info.provider}/${info.model} · ${info.llmMode}`;
  llmStatus.style.color = info.hasApiKey ? "var(--pass)" : "var(--fg-dim)";

  const tenantSel = document.getElementById("tenantId");
  const agentSel = document.getElementById("agentId");
  for (const t of info.tenants) {
    const o = document.createElement("option");
    o.value = t.id;
    o.textContent = `${t.name}`;
    tenantSel.appendChild(o);
  }
  for (const a of info.agents) {
    const o = document.createElement("option");
    o.value = a.id;
    o.textContent = `${a.name} [${a.kind}]`;
    agentSel.appendChild(o);
  }

  // 加载模型目录到全局变量
  try {
    const catalogRes = await fetch("/api/models").then((r) => r.json());
    window.modelCatalog = catalogRes.catalog || {};
  } catch {
    window.modelCatalog = {};
  }

  window.addEventListener("hashchange", route);
  if (!location.hash) location.hash = "#/replay";
  route();

  // Reset
  document.getElementById("resetBtn").addEventListener("click", async () => {
    if (!confirm("Reset 会清空所有 evidence 历史并重新 seed demo 数据。继续？")) return;
    await fetch("/api/reset", { method: "POST" });
    route();
  });

  // LLM Settings modal
  new SettingsModal();
})();

function route() {
  const hash = location.hash.replace("#/", "") || "replay";
  const page = hash.split("?")[0];
  document.querySelectorAll(".nav-item").forEach((el) => {
    el.classList.toggle("active", el.dataset.page === page);
  });
  const render = ROUTES[page] || ROUTES.replay;
  render({ mount: content, getTenantId: () => document.getElementById("tenantId").value,
           getAgentId: () => document.getElementById("agentId").value });
}

export { route };
