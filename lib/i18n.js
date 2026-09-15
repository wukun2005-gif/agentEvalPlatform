// lib/i18n.js — 服务端文案国际化 (zh / en)
//
// 前端 public/i18n.js 只覆盖静态 UI 文案;但大量"生成的内容"(管线步骤标签、
// 评估器 reason、Triage 根因/修复草稿、Drift 根因、Evidence Pack 解读)全部在服务端
// 生成,所以服务端也必须有一份字典,否则切成 English 后这些地方仍是中文。

const DICT = {
  zh: {
    // —— 管线步骤 ——
    "step.pull": "① 数据拉取",
    "step.dlp": "② DLP 脱敏",
    "step.llm": "③ LLM 生成回答",
    "step.trust": "④ Trust 可信度评分",
    "step.evaluate": "⑤ 7 维评估",
    "step.gate": "⑥ Gate 决策",
    "trust.source": "evaluator/trust 实时计算",

    // —— pull-source ——
    "pull.why": '匹配 query: "{q}"',

    // —— evidence pack ——
    "dlp.summary": "{n} 处脱敏",
    "diff.none": "无幻觉补全 — LLM 输出内容均在 input 中可见",
    "diff.some": "幻觉补全 — LLM 输出包含 {n} 个 input 中不存在的字符串: {list} 等",

    // —— accuracy ——
    "accuracy.empty": "输出为空",
    "accuracy.echo": "LLM 复述了 {n} 处被 DLP 截断的原文: {spans} — 幻觉补全",
    "accuracy.hallucinatedNumbers": "LLM 输出包含 {n} 个输入中不存在的数字: {list} 等 — 可能幻觉",
    "accuracy.pass": "LLM 输出与输入语义一致，未检测到幻觉",

    // —— dlp-behavior ——
    "dlpBehavior.noRedaction": "无 DLP 截断,无可检测违规",
    "dlpBehavior.pass": "LLM 未复述 {n} 处被 [REDACTED] 替换的原文",
    "dlpBehavior.fail": "LLM 复述了 {n} 处被 DLP 截断的原文: {spans} — 幻觉补全",

    // —— source-scoping ——
    "scoping.noSource": "无 source,无需校验",
    "scoping.typeViolation": "type 越权",
    "scoping.crossTenant": "跨租户访问: {from} → {to}",
    "scoping.pass": "{n} 条 source 全部在 agent 允许范围内",
    "scoping.fail": "{n} 条 source 越权: {list}",

    // —— trust ——
    "trust.fail": "trust 失败: {reason}",
    "trust.pass": "引用回链 + DLP enforcement 通过 (accuracy={pct}%)",
    "trust.failAccuracy": "trust 失败: accuracy 不足 ({pct}%)",

    // —— quality ——
    "quality.empty": "输出为空",
    "quality.repeatedLines": '输出包含重复内容: "{s}" 重复 {n} 次',
    "quality.repeatedSentences": '输出包含连续重复: "{s}" 连续出现 3 次',
    "quality.garbled": '输出包含乱码: "{s}"',
    "quality.pass": "输出长度 {n} 字符, 关键词命中: {hit}",
    "quality.yes": "是",
    "quality.no": "否",

    // —— triage ——
    "triage.noFailure": "无失败,无需 triage",
    "triage.unknown": "未知 failure: {name},无对应 playbook",

    // —— drift ——
    "drift.insufficient": "样本不足 ({n} 条),无法可靠检测 drift",
    "drift.noAlert": "无漂移,平台健康",
    "drift.alerts": "检测到 {n} 个漂移告警",
    "drift.cause.eu": "EU 租户启用了新 DLP 规则(EU-PII-2026),DLP 截断范围扩大",
    "drift.cause.dlp": "DLP 规则集变化或 LLM 行为退化",
    "drift.cause.scoping": "Agent 拉到了越权 source,需收紧 allowedSources",
    "drift.cause.latency": "底层 LLM 调用变慢,建议切换到更快 tier",
    "drift.cause.accuracy": "LLM 准确性下降,可能底层模型升级",
    "drift.cause.generic": "{name} 失败增多,需查看 evidence pack 详细原因",

    // —— llm-client ——
    "llm.fallback": '已收到查询: "{q}"。当前为 fixture 模式,如需测试该 query,请在 data/fixtures/llm-responses.js 中添加对应 fixture。',

    // —— state seed ——
    "seed.reason.pass": "无截断",
    "seed.reason.fail": "seeded failure",

    // —— server ——
    "verify.ok": "验证通过 — model 可调用",

    // —— 标点(中文用顿号,英文用逗号) ——
    "punct.list": "、",
  },

  en: {
    // —— Pipeline steps ——
    "step.pull": "① Pull Sources",
    "step.dlp": "② DLP Redact",
    "step.llm": "③ LLM Generate",
    "step.trust": "④ Trust Score",
    "step.evaluate": "⑤ 7-Dim Evaluation",
    "step.gate": "⑥ Gate Decision",
    "trust.source": "evaluator/trust computed in realtime",

    // —— pull-source ——
    "pull.why": 'Matched query: "{q}"',

    // —— evidence pack ——
    "dlp.summary": "{n} redaction(s)",
    "diff.none": "No hallucination — every string in the output is present in the input",
    "diff.some": "Hallucination — output contains {n} string(s) absent from input: {list}, etc.",

    // —— accuracy ——
    "accuracy.empty": "Empty output",
    "accuracy.echo": "LLM echoed {n} DLP-redacted span(s): {spans} — hallucination",
    "accuracy.hallucinatedNumbers": "Output contains {n} number(s) absent from input: {list}, etc. — possible hallucination",
    "accuracy.pass": "Output is semantically consistent with input, no hallucination detected",

    // —— dlp-behavior ——
    "dlpBehavior.noRedaction": "No DLP redaction, no detectable violation",
    "dlpBehavior.pass": "LLM did not echo {n} span(s) replaced by [REDACTED]",
    "dlpBehavior.fail": "LLM echoed {n} DLP-redacted span(s): {spans} — hallucination",

    // —— source-scoping ——
    "scoping.noSource": "No sources, nothing to verify",
    "scoping.typeViolation": "type not allowed",
    "scoping.crossTenant": "Cross-tenant access: {from} → {to}",
    "scoping.pass": "All {n} source(s) are within the agent's allowed scope",
    "scoping.fail": "{n} out-of-scope source(s): {list}",

    // —— trust ——
    "trust.fail": "trust failed: {reason}",
    "trust.pass": "Citation backlink + DLP enforcement passed (accuracy={pct}%)",
    "trust.failAccuracy": "trust failed: insufficient accuracy ({pct}%)",

    // —— quality ——
    "quality.empty": "Empty output",
    "quality.repeatedLines": 'Output contains repeated content: "{s}" repeated {n} times',
    "quality.repeatedSentences": 'Output contains consecutive repetition: "{s}" appears 3 times in a row',
    "quality.garbled": 'Output contains garbled text: "{s}"',
    "quality.pass": "Output length {n} chars, keyword hit: {hit}",
    "quality.yes": "yes",
    "quality.no": "no",

    // —— triage ——
    "triage.noFailure": "No failures, triage not needed",
    "triage.unknown": "Unknown failure: {name}, no matching playbook",

    // —— drift ——
    "drift.insufficient": "Insufficient sample ({n} records), cannot reliably detect drift",
    "drift.noAlert": "No drift, platform healthy",
    "drift.alerts": "Detected {n} drift alert(s)",
    "drift.cause.eu": "EU tenant enabled a new DLP rule (EU-PII-2026); redaction scope widened",
    "drift.cause.dlp": "DLP rule set changed or LLM behavior degraded",
    "drift.cause.scoping": "Agent pulled out-of-scope sources; tighten allowedSources",
    "drift.cause.latency": "Underlying LLM calls got slower; switch to a faster tier",
    "drift.cause.accuracy": "LLM accuracy dropped, possibly due to an underlying model upgrade",
    "drift.cause.generic": "More {name} failures; check the evidence pack for details",

    // —— llm-client ——
    "llm.fallback": 'Query received: "{q}". Running in fixture mode — to test this query, add a matching fixture to data/fixtures/llm-responses.js.',

    // —— state seed ——
    "seed.reason.pass": "no redaction",
    "seed.reason.fail": "seeded failure",

    // —— server ——
    "verify.ok": "Verified — model is callable",

    // —— punctuation (Chinese uses "、", English uses ", ") ——
    "punct.list": ", ",
  },
};

const LANGS = ["zh", "en"];

/** 归一化语言: "en-US" → "en", 其它一律回落 zh */
function normalizeLang(lang) {
  if (typeof lang !== "string" || lang.length === 0) return "zh";
  const l = lang.toLowerCase();
  if (l.startsWith("en")) return "en";
  if (l.startsWith("zh") || l.startsWith("cn")) return "zh";
  return "zh";
}

/**
 * 取文案。形如 t(lang, "step.pull", { q: "..." })
 * 缺失 key 时回落 zh,再缺失就直接返回 key 本身(便于发现漏翻)。
 */
function t(lang, key, vars) {
  const l = normalizeLang(lang);
  let s = DICT[l][key];
  if (s === undefined) s = DICT.zh[key];
  if (s === undefined) return key;
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] === undefined ? m : String(vars[k])));
}

/** 取形如 { zh: "...", en: "..." } 的字段 */
function pick(lang, value) {
  if (value == null) return value;
  if (typeof value === "object" && !Array.isArray(value)) {
    const l = normalizeLang(lang);
    if (value[l] !== undefined) return value[l];
    if (value.zh !== undefined) return value.zh;
    return undefined;
  }
  return value;
}

module.exports = { t, pick, normalizeLang, LANGS, DICT };
