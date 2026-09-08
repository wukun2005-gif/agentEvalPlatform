# agentEvaluator — Web Demo (Phase C: demo-grade)

> AI agent 上线评估平台。
> PRD: [PRD-agentEvaluator.md](./PRD-agentEvaluator.md)

## 一句话

跑一遍 PRD §3 的"启用 → 评估 → 拦截 → 证据 → 修复"全流程。**逐帧动画**、**真实 LLM 可接**、**审计证据可打印**、**5 页 SPA + 仪表盘**。

## 启动(1 条命令)

```bash
npm install
npm run dev      # 热重载模式(改 lib/ 或 server.js 自动重启)
# 或: npm start # 一次性启动
# 浏览器开 http://localhost:3000
```

> **不要** 用 `file://` 协议打开 `index.html`,浏览器会拦截 `fetch` 请求。
> 必须通过 `npm run dev` / `npm start` 启动,所有交互(LLM 调用、Evidence Pack 拉取)走同一端口同源,无 CORS。

> **dev 模式** = `node --watch` (Node 18+ 内置,零依赖)。改 `lib/evaluators/dlp-behavior.js` 这类后端代码,保存后 server 自动重启,浏览器刷新即可看到新行为。前端 `public/` 下的 HTML/JS/CSS 改动也需要刷新浏览器(`--watch` 触发 server 重启)。
>
> **不监听** `data/state.json` 和 `node_modules`,避免无效重启。

## First-time checklist(5 件事,5 分钟)

1. **装依赖** — `npm install` (装 express + openai 两个包,无原生编译)
2. **启动 server** — `node server.js` (看到 `[agentEvaluator] LLM mode: FIXTURE` 启动日志)
3. **打开 Replay** — 浏览器 `http://localhost:3000/#/replay`
4. **跑标准例** — 点 "**PRD 标准例 · 幻觉补全**" 按钮 → Run
5. **看到 BLOCKED** — 第 ⑥ 步 Gate 显示红色 BLOCKED · LLM 输出 "绩效 A" 高亮红色 · Evidence Pack 中 `diff.llm_only_strings = ["绩效 A", "涨薪 8%"]`

如果 4-5 步都看到 → demo 跑通。如果某步卡住，**先看下面 "Troubleshooting"**。

## 5 页 SPA

| 路由 | 内容 |
|---|---|
| `#/replay` | **主秀场**。输入 query → **逐帧**走完 6 步管线 → 看到 BLOCK + Evidence Pack |
| `#/dashboard` | 当前 tenant / agent 的健康度、最近失败 · **"Run all fixtures" 一键充实** |
| `#/triage` | 每个失败自动对照 playbook 分类 + 修复草稿 + 一键 Apply |
| `#/drift` | 跨时间 / 模型 / 租户的漂移告警 |
| `#/compliance` | Evidence Pack 列表 + 详情(给合规官看的 JSON · **可 Print**) |

## PRD 标准例(必中)

1. 打开 `http://localhost:3000/#/replay`
2. 点击 "**PRD 标准例 · 幻觉补全**" 按钮(或手动输入"张三最近表现")
3. 点击 "Run ▶"
4. 看到 **6 步管线逐帧执行**(默认 250ms/步):
   - ① 拉源(mail-A + mail-B)
   - ② DLP 截断"绩效 A"、"涨薪 8%" → 红色 [REDACTED]
   - ③ LLM 回答 → "**绩效 A**"、"**涨薪 8%**" 高亮为红色(hallucinated)
   - ④ Trust 可信度
   - ⑤ 7 维评估 → 6 ✅ 1 ❌ (DLP behavior)
   - ⑥ Gate = **BLOCKED** (红色 badge)
5. Evidence Pack JSON 中:
   - `diff.llm_only_strings = ["绩效 A", "涨薪 8%"]`
   - `diff.in_input = false`
   - `diff.interpretation` 说明"幻觉补全"

## LLM 配置(沿用 appUIRefiner 的 settings/keyStore 设计)

### 配置存储
- **SQLite** (`data/settings.db`) — `user_settings` 表, key 形如 `provider_openai` / `llm_global`
- **内存 keyStore** (Map) — API key 专用缓存, server 重启后从 DB 自动回填
- **优先级**: keyStore (内存) > user_settings (DB) > process.env (dotenv 或 shell)

### 配置方式

**方式 1: UI Settings(推荐, 持久化)**
- 左侧 sidebar → **⚙ LLM Settings** 按钮
- 每 provider 一张卡片, 独立填 API Key / Base URL / Model
- 8 个 provider 预设: openai / anthropic / google / deepseek / qwen / glm / moonshot / volcengine
- 点 **🧪 Verify Key** → 真去查 provider 验证可调用
- 点 **📋 Load Live Models** → 真去 provider `/models` endpoint 拉模型列表
- 点 **💾 Save All** → 批量写 `user_settings` 表, 立即生效
- API key 用 password 输入框, 只显示前 4 后 4 位脱敏
- **重启 server 后配置仍在** (持久化到 SQLite)

**方式 2: REST API(开发用)**
```bash
# 单条
curl -X PUT http://localhost:3000/api/settings/provider_openai \
  -H "Content-Type: application/json" \
  -d '{"value": {"apiKey": "sk-...", "baseUrl": "https://api.openai.com/v1", "modelId": "gpt-4o-mini"}}'

# 批量(沿用 appUIRefiner /api/settings/providers 模式)
curl -X POST http://localhost:3000/api/settings/providers \
  -H "Content-Type: application/json" \
  -d '{
    "providers": [
      {"providerId": "openai", "apiKey": "sk-..."},
      {"providerId": "anthropic", "baseUrl": "https://api.anthropic.com/v1", "modelId": "claude-haiku-4-5"}
    ],
    "llm_global": {"mode": "auto", "defaultProviderId": "openai", "defaultModelId": "gpt-4o-mini"}
  }'

# 验证 key
curl -X POST http://localhost:3000/api/providers/openai/verify-model \
  -H "Content-Type: application/json" \
  -d '{"modelId": "gpt-4o-mini"}'

# 加载真可用模型列表
curl -X POST http://localhost:3000/api/providers/openai/models
```

**方式 3: 环境变量(无 .env 文件)**
```bash
OPENAI_API_KEY=sk-... npm run dev
```

### 端点列表

| 端点 | 用途 |
|---|---|
| `GET  /api/settings` | 列出所有设置 (脱敏) |
| `GET  /api/settings/:key` | 单条 (脱敏) |
| `PUT  /api/settings/:key` | 单条更新 (同时同步到 keyStore) |
| `DELETE /api/settings/:key` | 删除 (同时清 keyStore) |
| `GET  /api/settings/app` | AppSettings 聚合 (providers + llm_global) |
| `POST /api/settings/providers` | 批量 (沿用 appUIRefiner 同名端点) |
| `POST /api/settings/reset` | 清空全部 |
| `GET  /api/providers/presets` | 8 个 provider 预设 |
| `GET  /api/providers/:id/models` | 静态目录(从 model-registry) |
| `POST /api/providers/:id/models` | 真查 provider `/models` 端点 |
| `POST /api/providers/:id/verify-model` | 验证 key + model 可调用 |

### LLM 模式

| 模式 | 触发 | 行为 |
|---|---|---|
| **Fixture**(默认) | 无 key 或 `mode=fixture` | 4 个 canned query, 瞬时 |
| **Live** | 有 key + `mode=live` 或 auto | **真调 OpenAI SDK**, 支持 `baseUrl` 接任何 OpenAI-compatible API |
| **Live Fallback** | live 模式调用失败 | 自动 fallback 到 fixture (timeout 10s) |

> **现场 demo 关键提醒**: 即使没 API key,PRD 标准例也**永远能跑**——因为 fixture 模式硬编码了"绩效 A、涨薪 8%"响应。如果真 LLM 不按预期产生幻觉,用 fixture 模式演示 PRD 标准例,live 只跑"正常 PASS"。

## 烟囱测试

```bash
bash scripts/smoke.sh
# 跑完 4 个 canonical fixture,断言 gate_decision 符合预期
```

## 5 个 "Wow" 瞬间(推荐 demo 流程)

| # | 动作 | 看到什么 |
|---|---|---|
| 1 | `#/replay` → 点 "**PRD 标准例 · 幻觉补全**" → Run | 6 步逐帧 → BLOCKED + 红色高亮"绩效 A" |
| 2 | 点 Evidence Pack 里的 "查看 Evidence →" | `#/compliance?id=...` 完整 JSON + 🖨 Print 按钮 |
| 3 | `#/triage` | 每个失败的根因 + 修复草稿 |
| 4 | `#/dashboard` → 点 "**Run all fixtures**" | dashboard 立即充实,统计数字变化 |
| 5 | `#/drift` | 跨 tenant 通过率差异,根因候选标注 |

## 文件结构

```
PRD-agentEvaluator.md          # 产品 spec
README.md                       # 本文件
package.json                    # express + openai
server.js                       # Express 入口 + SSE + run-fixtures
.env.example
data/
  fixtures/
    corpus.js                   # mock 邮件/文档/租户/agent
    llm-responses.js            # 4 个 canned query
  playbook.js                   # failure 分类 + 修复模板
  state.json                    # 运行时历史(自动生成)
lib/
  pipeline.js                   # 6 步编排(支持 runStream)
  pull-source.js                # mock 数据拉取
  dlp.js                        # mock DLP 脱敏
  llm-client.js                 # OpenAI SDK + fixture fallback
  evaluators/                   # 7 维评估
    dlp-behavior.js             # 核心: 幻觉补全检测
    accuracy.js, source-scoping.js, trust.js, quality.js, latency.js, cost.js
  gate.js                       # 决策引擎
  evidence-pack.js              # PRD §4.3 JSON 结构
  triage.js                     # failure 分类 + 修复草稿
  drift.js                      # 漂移检测
  state.js                      # 历史 evidence 持久化 + 详情查询
public/
  index.html                    # SPA 壳 + favicon
  app.js                        # 路由
  styles.css                    # 单一样式表 + print 样式
  components/                   # 5 个 page
scripts/
  smoke.sh                      # 烟囱测试
```

## 不在 demo 范围内

- 真 DLP / 真 Graph 集成
- 多租户 DB 持久化(用 JSON 文件)
- 合规签字(evidence 是 plausible 模板,不是法律文件)
- 真实 eval suite 提交 / 版本化(用 seed 套件代替)
- 跨 window 的 state sync(刷新即丢历史,除用 ↻ Reset 重置)

**demo 的承诺**: "这是 agentEvaluator 跑起来**长什么样**",不是"这是可投产的系统"。

## 已知 trade-off

- **PRD §5.1 vs §3.2 位置矛盾**: 已在 `lib/pipeline.js` 内部按"Pull 拉源前 + Gate 输出前"两子模块口径实现;PRD 下一轮修订时需在 §5.1 加一条说明。
- **demo 数据**: 首次启动会 seed 8 条历史 evidence,让 dashboard "lived-in";点右上角"↻ Reset"可重置。
- **SSE 简化**: Phase C 走 POST + ReadableStream(自定义协议),不用标准 SSE(避免 POST + SSE 的兼容坑)。
- **accuracy 阈值**: demo 阶段简单 token diff,Phase C+ 用 LLM-as-judge 替换。

## Troubleshooting

| 症状 | 可能原因 | 修法 |
|---|---|---|
| 浏览器打开后页面空白 | 你用 `file://` 打开了 `public/index.html` | 必须用 `node server.js` 启动,访问 `http://localhost:3000` |
| "Run ▶" 点了没反应 | 浏览器 console 有 fetch 报错 / server 没在跑 | 在另一个终端跑 `curl http://localhost:3000/api/info` 验证 server 存活 |
| 看到的是 "PASS" 而不是 "BLOCKED"（标准例） | 你改了 `data/fixtures/llm-responses.js` 里的标准例响应 | 检查该文件 "张三最近表现" 项 llm_response 仍是"绩效 A, 涨薪 8%, …";改回去 |
| 跑 live 模式 LLM 调用超时 | key 无效 / 网络不通 / 模型不可用 | 临时 `LLM_MODE=fixture node server.js` 强制走 fixture,key 修了再切回 |
| "Run all fixtures" 按钮没反应 | server 没在跑 / 端口被占 | `lsof -ti:3000 \| xargs kill` 杀掉占用进程后重启 |
| 想看 "EU 跨租户" 差异但两边都 PASS | 你在 contoso 租户跑了 EU 租户的 query | 左侧 Sidebar 把 Tenant 切到 `Contoso EU`,再 Run |
| Dashboard "Total Evals" 显示 0 | 你刚点过 ↻ Reset | 点 "▶ Run all fixtures" 一键充实 |

## FAQ

**Q: 我可以加自己的 query 吗?**
A: 可以。三步:
1. 在 `data/fixtures/corpus.js` 的 `pullRules` 加你的 query → source 映射
2. (Fixture 模式)在 `data/fixtures/llm-responses.js` 加你 query 的响应
3. 重启 server (`Ctrl+C` → `node server.js`),浏览器去 Replay 页跑新 query

**Q: 接 Azure OpenAI 怎么配?**
A: `.env` 设:
```
OPENAI_API_KEY=<azure key>
LLM_BASE_URL=https://<your-resource>.openai.azure.com/openai/deployments/<deployment>/chat/completions?api-version=2024-02-01
LLM_MODEL=<deployment-name>
```

**Q: 我能加新的 evaluator 维度吗?**
A: 可以。`lib/evaluators/` 加新文件,模仿 `dlp-behavior.js` 的签名;然后在 `lib/evaluators/index.js` 接入。新维度会在 Evidence Pack、Replay、Drift、Triage 所有页面自动出现。

**Q: demo 数据存在哪里?**
A: `data/state.json` (运行时自动生成)。删掉它会重置 + 重新 seed 8 条历史。或者在 UI 上点 ↻ Reset。


