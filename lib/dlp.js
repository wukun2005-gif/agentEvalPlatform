// DLP 数据脱敏 — mock 实现
//
// 真实 DLP 是基于规则引擎 + 分类标签的合规平台。
// Demo 用正则 + 简单规则字典,功能上模拟:
//   - rule 命中 → 替换为 [REDACTED]
//   - 不命中 → 原文 PASS
//   - 每次替换记录在 ruleLog,供 Evidence Pack 用
//
// 守恒校验: fixture corpus 的 mail-A 原文 "绩效 A" 必须被本模块的 HR-薪资-2024
// 规则替换为 [REDACTED] — 否则幻觉补全检测无效。

const rules = {
  "HR-薪资-2024": {
    name: "HR-薪资-2024",
    description: "员工绩效、涨薪、薪资数字等 HR 敏感信息",
    // 顺序敏感:先匹配具体组合,再匹配单词
    patterns: [
      { regex: /绩效\s*[A-D]/g, label: "绩效等级" },
      { regex: /涨薪\s*\d+%/g, label: "涨薪比例" },
      { regex: /月薪\s*[\d,]+/g, label: "月薪数字" },
      { regex: /薪资\s*[\d,]+/g, label: "薪资数字" },
    ],
  },
  "EU-PII-2026": {
    name: "EU-PII-2026",
    description: "欧盟个人身份信息(PII):SSN、护照、电话等",
    patterns: [
      { regex: /\b\d{3}-\d{2}-\d{4}\b/g, label: "SSN" },
      { regex: /\b[A-Z]{2}\d{7}\b/g, label: "护照号" },
      { regex: /\+\d{1,3}\s?\d{4,}/g, label: "国际电话" },
    ],
  },
};

// 模拟"租户 DLP 配置决定可应用哪些规则"的过程
function getApplicableRules(tenant) {
  if (!tenant || !tenant.dlpRules) return [];
  return tenant.dlpRules.map((name) => rules[name]).filter(Boolean);
}

// 单条 source 应用 DLP
function applyDLPToSource(source, applicableRules) {
  let content = source.content;
  const ruleLog = [];

  for (const rule of applicableRules) {
    for (const p of rule.patterns) {
      const matches = [...content.matchAll(p.regex)];
      for (const m of matches) {
        ruleLog.push({
          source_id: source.id,
          rule: rule.name,
          span: m[0],
          before: m[0],
          after: "[REDACTED]",
          label: p.label,
        });
      }
      content = content.replace(p.regex, "[REDACTED]");
    }
  }

  return {
    ...source,
    content,
    decision: ruleLog.length > 0 ? "REDACTED" : "PASS",
    ruleLog,
  };
}

// 批量:对一个 tenant 的所有 source 应用 DLP
function applyDLP(sources, tenant) {
  const applicableRules = getApplicableRules(tenant);
  return sources.map((s) => applyDLPToSource(s, applicableRules));
}

// 工具:把所有 source 拼成 LLM 实际看到的 context 字符串
function buildLLMContext(redactedSources) {
  return redactedSources
    .map((s) => `[${s.type}:${s.id}] (${s.subject || "no subject"})\n${s.content}`)
    .join("\n\n");
}

module.exports = { applyDLP, applyDLPToSource, getApplicableRules, buildLLMContext, rules };
