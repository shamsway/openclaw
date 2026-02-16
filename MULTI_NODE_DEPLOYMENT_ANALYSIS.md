# OpenClaw Multi-Node Deployment Architecture Analysis

**Date:** 2026-02-16
**Author:** Analysis for Matt's Octant Homelab
**Environment:** 3-node homelab (Jerry, Bobby, Billy) + MacBook M3 Max (128GB)

---

## Executive Summary

You're asking about architectures that push beyond OpenClaw's designed scope—and that's both the challenge and the opportunity. Here's the reality check followed by creative solutions.

**The Bottom Line:**

1. **Standard OpenClaw:** One gateway, multiple agents (logical isolation), all in one process
2. **What You Want:** Multi-node deployment with independent gateways, HA-like behavior, agent communication
3. **The Gap:** OpenClaw has NO built-in clustering, state sync, or gateway-to-gateway communication
4. **The Opportunity:** Your infrastructure (Consul, Nomad, Tailscale) can bridge this gap creatively

---

## Your Setup: Assets & Capabilities

### Hardware

- **3 homelab nodes** (Jerry, Bobby, Billy): Always-on, rootless Podman, Nomad/Consul cluster
- **MacBook M3 Max**: 128GB RAM, daily driver, local LLM capability (Ollama/LM Studio)
- **Network**: Tailscale mesh, Consul DNS, Traefik ingress

### Software Stack

- **Orchestration**: Nomad 3-node cluster with Podman driver
- **Service Discovery**: Consul with health checks
- **VPN**: Tailscale for inter-node and MacBook connectivity
- **Secrets**: 1Password CLI integration
- **LLMs**: Mix of cloud (Claude, GPT) + local (MacBook)

### Your Goal

Replace the Octant Agent Farm with OpenClaw, but you want:

- **High availability**: Not true HA, but resilient to single-node failures
- **Distributed agents**: Agents running on different nodes
- **Agent communication**: A2A (agent-to-agent) across nodes
- **Local LLM integration**: MacBook as LLM provider for some agents

---

## Architecture Option 1: Single Gateway with Nomad Scheduling

**Pattern:** OpenClaw's standard model, deployed on Nomad for resilience

### Topology

```
┌────────────────────────────────────────────────────┐
│           Nomad Cluster (3 nodes)                  │
│                                                    │
│  One node runs:                                    │
│  ┌──────────────────────────────────────────────┐ │
│  │  OpenClaw Gateway (Nomad job, count=1)       │ │
│  │                                               │ │
│  │  Agents (logical, in-process):                │ │
│  │    ├─ Jerry (general hub, Slack/Discord)     │ │
│  │    ├─ Bobby (infra monitoring, autonomous)   │ │
│  │    └─ Billy (scheduled tasks, autonomous)    │ │
│  │                                               │ │
│  │  Storage: Nomad host volumes (pinned node)   │ │
│  └──────────────────────────────────────────────┘ │
│                                                    │
│  MacBook: Connects via Tailscale as client        │
│           (Control UI, optional local gateway)    │
└────────────────────────────────────────────────────┘
```

### How It Works

- **One gateway process** running as a Nomad job
- **Nomad constraint**: Pin to specific node (e.g., Jerry) for state persistence
- **Multiple agents** inside the gateway (Jerry, Bobby, Billy) with separate workspaces
- **Bindings**: Route channels to agents (Slack→Jerry, heartbeat→Bobby, cron→Billy)
- **Agent-to-Agent (A2A)**: Built-in `sessions_*` tools for inter-agent communication
- **Resilience**: Nomad restarts on failure, but NOT true HA (no state replication)

### Pros

✅ **Officially supported pattern**: This is how OpenClaw is designed
✅ **Built-in A2A**: `sessions_list`, `sessions_send`, `sessions_history` work natively
✅ **Nomad benefits**: Health checks, automatic restarts, resource limits
✅ **Simple operations**: One gateway to monitor, one config to manage
✅ **MacBook integration**: Connect via Tailscale, use as client + optional local gateway
✅ **Local LLM support**: MacBook can run LiteLLM proxy, gateway points to it via Tailscale

### Cons

❌ **No true HA**: Gateway down = all agents down
❌ **Single point of failure**: Despite Nomad resilience, there's restart downtime
❌ **Resource contention**: All agents share one process/node resources
❌ **Node pinning required**: State is local, can't float to other nodes
❌ **Not distributed**: Agents are logical, not physically separate

### When This Works

- **You prioritize operational simplicity** over absolute HA
- **Nomad's restart speed is acceptable** (usually <30s)
- **Your workloads tolerate brief interruptions**
- **You want to use OpenClaw as designed** (lowest friction)

### Implementation Notes

**Nomad Job Spec:**

```hcl
job "openclaw" {
  type = "service"

  constraint {
    attribute = "${node.unique.name}"
    value     = "jerry"  # Pin to one node for state persistence
  }

  group "gateway" {
    count = 1

    volume "config" {
      type   = "host"
      source = "openclaw-config"
    }

    volume "workspace" {
      type   = "host"
      source = "openclaw-workspace"
    }

    task "gateway" {
      driver = "podman"

      config {
        image = "registry.tailscale:5000/openclaw-homelab:2026.2.13"
        # Binds to Tailscale IP or lan for multi-node access
      }

      resources {
        cpu    = 1000  # 1 CPU
        memory = 2048  # 2GB
      }
    }
  }
}
```

**Multi-Agent Config** (`openclaw.json`):

```json5
{
  agents: {
    list: [
      {
        id: "jerry",
        name: "Jerry (General Hub)",
        workspace: "~/.openclaw/workspace-jerry",
        model: "anthropic/claude-sonnet-4-5",
      },
      {
        id: "bobby",
        name: "Bobby (Infrastructure)",
        workspace: "~/.openclaw/workspace-bobby",
        model: "anthropic/claude-sonnet-4-5",
      },
      {
        id: "billy",
        name: "Billy (Automation)",
        workspace: "~/.openclaw/workspace-billy",
        model: "litellm/ollama/llama3.1", // MacBook local LLM
      },
    ],
  },
  bindings: [
    { agentId: "jerry", match: { channel: "slack" } },
    { agentId: "bobby", match: { channel: "discord", peer: { kind: "dm", id: "bobby-dm" } } },
    { agentId: "billy", match: { channel: "cron" } },
  ],
  gateway: {
    port: 18789,
    bind: "tailnet", // Accessible over Tailscale
  },
}
```

**LiteLLM on MacBook** (for local LLM access):

```bash
# On MacBook, run LiteLLM proxy pointing to Ollama
litellm --model ollama/llama3.1 --port 4000

# In OpenClaw config, add model provider
{
  "modelProviders": {
    "litellm": {
      "baseUrl": "https://macbook.tailscale-name.ts.net:4000",
      "apiKey": "optional-key"
    }
  }
}
```

---

## Architecture Option 2: Independent Gateways with Shared State

**Pattern:** Gateway per node, coordinated via external systems

### Topology

```
┌───────────────────────────────────────────────────────────┐
│                   Nomad Cluster                           │
│                                                           │
│  Jerry: ┌─────────────────────────────────────┐          │
│         │ OpenClaw Gateway 1 (port 18789)     │          │
│         │ Agent: Bobby (infra monitoring)     │          │
│         │ Shared: Redis KV, Consul KV         │          │
│         └─────────────────────────────────────┘          │
│                                                           │
│  Bobby: ┌─────────────────────────────────────┐          │
│         │ OpenClaw Gateway 2 (port 18789)     │          │
│         │ Agent: Jerry (general hub)          │          │
│         │ Shared: Redis KV, Consul KV         │          │
│         └─────────────────────────────────────┘          │
│                                                           │
│  Billy: ┌─────────────────────────────────────┐          │
│         │ OpenClaw Gateway 3 (port 18789)     │          │
│         │ Agent: Billy (automation)           │          │
│         │ Shared: Redis KV, Consul KV         │          │
│         └─────────────────────────────────────┘          │
│                                                           │
│  Shared Storage (for coordination):                      │
│    • Redis (KV store for agent state)                    │
│    • Consul KV (agent discovery, health)                 │
│    • Shared Obsidian vault (optional, via sync)          │
│    • FastMCP A2A Hub (optional, agent-to-agent)          │
│                                                           │
│  MacBook: ┌─────────────────────────────────┐            │
│           │ Optional: Local Gateway          │            │
│           │ LiteLLM proxy for local LLMs     │            │
│           └─────────────────────────────────┘            │
└───────────────────────────────────────────────────────────┘
```

### How It Works

- **Independent gateways**: Each node runs its own OpenClaw gateway process
- **One agent per gateway**: Bobby on Jerry, Jerry on Bobby, Billy on Billy (or any mapping)
- **Shared coordination layer**:
  - **Redis**: Agent memory, shared context, KV state
  - **Consul KV**: Service discovery, agent registry, health status
  - **Obsidian vault** (optional): Human-readable shared memory via Tailscale sync
  - **FastMCP A2A Hub** (optional): Structured agent-to-agent messaging
- **Inter-gateway communication**: Custom scripts/tools to bridge gateways via shared state
- **Channel routing**: Each gateway connects to different channels OR uses channel-based routing

### Pros

✅ **True distributed architecture**: Each gateway is independent
✅ **Node failure isolation**: Jerry's gateway down ≠ Bobby's gateway down
✅ **Resource distribution**: Agents physically run on different nodes
✅ **Interesting experimentation**: This is novel, not standard OpenClaw
✅ **Local LLM flexibility**: Each gateway can use different model providers (cloud vs MacBook)
✅ **Scalable**: Add more nodes/gateways as needed

### Cons

❌ **Completely unsupported**: You're building custom infrastructure
❌ **No built-in state sync**: OpenClaw gateways don't talk to each other
❌ **Complex operations**: 3x the monitoring, logs, configs
❌ **A2A doesn't work**: `sessions_*` tools are per-gateway only
❌ **Channel coordination**: Risk of message duplication (two gateways, one WhatsApp)
❌ **Shared state challenges**: Redis/Consul KV schema design is on you
❌ **Maintenance burden**: Updates, config changes, troubleshooting all 3x harder

### When This Works

- **You're comfortable building custom glue code**
- **You want true distributed experimentation**
- **You're okay with operational complexity**
- **This is a demo/research project, not production**
- **You plan to contribute learnings back to OpenClaw community**

### Implementation Challenges

**Challenge 1: Agent-to-Agent Communication**

OpenClaw's `sessions_*` tools only work within one gateway. You'd need:

- **Option A**: Shared memory document (e.g., Obsidian vault + sync)
  - Agents write to `shared-memory.md` in vault
  - Other agents read it via MCP or file polling
  - Simple, but polling-based, not real-time

- **Option B**: Redis pub/sub
  - Each agent subscribes to Redis channels
  - Custom MCP server for Redis read/write
  - Real-time, but requires custom code

- **Option C**: FastMCP A2A Hub
  - Centralized hub for agent messaging
  - Structured message format
  - Requires running the hub service + custom integration

- **Option D**: Consul KV + watches
  - Agents write to Consul KV: `/agents/jerry/outbox/message-id`
  - Other agents watch for changes via Consul watches
  - Leverages existing Consul, no new services

**Challenge 2: Channel Coordination**

If multiple gateways connect to the same WhatsApp account → chaos (duplicate responses).

Solutions:

- **Separate channels**: Jerry gateway uses Slack, Bobby uses Discord, Billy uses Telegram
- **Separate accounts**: Each gateway gets its own WhatsApp number (expensive, complex)
- **Channel sharding**: Use bindings to route specific contacts to specific gateways (fragile)

**Challenge 3: Shared Context/Memory**

Each gateway has isolated session state. For shared context:

- **Option A**: Shared Obsidian vault (human-readable, version-controlled)
  - Synced via Tailscale + Syncthing
  - Agents read/write via workspace access
  - Not real-time, but persistent and inspectable

- **Option B**: Redis as shared brain
  - Key schema: `/agents/{agent-id}/memory/{key}`
  - MCP server for Redis access
  - Fast, real-time, but opaque (not human-readable)

- **Option C**: Consul KV (simpler Redis alternative)
  - Use existing Consul cluster
  - KV schema: `/openclaw/agents/{agent-id}/state`
  - CLI-friendly: `consul kv get -recurse /openclaw`

### Implementation Sketch

**Nomad Jobs** (3 separate jobs or one job with count=3, no constraints):

```hcl
job "openclaw-jerry" {
  group "gateway" {
    count = 1

    constraint {
      attribute = "${node.unique.name}"
      value     = "jerry"
    }

    task "gateway" {
      driver = "podman"
      config {
        image = "openclaw-homelab:latest"
      }
      env {
        AGENT_ID = "jerry"
        REDIS_URL = "redis://redis.service.consul:6379"
        CONSUL_HTTP_ADDR = "http://127.0.0.1:8500"
      }
    }
  }
}

# Repeat for bobby, billy with different AGENT_ID and node constraints
```

**Custom MCP Server for Shared State** (`~/.openclaw/workspace/mcp-servers/shared-state.json`):

```json
{
  "mcpServers": {
    "shared-memory": {
      "command": "node",
      "args": ["/path/to/custom-redis-mcp-server.js"],
      "env": {
        "REDIS_URL": "redis://redis.service.consul:6379"
      }
    }
  }
}
```

**Consul KV Schema** (for agent coordination):

```
/openclaw/
  agents/
    jerry/
      status: "online"
      last_seen: "2026-02-16T12:34:56Z"
      capabilities: ["slack", "general-qa"]
      outbox/
        msg-001: {to: "bobby", body: "Check Nomad status"}
    bobby/
      status: "online"
      capabilities: ["infra-monitoring", "consul", "nomad"]
      inbox/
        msg-001: {from: "jerry", body: "Check Nomad status"}
  shared-memory/
    current-tasks: {...}
    recent-events: [...]
```

**Agent Discovery Tool** (custom skill or MCP):

```bash
# Agents register themselves on startup
consul kv put /openclaw/agents/jerry/status online
consul kv put /openclaw/agents/jerry/capabilities '["slack","general"]'

# Agents discover each other
consul kv get -keys /openclaw/agents/  # List all agents
```

---

## Architecture Option 3: Hybrid (Recommended)

**Pattern:** Single gateway + MacBook gateway + shared state for coordination

### Topology

```
┌─────────────────────────────────────────────────────┐
│         Nomad Cluster (Homelab)                     │
│                                                     │
│  Jerry (primary node):                              │
│  ┌────────────────────────────────────────────────┐ │
│  │  OpenClaw Gateway (Nomad job)                  │ │
│  │    ├─ Jerry (Slack/Discord, general)           │ │
│  │    ├─ Bobby (autonomous monitoring)            │ │
│  │    └─ Billy (scheduled tasks)                  │ │
│  │                                                 │ │
│  │  Built-in A2A: sessions_* tools work           │ │
│  └────────────────────────────────────────────────┘ │
│                                                     │
│  Shared Infrastructure:                             │
│    • Consul KV (optional cross-gateway state)      │
│    • Redis (optional shared memory)                │
│    • LiteLLM proxy on MacBook (Tailscale URL)      │
└─────────────────────────────────────────────────────┘
                         ↕
              Tailscale VPN Mesh
                         ↕
┌─────────────────────────────────────────────────────┐
│  MacBook M3 Max (Mobile/Local)                      │
│  ┌────────────────────────────────────────────────┐ │
│  │  OpenClaw Gateway (local, independent)         │ │
│  │    └─ Agent: "Dev" or "Mobile"                 │ │
│  │                                                 │ │
│  │  LiteLLM Proxy (Ollama/LM Studio)              │ │
│  │    • Models: llama3.1, mistral, etc.           │ │
│  │    • Exposed via Tailscale (HTTPS)             │ │
│  │                                                 │ │
│  │  Can also connect to homelab gateway as client │ │
│  └────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### How It Works

- **Homelab gateway**: One gateway on Nomad with 3 agents (Jerry, Bobby, Billy)
- **MacBook gateway**: Independent local gateway for mobile/offline work
- **LiteLLM on MacBook**: Ollama/LM Studio → LiteLLM proxy → accessible via Tailscale
- **Homelab agents use MacBook LLMs**: Configure model provider to point to MacBook's LiteLLM
- **Optional shared state**: Consul KV or Redis for cross-gateway coordination (if needed)
- **Two separate bot identities**: Different WhatsApp/Slack/Discord accounts for each gateway

### Pros

✅ **Best of both worlds**: Homelab HA + MacBook mobility
✅ **Official patterns**: Each gateway uses standard OpenClaw design
✅ **Local LLM integration**: Homelab agents can use MacBook's powerful local models
✅ **Offline capability**: MacBook gateway works without homelab
✅ **Simpler than Option 2**: Only one "weird" integration (LiteLLM proxy)
✅ **Operational simplicity**: Two gateways to manage, not three
✅ **Clear separation**: Homelab = always-on production, MacBook = dev/mobile

### Cons

❌ **Two configs to maintain**: Homelab gateway + MacBook gateway
❌ **Limited inter-gateway A2A**: sessions\_\* doesn't work across gateways
❌ **Channel separation**: Need different accounts or manual routing

### When This Works

- **You want simplicity with local LLM benefits**
- **You value MacBook as a powerful local resource**
- **You're okay managing two independent gateways**
- **You don't need frequent cross-gateway agent collaboration**

### Implementation Notes

**MacBook LiteLLM Setup:**

```bash
# Install on MacBook
brew install ollama
pip install litellm

# Run Ollama
ollama serve

# Pull models
ollama pull llama3.1
ollama pull mistral

# Run LiteLLM proxy (binds to Tailscale interface)
litellm --host $(tailscale ip -4) --port 4000 --model ollama/llama3.1

# Verify from homelab node
curl https://macbook.tailscale-name.ts.net:4000/health
```

**Homelab Gateway Config** (uses MacBook LLMs):

```json5
{
  modelProviders: {
    litellm: {
      baseUrl: "https://macbook.tailscale-name.ts.net:4000",
      // No API key needed for local Ollama via LiteLLM
    },
  },
  agents: {
    list: [
      {
        id: "billy",
        name: "Billy (Automation - Local LLM)",
        model: "litellm/ollama/llama3.1", // Uses MacBook
      },
      {
        id: "jerry",
        model: "anthropic/claude-sonnet-4-5", // Uses cloud
      },
    ],
  },
}
```

---

## Comparison Matrix

| Factor                    | Option 1: Single Gateway   | Option 2: Independent Gateways     | Option 3: Hybrid              |
| ------------------------- | -------------------------- | ---------------------------------- | ----------------------------- |
| **Complexity**            | ⭐ Low                     | ⭐⭐⭐⭐⭐ Very High               | ⭐⭐ Medium                   |
| **HA / Resilience**       | ⭐⭐ Nomad restart only    | ⭐⭐⭐⭐ True distributed          | ⭐⭐⭐ Partial HA             |
| **Operational burden**    | ⭐ Minimal                 | ⭐⭐⭐⭐⭐ High                    | ⭐⭐ Moderate                 |
| **OpenClaw support**      | ⭐⭐⭐⭐⭐ Official        | ⭐ Unsupported DIY                 | ⭐⭐⭐⭐ Mostly official      |
| **A2A communication**     | ⭐⭐⭐⭐⭐ Built-in        | ⭐⭐ Custom required               | ⭐⭐⭐ Within gateway only    |
| **Local LLM use**         | ⭐⭐⭐⭐ Via LiteLLM proxy | ⭐⭐⭐⭐ Via LiteLLM proxy         | ⭐⭐⭐⭐⭐ Native integration |
| **Experimentation value** | ⭐⭐ Standard setup        | ⭐⭐⭐⭐⭐ Highly novel            | ⭐⭐⭐ Interesting hybrid     |
| **Demo potential**        | ⭐⭐⭐ Good                | ⭐⭐⭐⭐⭐ Excellent (if it works) | ⭐⭐⭐⭐ Very good            |
| **Production readiness**  | ⭐⭐⭐⭐⭐ Ready now       | ⭐ Proof-of-concept only           | ⭐⭐⭐⭐ Near-ready           |

---

## Recommendations

### For Production / Near-Term

**Go with Option 3 (Hybrid)**:

1. Deploy **one OpenClaw gateway on Nomad** (Jerry node, pinned) with 3 agents
2. Run **MacBook gateway independently** for dev/mobile work
3. Set up **LiteLLM on MacBook** (Ollama + Tailscale)
4. Configure homelab agents to optionally use MacBook LLMs for cost/experimentation
5. Use **different channel accounts** for each gateway (separate WhatsApp/Slack/etc.)

**Why?**

- ✅ Proven OpenClaw patterns (low risk)
- ✅ Local LLM integration (your MacBook's strength)
- ✅ Good resilience (Nomad restarts + independent MacBook)
- ✅ Demo-worthy (local LLMs + homelab orchestration)
- ✅ Manageable complexity (2 gateways, not 3+)

### For Experimentation / Future

**Explore Option 2 (Independent Gateways) as a side project**:

1. Start with **one additional gateway** (Bobby node) as proof-of-concept
2. Build **Consul KV-based agent discovery** and messaging
3. Create **custom MCP server for shared state** (Redis or Consul KV)
4. Document **learnings and challenges** for OpenClaw community
5. If successful, **contribute patterns back** (you'd be pioneering this)

**Why?**

- 🔬 Novel research (no one's done multi-gateway OpenClaw at scale)
- 🎯 Demo potential (if you solve the A2A problem elegantly)
- 📊 Useful for OpenClaw maintainers (distributed use case exploration)
- ⚠️ High risk, high reward (might hit dead ends, but learning is valuable)

---

## Shared State Implementation Guidance

If you pursue Option 2 or want cross-gateway coordination in Option 3, here are patterns:

### Pattern 1: Consul KV for Agent Registry & Discovery

**Schema:**

```
/openclaw/
  cluster/
    id: "octant-homelab"
    members: ["jerry-gateway", "bobby-gateway", "billy-gateway"]

  gateways/
    jerry-gateway/
      url: "wss://jerry.tailscale:18789"
      agents: ["jerry", "bobby"]
      status: "healthy"
      last_heartbeat: "2026-02-16T12:00:00Z"

    bobby-gateway/
      url: "wss://bobby.tailscale:18789"
      agents: ["billy"]
      status: "healthy"

  agents/
    jerry/
      gateway: "jerry-gateway"
      capabilities: ["slack", "discord", "general-qa"]
      status: "active"

    bobby/
      gateway: "jerry-gateway"
      capabilities: ["consul", "nomad", "infra-monitoring"]
      heartbeat_enabled: true

    billy/
      gateway: "bobby-gateway"
      capabilities: ["cron", "automation", "scheduled-tasks"]
```

**MCP Server for Consul Access:**

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

server.tool("agent_register", async ({ agent_id, capabilities }) => {
  await consul.kv.set(`/openclaw/agents/${agent_id}/capabilities`, JSON.stringify(capabilities));
  await consul.kv.set(`/openclaw/agents/${agent_id}/status`, "active");
  return { success: true };
});

server.tool("agent_discover", async () => {
  const agents = await consul.kv.get({ key: "/openclaw/agents/", recurse: true });
  return agents.map((kv) => ({
    agent: kv.Key.split("/")[3],
    data: JSON.parse(kv.Value),
  }));
});

server.tool("send_message", async ({ from, to, body }) => {
  const msgId = `msg-${Date.now()}`;
  await consul.kv.set(
    `/openclaw/agents/${to}/inbox/${msgId}`,
    JSON.stringify({
      from,
      body,
      timestamp: new Date().toISOString(),
    }),
  );
  return { message_id: msgId };
});

server.tool("check_inbox", async ({ agent_id }) => {
  const messages = await consul.kv.get({
    key: `/openclaw/agents/${agent_id}/inbox/`,
    recurse: true,
  });
  return messages || [];
});

server.start({ transport: "stdio" });
```

**Agent Heartbeat Skill** (runs periodically on Bobby):

```markdown
---
name: infra-heartbeat
description: Monitor Nomad/Consul cluster health and alert on issues
schedule: "*/5 * * * *" # Every 5 minutes
---

1. Register this agent in Consul KV: `/openclaw/agents/bobby/status = active`
2. Query Nomad for failed allocations: `nomad status -json | jq '.Allocations[] | select(.ClientStatus != "running")'`
3. Query Consul for unhealthy services: `consul catalog services -tags | filter unhealthy`
4. If issues found:
   - Send message to Jerry agent via Consul KV inbox
   - Post to Discord #alerts channel
   - Update `/openclaw/agents/bobby/last_alert` with timestamp
5. Update `/openclaw/agents/bobby/last_heartbeat` with current timestamp
```

### Pattern 2: Redis for Fast Shared Memory

**Redis Schema:**

```
openclaw:agents:jerry:memory:current-task = "Debugging homelab deployment"
openclaw:agents:jerry:memory:context = "User asked about multi-node OpenClaw"
openclaw:shared:recent-events = ["2026-02-16T12:00:00Z: Bobby reported Nomad alert", ...]
openclaw:shared:task-queue = ["backup-consul", "update-traefik-config"]
```

**MCP Server for Redis:**

```javascript
// Similar to Consul example, but using ioredis client
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL || "redis://redis.service.consul:6379");

// Tools: set_memory, get_memory, push_event, pop_task, etc.
```

### Pattern 3: Shared Obsidian Vault (Human-Readable)

**Vault Structure:**

```
~/.openclaw/shared-vault/
  agents/
    jerry/
      MEMORY.md          # Current context, working memory
      HISTORY.md         # Completed tasks, decisions made
    bobby/
      ALERTS.md          # Recent alerts, status
      INFRASTRUCTURE.md  # Current cluster state
    billy/
      SCHEDULE.md        # Upcoming tasks

  shared/
    CURRENT_FOCUS.md     # What the system is working on right now
    RECENT_EVENTS.md     # Cross-agent event log
    DECISIONS.md         # Architectural decisions, important choices
```

**Syncing:**

- **Option A**: Tailscale + Syncthing across all nodes
- **Option B**: Git + cron (each agent commits/pulls)
- **Option C**: Shared NFS mount (simpler, less robust)

**Agent Skill to Read/Write:**

```markdown
---
name: update-shared-memory
description: Update shared memory document with current context
---

1. Read current content of `~/.openclaw/shared-vault/agents/{agent-id}/MEMORY.md`
2. Append new context:
```

## [timestamp]

**Task:** {current task}
**Status:** {in-progress | completed | blocked}
**Context:** {relevant details}
**Dependencies:** {other agents or tasks needed}

```
3. Write back to file
4. Commit to git (if using git-based sync): `git add . && git commit -m "Update memory" && git push`
```

---

## MacBook Local LLM Integration Details

### Setup Ollama + LiteLLM on MacBook

```bash
# Install Ollama
brew install ollama

# Start Ollama service
brew services start ollama

# Pull models (examples for 128GB RAM - you can run LARGE models)
ollama pull llama3.1:70b      # 70B parameter model
ollama pull mistral:latest
ollama pull codellama:34b
ollama pull mixtral:8x7b

# Verify
ollama list

# Install LiteLLM
pip install litellm

# Get Tailscale IP
TAILSCALE_IP=$(tailscale ip -4)

# Run LiteLLM proxy (binds to Tailscale interface)
litellm \
  --host $TAILSCALE_IP \
  --port 4000 \
  --model ollama/llama3.1:70b \
  --model ollama/mistral \
  --model ollama/codellama:34b

# Or use config file for multiple models
cat > litellm_config.yaml <<EOF
model_list:
  - model_name: local-llama
    litellm_params:
      model: ollama/llama3.1:70b
      api_base: http://localhost:11434

  - model_name: local-mistral
    litellm_params:
      model: ollama/mistral
      api_base: http://localhost:11434

  - model_name: local-codellama
    litellm_params:
      model: ollama/codellama:34b
      api_base: http://localhost:11434

general_settings:
  master_key: your-secret-key  # Optional auth
EOF

litellm --config litellm_config.yaml --host $TAILSCALE_IP --port 4000
```

### Configure Homelab Gateway to Use MacBook LLMs

**In homelab `openclaw.json`:**

```json5
{
  modelProviders: {
    // Cloud providers
    anthropic: {
      apiKey: "${ANTHROPIC_API_KEY}",
    },

    // MacBook local LLMs via LiteLLM
    litellm: {
      baseUrl: "https://macbook.tailscale-name.ts.net:4000",
      apiKey: "your-secret-key", // If you set master_key in litellm config
    },
  },

  agents: {
    list: [
      {
        id: "jerry",
        name: "Jerry (General - Cloud)",
        model: "anthropic/claude-sonnet-4-5", // Expensive, powerful
      },
      {
        id: "bobby",
        name: "Bobby (Infra - Cloud)",
        model: "anthropic/claude-sonnet-4-5", // Critical, use best model
      },
      {
        id: "billy",
        name: "Billy (Automation - Local)",
        model: "litellm/local-llama", // MacBook 70B model, free!
      },
    ],
  },
}
```

### MacBook Availability Considerations

**Challenge:** MacBook isn't always on / connected to Tailscale

**Solutions:**

1. **Fallback model config:**

   ```json5
   {
     agents: {
       list: [
         {
           id: "billy",
           model: "litellm/local-llama",
           fallbackModel: "anthropic/claude-haiku-4-6", // Cheap cloud fallback
         },
       ],
     },
   }
   ```

2. **Conditional routing** (via skill or binding):
   - Check if MacBook LiteLLM is reachable before using Billy
   - Route to different agent if MacBook is offline

3. **Async/queue-based tasks**:
   - Billy handles non-urgent tasks that can wait for MacBook to reconnect
   - Jerry/Bobby handle time-sensitive requests

4. **MacBook wake-on-LAN** (if feasible):
   - Homelab sends WoL packet to wake MacBook when needed
   - Requires MacBook on same LAN segment (Tailscale doesn't support WoL)

---

## Demos You Could Build

### Demo 1: "Homelab Orchestra" (Option 3 - Hybrid)

**Concept:** Multiple specialized agents, local + cloud LLMs, coordinated via Consul

**Showcase:**

- Jerry (cloud LLM): Handles user queries via Slack
- Bobby (cloud LLM): Autonomous monitoring, alerts to Discord
- Billy (MacBook local 70B LLM): Runs expensive analysis tasks for free
- Consul KV: Agents coordinate tasks, shared state visible via UI
- Traefik dashboard: Shows all services + OpenClaw gateway health

**User Flow:**

1. User asks Jerry in Slack: "What's the status of our Nomad cluster?"
2. Jerry delegates to Bobby via A2A (`sessions_send`)
3. Bobby queries Consul/Nomad APIs, formats report
4. Bobby responds to Jerry, Jerry relays to user
5. Background: Billy (on MacBook local LLM) analyzes Nomad logs, finds optimization opportunities
6. Billy writes findings to Consul KV `/openclaw/shared/recommendations`
7. Jerry proactively notifies user: "Billy found 3 optimization opportunities, review?"

**Why It's Impressive:**

- Multi-agent coordination (built-in A2A)
- Cloud + local LLM mix (cost-effective + powerful)
- Autonomous + interactive agents
- Real infrastructure integration (Consul, Nomad)

### Demo 2: "Distributed Agent Mesh" (Option 2 - Independent Gateways)

**Concept:** Independent OpenClaw gateways on each node, coordinated via Consul KV

**Showcase:**

- **Jerry node**: Gateway with "Coordinator" agent (Slack interface)
- **Bobby node**: Gateway with "Infrastructure" agent (autonomous monitoring)
- **Billy node**: Gateway with "Automation" agent (cron tasks)
- **MacBook**: Gateway with "Developer" agent (local LLM experimentation)
- Consul KV: Custom message bus for inter-gateway communication
- Custom MCP server: Enables agents to discover & message across gateways

**User Flow:**

1. User asks Coordinator (Jerry node) in Slack: "Deploy new service to Nomad"
2. Coordinator writes task to Consul KV: `/openclaw/agents/infrastructure/inbox/task-123`
3. Infrastructure agent (Bobby node) polls Consul KV, sees task
4. Infrastructure agent runs Nomad job deployment, updates task status in Consul KV
5. Coordinator agent reads status, reports back to user in Slack
6. Automation agent (Billy node) detects new service, schedules health checks

**Why It's Impressive:**

- True distributed system (gateways on different nodes)
- Custom A2A implementation (Consul KV-based messaging)
- Resilient (one node down ≠ full system down)
- Novel (no one's done this with OpenClaw yet)

**Risks:**

- Complex (custom infrastructure code)
- Unsupported (you're on your own for troubleshooting)
- May hit fundamental limitations in OpenClaw's design

---

## Action Plan

### Week 1: Foundation (Option 3 Setup)

1. Deploy **single OpenClaw gateway on Nomad** (Jerry node, pinned)
2. Configure **3 agents**: Jerry, Bobby, Billy with separate workspaces
3. Set up **channel routing**: Slack → Jerry, Discord → Bobby, cron → Billy
4. Test **built-in A2A**: Jerry sends message to Bobby via `sessions_send`
5. Document baseline performance, resource usage

### Week 2: Local LLM Integration

1. Set up **Ollama on MacBook** with llama3.1:70b, mistral, codellama
2. Deploy **LiteLLM proxy** bound to Tailscale interface
3. Configure **Billy agent** to use MacBook local LLM via LiteLLM provider
4. Test **model routing**: Jerry/Bobby use Claude, Billy uses local Ollama
5. Measure **cost savings** (Billy's tasks = $0 LLM cost)

### Week 3: Consul Integration (Shared State)

1. Design **Consul KV schema** for agent registry & shared state
2. Build **custom MCP server** for Consul KV access (register, discover, message)
3. Create **agent skills** that write to Consul KV (Bobby's heartbeat, Billy's task queue)
4. Test **cross-agent coordination** via Consul KV (Jerry reads Bobby's infrastructure status)
5. Build **Consul KV dashboard** (simple web UI or Grafana panel)

### Week 4: Experimentation (Option 2 Proof-of-Concept)

1. Deploy **second gateway** on Bobby node (separate Nomad job)
2. Configure **inter-gateway discovery** via Consul KV
3. Test **custom A2A messaging** (Jerry gateway → Bobby gateway via Consul inbox)
4. Document **challenges, limitations, workarounds**
5. Decide: **Continue with Option 2 OR stick with Option 3** based on learnings

### Month 2+: Refinement & Demos

1. Polish **Demo 1** (Homelab Orchestra) for presentations
2. Optional: Complete **Demo 2** (Distributed Mesh) if Week 4 was successful
3. Write up **detailed case study** for OpenClaw community
4. Contribute **learnings back** (blog post, GitHub discussion, or PR)

---

## Final Thoughts

You're right that you're pushing beyond OpenClaw's core design—but that's where innovation happens. Here's my honest assessment:

**Option 1 (Single Gateway):** Solid, supported, will work. But maybe not exciting enough for demos.

**Option 2 (Independent Gateways):** Novel, distributed, impressive if you pull it off. High risk of hitting walls, but the learnings are valuable regardless.

**Option 3 (Hybrid):** Sweet spot for you. Gives you distributed LLM resources (MacBook), multi-agent coordination (built-in A2A), and a path to Option 2 experimentation without betting the farm on it.

**My Recommendation:**

- **Start with Option 3** as your production architecture
- **Experiment with Option 2** as a side project on one node
- **Use Consul KV** as your shared state layer (you already have it, it's reliable)
- **LiteLLM on MacBook** is a no-brainer (128GB RAM = run huge models locally)
- **Document everything** - you're in uncharted territory, the community would benefit

The fact that you're thinking about this problem means you're ready to contribute back to the OpenClaw ecosystem. Even if Option 2 doesn't fully work, the journey of trying—and documenting what you learn—has value.

**Questions to answer before you start:**

1. How much operational complexity are you willing to tolerate?
2. Is this a production system or a demo/research project?
3. How much time can you dedicate to custom infrastructure code?
4. What's your tolerance for "unsupported territory" troubleshooting?

Happy to dive deeper into any specific area!
