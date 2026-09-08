// 数据拉取模块 — mock 实现
//
// 真实数据拉取会做: query 解析 → embedding 检索 → Graph 调用 → effective
// permission 校验 → 返回 source 列表。Demo 用关键词匹配简化,功能等价:
//
// 输出结构是 PRD §4.3 Evidence Pack 中 pulled_sources 字段的源数据:
//   { plan: [{id, type, rule, why}],
//     actual: [{id, type, content, decision, rule}],
//     requesterEffectivePermissions: [...] }

const corpus = require("../data/fixtures/corpus");

// 模拟 effective permission(真实场景来自 Graph token)
function getRequesterPermissions(tenant) {
  return ["mail:read", "docs:read", "people:read"];
}

// 决定 query 要拉哪些 source
function decidePlan(query, agent, tenant) {
  // 1. pullRules 关键词匹配
  const candidates = corpus.pullRules[query] || [];
  if (candidates.length === 0) {
    return { plan: [], actual: [], requesterEffectivePermissions: getRequesterPermissions(tenant) };
  }

  // 2. 取 source 完整内容
  const sources = candidates
    .map((id) => corpus.sources[id])
    .filter(Boolean);

  // 3. 构造 plan(为什么拉这些)
  const plan = sources.map((s) => ({
    id: s.id,
    type: s.type,
    rule: s.type === "email" ? "tenant-mail-read" : "tenant-docs-read",
    why: `匹配 query: "${query}"`,
  }));

  return {
    plan,
    actual: sources,
    requesterEffectivePermissions: getRequesterPermissions(tenant),
  };
}

module.exports = { decidePlan, getRequesterPermissions };
