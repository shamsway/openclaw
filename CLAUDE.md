# OpenClaw Homelab — Claude Code Context

This repo is the OpenClaw source code. The **running homelab deployment** lives in a
separate agent-config repo at `/opt/homelab/data/home/git/openclaw-agents` (branch `main`).

> **Agent files are NOT in this repo.**
> Workspace files (TOOLS.md, SOUL.md, IDENTITY.md, etc.) and `openclaw.json` for
> Jerry, Bobby, and Billy live exclusively in `../openclaw-agents/<agent>/`.
> The `homelab/jerry/`, `homelab/bobby/`, `homelab/billy/` directories have been
> removed. Do not recreate them here.

---

## Homelab Deployment Quick Reference

| Item | Value |
|---|---|
| Running container | `homelab_openclaw-gateway_1` |
| Image | `registry.service.consul:8082/openclaw-homelab:2026.2.16` |
| Gateway port | `18789` (webchat UI at `http://localhost:18789`) |
| Agent config repo | `/opt/homelab/data/home/git/openclaw-agents` (branch `main`) |
| Agent workspace files | `../openclaw-agents/<agent>/workspace/` (TOOLS.md, SOUL.md, etc.) |
| Agent config inside container | `/home/node/.openclaw/openclaw.json` (mounted from host) |
| mcporter config (persisted) | `../openclaw-agents/jerry/mcporter.json` → `/root/.mcporter/mcporter.json` |
| Gateway management | `homelab/ctl.sh {up|down|restart|logs|ps|cli}` |
| DNS reference | `homelab/NETWORKING.md` |

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

## Cron Command Reference

```bash
# List all cron jobs with status and next/last run times
podman exec homelab_openclaw-gateway_1 node openclaw.mjs cron list

# Show run history for a job (--id required)
podman exec homelab_openclaw-gateway_1 node openclaw.mjs cron runs --id <job-id>

# Trigger a job immediately (debug mode — bypasses schedule)
podman exec homelab_openclaw-gateway_1 node openclaw.mjs cron run <job-id>

# Add a repeating job:
#   --cron       5-field cron expression (*/15 * * * *)
#   --agent      agent ID (bobby, billy, jerry)
#   --announce   post summary to a channel when done
#   --channel    channel name (discord, slack)
#   --to         delivery target: "channel:<id>" or "user:<id>"
#   --session    isolated (default for cron) or main
#   --wake       now (resume/create immediately) or next-heartbeat
#   --best-effort-deliver  don't mark job as error if Discord/Slack delivery fails
podman exec homelab_openclaw-gateway_1 node openclaw.mjs cron add \
  --name "Bobby heartbeat" \
  --cron "*/15 * * * *" \
  --agent bobby \
  --announce --channel discord --to "channel:1472975617111625902" \
  --session isolated --wake now \
  --best-effort-deliver \
  --message "Run your full heartbeat checklist from HEARTBEAT.md..."

# Edit an existing job (patch specific fields)
podman exec homelab_openclaw-gateway_1 node openclaw.mjs cron edit --id <job-id> \
  --name "New name"

# Disable/enable/remove
podman exec homelab_openclaw-gateway_1 node openclaw.mjs cron disable <job-id>
podman exec homelab_openclaw-gateway_1 node openclaw.mjs cron enable <job-id>
podman exec homelab_openclaw-gateway_1 node openclaw.mjs cron rm <job-id>

# View scheduler status
podman exec homelab_openclaw-gateway_1 node openclaw.mjs cron status
```

**Cron run history lives at:** `openclaw-agents/jerry/cron/runs/<job-id>.jsonl`
Each entry contains `status`, `error`, `summary`, `usage` (token counts), and `sessionId`.

**Cron jobs file:** `openclaw-agents/jerry/cron/jobs.json`
The `state.consecutiveErrors` counter indicates how many consecutive failures a job has.

---

## MCP Server Management (mcporter)

### Verifying MCP servers from inside the container

```bash
# List tools for a specific MCP server (use --allow-http for internal HTTP endpoints)
podman exec homelab_openclaw-gateway_1 \
  mcporter list --http-url http://192.168.252.8:30859/mcp --allow-http --name mcp-nomad-server

# Test all configured MCP servers (reads /root/.mcporter/mcporter.json)
podman exec homelab_openclaw-gateway_1 cat /root/.mcporter/mcporter.json

# Call an MCP tool directly (useful for debugging)
podman exec homelab_openclaw-gateway_1 \
  mcporter call 'http://192.168.252.8:30859/mcp.list_jobs()' --allow-http

# GCP VM status check (useful for Phil keeper debugging)
podman exec homelab_openclaw-gateway_1 \
  mcporter call 'http://gcp-mcp-server.service.consul:22241/mcp.list_vms(project_id:"octant-426722", zone:"us-central1-a")' --allow-http

# GCP VM start (Phil keeper — use when Phil is TERMINATED)
podman exec homelab_openclaw-gateway_1 \
  mcporter call 'http://gcp-mcp-server.service.consul:22241/mcp.start_vm(instance_name:"phil", project_id:"octant-426722", zone:"us-central1-a")' --allow-http

# Tailscale device list
podman exec homelab_openclaw-gateway_1 \
  mcporter call 'http://192.168.252.6:29178/mcp.list_devices()' --allow-http
```

### Persisting mcporter config (avoiding image rebuilds)

The mcporter config is mounted into the container from the agent config repo:

```
openclaw-agents/jerry/mcporter.json → /root/.mcporter/mcporter.json (via volume mount)
```

The source of truth for MCP server URLs is `homelab/.mcp.json`. When you add or
change an MCP server there, regenerate `jerry/mcporter.json`:

```bash
jq '{mcpServers:(.mcpServers|to_entries|map({key,value:{baseUrl:.value.url}})|from_entries)}' \
  homelab/.mcp.json > ../openclaw-agents/jerry/mcporter.json
```

Then restart the container to pick up the change:
```bash
./homelab/ctl.sh restart
```

If you need to patch the running container without a restart (e.g. for a quick fix):
```bash
# Generate correct file and copy into container
jq '{mcpServers:(.mcpServers|to_entries|map({key,value:{baseUrl:.value.url}})|from_entries)}' \
  homelab/.mcp.json > /tmp/mcporter-new.json
podman cp /tmp/mcporter-new.json homelab_openclaw-gateway_1:/root/.mcporter/mcporter.json
# NOTE: this is ephemeral — update jerry/mcporter.json for persistence
```

**The Dockerfile still generates mcporter.json at build time from `.mcp.json`** (as a
fallback when no volume is mounted). Keep both in sync.

---

## Container Config Persistence

Files that live in the container image but need to survive restarts are mounted as
volumes from `openclaw-agents/jerry/`. Current persistent overrides:

| Container path | Host path | Purpose |
|---|---|---|
| `/home/node/.openclaw/` | `openclaw-agents/jerry/` | All agent config, sessions, cron |
| `/home/node/.openclaw/workspace` | `openclaw-agents/jerry/workspace/` | Jerry workspace files |
| `/home/node/.openclaw/workspace-bobby` | `openclaw-agents/bobby/workspace/` | Bobby workspace |
| `/home/node/.openclaw/workspace-billy` | `openclaw-agents/billy/workspace/` | Billy workspace |
| `/root/.mcporter/mcporter.json` | `openclaw-agents/jerry/mcporter.json` | MCP server URLs |

When adding a new baked-in config that needs to persist: create the file in the
appropriate `openclaw-agents/<agent>/` directory and add a volume mount in
`homelab/docker-compose.yml`.

---

## Consul DNS (Container Networking)

Consul DNS works natively inside the container via:
```
container → aardvark-dns (10.89.2.1) → host dnsmasq → Consul :8600
```

No `extra_hosts` or workarounds required. See `homelab/NETWORKING.md` for full details,
verification commands, and the Podman 5.x migration path.

Quick verify:
```bash
podman exec homelab_openclaw-gateway_1 nslookup nomad.service.consul
# Should return 2-3 IP addresses
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

### `sessionRetention` Does NOT Rotate Cron Sessions

**What it actually does:** `sessionRetention` (in `cron` config block) is a **TTL for
deleting old run records** from the session store after they expire. It is NOT a session
rotation interval. Source: `src/cron/session-reaper.ts`.

**What controls session rotation:** The global `session.reset` config. Default: `"daily"`
at **4:00 AM UTC**. A cron session is reused across runs until the session's `updatedAt`
falls before the last 4 AM reset — i.e., sessions run for up to ~24 hours before
auto-rotating. There is no per-job override.

**Consequence:** Isolated cron sessions accumulate indefinitely within the 24h daily window.
Bobby's session ran for 18+ hours (1136 messages) before degrading — `sessionRetention: "6h"`
had no effect on rotation.

**Fix:** Use Billy's `Billy: Bobby session reset` cron job (`0 */12 * * *`) to explicitly
rm+re-add Bobby's heartbeat job every 12 hours. See `openclaw-agents/billy/workspace/MAINTENANCE.md`.

**Alternative (untested):** Add `session.reset.idleMinutes: 360` to `openclaw.json` to
reset any session idle for 6+ hours. This applies globally to all sessions — test carefully.

---

### Cron Jobs Showing `error` with "cron announce delivery failed"

**Symptom:** `cron list` shows `error` status and `consecutiveErrors > 0`. The run JSONL
shows complete, valid summaries — only the Discord/Slack delivery step failed.

**Root cause:** Transient Discord API failures or rate limiting. The agent run itself
succeeds; only the post-run channel announcement fails. Historical rate: ~30% on busy
days.

**Fix (preventive):** Add `--best-effort-deliver` when creating cron jobs. This marks
the job as `ok` even if delivery fails, and logs the delivery error separately:
```bash
node openclaw.mjs cron add ... --best-effort-deliver --message "message"
```

**Fix (reactive):** A container restart often clears stuck delivery state. After restart,
check if the next scheduled run succeeds with `cron list`.

**Note:** Even when delivery fails, the full summary is stored in the JSONL run history
at `openclaw-agents/jerry/cron/runs/<job-id>.jsonl`.

---

### Bobby Can't Check Phil via GCP/Tailscale MCP

**Symptom:** Bobby heartbeat reports "Monitoring tools not accessible via mcporter" for
Tailscale and GCP servers. Phil keeper falls back to `manual_review` even when Phil is
actually down.

**Root cause:** The image was built with a stale `mcporter.json` (missing `gcp-mcp-server`,
wrong port for `tailscale-mcp-server`). This is now fixed: `jerry/mcporter.json` is
mounted as a volume and takes precedence over the baked-in version.

**Verify fix is active:**
```bash
podman exec homelab_openclaw-gateway_1 cat /root/.mcporter/mcporter.json
# Should show 5 servers: context7, mcp-nomad-server, infra-mcp-server,
# tailscale-mcp-server (port 29178), gcp-mcp-server
```

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

## Hot-Reload and Restart Guidance

Changes to `models.providers.*` in `openclaw.json` are picked up without a gateway
restart (hot-reload is active). Changes to `agents.list[*].tools` or `plugins.*`
require a restart.

**Use `ctl.sh restart` for config-only changes (no new volume mounts):**

```bash
./homelab/ctl.sh restart   # uses podman restart — preferred
```

`ctl.sh restart` calls `podman restart` directly. Both `podman-compose restart` and
`ctl.sh down && ctl.sh up` reliably break Consul DNS in Podman 4.x. `podman restart`
is safer but **aardvark-dns can still drop on the first restart** — always verify:

```bash
podman exec homelab_openclaw-gateway_1 nslookup nomad.service.consul
# If NXDOMAIN or connection refused: run ctl.sh restart once more
./homelab/ctl.sh restart
```

A second `podman restart` reliably revives aardvark-dns when the first drops it.

**When you must use `down && up`** (e.g. to activate a new volume mount in
docker-compose.yml):

```bash
./homelab/ctl.sh down && ./homelab/ctl.sh up
sleep 2
podman exec homelab_openclaw-gateway_1 nslookup nomad.service.consul
# If NXDOMAIN: ./homelab/ctl.sh restart  (may need to run twice)
```

See `homelab/NETWORKING.md` for full details on the aardvark-dns restart quirk.
