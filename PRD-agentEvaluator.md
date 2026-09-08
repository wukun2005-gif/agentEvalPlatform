# PRD: agentEvaluator

| 项 | 值 |
|---|---|
| **Feature 名** | agentEvaluator（代号：代号 Sentinel） |
| **所属产品** | 企业 AI 助手平台 / 对话入口 |
| **层级** | Platform Feature（在 AI 助手 内部启用），非独立产品 |
| **Owner 团队** | AI 助手平台核心团队 · AI 助手扩展能力团队 |
| **目标读者** | 已在 企业 AI 助手 上构建 agent 的开发团队（1P + 3P，能力对等） |
| **状态** | Draft v0.1 |
| **核心问题** | "我已经有一个 agent 跑在 AI 助手/对话入口 里了——打开这个 feature 后，我能多获得什么？" |

---

## 1. 摘要（Executive Summary）

agentEvaluator 是 企业 AI 助手 AI 助手 **内核中可被启用**的一个 feature。任何跑在 AI 助手/对话入口 内的 agent——无论是 第一方产品团队（AI 助手、Loop、Planner）还是第三方开发者通过 Agent SDK / Agent 编排平台 / 模型平台 提交的 agent——**在启用本 feature 后**：

1. **获得一个"持续生产门控"**：agent 每次回答用户前，会被自动评估；不通过则不出结果、不会触达用户。
2. **获得一份"合规证据包"**：每次回答都附带可被合规官签字认可的审计记录。
3. **获得跨模型、跨租户、跨时间的 drift 检测**：在客户报告问题之前告警。

> **本文不假设读者熟悉 agentEvaluator**。我们用一个朴素的视角看：你已经写了一个 agent、在 企业 AI 助手 AI 助手 生态里上线了——为什么你需要这一层？

---

## 2. 读者画像与"如果不启用这个 feature 会怎样"

### 2.1 目标读者：三类 agent 开发者

| 读者 | 现状 | 已经用什么 |
|---|---|---|
| **第三方 agent 开发者**（3P） | 用 Agent SDK / Agent 编排平台 写了 agent，准备上线 Marketplace | LangSmith / Braintrust 做 dev-time trace；自写 prompt eval |
| **第一方产品团队**（1P） | 在 AI 助手 / Loop / Planner 里嵌入了 agent 行为 | 内部 CI eval；偶尔手工评审 |
| **企业 IT 管理员** | 管一个 tenant 内所有 agent 的上线 | 暂无统一审计面 |

### 2.2 启用前的真实痛点（按发生频率排序）

| # | 痛点 | 谁能感知到 | 频次 |
|---|---|---|---|
| P1 | agent 复述了被 DLP 截掉的内容（幻觉补全） | 合规 / 法务 / 被泄漏本人 | 高 |
| P2 | agent 跨源拼出"DLP 单条规则拦不住"的敏感结论 | 合规 / 法务 | 高 |
| P3 | 底层 LLM 升级后，agent 行为漂移、性能/质量下降 | 用户 / 开发者 | 中（每次模型升级） |
| P4 | 上线后才被客户报告"为什么这个 agent 给张三看了李四的工资" | 开发者 | 中 |
| P5 | 合规官要求"出示 agent 决策证据"，但你只有 LangSmith trace | 开发者面对合规 | 高 |
| P6 | 跨租户行为不一致：在租户 A 通过的 eval 套件，在租户 B 失败（DLP 配置不同） | 开发者 | 中 |
| P7 | drift 监控靠人工盯 trace，漏判率高 | 开发者 | 高 |

### 2.3 现有方案为什么不够

| 现有方案 | 能力上限 | 结构性盲区 |
|---|---|---|
| LangSmith / Braintrust | 拿到 `<input, output>` 二元组 | 看不到中间：DLP 截了什么、源权限实际是什么、trust score 怎么算的 |
| Azure AI Evaluation | 离线模型质量评估 | 不接入生产流量、不接入 tenant 内合规层 |
| 自写 CI eval | 灵活 | 不接入 DLP / Graph permission / Trust 层，验不了泄漏 |
| 手工 review | 灵活 | 不可持续、漏判率高 |

> **关键盲区**：所有外部方案都**只看到 agent 的"答卷"**，看不到 agent 是**怎么答的、规则怎么被遵守的**。答卷 = 输入+输出；过程 = 拉源计划 + DLP 实际效果 + 权限校验 + trust 计算。

---

## 3. Feature 范围与"启用后能多获得什么"

### 3.1 一句话价值主张

> **让你的 agent 从"凭良心答卷"升级为"被全过程审计的合规交付"——而且审计本身由 AI 助手 内核代你跑，你只在不可逆决策点签字。**

### 3.2 五大增益（按对开发者的价值密度排序）

#### 增益 1：持续生产门控（Continuous Production Gate）

| 维度 | 内容 |
|---|---|
| 你多获得的 | 每次 agent 给出回答前，自动跑一次多维评估。不通过则用户看不到结果。 |
| 评估维度 | quality / accuracy / latency / cost / **trust** / **DLP behavior** / **source scoping** |
| 触发位置 | 在 AI 助手 的 `agentEvaluator → LLM → Trust layer` 流水线里、输出前的最后一步 |
| 决策延迟 | P95 增量 < 200ms（评估在 tenant 内、与回答并行预跑） |
| 你的工作量 | 写一次 eval suite；之后全是自动 |

**对比现状**：你今天要么相信 prompt 写得"够好"，要么事后 review trace；feature 启用后，**坏的输出根本不会到用户面前**。

#### 增益 2：合规证据包（Evidence Pack）

| 维度 | 内容 |
|---|---|
| 你多获得的 | 每次回答都自动附一份"合规证据 JSON" |
| 证据内容 | `原始 query` / `agentEvaluator 拉源计划` / `DLP 实际截断结果` / `LLM 实际看到的 context` / `LLM 输出` / `Trust score + 引用回链` / `Gate 决策` |
| 形态 | API 可拉、可推送 SIEM、可按用户/agent/时间聚合 |
| 你的工作量 | 0；合规直接看 |

**对比现状**：今天要回答合规"你那个 agent 为什么这么答"，你只能翻 LangSmith trace 截图——合规**不认**。feature 启用后，合规看的是**结构化、可签字的审计记录**。

**为什么合规认这份而不认 LangSmith**：

```
LangSmith 报告:                       agentEvaluator Evidence Pack:
                                      
  query: "张三最近表现"                 query: "张三最近表现"
  output: "绩效 A, 涨薪 8%"             pulled_sources: [邮件 A, 邮件 B]
                                        dlp_decision:
  ❌ 合规: 这俩字符串是 LLM              - 邮件 A: REDACTED (HR-薪资规则)
  抄的还是幻觉的?                       - 邮件 B: PASS
  LangSmith 怎么知道?                    llm_input_context: "邮件 A: 绩效 [REDACTED]..."
                                        llm_output: "绩效 A, 涨薪 8%"
                                        diff: "绩效 A" 不在 llm_input 里
                                               → 幻觉补全 → DLP enforcement 失败
                                        gate_decision: BLOCKED
                                        
  ✅ 合规: 这才叫证据
```

#### 增益 3：Drift Detection（生产漂移检测）

| 维度 | 内容 |
|---|---|
| 你多获得的 | 跨时间、跨模型、跨租户的行为漂移自动告警 |
| 检测对象 | 同一个 eval suite 在以下维度的失败率变化：(1) 时间窗 vs 历史基线；(2) 底层 LLM 切换前后；(3) 不同租户的 DLP 配置差异 |
| 告警形式 | Agent Dashboard + Email + Webhook |
| 你的工作量 | 0；告警时附根因候选（"租户 B 失败率上升主要因 DLP-X 规则启用"） |

**对比现状**：今天发现 drift 靠"客户投诉"——你 80% 的事故是用户先报。feature 启用后，**drift 被平台先于客户发现**。

#### 增益 4：失败分类 + 修复草稿（Failure Triage Agent）

| 维度 | 内容 |
|---|---|
| 你多获得的 | 每次 eval 失败，自动对照"response playbook"分类 + 生成修复草稿 |
| Playbook 内容 | DLP 误用、源权限过宽、prompt 漏洞、模型退化、引用缺失等分类 + 对应修复建议 |
| 修复草稿 | 形式：`(失败原因, 候选根因, 建议 prompt diff, 建议配置变更)`，可一键应用 |
| 你的工作量 | 从"翻 trace 找根因"降到"审草稿决定采纳" |

**对比现状**：今天一次失败排查 2-7 天。feature 启用后，**P50 修复时间 < 24h**。

#### 增益 5：人类责任点设计（Human-in-the-Loop by Design）

| 维度 | 内容 |
|---|---|
| 你多获得的 | 95% 的协调 toil 由平台自动跑；5% 不可逆决策点显式留给人 |
| 强制人类决策的 4 类动作 | (1) Gate sign-off；(2) 接受已知失败上线；(3) Tenant admin consent；(4) 任何对外不可逆动作 |
| 可审计性 | 每个决策带人名 + 时间 + 理由 + evidence 引用 |
| 你的工作量 | 仅在 4 类决策点介入；其余 0 |

**对比现状**：今天你的责任边界是模糊的——出了事谁负责说不清。feature 启用后，**责任边界被系统显式划清**。

---

## 4. 用户体验：从开发者视角的"开关 + 看板"

### 4.1 启用方式（一行）

> **不写新代码。** 在 企业 AI 助手 Admin Center 或 Agent 编排平台 里开一个 tenant-level / agent-level 开关，开关打开后**所有已经上线的 agent 立刻获得 feature 能力**。

```
Tenant Admin Console
  └─ AI 助手 → Evaluation Platform
      ├─ [✓] Enable for all 1P agents
      ├─ [✓] Enable for all 3P agents
      ├─ [ ] Allow agents to opt-out per-agent
      └─ Gate policy:
          ├─ Mode: [Block on fail | Log only | Custom]
          └─ Notify on drift: [Slack | Email | Teams | Webhook]
```

**对开发者侧**：零代码改动——你的 agent 调用 AI 助手/对话入口 的方式不变；feature 在内核中"夹一层"。

### 4.2 看板（Agent Dashboard）

```
┌─────────────────── Agent Dashboard ──────────────────┐
│  Agent: my-sales-summarizer-v3                       │
│  Status: ✅ HEALTHY  |  Last eval: 2 min ago         │
│                                                      │
│  Eval Suite Coverage: 412 cases / 412 scoped         │
│  Pass Rate (24h):  98.7%   (↑0.3% vs 7d baseline)   │
│  Drift Alerts:     0 active                          │
│  Evidence:         1,247 records, last 7d            │
│                                                      │
│  Recent Failures:                                     │
│   • DLP enforcement (#142)  12 min ago  → triaged   │
│   • Latency P95 (#88)        2h ago      → triaged   │
│   • Source scoping (#201)    yesterday   → triaged   │
│                                                      │
│  Suggested Fixes (auto-drafted):                     │
│   • Apply prompt patch #142-rev3 [Review & Apply]   │
│   • Add eval case for tenant X edge case  [Accept]   │
└──────────────────────────────────────────────────────┘
```

### 4.3 Evidence Pack 样例（一次具体回答的合规证据）

```json
{
  "evidence_id": "ev-2026-09-07-001247",
  "agent_id": "my-sales-summarizer-v3",
  "tenant_id": "contoso",
  "timestamp": "2026-09-07T10:23:41Z",
  "query": "张三最近表现",
  "pulled_sources": [
    {"id": "mail-A", "type": "email", "decision": "REDACTED", "rule": "HR-薪资-2024"},
    {"id": "mail-B", "type": "email", "decision": "PASS"}
  ],
  "llm_input_context": "邮件 A: 张三 2024 绩效 [REDACTED], 涨薪 [REDACTED]\n邮件 B: 张三 2023 客户开拓, 完成率 110%",
  "llm_output": "张三 2024 绩效 A, 涨薪 8%, 2023 客户开拓...",
  "diff": {
    "llm_only_strings": ["绩效 A", "涨薪 8%"],
    "in_input": false,
    "interpretation": "幻觉补全 — LLM 未在 context 看到, 自行生成"
  },
  "trust_score": 0.62,
  "gate_decision": "BLOCKED",
  "gate_evaluator": "agent-evaluator-platform",
  "audit": {
    "evaluator": "ai-loop-v2.3",
    "human_review_required": false,
    "evidence_complete": true
  }
}
```

---

## 5. 架构：在 AI 助手 内核中的位置

### 5.1 数据流图（feature 启用前 vs 后）

```
────────────── 启用前 ──────────────
user query → 对话入口 shell → agentEvaluator → Graph+DLP → LLM → Trust → user

────────────── 启用后 ──────────────
user query → 对话入口 shell → agentEvaluator → Graph+DLP → LLM → Trust
                                                              ↓
                                                       [Sentinel: Eval Gate]
                                                       (内核内, tenant 内)
                                                              ↓
                                                       PASS → user
                                                       FAIL → blocked + evidence
```

**关键事实**：Eval Gate **在 agentEvaluator 内核里、与 Trust layer 紧邻**。它看到的是**完整的内部信号**——拉源计划、DLP 实际效果、Trust score。它**不是外挂**。

### 5.2 为什么必须"在 tenant 内"运行

| 视角 | 解释 |
|---|---|
| GDPR / 金融监管 | 证据出 tenant = 违法 |
| DLP enforcement 验证 | 必须看到 DLP 实际配置 + 实际截断效果 → 这些不出 tenant |
| Source scoping 验证 | 必须看 Graph 的 effective permission → 这些不出 tenant |
| 合规签字 | 只认 tenant 内产出的证据（外部平台出具的合规默认不收） |

> **因此本 feature 物理上无法外包给第三方 eval 厂商实现。**

### 5.3 与 LangSmith / Braintrust 的关系

| 能力 | LangSmith | 本 feature |
|---|---|---|
| Dev-time trace | ✅ 主战场 | ⚠️ 仅 sync 上报 |
| 行为 / 质量 / 成本评估 | ✅ | ✅ |
| Tenant policy 验证 | ❌ | ✅ |
| DLP enforcement 验证 | ❌ | ✅ |
| Source scoping 验证 | ❌ | ✅ |
| Trust score 验证 | ❌ | ✅ |
| 数据不出 tenant | ❌ | ✅ |
| 合规签字认可 | ❌ | ✅ |
| 进入 AI 助手 的入场券 | ❌ | ✅ |

**关系**：**上下游**而非竞争。开发者继续用 LangSmith 做开发期 trace；本 feature 做 **production gate + drift + 合规证据**。

---

## 6. 北极星指标（5 个，全部可埋点）

| # | 指标 | 计算方式 | 目标方向 | 启用后 12 个月目标 |
|---|---|---|---|---|
| 1 | **每 agent 上线人介入次数** | 7 日滑动平均，每 agent 上线 1 次所需的人类决策点介入数 | → 0 | < 1 |
| 2 | **Loop 推荐被人类接受率** | AI 草稿的修复建议被人工采纳的比例 | ↑ | > 70% |
| 3 | **Eval 失败到修复时间 P50** | 一次失败到 triage + apply fix 的中位耗时 | ↓ | < 24h |
| 4 | **Drift 被平台先于客户发现的占比** | 平台告警先于客户投诉的漂移事件 / 总漂移事件 | ↑ | > 80% |
| 5 | **Agent-caused false gate pass** | 应当被 block 但 pass 的事件计数 | = 0 | 0（绝对底线） |

**与"agent-caused false gate pass = 0"的工程含义**：

> 这是质量底线，**不是"接近 0"而是"等于 0"**。任何一次假放行都要在 24h 内触发事故复盘 + 全租户回扫。这是"产品质量 vs 上市速度"中的硬下限——宁可误 block，不漏 block。

---

## 7. 范围与非范围

### 7.1 In Scope（v1.0）

- ✅ Eval suite 提交、版本化、baselining
- ✅ 多维测量：quality / accuracy / latency / cost / trust / DLP / source scoping
- ✅ Failure triage + 修复草稿
- ✅ Drift detection（时间 / 模型 / 租户三个轴）
- ✅ Evidence Pack（API + Admin Center 视图）
- ✅ 4 类人类决策点显式拦截
- ✅ Agent Dashboard
- ✅ A/B with 对话入口（用于 drift 基线）

### 7.2 Out of Scope（v1.0）

- ❌ 不取代开发者现有的 dev-time eval 工具链（LangSmith/Braintrust 仍可用）
- ❌ 不做模型训练或微调（与 Azure AI 模型平台 区分）
- ❌ 不做 agent 编排（与 Agent 编排平台 区分）
- ❌ 不做实时 prompt 改写（仅在 eval fail 时建议修复）

### 7.3 边界

| 边界 | 与谁区分 | 区分原则 |
|---|---|---|
| agentEvaluator Eval Platform vs **LangSmith** | Dev-time trace | 后者在外观察，前者在内持有 |
| agentEvaluator Eval Platform vs **Azure AI Evaluation** | 离线模型质量 | 前者接生产流量 + tenant 内合规层，后者接 Azure 训练/评估 |
| agentEvaluator Eval Platform vs **Agent 编排平台** | Agent 编排 | 前者管"上线准入 + 运行审计"，后者管"agent 怎么写" |
| agentEvaluator Eval Platform vs **企业合规管理平台** | DLP 配置 | 前者消费 DLP 配置做验证，后者是配置方 |

---

## 8. 启用后的真实收益（开发者视角，3 张表）

### 8.1 时间收益

| 流程 | 启用前 | 启用后 |
|---|---|---|
| 一次 eval 失败排查 | 2-7 天 | < 24h |
| 一次 LLM 模型升级的回归验证 | 1-2 周 | < 1 天（自动跑） |
| 一次合规审计应答 | 1-2 周 | 0（API 实时可拉） |
| 一次跨租户 DLP 差异定位 | 手动 | 自动 + 根因候选 |

### 8.2 责任收益

| 角色 | 启用前 | 启用后 |
|---|---|---|
| Agent 开发者 | 模糊"出事谁负责" | 显式 4 类人类决策点 + 全程审计 |
| Tenant 管理员 | 看不见 agent 在干什么 | 单一管控面 + 全 agent 健康度 |
| 合规官 | 不认 dev-time trace | 认 tenant 内产出的结构化证据 |
| 终端用户 | 偶发"agent 说了不该说的" | 该说的才说、且每条可追 |

### 8.3 商业收益

| 收益 | 量化 |
|---|---|
| 合规事故下降 | 目标：企业 AI 助手 AI 助手 启用 12 月内合规事故率 ↓ 60% |
| Agent 上线周期 | 目标：上线评审时间 ↓ 50% |
| 3P 开发者接入 Marketplace 速度 | 目标：通过 Gate 的 3P agent 上 Marketplace 时间 ↓ 40% |
| 客户对 AI 助手 信任度 | 指标：单租户启用后 agent 活跃度 ↑ 25% |

---

## 9. 风险与缓解

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| 假 block 频繁，开发者开"log only"模式绕开 | 中 | 高（feature 失效） | 调阈值 + 提供"分级 strictness"（Block / Soft-block / Log only 三档） |
| Eval 套件本身被攻破（agent 开发者写"专门通过 eval 的 eval suite"） | 中 | 极高 | 引入"对抗性 eval case" + 红队测试 + 套件差异度审计 |
| Drift 告警风暴 | 中 | 中 | 智能聚合（按根因合并）+ 告警分级 |
| 跨租户 DLP 配置差异巨大，eval suite 在小租户永远失败 | 中 | 中 | 套件分级（"通用 suite" + "租户定制 suite"） |
| 第三方 agent 开发者认为 feature 是"微软锁生态" | 低 | 中 | 公开承诺 1P=3P + 公开 eval 标准 + 第三方可参与标准制定 |
| 评估本身引入 latency 拖垮用户体验 | 低 | 高 | 评估与回答并行预跑；P95 增量 < 200ms |

---

## 10. 上市路径

### Phase 0：内部 dogfood（90 天）
- 企业 AI 助手 AI 助手 自家所有 1P agent 启用
- 内部合规官试用 Evidence Pack
- 用内部真实流量建立 baseline

### Phase 1：3P early access（90 天）
- 邀请 5-10 家头部 3P 开发者试用
- 收集"developer experience"反馈
- 调阈值 / 调人类决策点

### Phase 2：GA + Marketplace 挂钩（30 天）
- 全面 GA，1P=3P 同步开放
- Marketplace 提交 3P agent **必须通过本 feature 的 Gate** 作为硬挂钩
- 公开 eval 标准 + 公开 evidence 模板

### Phase 3：生态扩展（持续）
- 支持更多 eval 类型（multi-modal、code gen）
- 与 Azure AI 模型平台 模型目录联动
- 第三方 eval 提供商可通过 MCP 接入（贡献 scoring function，但 Gate 决策仍在 agentEvaluator 内核）

---

## 11. 附录

### 11.1 术语表

| 术语 | 解释 |
|---|---|
| **agentEvaluator** | 企业 AI 助手 AI 助手 的企业工作智能层（内核模块） |
| **对话入口** | 企业 AI 助手 AI 助手 的对话 UI 入口 |
| **Graph / 企业数据访问层** | 统一访问 企业 AI 助手 数据的 API 层（Mail/Docs/Teams/People） |
| **DLP 平台** | 企业合规管理平台，配置 DLP / 保留策略 / 分类 |
| **DLP** | Data Loss Prevention，数据防泄漏规则 |
| **Trust score** | AI 助手 给答案的可信度评分（0-1），含引用回链校验 |
| **Source scoping** | "这个 answer 用的源，是否都在 user 的 effective permission 范围内" |
| **Evidence Pack** | 本 feature 产出的结构化合规证据 |
| **Gate** | 一次"放行 / 拦截"决策点 |
| **Drift** | agent 行为随时间 / 模型 / 租户的非预期变化 |

### 11.2 一句话讲给每个角色

| 角色 | 一句话 |
|---|---|
| **给合规** | "这是 企业 AI 助手 AI 助手 内部产出的、可签字的合规证据中枢。" |
| **给 Agent 开发者** | "你的 agent 打开这个开关后，每次回答都自带合规证据，跨模型升级自动告警。" |
| **给 Tenant 管理员** | "一个开关，全租户所有 agent 自动获得门控和审计。" |
| **给终端用户** | "你说的 agent 会被检查到不出错才给你看到。" |
| **给微软战略层** | "这是 企业 AI 助手 AI 助手 准入关卡——3P agent 进 Marketplace 的必经门。" |

### 11.3 关联文档

- [对比 LangSmith / Braintrust / Azure AI Evaluation](#)：见 §5.3
- [DLP 截断 ≠ 不泄漏的三种路径](#)：幻觉补全 / 跨源推理 / 真泄漏，详见附文
- [北极星指标 §6](#)：5 个可埋点指标的工程含义

---

> **本 PRD 的核心承诺**：启用本 feature 之后，**既有的 agent 系统在四个维度上同时升级**——
> 1. 每次回答多了"门控"（坏的不过）
> 2. 每次回答多了"证据"（可被合规签字）
> 3. 任何时刻多了"drift 雷达"（平台先于客户发现）
> 4. 团队责任多了"显式边界"（哪 4 类动作必须人签）
>
> **而这一切不需要改一行 agent 代码。**