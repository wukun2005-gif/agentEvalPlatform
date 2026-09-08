// Dashboard page — 跨 agent 的健康度总览(Phase C: 加 "Run all fixtures" 一键充实)

export async function renderDashboard({ mount, getTenantId, getAgentId }) {
  mount.innerHTML = `<div class="page">
    <h1>📊 Agent Dashboard</h1>
    <p class="page-sub">当前 tenant / agent 的健康度、最近失败</p>
    <div style="display: flex; gap: 10px; align-items: center;">
      <button id="runFixturesBtn" class="primary">▶ Run all fixtures(充实 dashboard)</button>
      <span id="runFixturesStatus" style="color: var(--fg-dim); font-size: 12px;"></span>
    </div>
    <div id="dashContent">Loading…</div>
  </div>`;

  document.getElementById("runFixturesBtn").addEventListener("click", runFixtures);
  await refresh();

  async function runFixtures() {
    const btn = document.getElementById("runFixturesBtn");
    const status = document.getElementById("runFixturesStatus");
    btn.disabled = true;
    status.textContent = "Running…";
    const res = await fetch("/api/run-fixtures", { method: "POST" }).then((r) => r.json());
    status.textContent = `✅ 跑了 ${res.ran} 个 fixture,刷新中…`;
    await refresh();
    btn.disabled = false;
    status.textContent = `✅ 上次: 跑了 ${res.ran} 个 fixture`;
  }

  async function refresh() {
    const agentId = getAgentId();
    const tenantId = getTenantId();
    const [info, history, failures] = await Promise.all([
      fetch("/api/info").then((r) => r.json()),
      fetch(`/api/history?tenantId=${tenantId}&agentId=${agentId}&limit=200`).then((r) => r.json()),
      fetch("/api/failures?limit=10").then((r) => r.json()),
    ]);

    const total = history.length;
    const passed = history.filter((e) => e.gate_decision === "PASS").length;
    const blocked = total - passed;
    const passRate = total > 0 ? ((passed / total) * 100).toFixed(1) : "—";

    const now = Date.now();
    const last24h = history.filter((e) => new Date(e.timestamp).getTime() > now - 24 * 3600_000);
    const pass24 = last24h.length > 0 ? (last24h.filter((e) => e.gate_decision === "PASS").length / last24h.length) * 100 : 0;

    document.getElementById("dashContent").innerHTML = `
      <div class="stat-grid">
        <div class="stat-tile">
          <div class="stat-label">Total Evals (tenant)</div>
          <div class="stat-value">${total}</div>
        </div>
        <div class="stat-tile">
          <div class="stat-label">Pass Rate (lifetime)</div>
          <div class="stat-value ${passRate >= 95 ? "pass" : passRate >= 80 ? "warn" : "block"}">${passRate}%</div>
        </div>
        <div class="stat-tile">
          <div class="stat-label">Pass Rate (24h)</div>
          <div class="stat-value ${pass24 >= 95 ? "pass" : pass24 >= 80 ? "warn" : "block"}">${pass24.toFixed(1)}%</div>
        </div>
        <div class="stat-tile">
          <div class="stat-label">Recent Failures</div>
          <div class="stat-value ${blocked > 0 ? "block" : "pass"}">${failures.length}</div>
        </div>
      </div>

      <div class="card">
        <h2>Recent Evidence (${tenantId} · ${agentId})</h2>
        ${total === 0 ? '<p style="color: var(--fg-dim);">暂无 evidence。点上方 "Run all fixtures" 一键充实,或去 Replay 跑 query。</p>' : `
        <table>
          <thead><tr>
            <th>Time</th><th>Query</th><th>Decision</th><th>Trust</th><th>Failed Dims</th><th></th>
          </tr></thead>
          <tbody>
            ${history.slice(0, 20).map((e) => {
              const failed = (e.evaluations || []).filter((x) => !x.passed).map((x) => x.name).join(", ") || "—";
              return `<tr>
                <td style="font-family: var(--mono); font-size: 12px; color: var(--fg-dim);">${e.timestamp.replace("T", " ").slice(0, 19)}</td>
                <td>${escapeHtml(e.query)}</td>
                <td><span class="gate-badge ${e.gate_decision === "PASS" ? "pass" : "blocked"}">${e.gate_decision}</span></td>
                <td>${(e.trust_score * 100).toFixed(0)}%</td>
                <td style="color: var(--block);">${failed}</td>
                <td><a href="#/compliance?id=${e.evidence_id}">查看 Evidence →</a></td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>`}
      </div>
    `;
  }
}

function escapeHtml(s) { return s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c])); }
