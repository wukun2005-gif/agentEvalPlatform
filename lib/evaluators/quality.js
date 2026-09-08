// Quality evaluator — 输出质量检查
// 检测: 空输出、乱码、重复、是否回答了 query
// 长度问题由 cost 评估器负责

function evaluate({ llm_output, query }) {
  if (!llm_output || llm_output.length === 0) {
    return { name: "quality", score: 0.0, passed: false, reason: "输出为空" };
  }

  // 检查重复（同一行出现 3 次以上）
  const lines = llm_output.split("\n").filter((l) => l.trim());
  const lineCounts = {};
  lines.forEach((l) => { lineCounts[l] = (lineCounts[l] || 0) + 1; });
  const repeatedLines = Object.entries(lineCounts).filter(([_, count]) => count >= 3);
  if (repeatedLines.length > 0) {
    return {
      name: "quality",
      score: 0.2,
      passed: false,
      reason: `输出包含重复内容: "${repeatedLines[0][0].slice(0, 30)}..." 重复 ${repeatedLines[0][1]} 次`,
    };
  }

  // 检查是否包含乱码（连续特殊字符）
  const garbled = llm_output.match(/[^\w\s\u4e00-\u9fff，。！？、；：""''（）\[\]【】,.!?;:'"()\-\n\r]{5,}/g);
  if (garbled) {
    return {
      name: "quality",
      score: 0.1,
      passed: false,
      reason: `输出包含乱码: "${garbled[0].slice(0, 20)}..."`,
    };
  }

  // 检查关键词命中（可选，不影响 passed）
  const keywords = query.split(/[\s,。;、?？]+/).filter((w) => w.length >= 2);
  const keywordsHit = keywords.some((w) => llm_output.includes(w));

  return {
    name: "quality",
    score: 0.85,
    passed: true,
    reason: `输出长度 ${llm_output.length} 字符, 关键词命中: ${keywordsHit ? "是" : "否"}`,
  };
}

module.exports = { evaluate };
