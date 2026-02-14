# OpenClaw Agent Rate Limiting Design

**Date:** 2026-02-14
**Status:** Draft
**Context:** Multi-agent gateway deployment needs rate limiting to prevent overwhelming local models and manage API costs across multiple concurrent agents

---

## Overview

This design establishes a tiered rate limiting system for OpenClaw gateway agents to:
- Protect local/self-hosted model endpoints from overload
- Manage API costs for cloud providers
- Allow different agents to have different priorities and quotas
- Provide visibility into usage patterns

The approach builds on OpenClaw's existing concurrency controls and queue system, adding request/token budgets and time-windowed rate limits.

---

## Requirements

**Deployment context:**
- Single gateway host, multiple agents (different identities, workspaces, purposes)
- Mix of local models (Ollama, LM Studio) and cloud APIs (Anthropic, OpenAI, etc.)
- Different agents have different priorities (interactive vs background, critical vs experimental)

**Protection goals:**
- Prevent overwhelming local model endpoints (requests/minute, concurrent requests)
- Control cloud API spend (tokens/day, requests/hour)
- Allow burst traffic for interactive agents while throttling background jobs
- Per-agent budgets to prevent runaway loops or expensive mistakes

**Visibility:**
- Track usage by agent (requests, tokens, costs)
- Alert when approaching limits
- Surface current usage in `/status` and gateway UI

---

## Existing Foundation

OpenClaw already has several building blocks:

1. **Concurrency limits** (`src/config/agent-limits.ts`):
   - `agents.defaults.maxConcurrent` (default: 4) — global main lane parallelism
   - `agents.defaults.subagents.maxConcurrent` (default: 8) — subagent lane parallelism
   - Per-session lanes guarantee single-run-per-session

2. **Queue system** (`docs/concepts/queue.md`):
   - Lane-aware FIFO with configurable concurrency caps
   - Message debouncing and cap limits
   - Overflow policies (old/new/summarize)

3. **Usage tracking** (`docs/concepts/usage-tracking.md`):
   - Provider usage endpoints (OAuth)
   - Session token tracking
   - Cost estimation from pricing config

4. **Retry policies** (`src/infra/retry-policy.ts`):
   - Exponential backoff for rate limit errors (429)
   - Provider-specific retry-after handling

**What's missing:**
- Proactive rate limiting (prevent requests vs react to 429s)
- Token/cost budgets per time window
- Per-agent quotas
- Multi-dimensional limits (requests AND tokens)

---

## Design: Tiered Rate Limit Profiles

### Approach

Define reusable **rate limit profiles** that agents can reference. Each profile specifies:
- Request limits (per minute, per hour, per day)
- Token limits (per request, per hour, per day)
- Cost limits (per day, per month) — optional, requires pricing config
- Concurrency overrides (max concurrent for this agent)

Agents can inherit from a tier or override specific limits. Enforcement happens at queue enqueue time and before each model request.

### Configuration Structure

```json5
// ~/.openclaw/openclaw.json
{
  agents: {
    // Global rate limit tiers (reusable profiles)
    rateLimits: {
      tiers: {
        // Tier 1: Interactive/High-Priority
        "interactive": {
          requests: {
            perMinute: 30,
            perHour: 500,
            perDay: 2000,
          },
          tokens: {
            perRequest: 200000,    // max input+output per request
            perHour: 2000000,      // 2M tokens/hour
            perDay: 10000000,      // 10M tokens/day
          },
          cost: {
            perDay: 5.00,          // $5/day (USD)
            perMonth: 100.00,      // $100/month
          },
          concurrency: {
            max: 2,                // max 2 concurrent runs for this agent
          },
        },

        // Tier 2: Standard/Background
        "standard": {
          requests: {
            perMinute: 10,
            perHour: 200,
            perDay: 1000,
          },
          tokens: {
            perRequest: 100000,
            perHour: 500000,
            perDay: 3000000,
          },
          cost: {
            perDay: 2.00,
            perMonth: 40.00,
          },
          concurrency: {
            max: 1,
          },
        },

        // Tier 3: Experimental/Low-Priority
        "experimental": {
          requests: {
            perMinute: 5,
            perHour: 50,
            perDay: 200,
          },
          tokens: {
            perRequest: 50000,
            perHour: 100000,
            perDay: 500000,
          },
          cost: {
            perDay: 0.50,
            perMonth: 10.00,
          },
          concurrency: {
            max: 1,
          },
        },

        // Tier 4: Local Models (high throughput, low cost)
        "local": {
          requests: {
            perMinute: 60,         // higher RPM for local
            perHour: 1000,
            perDay: 5000,
          },
          tokens: {
            perRequest: 128000,    // typical local context window
            perHour: 5000000,
            perDay: 20000000,
          },
          // No cost limits for local models
          concurrency: {
            max: 2,                // protect local endpoint
          },
        },

        // Tier 5: Unrestricted (opt-in for trusted agents)
        "unrestricted": {
          // No limits (all fields optional/omitted)
        },
      },

      // Provider-specific overrides (applied on top of agent tier)
      providers: {
        "ollama/llama3:8b": {
          requests: {
            perMinute: 30,         // protect local Ollama
          },
          concurrency: {
            max: 4,                // allow more concurrency for fast local model
          },
        },
        "anthropic/claude-opus-4-6": {
          tokens: {
            perRequest: 200000,    // enforce Opus context limit
          },
          cost: {
            perDay: 10.00,         // higher budget for Opus
          },
        },
      },
    },

    // Per-agent configuration
    list: [
      {
        id: "main",
        name: "Main Assistant",
        rateLimit: "interactive",  // reference a tier by name
      },
      {
        id: "research",
        name: "Research Agent",
        rateLimit: "standard",
      },
      {
        id: "cron-digest",
        name: "Daily Digest",
        rateLimit: "experimental",
      },
      {
        id: "local-helper",
        name: "Local Model Helper",
        rateLimit: "local",
      },
      {
        id: "admin",
        name: "Admin Agent",
        rateLimit: {
          // Inline custom limits (overrides tier)
          tier: "interactive",
          requests: {
            perMinute: 60,         // override just this field
          },
        },
      },
    ],
  },
}
```

### Rate Limit Fields Reference

Each tier supports these optional fields:

```typescript
type RateLimitTier = {
  // Request limits (count-based)
  requests?: {
    perMinute?: number;
    perHour?: number;
    perDay?: number;
  };

  // Token limits (usage-based)
  tokens?: {
    perRequest?: number;     // max input+output tokens per request
    perHour?: number;
    perDay?: number;
  };

  // Cost limits (requires pricing config)
  cost?: {
    perDay?: number;         // USD
    perMonth?: number;       // USD
  };

  // Concurrency override
  concurrency?: {
    max?: number;            // max concurrent runs for this agent
  };

  // Burst allowance (optional)
  burst?: {
    requests?: number;       // allow N extra requests in short window
    tokens?: number;         // allow N extra tokens in short window
    windowSeconds?: number;  // burst window duration (default: 60)
  };
};

type AgentRateLimit =
  | string                   // reference a tier name
  | {
      tier?: string;         // inherit from tier, then override
      requests?: { ... };
      tokens?: { ... };
      cost?: { ... };
      concurrency?: { ... };
      burst?: { ... };
    };
```

---

## Enforcement Strategy

### 1. Queue Enqueue Phase

When a message arrives:

1. Check agent's rate limit tier
2. Query current usage from in-memory counters (see Storage section)
3. If any limit exceeded:
   - Reject enqueue with user-facing error
   - Log rate limit event
   - Surface in `/status` and gateway UI
4. If burst allowance available, allow and decrement burst budget
5. Otherwise enqueue normally

### 2. Pre-Request Phase

Before calling the model:

1. Check request count limits (perMinute/perHour/perDay)
2. Estimate token usage (from context + max_tokens)
3. Check token limits (perRequest/perHour/perDay)
4. Check cost limits if pricing config available
5. If any limit exceeded:
   - Return synthetic error to agent (don't call model)
   - Suggest `/status` for current usage
   - Log rate limit event

### 3. Post-Request Phase

After model response:

1. Record actual usage (requests, input/output tokens, cost)
2. Update in-memory counters
3. Append to agent usage log (rolling daily/monthly files)
4. Update burst budget if applicable

### 4. Cleanup Phase

Background task (every 60s):

1. Roll over expired time windows (minute/hour/day/month)
2. Reset burst allowances
3. Trim old usage logs
4. Emit usage summary to gateway logs

---

## Storage & Counters

### In-Memory State

Keep a rolling window of usage counters per agent:

```typescript
type AgentUsageCounters = {
  agentId: string;
  current: {
    minute: { requests: number; tokens: number; cost: number; windowStart: Date };
    hour: { requests: number; tokens: number; cost: number; windowStart: Date };
    day: { requests: number; tokens: number; cost: number; windowStart: Date };
    month: { requests: number; tokens: number; cost: number; windowStart: Date };
  };
  burst: {
    available: { requests: number; tokens: number };
    resetAt: Date;
  };
};
```

In-memory state is sufficient for a single gateway process. For multi-gateway deployments (future), migrate to Redis or shared storage.

### Persistent Logs

Append-only usage logs per agent:

```
~/.openclaw/agents/<agentId>/usage/
  2026-02-14.jsonl        # daily usage log
  2026-02.jsonl           # monthly rollup (created at month end)
```

Each line:

```jsonl
{"ts":"2026-02-14T10:30:00Z","req":1,"in":5000,"out":2000,"cost":0.05,"model":"anthropic/claude-opus-4-6","session":"..."}
```

These logs power:
- `/usage cost` command
- Historical usage analysis
- Debugging rate limit triggers

---

## User-Facing Surfaces

### 1. `/status` Enhancement

Add rate limit section to `/status` output:

```
Agent: main (interactive tier)
Rate Limits:
  Requests: 12/30 per minute, 145/500 per hour, 823/2000 per day
  Tokens: 1.2M/2M per hour, 5.8M/10M per day
  Cost: $2.34/$5.00 per day, $45.67/$100.00 per month
  Burst: 5 requests, 50K tokens available
```

### 2. Rate Limit Error Messages

When a limit is hit:

```
Rate limit exceeded for agent 'research' (standard tier):
  • Daily request limit: 1000/1000
  • Next reset: in 4h 23m

Use /status to see current usage, or wait for the window to reset.
```

### 3. CLI Commands

```bash
# Show usage for all agents
openclaw agents usage

# Show usage for specific agent
openclaw agents usage --agent main

# Show rate limit config
openclaw agents rate-limits

# Test a hypothetical request (dry-run)
openclaw agents rate-limits check --agent main --tokens 50000
```

### 4. Gateway UI

Add to Control UI:
- Rate limit dashboard (usage by agent, time series charts)
- Alert indicators when approaching limits
- Per-agent usage breakdown
- Rate limit tier editor (form view)

---

## Provider-Specific Considerations

### Local Models (Ollama, LM Studio, vLLM)

- Focus on **request rate** limits (protect endpoint from overload)
- Higher RPM than cloud APIs
- Concurrency limits more important than token budgets
- No cost tracking

**Recommended tier:** `local`

### Cloud APIs (Anthropic, OpenAI, Google)

- Focus on **token** and **cost** limits
- Request rate limits typically handled by provider (retry on 429)
- Track cost per day/month to avoid surprises
- Consider burst allowances for interactive agents

**Recommended tiers:** `interactive`, `standard`, `experimental`

### Hybrid Deployments

Mix local and cloud models by:
1. Setting provider-specific overrides
2. Using different tiers for different agents
3. Routing low-priority requests to local models

Example:

```json5
{
  agents: {
    list: [
      {
        id: "main",
        model: "anthropic/claude-opus-4-6",
        rateLimit: "interactive",  // high budget for cloud
      },
      {
        id: "background",
        model: "ollama/llama3:8b",
        rateLimit: "local",        // protect local endpoint
      },
    ],
  },
}
```

---

## Migration & Rollout

### Phase 1: Observability (no enforcement)

1. Add usage tracking and logging
2. Surface current usage in `/status`
3. Log hypothetical rate limit violations
4. Gather baseline usage data

**Changes:**
- New config schema (opt-in, no defaults)
- In-memory counters + persistent logs
- `/status` enhancement
- CLI `openclaw agents usage` command

**No breaking changes** — rate limits are purely advisory.

### Phase 2: Soft Limits (warnings)

1. Enable enforcement but only emit warnings
2. User-facing messages when limits approached
3. Refine tier defaults based on real usage

**Changes:**
- Warning messages in chat
- Gateway logs for violations
- Dashboard alerts

**Still no hard blocks** — agents continue to run.

### Phase 3: Hard Limits (enforcement)

1. Enable hard enforcement (configurable per tier)
2. Reject requests that exceed limits
3. Document escape hatches (`unrestricted` tier)

**Changes:**
- Request rejection at queue enqueue
- Synthetic error responses
- User must adjust config or wait for reset

**Breaking change for existing users** — add migration warning in Doctor.

---

## Configuration Defaults

If no rate limit config is provided, use these safe defaults:

```json5
{
  agents: {
    rateLimits: {
      tiers: {
        "default": {
          requests: {
            perMinute: 20,
            perHour: 300,
            perDay: 1500,
          },
          tokens: {
            perRequest: 128000,
            perHour: 1000000,
            perDay: 5000000,
          },
          concurrency: {
            max: 2,
          },
        },
      },
    },
    // All agents default to "default" tier unless specified
  },
}
```

This protects against runaway loops while allowing normal interactive use.

---

## Alternative Approaches Considered

### 1. Global Limits Only (No Per-Agent Tiers)

**Pros:** Simpler config, easier to reason about
**Cons:** Can't prioritize agents, background jobs compete with interactive
**Decision:** Rejected — multi-agent deployments need differentiation

### 2. Token Buckets per Provider (Not Per Agent)

**Pros:** Protects provider endpoint globally
**Cons:** One agent can starve others
**Decision:** Use both — provider overrides + per-agent tiers

### 3. Dynamic Limits Based on History

**Pros:** Automatically adapts to usage patterns
**Cons:** Complex to implement, hard to predict
**Decision:** Deferred — start with static tiers, add ML later if needed

### 4. External Rate Limiter (Redis + Lua Scripts)

**Pros:** Works across multiple gateway processes
**Cons:** Adds dependency, overkill for single-gateway
**Decision:** Start with in-memory, migrate to Redis if multi-gateway becomes common

---

## Open Questions

1. **Burst behavior:** Should burst budget replenish gradually (token bucket) or all-at-once after window expires?
   **Recommendation:** All-at-once is simpler; use `burst.windowSeconds` to tune.

2. **Cost tracking for OAuth profiles:** Usage endpoints don't expose cost.
   **Recommendation:** Track tokens only for OAuth, estimate cost client-side from pricing config (best-effort).

3. **Subagent budgets:** Should subagents share parent agent's budget or have independent limits?
   **Recommendation:** Independent limits (subagent tier), but count toward parent's global concurrency.

4. **Grace period after limit hit:** Allow N more requests before hard block?
   **Recommendation:** No grace period (use burst budget instead). Clear boundaries are safer.

5. **Per-model limits vs per-agent limits:** Should agents using the same model share a quota?
   **Recommendation:** Per-agent is primary (isolation), provider overrides are secondary (protect endpoint).

---

## Testing Strategy

### Unit Tests

- Token/request counter rollover logic
- Tier inheritance and override merging
- Limit enforcement (enqueue phase, pre-request phase)
- Burst budget replenishment

### Integration Tests

- Rate limit exceeded → synthetic error
- Burst allowance → temporary overages allowed
- Multi-agent scenarios (different tiers)
- Cost tracking with pricing config

### Load Tests

- Concurrent requests from multiple agents
- Counter accuracy under high load
- Time window rollover accuracy

### Live Tests (Manual)

- Deploy with observability-only mode
- Collect baseline usage data
- Validate tier recommendations
- Test user-facing error messages

---

## Documentation Plan

### New Docs

- `docs/gateway/rate-limiting.md` — comprehensive guide (user-facing)
- `docs/reference/rate-limit-tiers.md` — tier examples and recommendations
- Update `docs/gateway/configuration.md` — add rate limit section
- Update `docs/concepts/usage-tracking.md` — tie to rate limits

### Inline Help

- `openclaw agents rate-limits --help`
- `openclaw agents usage --help`
- `/status` inline explanation (collapsible)

### Examples

- Add rate limit config to `docs/gateway/configuration-examples.md`
- Per-agent tier examples for common patterns:
  - Interactive + background agents
  - Local + cloud hybrid
  - Cost-sensitive deployments

---

## Success Metrics

### Phase 1 (Observability)

- [ ] Usage data collected for all agents
- [ ] Baseline usage patterns documented
- [ ] Tier defaults validated against real usage
- [ ] No performance impact on gateway (<5ms overhead)

### Phase 2 (Soft Limits)

- [ ] Warning messages surfaced in chat
- [ ] Dashboard shows approaching limits
- [ ] User feedback on tier defaults

### Phase 3 (Hard Limits)

- [ ] Rate limit rejections work as expected
- [ ] No false positives (limits not too aggressive)
- [ ] Users can adjust tiers without gateway restart (via `config.patch`)
- [ ] Cost overruns prevented (if pricing config exists)

---

## Timeline Estimate

**Phase 1 (Observability):**
Implementation: 2-3 days
Testing: 1 day
Documentation: 1 day
Total: ~5 days

**Phase 2 (Soft Limits):**
Implementation: 1 day
Testing: 1 day
Documentation: 0.5 days
Total: ~2.5 days

**Phase 3 (Hard Limits):**
Implementation: 1 day
Testing: 1 day
User feedback cycle: 1 week (async)
Documentation: 0.5 days
Total: ~2.5 days + 1 week feedback

**Overall:** ~2-3 weeks with user feedback cycles.

---

## Next Steps

1. Review this design with Peter
2. Refine tier defaults based on feedback
3. Implement Phase 1 (observability-only)
4. Deploy to exe.dev VMs for baseline data collection
5. Iterate on tier defaults
6. Proceed to Phase 2/3 based on data

---

## Appendix: Example Tier Recommendations

### Academic Research Agent

```json5
{
  rateLimit: {
    tier: "standard",
    tokens: {
      perRequest: 200000,  // allow long research papers
      perDay: 5000000,
    },
  },
}
```

### Social Media Bot (High Volume)

```json5
{
  rateLimit: {
    tier: "interactive",
    requests: {
      perMinute: 60,       // handle bursts
      perHour: 1000,
    },
    model: "ollama/llama3:8b",  // use local model to save cost
  },
}
```

### Daily Digest Cron Job

```json5
{
  rateLimit: {
    tier: "experimental",
    requests: {
      perDay: 10,          // runs once per day
    },
    tokens: {
      perRequest: 100000,
    },
  },
}
```

### Development/Testing Agent

```json5
{
  rateLimit: "unrestricted",  // no limits during development
}
```

### Cost-Sensitive Deployment

```json5
{
  rateLimit: {
    tier: "standard",
    cost: {
      perDay: 1.00,        // strict budget
      perMonth: 20.00,
    },
  },
}
```
