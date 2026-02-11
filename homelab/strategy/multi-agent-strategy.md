# Multi-Agent Strategy

Design principles and guidelines for the OpenClaw homelab agent network.

---

## Core Principle: Separate Along Natural Seams

The band metaphor applies directly. Members don't duplicate each other — they have complementary
roles that create something greater together.

**Split agents when you have:**
- Different security/trust boundaries (read-only vs. destructive access)
- Different autonomy models (proactive/always-on vs. interactive/on-demand)
- Natural domain separation (networking vs. scheduling vs. workloads)
- Different conversation contexts users would naturally route separately

**Group capabilities when:**
- They share context naturally (Nomad job state + Consul health are related)
- They're too simple to warrant a workspace and memory of their own
- Users would never address them separately

---

## Multi-Agent Routing Patterns

Three patterns — you'll likely use all three:

### 1. Channel-based routing (user-initiated)
Bind different Slack channels, Discord channels, or separate bots to different agents. Users
self-route by picking where they ask. No orchestration needed.

### 2. A2A hub dispatch (agent-initiated)
An agent receives a request, recognizes it belongs to a specialist, and hands it off via the
A2A hub. The specialist does the work and returns a result. The originating agent synthesizes
and responds. This is the "contractor" model — the general agent is the foreman, specialists
do the work.

### 3. Heartbeat autonomy (agent self-directed)
Some agents don't need to be asked anything. They run on a schedule, check their domain, and
reach out when something needs attention. The user never initiates — the agent does. This is
the "rhythm section" model: always running in the background, keeping time.

---

## Simple Agent Decision Framework

> If an agent needs its own *memory*, its own *schedule*, or its own *security boundary*,
> it's a real agent. Otherwise, it's an MCP tool (or a heartbeat check item).

**Start grouped, split when you feel friction.**

| Agent type | Recommended approach |
|---|---|
| Single-tool wrapper | MCP server, not an agent |
| Scheduled/polling task | Heartbeat item, or cron targeting a lightweight agent |
| Persistent state needed | Standalone agent with own workspace |
| Users address it directly | Standalone agent with own channel binding |
| Complex state machine | Keep external, wrap with MCP |
| Simple LLM reasoning + tool use | Fold into an existing agent |

For LangGraph/LangChain migrations: most "simple agents" end up as MCP tools that a capable
agent orchestrates. Push the tools to MCP servers; keep LLM reasoning in one place.

---

## The Band Model Applied

### Jerry (running — general hub)
*Jerry Garcia: versatile lead, the voice of the band*

- **Role:** General-purpose assistant + homelab ops hub
- **Domain:** Broad — first point of contact for most requests
- **Autonomy:** Medium — responds to requests, dispatches to specialists
- **Security:** General read access, careful with mutations
- **Channels:** Slack, Discord, Web UI

### Bobby (next — infrastructure backbone)
*Bob Weir: rhythm, backbone, keeps the band in sync*

- **Role:** Infrastructure reliability and health monitoring
- **Domain:** Nomad job management, Consul service health, cluster status
- **Autonomy:** High — heartbeat-driven, proactive alerting
- **Security:** Read broadly, write scoped (restart jobs, not destroy infra)
- **Persona:** Reliable, steady, doesn't panic — but escalates clearly
- **User interaction:** Mostly none. When Bobby messages you, something needs attention.

### Billy (next — automation and scheduling)
*Bill Kreutzmann: keeps time, the engine behind everything*

- **Role:** Scheduled tasks, cron-like ops, batch jobs, recurring workflows
- **Domain:** Automation, timed operations, background processing
- **Autonomy:** Highest — mostly autonomous, reports outcomes
- **Security:** Narrow blast radius, scoped to its task list
- **Persona:** Efficient, minimal, action-oriented. Doesn't chat; does things.
- **User interaction:** Via task queue / HEARTBEAT.md, not direct conversation

### Future nodes (Phil, Mickey, Pigpen...)
*To be defined as the cluster grows and specialization becomes clear*

---

## Routing Summary

```
User (Slack/Discord)
       │
       ▼
   Jerry (hub)
   ├── simple requests → handles directly
   ├── infra health queries → dispatches to Bobby via A2A
   ├── scheduled task management → dispatches to Billy via A2A
   └── specialized domains → dispatches to future agents

Bobby (autonomous)
   └── Nomad/Consul heartbeat → proactive alerts to user

Billy (autonomous)
   └── Task queue heartbeat → runs jobs, reports outcomes
```

---

## Notes

- Bobby and Billy design is provisional — refine once the existing Octant agent farm is mapped
- The A2A hub routing logic may fold into OpenClaw's binding system or stay as a meta-MCP server
- Prefer adding capabilities to existing agents over creating new ones until a clear seam emerges
