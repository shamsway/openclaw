# OpenClaw Homelab Deployment Plan v2.0

**Date:** 2026-02-16
**Target Architecture:** Hybrid (Option 3) with Option 2 experimentation path
**Target Environment:** Octant homelab (Jerry, Bobby, Billy) + MacBook M3 Max
**Homelab Framework:** [Octant](https://github.com/shamsway/octant) - Ansible/Nomad/Consul/Tailscale/1Password

---

## Executive Summary

This deployment plan implements a **phased approach** to building an enterprise-grade agent farm on Octant homelab:

- **Phase 1-3**: Option 3 (Hybrid) - Single gateway foundation, proven patterns
- **Phase 4+**: Option 2 (Distributed) - True agent farm with gateway per node
- **End Goal**: Distributed, HA-tolerant agent farm replacing LangGraph-based prototype
- **LLM Strategy**: LiteLLM gateway (with observability) + ZAI GLM direct access

**Strategic Vision:**

- 🎯 **Enterprise-grade agent farm**: Multi-node, no SPOF, full homelab utilization
- 🎯 **Technical demo**: Beyond homelab - showcase for network engineering community
- 🎯 **OpenClaw enhancement**: Contribute distributed patterns back to community
- 🎯 **LangGraph replacement**: Leverage OpenClaw to solve multi-agent complexity

**Key Benefits:**

- ✅ Proven OpenClaw patterns (Phase 1-3 foundation)
- ✅ Strategic path to distributed architecture (Option 2 design)
- ✅ Network engineer mindset: eliminate single points of failure
- ✅ Multi-channel support path (Slack, Discord active; WhatsApp planned)
- ✅ LiteLLM observability + ZAI GLM cost-effectiveness

---

## Architecture Overview

### Target Topology (Option 3 - Hybrid)

```
┌─────────────────────────────────────────────────────┐
│         Nomad Cluster (Homelab)                     │
│                                                     │
│  Jerry (primary node - pinned):                     │
│  ┌────────────────────────────────────────────────┐ │
│  │  OpenClaw Gateway (Nomad job, count=1)         │ │
│  │                                                 │ │
│  │  Agents (logical, in-process):                 │ │
│  │    ├─ Jerry (Slack/Discord hub)               │ │
│  │    │   Model: zai/glm-4.7 (GLM default stack) │ │
│  │    │   Channels: Slack, Discord (WhatsApp paused) │ │
│  │    │                                            │ │
│  │    ├─ Bobby (autonomous monitoring)            │ │
│  │    │   Model: zai/glm-4.7 (GLM default stack)  │ │
│  │    │   Heartbeat: Consul/Nomad health checks   │ │
│  │    │                                            │ │
│  │    └─ Billy (scheduled tasks, automation)      │ │
│  │        Model: zai/glm-4.7 (GLM default stack)  │ │
│  │        Note: Single-gateway until Option 2 gates pass │ │
│  │                                                 │ │
│  │  Built-in A2A: sessions_* tools work natively  │ │
│  │  Storage: Nomad host volumes (Jerry node)      │ │
│  └────────────────────────────────────────────────┘ │
│                                                     │
│  Shared Infrastructure:                             │
│    • Consul KV: Agent registry, shared state       │
│    • Redis (optional): Fast shared memory          │
│    • Traefik: HTTPS ingress (optional)             │
└─────────────────────────────────────────────────────┘
                         ↕
              Tailscale VPN Mesh
                         ↕
┌─────────────────────────────────────────────────────┐
│  MacBook M3 Max (Mobile/Dev Work)                   │
│  ┌────────────────────────────────────────────────┐ │
│  │  Independent Gateway (OPTIONAL)                │ │
│  │    • Agent: "Dev" or "Mobile"                  │ │
│  │    • LM Studio: Local LLM (when MacBook on)    │ │
│  │    • Separate config, workspace, channels      │ │
│  │    • Offline capability (no homelab required)  │ │
│  │    • Can connect to homelab gateway as client  │ │
│  │    • NOT used by homelab agents (reliability)  │ │
│  └────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### Future Experimentation Path (Option 2 - Distributed, NOT active)

**Infrastructure readiness for Option 2:**

- ✅ Consul KV schema designed (agent registry, messaging)
- ✅ Custom MCP server scaffolding prepared
- ✅ Multi-gateway discovery patterns documented
- ✅ Consul-based A2A message bus design ready

**When to explore Option 2:**

- After Option 3 is stable and proven
- For demos requiring true multi-node distribution
- As research project for OpenClaw community
- When you want to contribute back distributed patterns

### Operating Mode Lock (Current State)

- **Active mode:** single gateway on Jerry only.
- Bobby/Billy run as **in-process agents** inside Jerry's gateway.
- Option 2 multi-gateway work remains **design + experiment only** until readiness gates are met.
- Do not run Bobby/Billy standalone gateways with channel integrations during this phase.

### Remote Tool Nodes Experiment (Bobby/Billy, still single-gateway)

Use headless node hosts on Bobby/Billy to execute tools remotely while keeping all
agents on Jerry's single gateway.

- Compose file: `homelab/docker-compose.remote-nodes.yml`
- Runtime model: `openclaw node run` in rootless Podman containers (hashi user)
- Gateway stays only on Jerry; Bobby/Billy are node peripherals (not gateways)

**Run on Bobby host:**

```bash
./homelab/ctl.sh node-up bobby
./homelab/ctl.sh node-logs bobby
```

**Run on Billy host:**

```bash
./homelab/ctl.sh node-up billy
./homelab/ctl.sh node-logs billy
```

Other node management commands: `node-down`, `node-restart`, `node-ps`.

**Required env vars (in `.env` on each node host):**

- `OPENCLAW_IMAGE`
- `OPENCLAW_GATEWAY_TOKEN` (must match Jerry gateway auth token)
- `OPENCLAW_REMOTE_GATEWAY_HOST`
- `OPENCLAW_REMOTE_GATEWAY_PORT`
- `OPENCLAW_BOBBY_NODE_CONFIG_DIR` / `OPENCLAW_BOBBY_NODE_WORKSPACE_DIR` (Bobby)
- `OPENCLAW_BILLY_NODE_CONFIG_DIR` / `OPENCLAW_BILLY_NODE_WORKSPACE_DIR` (Billy)

**Validation from Jerry:**

```bash
openclaw nodes status
openclaw devices list
openclaw devices approve <requestId>   # first-time pair
openclaw approvals allowlist add --node "Bobby Remote Node" "/usr/bin/uname"
openclaw approvals allowlist add --node "Billy Remote Node" "/usr/bin/uname"
```

---

## Deployment Phases

### Phase 1: Homelab Gateway Foundation (Week 1)

**Goal:** Single OpenClaw gateway on Nomad with 3 agents

**Status:** ✅ COMPLETE (Podman compose; Nomad deployment pending)

**Steps:**

1. ✅ Already done: Podman compose testing (from v1.0 plan)
2. ✅ Gateway running in Podman compose on Jerry (Nomad deployment deferred to later)
3. ✅ Configure 3 agents (Jerry, Bobby, Billy) — all responding
4. ✅ Set up channel routing (Slack private channels + Discord DMs per agent; Jerry remains in `#home-automation`)
5. ✅ A2A communication verified (Jerry → Bobby via `sessions_spawn` + `sessions_send`)

**A2A Configuration Note:** `sessions_spawn` requires `subagents.allowAgents` on each
agent's config entry. Added `["bobby", "billy"]` to Jerry, `["jerry", "billy"]` to Bobby,
and `["jerry", "bobby"]` to Billy in `openclaw-agents/jerry/openclaw.json`.

**Deliverables:**

- [ ] Nomad job spec: `terraform/openclaw/openclaw.nomad.hcl` _(deferred — Podman compose sufficient for now)_
- [x] Multi-agent config: `openclaw.json` with 3 agents
- [x] Channel bindings configured
- [ ] Health checks passing in Nomad _(deferred)_
- [ ] Consul service registration working _(deferred)_

**Success Criteria:**

- ✅ Gateway healthy and reachable via Tailscale
- ✅ All 3 agents responding to messages
- ✅ A2A communication between agents works (Jerry spawns Bobby; Bobby responds in-character)
- ✅ Nomad restarts recover cleanly _(Podman: container restarts cleanly)_
- ✅ Logs accessible via Nomad UI _(Podman: `podman logs -f homelab_openclaw-gateway_1`)_

---

### Phase 1.5: Plugin Installation & Configuration

**Goal:** Enable and configure recommended plugins for memory, multi-agent coordination, automation workflows, and observability

**Status:** ✅ MOSTLY COMPLETE (lobster, llm-task active; memory-lancedb/diagnostics-otel image-ready; thread-ownership pending slack-forwarder)

**Plugins Covered:**

| Plugin             | ID                 | Purpose                                                                            |
| ------------------ | ------------------ | ---------------------------------------------------------------------------------- |
| Memory (Core)      | `memory-core`      | File-backed `memory_search`/`memory_get` tools — baseline long-term memory         |
| Memory (LanceDB)   | `memory-lancedb`   | Vector-search memory with auto-recall/capture — upgrade path over memory-core      |
| Thread Ownership   | `thread-ownership` | Prevents Bobby/Billy/Jerry from double-replying in the same Slack thread           |
| Lobster            | `lobster`          | Resumable typed workflows with approvals — multi-step automation shell             |
| LLM Task           | `llm-task`         | JSON-only structured LLM sub-tasks; designed to be called from Lobster workflows   |
| Diagnostics (OTel) | `diagnostics-otel` | OpenTelemetry exporter for homelab observability stack (Prometheus/Grafana/Jaeger) |

---

#### Step 1: memory-core (already done)

Enabled during initial gateway setup. No further action needed.

```bash
# Verify it is active
podman exec homelab_openclaw-gateway_1 node openclaw.mjs plugins info memory-core
# Expected: Status: loaded
```

**Future upgrade to memory-lancedb:**

`memory-lancedb` replaces `memory-core` in the memory slot. Enable it when you want
vector-search recall and automatic memory capture from conversations. Its npm deps
(`@lancedb/lancedb`, etc.) are pre-installed in the image as of the 2026-02-17 build.

To enable, add to `openclaw-agents/jerry/openclaw.json`:

```json
"memory-lancedb": { "enabled": true }
```

Then restart. The slot change automatically disables `memory-core`.
LanceDB uses an embedded native library; no separate database service is required.

---

#### Step 2: Thread Ownership

Prevents multiple agents from claiming the same Slack thread when a message is
broadcast to multiple bindings. Requires the `slack-forwarder` ownership API to be
reachable from the gateway container.

**Prerequisite:** A `slack-forwarder` service must be deployed and reachable.
Skip this step if that service is not yet available; add it when thread collisions
are observed in practice.

The config entry is already present in `openclaw-agents/jerry/openclaw.json` as
`"thread-ownership": { "enabled": false }`. When slack-forwarder is available,
change to:

```json
"thread-ownership": {
  "enabled": true,
  "config": {
    "forwarderUrl": "http://slack-forwarder.service.consul:PORT"
  }
}
```

Then restart the gateway.

---

#### Step 3: Lobster

Adds the `lobster` agent tool for running typed, resumable workflows with approval gates.
The plugin executes the `lobster` CLI as a subprocess — it must be installed in the
homelab image.

**Prerequisite:** Verify `lobster` is available in the container:

```bash
podman exec homelab_openclaw-gateway_1 which lobster || echo "not found — add to Dockerfile"
```

If not present, add the install step to `homelab/Dockerfile` before enabling.

**Status: ✅ Done.** Plugin enabled and `lobster` added to Jerry/Bobby/Billy `alsoAllow`
via `openclaw-agents/jerry/openclaw.json`. No CLI commands needed — config is the
source of truth.

> **Note:** The `lobster` CLI binary is not yet installed in the image. The plugin
> loads successfully, but invoking the `lobster` tool will error until the binary is
> present. Add an install step to `homelab/Dockerfile` (e.g. download from GitHub
> releases or build from source).

---

#### Step 4: LLM Task

Adds a `llm-task` tool for JSON-only structured LLM sub-tasks. Designed to be invoked
from Lobster workflows via `openclaw.invoke --each`.

**Status: ✅ Done.** Plugin enabled with ZAI GLM defaults and `llm-task` added to
Jerry's `alsoAllow` via `openclaw-agents/jerry/openclaw.json`. Config:

```json
"llm-task": {
  "enabled": true,
  "config": {
    "defaultProvider": "zai",
    "defaultModel": "glm-4.7-flash",
    "maxTokens": 2048,
    "timeoutMs": 30000
  }
}
```

---

#### Step 5: Diagnostics (OTel)

Exports OpenClaw metrics/traces to your observability stack via OpenTelemetry.
Requires an OTEL-compatible collector endpoint (Grafana Alloy, Jaeger, etc.).

OTel npm deps are pre-installed in the image as of the 2026-02-17 build. When an
OTEL collector endpoint is available, enable by adding to `openclaw-agents/jerry/openclaw.json`:

```json
"diagnostics-otel": {
  "enabled": true,
  "config": {
    "endpoint": "http://otel-collector.service.consul:4318",
    "serviceName": "openclaw-gateway"
  }
}
```

Find the collector address via Consul:

```bash
CONSUL_HTTP_ADDR=http://consul.service.consul:8500 consul catalog services | grep -i otel
```

---

#### Step 6: Update Agent Tool Allowlists

**Status: ✅ Done.** All three agents updated in `openclaw-agents/jerry/openclaw.json`.

`lobster` and `llm-task` are optional tools that must be explicitly added to each
agent's `tools.alsoAllow` list.

> **IMPORTANT:** Use `alsoAllow`, NOT `allow`. The `allow` field is a strict allowlist
> that **replaces** the profile's tool set entirely — it would strip all `coding` profile
> tools (exec, read, write, session_status, etc.). `alsoAllow` is **additive** on top of
> the profile. See CLAUDE.md Known Issues § 2 for details.

**Jerry** (general hub — enable both):

```json
{
  "id": "jerry",
  "tools": {
    "profile": "coding",
    "alsoAllow": ["group:web", "message", "agents_list", "lobster", "llm-task", "nodes"],
    "deny": ["image", "browser", "canvas", "cron", "gateway"]
  }
}
```

**Bobby** (infrastructure monitoring — lobster useful for multi-step remediation):

```json
{
  "id": "bobby",
  "tools": {
    "profile": "coding",
    "alsoAllow": [
      "group:web",
      "group:sessions",
      "message",
      "agents_list",
      "lobster",
      "llm-task",
      "nodes"
    ],
    "deny": ["write", "edit", "apply_patch", "browser", "canvas", "cron", "gateway", "image"]
  }
}
```

**Billy** (scheduled tasks — lobster useful for pipelines; no remote node yet):

```json
{
  "id": "billy",
  "tools": {
    "profile": "coding",
    "alsoAllow": ["group:sessions", "message", "agents_list", "lobster"],
    "deny": ["browser", "canvas", "nodes", "cron", "gateway", "image"]
  }
}
```

> **Note on `nodes` tool:** `nodes` must be in `alsoAllow` (not just absent from `deny`) because it
> is not part of the `coding` profile. Keeping `nodes` in the `deny` list silently blocks remote node
> exec — the agent's `exec` calls fall back to local (gateway container) execution with no error.
> Billy keeps `nodes` denied until a Billy remote node is deployed.

After editing `openclaw.json`, restart to apply:

```bash
./homelab/ctl.sh restart
```

---

**Deliverables:**

- [x] `memory-core` confirmed active (`memory_search`, `memory_get` tools available)
- [ ] `thread-ownership` enabled and configured with `forwarderUrl` (when slack-forwarder is available)
- [x] `lobster` plugin enabled; `lobster` CLI binary added to Dockerfile (`@clawdbot/lobster` via npm)
- [x] `llm-task` enabled with ZAI GLM defaults
- [ ] `diagnostics-otel` enabled with OTEL collector endpoint (deps in image; needs collector)
- [x] Agent tool allowlists updated for `lobster` and `llm-task`
- [x] Gateway restarts clean (no config errors in logs)
- [x] `memory-lancedb` and `diagnostics-otel` npm deps baked into image (2026-02-17 build)

**Success Criteria:**

- ✅ `openclaw plugins list` shows all target plugins as `loaded`
- ✅ No config validation errors on gateway startup
- ✅ `memory_search` and `memory_get` appear in Jerry's tool list
- ✅ `lobster` and `llm-task` appear in Jerry's tool list
- ✅ OTel metrics visible in Grafana/Jaeger (when `diagnostics-otel` is active)
- ✅ No Slack thread double-replies from multiple agents

**Validation:**

```bash
# Confirm all target plugins are loaded
podman exec homelab_openclaw-gateway_1 node openclaw.mjs plugins list

# Verify no startup errors
podman logs --tail 20 homelab_openclaw-gateway_1 2>&1

# Ask Jerry to confirm its tools (via chat or sessions CLI)
podman exec homelab_openclaw-gateway_1 node openclaw.mjs agent \
  --agent jerry \
  --message "List your available tools"

# Test memory tool directly
podman exec homelab_openclaw-gateway_1 node openclaw.mjs agent \
  --agent jerry \
  --message "Save a memory: the homelab cluster has 3 nodes: jerry, bobby, billy"
podman exec homelab_openclaw-gateway_1 node openclaw.mjs agent \
  --agent jerry \
  --message "What do you know about the homelab cluster nodes?"

# Test lobster availability (requires lobster CLI in image)
podman exec homelab_openclaw-gateway_1 lobster --version
```

---

### Phase 1.75: MCP Server Validation & Remote Tool Nodes

**Goal:** Verify agents can reach all deployed MCP servers and test remote node execution on Bobby/Billy hosts

**Status:** ✅ COMPLETE — all deliverables done; cron running; HTTP health endpoints configured

---

#### Step 1: Verify MCP Server Access

Five MCP servers are deployed. Agents use `mcporter` CLI to call them (via `exec` tool).
The `homelab/.mcp.json` is the source of truth; it is baked into `/root/.mcporter/mcporter.json`
at image build time.

**Note:** Prefer direct internal URLs from inside the container. Traefik endpoints
(`https://*.shamsway.net`) are internal-only (not externally routable) but add TLS
overhead — use Consul DNS or IP addresses directly when possible.

| Server                 | Internal URL                                     | Status                                           |
| ---------------------- | ------------------------------------------------ | ------------------------------------------------ |
| `context7`             | `https://mcp.context7.com/mcp`                   | external, always reachable                       |
| `mcp-nomad-server`     | `http://192.168.252.8:30859/mcp`                 | ✅ confirmed reachable                           |
| `infra-mcp-server`     | `http://192.168.252.6:26378/mcp`                 | ✅ confirmed reachable                           |
| `tailscale-mcp-server` | `http://192.168.252.6:29178/mcp`                 | ✅ confirmed reachable (port updated 2026-02-18) |
| `gcp-mcp-server`       | `http://gcp-mcp-server.service.consul:22241/mcp` | ✅ confirmed reachable                           |

**Fix applied:** `homelab/.mcp.json` updated to use internal URLs for all servers.
See changelog for full history. Current `.mcp.json` is the source of truth for all entries.

**Validation:**

```bash
# Rebuild and push image with updated .mcp.json
./homelab/ctl.sh build && ./homelab/ctl.sh push

# Pull and restart
./homelab/ctl.sh pull && ./homelab/ctl.sh restart

# Verify mcporter sees all servers
podman exec homelab_openclaw-gateway_1 cat /root/.mcporter/mcporter.json

# Test each server (agents call mcporter via exec)
podman exec homelab_openclaw-gateway_1 mcporter list \
  --http-url http://192.168.252.8:30859/mcp --allow-http --name mcp-nomad-server

podman exec homelab_openclaw-gateway_1 mcporter list \
  --http-url http://192.168.252.6:26378/mcp --allow-http --name infra-mcp-server

podman exec homelab_openclaw-gateway_1 mcporter list \
  --http-url http://192.168.252.6:29178/mcp --allow-http --name tailscale-mcp-server

podman exec homelab_openclaw-gateway_1 mcporter list \
  --http-url http://gcp-mcp-server.service.consul:22241/mcp --allow-http --name gcp-mcp-server

# Test via Jerry agent (end-to-end)
podman exec homelab_openclaw-gateway_1 node openclaw.mjs agent --agent jerry \
  -m "Use mcporter to call list_jobs on mcp-nomad-server and report what Nomad jobs are running."
```

---

#### Step 2: Remote Tool Nodes (Bobby/Billy hosts)

Run headless OpenClaw node hosts on the Bobby and Billy physical nodes. These connect back
to Jerry's gateway and expose remote tool execution. All agents remain on Jerry's single
gateway — the node hosts are peripheral execution targets only.

**Prerequisites (on each remote host):**

1. Image must be pulled from registry: `./homelab/ctl.sh pull` (run on bobby/billy hosts)
2. `.env` must exist in repo root with all required vars set:
   - `OPENCLAW_GATEWAY_TOKEN` — must match Jerry's gateway token
   - `OPENCLAW_REMOTE_GATEWAY_HOST` — Jerry's Tailscale/LAN hostname (`jerry.shamsway.net`)
   - `OPENCLAW_REMOTE_GATEWAY_PORT=18789`
   - `OPENCLAW_BOBBY_NODE_CONFIG_DIR`, `OPENCLAW_BOBBY_NODE_WORKSPACE_DIR` (Bobby host)
   - `OPENCLAW_BILLY_NODE_CONFIG_DIR`, `OPENCLAW_BILLY_NODE_WORKSPACE_DIR` (Billy host)

**Start nodes (run on the respective host):**

```bash
# On bobby host:
./homelab/ctl.sh node-up bobby

# On billy host:
./homelab/ctl.sh node-up billy

# Follow logs
./homelab/ctl.sh node-logs bobby
./homelab/ctl.sh node-logs billy
```

**Validate from Jerry:**

```bash
# Should show 2 connected nodes after startup
podman exec homelab_openclaw-gateway_1 node openclaw.mjs nodes status

# List devices (requires pairing approval first time)
podman exec homelab_openclaw-gateway_1 node openclaw.mjs devices list

# Approve first-time pairing (get requestId from `devices list`)
podman exec homelab_openclaw-gateway_1 node openclaw.mjs devices approve <requestId>

# Add uname to each node's allowlist (safe verification command)
podman exec homelab_openclaw-gateway_1 node openclaw.mjs approvals allowlist add \
  --node "Bobby Remote Node" "/usr/bin/uname"
podman exec homelab_openclaw-gateway_1 node openclaw.mjs approvals allowlist add \
  --node "Billy Remote Node" "/usr/bin/uname"
```

**Deliverables:**

- [x] `homelab/.mcp.json` updated with all 5 MCP server URLs (incl. gcp-mcp-server; tailscale port corrected)
- [x] Image rebuilt and pushed with updated mcporter config (image `2026.2.16`)
- [x] Bobby agent can call all MCP servers via mcporter exec: nomad, infra, tailscale, gcp
- [x] Bobby tool validation runbook completed — all 6 gates passed (see `BOBBY_TOOL_VALIDATION_RUNBOOK.md`)
- [x] Bobby node container running on Bobby host and paired with Jerry gateway
- [x] Billy node container running on Billy host and paired with Jerry gateway
- [x] `openclaw nodes status` shows both nodes connected (2/2 nodes)
- [x] `nodes` tool enabled for Jerry and Bobby (removed from deny, added to alsoAllow)
- [x] Remote tool execution validated: Jerry dispatched `uname -a` to Bobby Remote Node via `nodes` tool
- [x] Bobby heartbeat cron running (`*/15 * * * *`, Discord announce to `#bobby`)
- [x] Billy daily summary cron added (`0 9 * * *`, Discord announce to `#billy`)
- [x] Cron `sessionRetention: "6h"` configured — sessions auto-rotate every 6h, capping context accumulation
- [x] HTTP health endpoints defined in `bobby/workspace/HEARTBEAT.md` (gateway, Nomad, MCP servers)
- [x] Cluster layout documented in `bobby/workspace/TOOLS.md`

**Success Criteria:**

- ✅ `mcporter list` succeeds for all 5 servers from inside the container
- ✅ Bobby can query Nomad job list via `mcp-nomad-server` (47/47 jobs running overnight)
- ✅ Bobby can query infra health via `infra-mcp-server`
- ✅ Tailscale MCP tools respond correctly (Phil confirmed online at `100.100.120.128`)
- ✅ GCP MCP authenticated and Phil VM status confirmed (`RUNNING`, `octant-426722`, `us-central1-a`)
- ✅ Bobby node host connected and paired
- ✅ Billy node host connected and paired
- ✅ Remote tool execution confirmed working: `uname -a` ran on Bobby Remote Node (not Jerry's container)
- ✅ Bobby heartbeat cron running reliably — detected and logged 1-hour Consul DNS outage overnight (auto-recovered)
- ✅ Phil keeper protocol operational — 5 consecutive checks, all `skip` (Phil healthy), 0 restarts triggered
- ✅ Billy daily summary cron registered — first run at 09:00 UTC

---

### Phase 2: Channel Configuration & Testing (Week 2)

**Goal:** Configure Slack + Discord and test multi-agent routing (WhatsApp intentionally paused)

**Status:** ✅ COMPLETE

**Steps:**

1. Configure Slack bot (app token, bot token)
2. Configure Discord bot (application, bot token)
3. Create Slack private channels: `#jerry`, `#bobby`, `#billy` (keep Jerry in `#home-automation`)
4. **Invite the bot to each private Slack channel** — Slack never delivers events for channels
   the bot hasn't joined. In each channel, run `/invite @<bot-name>`. This must be done by a
   human channel member; the bot cannot invite itself to private channels.
5. Set up channel bindings (route Slack channels and Discord DMs to agents)
6. Test message routing and A2A communication
7. Prepare for job-specific agents (workspace structure)

**Deliverables:**

- [x] Slack bot responding with per-agent channel routing
- [x] Discord DMs routed correctly per agent
- [x] WhatsApp status documented as paused for now
- [x] Channel bindings tested and working
- [ ] A2A communication verified (Jerry → Bobby) — pending explicit test
- [ ] Workspace structure for future agents documented

**Success Criteria:**

- ✅ Slack + Discord working with intended per-agent routing
- ✅ Jerry responds to general queries across channels
- ✅ Bobby responds to infrastructure queries
- ⏳ Billy executes scheduled tasks via cron — not yet tested
- ✅ No channel conflicts or duplicate responses
- ✅ Ready to add job-specific agents (Phase 3+)

**MacBook Setup Commands (Optional, Phase 4):**

```bash
# Install LM Studio (GUI)
# Download from: https://lmstudio.ai/
# Or use CLI if available

# Install OpenClaw CLI (if not using .app)
npm install -g openclaw@latest

# Create separate profile for MacBook gateway
openclaw --profile macbook onboard

# Configure to use LM Studio models
# LM Studio runs local server on http://localhost:1234
# Configure in ~/.openclaw-macbook/openclaw.json:
{
  "models": {
    "mode": "merge",
    "providers": {
      "lmstudio": {
        "baseUrl": "http://localhost:1234/v1",
        "apiKey": "lmstudio-local",
        "api": "openai-completions",
        "models": [
          {
            "id": "local-model",
            "name": "LM Studio Local Model",
            "contextWindow": 32768,
            "maxTokens": 4096
          }
        ]
      }
    }
  },
  "agents": {
    "list": [
      {
        "id": "dev",
        "name": "Dev Agent (MacBook)",
        "model": "lmstudio/local-model",  // Whatever model you load in LM Studio
        "workspace": "~/.openclaw/workspace-macbook"
      }
    ]
  }
}

# Start MacBook gateway
openclaw --profile macbook gateway --port 18789

# Or use OpenClaw.app (menubar, GUI)
```

**Note:** LM Studio is used ONLY for MacBook agent, NOT for homelab agents in current testing mode

**Homelab Gateway Config:**

```json5
// ~/.openclaw/openclaw.json (on homelab gateway)
{
  // GLM-first testing baseline across homelab agents.
  models: {
    mode: "merge",
    providers: {
      zai: {
        baseUrl: "https://api.z.ai/api/anthropic",
        apiKey: "${ZAI_API_KEY}",
        api: "anthropic-messages", // REQUIRED: coding endpoint does not return structured tool calls
        models: [
          { id: "glm-4.7", name: "GLM-4.7", contextWindow: 128000, maxTokens: 8192 },
          { id: "glm-5", name: "GLM-5", contextWindow: 128000, maxTokens: 8192 },
        ],
      },
    },
  },

  agents: {
    defaults: {
      model: {
        primary: "zai/glm-4.7",
        fallbacks: ["zai/glm-5", "moonshot/kimi-k2-0905-preview"],
      },
    },
    list: [
      {
        id: "jerry",
        name: "Jerry (General Hub)",
        workspace: "~/.openclaw/workspace-jerry",
        model: "zai/glm-4.7",
        description: "General-purpose assistant for Slack/Discord",
      },
      {
        id: "bobby",
        name: "Bobby (Infrastructure Monitoring)",
        workspace: "~/.openclaw/workspace-bobby",
        model: "zai/glm-4.7",
        description: "Autonomous infrastructure monitoring and health checks",
      },
      {
        id: "billy",
        name: "Billy (Automation)",
        workspace: "~/.openclaw/workspace-billy",
        model: "zai/glm-4.7",
        description: "Scheduled tasks and automation",
      },
      // Future: Add job-specific agents here
      // {
      //   id: "deploy-agent",
      //   name: "Deployment Specialist",
      //   workspace: "~/.openclaw/workspace-deploy",
      //   model: "zai/glm-4.7",
      //   description: "Handles Nomad deployments and rollbacks",
      // },
    ],
  },

  bindings: [
    // Slack private channels per agent
    {
      agentId: "jerry",
      match: {
        channel: "slack",
        teamId: "T255F0YHW",
        peer: { kind: "channel", id: "C0AF7JDDBB8" },
      },
    }, // #jerry
    {
      agentId: "bobby",
      match: {
        channel: "slack",
        teamId: "T255F0YHW",
        peer: { kind: "channel", id: "C0AF9LAUWPL" },
      },
    }, // #bobby
    {
      agentId: "billy",
      match: {
        channel: "slack",
        teamId: "T255F0YHW",
        peer: { kind: "channel", id: "C0AEU73AYNB" },
      },
    }, // #billy
    // Keep Jerry in #home-automation for now
    {
      agentId: "jerry",
      match: {
        channel: "slack",
        teamId: "T255F0YHW",
        peer: { kind: "channel", id: "G01A46T1546" },
      },
    }, // #home-automation (private)

    // Discord direct chats:
    // peer.id is the SENDER USER ID (not the bot/application id).
    // With one Discord user account, DMs route to one agent; use Discord channels for per-agent split.
    {
      agentId: "jerry",
      match: { channel: "discord", peer: { kind: "direct", id: "DISCORD_USER_ID" } },
    },

    // Cron jobs target an agent via job.agentId, not via bindings.
  ],
}
```

---

### Phase 3: Consul KV Shared State Infrastructure (Week 3)

**Goal:** Foundation for agent coordination and Option 2 experimentation

**Status:** OPTIONAL (enables advanced features)

**Steps:**

1. Design Consul KV schema (agent registry, shared memory)
2. Build custom MCP server for Consul KV access
3. Create agent skills that write to Consul KV
4. Test cross-agent coordination via shared state
5. Build simple dashboard (Consul UI + custom queries)

**Deliverables:**

- [ ] Consul KV schema documented
- [ ] MCP server: `consul-registry` (register, discover, message)
- [ ] Agent skills: Bobby heartbeat writes to Consul KV
- [ ] Jerry reads Bobby's infrastructure status from Consul
- [ ] Dashboard showing agent status/health

**Success Criteria:**

- ✅ Agents can register themselves in Consul KV
- ✅ Agents can discover each other via Consul
- ✅ Bobby's heartbeat visible in Consul KV
- ✅ Jerry can query Bobby's last check results
- ✅ Foundation ready for Option 2 inter-gateway messaging

**Consul KV Schema:**

```
/openclaw/
  cluster/
    id: "octant-homelab"
    deployment: "option-3-hybrid"

  gateways/
    jerry-gateway/
      url: "ws://jerry.tailscale:18789"
      agents: ["jerry", "bobby", "billy"]
      status: "healthy"
      last_heartbeat: "2026-02-16T12:00:00Z"

  agents/
    jerry/
      gateway: "jerry-gateway"
      workspace: "~/.openclaw/workspace-jerry"
      capabilities: ["slack", "discord", "general-qa"]
      status: "active"

    bobby/
      gateway: "jerry-gateway"
      workspace: "~/.openclaw/workspace-bobby"
      capabilities: ["consul", "nomad", "infra-monitoring"]
      heartbeat_enabled: true
      last_check: "2026-02-16T12:00:00Z"
      last_check_result: "all-healthy"

    billy/
      gateway: "jerry-gateway"
      workspace: "~/.openclaw/workspace-billy"
      capabilities: ["cron", "automation", "scheduled-tasks"]
      model_provider: "zai-glm"

  shared-state/
    recent-events: [
      {timestamp: "...", agent: "bobby", event: "nomad-alert-cleared"},
      {timestamp: "...", agent: "jerry", event: "user-query-slack"},
    ]
    current-focus: "Deploying new openclaw architecture"
```

**Custom MCP Server (Skeleton):**

```javascript
// ~/.openclaw/workspace/mcp-servers/consul-registry.js
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import Consul from "consul";

const consul = new Consul({
  host: process.env.CONSUL_HTTP_ADDR || "127.0.0.1",
  port: "8500",
  promisify: true,
});

const server = new McpServer({
  name: "consul-registry",
  version: "1.0.0",
});

// Tool: Register this agent
server.tool("agent_register", async ({ agent_id, capabilities, gateway_id }) => {
  await consul.kv.set(`/openclaw/agents/${agent_id}/capabilities`, JSON.stringify(capabilities));
  await consul.kv.set(`/openclaw/agents/${agent_id}/gateway`, gateway_id);
  await consul.kv.set(`/openclaw/agents/${agent_id}/status`, "active");
  return { success: true, registered_at: new Date().toISOString() };
});

// Tool: Discover other agents
server.tool("agent_discover", async () => {
  const agents = await consul.kv.get({ key: "/openclaw/agents/", recurse: true });
  return agents.map((kv) => {
    const parts = kv.Key.split("/");
    const agent_id = parts[3];
    const field = parts[4];
    return { agent_id, field, value: kv.Value };
  });
});

// Tool: Update agent heartbeat (for Bobby)
server.tool("agent_heartbeat", async ({ agent_id, status, last_check_result }) => {
  await consul.kv.set(`/openclaw/agents/${agent_id}/last_check`, new Date().toISOString());
  await consul.kv.set(`/openclaw/agents/${agent_id}/last_check_result`, last_check_result);
  return { success: true };
});

// Tool: Send message to another agent (for Option 2 future use)
server.tool("send_message", async ({ from_agent, to_agent, message_body }) => {
  const msg_id = `msg-${Date.now()}`;
  await consul.kv.set(
    `/openclaw/agents/${to_agent}/inbox/${msg_id}`,
    JSON.stringify({
      from: from_agent,
      body: message_body,
      timestamp: new Date().toISOString(),
    }),
  );
  return { message_id: msg_id };
});

// Tool: Check inbox (for Option 2 future use)
server.tool("check_inbox", async ({ agent_id }) => {
  const messages = await consul.kv.get({
    key: `/openclaw/agents/${agent_id}/inbox/`,
    recurse: true,
  });
  return messages || [];
});

server.start({ transport: "stdio" });
```

**Bobby Heartbeat Skill:**

````markdown
---
name: infrastructure-heartbeat
description: Monitor Nomad/Consul health and update Consul KV with status
schedule: "*/5 * * * *" # Every 5 minutes
agent: bobby
---

## Heartbeat Check Process

1. **Register agent** (if not already):
   - Use MCP tool: `agent_register`
   - agent_id: "bobby"
   - capabilities: ["consul", "nomad", "infra-monitoring"]
   - gateway_id: "jerry-gateway"

2. **Check Nomad cluster health**:
   ```bash
   nomad status -json | jq '.Allocations[] | select(.ClientStatus != "running")'
   ```
````

- Count failed allocations
- List unhealthy jobs

3. **Check Consul cluster health**:

   ```bash
   consul members -status-filter=failed
   consul catalog services -tags | jq '.[] | select(.Health != "passing")'
   ```

   - Count unhealthy nodes
   - List failing services

4. **Update Consul KV with results**:
   - Use MCP tool: `agent_heartbeat`
   - agent_id: "bobby"
   - status: "active"
   - last_check_result: "all-healthy" OR "alert: X failed allocations, Y unhealthy services"

5. **If issues found**:
   - Use built-in A2A: `sessions_send` to Jerry
   - Jerry forwards alert to Slack #homelab-alerts
   - Bobby updates Consul KV: `/openclaw/agents/bobby/last_alert` with details

6. **Log completion**:
   - Timestamp written to Consul KV
   - Next check scheduled

````

---

### Phase 4: MacBook Independent Gateway (Week 4)
**Goal:** Independent MacBook gateway for mobile/dev work with local LLM

**Status:** OPTIONAL (lower priority, enhances flexibility)

**Steps:**
1. Install OpenClaw.app on MacBook (or CLI)
2. Set up LM Studio with models (personal preference)
3. Run separate onboarding (different profile)
4. Configure independent agent ("Dev" or "Mobile")
5. Use different messaging accounts (separate channels)
6. Test offline capability with local LLM

**Deliverables:**
- [ ] MacBook gateway running with separate config
- [ ] LM Studio configured with preferred models
- [ ] MacBook agent uses local LLM (LM Studio)
- [ ] Different workspace, sessions, channels
- [ ] Can work offline (no homelab dependency)
- [ ] Can also connect to homelab gateway as client

**Success Criteria:**
- ✅ MacBook gateway independent of homelab
- ✅ Local LLM (LM Studio) working for MacBook agent
- ✅ Works offline (airplane mode, etc.)
- ✅ No channel conflicts (different accounts)
- ✅ Can access homelab gateway via Tailscale when online

**Note:** MacBook LLM is NOT used by homelab agents - reliability requirement

**MacBook Gateway Setup:**
```bash
# Install OpenClaw (if not using .app)
npm install -g openclaw@latest

# Use separate profile
openclaw --profile macbook onboard

# Creates:
# ~/.openclaw-macbook/openclaw.json
# ~/.openclaw-macbook/sessions/
# ~/.openclaw/workspace-macbook/

# Start gateway
openclaw --profile macbook gateway --port 18789

# Or use OpenClaw.app (menubar, GUI onboarding)
````

---

## Phase 5: Option 2 Design & Experimentation (Strategic)

**Goal:** Design distributed gateway architecture, implement when ready

**Status:** STRATEGIC (design phase, implementation when homelab stable)

**Design Phase (Before Implementation):**

1. Document use cases for distributed gateways
2. Design Consul KV message bus architecture
3. Plan agent-to-gateway mapping strategy
4. Identify technical risks and mitigations
5. Create decision criteria (when to implement vs stick with Option 3)

**Implementation Phase (After Design Approval):**

1. Deploy second gateway on Bobby node (Nomad job)
2. Each gateway has one agent (not three)
3. Use Consul KV-based messaging for A2A
4. Test inter-gateway communication
5. Document challenges and workarounds

**Design Deliverables:**

- [ ] Use case document (why distributed vs single gateway)
- [ ] Consul KV schema design (message bus, discovery)
- [ ] Agent-to-gateway mapping strategy
- [ ] Risk assessment and mitigation plan
- [ ] Go/no-go decision criteria

**Implementation Deliverables (if pursued):**

- [ ] Second Nomad job: `openclaw-bobby.nomad.hcl`
- [ ] Consul KV message bus working
- [ ] Cross-gateway agent discovery
- [ ] Custom A2A implementation proven
- [ ] Case study written for community

**Strategic Questions - ANSWERED:**

1. **Use case**: What problem does Option 2 solve that Option 3 doesn't?
   - ✅ **Eliminate SPOF**: Network engineer requirement - no single points of failure
   - ✅ **Full homelab utilization**: Use all 3 nodes (Jerry, Bobby, Billy), not just one
   - ✅ **True agent farm**: Replace LangGraph prototype with distributed OpenClaw architecture
   - ✅ **Enterprise pattern**: Home version of enterprise multi-node design

2. **Demo value**: Is distributed architecture impressive enough to justify complexity?
   - ✅ **Yes**: Technical demo for network engineering community
   - ✅ **Beyond homelab**: Showcase enterprise-grade distributed agent architecture
   - ✅ **Novel implementation**: No one has built this with OpenClaw yet

3. **Community contribution**: Would OpenClaw maintainers benefit from this research?
   - ✅ **Yes**: Willing to write case studies and contribute learnings
   - ✅ **Patterns**: Multi-gateway coordination, A2A over Consul KV
   - ✅ **Use case validation**: Distributed agent farm requirements

4. **Operational cost**: Can you maintain 3 gateways long-term vs 1 gateway?
   - ✅ **Yes**: This is the goal - homelab is designed for this
   - ✅ **Infrastructure exists**: Nomad, Consul, observability already in place
   - ✅ **Acceptable trade-off**: Complexity justified by SPOF elimination

5. **Technical feasibility**: Are there fundamental OpenClaw limitations?
   - ⏳ **To be determined**: Design and testing phase required
   - 🔬 **Research needed**: Multi-gateway A2A patterns, session coordination
   - 📋 **Existing patterns**: Look at LangGraph multi-agent, other A2A frameworks

**Risk Assessment:**

- ⚠️ High complexity (3x operational burden)
- ⚠️ Unsupported territory (you're on your own)
- ⚠️ May hit fundamental limitations
- ✅ Novel research (no one's done this)
- ✅ Demo potential (if successful)
- ✅ Strategic learning (even if not production-ready)

**Option 2 Readiness Gates (Before Implementation):**

- [ ] Define baseline metrics from Option 3 for direct comparison:
  - `p95` end-to-end task latency
  - Task success rate
  - MTTR after single-node failure
  - Duplicate or missed message rate
  - Weekly operational overhead (hours/week)
- [ ] Define minimum improvement thresholds required to justify Option 2 complexity.
- [ ] Time-box Option 2 R&D and include a stop condition if thresholds are not met.

**Inter-Gateway Message Contract (Required):**

- [ ] Standard envelope fields:
  - `message_id`, `correlation_id`
  - `source_gateway`, `source_agent`
  - `target_gateway`, `target_agent`
  - `created_at`, `ttl`, `retry_count`
  - `state` (`queued|delivered|acked|failed|dead-letter`)
- [ ] Idempotency rule: reprocessing the same `message_id` must be safe and side-effect free.
- [ ] Version the message schema (`schema_version`) and reject unknown major versions.

**Loop Prevention + Safety Controls:**

- [ ] Max hop count (`max_hops`) per message.
- [ ] Per-gateway dedupe cache keyed by `message_id` + `source_gateway`.
- [ ] Explicit non-rebroadcast flag for terminal deliveries.
- [ ] Dead-letter queue path for poison/expired messages.

**Failure Semantics (Must Be Explicit):**

- [ ] Ack timeout and retry/backoff policy.
- [ ] Delivery state transitions with observability events at each transition.
- [ ] Clear rules for expired TTL, max retries exceeded, and partial failure handling.
- [ ] Alerting criteria for stuck queues, retry storms, and dead-letter growth.

**Security Requirements (Cross-Gateway):**

- [ ] Gateway-to-gateway authentication and sender identity verification.
- [ ] Per-agent authorization policy for which remote agents can invoke which capabilities.
- [ ] Transport security with integrity guarantees (signed payloads or equivalent trust model).
- [ ] Secret rotation playbook for gateway credentials/tokens.

**Recommended Experiment Sequence (Smallest Useful Path):**

1. Implement one one-way path only (Jerry -> Bobby infrastructure query) with ack.
2. Inject fault scenarios (drop, duplicate, delay, partition) and verify behavior.
3. Prove no duplicate side effects under retries.
4. Compare measured outcomes against Option 3 baseline.
5. Decide go/no-go using predefined thresholds.

**Decision Point:** After Phase 1-4 stable, review design and decide whether to implement

---

## Configuration Files

### Nomad Job Spec (Phase 1)

**File:** `terraform/openclaw/openclaw.nomad.hcl`

```hcl
job "openclaw" {
  datacenters = ["dc1"]
  type        = "service"

  # Pin to Jerry node for state persistence
  constraint {
    attribute = "${node.unique.name}"
    value     = "jerry"
  }

  group "gateway" {
    count = 1

    network {
      port "http" {
        static = 18789
        to     = 18789
      }
      port "bridge" {
        static = 18790
        to     = 18790
      }
      port "canvas" {
        static = 18793
        to     = 18793
      }
    }

    volume "openclaw-config" {
      type      = "host"
      source    = "openclaw-config"
      read_only = false
    }

    volume "openclaw-workspace" {
      type      = "host"
      source    = "openclaw-workspace"
      read_only = false
    }

    task "gateway" {
      driver = "podman"

      config {
        image = "${OPENCLAW_IMAGE}"  # From Terraform variable
        ports = ["http", "bridge", "canvas"]

        args = [
          "node",
          "dist/index.js",
          "gateway",
          "--bind", "lan",
          "--port", "18789",
        ]

        # Rootless Podman
        userns_mode = "host"
      }

      volume_mount {
        volume      = "openclaw-config"
        destination = "/home/node/.openclaw"
        read_only   = false
      }

      volume_mount {
        volume      = "openclaw-workspace"
        destination = "/home/node/.openclaw/workspace"
        read_only   = false
      }

      env {
        HOME = "/home/node"
        TERM = "xterm-256color"

        # Infrastructure CLIs
        NOMAD_ADDR       = "http://nomad.service.consul:4646"
        CONSUL_HTTP_ADDR = "http://127.0.0.1:8500"

        # LLM providers
        LITELLM_BASE_URL = "https://litellm.shamsway.net"  # Homelab LiteLLM gateway (with observability)
      }

      # 1Password secrets injection
      template {
        data = <<EOT
{{with secret "kv/data/openclaw"}}
OPENCLAW_GATEWAY_TOKEN={{.Data.data.gateway_token}}
ANTHROPIC_API_KEY={{.Data.data.anthropic_api_key}}
LITELLM_API_KEY={{.Data.data.litellm_api_key}}
ZAI_API_KEY={{.Data.data.zai_api_key}}
OP_SERVICE_ACCOUNT_TOKEN={{.Data.data.op_service_account_token}}
SLACK_BOT_TOKEN={{.Data.data.slack_bot_token}}
SLACK_APP_TOKEN={{.Data.data.slack_app_token}}
DISCORD_TOKEN={{.Data.data.discord_token}}
{{end}}
EOT
        destination = "secrets/openclaw.env"
        env         = true
      }

      service {
        name = "openclaw"
        port = "http"
        tags = [
          "openclaw",
          "gateway",
          "traefik.enable=true",
          "traefik.http.routers.openclaw.rule=Host(`openclaw.yourdomain.com`)",
          "traefik.http.routers.openclaw.tls=true",
        ]

        check {
          type     = "http"
          path     = "/health"
          interval = "10s"
          timeout  = "2s"
        }
      }

      resources {
        cpu    = 1000  # 1 CPU
        memory = 2048  # 2GB
      }

      # Restart policy
      restart {
        attempts = 3
        delay    = "15s"
        interval = "5m"
        mode     = "fail"
      }
    }
  }
}
```

### Multi-Agent Configuration (Phase 1)

**File:** `~/.openclaw/openclaw.json` (on homelab Jerry node)

```json5
{
  // Model providers
  // Anthropic uses env/auth profiles directly.
  models: {
    mode: "merge",
    // Optional homelab LiteLLM proxy (not MacBook-dependent).
    providers: {
      litellm: {
        baseUrl: "${LITELLM_BASE_URL}",
        apiKey: "${LITELLM_API_KEY}",
        api: "openai-completions",
        models: [
          {
            id: "local-llama-70b",
            name: "Local Llama 70B",
            contextWindow: 32768,
            maxTokens: 4096,
          },
        ],
      },
    },
  },

  // Multi-agent configuration
  agents: {
    defaults: {
      sandbox: {
        mode: "non-main",
        scope: "agent",
      },
    },
    list: [
      {
        id: "jerry",
        name: "Jerry (General Hub)",
        description: "General-purpose assistant for Slack/Discord queries",
        workspace: "~/.openclaw/workspace-jerry",
        model: "zai/glm-4.7",
        sandbox: {
          mode: "off", // Jerry has full access
        },
      },
      {
        id: "bobby",
        name: "Bobby (Infrastructure)",
        description: "Autonomous infrastructure monitoring and health checks",
        workspace: "~/.openclaw/workspace-bobby",
        model: "zai/glm-4.7",
        sandbox: {
          mode: "non-main",
        },
        tools: {
          exec: {
            security: "allowlist",
            safeBins: ["nomad", "consul", "curl", "jq"],
          },
        },
      },
      {
        id: "billy",
        name: "Billy (Automation)",
        description: "Scheduled tasks and automation (GLM-first test profile)",
        workspace: "~/.openclaw/workspace-billy",
        model: {
          primary: "zai/glm-4.7",
          fallbacks: ["zai/glm-5", "moonshot/kimi-k2-0905-preview"],
        },
        sandbox: {
          mode: "all",
          workspaceAccess: "rw",
        },
      },
    ],
  },

  // Channel routing to agents
  bindings: [
    // Slack private channels per agent
    {
      agentId: "jerry",
      match: {
        channel: "slack",
        teamId: "T255F0YHW",
        peer: { kind: "channel", id: "C0AF7JDDBB8" }, // #jerry
      },
    },
    {
      agentId: "bobby",
      match: {
        channel: "slack",
        teamId: "T255F0YHW",
        peer: { kind: "channel", id: "C0AF9LAUWPL" }, // #bobby
      },
    },
    {
      agentId: "billy",
      match: {
        channel: "slack",
        teamId: "T255F0YHW",
        peer: { kind: "channel", id: "C0AEU73AYNB" }, // #billy
      },
    },

    // Keep Jerry in #home-automation for now
    {
      agentId: "jerry",
      match: {
        channel: "slack",
        teamId: "T255F0YHW",
        peer: { kind: "channel", id: "G01A46T1546" }, // #home-automation (private)
      },
    },

    // Discord direct chats:
    // peer.id is the SENDER USER ID (not the bot/application id).
    // With one Discord user account, DMs route to one agent; use Discord channels for per-agent split.
    {
      agentId: "jerry",
      match: {
        channel: "discord",
        peer: { kind: "direct", id: "DISCORD_USER_ID" },
      },
    },

    // Cron/scheduled tasks target agents by job.agentId (not bindings).
  ],

  // Gateway configuration
  gateway: {
    port: 18789,
    bind: "lan", // Accessible over Tailscale

    // Tailscale Serve is disabled in this initial LAN-bound state.
    // If enabling Serve/Funnel later, switch bind to "loopback".
    tailscale: {
      mode: "off",
      resetOnExit: false,
    },
  },

  // Channels (configure as needed)
  channels: {
    slack: {
      enabled: true,
      token: "${SLACK_BOT_TOKEN}",
      appToken: "${SLACK_APP_TOKEN}",
    },
    discord: {
      enabled: true,
      token: "${DISCORD_TOKEN}",
    },
  },

  // Cron scheduler settings
  cron: {
    enabled: true,
    maxConcurrentRuns: 2,
    sessionRetention: "6h",  // Rotate isolated sessions every 6h to cap context accumulation
  },
}
```

```bash
# Add cron jobs via CLI (recommended; persisted in cron/jobs.json)
# Bobby heartbeat — every 15 minutes, announces to #bobby Discord channel
openclaw cron add \
  --name "Bobby heartbeat" \
  --cron "*/15 * * * *" \
  --session isolated \
  --agent bobby \
  --announce \
  --channel discord \
  --to "channel:1472975617111625902" \
  --message "Run your full heartbeat checklist from HEARTBEAT.md, including phil_keeper. Follow PHIL_POLICY.md and PHIL_WORKFLOW.md exactly. Enforce dedupe (5m), restart budget (max 5/24h), and manual-review suppression (60m). If and only if initiating a restart action, say exactly: HEY PHIL, WAKE UP! Then report decision, status, and restart budget."

# Billy daily summary — 9am UTC, announces to #billy Discord channel
openclaw cron add \
  --name "Billy daily summary" \
  --cron "0 9 * * *" \
  --session isolated \
  --agent billy \
  --announce \
  --channel discord \
  --to "channel:1472975656542539796" \
  --message "Generate your daily infrastructure summary. Read memory/task-state.json for recent task results. Review HEARTBEAT.md for what to report. Provide a concise summary of what automation ran overnight, any issues encountered, and overall automation health. Keep it brief."
```

> **Session rotation note:** With `sessionRetention: "6h"` in the `cron` config, OpenClaw
> automatically creates a fresh isolated session every 6 hours for each cron job, preventing
> unbounded context accumulation. Without this setting, isolated cron sessions accumulate all
> runs indefinitely — a 687KB session with 728 messages was observed after 8.5 hours of
> 15-minute heartbeat runs. The 6h window allows ~24 runs of context (enough for pattern
> recognition) while staying well within the 128K token context limit.
>
> If a session grows problematic before the retention window expires (e.g. Bobby starts
> hallucinating or failing), manually reset by running:
> ```bash
> openclaw cron rm <job-id> && openclaw cron add ...  # same params, fresh session
> ```

---

## Testing & Validation

### Phase 1 Validation

**Gateway Health:**

```bash
# From any Tailscale node
curl http://jerry.tailscale:18789/health

# Via Nomad
nomad status openclaw
nomad logs -f openclaw

# Consul service
consul catalog services | grep openclaw
```

**Agent Testing:**

```bash
# Test Jerry (via Slack)
# Send message in Slack: "Hello Jerry"

# Test Bobby (via sessions_send from Jerry)
# In Slack to Jerry: "Ask Bobby to check Nomad status"

# Test Billy (via cron job or manual trigger)
openclaw agent --agent billy --message "Test scheduled automation path"
```

### Phase 2 Validation

**Channel Routing:**

```bash
# Test Slack private channels
# In #jerry: "Hello Jerry, what's the status?"
# In #bobby: "Check Nomad cluster health"
# In #billy: "Run automation dry-run"
# In #home-automation: Jerry should still respond

# Test Discord DMs
# DM Jerry account binding: "Status?"
# DM Bobby account binding: "Check Consul health"
# DM Billy account binding: "List scheduled tasks"

# Verify A2A communication
# In Slack: "Ask Bobby to check Consul services"
# Jerry should use sessions_send to Bobby, then relay response
```

### Phase 3 Validation

**Consul KV:**

```bash
# Check agent registry
consul kv get -recurse /openclaw/agents/

# Check Bobby's heartbeat
consul kv get /openclaw/agents/bobby/last_check
consul kv get /openclaw/agents/bobby/last_check_result

# Check shared state
consul kv get -recurse /openclaw/shared-state/
```

---

## Operational Runbook

### Daily Operations

**Check Gateway Health:**

```bash
# Nomad status
nomad status openclaw

# Gateway health endpoint
curl http://jerry.tailscale:18789/health

# Agent status via Consul KV (Phase 3)
consul kv get -recurse /openclaw/agents/ | grep status
```

**View Logs:**

```bash
# Via Nomad
nomad logs -f openclaw

# Via Consul (if using logging integration)
consul kv get /openclaw/gateways/jerry-gateway/last_logs
```

**Restart Gateway:**

```bash
# Graceful restart via Nomad
nomad job restart openclaw

# Force restart
nomad job stop openclaw && nomad job run openclaw.nomad.hcl
```

### Troubleshooting

**Channel Connection Issues:**

```bash
# Check Slack connection
nomad logs openclaw | grep -i slack

# Check Discord connection
nomad logs openclaw | grep -i discord

# WhatsApp is intentionally paused in this phase.

# Test channel routing
# Send test message on each channel, verify correct agent responds
```

**Agent Not Responding:**

```bash
# Check agent config
nomad exec openclaw cat /home/node/.openclaw/openclaw.json | jq '.agents.list'

# Check sessions
openclaw sessions list

# Restart specific agent (requires gateway restart)
nomad job restart openclaw
```

**Consul KV Issues:**

```bash
# Check Consul connectivity
consul members

# Verify KV access
consul kv get -recurse /openclaw/

# Reset agent registry (if corrupted)
consul kv delete -recurse /openclaw/agents/
# Agents will re-register on next heartbeat
```

---

## Cost Analysis

### Estimated Monthly Costs (Option 3)

**All homelab agents use GLM-first stack during testing:**

- Jerry tasks: ~500K tokens/day × GLM pricing
- Bobby tasks: ~200K tokens/day × GLM pricing
- Billy tasks: ~300K tokens/day × GLM pricing
- **Total: depends on current GLM tier + failover usage**

**MacBook agent (optional, Phase 4):**

- Uses local LLM (LM Studio) when MacBook is on
- $0 LLM cost for MacBook agent tasks
- Minimal power cost (~$1/month for inference)
- **No impact on homelab cost** (separate gateway, separate agent)

**Future job-specific agents:**

- Cost scales linearly with agent count
- Consider using GLM Flash / GLM-5 fallback mix for low-priority agents
- Or use multi-agent routing to consolidate similar tasks

---

## Success Metrics

### Phase 1 (Gateway Foundation)

- ✅ Uptime: >99% (Nomad restart time <30s)
- ✅ Response time: <2s for agent queries
- ✅ A2A latency: <500ms for sessions_send
- ✅ Resource usage: <2GB RAM, <1 CPU

### Phase 2 (Channels)

- ✅ Slack response time: <2s
- ✅ Discord response time: <2s
- ✅ WhatsApp readiness: explicitly paused (no production expectation yet)
- ✅ No duplicate responses across channels
- ✅ Channel routing accuracy: 100%

### Phase 3 (Consul KV)

- ✅ Agent discovery latency: <100ms
- ✅ Heartbeat reliability: >99.5%
- ✅ Consul KV write latency: <50ms
- ✅ Dashboard load time: <1s

---

## Future Enhancements

### Short-term (Months 2-3)

- [ ] Redis integration for fast shared memory
- [ ] Obsidian vault sync for human-readable state
- [ ] Advanced Bobby skills (auto-remediation)
- [ ] Billy task queue system via Consul KV
- [ ] Traefik HTTPS with Let's Encrypt
- [ ] Grafana dashboard for agent metrics

### Long-term (Months 4-6)

- [ ] Option 2 proof-of-concept (second gateway on Bobby node)
- [ ] Custom A2A message bus (Consul-based)
- [ ] Multi-gateway service mesh
- [ ] Distributed agent coordination patterns
- [ ] Community contribution (case study, blog post)

---

## References

### Internal Documentation

- [Multi-Node Deployment Analysis](./MULTI_NODE_DEPLOYMENT_ANALYSIS.md) - Architecture options deep dive
- [Gateway Architecture Guide](./gateway-architecture-guide.md) - Single vs multi-gateway patterns
- [Multi-Agent Strategy](./homelab/strategy/multi-agent-strategy.md) - Agent separation principles
- [Networking Guide](./homelab/NETWORKING.md) - Consul DNS and service discovery

### OpenClaw Official Docs

- Gateway Configuration: https://docs.openclaw.ai/gateway/configuration
- Multi-Agent Setup: https://docs.openclaw.ai/concepts/multi-agent
- Nomad Deployment: https://docs.openclaw.ai/install/nomad (if available)
- Sandbox Mode: https://docs.openclaw.ai/gateway/sandboxing
- Remote Access: https://docs.openclaw.ai/gateway/remote

### External Resources

- LiteLLM Documentation: https://docs.litellm.ai/
- LM Studio Documentation: https://lmstudio.ai/docs
- Consul KV API: https://www.consul.io/api-docs/kv
- Nomad Podman Driver: https://www.nomadproject.io/docs/drivers/podman
- ZAI API: https://open.bigmodel.cn/ (GLM models)

### Related Documentation

- [Option 2 Design Brief](./OPTION_2_DESIGN_BRIEF.md) - Strategic design for distributed agent farm
- [Multi-Node Deployment Analysis](./MULTI_NODE_DEPLOYMENT_ANALYSIS.md) - Architecture options analysis

---

## Changelog

### v2.9 (2026-02-18)

- **Consul DNS confirmed working:** Investigated container DNS and confirmed `*.service.consul`
  resolves correctly inside the container via Podman's aardvark-dns chain:
  `container → aardvark-dns (10.89.2.1) → host dnsmasq → Consul :8600`.
  No workarounds needed. The `dns:` entries in `docker-compose.yml` corrected
  (`.7, .8` → `.6, .7`); they are currently overridden by aardvark-dns in Podman 4.x but
  will be honoured in Podman 5.x. `NETWORKING.md` rewritten with accurate architecture,
  verification commands, Podman 5.x migration path, and historical note on the removed
  `extra_hosts` workaround.
- **mcporter.json persistence:** `openclaw-agents/jerry/mcporter.json` created and mounted as
  a volume into the container (`/root/.mcporter/mcporter.json:ro`). MCP server URLs now
  survive container restarts without an image rebuild. Previous image (2026.2.16) had stale
  mcporter.json baked in (tailscale at wrong port 25820 instead of 29178; gcp-mcp-server
  missing entirely). Both are now correct in the mounted file.
- **Bobby MCP tools restored:** With the mcporter fix, Bobby can now reach all 5 MCP servers
  including `tailscale-mcp-server` (port 29178) and `gcp-mcp-server`. Phil keeper can now
  autonomously check Phil's GCP power state and Tailscale mesh presence.
- **Phil TERMINATED:** Phil GCP VM was found in TERMINATED state (~2.5h downtime). Bobby's
  next heartbeat run will detect it via GCP MCP and restart per PHIL_POLICY.md (budget: 0/5).
- **Gateway config updates applied:** `session.maintenance`, `channelHealthCheckMinutes: 5`,
  `gateway.auth.rateLimit`, and `gateway.http.endpoints` (chat completions + responses disabled)
  — all from `homelab-base-config.json` feature notes.
- **CLAUDE.md overhauled:** Added cron command reference (list, runs, add with all flags,
  edit/enable/disable/rm), mcporter management (verify, call, persist, regenerate), container
  config persistence table, Consul DNS quick-verify, new known issues (announce delivery failure
  and Bobby MCP missing tools).
- **`openclaw-agents/CLAUDE.md` unmodified** — agent-repo CLAUDE.md remains focused on
  skill tooling and agent workspace layout.

### v2.8 (2026-02-18)

- **Phase 1.75 complete:** All deliverables done. Cron running overnight confirmed healthy.
- **Bobby overnight validation:** Heartbeat cron ran continuously at `*/15 * * * *`. Session logs
  confirm Bobby detected and documented a ~1-hour Consul DNS outage (Feb 17 21:47–22:48 UTC) and
  its recovery — exactly the behavior the monitor was designed for. All 47 Nomad jobs healthy;
  78 Consul checks passing; Phil VM online (0 restarts triggered).
- **Session rotation fix:** Bobby's isolated cron session had accumulated 728 messages (687 KB)
  across 34+ runs after 8.5 hours — root cause: `wakeMode: "now"` resumes the existing isolated
  session on each cron trigger. Fixed by adding `"sessionRetention": "6h"` to the `cron` block in
  `openclaw-agents/jerry/openclaw.json`. Sessions now auto-rotate every 6h (~24 runs), keeping
  context well within the 128K token limit. Bobby's accumulated session was manually reset (cron
  job rm + re-add: new ID `d5f388b3`). Gateway restarted to apply config.
- **Billy daily summary cron added:** `0 9 * * *`, isolated session, Discord announce to `#billy`
  (channel `1472975656542539796`). Job ID: `164d53d4`. First run at 09:00 UTC.
- **HTTP health endpoints defined:** `bobby/workspace/HEARTBEAT.md` updated with concrete endpoints
  for the `http_health` check (gateway `http://127.0.0.1:18789/health`, Nomad leader API,
  Nomad MCP, Infra MCP). Previously this check slot was defined but never populated with URLs.
- **Bobby cluster layout documented:** `bobby/workspace/TOOLS.md` Cluster Layout section filled in
  with known values: Nomad/Consul DC, API addresses, Tailscale nodes (jerry/bobby/billy/phil),
  disk thresholds, HTTP endpoints.
- **Cron config example updated:** Plan now shows correct `*/15 * * * *` interval, full heartbeat
  message payload, and `sessionRetention: "6h"`. Session rotation rationale documented.
- **Consul DNS note:** Bobby's `TOOLS.md` was written during a 1-hour DNS outage on Feb 17
  21:47–22:48 UTC and incorrectly said Consul DNS was unavailable. Corrected in v2.9 —
  Consul DNS works via the aardvark-dns → host dnsmasq chain.

### v2.7 (2026-02-18)

- **Image rebuilt (2026.2.16):** Incorporates upstream OpenClaw code merge, lobster CLI
  (`@clawdbot/lobster 2026.1.24`), and updated mcporter config with all 5 MCP servers.
- **Bobby tool validation complete:** All 6 runbook gates passed. See `BOBBY_TOOL_VALIDATION_RUNBOOK.md`
  for full sign-off record. Bobby is cleared for cron/timed workflows.
- **GCP MCP server added:** `gcp-mcp-server` added to `homelab/.mcp.json`
  (`http://gcp-mcp-server.service.consul:22241/mcp`; Traefik: `https://gcp-mcp.shamsway.net`).
  Bobby validated `validate_gcp_auth`, `list_vms`, and `get_vm_status` end-to-end. Phil VM
  confirmed `RUNNING` in GCP project `octant-426722`, zone `us-central1-a`.
  Bobby and Billy `TOOLS.md` updated with GCP MCP server documentation.
- **Tailscale MCP port updated:** `tailscale-mcp-server` moved from port `25820` to `29178`.
  Updated in `homelab/.mcp.json` and all references in this plan.
- **Note — tailscale-mcp-server auth:** During validation, `list_devices` initially returned
  empty results (no API key configured). Resolved. Phil confirmed online at `100.100.120.128`.
- **Phil recovery path wired up:** Bobby can now check Phil via both Tailscale MCP
  (mesh presence) and GCP MCP (VM power state) and start it if down.
- **Billy remote node up:** Billy node container running on Billy host, paired and validated.
  Both remote nodes (Bobby + Billy) now connected (2/2).
- **Next:** Add cron jobs — Bobby heartbeat (`*/15 * * * *`) + Billy daily summary (`0 9 * * *`).

### v2.6 (2026-02-17)

- **Remote node exec validated:** Jerry successfully dispatched `uname -a` to Bobby Remote Node
  via the `nodes` tool (`action: "run"`). Bobby's exec-approvals allowlist already had
  `/usr/bin/uname` from prior CLI setup.
- **Root cause documented:** The earlier test ("use exec on Bobby Remote Node") returned
  Jerry's own container hostname (`aced7e8cca59`) because `nodes` was in Jerry's deny list.
  Without `nodes`, the `exec` tool from the coding profile can only run locally in the gateway
  container — no error, no warning, silent fallback to local.
- **Fix — Jerry:** Removed `"nodes"` from deny, added `"nodes"` to `alsoAllow`. `nodes` is not
  in the `coding` profile, so it must be explicitly added via `alsoAllow` and must not appear in
  `deny`. Requires gateway restart (applied).
- **Fix — Bobby:** Same change. Bobby as a monitoring agent benefits from being able to run
  diagnostic commands directly on remote nodes.
- **Billy unchanged:** `nodes` remains denied for Billy until a Billy remote node is deployed.
- **Phase 1.5 Step 6 examples updated** to reflect correct `nodes`-inclusive config for Jerry and
  Bobby. Added explanatory note on the silent local-fallback behavior when `nodes` is denied.

### v2.5 (2026-02-17)

- **A2A verified:** Jerry → Bobby `sessions_spawn` confirmed working. Bobby ran in a subagent
  session (`agent:bobby:subagent:…`) and responded in-character with full tool access.
  Root cause of earlier failure: `subagents.allowAgents` was not set on agent configs —
  added `["bobby","billy"]` to Jerry, `["jerry","billy"]` to Bobby, `["jerry","bobby"]` to Billy
  in `openclaw-agents/jerry/openclaw.json`. Requires gateway restart to apply (done).
- **Lobster CLI:** Added `npm install -g @clawdbot/lobster` to `homelab/Dockerfile`. The
  `@clawdbot/lobster` npm package installs the `lobster` binary on PATH. Requires image rebuild.
- **MCP config fixed:** `homelab/.mcp.json` updated with all four MCP servers using internal
  HTTP URLs. Previous config had the external Traefik URL for `mcp-nomad-server` (unreachable
  from inside container) and was missing `infra-mcp-server` and `tailscale-mcp-server` entirely.
  Requires image rebuild (mcporter config is baked at build time from `.mcp.json`).
- **Phase 1.75 added:** New phase covering MCP validation + remote node bringup, sequenced
  before cron job configuration. Remote nodes (Bobby/Billy hosts) must be paired with Jerry
  gateway and verified before cron is useful.
- **Next:** Rebuild image with lobster CLI + updated MCP config → verify MCP tools → bring
  up Bobby/Billy remote node containers → validate remote tool execution → then add cron jobs.

### v2.4 (2026-02-17)

- **Phase 1.5 mostly complete:** `lobster` and `llm-task` plugins enabled and running.
  `memory-lancedb` and `diagnostics-otel` npm deps baked into image; both ready to enable
  once their prerequisites are met (no further image changes needed).
- **Plugin persistence clarified:** Stock plugins with no external deps (lobster, llm-task,
  thread-ownership) are enabled by editing `openclaw-agents/jerry/openclaw.json` directly —
  no `plugins enable` CLI commands required. Config is the source of truth and is bind-mounted.
  Plugins with external npm deps (memory-lancedb, diagnostics-otel) require those deps to be
  `npm install`-ed in the Dockerfile; done via `npm pkg delete devDependencies && npm install
--omit=dev --ignore-scripts` to strip pnpm workspace: references before calling npm.
- **Dockerfile:** Added `npm install` steps for `extensions/memory-lancedb` and
  `extensions/diagnostics-otel` so their native/OTel deps are available in the image.
- **ctl.sh:** Added `node-up`, `node-down`, `node-restart`, `node-logs`, `node-ps` commands
  for managing remote node containers via `docker-compose.remote-nodes.yml`. Updated remote
  nodes section of plan to use these commands instead of raw podman-compose invocations.
- **Repo hygiene:** Removed stale agent workspace files (`homelab/jerry/`, `homelab/bobby/`,
  `homelab/billy/`). All agent files now live exclusively in `../openclaw-agents/<agent>/`.
  Updated `CLAUDE.md` with explicit callout and updated all stale path references.
- **TOOLS.md:** Added "OpenClaw Native Tools" section to Jerry/Bobby/Billy workspace TOOLS.md
  files documenting `lobster` and `llm-task` (Jerry only) with usage notes per agent role.
- **Known issue (upstream):** Gateway logs `[tools] tools.profile (coding) allowlist contains
unknown entries (group:memory)` on startup. This is a false positive in upstream
  `stripPluginOnlyAllowlist` — memory tools work correctly. Will resolve when upstream fix
  is merged.
- **Next:** Install `lobster` CLI binary in Dockerfile; configure `diagnostics-otel` once
  OTel collector endpoint is identified; enable `thread-ownership` once slack-forwarder is
  deployed; run A2A test (Jerry → Bobby via `sessions_send`).

### v2.3 (2026-02-17)

- **Phase 1 complete:** Gateway running in Podman compose with Jerry, Bobby, Billy all responding.
  Nomad deployment deferred; Podman compose is sufficient for the current phase.
- **Phase 2 complete:** Slack and Discord routing verified across all dedicated agent channels.
  Several config bugs found and fixed during bring-up (see below).
- **Fix:** `groupPolicy: "allowlist"` on both Slack and Discord blocked all dedicated agent
  channels. Slack had only `#home-automation` in the allowlist; Discord had no guilds configured
  at all (DMs bypassed groupPolicy entirely, explaining why DMs worked while channels didn't).
  Changed both to `groupPolicy: "open"` — bindings control routing, no coarse channel filter needed.
- **Fix:** Slack `requireMention` defaults to `true`, silently dropping any non-@mention message
  in channel contexts. Added `"requireMention": false` to Slack config; dedicated per-agent
  channels should not require @mention.
- **Fix:** Slack bindings had `accountId: "T255F0YHW"` (the Slack team ID). OpenClaw's
  single-account Slack config uses `DEFAULT_ACCOUNT_ID = "default"` internally. The binding
  pre-filter compared `"T255F0YHW" === "default"` → false, so all four Slack bindings were
  filtered out and every message fell through to Jerry (default agent). Removed `accountId`
  from all Slack bindings; an absent `accountId` matches the default account correctly.
- **Operational note:** `bindings` is a `kind: "none"` reload path — the file watcher detects
  changes but channel providers (Slack, Discord) are NOT restarted. `ctx.cfg` is captured at
  provider startup via `loadConfig()`. **Any change to `bindings` requires a gateway restart**
  (`./homelab/ctl.sh restart`) to take effect. Channel config changes (e.g. `requireMention`,
  `groupPolicy`) do trigger a channel provider restart and hot-reload without a full restart.
- **Fix:** Bobby and Billy standalone configs (`bobby/openclaw.json`, `billy/openclaw.json`)
  updated to match Jerry: ZAI endpoint → `anthropic-messages`, `allow` → `alsoAllow`.
  These configs are not currently mounted in the gateway container but should stay in sync.
- **Documented:** Slack bot must be manually invited to private channels via `/invite @<bot-name>`
  before any events are delivered. Bot cannot invite itself; `conversations.invite` returns
  `channel_not_found` for private channels from the bot token.
- **Next:** A2A test (Jerry → Bobby via `sessions_send`), Billy cron validation,
  Phase 1.5 plugin installation.

### v2.2 (2026-02-16)

- **Fix:** Phase 1.5 Step 6 agent allowlist examples corrected from `allow` to `alsoAllow`.
  `allow` is a strict replacement of the profile tool set; `alsoAllow` is additive.
  Using `allow` silently strips all `coding` profile tools (exec, read, write, session_status, etc.).
- **Fix:** ZAI provider baseUrl updated from `https://api.z.ai/api/paas/v4` to
  `https://api.z.ai/api/anthropic`, and `api` changed from `openai-completions` to
  `anthropic-messages`. The coding endpoint does not emit structured function-call JSON —
  the Anthropic-compatible endpoint does. Root cause of agents hallucinating tool names
  rather than calling them.
- Added warning callout to Step 6 explaining the `allow` vs `alsoAllow` distinction.
- Updated ZAI provider config example in Phase 2 with correct endpoint and API type.

### v2.1 (2026-02-16)

- Added **Phase 1.5: Plugin Installation & Configuration** covering memory-core,
  memory-lancedb (upgrade path), thread-ownership, lobster, llm-task, and diagnostics-otel
- Documented agent tool allowlist changes required for lobster and llm-task (optional tools)
- Added validation steps and success criteria for each plugin

### v2.0 (2026-02-16)

- Refocused on **Option 3 (Hybrid)** as primary architecture
- Positioned **MacBook local-LLM gateway** as optional independent Phase 4
- Designed **Consul KV infrastructure** for Phase 3
- Included **Option 2 experimentation path** for future
- Added **cost analysis** showing local LLM savings
- Expanded **validation steps** for each phase
- Added **operational runbook** section

### v1.0 (2026-01-31)

- Initial deployment plan
- Podman-first approach
- Three-phase progression (standalone → Octant → Nomad)
- Generic multi-agent discussion

---

**Next Steps (Phase 2 complete → Phase 3 and beyond):**

1. ✅ ~~**Bring up Bobby remote node**~~ — Bobby Remote Node paired, connected, and exec validated
2. ✅ ~~**Enable `nodes` tool for Jerry/Bobby**~~ — removed from deny, added to alsoAllow; gateway restarted
3. ✅ ~~**Rebuild image**~~ — image `2026.2.16` built with lobster CLI + updated mcporter config (5 MCP servers)
4. ✅ ~~**Verify MCP tools**~~ — all 5 servers validated; Bobby tool validation runbook all gates passed
5. ✅ ~~**Bring up Billy remote node**~~ — Billy Remote Node paired and validated
6. ✅ ~~**Add cron jobs**~~ — Bobby heartbeat (`*/15 * * * *`) running overnight; Billy daily summary (`0 9 * * *`) added
7. ✅ ~~**Configure cron session retention**~~ — `sessionRetention: "6h"` added; Bobby session reset to clear 687KB accumulation
8. ✅ ~~**HTTP health endpoints**~~ — defined in `bobby/workspace/HEARTBEAT.md`; cluster layout documented in `TOOLS.md`
9. ✅ ~~**Consul DNS in container**~~ — confirmed working via aardvark-dns → host dnsmasq chain; `NETWORKING.md` updated with accurate state
10. ✅ ~~**mcporter config persistence**~~ — `jerry/mcporter.json` created in openclaw-agents, mounted as volume in docker-compose.yml; survives restarts without image rebuild

**Remaining (your action items):**
- **`diagnostics-otel`:** Enable once OTel collector endpoint is identified
- **`thread-ownership`:** Enable once slack-forwarder is deployed
- **Bobby cron best-effort-deliver:** Re-create Bobby heartbeat job with `--best-effort-deliver` to prevent false-positive `error` status on transient Discord delivery failures (current job fails ~30% of runs on delivery, not on agent execution)

**Next phase work (Phase 3 - Consul KV, optional):**
- Consul KV schema + `consul-registry` MCP server (see Phase 3 section)
- Bobby heartbeat writes → Consul KV (agent status dashboard)
- Cross-agent coordination patterns
