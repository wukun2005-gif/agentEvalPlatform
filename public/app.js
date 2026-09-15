// app.js — Phase D: 5 页 SPA 路由 + LLM Settings modal

import { renderReplay } from "./components/replay.js";
import { renderDashboard } from "./components/dashboard.js";
import { renderTriage } from "./components/triage.js";
import { renderDrift } from "./components/drift.js";
import { renderCompliance } from "./components/compliance.js";
import "./components/settings.js";
import { t, getLang, setLang, toggleLang, apiFetch } from "./i18n.js";

const ROUTES = {
  replay: renderReplay,
  playground: renderReplay,
  dashboard: renderDashboard,
  triage: renderTriage,
  drift: renderDrift,
  compliance: renderCompliance,
};

const content = document.getElementById("content");

async function loadAppInfo() {
  const info = await apiFetch("/api/info").then((r) => r.json());
  window.__appInfo = info;
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
  // 语言切换会重跑本函数,先清空再填,并保留用户当前的 tenant/agent 选择
  const keepTenant = tenantSel.value;
  const keepAgent = agentSel.value;
  tenantSel.innerHTML = "";
  agentSel.innerHTML = "";
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
  if (keepTenant && tenantSel.querySelector(`option[value="${keepTenant}"]`)) tenantSel.value = keepTenant;
  if (keepAgent && agentSel.querySelector(`option[value="${keepAgent}"]`)) agentSel.value = keepAgent;
}

(async function init() {
  await loadAppInfo();

  // 加载模型目录到全局变量
  try {
    const catalogRes = await apiFetch("/api/models").then((r) => r.json());
    window.modelCatalog = catalogRes.catalog || {};
  } catch {
    window.modelCatalog = {};
  }

  // 初始化语言切换
  initLangSwitch();
  updateUILanguage(); // 首次加载时同步所有 UI 文字

  window.addEventListener("hashchange", route);
  if (!location.hash) location.hash = "#/playground";
  route();

  // Reset
  document.getElementById("resetBtn").addEventListener("click", async () => {
    if (!confirm(t('resetConfirm'))) return;
    await apiFetch("/api/reset", { method: "POST" });
    await refreshAll();
  });

  // LLM Settings modal
  new SettingsModal();

  // 监听语言变化: 静态文案 + 服务端文案都要跟着换
  window.addEventListener('langchange', async () => {
    updateUILanguage();
    await refreshAll();
  });
})();

/**
 * 语言切换后重新对齐"服务端生成的文案":
 *  - /api/info 会顺带把 demo seed 的历史记录换成本语言(真实 evidence 不动)
 *  - 重新拉模型目录,provider/模型推荐语随之切换
 */
async function refreshAll() {
  await loadAppInfo();
  try {
    const catalogRes = await apiFetch("/api/models").then((r) => r.json());
    window.modelCatalog = catalogRes.catalog || {};
  } catch {
    window.modelCatalog = {};
  }
  route(); // 重新渲染当前页面
}

function initLangSwitch() {
  const langBtn = document.getElementById("langBtn");
  updateLangButton();
  
  langBtn.addEventListener("click", () => {
    toggleLang();
  });
}

function updateLangButton() {
  const langBtn = document.getElementById("langBtn");
  const currentLang = getLang();
  // 按钮文字用"目标语言的自称"(中文/EN),这是语言切换器的通行做法;
  // tooltip 则跟随当前界面语言,避免英文界面里冒出中文提示。
  langBtn.textContent = currentLang === 'zh' ? 'EN' : '中文';
  langBtn.title = currentLang === 'zh' ? t('switchToEnglish') : t('switchToChinese');
}

function updateUILanguage() {
  updateLangButton();
  
  // 更新 html lang 属性
  document.documentElement.lang = getLang() === 'zh' ? 'zh-CN' : 'en';
  
  // 更新顶部栏
  document.querySelector('.brand-sub').textContent = t('appSubtitle');
  document.getElementById('resetBtn').title = t('resetBtn');
  const info = window.__appInfo;
  if (info) {
    document.getElementById('modeLabel').textContent = `LLM: ${info.llmMode.toUpperCase()} · ${info.model}`;
  }
  
  // 更新侧边栏
  document.querySelector('.sidebar-section').textContent = t('settingsSection');
  document.querySelectorAll('.sidebar-form label')[0].textContent = t('tenantLabel');
  document.querySelectorAll('.sidebar-form label')[1].textContent = t('agentLabel');
  document.querySelectorAll('.sidebar-section')[1].textContent = t('llmSection');
  document.getElementById('openSettingsBtn').textContent = t('llmSettings');
  
  // 更新导航
  document.querySelector('[data-page="playground"] span:last-child').textContent = t('playground');
  document.querySelector('[data-page="dashboard"] span:last-child').textContent = t('dashboard');
  document.querySelector('[data-page="triage"] span:last-child').textContent = t('triage');
  document.querySelector('[data-page="drift"] span:last-child').textContent = t('drift');
  document.querySelector('[data-page="compliance"] span:last-child').textContent = t('evidencePack');
  
  // 更新模态框
  document.querySelector('#settingsModal h2').textContent = t('settingsTitle');
  document.getElementById('settingsHint').innerHTML = t('settingsHint');
  document.querySelector('#closeSettingsBtn').textContent = t('close');
  document.getElementById('loadModelsBtn').textContent = t('loadLiveModels');
  document.getElementById('resetSettingsBtn').textContent = t('clearAll');
  document.getElementById('saveSettingsBtn').textContent = t('saveAll');
}

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
