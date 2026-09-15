// Drift page — 跨时间/模型/租户的漂移检测

import { t, apiFetch } from "../i18n.js";

export async function renderDrift({ mount }) {
  mount.innerHTML = `<div class="page"><h1>${t('driftTitle')}</h1><p class="page-sub">${t('driftSubtitle')}</p><div id="driftContent">${t('triageLoading')}</div></div>`;

  const [byTime, byModel, byTenant] = await Promise.all([
    apiFetch("/api/drift?dim=time").then((r) => r.json()),
    apiFetch("/api/drift?dim=model").then((r) => r.json()),
    apiFetch("/api/drift?dim=tenant").then((r) => r.json()),
  ]);

  const renderGroup = (title, dim) => {
    const data = dim === "time" ? byTime : dim === "model" ? byModel : byTenant;
    return `
      <div class="card">
        <h2>${t('driftBy')} ${title}</h2>
        <p style="color: var(--fg-dim); font-size: 12px;">${data.message}</p>
        ${data.alerts.length === 0 ? `<div style="color: var(--pass);">${t('noDrift')}</div>` :
          data.alerts.map((a) => `
            <div class="alert">
              <div class="alert-title">${t('driftAlertTitle')} ${a.group} · ${t("driftPassRate")} ${a.pass_rate}</div>
              <div class="alert-meta">${t('driftSampleSize')} ${a.sample_size} · ${t('driftFailCount')} ${a.fail_count} · ${t('driftTopFailing')}: <code>${a.top_failing_eval}</code> (${a.top_failing_count} ${t('times')})</div>
              <div class="alert-cause">${t('driftRootCause')}: <b>${a.suspected_root_cause}</b></div>
            </div>
          `).join("")}
      </div>
    `;
  };

  document.getElementById("driftContent").innerHTML =
    renderGroup(t("driftDimTenant"), "tenant") +
    renderGroup(t("driftDimTime"), "time") +
    renderGroup(t("driftDimModel"), "model");
}
