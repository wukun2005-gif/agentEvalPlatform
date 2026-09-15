// Failure Triage Playbook — failure 分类 + 修复模板
// 每条 failure 类别给出:
//   - category: 类别名(代码,不翻译)
//   - root_cause: 候选根因
//   - suggested_fix: { type, patch, reason }
//   - auto_applicable: 能否一键 apply
//
// root_cause / patch / reason 是"生成出来给用户看"的文案,必须双语 —— 用 { zh, en } 表示。

module.exports = {
  "dlp-behavior": {
    category: "DLP_BEHAVIOR",
    severity: "high",
    root_cause: {
      zh: "LLM 在 context 看到 [REDACTED] 后,从训练先验幻觉补全原始内容",
      en: "After seeing [REDACTED] in context, the LLM hallucinates the original value from its training prior",
    },
    suggested_fix: {
      type: "prompt_patch",
      patch: {
        zh: `在 system prompt 增加:\n"NEVER infer, guess, or reconstruct values that appear as [REDACTED] in context. If a value is redacted, state that you don't have access to it."`,
        en: `Add to the system prompt:\n"NEVER infer, guess, or reconstruct values that appear as [REDACTED] in context. If a value is redacted, state that you don't have access to it."`,
      },
      reason: {
        zh: "显式禁止 LLM 在 REDACTED 后做猜测,降低幻觉补全概率",
        en: "Explicitly forbid the LLM from guessing after REDACTED, lowering the chance of hallucinated completion",
      },
    },
    auto_applicable: true,
  },
  "source-scoping": {
    category: "SOURCE_SCOPING",
    severity: "high",
    root_cause: {
      zh: "Agent 拉到了不在 allowedSources 范围内的数据",
      en: "The agent pulled data outside its allowedSources scope",
    },
    suggested_fix: {
      type: "config_change",
      patch: {
        zh: "收紧 agent.allowedSources 列表,移除违规的 source type",
        en: "Tighten the agent.allowedSources list and remove the violating source type",
      },
      reason: {
        zh: "最小权限原则,避免越权拉源",
        en: "Least-privilege principle — avoid pulling sources out of scope",
      },
    },
    auto_applicable: false,
  },
  accuracy: {
    category: "ACCURACY",
    severity: "medium",
    root_cause: {
      zh: "LLM 输出内容与 input 偏差大,可能幻觉",
      en: "Output diverges significantly from the input — possible hallucination",
    },
    suggested_fix: {
      type: "eval_case",
      patch: {
        zh: "为该 query pattern 添加 regression eval case",
        en: "Add a regression eval case for this query pattern",
      },
      reason: {
        zh: "建立回归测试,防止类似 hallucination 重现",
        en: "Build a regression test so this class of hallucination cannot reappear",
      },
    },
    auto_applicable: true,
  },
  trust: {
    category: "TRUST",
    severity: "medium",
    root_cause: {
      zh: "Trust 综合评分低于阈值,通常因 DLP/accuracy 失败传导",
      en: "Trust score fell below threshold, usually cascading from a DLP / accuracy failure",
    },
    suggested_fix: {
      type: "config_change",
      patch: {
        zh: "提高引用回链要求阈值,要求每条声明必须显式引用 source",
        en: "Raise the citation-backlink threshold: every claim must explicitly cite a source",
      },
      reason: {
        zh: "增强 LLM 输出可追溯性",
        en: "Improve traceability of LLM output",
      },
    },
    auto_applicable: false,
  },
  quality: {
    category: "QUALITY",
    severity: "low",
    root_cause: {
      zh: "输出长度/格式不达标",
      en: "Output length / format below standard",
    },
    suggested_fix: {
      type: "prompt_patch",
      patch: {
        zh: "在 system prompt 明确输出格式要求(长度、结构)",
        en: "State explicit output format requirements in the system prompt (length, structure)",
      },
      reason: {
        zh: "规范输出形态",
        en: "Normalize the output shape",
      },
    },
    auto_applicable: true,
  },
  latency: {
    category: "LATENCY",
    severity: "low",
    root_cause: {
      zh: "LLM 调用耗时过长",
      en: "LLM call took too long",
    },
    suggested_fix: {
      type: "config_change",
      patch: {
        zh: "启用 streaming / 降低 max_tokens / 切换到更快的 model tier",
        en: "Enable streaming / lower max_tokens / switch to a faster model tier",
      },
      reason: {
        zh: "减少 P95 时延",
        en: "Reduce P95 latency",
      },
    },
    auto_applicable: false,
  },
  cost: {
    category: "COST",
    severity: "low",
    root_cause: {
      zh: "Token 消耗超预算",
      en: "Token consumption is over budget",
    },
    suggested_fix: {
      type: "config_change",
      patch: {
        zh: "切换到更便宜的 model tier / 减少 context 长度",
        en: "Switch to a cheaper model tier / shorten the context",
      },
      reason: {
        zh: "控制 token 成本",
        en: "Keep token cost under control",
      },
    },
    auto_applicable: false,
  },
};
