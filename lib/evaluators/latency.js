// Latency evaluator — 端到端 wall-clock
// 真实生产会更细粒度: pull / dlp / llm / eval 各阶段拆分
// Phase B 简单: 看 llm 调用 latency + 整体管道

function evaluate({ llmLatencyMs, wallMs }) {
  const passed = llmLatencyMs < 5000;
  return {
    name: "latency",
    score: passed ? 0.9 : 0.3,
    passed,
    reason: `LLM ${llmLatencyMs}ms (P95 target < 5000ms)`,
    breakdown: { llm_ms: llmLatencyMs, wall_ms: wallMs },
  };
}

module.exports = { evaluate };
