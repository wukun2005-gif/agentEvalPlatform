# PRD: agentEvaluator

| Item | Value |
|---|---|
| **Feature Name** | agentEvaluator (Code Name: Sentinel) |
| **Product** | Enterprise AI Assistant Platform / Conversation Entry |
| **Level** | Platform Feature (enabled within AI Assistant), not a standalone product |
| **Owner Team** | AI Assistant Platform Core Team · AI Assistant Extended Capabilities Team |
| **Target Audience** | Development teams building agents on Enterprise AI Assistant (1P + 3P, equal capabilities) |
| **Status** | Draft v0.1 |
| **Core Question** | "I already have an agent running in AI Assistant/Conversation Entry—what additional value do I get after enabling this feature?" |

---

## 1. Executive Summary

agentEvaluator is a feature that can be **enabled within the core** of Enterprise AI Assistant. Any agent running within AI Assistant/Conversation Entry—whether from first-party product teams (AI Assistant, Loop, Planner) or third-party developers submitting via Agent SDK / Agent Orchestration Platform / Model Platform—**after enabling this feature**:

1. **Gets a "Continuous Production Gate"**: Every time the agent responds to a user, it is automatically evaluated; if it fails, no result is returned and the user never sees it.
2. **Gets a "Compliance Evidence Pack"**: Every response comes with an audit record that compliance officers can sign off on.
3. **Gets cross-model, cross-tenant, cross-time drift detection**: Alerts before customers report issues.

> **This document does not assume the reader is familiar with agentEvaluator**. We take a straightforward perspective: you've written an agent and it's live in the Enterprise AI Assistant ecosystem—why do you need this layer?

---

## 2. Target Audience and "What Happens If You Don't Enable This Feature"

### 2.1 Target Audience: Three Types of Agent Developers

| Reader | Current Status | What They Already Use |
|---|---|---|
| **Third-party Agent Developers (3P)** | Built agents with Agent SDK / Agent Orchestration Platform, preparing to launch on Marketplace | LangSmith / Braintrust for dev-time tracing; self-written prompt evaluation |
| **First-party Product Teams (1P)** | Embedded agent behavior in AI Assistant / Loop / Planner | Internal CI evaluation; occasional manual reviews |
| **Enterprise IT Administrators** | Managing agent launches within a tenant | No unified audit surface yet |

### 2.2 Real Pain Points Before Enabling (Ranked by Frequency)

| # | Pain Point | Who Experiences It | Frequency |
|---|---|---|---|
| P1 | Agent repeats content that was cut off by DLP (hallucination completion) | Compliance / Legal / The person whose data was leaked | High |
| P2 | Agent combines cross-source information to reach "DLP single rule can't catch" sensitive conclusions | Compliance / Legal | High |
| P3 | After underlying LLM upgrade, agent behavior drifts, performance/quality degrades | Users / Developers | Medium (with each model upgrade) |
| P4 | After launch, customers report "why did this agent show Zhang San's salary to Li Si?" | Developers | Medium |
| P5 | Compliance officer demands "show evidence of agent decision-making" but you only have LangSmith traces | Developers facing compliance | High |
| P6 | Cross-tenant behavior inconsistency: eval suite that passes in Tenant A fails in Tenant B (different DLP configurations) | Developers | Medium |
| P7 | Drift monitoring relies on manual trace review, high miss rate | Developers | High |

### 2.3 Why Existing Solutions Are Insufficient

| Existing Solution | Capability Ceiling | Structural Blind Spots |
|---|---|---|
| LangSmith / Braintrust | Gets `<input, output>` pairs | Cannot see intermediate steps: what DLP cut off, what actual source permissions are, how trust score is calculated |
| Azure AI Evaluation | Offline model quality evaluation | No production traffic integration, no tenant-level compliance layer integration |
| Self-written CI evaluation | Flexible | No integration with DLP / Graph permissions / Trust layer, cannot verify data leakage |
| Manual review | Flexible | Unsustainable, high miss rate |

> **Key Blind Spot**: All external solutions only see **the agent's "answer sheet"**, not **how the agent answered, how rules were followed**. Answer sheet = input + output; Process = source pull plan + actual DLP effect + permission verification + trust calculation.

---

## 3. Feature Scope and "What You Gain After Enabling"

### 3.1 One-line Value Proposition

> **Upgrade your agent from "answering based on good faith" to "audited compliant delivery"—and the audit itself runs on the AI Assistant core on your behalf, you only sign off at irreversible decision points.**

### 3.2 Five Key Benefits (Ranked by Value Density for Developers)

#### Benefit 1: Continuous Production Gate

| Dimension | Content |
|---|---|
| What You Gain | Before every agent response, a multi-dimensional evaluation runs automatically. If it fails, users cannot see the result. |
| Evaluation Dimensions | quality / accuracy / latency / cost / **trust** / **DLP behavior** / **source scoping** |
| Trigger Location | In AI Assistant's `agentEvaluator → LLM → Trust layer` pipeline, as the final step before output |
| Decision Latency | P95 increment < 200ms (evaluation runs within tenant, pre-fetched in parallel with response) |
| Your Workload | Write eval suite once; everything after is automatic |

**Compared to Current State**: Today you either trust that your prompt is "good enough" or review traces after the fact; after enabling, **bad output never reaches users**.

#### Benefit 2: Compliance Evidence Pack

| Dimension | Content |
|---|---|
| What You Gain | Every response automatically comes with a "compliance evidence JSON" |
| Evidence Content | `Original query` / `agentEvaluator source pull plan` / `DLP actual interception results` / `LLM actual input context` / `LLM output` / `Trust score + reference backlinks` / `Gate decision` |
| Format | Pullable via API, pushable to SIEM, aggregatable by user/agent/time |
| Your Workload | 0; compliance views it directly |

**Compared to Current State**: Today when compliance asks "why did your agent respond that way," you can only show LangSmith trace screenshots—compliance **doesn't accept them**. After enabling, compliance sees **structured, signable audit records**.

**Why Compliance Accepts This but Not LangSmith**:

```
LangSmith Report:                      agentEvaluator Evidence Pack:
                                      
  query: "Zhang San's recent performance"  query: "Zhang San's recent performance"
  output: "Performance A, 8% raise"         pulled_sources: [Email A, Email B]
                                            dlp_decision:
  ❌ Compliance: Are these two strings         - Email A: REDACTED (HR-Salary rule)
  copied by LLM or hallucinated?              - Email B: PASS
  How would LangSmith know?                   llm_input_context: "Email A: Performance [REDACTED]..."
                                            llm_output: "Performance A, 8% raise"
                                            diff: "Performance A" not in llm_input
                                                   → Hallucination completion → DLP enforcement failure
                                            gate_decision: BLOCKED
                                            
  ✅ Compliance: This is what we call evidence
```

#### Benefit 3: Drift Detection

| Dimension | Content |
|---|---|
| What You Gain | Cross-time, cross-model, cross-tenant behavioral drift automatic alerting |
| Detection Target | Changes in failure rate of the same eval suite across dimensions: (1) time window vs historical baseline; (2) before/after underlying LLM switch; (3) DLP configuration differences across tenants |
| Alert Format | Agent Dashboard + Email + Webhook |
| Your Workload | 0; alerts come with root cause candidates ("Tenant B failure rate increase mainly due to DLP-X rule being enabled") |

**Compared to Current State**: Today drift is discovered through "customer complaints"—80% of incidents are reported by users first. After enabling, **drift is discovered by the platform before customers**.

#### Benefit 4: Failure Triage + Fix Draft (Failure Triage Agent)

| Dimension | Content |
|---|---|
| What You Gain | Every eval failure is automatically classified against a "response playbook" + generates a fix draft |
| Playbook Content | Classifications for DLP misuse, overly broad source permissions, prompt vulnerabilities, model degradation, missing citations, etc. + corresponding fix suggestions |
| Fix Draft | Format: `(failure reason, candidate root cause, suggested prompt diff, suggested config change)`, one-click apply |
| Your Workload | From "tracing through logs to find root cause" to "reviewing draft and deciding whether to adopt" |

**Compared to Current State**: Today a single failure investigation takes 2-7 days. After enabling, **P50 fix time < 24h**.

#### Benefit 5: Human-in-the-Loop by Design

| Dimension | Content |
|---|---|
| What You Gain | 95% of coordination toil runs automatically on the platform; 5% of irreversible decision points are explicitly left to humans |
| 4 Types of Actions Requiring Human Decision | (1) Gate sign-off; (2) Accepting known failures to go live; (3) Tenant admin consent; (4) Any irreversible external action |
| Auditability | Every decision comes with name + time + reason + evidence reference |
| Your Workload | Only intervene at 4 decision points; 0 for everything else |

**Compared to Current State**: Today your responsibility boundaries are blurred—it's unclear who's responsible when something goes wrong. After enabling, **responsibility boundaries are explicitly defined by the system**.

---

## 4. User Experience: "Toggle + Dashboard" from the Developer's Perspective

### 4.1 Activation Method (One Line)

> **No new code required.** In the Enterprise AI Assistant Admin Center or Agent Orchestration Platform, enable a tenant-level / agent-level toggle; once enabled, **all existing agents immediately gain the feature's capabilities**.

```
Tenant Admin Console
  └─ AI Assistant → Evaluation Platform
      ├─ [✓] Enable for all 1P agents
      ├─ [✓] Enable for all 3P agents
      ├─ [ ] Allow agents to opt-out per-agent
      └─ Gate policy:
          ├─ Mode: [Block on fail | Log only | Custom]
          └─ Notify on drift: [Slack | Email | Teams | Webhook]
```

**For Developers**: Zero code changes—your agent calls AI Assistant/Conversation Entry the same way; the feature inserts a layer "inside the core."

### 4.2 Dashboard (Agent Dashboard)

```
┌─────────────────── Agent Dashboard ──────────────────┐
│  Agent: my-sales-summarizer-v3                       │
│  Status: ✅ HEALTHY  |  Last eval: 2 min ago         │
│                                                      │
│  Eval Suite Coverage: 412 cases / 412 scoped         │
│  Pass Rate (24h):  98.7%   (↑0.3% vs 7d baseline)   │
│  Drift Alerts:     0 active                          │
│  Evidence:         1,247 records, last 7d            │
│                                                      │
│  Recent Failures:                                     │
│   • DLP enforcement (#142)  12 min ago  → triaged   │
│   • Latency P95 (#88)        2h ago      → triaged   │
│   • Source scoping (#201)    yesterday   → triaged   │
│                                                      │
│  Suggested Fixes (auto-drafted):                     │
│   • Apply prompt patch #142-rev3 [Review & Apply]   │
│   • Add eval case for tenant X edge case  [Accept]   │
└──────────────────────────────────────────────────────┘
```

### 4.3 Evidence Pack Sample (Compliance Evidence for a Specific Response)

```json
{
  "evidence_id": "ev-2026-09-07-001247",
  "agent_id": "my-sales-summarizer-v3",
  "tenant_id": "contoso",
  "timestamp": "2026-09-07T10:23:41Z",
  "query": "Zhang San's recent performance",
  "pulled_sources": [
    {"id": "mail-A", "type": "email", "decision": "REDACTED", "rule": "HR-Salary-2024"},
    {"id": "mail-B", "type": "email", "decision": "PASS"}
  ],
  "llm_input_context": "Email A: Zhang San 2024 performance [REDACTED], raise [REDACTED]\nEmail B: Zhang San 2023 customer development, completion rate 110%",
  "llm_output": "Zhang San 2024 performance A, 8% raise, 2023 customer development...",
  "diff": {
    "llm_only_strings": ["Performance A", "8% raise"],
    "in_input": false,
    "interpretation": "Hallucination completion — LLM generated content not seen in context"
  },
  "trust_score": 0.62,
  "gate_decision": "BLOCKED",
  "gate_evaluator": "agent-evaluator-platform",
  "audit": {
    "evaluator": "ai-loop-v2.3",
    "human_review_required": false,
    "evidence_complete": true
  }
}
```

---

## 5. Architecture: Position Within the AI Assistant Core

### 5.1 Data Flow Diagram (Before vs After Enabling)

```
────────────── Before Enabling ──────────────
user query → Conversation Entry Shell → agentEvaluator → Graph+DLP → LLM → Trust → user

────────────── After Enabling ──────────────
user query → Conversation Entry Shell → agentEvaluator → Graph+DLP → LLM → Trust
                                                              ↓
                                                       [Sentinel: Eval Gate]
                                                       (Within core, within tenant)
                                                              ↓
                                                       PASS → user
                                                       FAIL → blocked + evidence
```

**Key Fact**: Eval Gate runs **inside the agentEvaluator core, adjacent to the Trust layer**. It sees **complete internal signals**—source pull plans, actual DLP effects, Trust scores. It is **not an external add-on**.

### 5.2 Why It Must Run "Within Tenant"

| Perspective | Explanation |
|---|---|
| GDPR / Financial Regulation | Evidence leaving tenant = illegal |
| DLP Enforcement Verification | Must see actual DLP configuration + actual interception effects → these don't leave tenant |
| Source Scoping Verification | Must see Graph's effective permissions → these don't leave tenant |
| Compliance Sign-off | Only recognizes evidence produced within tenant (external platform compliance reports are rejected by default) |

> **Therefore, this feature physically cannot be outsourced to third-party evaluation vendors.**

### 5.3 Relationship with LangSmith / Braintrust

| Capability | LangSmith | This Feature |
|---|---|---|
| Dev-time trace | ✅ Primary battleground | ⚠️ Sync reporting only |
| Behavior / Quality / Cost evaluation | ✅ | ✅ |
| Tenant policy verification | ❌ | ✅ |
| DLP enforcement verification | ❌ | ✅ |
| Source scoping verification | ❌ | ✅ |
| Trust score verification | ❌ | ✅ |
| Data stays within tenant | ❌ | ✅ |
| Compliance sign-off acceptance | ❌ | ✅ |
| Ticket to AI Assistant entry | ❌ | ✅ |

**Relationship**: **Upstream-downstream, not competitive**. Developers continue using LangSmith for development-time tracing; this feature handles **production gate + drift + compliance evidence**.

---

## 6. North Star Metrics (5, All Trackable)

| # | Metric | Calculation Method | Target Direction | 12-Month Post-Enablement Target |
|---|---|---|---|---|
| 1 | **Human intervention count per agent launch** | 7-day rolling average, number of human decision point interventions needed per agent launch | → 0 | < 1 |
| 2 | **Loop recommendation acceptance rate** | Ratio of AI-drafted fix suggestions manually adopted | ↑ | > 70% |
| 3 | **Eval failure to fix time P50** | Median time from failure to triage + apply fix | ↓ | < 24h |
| 4 | **Drift detected by platform before customers** | Platform alerts before customer complaints / total drift events | ↑ | > 80% |
| 5 | **Agent-caused false gate pass** | Count of events that should have been blocked but passed | = 0 | 0 (absolute baseline) |

**Engineering Implications of "agent-caused false gate pass = 0"**:

> This is a quality baseline, **not "close to 0" but "equals 0"**. Any false pass must trigger an incident post-mortem + full tenant sweep within 24h. This is a hard lower limit in "product quality vs time-to-market"—better to block falsely than to let one slip through.

---

## 7. Scope and Non-Scope

### 7.1 In Scope (v1.0)

- ✅ Eval suite submission, versioning, baselining
- ✅ Multi-dimensional measurement: quality / accuracy / latency / cost / trust / DLP / source scoping
- ✅ Failure triage + fix drafts
- ✅ Drift detection (three axes: time / model / tenant)
- ✅ Evidence Pack (API + Admin Center view)
- ✅ 4 types of human decision points with explicit interception
- ✅ Agent Dashboard
- ✅ A/B with Conversation Entry (for drift baseline)

### 7.2 Out of Scope (v1.0)

- ❌ Does not replace developers' existing dev-time evaluation toolchain (LangSmith/Braintrust still usable)
- ❌ Does not do model training or fine-tuning (differentiated from Azure AI Model Platform)
- ❌ Does not do agent orchestration (differentiated from Agent Orchestration Platform)
- ❌ Does not do real-time prompt rewriting (only suggests fixes when eval fails)

### 7.3 Boundaries

| Boundary | Differentiated From | Differentiation Principle |
|---|---|---|
| agentEvaluator Eval Platform vs **LangSmith** | Dev-time trace | Latter observes externally, former holds internally |
| agentEvaluator Eval Platform vs **Azure AI Evaluation** | Offline model quality | Former integrates production traffic + tenant compliance layer, latter integrates Azure training/evaluation |
| agentEvaluator Eval Platform vs **Agent Orchestration Platform** | Agent orchestration | Former manages "launch admission + runtime audit", latter manages "how agents are written" |
| agentEvaluator Eval Platform vs **Enterprise Compliance Management Platform** | DLP configuration | Former consumes DLP configuration for verification, latter is the configuration source |

---

## 8. Real Benefits After Enabling (Developer Perspective, 3 Tables)

### 8.1 Time Benefits

| Process | Before Enabling | After Enabling |
|---|---|---|
| Single eval failure investigation | 2-7 days | < 24h |
| Single LLM model upgrade regression verification | 1-2 weeks | < 1 day (automatic) |
| Single compliance audit response | 1-2 weeks | 0 (API real-time pullable) |
| Single cross-tenant DLP difference identification | Manual | Automatic + root cause candidate |

### 8.2 Responsibility Benefits

| Role | Before Enabling | After Enabling |
|---|---|---|
| Agent Developers | Blurred "who's responsible when things go wrong" | Explicit 4 human decision points + full audit trail |
| Tenant Administrators | Cannot see what agents are doing | Single control surface + all-agent health visibility |
| Compliance Officers | Don't accept dev-time traces | Accept structured evidence produced within tenant |
| End Users | Occasional "agent said something it shouldn't have" | Only says what it should, every statement traceable |

### 8.3 Business Benefits

| Benefit | Quantification |
|---|---|
| Compliance incident reduction | Target: 60% reduction in compliance incident rate within 12 months of Enterprise AI Assistant enabling |
| Agent launch cycle | Target: 50% reduction in launch review time |
| 3P developer Marketplace onboarding speed | Target: 40% reduction in time for 3P agents passing Gate to reach Marketplace |
| Customer trust in AI Assistant | Metric: 25% increase in agent activity within single tenant after enablement |

---

## 9. Risks and Mitigations

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Frequent false blocks, developers enable "log only" mode to bypass | Medium | High (feature becomes ineffective) | Adjust thresholds + provide "tiered strictness" (Block / Soft-block / Log only three levels) |
| Eval suite itself gets gamed (agent developers write "eval suites designed to pass") | Medium | Very High | Introduce "adversarial eval cases" + red team testing + suite divergence audit |
| Drift alert storms | Medium | Medium | Smart aggregation (group by root cause) + alert tiering |
| Cross-tenant DLP configuration differences are huge, eval suite always fails in small tenants | Medium | Medium | Suite tiering ("universal suite" + "tenant-customized suite") |
| Third-party agent developers perceive feature as "Microsoft ecosystem lock-in" | Low | Medium | Public commitment to 1P=3P + open eval standards + third-party participation in standards development |
| Evaluation itself introduces latency that degrades user experience | Low | High | Evaluation pre-fetches in parallel with response; P95 increment < 200ms |

---

## 10. Go-to-Market Path

### Phase 0: Internal Dogfood (90 days)
- Enable for all Enterprise AI Assistant first-party agents
- Internal compliance officers trial Evidence Pack
- Establish baseline with real internal traffic

### Phase 1: 3P Early Access (90 days)
- Invite 5-10 leading third-party developers to trial
- Collect "developer experience" feedback
- Adjust thresholds / human decision points

### Phase 2: GA + Marketplace Integration (30 days)
- Full GA, 1P=3P simultaneous opening
- Marketplace submission for 3P agents **must pass this feature's Gate** as a hard requirement
- Open eval standards + open evidence template

### Phase 3: Ecosystem Expansion (Ongoing)
- Support more evaluation types (multi-modal, code generation)
- Integration with Azure AI Model Platform model catalog
- Third-party evaluation providers can connect via MCP (contribute scoring functions, but Gate decisions remain within agentEvaluator core)

---

## 11. Appendix

### 11.1 Glossary

| Term | Explanation |
|---|---|
| **agentEvaluator** | Enterprise AI Assistant's enterprise work intelligence layer (core module) |
| **Conversation Entry** | Enterprise AI Assistant's conversational UI entry point |
| **Graph / Enterprise Data Access Layer** | Unified API layer for accessing Enterprise AI Assistant data (Mail/Docs/Teams/People) |
| **DLP Platform** | Enterprise compliance management platform, configures DLP / retention policies / classification |
| **DLP** | Data Loss Prevention, data leakage prevention rules |
| **Trust score** | AI Assistant's credibility score for answers (0-1), includes reference backlink verification |
| **Source scoping** | "Whether the sources used for this answer are all within the user's effective permission scope" |
| **Evidence Pack** | Structured compliance evidence produced by this feature |
| **Gate** | A "pass/intercept" decision point |
| **Drift** | Unexpected changes in agent behavior over time / model / tenant |

### 11.2 One-liner for Each Role

| Role | One-liner |
|---|---|
| **For Compliance** | "This is the signable compliance evidence hub produced internally within Enterprise AI Assistant." |
| **For Agent Developers** | "After your agent flips this switch, every response comes with compliance evidence and automatic drift alerts across model upgrades." |
| **For Tenant Administrators** | "One switch, all agents across the tenant automatically get gating and auditing." |
| **For End Users** | "The agent you're talking to is checked for errors before you see its response." |
| **For Microsoft Strategy** | "This is the Enterprise AI Assistant admission gate—the mandatory entry point for 3P agents entering Marketplace." |

### 11.3 Related Documents

- [Comparison with LangSmith / Braintrust / Azure AI Evaluation](#): See §5.3
- [Three Paths Where DLP Interception ≠ No Leakage](#): Hallucination completion / cross-source reasoning / real leakage, see attached document
- [North Star Metrics §6](#): Engineering implications of 5 trackable metrics

---

> **Core Promise of This PRD**: After enabling this feature, **your existing agent system upgrades simultaneously across four dimensions**—
> 1. Every response gains a "gate" (bad ones don't get through)
> 2. Every response gains "evidence" (can be signed off by compliance)
> 3. At any moment, you gain a "drift radar" (platform discovers before customers)
> 4. Team responsibility gains "explicit boundaries" (which 4 actions require human sign-off)
>
> **And none of this requires changing a single line of agent code.**