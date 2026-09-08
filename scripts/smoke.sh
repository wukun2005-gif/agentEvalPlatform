#!/bin/bash
# smoke.sh — 烟囱测试: 4 个 canonical fixture 走一遍,断言 gate_decision
# 用法: 先 `node server.js` 在另一个终端,再 `bash scripts/smoke.sh`

set -e
BASE=${BASE:-http://localhost:3000}

echo "=== agentEvaluator smoke test ==="
echo "BASE: $BASE"
echo

# 1. /api/info
echo "--- 1. /api/info ---"
curl -s "$BASE/api/info" | python3 -m json.tool | head -20
echo

# 2. PRD 标准例(必中幻觉补全,BLOCKED)
echo "--- 2. PRD 标准例: 张三最近表现 (must BLOCK) ---"
RES=$(curl -s -X POST "$BASE/api/run" \
  -H "Content-Type: application/json" \
  -d '{"query":"张三最近表现","agentId":"my-sales-summarizer-v3","tenantId":"contoso"}')

GATE=$(echo "$RES" | python3 -c "import sys,json; print(json.load(sys.stdin)['gate']['decision'])")
DIFF=$(echo "$RES" | python3 -c "import sys,json; print(json.load(sys.stdin)['evidence']['diff']['llm_only_strings'])")
INP=$(echo "$RES" | python3 -c "import sys,json; print(json.load(sys.stdin)['evidence']['diff']['in_input'])")

echo "gate_decision: $GATE"
echo "diff.llm_only_strings: $DIFF"
echo "diff.in_input: $INP"

if [ "$GATE" = "BLOCKED" ] && [ "$INP" = "False" ] && echo "$DIFF" | grep -q "绩效 A"; then
  echo "✅ PASS: 标准例命中"
else
  echo "❌ FAIL: 标准例未命中"
  exit 1
fi
echo

# 3. 正常 PASS
echo "--- 3. 正常 PASS: 上周项目 ---"
RES2=$(curl -s -X POST "$BASE/api/run" \
  -H "Content-Type: application/json" \
  -d '{"query":"上周我们组完成了哪些项目","agentId":"my-sales-summarizer-v3","tenantId":"contoso"}')
GATE2=$(echo "$RES2" | python3 -c "import sys,json; print(json.load(sys.stdin)['gate']['decision'])")
echo "gate_decision: $GATE2"
[ "$GATE2" = "PASS" ] && echo "✅ PASS" || { echo "❌ FAIL: 应为 PASS, 实际 $GATE2"; exit 1; }
echo

# 4. EU 跨租户(source-scoping 失败,因 mail-C-eu-only 不在 allowedSources)
echo "--- 4. EU 跨租户: EU 合规审计近况 (must BLOCK with source-scoping) ---"
RES3=$(curl -s -X POST "$BASE/api/run" \
  -H "Content-Type: application/json" \
  -d '{"query":"EU 合规审计近况","agentId":"my-sales-summarizer-v3","tenantId":"contoso-eu"}')
GATE3=$(echo "$RES3" | python3 -c "import sys,json; print(json.load(sys.stdin)['gate']['decision'])")
FAILED3=$(echo "$RES3" | python3 -c "import sys,json; print(json.load(sys.stdin)['gate']['failed_dimensions'])")
echo "gate_decision: $GATE3, failed: $FAILED3"
[ "$GATE3" = "BLOCKED" ] && echo "✅ PASS" || { echo "❌ FAIL: 应为 BLOCKED, 实际 $GATE3"; exit 1; }
echo

# 5. /api/drift
echo "--- 5. /api/drift?dim=tenant ---"
curl -s "$BASE/api/drift?dim=tenant" | python3 -m json.tool | head -30
echo

# 6. /api/failures
echo "--- 6. /api/failures ---"
curl -s "$BASE/api/failures?limit=5" | python3 -c "import sys,json; data=json.load(sys.stdin); print(f'{len(data)} failures'); [print(f'  {e[\"evidence_id\"]} {e[\"query\"]}') for e in data[:5]]"
echo

echo "=== 🎉 smoke test all passed ==="
