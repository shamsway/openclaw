# GLM Latency Research & Session Summary (2026-02-25)

## Changes Applied This Session

| Change | Details |
|---|---|
| `gateway.bind: "custom"` | Fixes callGateway hairpin NAT in Nomad CNI — loopback IPC instead of CNI IP |
| `discovery.mdns.mode: "off"` | Bonjour disabled — no utility in Nomad container, eliminates log noise |
| OTel endpoint → `otel-collector:4328` | Traces now routed through OTel Collector instead of direct to Tempo |
| Billy daily summary `bestEffort: true` | Recreated job `766315ce`; cleared `consecutiveErrors: 3` error state |
| `openclaw-agents` committed | `main` branch — config in sync with live Ceph mount |
| `openclaw` docs committed | `feature/podman-homelab-deployment` — v3.3 changelog + NETWORKING.md |

---

## Outstanding Issue: Cron Announce Delivery Timeout

**Symptom:** `cron list` shows `ok` (with `bestEffort: true`) but Discord announcements from
Bobby heartbeat and Billy daily summary never arrive.

**Root cause:** `callGateway` in `src/agents/subagent-announce.ts` uses a hardcoded
`timeoutMs: 15_000` for the announce IPC call. This triggers an agent session with an LLM
call. GLM-4.7 via ZAI takes ~28s from first token — consistently exceeding the 15s window.

**Evidence:** "No reply from agent" log entry appears ~13s after "cron announce delivery
failed", placing the total LLM round-trip at ~28s.

**Fix options:**
1. **Code change (new image):** Raise the hardcoded timeout in `subagent-announce.ts` to
   60s. Cleanest fix; requires building and deploying a new image.
2. **Faster model:** Switch to GLM Flash for the announce session. Requires benchmarking
   (see below) to confirm it fits within 15s and maintains acceptable quality.

**Current mitigation:** All three cron jobs use `bestEffort: true` — delivery failures are
logged but don't flip job status to `error`.

---

## GLM Model Latency Research Plan

### Goal

Determine whether GLM Flash variants can complete the announce session within the 15s
`callGateway` timeout, and whether their output quality is acceptable for Bobby heartbeat
summaries and Billy daily reports.

### Models to Benchmark

| Model | Config ID | Expected latency | Notes |
|---|---|---|---|
| GLM-4.7 (current) | `zai/glm-4.7` | ~28s first call | Full quality, reasoning |
| GLM-4.7 Flash | `zai/glm-4.7-flash` | TBD | Faster, same training data |
| GLM-4.7 FlashX | `zai/glm-4.7-flashx` | TBD | Fastest variant |

All three are already declared in `openclaw.json` under `models.providers.zai.models`.

### Step 1 — OTel Baseline

Traces now flow through `otel-collector.service.consul:4328`. After the next few Bobby
heartbeat runs, open Grafana → Explore → Tempo and search `serviceName=openclaw-gateway`.
Look for LLM call duration spans in Bobby cron runs to get cold/warm latency baselines.

```
Service: openclaw-gateway
Tags:    job.id = 9cde3800-ec6f-4d9f-a30f-ff0a4b9c7bc3   (Bobby heartbeat)
```

### Step 2 — Model Probe

Run latency probes from inside the container for each ZAI model variant:

```bash
ALLOC=$(nomad job status openclaw-gateway | grep ' run ' | awk '{print $1}')

# Probe all ZAI models (reports first-token latency per model)
nomad alloc exec $ALLOC sh -c \
  'node /app/openclaw.mjs models status --agent bobby --probe --probe-provider zai'
```

Record cold-start and warm latency for `glm-4.7`, `glm-4.7-flash`, and `glm-4.7-flashx`.

### Step 3 — Flash Canary Test

If Flash probe shows first-token latency <12s (leaving 3s margin), temporarily switch
Bobby's model:

In `openclaw-agents/jerry/openclaw.json`, add a per-agent model override for Bobby:

```json
{
  "id": "bobby",
  "model": {
    "primary": "zai/glm-4.7-flash"
  },
  ...
}
```

Sync to live config, restart gateway, observe 2–3 heartbeat cycles (runs at `*/15 * * * *`):

```bash
# Watch for delivery success
ALLOC=$(nomad job status openclaw-gateway | grep ' run ' | awk '{print $1}')
nomad alloc exec $ALLOC sh -c 'node /app/openclaw.mjs cron list'
# Bobby heartbeat should show "ok" AND Discord #bobby should receive the message
```

Also inspect summary quality in Discord `#bobby` — confirm the Flash model produces
complete, accurate infrastructure health reports (not truncated or degraded).

### Step 4 — Decision

| Outcome | Action |
|---|---|
| Flash <15s AND quality acceptable | Switch Bobby (and Billy) to `glm-4.7-flash` permanently |
| Flash <15s BUT quality degraded | Use Flash for Billy daily summary; keep GLM-4.7 for Bobby heartbeat |
| Flash still >15s | Plan code change: raise `callGateway` timeout to 60s in `subagent-announce.ts`, build new image |

### OTel Collector Verification

After the gateway restart that applied the new OTel endpoint, verify traces are flowing:

```bash
# Health check (should return 200 with {"status":"Server available"} or similar)
curl http://192.168.252.7:13133/

# In Grafana: Explore → Tempo → Search → Service Name: openclaw-gateway
# Should see spans from Bobby heartbeat cron runs
```

The OTel collector uses non-standard ports (`4327` gRPC, `4328` HTTP) to avoid collision
with Tempo which occupies the standard `4317`/`4318`. The HTTP endpoint is registered as
a static port in the Nomad job, so `otel-collector.service.consul:4328` is reliable even
across allocation restarts.
