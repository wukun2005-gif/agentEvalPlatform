// DemoOverlay — 一键演示的光标 + Tooltip + 进度条

export function createDemoOverlay(container) {
  let isPlaying = false;
  let stopFn = null;

  // 创建 overlay DOM
  const overlay = document.createElement("div");
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

  const tooltip = document.getElementById("demo-tooltip");
  const cursor = document.getElementById("demo-cursor");
  const progressBar = document.getElementById("demo-progress-bar");
  const clickCatcher = document.getElementById("demo-click-catcher");

  function showTooltip(text, x, y) {
    tooltip.textContent = text;
    tooltip.style.display = "block";
    const rect = tooltip.getBoundingClientRect();
    const left = Math.max(10, Math.min(x - rect.width / 2, window.innerWidth - rect.width - 10));
    const top = y > window.innerHeight - 80 ? y - 48 : y + 30;
    tooltip.style.left = left + "px";
    tooltip.style.top = top + "px";
  }

  function moveCursor(x, y) {
    cursor.style.display = "block";
    cursor.style.left = (x - 12) + "px";
    cursor.style.top = (y - 12) + "px";
  }

  function hideCursor() {
    cursor.style.display = "none";
    tooltip.style.display = "none";
  }

  function setProgress(pct) {
    progressBar.style.width = pct + "%";
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

  // 主演示脚本
  const DEMO_SCRIPT = [
    // 0. 开场
    { action: "center", text: "Agent Evaluation Platform — 企业 AI 助手的 agent 质量门控", wait: 3000 },

    // 1. Playground 页面
    { action: "nav", page: "playground" },
    { action: "center", text: "输入 query，agent 会自动执行 6 步管线评估", wait: 2000 },

    // 2. 运行幻觉补全示例
    { action: "click", id: "qInput", text: "选择「张三最近表现」— 一个会触发幻觉补全的 query", wait: 500 },
    { action: "type", id: "qInput", text: "张三最近表现" },
    { action: "click", id: "runBtn", text: "开始执行 6 步管线", wait: 1000 },

    // 3. 等待管线完成
    { action: "center", text: "① 数据拉取 → ② DLP 脱敏 → ③ LLM 生成 → ④ Trust → ⑤ 评估 → ⑥ Gate", wait: 2000 },
    { action: "wait", ms: 6000 },

    // 4. 查看结果
    { action: "center", text: "Gate 决策: BLOCKED — LLM 复述了被 DLP 截断的内容（幻觉补全）", wait: 3000 },

    // 5. Evidence Pack
    { action: "scroll", id: "evPackDetails" },
    { action: "center", text: "Evidence Pack — 合规审计记录，记录了完整的决策过程", wait: 3000 },

    // 6. Dashboard
    { action: "nav", page: "dashboard" },
    { action: "center", text: "Dashboard — 查看所有 agent 的整体健康度和通过率", wait: 3000 },

    // 7. Triage
    { action: "nav", page: "triage" },
    { action: "center", text: "Triage — 失败自动分类，附修复建议，缩短排查时间", wait: 3000 },

    // 8. 结尾
    { action: "center", text: "6 步管线 · 7 维评估 · Evidence Pack · 自动 Triage", wait: 2500 },
    { action: "center", text: "Agent Evaluation Platform — 让每个 agent 的回答都可审计", wait: 2500 },
  ];

  async function runDemo() {
    if (isPlaying) return;
    isPlaying = true;
    clickCatcher.onclick = stopDemo;

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
            await wait(800);
            break;
          case "click":
            await moveAndClick(step.id, step.text, step.wait || 1000);
            break;
          case "type":
            const input = document.getElementById(step.id);
            if (input) {
              input.value = step.text;
              input.dispatchEvent(new Event("input", { bubbles: true }));
            }
            await wait(300);
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
    overlay.style.display = "none";
  }

  function startDemo() {
    overlay.style.display = "block";
    runDemo();
  }

  // ESC 停止
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isPlaying) stopDemo();
  });

  return { startDemo, stopDemo, isPlaying: () => isPlaying };
}
