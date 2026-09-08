// Evidence Pack 视图 (print 友好 + 完整 evidence)

export async function renderCompliance({ mount }) {
  const params = new URLSearchParams(location.hash.split("?")[1] || "");
  const id = params.get("id");

  mount.innerHTML = `<div class="page"><h1>📋 Evidence Pack</h1><p class="page-sub">结构化、可被合规官签字认可的审计记录</p><div id="complianceContent">Loading…</div></div>`;

  if (id) {
    // 单条 evidence 详情 — 从 /api/evidence/:id 拿完整版本
    const found = await fetch(`/api/evidence/${id}`).then((r) => r.ok ? r.json() : null);
    if (!found) {
      document.getElementById("complianceContent").innerHTML = `<div class="card">Evidence ${id} not found</div>`;
      return;
    }
    renderEvidence(found);
  } else {
    // 列表
    const history = await fetch("/api/history?limit=50").then((r) => r.json());
    document.getElementById("complianceContent").innerHTML = `
      <div class="card">
        <h2>最近 50 条 Evidence</h2>
        <table>
          <thead><tr><th>Evidence ID</th><th>Time</th><th>Tenant</th><th>Agent</th><th>Query</th><th>Decision</th><th></th></tr></thead>
          <tbody>
            ${history.map((e) => `<tr>
              <td style="font-family: var(--mono); font-size: 12px;">${e.evidence_id}</td>
              <td style="font-family: var(--mono); font-size: 12px; color: var(--fg-dim);">${e.timestamp.replace("T", " ").slice(0, 19)}</td>
              <td>${e.tenant_id}</td>
              <td>${e.agent_id}</td>
              <td>${escapeHtml(e.query)}</td>
              <td><span class="gate-badge ${e.gate_decision === "PASS" ? "pass" : "blocked"}">${e.gate_decision}</span></td>
              <td><a href="#/compliance?id=${e.evidence_id}">详情 →</a></td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>
    `;
  }
}

function renderEvidence(e) {
  // 审计视图: 与 PRD §4.3 字段对齐 + print 友好
  const auditView = {
    evidence_id: e.evidence_id,
    agent_id: e.agent_id,
    tenant_id: e.tenant_id,
    timestamp: e.timestamp,
    query: e.query,
    gate_decision: e.gate_decision,
    trust_score: e.trust_score,
    evaluations: e.evaluations,
    audit: {
      evaluator: "agent-evaluator-platform v0.1",
      evidence_complete: true,
      human_review_required: e.gate_decision === "BLOCKED",
    },
  };

  const failedDims = (e.evaluations || []).filter((x) => !x.passed).map((x) => x.name);

  document.getElementById("complianceContent").innerHTML = `
    <div class="card" id="printCard">
      <div class="no-print" style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
        <span class="gate-badge ${e.gate_decision === "PASS" ? "pass" : "blocked"}">${e.gate_decision}</span>
        <span style="color: var(--fg-dim); font-family: var(--mono); font-size: 12px;">${e.evidence_id}</span>
        <a href="#/compliance" style="margin-left: auto; color: var(--accent);">← 返回列表</a>
        <button class="primary" onclick="window.print()" style="margin-left: 8px;">🖨 Print</button>
      </div>
      <h2 style="font-size: 18px; margin-bottom: 4px;">${escapeHtml(e.query)}</h2>
      <p style="color: var(--fg-dim); font-size: 12px; margin-bottom: 16px;">
        <b>Tenant:</b> ${e.tenant_id} · <b>Agent:</b> ${e.agent_id} · <b>Time:</b> ${e.timestamp}
      </p>

      ${e.gate_decision === "BLOCKED" ? `
        <div class="alert" style="margin-bottom: 16px;">
          <div class="alert-title">⛔ Gate Blocked — Human Review Required</div>
          <div class="alert-meta">失败维度: ${failedDims.join(", ") || "—"}</div>
          ${e.diff ? `<div class="alert-cause">🧠 根因: ${escapeHtml(e.diff.interpretation || "—")}</div>` : ""}
        </div>
      ` : `
        <div style="background: rgba(46, 160, 67, 0.1); border: 1px solid var(--pass); border-radius: 6px; padding: 10px 14px; margin-bottom: 16px;">
          <b style="color: var(--pass);">✅ Gate Passed</b> — 全部评估通过,响应已交付给用户
        </div>
      `}

      <h3 style="font-size: 13px; margin-top: 16px;">7 维评估</h3>
      <table>
        <thead><tr><th>维度</th><th>结果</th><th>分数</th><th>原因</th></tr></thead>
        <tbody>
          ${(e.evaluations || []).map((ev) => `<tr>
            <td><b>${ev.name}</b></td>
            <td><span class="gate-badge ${ev.passed ? "pass" : "blocked"}">${ev.passed ? "PASS" : "FAIL"}</span></td>
            <td>${(ev.score * 100).toFixed(0)}%</td>
            <td style="color: var(--fg-dim);">${ev.reason || "—"}</td>
          </tr>`).join("")}
        </tbody>
      </table>

      <h3 style="font-size: 13px; margin-top: 16px;">完整 JSON (审计 / SIEM 接入用)</h3>
      <pre>${JSON.stringify(auditView, null, 2)}</pre>
    </div>
  `;
}

function escapeHtml(s) { return s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c])); }
