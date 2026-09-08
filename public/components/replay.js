// Replay page — 单 query 完整管线回放

export async function renderReplay({ mount, getTenantId, getAgentId }) {


  mount.innerHTML = `
    <div class="page">
      <h1>▶ Playground · 单 query 完整管线</h1>
      <p class="page-sub">输入 query → <b>逐帧</b>走完 6 步管线 → 看到 Gate 决策 + Evidence Pack</p>

      <div class="card">
        <div class="query-row">
          <input id="qInput" type="text" placeholder="输入 query, 或点下方示例" />
          <button id="runBtn" class="primary">Run ▶</button>
        </div>

        <div class="example-pills">
          <span style="color: var(--fg-dim); font-size: 12px; align-self: center;">示例:</span>
          <button data-q="张三最近表现">幻觉补全</button>
          <button data-q="上周我们组完成了哪些项目">正常 PASS</button>
          <button data-q="EU 合规审计近况">跨租户越权</button>
          <button data-q="员工绩效列表">Source Scoping</button>
          <button data-q="test-latency-fail">Latency 超时</button>
          <button data-q="写一篇长文">Cost 超预算</button>
        </div>
        <p style="color: var(--fg-dim); font-size: 11px; margin-top: 8px;">
          💡 示例使用预设 fixture（确保演示效果）；自定义 query 调用你配置的 LLM
        </p>

      </div>

      <div class="card" id="resultCard" hidden>
        <div id="resultHead" style="margin-bottom: 12px;"></div>
        <ol class="pipeline" id="pipeline"></ol>
        <details id="evPackDetails" open>
          <summary>📋 Evidence Pack (审计 JSON)</summary>
          <pre id="evidenceJson"></pre>
        </details>
      </div>
    </div>
  `;

  document.getElementById("qInput").addEventListener("keydown", (e) => { if (e.key === "Enter") run(); });
  document.getElementById("runBtn").addEventListener("click", run);
  document.querySelectorAll(".example-pills button").forEach((b) => {
    b.addEventListener("click", () => { document.getElementById("qInput").value = b.dataset.q; });
  });

  async function run() {
    const query = document.getElementById("qInput").value.trim();
    if (!query) return;
    const runBtn = document.getElementById("runBtn");

    runBtn.disabled = true; runBtn.textContent = "Streaming…";
    const card = document.getElementById("resultCard");
    card.hidden = false;
    document.getElementById("resultHead").innerHTML = `<span class="gate-badge soft">RUNNING…</span> <span style="color: var(--fg-dim); font-size: 12px;">6 步管线逐帧执行中</span>`;
    const ol = document.getElementById("pipeline");
    ol.innerHTML = "";
    document.getElementById("evidenceJson").textContent = "(等待管线完成…)";

    const res = await fetch("/api/run-stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, agentId: getAgentId(), tenantId: getTenantId() }),
    });
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    const steps = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n\n");
      buf = lines.pop() || "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const payload = JSON.parse(line.slice(6));
        if (payload.kind === "step") {
          steps.push(payload.step);
          appendStep(steps);
        } else if (payload.kind === "done") {
          renderDone(payload, steps);
        } else if (payload.kind === "error") {
          alert("Pipeline error: " + payload.error);
        }
      }
    }

    runBtn.disabled = false; runBtn.textContent = "Run ▶";
  }

  function appendStep(steps) {
    const ol = document.getElementById("pipeline");
    ol.innerHTML = "";
    for (const step of steps) {
      const li = document.createElement("li");
      li.className = step.name === "gate" ? (steps.find((s) => s.name === "gate")?.data?.decision === "PASS" ? "pass" : "fail") : "";
      const detail = renderStepDetail(step);
      li.innerHTML = `<div class="step-label">${step.label}</div><div class="step-detail">${detail}</div>`;
      ol.appendChild(li);
    }
    ol.lastElementChild?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function renderDone(done, steps) {
    const gate = done.gate;
    const badge = `<span class="gate-badge ${gate.decision === "PASS" ? "pass" : gate.decision === "BLOCKED" ? "blocked" : "soft"}">${gate.decision}</span>`;
    const meta = `wall ${done.wall_ms}ms · ${done.evaluations.length} 维评估 · model=${done.model || "?"} · failed: ${gate.failed_dimensions.join(", ") || "无"}`;
    document.getElementById("resultHead").innerHTML = `${badge} <span style="color: var(--fg-dim); font-size: 12px; margin-left: 12px;">${meta}</span>`;
    appendStep(steps);
    document.getElementById("evidenceJson").textContent = JSON.stringify(done.evidence, null, 2);
  }

  function renderStepDetail(step) {
    switch (step.name) {
      case "pull": {
        const ids = step.data.actual.map((s) => s.id);
        return `拉到 ${ids.length} 条 source: ${ids.join(", ") || "(无)"}`;
      }
      case "dlp": {
        const log = step.data.ruleLog || [];
        const original = step.data.original || [];
        const redacted = step.data.redacted || [];
        const llmInput = step.data.llmInput || "";
        
        let html = `<b>命中 ${log.length} 条规则</b>`;
        
        if (log.length > 0) {
          html += `<div style="margin-top: 8px;">`;
          log.forEach(r => {
            html += `<div style="font-size: 11px; color: var(--fg-dim); margin: 4px 0;">
              <span class="redacted">${r.span || r.before}</span> → <span style="color: var(--success);">[已脱敏]</span>
              <span style="color: var(--fg-dim);">(${r.rule})</span>
            </div>`;
          });
          html += `</div>`;
        }
        
        // 显示原始 vs 截断对比
        if (original.length > 0) {
          html += `<details style="margin-top: 8px;"><summary style="cursor: pointer; color: var(--fg-dim); font-size: 12px;">查看原始内容 vs 脱敏后</summary>`;
          original.forEach((src, i) => {
            const origText = src.content || "";
            const redText = redacted[i]?.content || origText;
            html += `<div style="margin-top: 8px; padding: 8px; background: var(--panel); border-radius: 4px; font-size: 11px;">
              <div><b>来源:</b> ${src.id}</div>
              <div style="margin-top: 4px;"><b>原始:</b> <span style="color: var(--fg-dim);">${origText.slice(0, 200)}${origText.length > 200 ? '...' : ''}</span></div>
              <div style="margin-top: 4px;"><b>脱敏后:</b> ${redText.replace(/\[REDACTED\]/g, '<span class="redacted">[REDACTED]</span>').slice(0, 200)}${redText.length > 200 ? '...' : ''}</div>
            </div>`;
          });
          html += `</details>`;
        }
        
        return html;
      }
      case "llm": {
        const out = step.data.content;
        const llmInput = step.data.llmInput || "";
        const highlighted = out
          .replace(/绩效 A/g, '<span class="hallucinated">绩效 A</span>')
          .replace(/涨薪 8%/g, '<span class="hallucinated">涨薪 8%</span>');
        let html = `<b>source:</b> ${step.data.source} · <b>model:</b> ${step.data.model || "?"} · <b>${step.data.latency_ms}ms</b>`;
        
        // 显示 LLM 输入 context
        if (llmInput) {
          html += `\n<details style="margin-top: 6px;"><summary style="cursor: pointer; color: var(--fg-dim); font-size: 11px;">查看 LLM 输入 context</summary>`;
          html += `<div style="margin-top: 4px; padding: 8px; background: var(--panel); border-radius: 4px; font-size: 11px; white-space: pre-wrap;">${escapeHtml(llmInput)}</div>`;
          html += `</details>`;
        }
        
        html += `\n${highlighted}`;
        return html;
      }
      case "trust": return step.data.source;
      case "evaluate":
        return step.data.map((e) => `${e.passed ? "✅" : "❌"} <b>${e.name}</b>: ${e.reason}`).join("\n");
      case "gate":
        return `<b>${step.data.decision}</b> · 策略=${step.data.policy} · 失败维度=${step.data.failed_dimensions.join(", ") || "无"}`;
      default: return JSON.stringify(step.data).slice(0, 200);
    }
  }
  
  function escapeHtml(s) { return s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c])); }
}
