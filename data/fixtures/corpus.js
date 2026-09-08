// Mock 邮件/文档语料库
// PRD §3.2 标准例:"张三最近表现如何"
//
// 每条数据自洽: pull-source 决定拉什么、dlp 决定怎么削、llm-client 决定怎么答
// 关键守恒:
//   - 邮件 A 原文含 "绩效 A"、"涨薪 8%"  → dlp 必须把它削成 [REDACTED]
//   - 削后 llm_input 不含 "绩效 A"、"涨薪 8%"
//   - llm_response (fixture) 含 "绩效 A"、"涨薪 8%" → 必中幻觉补全检测

module.exports = {
  // 租户配置(影响 DLP 规则集)
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

  // 邮件/文档 mock 内容
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

  // Agent 列表(1P + 3P 都有,体现 1P=3P 原则)
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
  },
};
