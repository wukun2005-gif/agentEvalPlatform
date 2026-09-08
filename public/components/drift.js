// Drift page — 跨时间/模型/租户的漂移检测

export async function renderDrift({ mount }) {
  mount.innerHTML = `<div class="page"><h1>📈 Drift Detection</h1><p class="page-sub">跨时间 / 模型 / 租户的通过率漂移 — 平台先于客户发现</p><div id="driftContent">Loading…</div></div>`;

  const [byTime, byModel, byTenant] = await Promise.all([
    fetch("/api/drift?dim=time").then((r) => r.json()),
    fetch("/api/drift?dim=model").then((r) => r.json()),
    fetch("/api/drift?dim=tenant").then((r) => r.json()),
  ]);

  const renderGroup = (title, dim) => {
    const data = dim === "time" ? byTime : dim === "model" ? byModel : byTenant;
    return `
      <div class="card">
        <h2>Drift by ${title}</h2>
        <p style="color: var(--fg-dim); font-size: 12px;">${data.message}</p>
        ${data.alerts.length === 0 ? '<div style="color: var(--pass);">✅ 无漂移告警</div>' :
          data.alerts.map((a) => `
            <div class="alert">
              <div class="alert-title">⚠ ${a.group} · Pass rate ${a.pass_rate}</div>
              <div class="alert-meta">样本 ${a.sample_size} · 失败 ${a.fail_count} · 主失败维度: <code>${a.top_failing_eval}</code> (${a.top_failing_count} 次)</div>
              <div class="alert-cause">🧠 根因候选: <b>${a.suspected_root_cause}</b></div>
            </div>
          `).join("")}
      </div>
    `;
  };

  document.getElementById("driftContent").innerHTML =
    renderGroup("Tenant", "tenant") +
    renderGroup("Time", "time") +
    renderGroup("Model", "model");
}
