# Agent Evaluation Platform

AI agent 上线前的持续生产门控平台。每次回答前自动评估，不通过则不出结果。

## Why

现有方案（LangSmith、Braintrust、自写 CI eval）只看到 agent 的"答卷"（输入+输出），看不到 agent 是"怎么答的"：

- DLP 截了什么内容？
- 源权限实际是什么？
- Trust score 怎么算的？

本平台提供完整的**过程审计**，而非只看结果。

## What

6 步管线实时评估：

```
① 数据拉取 → ② DLP 脱敏 → ③ LLM 生成回答 → ④ Trust 可信度 → ⑤ 7 维评估 → ⑥ Gate 决策
```

**7 维评估维度：**

| 维度 | 检测什么 |
|------|----------|
| DLP Behavior | LLM 是否复述了被 DLP 截断的内容（幻觉补全） |
| Source Scoping | Agent 是否越权访问了不允许的 source |
| Accuracy | LLM 输出与 input 的一致性 |
| Trust | 综合可信度评分 |
| Quality | 输出长度、格式是否达标 |
| Latency | 响应时间是否超阈值 |
| Cost | Token 消耗是否超预算 |

**Gate 决策：**
- PASS → 响应交付用户
- BLOCKED → 阻止并生成 Evidence Pack（合规审计记录）

## Quick Start

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 打开浏览器
open http://localhost:3000
```

**演示流程：**

1. 打开 `#/replay`，点击示例 query（如"PRD 标准例 · 幻觉补全"）
2. 观察 6 步管线逐帧执行
3. 查看 Gate 决策（BLOCKED）和 Evidence Pack
4. 切换到 `#/triage` 查看失败分类和修复建议
5. 切换到 `#/dashboard` 查看整体通过率

## LLM 配置

点击左下角 **⚙ Settings** 配置 LLM：

- **示例 Query** → 使用预设 fixture（确保演示效果）
- **自定义 Query** → 调用你配置的 LLM

## Tech Stack

- **Runtime**: Node.js + Express
- **Storage**: SQLite (better-sqlite3)
- **Frontend**: Vanilla JS SPA
- **LLM**: OpenAI SDK (支持任意 OpenAI-compatible API)

## License

MIT
