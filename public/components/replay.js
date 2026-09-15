// Playground page — 单 query 完整管线

import { startDemo } from "./demo-overlay.js";
import { t, apiFetch, exampleQueries, hallucinationSpans } from "../i18n.js";

export async function renderReplay({ mount, getTenantId, getAgentId }) {
  const queries = exampleQueries();
  mount.innerHTML = `
    <div class="page">
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 4px;">
        <h1 style="margin: 0;">${t('playgroundTitle')}</h1>
        <button id="demoBtn" class="primary" style="font-size: 12px; padding: 4px 12px;">${t('playgroundDemoBtn')}</button>
      </div>
      <p class="page-sub">${t('playgroundSubtitle')}</p>

      <div class="card">
        <div class="query-row">
          <input id="qInput" type="text" placeholder="${t('queryPlaceholder')}" />
          <button id="runBtn" class="primary">${t('runBtn')}</button>
        </div>

        <div class="example-pills">
          <span style="color: var(--fg-dim); font-size: 12px; align-self: center;">${t('exampleLabel')}</span>
          <button data-q="${queries[0]}">${t('exampleHallucination')}</button>
          <button data-q="${queries[1]}">${t('exampleNormalPass')}</button>
          <button data-q="${queries[2]}">${t('exampleCrossTenant')}</button>
          <button data-q="${queries[3]}">${t('exampleSourceScoping')}</button>
          <button data-q="${queries[4]}">${t('exampleLatency')}</button>
          <button data-q="${queries[5]}">${t('exampleCost')}</button>
        </div>
        <p style="color: var(--fg-dim); font-size: 11px; margin-top: 8px;">
          ${t('exampleTip')}
        </p>

      </div>

      <div class="card" id="resultCard" hidden>
        <div id="resultHead" style="margin-bottom: 12px;"></div>
        <ol class="pipeline" id="pipeline"></ol>
        <details id="evPackDetails" open>
          <summary>${t('evPackJsonAudit')}</summary>
          <pre id="evidenceJson"></pre>
        </details>
      </div>
    </div>
  `;

  // 绑定 demo 按钮事件
  document.getElementById("demoBtn").addEventListener("click", startDemo);

  document.getElementById("qInput").addEventListener("keydown", (e) => { if (e.key === "Enter") run(); });
  document.getElementById("runBtn").addEventListener("click", run);
  document.querySelectorAll(".example-pills button").forEach((b) => {
    b.addEventListener("click", () => { document.getElementById("qInput").value = b.dataset.q; });
  });

  // 委托: 展开/收起 LLM 输出 + context
  document.getElementById("resultCard").addEventListener("click", (e) => {
    const a = e.target.closest(".demo-llm-more");
    if (!a) return;
    const wrap = a.parentElement;
    const tail = wrap.querySelector(".demo-llm-tail");
    if (!tail) return;
    // 首次点击时记录"展开"文案,方便收起后还原
    if (!a.dataset.expandLabel) a.dataset.expandLabel = a.textContent;
    const willExpand = tail.hidden;
    tail.hidden = !willExpand;
    a.textContent = willExpand ? t('collapse') : a.dataset.expandLabel;
  });

  async function run() {
    const query = document.getElementById("qInput").value.trim();
    if (!query) return;
    const runBtn = document.getElementById("runBtn");

    runBtn.disabled = true; runBtn.textContent = t('streaming');
    const card = document.getElementById("resultCard");
    card.hidden = false;
    document.getElementById("resultHead").innerHTML = `<span class="gate-badge soft">${t('running')}</span> <span style="color: var(--fg-dim); font-size: 12px;">${t('runningMeta')}</span>`;
    const ol = document.getElementById("pipeline");
    ol.innerHTML = "";
    document.getElementById("evidenceJson").textContent = t('waitingPipeline');

    const res = await apiFetch("/api/run-stream", {
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
          alert(t('pipelineError') + payload.error);
        }
      }
    }

    runBtn.disabled = false; runBtn.textContent = t('runBtn');
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
    const meta = `${t('wallMs')} ${done.wall_ms}ms · ${done.evaluations.length} ${t('evalsCount')} · ${t('model')}=${done.model || "?"} · ${t('failed')}: ${gate.failed_dimensions.join(", ") || t('none')}`;
    document.getElementById("resultHead").innerHTML = `${badge} <span style="color: var(--fg-dim); font-size: 12px; margin-left: 12px;">${meta}</span>`;
    appendStep(steps);
    document.getElementById("evidenceJson").textContent = JSON.stringify(done.evidence, null, 2);
  }

  function renderStepDetail(step) {
    switch (step.name) {
      case "pull": {
        const ids = step.data.actual.map((s) => s.id);
        return `${t('pulledSources')} ${ids.length} ${t('sources')}: ${ids.join(", ") || `(${t('none')})`}`;
      }
      case "dlp": {
        const log = step.data.ruleLog || [];
        const original = step.data.original || [];
        const redacted = step.data.redacted || [];
        const llmInput = step.data.llmInput || "";
        
        let html = `<b>${t('hitRules')} ${log.length} ${t('rulesUnit')}</b>`;
        
        if (log.length > 0) {
          html += `<div style="margin-top: 8px;">`;
          log.forEach(r => {
            html += `<div style="font-size: 11px; color: var(--fg-dim); margin: 4px 0;">
              <span class="redacted">${r.span || r.before}</span> → <span style="color: var(--success);">${t('redactedLabel')}</span>
              <span style="color: var(--fg-dim);">(${r.rule})</span>
            </div>`;
          });
          html += `</div>`;
        }
        
        // 显示原始 vs 截断对比
        if (original.length > 0) {
          html += `<details style="margin-top: 8px;"><summary style="cursor: pointer; color: var(--fg-dim); font-size: 12px;">${t('viewOriginalVsRedacted')}</summary>`;
          original.forEach((src, i) => {
            const origText = src.content || "";
            const redText = redacted[i]?.content || origText;
            html += `<div style="margin-top: 8px; padding: 8px; background: var(--panel); border-radius: 4px; font-size: 11px;">
              <div><b>${t('sources')}:</b> ${src.id}</div>
              <div style="margin-top: 4px;"><b>${t('original')}:</b> <span style="color: var(--fg-dim);">${origText.slice(0, 200)}${origText.length > 200 ? '...' : ''}</span></div>
              <div style="margin-top: 4px;"><b>${t('redacted')}:</b> ${redText.replace(/\[REDACTED\]/g, '<span class="redacted">[REDACTED]</span>').slice(0, 200)}${redText.length > 200 ? '...' : ''}</div>
            </div>`;
          });
          html += `</details>`;
        }
        
        return html;
      }
      case "llm": {
        const out = step.data.content || "";
        const llmInput = step.data.llmInput || "";
        const latencyMs = step.data.latency_ms;
        // 截断:太长的响应(故意失败 fixture / 真实长文)默认折叠,避免撑爆页面
        const COLLAPSE_AT = 280;
        const needsCollapse = out.length > COLLAPSE_AT;
        // 高亮"幻觉补全"特征串(只对截断后的片段生效,不影响性能)
        // 特征串随语言切换:中文高亮 "绩效 A",英文高亮 "Performance A"
        const highlight = (s) => hallucinationSpans().reduce(
          (acc, span) => acc.split(span).join(`<span class="hallucinated">${span}</span>`),
          s
        );
        const head = highlight(escapeHtml(out.slice(0, COLLAPSE_AT)));
        const tail = highlight(escapeHtml(out.slice(COLLAPSE_AT)));
        let html = `<b>${t('sources')}:</b> ${escapeHtml(step.data.source || "?")} · <b>${t('model')}:</b> ${escapeHtml(step.data.model || "?")} · <b>${latencyMs ?? "?"}ms</b>`;
        if (latencyMs >= 5000) {
          html += ` <span class="hallucinated" title="P95 target &lt; 5000ms">${t('timeout')}</span>`;
        }

        // 显示 LLM 输入 context
        if (llmInput) {
          html += `\n<details style="margin-top: 6px;"><summary style="cursor: pointer; color: var(--fg-dim); font-size: 11px;">${t('llmInput')} (${llmInput.length} ${t('chars')})</summary>`;
          const inputHead = escapeHtml(llmInput.slice(0, 800));
          const inputTail = escapeHtml(llmInput.slice(800));
          html += `<div style="margin-top: 4px; padding: 8px; background: var(--panel); border: 1px solid var(--border); border-radius: 4px; font-size: 11px; white-space: pre-wrap; max-height: 240px; overflow: auto;">${inputHead}${inputTail ? `<span class="demo-llm-tail" hidden>${inputTail}</span><a class="demo-llm-more" style="color: var(--accent); cursor: pointer;">${t('expand')} (${llmInput.length - 800} ${t('chars')})</a>` : ""}</div>`;
          html += `</details>`;
        }

        // 输出区:默认折叠 + 总有 max-height 兜底,即使展开也不会撑爆页面
        const totalLen = out.length;
        html += `\n<div class="llm-output" style="margin-top: 6px; padding: 8px; background: var(--panel); border: 1px solid var(--border); border-radius: 4px; font-size: 12px; line-height: 1.6; max-height: 240px; overflow: auto;">`;
        html += head;
        if (needsCollapse) {
          html += `<span class="demo-llm-tail" hidden>${tail}</span><a class="demo-llm-more" style="color: var(--accent); cursor: pointer;">${t('expand')} (${totalLen - COLLAPSE_AT} ${t('chars')})</a>`;
        }
        html += `</div>`;
        return html;
      }
      case "trust": return step.data.source;
      case "evaluate":
        return step.data.map((e) => `${e.passed ? "✅" : "❌"} <b>${e.name}</b>: ${e.reason}`).join("\n");
      case "gate":
        return `<b>${step.data.decision}</b> · ${t('policy')}=${step.data.policy} · ${t('failedDimensions')}=${step.data.failed_dimensions.join(", ") || t('none')}`;
      default: return JSON.stringify(step.data).slice(0, 200);
    }
  }
  
  function escapeHtml(s) { return s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c])); }
}
