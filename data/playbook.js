// Failure Triage Playbook — failure 分类 + 修复模板
// 每条 failure 类别给出:
//   - category: 类别名
//   - root_cause: 候选根因
//   - suggested_fix: { type, patch, reason }
//   - auto_applicable: 能否一键 apply

module.exports = {
  "dlp-behavior": {
    category: "DLP_BEHAVIOR",
    severity: "high",
    root_cause: "LLM 在 context 看到 [REDACTED] 后,从训练先验幻觉补全原始内容",
    suggested_fix: {
      type: "prompt_patch",
      patch: `在 system prompt 增加:\n"NEVER infer, guess, or reconstruct values that appear as [REDACTED] in context. If a value is redacted, state that you don't have access to it."`,
      reason: "显式禁止 LLM 在 REDACTED 后做猜测,降低幻觉补全概率",
    },
    auto_applicable: true,
  },
  "source-scoping": {
    category: "SOURCE_SCOPING",
    severity: "high",
    root_cause: "Agent 拉到了不在 allowedSources 范围内的数据",
    suggested_fix: {
      type: "config_change",
      patch: "收紧 agent.allowedSources 列表,移除违规的 source type",
      reason: "最小权限原则,避免越权拉源",
    },
    auto_applicable: false,
  },
  accuracy: {
    category: "ACCURACY",
    severity: "medium",
    root_cause: "LLM 输出内容与 input 偏差大,可能幻觉",
    suggested_fix: {
      type: "eval_case",
      patch: "为该 query pattern 添加 regression eval case",
      reason: "建立回归测试,防止类似 hallucination 重现",
    },
    auto_applicable: true,
  },
  trust: {
    category: "TRUST",
    severity: "medium",
    root_cause: "Trust 综合评分低于阈值,通常因 DLP/accuracy 失败传导",
    suggested_fix: {
      type: "config_change",
      patch: "提高引用回链要求阈值,要求每条声明必须显式引用 source",
      reason: "增强 LLM 输出可追溯性",
    },
    auto_applicable: false,
  },
  quality: {
    category: "QUALITY",
    severity: "low",
    root_cause: "输出长度/格式不达标",
    suggested_fix: {
      type: "prompt_patch",
      patch: "在 system prompt 明确输出格式要求(长度、结构)",
      reason: "规范输出形态",
    },
    auto_applicable: true,
  },
  latency: {
    category: "LATENCY",
    severity: "low",
    root_cause: "LLM 调用耗时过长",
    suggested_fix: {
      type: "config_change",
      patch: "启用 streaming / 降低 max_tokens / 切换到更快的 model tier",
      reason: "减少 P95 时延",
    },
    auto_applicable: false,
  },
  cost: {
    category: "COST",
    severity: "low",
    root_cause: "Token 消耗超预算",
    suggested_fix: {
      type: "config_change",
      patch: "切换到更便宜的 model tier / 减少 context 长度",
      reason: "控制 token 成本",
    },
    auto_applicable: false,
  },
};
