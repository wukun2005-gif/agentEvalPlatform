// LLM client — 改自 appUIRefiner 的 keyStore + provider 模式
//
// 设计原则:
//   - keyStore (内存) > user_settings (DB) > process.env (dotenv)
//   - 每次调用前重新读 keyStore(支持运行时改)
//   - fixture fallback 永远可用
//   - 不直接 require dotenv(dotenv 在 server.js 启动时加载,这里走 process.env fallback)

const fixtures = require("../data/fixtures/llm-responses");
const settingsStore = require("./settings-store");

/** 决定当前模式 */
function getMode() {
  // LLM_MODE 设置优先（从 llm_global 读取）
  const lg = settingsStore.getSetting("llm_global") || {};
  const mode = lg.mode || process.env.LLM_MODE || "auto";
  if (mode === "fixture") return "fixture";
  if (mode === "live") return "live";
  // auto: 有任意 provider key 就 live
  const keys = settingsStore.getAllApiKeys();
  if (Object.keys(keys).length > 0) return "live";
  if (process.env.OPENAI_API_KEY) return "live";
  return "fixture";
}

// 示例 query 列表（使用 fixture）
const FIXTURE_QUERIES = [
  "张三最近表现",
  "上周我们组完成了哪些项目",
  "EU 合规审计近况",
  "帮我写一份详细的技术方案文档",
  "员工绩效列表",
  "写一篇长文",
];

async function callLLM({ messages, query, model, providerId, temperature = 0.7 }) {
  const mode = getMode();
  const start = Date.now();

  // 示例 query 始终使用 fixture（确保演示效果）
  if (FIXTURE_QUERIES.includes(query)) {
    return await callFixture(query, start);
  }

  // 其他 query 使用用户配置的 LLM
  if (mode === "fixture") {
    return await callFixture(query, start);
  }
  return await callLive({ messages, model, providerId, temperature, start });
}

async function callFixture(query, start) {
  await new Promise((r) => setTimeout(r, 50));

  const fixture = fixtures[query];
  if (!fixture) {
    return {
      content: `已收到查询: "${query}"。当前为 fixture 模式,如需测试该 query,请在 data/fixtures/llm-responses.js 中添加对应 fixture。`,
      usage: { prompt_tokens: 100, completion_tokens: 30, total_tokens: 130 },
      latency_ms: Date.now() - start,
      source: "fixture",
    };
  }

  return {
    content: fixture.llm_response,
    usage: fixture.usage || {
      prompt_tokens: Math.floor(fixture.llm_response.length / 4),
      completion_tokens: Math.floor(fixture.llm_response.length / 4),
      total_tokens: Math.floor(fixture.llm_response.length / 2),
    },
    latency_ms: fixture.latency_ms || (Date.now() - start),
    source: "fixture",
  };
}

async function callLive({ messages, model, providerId, temperature, start }) {
  // 每次调用前读最新 config
  // 优先级: providerId 指定 > llm_global.defaultProviderId > process.env 默认 openai
  const lg = settingsStore.getSetting("llm_global") || {};
  const pid = providerId || lg.defaultProviderId || process.env.LLM_PROVIDER || "openai";
  const apiKey = settingsStore.getApiKey(pid) || process.env.OPENAI_API_KEY;
  const baseUrl = settingsStore.getEffectiveConfig(pid, "baseUrl")
    || process.env.LLM_BASE_URL
    || "https://api.openai.com/v1";
  const finalModel = model
    || lg.defaultModelId
    || settingsStore.getEffectiveConfig(pid, "modelId")
    || process.env.LLM_MODEL
    || "gpt-4o-mini";

  if (!apiKey) {
    console.error(`[llm] No API key for provider "${pid}" — falling back to fixture`);
    return await callFixture(messages?.[messages.length - 1]?.content || "", start);
  }

  try {
    const OpenAI = require("openai").default || require("openai");
    const openai = new OpenAI({
      apiKey,
      baseURL: baseUrl,
      timeout: 60000,
    });
    
    console.log(`[llm] Calling ${pid}/${finalModel} @ ${baseUrl}`);
    console.log(`[llm] Messages: ${JSON.stringify(messages).slice(0, 200)}...`);
    
    const res = await openai.chat.completions.create({
      model: finalModel,
      messages: messages || [{ role: "user", content: "hi" }],
      temperature,
    });
    
    const latency = Date.now() - start;
    console.log(`[llm] Response: ${res.choices[0].message.content.slice(0, 100)}...`);
    console.log(`[llm] Usage: prompt=${res.usage?.prompt_tokens}, completion=${res.usage?.completion_tokens}, total=${res.usage?.total_tokens}`);
    console.log(`[llm] Latency: ${latency}ms`);
    
    return {
      content: res.choices[0].message.content,
      usage: res.usage,
      latency_ms: latency,
      source: `live:${pid}`,
    };
  } catch (e) {
    const latency = Date.now() - start;
    console.error(`[llm] ${pid}/${finalModel} call failed after ${latency}ms:`, e.message);
    return await callFixture(messages?.[messages.length - 1]?.content || "", start);
  }
}

module.exports = { callLLM, getMode };
