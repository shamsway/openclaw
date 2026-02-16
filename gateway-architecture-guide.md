# OpenClaw Gateway & Agent Architecture for Octant Home Lab

## The Short Answer

**No, you do NOT need a gateway on every node.** One gateway handles everything. There is no gateway clustering, no HA failover, and no cross-gateway replication. Think of the gateway like a single monolithic application server, not a distributed control plane.

## Gateway = Single Process, Not a Cluster

In networking terms, the OpenClaw gateway is analogous to a **single NGINX instance** or a **standalone application server** -- not a distributed system like your Consul/Nomad cluster. Key properties:

| Property        | OpenClaw Gateway                  | Your Nomad/Consul Cluster     |
| --------------- | --------------------------------- | ----------------------------- |
| **Topology**    | Single process on one host        | 3-node RAFT quorum            |
| **State**       | Local filesystem (`~/.openclaw/`) | Distributed (RAFT replicated) |
| **Failover**    | None built-in                     | Automatic leader election     |
| **Scaling**     | Vertical only (one process)       | Horizontal (add nodes)        |
| **Agent model** | Embedded in gateway process       | Separate server/agent roles   |

## Agents Are NOT Separate Services

This is the critical mental model shift: **OpenClaw agents are not like Nomad agents or Consul agents.** They don't run as separate processes or on separate nodes. They are more like **VRFs or routing instances** inside a single router -- isolated logical contexts within one process.

Each agent has:

- Its own **workspace** (like a separate config directory)
- Its own **session store** (conversation history)
- Its own **auth profiles** (API keys, credentials)
- Its own **personality** (SOUL.md, AGENTS.md files)

But they all run **inside the same gateway process** on the same host. You configure multiple agents in `~/.openclaw/openclaw.json` and use **bindings** (think: policy-based routing) to route inbound messages to the right agent.

## Recommended Topology

Given nodes (jerry, bobby, billy, macbook), here's what makes sense:

```
┌─────────────────────────────────────────────────────┐
│                  Octant Cluster                      │
│                                                      │
│  jerry ──┐                                           │
│  bobby ──┼── Consul/Nomad Quorum (3-node RAFT)      │
│  billy ──┘                                           │
│                                                      │
│  Pick ONE node (e.g., jerry) to run:                 │
│  ┌────────────────────────────────────────┐          │
│  │  OpenClaw Gateway (port 18789)         │          │
│  │  ├── Agent: "main"                     │          │
│  │  ├── Agent: "work"                     │          │
│  │  ├── Agent: "home"                     │          │
│  │  └── Bindings (route msgs → agents)    │          │
│  └────────────────────────────────────────┘          │
│                                                      │
│  macbook ── connects via Tailscale/SSH tunnel        │
└─────────────────────────────────────────────────────┘
```

**One gateway, one node, multiple agents.** The macbook connects as a client via WebSocket over Tailscale or SSH tunnel -- it does not run its own gateway.

## Redundancy: Rescue-Bot Pattern

OpenClaw supports a **rescue-bot pattern** -- a second isolated gateway on the same host for debugging if the primary goes down. This is NOT automatic failover. It's manual, like having a backup management interface on a different port:

```bash
# Primary gateway
openclaw --profile main gateway --port 18789

# Rescue gateway (same host, different port/state/config)
openclaw --profile rescue gateway --port 19001
```

Each profile gets fully isolated state, config, and workspace. Leave at least 20 ports of spacing between base ports (derived ports for browser control, canvas, CDP use offsets from the base).

### Isolation Checklist (required for multiple gateways on same host)

- `OPENCLAW_CONFIG_PATH` -- per-instance config file
- `OPENCLAW_STATE_DIR` -- per-instance sessions, creds, caches
- `agents.defaults.workspace` -- per-instance workspace root
- `gateway.port` (or `--port`) -- unique per instance
- Derived ports (browser/canvas) must not overlap

### Port Mapping (Derived Ports)

For a base port (e.g., 18789):

- `gateway.port` = base port (Gateway WS + HTTP)
- `gateway.port + 2` = browser control service port (loopback only)
- `gateway.port + 4` = canvasHost.port (canvas file server)
- `gateway.port + 9..108` = Browser profile CDP ports (auto-allocated)

## Gateways on Multiple Nodes

You **can** run separate gateways on different nodes, but understand:

- They are **completely independent** -- no shared state, no session sync, no failover
- Each gateway needs its own channel credentials (e.g., separate WhatsApp numbers)
- There is no message routing between gateways
- It's like running two completely separate bots that happen to share infrastructure

This might make sense if you want genuinely separate bot instances (e.g., one for home automation on jerry, one for personal use on macbook), but not for redundancy.

## Practical Setup Steps

1. **Choose one always-on node** (e.g., jerry) as the gateway host
2. **Install OpenClaw** on that node and run `openclaw onboard`
3. **Configure multiple agents** in `~/.openclaw/openclaw.json`:

```json5
{
  agents: {
    list: [
      { id: "main", workspace: "~/.openclaw/workspace" },
      { id: "work", workspace: "~/.openclaw/workspace-work" },
    ],
  },
  bindings: [
    { agentId: "main", match: { channel: "whatsapp" } },
    { agentId: "work", match: { channel: "telegram" } },
  ],
  gateway: {
    port: 18789,
    bind: "tailnet", // accessible over Tailscale mesh
  },
}
```

4. **Access from macbook** via Tailscale (the gateway's WebSocket endpoint) or SSH tunnel:

   ```bash
   ssh -N -L 18789:127.0.0.1:18789 user@jerry
   ```

5. **Optionally add a rescue bot** on the same node for debugging

## Multi-Agent Routing (Bindings)

Bindings are **deterministic** and **most-specific wins**:

1. `peer` match (exact DM/group/channel id)
2. `guildId` (Discord)
3. `teamId` (Slack)
4. `accountId` match for a channel
5. channel-level match (`accountId: "*"`)
6. fallback to default agent (`agents.list[].default`, else first list entry, default: `main`)

### Example: WhatsApp daily chat + Telegram deep work

```json5
{
  agents: {
    list: [
      {
        id: "chat",
        name: "Everyday",
        workspace: "~/.openclaw/workspace-chat",
        model: "anthropic/claude-sonnet-4-5",
      },
      {
        id: "opus",
        name: "Deep Work",
        workspace: "~/.openclaw/workspace-opus",
        model: "anthropic/claude-opus-4-5",
      },
    ],
  },
  bindings: [
    { agentId: "chat", match: { channel: "whatsapp" } },
    { agentId: "opus", match: { channel: "telegram" } },
  ],
}
```

## Agent-Farm Is Something Different

The octant skill references an **agent-farm** architecture in `terraform/agent-farm/`. That is a **separate distributed system** that uses Nomad to orchestrate containerized agents communicating via A2A (Agent-to-Agent) protocol and FastMCP Hub. It is not part of OpenClaw core -- it's a custom infrastructure-management layer built on top of the Nomad cluster. Don't conflate the two.

## TL;DR in Network Engineer Terms

- **Gateway** = monolithic application server (not a distributed control plane)
- **Agents** = VRFs/routing instances inside one router (logical isolation, not physical)
- **Bindings** = policy-based routing rules (match on channel/account/peer -> forward to agent)
- **No HA/clustering** = like running a single NGINX without keepalived
- **Rescue bot** = out-of-band management interface on a different port
- **Run one gateway** on your most reliable always-on node, access from everywhere via Tailscale

## Key OpenClaw Documentation References

- Gateway overview: `docs/gateway/index.md`
- Multiple gateways: `docs/gateway/multiple-gateways.md`
- Multi-agent routing: `docs/concepts/multi-agent.md`
- Agent concepts: `docs/concepts/agent.md`
- Gateway configuration: `docs/gateway/configuration.md`
