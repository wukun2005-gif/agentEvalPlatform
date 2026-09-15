// Triage page — Failure Triage + 修复草稿

import { t, apiFetch } from "../i18n.js";

export async function renderTriage({ mount }) {
  mount.innerHTML = `<div class="page"><h1>${t('triageTitle')}</h1><p class="page-sub">${t('triageSubtitle')}</p><div id="triageContent">${t('triageLoading')}</div></div>`;

  const failures = await apiFetch("/api/failures?limit=20").then((r) => r.json());

  if (failures.length === 0) {
    document.getElementById("triageContent").innerHTML = `<div class="card">${t('triageHealthy')}</div>`;
    return;
  }

  // 对每个 failure 拉 evidence 详情 + 跑 triage
  const triages = await Promise.all(failures.slice(0, 5).map(async (e) => {
    const tri = await apiFetch("/api/triage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ evidence: { ...e, evaluations: e.evaluations } }),
    }).then((r) => r.json());
    return { evidence: e, triage: tri };
  }));

  document.getElementById("triageContent").innerHTML = `
    <div class="card">
      <h2>${t('topFailures')}</h2>
      ${triages.map(({ evidence, triage }) => `
        <div style="border-bottom: 1px solid var(--border); padding: 14px 0;">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
            <span class="gate-badge blocked">BLOCKED</span>
            <span style="color: var(--fg-dim); font-size: 12px;">${evidence.evidence_id}</span>
            <span style="color: var(--fg-dim); font-size: 12px;">·</span>
            <span style="color: var(--fg-dim); font-size: 12px;">${evidence.tenant_id}</span>
          </div>
          <div style="margin-bottom: 8px;"><b>${t('query')}:</b> ${escapeHtml(evidence.query)}</div>
          <div style="margin-bottom: 8px;"><b>${t('category')}:</b> <code style="color: var(--warn);">${triage.category || "—"}</code> · <b>${t('severity')}:</b> ${triage.severity || "—"}</div>
          <div style="margin-bottom: 8px;"><b>${t('rootCause')}:</b> ${triage.root_cause || "—"}</div>
          <div style="margin-bottom: 6px;"><b>${t('suggestedFix')}:</b></div>
          <div class="fix-patch">${escapeHtml(triage.suggested_fix?.patch || "—")}</div>
          <div style="display: flex; gap: 8px; align-items: center;">
            <a href="#/compliance?id=${evidence.evidence_id}" style="margin-left: auto; color: var(--accent);">${t('viewEvidencePack')}</a>
          </div>
        </div>
      `).join("")}
    </div>
  `;

}

function escapeHtml(s) { return s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c])); }
function escapeAttr(s) { return s.replace(/"/g, "&quot;"); }
