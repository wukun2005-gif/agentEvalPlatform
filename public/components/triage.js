// Triage page — Failure Triage + 修复草稿

export async function renderTriage({ mount }) {
  mount.innerHTML = `<div class="page"><h1>🩺 Failure Triage</h1><p class="page-sub">每个失败自动对照 playbook 分类 + 给出修复草稿</p><div id="triageContent">Loading…</div></div>`;

  const failures = await fetch("/api/failures?limit=20").then((r) => r.json());

  if (failures.length === 0) {
    document.getElementById("triageContent").innerHTML = `<div class="card">无失败 — 平台健康</div>`;
    return;
  }

  // 对每个 failure 拉 evidence 详情 + 跑 triage
  const triages = await Promise.all(failures.slice(0, 5).map(async (e) => {
    const tri = await fetch("/api/triage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ evidence: { ...e, evaluations: e.evaluations } }),
    }).then((r) => r.json());
    return { evidence: e, triage: tri };
  }));

  document.getElementById("triageContent").innerHTML = `
    <div class="card">
      <h2>Top 5 Recent Failures (auto-triaged)</h2>
      ${triages.map(({ evidence, triage }) => `
        <div style="border-bottom: 1px solid var(--border); padding: 14px 0;">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
            <span class="gate-badge blocked">BLOCKED</span>
            <span style="color: var(--fg-dim); font-size: 12px;">${evidence.evidence_id}</span>
            <span style="color: var(--fg-dim); font-size: 12px;">·</span>
            <span style="color: var(--fg-dim); font-size: 12px;">${evidence.tenant_id}</span>
          </div>
          <div style="margin-bottom: 8px;"><b>Query:</b> ${escapeHtml(evidence.query)}</div>
          <div style="margin-bottom: 8px;"><b>Category:</b> <code style="color: var(--warn);">${triage.category || "—"}</code> · <b>Severity:</b> ${triage.severity || "—"}</div>
          <div style="margin-bottom: 8px;"><b>Root cause:</b> ${triage.root_cause || "—"}</div>
          <div style="margin-bottom: 6px;"><b>Suggested fix:</b></div>
          <div class="fix-patch">${escapeHtml(triage.suggested_fix?.patch || "—")}</div>
          <div style="display: flex; gap: 8px; align-items: center;">
            <a href="#/compliance?id=${evidence.evidence_id}" style="margin-left: auto; color: var(--accent);">查看 Evidence Pack →</a>
          </div>
        </div>
      `).join("")}
    </div>
  `;

}

function escapeHtml(s) { return s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c])); }
function escapeAttr(s) { return s.replace(/"/g, "&quot;"); }
