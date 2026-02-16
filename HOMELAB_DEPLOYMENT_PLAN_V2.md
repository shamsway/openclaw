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
- ✅ Multi-channel support (Slack, Discord, WhatsApp)
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
│  │    ├─ Jerry (Slack/Discord/WhatsApp hub)      │ │
│  │    │   Model: claude-sonnet-4-5 (cloud)        │ │
│  │    │   Channels: Slack, Discord, WhatsApp      │ │
│  │    │                                            │ │
│  │    ├─ Bobby (autonomous monitoring)            │ │
│  │    │   Model: claude-sonnet-4-5 (cloud)        │ │
│  │    │   Heartbeat: Consul/Nomad health checks   │ │
│  │    │                                            │ │
│  │    └─ Billy (scheduled tasks, automation)      │ │
│  │        Model: claude-sonnet-4-5 (cloud)        │ │
│  │        Note: Uses cloud for reliability        │ │
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

### Future Experimentation Path (Option 2 - Distributed)

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

---

## Deployment Phases

### Phase 1: Homelab Gateway Foundation (Week 1)

**Goal:** Single OpenClaw gateway on Nomad with 3 agents

**Status:** READY TO START

**Steps:**

1. ✅ Already done: Podman compose testing (from v1.0 plan)
2. Deploy gateway to Nomad (Jerry node, pinned)
3. Configure 3 agents (Jerry, Bobby, Billy)
4. Set up channel routing (Slack → Jerry, Discord → Bobby)
5. Test built-in A2A (Jerry → Bobby via `sessions_send`)

**Deliverables:**

- [ ] Nomad job spec: `terraform/openclaw/openclaw.nomad.hcl`
- [ ] Multi-agent config: `openclaw.json` with 3 agents
- [ ] Channel bindings configured
- [ ] Health checks passing in Nomad
- [ ] Consul service registration working

**Success Criteria:**

- ✅ Gateway healthy and reachable via Tailscale
- ✅ All 3 agents responding to messages
- ✅ A2A communication between agents works
- ✅ Nomad restarts recover cleanly
- ✅ Logs accessible via Nomad UI

---

### Phase 2: Channel Configuration & Testing (Week 2)

**Goal:** Configure Slack, Discord, WhatsApp and test multi-agent routing

**Status:** READY AFTER PHASE 1

**Steps:**

1. Configure Slack bot (app token, bot token)
2. Configure Discord bot (application, bot token)
3. Configure WhatsApp (Baileys session, QR pairing)
4. Set up channel bindings (route channels to agents)
5. Test message routing and A2A communication
6. Prepare for job-specific agents (workspace structure)

**Deliverables:**

- [ ] Slack bot responding (routed to Jerry)
- [ ] Discord bot responding (routed to Jerry or Bobby)
- [ ] WhatsApp responding (routed to Jerry)
- [ ] Channel bindings tested and working
- [ ] A2A communication verified (Jerry → Bobby)
- [ ] Workspace structure for future agents documented

**Success Criteria:**

- ✅ All 3 channels (Slack, Discord, WhatsApp) working
- ✅ Jerry responds to general queries across channels
- ✅ Bobby responds to infrastructure queries
- ✅ Billy executes scheduled tasks via cron
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

**Note:** LM Studio is used ONLY for MacBook agent, NOT for homelab agents

**Homelab Gateway Config:**

```json5
// ~/.openclaw/openclaw.json (on homelab gateway)
{
  // Use environment/auth profiles for Anthropic.
  // Optional custom providers belong under models.providers.
  models: {
    mode: "merge",
    // Note: No MacBook LM Studio provider - homelab uses cloud for reliability
    providers: {},
  },

  agents: {
    list: [
      {
        id: "jerry",
        name: "Jerry (General Hub)",
        workspace: "~/.openclaw/workspace-jerry",
        model: "anthropic/claude-sonnet-4-5", // Cloud
        description: "General-purpose assistant for Slack/Discord/WhatsApp",
      },
      {
        id: "bobby",
        name: "Bobby (Infrastructure Monitoring)",
        workspace: "~/.openclaw/workspace-bobby",
        model: "anthropic/claude-sonnet-4-5", // Cloud
        description: "Autonomous infrastructure monitoring and health checks",
      },
      {
        id: "billy",
        name: "Billy (Automation)",
        workspace: "~/.openclaw/workspace-billy",
        model: "anthropic/claude-sonnet-4-5", // Cloud (reliable)
        description: "Scheduled tasks and automation",
      },
      // Future: Add job-specific agents here
      // {
      //   id: "deploy-agent",
      //   name: "Deployment Specialist",
      //   workspace: "~/.openclaw/workspace-deploy",
      //   model: "anthropic/claude-sonnet-4-5",
      //   description: "Handles Nomad deployments and rollbacks",
      // },
    ],
  },

  bindings: [
    // Jerry handles Slack, Discord, WhatsApp
    { agentId: "jerry", match: { channel: "slack" } },
    { agentId: "jerry", match: { channel: "discord" } },
    { agentId: "jerry", match: { channel: "whatsapp" } },

    // Bobby handles specific Discord DM or channel (for alerts)
    // { agentId: "bobby", match: { channel: "discord", peer: { kind: "dm", id: "your-dm-id" } } },

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
      url: "wss://jerry.tailscale:18789"
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
      model_provider: "litellm-macbook"

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
        model: "anthropic/claude-sonnet-4-5",
        sandbox: {
          mode: "off", // Jerry has full access
        },
      },
      {
        id: "bobby",
        name: "Bobby (Infrastructure)",
        description: "Autonomous infrastructure monitoring and health checks",
        workspace: "~/.openclaw/workspace-bobby",
        model: "anthropic/claude-sonnet-4-5",
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
        description: "Scheduled tasks and automation (cloud-backed for reliability)",
        workspace: "~/.openclaw/workspace-billy",
        model: {
          primary: "anthropic/claude-sonnet-4-5",
          fallbacks: ["anthropic/claude-haiku-4-6"],
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
    // Jerry handles Slack
    {
      agentId: "jerry",
      match: {
        channel: "slack",
      },
    },

    // Bobby handles Discord DMs (for alerts)
    {
      agentId: "bobby",
      match: {
        channel: "discord",
        peer: { kind: "direct", id: "123456789012345678" }, // Replace with real DM peer id
      },
    },

    // Cron/scheduled tasks target agents by job.agentId (not bindings).
  ],

  // Gateway configuration
  gateway: {
    port: 18789,
    bind: "lan", // Accessible over Tailscale

    // Optional Tailscale Serve (if not using Traefik)
    tailscale: {
      mode: "serve", // or "funnel" for public
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
    sessionRetention: "24h",
  },
}
```

```bash
# Add cron jobs via CLI (recommended; persisted in cron/jobs.json)
openclaw cron add \
  --name "Bobby heartbeat" \
  --cron "*/5 * * * *" \
  --session isolated \
  --agent bobby \
  --message "Run infrastructure heartbeat check"

openclaw cron add \
  --name "Billy daily summary" \
  --cron "0 9 * * *" \
  --session isolated \
  --agent billy \
  --message "Generate daily infrastructure summary"
```

---

## Testing & Validation

### Phase 1 Validation

**Gateway Health:**

```bash
# From any Tailscale node
curl https://jerry.tailscale:18789/health

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
# Test Slack → Jerry
# Send message in Slack: "Hello Jerry, what's the status?"

# Test Discord → Jerry (or Bobby if configured)
# Send message in Discord: "Check Nomad cluster health"

# Test WhatsApp → Jerry
# Send WhatsApp message: "List running Nomad jobs"

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
curl https://jerry.tailscale:18789/health

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

# Check WhatsApp connection
nomad logs openclaw | grep -i whatsapp

# Re-pair WhatsApp (if needed)
nomad exec openclaw openclaw channels whatsapp pair

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

**All homelab agents use cloud LLMs (reliable):**

- Jerry tasks: ~500K tokens/day × $3/M tokens = $45/month
- Bobby tasks: ~200K tokens/day × $3/M tokens = $18/month
- Billy tasks: ~300K tokens/day × $3/M tokens = $27/month
- **Total: ~$90/month**

**MacBook agent (optional, Phase 4):**

- Uses local LLM (LM Studio) when MacBook is on
- $0 LLM cost for MacBook agent tasks
- Minimal power cost (~$1/month for inference)
- **No impact on homelab cost** (separate gateway, separate agent)

**Future job-specific agents:**

- Cost scales linearly with agent count
- Consider using claude-haiku-4-6 for low-priority agents ($0.25/M tokens = 12x cheaper)
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
- ✅ WhatsApp response time: <3s
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

### v2.0 (2026-02-16)

- Refocused on **Option 3 (Hybrid)** as primary architecture
- Added **MacBook LiteLLM integration** as core Phase 2
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

**Next Steps:** Begin Phase 1 deployment (Nomad gateway with 3 agents)
