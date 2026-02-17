# OpenClaw Homelab — Claude Code Context

This repo is the OpenClaw source code. The **running homelab deployment** lives in a
separate agent-config repo at `/opt/homelab/data/home/git/openclaw-agents` (branch `main`).

---

## Homelab Deployment Quick Reference

| Item | Value |
|---|---|
| Running container | `homelab_openclaw-gateway_1` |
| Image | `registry.service.consul:8082/openclaw-homelab:2026.2.13` |
| Gateway port | `18789` (webchat UI at `http://localhost:18789`) |
| Agent config repo | `/opt/homelab/data/home/git/openclaw-agents` (branch `main`) |
| Agent config inside container | `/home/node/.openclaw/openclaw.json` (mounted from host) |
| Gateway management | `homelab/ctl.sh {up|down|restart|logs|ps|cli}` |

---

## Common Troubleshooting Commands

```bash
# Container status
podman ps | grep openclaw

# Follow live logs
podman logs -f homelab_openclaw-gateway_1 2>&1

# Filter for run events (tool calls, agent start/end)
podman logs -f homelab_openclaw-gateway_1 2>&1 | grep -E '"tool|agent.start|agent.end|exec'

# Plugin status
podman exec homelab_openclaw-gateway_1 node openclaw.mjs plugins list

# Model/provider probe (verifies auth + connectivity)
podman exec homelab_openclaw-gateway_1 node openclaw.mjs models status --agent jerry --probe --probe-provider zai

# Agent list
podman exec homelab_openclaw-gateway_1 node openclaw.mjs agents list

# Config validation
podman exec homelab_openclaw-gateway_1 node openclaw.mjs models status --agent jerry
```

---

## Known Issues & Fixes

### ZAI Provider: Use `anthropic-messages`, not `openai-completions`

**Symptom:** Jerry responds conversationally but never calls any tools. Gateway logs show
runs completing in 3–6 seconds with zero tool-execution events between `agent.start` and
`agent.end`. Jerry hallucinates tool names like `grep`, `find`, `ls`.

**Root cause:** The ZAI Coding Plan endpoint (`https://api.z.ai/api/coding/paas/v4`) does
not return structured tool calls in OpenAI function-calling format. The model emits text
*describing* tool calls instead of structured JSON.

**Fix:** Use ZAI's Anthropic-compatible endpoint with `api: "anthropic-messages"`:

```json
"zai": {
  "baseUrl": "https://api.z.ai/api/anthropic",
  "api": "anthropic-messages",
  "models": [...]
}
```

The Anthropic Messages API has robust tool-use support and ZAI implements it correctly.
Probe confirms ~15s first-call latency (normal for GLM cold start).

**Where:** `openclaw-agents/jerry/openclaw.json` → `models.providers.zai`

---

### Agent Tool Config: Use `alsoAllow`, not `allow`

**Symptom:** Agent has `profile: "coding"` set but cannot call `exec`, `read`, `write`,
`session_status`, or any coding tools. Only the explicitly listed extras work.

**Root cause:** `tools.allow` creates a **strict allowlist** that *replaces* the profile's
tools. If `allow: ["group:web", "message", "agents_list"]` is set, those are the *only*
tools available — the entire coding profile (exec, read, write, session_status, etc.) is
filtered out.

**Fix:** Use `alsoAllow` to *add* tools on top of the profile without restricting it:

```json
"tools": {
  "profile": "coding",
  "alsoAllow": ["group:web", "message", "agents_list"],
  "deny": [...]
}
```

`alsoAllow` is additive. `allow` is a strict replacement. When using a named profile,
almost always use `alsoAllow` for extras.

**Where:** `openclaw-agents/jerry/openclaw.json` → `agents.list[*].tools`

---

## Tool Groups Reference

From `src/agents/tool-policy.ts`:

| Group | Expands to |
|---|---|
| `group:fs` | `read, write, edit, apply_patch` |
| `group:runtime` | `exec, process` |
| `group:sessions` | `sessions_list, sessions_history, sessions_send, sessions_spawn, session_status` |
| `group:memory` | `memory_search, memory_get` |
| `group:web` | `web_search, web_fetch` |
| `group:messaging` | `message` |
| `group:ui` | `browser, canvas` |
| `group:automation` | `cron, gateway` |

**`coding` profile** allows: `group:fs + group:runtime + group:sessions + group:memory + image`

---

## Provider Config: Anthropic Messages API

When adding any provider that has an Anthropic-compatible endpoint, use:

```json
{
  "baseUrl": "https://api.example.com/anthropic",
  "api": "anthropic-messages",
  "models": [...]
}
```

The `anthropic-messages` adapter automatically handles:
- Structured tool calls (Anthropic `tool_use` blocks)
- Tool result pairing validation
- Thinking blocks (for reasoning models)
- Transcript sanitization appropriate for Anthropic format

Existing providers using this pattern: `minimax` (`https://api.minimax.io/anthropic`),
`xiaomi` (`https://api.xiaomimimo.com/anthropic`), ZAI (`https://api.z.ai/api/anthropic`).

---

## Plugin Persistence

Plugins enabled via `openclaw plugins enable <id>` write to
`/home/node/.openclaw/openclaw.json` inside the container. If that path is a **bind
mount** from the host (which it is in the Podman compose setup), the change persists
across restarts. Verify with:

```bash
podman exec homelab_openclaw-gateway_1 node openclaw.mjs plugins list
# memory-core should show "loaded"
```

If a plugin shows `disabled` after restart, the container may be reading a different
config file than expected. Check the volume mount with:

```bash
podman inspect homelab_openclaw-gateway_1 | python3 -c "
import json,sys; d=json.load(sys.stdin)
[print(m['Source'],'->', m['Destination']) for m in d[0]['Mounts']]
"
```

---

## Hot-Reload

Changes to `models.providers.*` in `openclaw.json` are picked up without a gateway
restart (hot-reload is active). Changes to `agents.list[*].tools` or `plugins.*`
require a restart:

```bash
./homelab/ctl.sh restart
```
