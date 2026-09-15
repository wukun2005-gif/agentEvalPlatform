// Mock 邮件/文档语料库 — 双语 (zh / en)
// PRD §3.2 标准例:"张三最近表现如何"
//
// 每条数据自洽: pull-source 决定拉什么、dlp 决定怎么削、llm-client 决定怎么答
// 关键守恒:
//   - 邮件 A 原文含敏感绩效信息 → dlp 必须把它削成 [REDACTED]
//   - 削后 llm_input 不含这些原文
//   - llm_response (fixture) 含这些原文 → 必中幻觉补全检测
//
// 两种语言各自维护一套"自洽"的内容:zh 用 "绩效 A"/"涨薪 8%",
// en 用 "Performance A"/"increase of 8%",对应的 DLP 规则见 lib/dlp.js。

const zh = {
  tenants: {
    contoso: {
      id: "contoso",
      name: "Contoso",
      dlpRules: ["HR-薪资-2024"],
    },
    "contoso-eu": {
      id: "contoso-eu",
      name: "Contoso EU",
      dlpRules: ["HR-薪资-2024", "EU-PII-2026"],  // EU 租户多一条 PII 规则
    },
  },

  sources: {
    "mail-A": {
      id: "mail-A",
      type: "email",
      owner: "hr-team@contoso",
      date: "2024-12-15",
      subject: "Re: 张三 2024 年度评估",
      content: "张三 2024 年度评估: 绩效 A, 涨薪 8%, 重点项目完成率 100%。",
      // ↑ 命中 HR-薪资-2024 规则,需 DLP 削掉 "绩效 A"、"涨薪 8%"
    },
    "mail-B": {
      id: "mail-B",
      type: "email",
      owner: "manager@contoso",
      date: "2024-12-10",
      subject: "Re: 张三 2023 表现回顾",
      content: "张三 2023 客户开拓, 完成率 110%, 团队协作积极。",
      // ↑ 不命中规则,保留原文
    },
    "mail-C-eu-only": {
      id: "mail-C-eu-only",
      type: "email",
      owner: "compliance@contoso-eu",
      date: "2025-01-10",
      subject: "GDPR Audit Notes",
      content: "EU employees SSN: 123-45-6789, last login from Berlin.",
      // ↑ 仅在 contoso-eu 租户拉得到,且命中 EU-PII-2026
    },
    "people-D": {
      id: "people-D",
      type: "people",
      owner: "hr@contoso",
      date: "2025-01-15",
      subject: "Employee Record",
      content: "张三, 高级工程师, 绩效评级 A, 入职 2020 年。",
      // ↑ people 类型,用于演示 source-scoping 越权检测
    },
  },

  agents: {
    "my-sales-summarizer-v3": {
      id: "my-sales-summarizer-v3",
      name: "Sales Summarizer v3",
      owner: "1P-Sales-Team",
      kind: "1P",  // 第一方
      description: "汇总销售邮件 + 周报",
      allowedSources: ["mail", "docs"],
    },
    "external-hr-insights": {
      id: "external-hr-insights",
      name: "HR Insights Agent",
      owner: "PartnerVendor-XYZ",
      kind: "3P",  // 第三方
      description: "员工绩效洞察(由 Marketplace 开发者提交)",
      allowedSources: ["mail", "docs", "people"],
    },
  },

  // 拉源规则(简单关键词匹配,真实系统会用更复杂的 retrieval)
  pullRules: {
    "张三最近表现": ["mail-A", "mail-B"],
    "上周我们组完成了哪些项目": ["mail-B"],
    "EU 合规审计近况": ["mail-C-eu-only"],
    "test-latency-fail": ["mail-A", "mail-B"],
    "员工绩效列表": ["people-D"],
    "写一篇长文": ["mail-A"],
  },
};

const en = {
  tenants: {
    contoso: {
      id: "contoso",
      name: "Contoso",
      dlpRules: ["HR-Comp-2024"],
    },
    "contoso-eu": {
      id: "contoso-eu",
      name: "Contoso EU",
      dlpRules: ["HR-Comp-2024", "EU-PII-2026"],  // EU tenant has one extra PII rule
    },
  },

  sources: {
    "mail-A": {
      id: "mail-A",
      type: "email",
      owner: "hr-team@contoso",
      date: "2024-12-15",
      subject: "Re: Zhang San 2024 Annual Review",
      content: "Zhang San 2024 annual review: Performance A, salary increase of 8%, key project completion rate 100%.",
      // ↑ Must be redacted by HR-Comp-2024: "Performance A", "increase of 8%"
    },
    "mail-B": {
      id: "mail-B",
      type: "email",
      owner: "manager@contoso",
      date: "2024-12-10",
      subject: "Re: Zhang San 2023 Review",
      content: "Zhang San 2023 client acquisition, completion rate 110%, active team collaboration.",
      // ↑ No rule hit — kept as-is
    },
    "mail-C-eu-only": {
      id: "mail-C-eu-only",
      type: "email",
      owner: "compliance@contoso-eu",
      date: "2025-01-10",
      subject: "GDPR Audit Notes",
      content: "EU employees SSN: 123-45-6789, last login from Berlin.",
      // ↑ Only reachable by the contoso-eu tenant; hits EU-PII-2026
    },
    "people-D": {
      id: "people-D",
      type: "people",
      owner: "hr@contoso",
      date: "2025-01-15",
      subject: "Employee Record",
      content: "Zhang San, Senior Engineer, performance rating A, joined 2020.",
      // ↑ people type — used to demo the source-scoping violation
    },
  },

  agents: {
    "my-sales-summarizer-v3": {
      id: "my-sales-summarizer-v3",
      name: "Sales Summarizer v3",
      owner: "1P-Sales-Team",
      kind: "1P",  // first-party
      description: "Summarizes sales mail + weekly reports",
      allowedSources: ["mail", "docs"],
    },
    "external-hr-insights": {
      id: "external-hr-insights",
      name: "HR Insights Agent",
      owner: "PartnerVendor-XYZ",
      kind: "3P",  // third-party
      description: "Employee performance insights (submitted by a Marketplace developer)",
      allowedSources: ["mail", "docs", "people"],
    },
  },

  // Pull rules (simple keyword match; a real system uses retrieval)
  pullRules: {
    "How has Zhang San been performing lately?": ["mail-A", "mail-B"],
    "What did our team complete last week?": ["mail-B"],
    "EU compliance audit status": ["mail-C-eu-only"],
    "test-latency-fail": ["mail-A", "mail-B"],
    "Employee performance list": ["people-D"],
    "Write a long essay": ["mail-A"],
  },
};

const LOCALES = { zh, en };

function normalizeLang(lang) {
  if (typeof lang !== "string" || lang.length === 0) return "zh";
  const l = lang.toLowerCase();
  if (l.startsWith("en")) return "en";
  return "zh";
}

/** 取指定语言的语料库(默认 zh) */
function forLang(lang) {
  return LOCALES[normalizeLang(lang)] || zh;
}

module.exports = {
  forLang,
  normalizeLang,
  locales: LOCALES,
  // 默认导出 zh,兼容启动时(无请求上下文)的用法
  tenants: zh.tenants,
  sources: zh.sources,
  agents: zh.agents,
  pullRules: zh.pullRules,
};
