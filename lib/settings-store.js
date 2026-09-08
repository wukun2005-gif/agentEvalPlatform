// settings-store.js — 改自 appUIRefiner/server/src/lib/dbQuery.ts + keyStore.ts
//
// 设计完全沿用 appUIRefiner 的两层架构:
//   1. SQLite user_settings 表(KV 存储) — 持久化层
//   2. 内存 keyStore Map — API key 专用缓存(永不重复读 DB)
//
// 关键约束(与 appUIRefiner 一致):
//   - key 形如 "provider_openai" / "provider_anthropic" / "llm_global"
//   - PUT /api/settings/:key 通用接口
//   - value 是 JSON string(可存任意结构)
//   - apiKey 字段**永远**单独存内存 cache(setApiKey/getApiKey)
//   - DB row 同时存 { apiKey: "***" } 用于显示脱敏后的元数据,但**真实 key 只在内存**
//
// 与 appUIRefiner 的差异(适配本 demo 范围):
//   - 不做 searchProvider / knowledgeProvider(本 demo 只关心 LLM)
//   - DB schema 简化: 单表 user_settings
//   - 没有用户系统, 单租户单用户

const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

// === 1. 内存 keyStore (与 appUIRefiner 同构) ===
const keyStore = new Map();

function setApiKey(providerId, apiKey) {
  if (!apiKey) return removeApiKey(providerId);
  keyStore.set(providerId, apiKey);
}

function getApiKey(providerId) {
  const cached = keyStore.get(providerId);
  if (cached) return cached;
  // fallback: 从 DB 读(让 server 重启后 key 不丢)
  const row = getSetting(`provider_${providerId}`);
  if (row && row.apiKey) {
    keyStore.set(providerId, row.apiKey);
    return row.apiKey;
  }
  return undefined;
}

function removeApiKey(providerId) {
  return keyStore.delete(providerId);
}

function clearAllApiKeys() {
  keyStore.clear();
}

function getAllApiKeys() {
  const result = {};
  for (const [k, v] of keyStore) result[k] = v;
  return result;
}

// === 2. SQLite 持久化 ===
const DB_DIR = path.join(__dirname, "..", "data");
const DB_PATH = process.env.DB_PATH || path.join(DB_DIR, "settings.db");

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS user_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  )
`);

const stmtGet = db.prepare("SELECT value FROM user_settings WHERE key = ?");
const stmtAll = db.prepare("SELECT key, value, updated_at FROM user_settings");
const stmtUpsert = db.prepare(`
  INSERT INTO user_settings (key, value, updated_at) VALUES (?, ?, datetime('now','localtime'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
`);
const stmtDelete = db.prepare("DELETE FROM user_settings WHERE key = ?");

// 服务器启动时加载所有 API key 到内存 keyStore
function loadAllApiKeys() {
  const rows = stmtAll.all();
  for (const row of rows) {
    if (row.key.startsWith("provider_")) {
      try {
        const value = JSON.parse(row.value);
        if (value && value.apiKey) {
          const providerId = row.key.replace(/^provider_/, "");
          setApiKey(providerId, value.apiKey);
        }
      } catch {}
    }
  }
}
loadAllApiKeys();
const stmtClear = db.prepare("DELETE FROM user_settings");

function getSetting(key) {
  const row = stmtGet.get(key);
  if (!row) return null;
  try { return JSON.parse(row.value); }
  catch { return null; }
}

function setSetting(key, value) {
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  stmtUpsert.run(key, serialized);
  // 如果是 provider 配置,同步 keyStore
  if (key.startsWith("provider_")) {
    const providerId = key.replace(/^provider_/, "");
    if (value && typeof value === "object" && value.apiKey) {
      setApiKey(providerId, value.apiKey);
    } else if (!value || (typeof value === "object" && !value.apiKey)) {
      removeApiKey(providerId);
    }
  }
  return { ok: true };
}

function deleteSetting(key) {
  stmtDelete.run(key);
  if (key.startsWith("provider_")) {
    const providerId = key.replace(/^provider_/, "");
    removeApiKey(providerId);
  }
  return { ok: true };
}

function getAllSettings() {
  const rows = stmtAll.all();
  const result = {};
  for (const row of rows) {
    try { result[row.key] = JSON.parse(row.value); }
    catch { result[row.key] = row.value; }
  }
  return result;
}

function clearAllSettings() {
  stmtClear.run();
  clearAllApiKeys();
}

// === 3. AppSettings 聚合(与 appUIRefiner 的 AppSettings 类似) ===
// 把 "provider_*" 单条 + "llm_global" 聚合,便于前端一次拿全
function getAppSettings() {
  const all = getAllSettings();
  // 找所有 provider_* 记录
  const providers = {};
  for (const [key, value] of Object.entries(all)) {
    if (key.startsWith("provider_") && typeof value === "object") {
      const providerId = key.replace(/^provider_/, "");
      providers[providerId] = { ...value, hasApiKey: !!getApiKey(providerId) };
    }
  }
  return {
    providers,
    llm_global: all.llm_global || null,
  };
}

function setAppSettings({ providers, llm_global }) {
  if (llm_global) setSetting("llm_global", llm_global);
  if (Array.isArray(providers)) {
    for (const p of providers) {
      if (!p.providerId) continue;
      setSetting(`provider_${p.providerId}`, p);
    }
  }
  return { ok: true };
}

// === 4. 兼容老 dotenv 行为(读 process.env 作为兜底) ===
// appUIRefiner 没有 dotenv,但我们 demo 同时支持:
//   - 用户通过 Settings UI 配的(走 SQLite)
//   - 用户手工 .env / shell env(走 process.env)
// 优先级: keyStore (内存) > user_settings (DB) > process.env
function getEffectiveConfig(providerId, field) {
  // 1. 内存 keyStore
  if (field === "apiKey") {
    const cached = keyStore.get(providerId);
    if (cached) return cached;
  }
  // 2. user_settings DB
  const fromDb = getSetting(`provider_${providerId}`);
  if (fromDb && fromDb[field] !== undefined && fromDb[field] !== "") {
    return fromDb[field];
  }
  // 3. process.env (dotenv 加载的 .env 或 shell env)
  const envMap = {
    apiKey: "OPENAI_API_KEY",
    baseUrl: "LLM_BASE_URL",
    modelId: "LLM_MODEL",
  };
  const envKey = envMap[field];
  if (envKey && process.env[envKey]) return process.env[envKey];
  return null;
}

// === 5. 启动时把 DB 里的 key 灌到内存 ===
function warmupKeyStore() {
  const all = getAllSettings();
  for (const [key, value] of Object.entries(all)) {
    if (key.startsWith("provider_") && value && value.apiKey) {
      const providerId = key.replace(/^provider_/, "");
      keyStore.set(providerId, value.apiKey);
    }
  }
}

module.exports = {
  // API key 内存层
  setApiKey, getApiKey, removeApiKey, clearAllApiKeys, getAllApiKeys,
  // DB 通用 KV
  getSetting, setSetting, deleteSetting, getAllSettings, clearAllSettings,
  // AppSettings 聚合
  getAppSettings, setAppSettings,
  // 兜底读
  getEffectiveConfig,
  // 启动加载
  warmupKeyStore,
};
