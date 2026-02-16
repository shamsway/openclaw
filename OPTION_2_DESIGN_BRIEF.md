# Option 2 Distributed Agent Farm - Design Brief

**Date:** 2026-02-16
**Status:** Strategic Design Phase
**Goal:** Enterprise-grade distributed agent farm on Octant homelab

---

## Vision Statement

Build a **distributed, multi-node agent farm** using OpenClaw as the foundation, deployed across Octant homelab infrastructure (Jerry, Bobby, Billy nodes). This replaces a LangGraph-based prototype with a more maintainable, observable, and enterprise-grade architecture that eliminates single points of failure while fully utilizing homelab resources.

---

## Strategic Context

### Why This Matters

**Professional Context:**

- Network engineer background → trained to eliminate single points of failure
- Enterprise design patterns → applied to homelab environment
- Technical demonstration → showcase for network engineering community
- Community contribution → novel OpenClaw use case, willing to document/share

**Current State:**

- ✅ Octant homelab framework (Nomad, Consul, Tailscale, 1Password)
- ✅ LangGraph-based agent farm prototype (semi-working, complex)
- ✅ LiteLLM gateway (observability, model routing)
- ✅ ZAI GLM access (cost-effective coding models)
- ⚠️ OpenClaw tested on Jerry node (single gateway, works well)

**Desired End State:**

- 🎯 Gateway per node (Jerry, Bobby, Billy) - no SPOF
- 🎯 Distributed agents with cross-gateway communication
- 🎯 Full homelab utilization (all 3 nodes active)
- 🎯 Observable, maintainable, demonstrable
- 🎯 Foundation for expanding agent capabilities

---

## Use Cases

### 1. Homelab Infrastructure Management

**Scenario:** Bobby node fails, Jerry and Billy nodes continue operating

**Current (Option 3):** Gateway on Jerry fails → all agents offline
**Future (Option 2):** Bobby gateway fails → Bobby's agents offline, but Jerry/Billy agents continue

**Value:** True high availability, no single point of failure

### 2. Distributed Agent Specialization

**Scenario:** Different nodes host different agent specializations

**Example Distribution:**

- **Jerry node**: General agents (Slack/Discord/WhatsApp interface)
- **Bobby node**: Infrastructure agents (Nomad/Consul monitoring, alerting)
- **Billy node**: Automation agents (scheduled tasks, deployments)

**Value:** Resource isolation, specialized capabilities per node

### 3. Cross-Agent Coordination

**Scenario:** User asks Jerry (Slack) to deploy new service

**Workflow:**

1. Jerry agent (Jerry node) receives request via Slack
2. Jerry sends message to Deploy agent (Billy node) via Consul KV
3. Deploy agent runs Nomad job deployment
4. Deploy agent sends completion status to Monitor agent (Bobby node)
5. Monitor agent confirms health checks passing
6. Monitor agent notifies Jerry agent
7. Jerry responds to user in Slack: "Deployment complete and healthy"

**Value:** Distributed workflow, agent specialization, coordinated execution

### 4. Technical Demonstration

**Scenario:** Present to network engineering community or OpenClaw maintainers

**Demo Flow:**

1. Show 3 nodes, each running independent gateway
2. Kill one node (e.g., Bobby) → other agents continue
3. Cross-gateway agent communication via Consul KV
4. Observable via Consul UI, Nomad UI, LiteLLM dashboard
5. Restart Bobby node → automatically rejoins agent farm

**Value:** Impressive technical demo, validates enterprise patterns

---

## Architecture Requirements

### Must-Have (Phase 1 - MVP)

- [ ] Independent gateway per node (3 gateways total)
- [ ] Agent registry in Consul KV (discovery)
- [ ] Cross-gateway messaging (A2A via Consul KV or Redis)
- [ ] Health monitoring (gateway liveness, agent status)
- [ ] At least 1 agent per gateway (total: 3+ agents)

### Should-Have (Phase 2 - Enhanced)

- [ ] Automatic agent discovery on gateway startup
- [ ] Message queue/inbox pattern for reliable delivery
- [ ] Shared memory/context (Redis or Consul KV)
- [ ] Observable via existing homelab dashboards
- [ ] Graceful degradation (gateway offline = agents unavailable, not system failure)

### Nice-to-Have (Phase 3 - Advanced)

- [ ] Dynamic agent migration (move agent to different gateway)
- [ ] Load balancing (distribute work across agents)
- [ ] Session state replication (agent fails → another agent takes over)
- [ ] WebSocket bridge (cross-gateway sessions\_\* tools)

---

## Technical Challenges

### Challenge 1: Cross-Gateway Agent-to-Agent Communication

**Problem:** OpenClaw's `sessions_*` tools only work within one gateway

**Options:**

**A. Consul KV Message Bus** ✅ RECOMMENDED

- **Pro**: Already have Consul, well-understood, persistent
- **Pro**: Watch API for real-time notifications
- **Pro**: Observable via Consul UI
- **Con**: Polling-based (unless using watches)
- **Con**: Need custom MCP server

**Schema:**

```
/openclaw/messages/
  inbox/
    jerry-gateway/
      msg-001: {from: "bobby-gateway", to: "jerry-agent", body: "..."}
    bobby-gateway/
      msg-002: {from: "jerry-gateway", to: "bobby-agent", body: "..."}
```

**B. Redis Pub/Sub**

- **Pro**: Real-time, native pub/sub
- **Pro**: Fast, efficient
- **Con**: Need to deploy Redis
- **Con**: Less observable (ephemeral)

**C. Custom WebSocket Bridge**

- **Pro**: Could extend OpenClaw's native protocol
- **Pro**: Real-time
- **Con**: High complexity, maintenance burden
- **Con**: Not using existing infrastructure

**D. Hybrid: Consul KV + Redis**

- Consul KV for persistent registry/discovery
- Redis for ephemeral messaging
- Best of both worlds, more complexity

**Decision Point:** Start with **Consul KV** (A), migrate to hybrid (D) if latency becomes issue

---

### Challenge 2: Agent Registry & Discovery

**Problem:** How do agents find each other across gateways?

**Solution: Consul KV Registry**

**Schema:**

```
/openclaw/registry/
  gateways/
    jerry-gateway/
      url: "wss://jerry.tailscale:18789"
      status: "healthy"
      last_heartbeat: "2026-02-16T12:00:00Z"
      agents: ["jerry", "general"]

    bobby-gateway/
      url: "wss://bobby.tailscale:18789"
      status: "healthy"
      last_heartbeat: "2026-02-16T12:00:05Z"
      agents: ["bobby", "monitor"]

  agents/
    jerry/
      gateway: "jerry-gateway"
      capabilities: ["slack", "discord", "whatsapp", "general-qa"]
      status: "active"

    bobby/
      gateway: "bobby-gateway"
      capabilities: ["consul", "nomad", "monitoring", "alerting"]
      heartbeat_interval: "5m"
```

**MCP Tool: `agent_discover()`**

- Query Consul KV: `/openclaw/registry/agents/`
- Returns list of all agents, their gateways, capabilities
- Cached for performance (refresh every 30s)

---

### Challenge 3: Channel Coordination

**Problem:** Multiple gateways connecting to same WhatsApp/Slack → duplicate responses

**Solutions:**

**A. Separate Channels Per Gateway** ✅ RECOMMENDED INITIALLY

- Jerry gateway: Slack, Discord
- Bobby gateway: None (autonomous only)
- Billy gateway: WhatsApp
- No conflicts, simple

**B. Channel Sharding (Advanced)**

- One Slack bot, multiple gateways
- Route specific channels to specific gateways via bindings
- Requires coordination (Consul KV: which gateway owns which channel)
- Complex, but allows load balancing

**C. Primary/Standby Pattern**

- One gateway is "primary" for each channel
- Others are standby (only activate if primary fails)
- Requires leader election (Consul sessions)

**Decision Point:** Start with **A** (separate channels), implement **C** (primary/standby) in Phase 2 if needed

---

### Challenge 4: Shared Context/Memory

**Problem:** Agents on different gateways need shared context

**Example:** Jerry (Jerry node) asks Bobby (Bobby node) for Nomad status. Bobby needs to know what Jerry's current conversation context is.

**Solutions:**

**A. Message Passing Only** ✅ START HERE

- No shared memory
- All context passed in messages
- Stateless agents (except local workspace)
- Simple, explicit

**B. Consul KV Shared State**

- Agents write/read shared state to Consul KV
- Key schema: `/openclaw/state/{agent-id}/{key}`
- Observable, persistent
- Good for slowly-changing state (not fast writes)

**C. Redis Shared Memory**

- Fast read/write shared memory
- Good for session state, caches
- Need to deploy Redis
- Less observable

**D. Obsidian Vault Sync** (Long-term)

- Human-readable shared memory
- Synced via Tailscale + Syncthing
- Agents read/write markdown files
- Great for debugging, inspectable

**Decision Point:**

- Phase 1: **A** (message passing only)
- Phase 2: **B** (Consul KV for shared state)
- Phase 3: **D** (Obsidian vault for human-readable memory)

---

### Challenge 5: Session Management

**Problem:** OpenClaw sessions are per-gateway. Cross-gateway sessions don't exist.

**Example:** User talks to Jerry (Jerry gateway) via Slack. Then Jerry delegates to Bobby (Bobby gateway). Bobby responds to user... but Bobby doesn't have Jerry's session context.

**Solutions:**

**A. No Cross-Gateway Sessions** ✅ START HERE

- Each gateway has its own sessions
- Agents use A2A messaging (not sessions_send across gateways)
- User sees responses from originating agent only
- Simple, clear boundaries

**Flow:**

1. User → Jerry (Slack): "Check Nomad status"
2. Jerry → Bobby (Consul KV message): "Get Nomad status"
3. Bobby queries Nomad, responds via Consul KV
4. Jerry reads Bobby's response, synthesizes answer
5. Jerry → User (Slack): "Nomad status: all healthy"

**B. Session Replication (Advanced)**

- Replicate session state to Consul KV or Redis
- Other gateways can "attach" to session
- High complexity, state sync challenges
- Probably not worth it

**Decision Point:** **A** (no cross-gateway sessions), use A2A messaging pattern

---

## Design Decisions

### Decision 1: LLM Connectivity

**Approach:** Use existing LiteLLM gateway + ZAI GLM direct access

**Configuration:**

```json5
// All gateways use same model provider config
{
  modelProviders: {
    litellm: {
      baseUrl: "https://litellm.shamsway.net", // Already deployed, has observability
      apiKey: "${LITELLM_API_KEY}",
    },
    zai: {
      baseUrl: "https://api.zai.com/v1",
      apiKey: "${ZAI_API_KEY}",
      models: ["glm-4-plus", "glm-4-flash"], // Coding plan models
    },
  },
}
```

**Rationale:**

- LiteLLM provides observability, model routing, caching
- ZAI GLM cost-effective for coding tasks
- Already tested and working on Jerry node
- No changes needed for distributed deployment

---

### Decision 2: Gateway-to-Node Mapping

**Approach:** One gateway per node, pinned via Nomad constraints

**Mapping:**
| Node | Gateway | Agents | Primary Role |
|------|---------|--------|--------------|
| Jerry | jerry-gateway | jerry, general | User interface (Slack, Discord) |
| Bobby | bobby-gateway | bobby, monitor | Infrastructure monitoring |
| Billy | billy-gateway | billy, deploy, automate | Automation, deployments |

**Nomad Job Specs:**

- `openclaw-jerry.nomad.hcl` → constraint: `node.unique.name == "jerry"`
- `openclaw-bobby.nomad.hcl` → constraint: `node.unique.name == "bobby"`
- `openclaw-billy.nomad.hcl` → constraint: `node.unique.name == "billy"`

**Rationale:**

- Physical distribution across nodes
- Each node has local gateway (low latency)
- Each gateway manages its own agents
- No SPOF (each node independent)

---

### Decision 3: Agent Specialization

**Approach:** Functional specialization, distributed across gateways

**Agent Catalog (Initial):**

**Jerry Node (User Interface):**

- `jerry` - General-purpose assistant, Slack/Discord interface
- `general` - Fallback for unrouted queries

**Bobby Node (Infrastructure):**

- `bobby` - Infrastructure monitoring, Consul/Nomad health
- `monitor` - Alert aggregation, status reporting

**Billy Node (Automation):**

- `billy` - Scheduled task execution
- `deploy` - Nomad job deployments
- `automate` - Workflow automation

**Future Expansion:**

- `backup-agent` - Manages homelab backups
- `network-agent` - Network configuration, monitoring
- `security-agent` - Certificate management, secret rotation
- `dev-agent` - Development environment management

---

### Decision 4: Cross-Gateway Communication Protocol

**Approach:** Custom MCP server for Consul KV message bus

**Message Format:**

```json
{
  "id": "msg-1234567890",
  "from": "jerry-agent",
  "from_gateway": "jerry-gateway",
  "to": "bobby-agent",
  "to_gateway": "bobby-gateway",
  "timestamp": "2026-02-16T12:34:56Z",
  "body": {
    "type": "query",
    "action": "get_nomad_status",
    "params": {},
    "reply_to": "msg-1234567889" // Optional, for threading
  },
  "ttl": 300 // Seconds, auto-delete after TTL
}
```

**Consul KV Paths:**

```
/openclaw/messages/
  inbox/
    bobby-gateway/
      msg-1234567890: {message object}

  outbox/
    jerry-gateway/
      msg-1234567890: {message object, for auditing}
```

**MCP Tools:**

- `send_message(to_agent, body)` - Send message to agent on any gateway
- `check_inbox()` - Poll inbox for new messages
- `read_message(msg_id)` - Read and mark message as processed
- `list_agents()` - Discover all agents across gateways

**Workflow:**

1. Jerry agent calls `send_message("bobby", {action: "get_nomad_status"})`
2. MCP server writes to `/openclaw/messages/inbox/bobby-gateway/msg-XXX`
3. Bobby gateway polls inbox every 5s (or uses Consul watch)
4. Bobby agent processes message, sends reply via `send_message("jerry", {result: "..."})`
5. Jerry agent receives reply, synthesizes response to user

---

## Implementation Phases

### Phase 1: MVP (Weeks 1-2)

**Goal:** Prove cross-gateway communication works

**Deliverables:**

- [ ] Deploy 2 gateways (Jerry, Bobby) - Billy can wait
- [ ] Custom MCP server: Consul KV message bus
- [ ] Agent registry in Consul KV
- [ ] Simple A2A flow: Jerry → Bobby → Jerry
- [ ] Observable via Consul UI

**Success Criteria:**

- ✅ Jerry agent can send message to Bobby agent
- ✅ Bobby agent receives, processes, replies
- ✅ Jerry agent receives reply, synthesizes response
- ✅ Message flow visible in Consul KV
- ✅ Latency acceptable (<5s end-to-end)

### Phase 2: Production (Weeks 3-4)

**Goal:** Full 3-node deployment with reliability

**Deliverables:**

- [ ] Deploy Billy gateway (3 gateways total)
- [ ] Shared state in Consul KV (optional)
- [ ] Health monitoring (gateway heartbeats)
- [ ] Error handling (message delivery failures)
- [ ] Graceful degradation (gateway offline scenarios)

**Success Criteria:**

- ✅ All 3 gateways running, all agents registered
- ✅ Complex workflows (Jerry → Billy → Bobby → Jerry)
- ✅ Gateway failure handled gracefully
- ✅ Nomad restarts don't break message bus

### Phase 3: Enhancement (Weeks 5-8)

**Goal:** Polish, observability, demo-ready

**Deliverables:**

- [ ] Obsidian vault shared memory (human-readable)
- [ ] Dashboard (Grafana or custom) showing agent farm status
- [ ] Advanced routing (channel sharding, load balancing)
- [ ] Job-specific agents (deploy, backup, network)
- [ ] Documentation for community contribution

**Success Criteria:**

- ✅ Demo-ready (can present to community)
- ✅ Observable (dashboards show health, message flow)
- ✅ Maintainable (clear docs, runbooks)
- ✅ Extensible (easy to add new agents)

---

## Open Questions for Design Phase

### Technical

1. **Message delivery guarantees**: At-most-once, at-least-once, or exactly-once?
   - Consul KV = at-least-once (polling may see duplicates)
   - Need idempotency keys?

2. **Message TTL and cleanup**: How long do messages live in Consul KV?
   - Auto-delete after TTL (e.g., 5 minutes)?
   - Archive to long-term storage?

3. **Gateway discovery**: How do gateways find each other on startup?
   - Hardcoded list in config?
   - Auto-discovery via Consul services?

4. **Agent migration**: Can an agent move from one gateway to another?
   - Probably not needed (agents are code, not state)
   - Workspace/state stays on original node

5. **Channel routing conflicts**: What if two gateways try to respond to same message?
   - Start with separate channels (avoid problem)
   - Future: leader election per channel

### Operational

1. **Backup strategy**: How to backup agent workspaces across 3 nodes?
   - Existing homelab backup (Restic)?
   - Per-node or centralized?

2. **Updates/maintenance**: How to update gateways without downtime?
   - Rolling updates via Nomad?
   - Drain messages before shutdown?

3. **Monitoring/alerting**: What metrics matter?
   - Gateway health (heartbeat)
   - Message queue depth (backlog)
   - Agent response time
   - Cross-gateway latency

4. **Failure scenarios**: What happens when...
   - Gateway crashes mid-message?
   - Consul KV unavailable?
   - Network partition (node isolated)?

---

## Next Steps

### Immediate (Before Implementation)

1. **Review existing patterns**: Look at LangGraph multi-agent, AutoGen, CrewAI for A2A patterns
2. **Prototype MCP server**: Build Consul KV message bus MCP server (standalone test)
3. **Design schema**: Finalize Consul KV key structure (registry, messages, state)
4. **Test message flow**: Manually write/read Consul KV to validate pattern
5. **Document decisions**: Create ADR (Architecture Decision Records) for key choices

### Design Validation (Week 1)

1. Deploy Option 3 (single gateway) to production
2. Build MCP server prototype (Consul KV)
3. Test A2A messaging within single gateway (validate MCP tools work)
4. Measure latency, observability, reliability
5. Go/no-go decision on Option 2 implementation

### Implementation (Weeks 2-8)

1. Phase 1: MVP (2 gateways, basic A2A)
2. Phase 2: Production (3 gateways, reliability)
3. Phase 3: Enhancement (observability, demo-ready)

---

## Success Metrics

### Technical

- ✅ Zero single points of failure (any node can fail)
- ✅ Cross-gateway latency <5s for A2A messages
- ✅ Gateway uptime >99% (Nomad restarts <30s)
- ✅ Message delivery reliability >99.9%

### Operational

- ✅ Observable (Consul UI, dashboards show farm status)
- ✅ Maintainable (runbooks, clear documentation)
- ✅ Extensible (add new agent in <1 hour)
- ✅ Recoverable (node failure → auto-recovery <5 minutes)

### Strategic

- ✅ Demo-ready (can present to community)
- ✅ Community contribution (case study, blog post)
- ✅ LangGraph replacement (simpler, more maintainable)
- ✅ Enterprise pattern (showcases distributed architecture)

---

## Resources

### Internal Documentation

- [Multi-Node Deployment Analysis](./MULTI_NODE_DEPLOYMENT_ANALYSIS.md)
- [Homelab Deployment Plan v2](./HOMELAB_DEPLOYMENT_PLAN_V2.md)
- [Multi-Agent Strategy](./homelab/strategy/multi-agent-strategy.md)
- [Gateway Architecture Guide](./gateway-architecture-guide.md)

### External References

- OpenClaw Multi-Agent: https://docs.openclaw.ai/concepts/multi-agent
- Consul KV API: https://www.consul.io/api-docs/kv
- Consul Watches: https://www.consul.io/docs/agent/watches
- LangGraph Multi-Agent: (your existing prototype for patterns)

### Related Projects

- AutoGen: https://github.com/microsoft/autogen (multi-agent framework)
- CrewAI: https://github.com/joaomdmoura/crewAI (agent coordination)
- LangGraph: https://github.com/langchain-ai/langgraph (your current prototype)

---

**Status:** Design brief complete, ready for review and testing/validation phase
**Next Review:** After Option 3 deployed and validated
**Decision Point:** Go/no-go on Option 2 implementation based on design validation results
