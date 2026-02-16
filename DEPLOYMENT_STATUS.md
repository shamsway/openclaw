# OpenClaw Homelab Deployment - Current Status

**Last Updated:** 2026-02-16
**Environment:** Octant homelab (Jerry, Bobby, Billy) + MacBook M3 Max

---

## Project Status: Design & Planning Complete

### Documentation Status

| Document                                                                               | Status      | Purpose                                       |
| -------------------------------------------------------------------------------------- | ----------- | --------------------------------------------- |
| [MULTI_NODE_DEPLOYMENT_ANALYSIS.md](./MULTI_NODE_DEPLOYMENT_ANALYSIS.md)               | ✅ Complete | Architecture options (1, 2, 3) with pros/cons |
| [HOMELAB_DEPLOYMENT_PLAN_V2.md](./HOMELAB_DEPLOYMENT_PLAN_V2.md)                       | ✅ Complete | Phased deployment plan (Option 3 → Option 2)  |
| [OPTION_2_DESIGN_BRIEF.md](./OPTION_2_DESIGN_BRIEF.md)                                 | ✅ Complete | Strategic design for distributed agent farm   |
| [gateway-architecture-guide.md](./gateway-architecture-guide.md)                       | ✅ Complete | OpenClaw gateway patterns explained           |
| [homelab/strategy/multi-agent-strategy.md](./homelab/strategy/multi-agent-strategy.md) | ✅ Complete | Agent specialization principles               |

---

## Strategic Direction Confirmed

### Vision

Build **enterprise-grade distributed agent farm** using OpenClaw on Octant homelab, replacing LangGraph prototype.

### Goals

1. ✅ **Eliminate SPOF**: No single points of failure (network engineer requirement)
2. ✅ **Full homelab utilization**: Use all 3 nodes (Jerry, Bobby, Billy)
3. ✅ **Technical demo**: Beyond homelab - showcase for community
4. ✅ **Community contribution**: Document and share learnings
5. ✅ **LangGraph replacement**: Simpler, more maintainable multi-agent system

### Approach

- **Phase 1-3**: Deploy Option 3 (single gateway, proven patterns) as foundation
- **Phase 4+**: Implement Option 2 (distributed gateways) after design validation
- **LLM Strategy**: LiteLLM gateway (observability) + ZAI GLM (cost-effective)

---

## Current Environment

### Infrastructure (Ready)

- ✅ **Octant homelab**: 3-node cluster (Jerry, Bobby, Billy)
- ✅ **Nomad**: Container orchestration with Podman driver
- ✅ **Consul**: Service discovery, health checks, KV store
- ✅ **Tailscale**: VPN mesh, DNS
- ✅ **1Password**: Secrets management
- ✅ **LiteLLM**: Gateway deployed at litellm.shamsway.net (with observability)
- ✅ **ZAI GLM**: API access configured, coding plan active

### OpenClaw Testing (Jerry Node)

- ✅ **Single gateway**: Tested and working on Jerry node
- ✅ **Podman deployment**: Build, run, persist working
- ✅ **LiteLLM integration**: Tested and working
- ✅ **ZAI GLM integration**: Tested and working
- ⏳ **Multi-agent**: Not yet configured (3 agents planned)
- ⏳ **Channels**: Not yet configured (Slack, Discord, WhatsApp planned)

### MacBook M3 Max

- ✅ **Hardware**: 128GB RAM, daily driver
- ✅ **Tailscale**: Connected to homelab mesh
- ✅ **LM Studio**: Available (not yet configured for OpenClaw)
- ⏳ **Independent gateway**: Not yet deployed (Phase 4)

---

## Next Actions

### Immediate (Before Continuing)

**Owner:** Matt
**Timeline:** Self-managed

1. **Review documentation**
   - [x] Read MULTI_NODE_DEPLOYMENT_ANALYSIS.md
   - [x] Read HOMELAB_DEPLOYMENT_PLAN_V2.md
   - [x] Read OPTION_2_DESIGN_BRIEF.md
   - [ ] Validate strategic direction aligns with goals

2. **Testing & validation**
   - [ ] Test current Jerry node deployment
   - [ ] Validate LiteLLM + ZAI GLM integration
   - [ ] Experiment with multi-agent config (local testing)
   - [ ] Test channel connectivity (Slack, Discord, WhatsApp)

3. **Design refinement**
   - [ ] Review Option 2 design brief
   - [ ] Research existing A2A patterns (LangGraph, AutoGen, CrewAI)
   - [ ] Validate Consul KV message bus approach
   - [ ] Identify any technical blockers

### When Ready to Continue

**Trigger:** Matt completes review and testing, confirms ready to proceed

**Next Steps:**

1. **Phase 1 deployment** (Week 1)
   - Deploy single gateway to Nomad (Jerry node)
   - Configure 3 agents (Jerry, Bobby, Billy)
   - Test built-in A2A communication

2. **Phase 2 deployment** (Week 2)
   - Configure channels (Slack, Discord, WhatsApp)
   - Test multi-channel routing
   - Validate agent specialization

3. **Option 2 design validation** (Week 3)
   - Prototype Consul KV MCP server
   - Test cross-gateway messaging (manual Consul KV write/read)
   - Measure latency and feasibility
   - Go/no-go decision on Option 2 implementation

---

## Key Decisions Made

### Architecture

- ✅ **Phased approach**: Option 3 first (foundation), then Option 2 (distributed)
- ✅ **Gateway-per-node**: Jerry, Bobby, Billy each get own gateway (Option 2)
- ✅ **Agent specialization**: Functional distribution (UI, infra, automation)
- ✅ **Cross-gateway A2A**: Consul KV message bus (custom MCP server)

### LLM Strategy

- ✅ **LiteLLM gateway**: Primary (observability, model routing)
- ✅ **ZAI GLM**: Cost-effective coding models
- ✅ **Anthropic**: Backup/fallback
- ❌ **MacBook local LLM**: Only for MacBook agent, NOT for homelab

### Channels

- ✅ **Slack**: Jerry agent (general interface)
- ✅ **Discord**: Jerry or Bobby agent (alerts, monitoring)
- ✅ **WhatsApp**: Jerry agent initially, Billy later

### Deployment

- ✅ **Nomad orchestration**: Container deployment, health checks
- ✅ **Podman driver**: Rootless containers
- ✅ **1Password secrets**: Vault integration for credentials
- ✅ **Consul service registry**: Gateway discovery, health

---

## Open Questions

### Technical (Option 2)

1. **Message delivery guarantees**: At-most-once vs at-least-once?
2. **Gateway discovery**: Hardcoded vs auto-discovery via Consul?
3. **Channel routing**: Separate channels vs sharding vs primary/standby?
4. **Shared context**: Message passing only vs Consul KV state?

### Operational

1. **Backup strategy**: Per-node or centralized workspace backup?
2. **Update process**: Rolling updates via Nomad?
3. **Monitoring**: What metrics matter for agent farm?
4. **Failure scenarios**: Gateway crash, Consul unavailable, network partition?

### Strategic

1. **Timeline**: Self-managed, no pressure
2. **Scope**: MVP first, then iterate vs full build upfront?
3. **Demo target**: OpenClaw community, network engineers, both?
4. **Contribution**: Blog post, case study, code PRs, all of above?

---

## Success Criteria

### Phase 1-3 (Option 3 Foundation)

- ✅ Single gateway deployed to Nomad, healthy
- ✅ 3 agents (Jerry, Bobby, Billy) responding
- ✅ 3 channels (Slack, Discord, WhatsApp) working
- ✅ Built-in A2A communication validated
- ✅ Ready for job-specific agent expansion

### Phase 4+ (Option 2 Distributed)

- ✅ 3 gateways (Jerry, Bobby, Billy nodes) running
- ✅ Cross-gateway A2A messaging working (Consul KV)
- ✅ Agent registry and discovery functional
- ✅ Zero SPOF (any node can fail, others continue)
- ✅ Observable (Consul UI, dashboards)
- ✅ Demo-ready (can present to community)

---

## Risk Management

### High Risk (Mitigations Planned)

- ⚠️ **Option 2 complexity**: Design phase first, prototype before full implementation
- ⚠️ **Cross-gateway A2A**: Research existing patterns, validate with prototypes
- ⚠️ **Channel conflicts**: Start with separate channels per gateway

### Medium Risk (Acceptable)

- ⚠️ **Unsupported patterns**: Option 2 is novel, willing to contribute back learnings
- ⚠️ **Operational burden**: 3 gateways vs 1, but homelab designed for this
- ⚠️ **Timeline uncertainty**: Self-managed, no external deadlines

### Low Risk (Minimal)

- ✅ **Option 3 deployment**: Proven OpenClaw patterns, well-documented
- ✅ **LiteLLM integration**: Already tested and working
- ✅ **Infrastructure**: Octant homelab is stable and reliable

---

## Resources

### Internal Docs

- [Multi-Node Analysis](./MULTI_NODE_DEPLOYMENT_ANALYSIS.md) - Architecture deep dive
- [Deployment Plan v2](./HOMELAB_DEPLOYMENT_PLAN_V2.md) - Phased implementation
- [Option 2 Design](./OPTION_2_DESIGN_BRIEF.md) - Distributed agent farm design
- [Gateway Guide](./gateway-architecture-guide.md) - OpenClaw patterns
- [Agent Strategy](./homelab/strategy/multi-agent-strategy.md) - Specialization principles

### External References

- OpenClaw Docs: https://docs.openclaw.ai/
- LiteLLM: https://docs.litellm.ai/
- Consul KV: https://www.consul.io/api-docs/kv
- Nomad: https://www.nomadproject.io/docs

---

**Status:** ✅ Design and planning complete, awaiting review and testing before implementation
**Next Milestone:** Phase 1 deployment after Matt completes validation
**Contact:** Self-managed timeline, no external dependencies
