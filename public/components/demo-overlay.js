// DemoOverlay — 一键演示的光标 + Tooltip + 进度条

let isPlaying = false;

function showTooltip(text, x, y) {
  const tooltip = document.getElementById("demo-tooltip");
  if (!tooltip) return;
  tooltip.textContent = text;
  tooltip.style.display = "block";
  const rect = tooltip.getBoundingClientRect();
  const left = Math.max(10, Math.min(x - rect.width / 2, window.innerWidth - rect.width - 10));
  const top = y > window.innerHeight - 80 ? y - 48 : y + 30;
  tooltip.style.left = left + "px";
  tooltip.style.top = top + "px";
}

function moveCursor(x, y) {
  const cursor = document.getElementById("demo-cursor");
  if (!cursor) return;
  cursor.style.display = "block";
  cursor.style.left = (x - 12) + "px";
  cursor.style.top = (y - 12) + "px";
}

function hideCursor() {
  const cursor = document.getElementById("demo-cursor");
  const tooltip = document.getElementById("demo-tooltip");
  if (cursor) cursor.style.display = "none";
  if (tooltip) tooltip.style.display = "none";
}

function setProgress(pct) {
  const bar = document.getElementById("demo-progress-bar");
  if (bar) bar.style.width = pct + "%";
}

function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function checkCancelled() {
  if (!isPlaying) throw new Error("__CANCELLED__");
}

async function moveTo(x, y, text, waitMs = 1500) {
  checkCancelled();
  moveCursor(x, y);
  showTooltip(text, x, y);
  await wait(waitMs);
}

async function moveToCenter(text, waitMs = 2000) {
  checkCancelled();
  const x = window.innerWidth / 2;
  const y = window.innerHeight / 2;
  moveCursor(x, y);
  showTooltip(text, x, y);
  await wait(waitMs);
}

async function moveAndClick(elementId, text, waitAfter = 1500) {
  checkCancelled();
  const el = document.getElementById(elementId);
  if (!el) return false;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  await wait(500);
  const rect = el.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  moveCursor(x, y);
  showTooltip(text, x, y);
  await wait(500);
  el.click();
  await wait(waitAfter);
  return true;
}

// 切换 select 值
async function selectOption(elementId, value, text, waitAfter = 500) {
  checkCancelled();
  const el = document.getElementById(elementId);
  if (!el) return;
  el.value = value;
  el.dispatchEvent(new Event("change", { bubbles: true }));
  const rect = el.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  moveCursor(x, y);
  showTooltip(text, x, y);
  await wait(waitAfter);
}

// 运行 query 并等待完成
async function runQuery(query, waitMs = 10000) {
  checkCancelled();
  const input = document.getElementById("qInput");
  const runBtn = document.getElementById("runBtn");
  if (!input || !runBtn) return;
  
  // 移动光标到 input
  input.scrollIntoView({ behavior: "smooth", block: "center" });
  await wait(300);
  const inputRect = input.getBoundingClientRect();
  moveCursor(inputRect.left + inputRect.width / 2, inputRect.top + inputRect.height / 2);
  showTooltip("输入: " + query, inputRect.left + inputRect.width / 2, inputRect.top);
  await wait(1000);
  
  // 设置值并点击
  input.value = query;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await wait(500);
  
  // 移动光标到 Run 按钮
  const btnRect = runBtn.getBoundingClientRect();
  moveCursor(btnRect.left + btnRect.width / 2, btnRect.top + btnRect.height / 2);
  showTooltip("点击 Run 执行管线", btnRect.left + btnRect.width / 2, btnRect.top);
  await wait(500);
  runBtn.click();
  
  // 等待管线执行
  await wait(waitMs);
}

// 主演示脚本
const DEMO_SCRIPT = [
  // ═══════════════════════════════════════════════
  //  第一部分：Playground 演示（约 90 秒）
  // ═══════════════════════════════════════════════
  
  // 0. 开场
  { action: "center", text: "Agent Evaluation Platform — 企业 AI 助手的 agent 质量门控", wait: 3000 },

  // 1. 进入 Playground
  { action: "nav", page: "playground" },
  { action: "wait", ms: 1500 },
  { action: "center", text: "输入 query，agent 会自动执行 6 步管线评估", wait: 2000 },

  // ── 示例 1：幻觉补全 ─────────────────────────
  { action: "center", text: "示例 1/6: 幻觉补全 — LLM 复述被 DLP 截断的内容", wait: 2000 },
  { action: "runQuery", query: "张三最近表现", wait: 10000 },
  { action: "center", text: "Gate: BLOCKED — LLM 输出了被 DLP 截断的「绩效 A」「涨薪 8%」", wait: 3500 },

  // ── 示例 2：正常 PASS ─────────────────────────
  { action: "center", text: "示例 2/6: 正常 PASS — 所有评估通过", wait: 2000 },
  { action: "runQuery", query: "上周我们组完成了哪些项目", wait: 10000 },
  { action: "center", text: "Gate: PASS — 输出与输入一致，无违规", wait: 3500 },

  // ── 示例 3：跨租户越权 ─────────────────────────
  { action: "center", text: "示例 3/6: 跨租户越权 — 切换到 EU 租户", wait: 2000 },
  { action: "selectOption", id: "tenantId", value: "contoso-eu", text: "切换 Tenant → Contoso EU", wait: 1500 },
  { action: "runQuery", query: "EU 合规审计近况", wait: 10000 },
  { action: "center", text: "Gate: BLOCKED — EU 租户的 PII 数据被不当访问", wait: 3500 },

  // ── 示例 4：Source Scoping ─────────────────────
  { action: "center", text: "示例 4/6: Source Scoping — 1P Agent 权限越权", wait: 2000 },
  { action: "selectOption", id: "tenantId", value: "contoso", text: "切换回 Tenant → Contoso", wait: 1000 },
  { action: "selectOption", id: "agentId", value: "my-sales-summarizer-v3", text: "确认 Agent: Sales Summarizer (1P)", wait: 1000 },
  { action: "runQuery", query: "员工绩效列表", wait: 10000 },
  { action: "center", text: "Gate: BLOCKED — 1P Agent 的 allowedSources 不含 people 类型", wait: 3500 },

  // ── 示例 5：Latency 超时 ──────────────────────
  { action: "center", text: "示例 5/6: Latency 超时", wait: 2000 },
  { action: "runQuery", query: "test-latency-fail", wait: 10000 },
  { action: "center", text: "Gate: BLOCKED — 响应时间超过阈值", wait: 3500 },

  // ── 示例 6：Cost 超预算 ───────────────────────
  { action: "center", text: "示例 6/6: Cost 超预算", wait: 2000 },
  { action: "runQuery", query: "写一篇长文", wait: 10000 },
  { action: "center", text: "Gate: BLOCKED — Token 消耗超过预算", wait: 3500 },

  // ═══════════════════════════════════════════════
  //  第二部分：Evidence Pack（约 15 秒）
  // ═══════════════════════════════════════════════
  
  { action: "center", text: "每个评估都生成 Evidence Pack — 合规审计记录", wait: 2500 },
  { action: "scroll", id: "evPackDetails" },
  { action: "wait", ms: 1000 },
  { action: "center", text: "记录了完整的决策过程：拉源 → DLP → LLM → Trust → 评估 → Gate", wait: 3500 },

  // ═══════════════════════════════════════════════
  //  第三部分：Dashboard（约 15 秒）
  // ═══════════════════════════════════════════════
  
  { action: "nav", page: "dashboard" },
  { action: "wait", ms: 1500 },
  { action: "center", text: "Dashboard — 查看所有 agent 的整体健康度", wait: 2500 },
  { action: "center", text: "通过率、失败分布、最近失败一目了然", wait: 3500 },

  // ═══════════════════════════════════════════════
  //  第四部分：Triage（约 15 秒）
  // ═══════════════════════════════════════════════
  
  { action: "nav", page: "triage" },
  { action: "wait", ms: 1500 },
  { action: "center", text: "Triage — 失败自动分类，附修复建议", wait: 2500 },
  { action: "center", text: "从「翻 trace 找根因」降到「审草稿决定采纳」", wait: 3500 },

  // ═══════════════════════════════════════════════
  //  结尾（约 5 秒）
  // ═══════════════════════════════════════════════
  
  { action: "center", text: "6 步管线 · 7 维评估 · Evidence Pack · 自动 Triage", wait: 2500 },
  { action: "center", text: "Agent Evaluation Platform — 让每个 agent 的回答都可审计", wait: 2500 },
];

async function runDemo() {
  if (isPlaying) return;
  isPlaying = true;

  const clickCatcher = document.getElementById("demo-click-catcher");
  if (clickCatcher) clickCatcher.onclick = stopDemo;

  const totalPages = DEMO_SCRIPT.length;
  let currentPage = 0;

  try {
    for (const step of DEMO_SCRIPT) {
      if (!isPlaying) break;
      currentPage++;
      setProgress((currentPage / totalPages) * 100);

      switch (step.action) {
        case "center":
          await moveToCenter(step.text, step.wait || 2000);
          break;
        case "nav":
          window.location.hash = "#" + step.page;
          await wait(1000);
          break;
        case "click":
          await moveAndClick(step.id, step.text, step.wait || 1000);
          break;
        case "selectOption":
          await selectOption(step.id, step.value, step.text, step.wait || 500);
          break;
        case "runQuery":
          await runQuery(step.query, step.wait || 8000);
          break;
        case "wait":
          await wait(step.ms);
          break;
        case "scroll":
          const el = document.getElementById(step.id);
          if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
          await wait(1000);
          break;
      }
    }
  } catch (err) {
    if (err.message !== "__CANCELLED__") console.error("Demo error:", err);
  }

  stopDemo();
}

function stopDemo() {
  isPlaying = false;
  hideCursor();
  setProgress(0);
  const overlay = document.getElementById("demo-overlay");
  if (overlay) overlay.style.display = "none";
}

function startDemo() {
  // 确保 overlay 存在
  let overlay = document.getElementById("demo-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "demo-overlay";
    overlay.innerHTML = `
      <div id="demo-click-catcher" style="position:fixed;inset:0;z-index:9997;"></div>
      <div id="demo-progress" style="position:fixed;top:0;left:0;width:100%;height:3px;background:rgba(0,0,0,0.1);z-index:9998;">
        <div id="demo-progress-bar" style="height:100%;width:0;background:linear-gradient(90deg,#3b82f6,#6366f1);transition:width 0.3s;"></div>
      </div>
      <div id="demo-tooltip" style="position:fixed;z-index:9999;background:linear-gradient(135deg,rgba(59,130,246,0.95),rgba(99,102,241,0.95));color:#fff;padding:8px 12px;border-radius:8px;font-size:12px;max-width:400px;text-align:center;pointer-events:none;box-shadow:0 4px 20px rgba(59,130,246,0.3);display:none;"></div>
      <div id="demo-cursor" style="position:fixed;z-index:9999;pointer-events:none;transition:all 0.5s cubic-bezier(0.16,1,0.3,1);display:none;">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M4 2L20 10.6667L12 13L10 21L4 2Z" fill="white" stroke="black" stroke-width="1.5" stroke-linejoin="round"/>
        </svg>
      </div>
    `;
    document.body.appendChild(overlay);
  }
  overlay.style.display = "block";
  runDemo();
}

// ESC 停止
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && isPlaying) stopDemo();
});

export { startDemo, stopDemo };
