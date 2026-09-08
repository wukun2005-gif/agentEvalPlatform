// Playground page — 单 query 完整管线

const DEMO_QUERIES = [
  { q: "张三最近表现", label: "幻觉补全", desc: "LLM 复述被 DLP 截断的内容" },
  { q: "上周我们组完成了哪些项目", label: "正常 PASS", desc: "所有评估通过" },
  { q: "EU 合规审计近况", label: "跨租户越权", desc: "Source Scoping 失败" },
  { q: "员工绩效列表", label: "Source Scoping", desc: "1P Agent 权限越权" },
  { q: "test-latency-fail", label: "Latency 超时", desc: "响应时间超阈值" },
  { q: "写一篇长文", label: "Cost 超预算", desc: "Token 消耗超预算" },
];

export async function renderReplay({ mount, getTenantId, getAgentId }) {
  let isDemoPlaying = false;
  let demoAbort = false;

  mount.innerHTML = `
    <div class="page">
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 4px;">
        <h1 style="margin: 0;">▶ Playground</h1>
        <button id="demoBtn" class="primary" style="font-size: 12px; padding: 4px 12px;">▶ 一键演示</button>
        <button id="demoStopBtn" style="display: none; font-size: 12px; padding: 4px 12px; background: var(--error); color: white; border: none; border-radius: 4px; cursor: pointer;">⏹ 停止</button>
      </div>
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

  // 一键演示
  document.getElementById("demoBtn").addEventListener("click", startDemo);
  document.getElementById("demoStopBtn").addEventListener("click", stopDemo);

  // ESC 停止
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isDemoPlaying) stopDemo();
  });

  async function startDemo() {
    if (isDemoPlaying) return;
    isDemoPlaying = true;
    demoAbort = false;

    document.getElementById("demoBtn").style.display = "none";
    document.getElementById("demoStopBtn").style.display = "inline-block";

    for (let i = 0; i < DEMO_QUERIES.length; i++) {
      if (demoAbort) break;

      const { q, label, desc } = DEMO_QUERIES[i];

      // 显示当前演示信息
      document.getElementById("qInput").value = q;
      document.getElementById("resultCard").hidden = false;
      document.getElementById("resultHead").innerHTML = `
        <span class="gate-badge soft">DEMO ${i + 1}/${DEMO_QUERIES.length}</span>
        <span style="color: var(--fg-dim); font-size: 12px; margin-left: 8px;">${label} — ${desc}</span>
      `;
      document.getElementById("pipeline").innerHTML = "";
      document.getElementById("evidenceJson").textContent = "(演示中…)";

      // 执行 query
      await run(true);

      // 等待 2 秒再执行下一个
      if (i < DEMO_QUERIES.length - 1 && !demoAbort) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    stopDemo();
  }

  function stopDemo() {
    demoAbort = true;
    isDemoPlaying = false;
    document.getElementById("demoBtn").style.display = "inline-block";
    document.getElementById("demoStopBtn").style.display = "none";
  }

  async function run(isDemo = false) {
    const query = document.getElementById("qInput").value.trim();
    if (!query) return;
    const runBtn = document.getElementById("runBtn");

    if (!isDemo) {
      runBtn.disabled = true; runBtn.textContent = "Streaming…";
      document.getElementById("resultCard").hidden = false;
      document.getElementById("resultHead").innerHTML = `<span class="gate-badge soft">RUNNING…</span> <span style="color: var(--fg-dim); font-size: 12px;">6 步管线逐帧执行中</span>`;
      document.getElementById("pipeline").innerHTML = "";
      document.getElementById("evidenceJson").textContent = "(等待管线完成…)";
    }

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

    if (!isDemo) {
      runBtn.disabled = false; runBtn.textContent = "Run ▶";
    }
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
