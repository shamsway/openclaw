# OpenClaw Homelab Deployment Plan

**Date:** 2026-01-31
**Target Environment:** Octant homelab framework with Podman + MacBook integration
**Homelab Framework:** [Octant](https://github.com/shamsway/octant) - Ansible/Nomad/Consul/Tailscale/1Password

## Executive Summary

This document outlines deployment strategies for running OpenClaw Gateway in the Octant homelab environment, with a focus on:
- **Podman-first approach** (aligns with Octant's rootless Podman preference)
- **Leveraging existing infrastructure** (Tailscale VPN, 1Password secrets, Consul/Nomad)
- **Testing path** leading to full Octant integration
- **Multi-environment setup** (homelab node + MacBook agents)

The deployment strategy progresses through three phases:
1. **Phase 1:** Standalone testing with Podman
2. **Phase 2:** Integration with existing Octant services (Tailscale, 1Password)
3. **Phase 3:** Full Nomad orchestration with Consul service discovery

---

## Current State Assessment

### Existing Setup
- ✅ `podman-setup.sh` script created (mirrors Docker setup)
- ✅ Podman compose configuration in place
- ✅ Basic container build and volume mounting configured
- ✅ Octant homelab framework with Nomad/Consul/Tailscale
- ✅ Existing Tailscale VPN infrastructure
- ✅ Existing 1Password secrets management
- ⚠️ Podman is **not officially supported** by OpenClaw (Docker is official)

### What's Working
- Image building with Podman
- Persistent volumes for config (`~/.openclaw`) and workspace (`~/.openclaw/workspace`)
- Onboarding flow
- Gateway startup via podman-compose

### Octant Framework Context
Your existing homelab provides:
- **Container orchestration:** Nomad with Podman driver (rootless preferred)
- **Service discovery:** Consul for dynamic service registration
- **Network connectivity:** Tailscale mesh VPN
- **Secrets management:** 1Password integration
- **Configuration management:** Ansible roles and playbooks
- **Infrastructure as code:** Terraform modules for services

---

## Deployment Philosophy

Given your Octant framework, we'll take a **progressive integration approach**:

1. **Start simple:** Standalone Podman containers for testing
2. **Integrate incrementally:** Leverage Tailscale and 1Password first
3. **Full orchestration:** Deploy as Nomad job when ready

This allows you to:
- Test OpenClaw without disrupting existing infrastructure
- Validate the Podman approach before committing to Nomad
- Build confidence with standalone deployment first
- Seamlessly upgrade to full Octant integration later

---

## Architecture Options

### Option A: Podman Container (Recommended for Octant Framework)

**Overview:**
- Gateway runs inside rootless Podman container
- Aligns with Octant's rootless Podman preference
- Persistence via volume mounts
- Prepares for eventual Nomad orchestration
- Isolated environment, easy to destroy/rebuild

**Why Podman for Octant:**
- ✅ **Framework alignment:** Octant uses rootless Podman for all workloads
- ✅ **Nomad compatibility:** Podman driver is first-class in Nomad
- ✅ **Isolation:** Container boundary keeps OpenClaw separated from other services
- ✅ **Terraform-ready:** Easy to wrap in Terraform module like other Octant services
- ✅ **Testing flexibility:** Can test standalone before Nomad deployment

**Pros:**
- ✅ Matches Octant deployment patterns
- ✅ Complete isolation from other services
- ✅ Easy to destroy and rebuild during testing
- ✅ Familiar podman-compose workflow
- ✅ Direct path to Nomad job deployment
- ✅ Rootless execution for security

**Cons:**
- ⚠️ Not officially supported by OpenClaw (Docker is official)
- ⚠️ Additional complexity for troubleshooting
- ⚠️ Must bake external binaries into image
- ⚠️ Container overhead (minimal with Podman)

**Best for:** Testing in Octant environment, eventual Nomad deployment

**Build and Run:**

```bash
# Build the homelab image (includes Nomad, Consul, Terraform, op CLIs)
podman build -t openclaw-homelab:local -f homelab/Dockerfile .

# Or use the standard base image (no infrastructure tools)
podman build -t openclaw:local -f Dockerfile .

# Run setup (interactive onboarding)
OPENCLAW_IMAGE=openclaw-homelab:local ./podman-setup.sh

# Service management
podman-compose up -d openclaw-gateway
podman-compose logs -f openclaw-gateway
podman-compose restart openclaw-gateway
```

### Homelab Image: Infrastructure Tools

The homelab agent (Jerry and future nodes) needs CLI access to the Octant stack.
`homelab/Dockerfile` extends the base OpenClaw image with:

| Tool | Source | Purpose |
|------|--------|---------|
| `nomad` | HashiCorp APT repo | Query jobs, allocations, logs |
| `consul` | HashiCorp APT repo | Service catalog, health checks |
| `terraform` | HashiCorp APT repo | Plan/apply infrastructure changes |
| `op` | 1Password binary download | Read secrets from 1Password vaults |
| `jq`, `curl`, `ssh`, `dig` | Debian APT | General ops utilities |

**Why not Homebrew?**

Homebrew (Linuxbrew) is not suitable for containers:

- Requires a non-root user to install and run
- Adds 500 MB+ overhead per formula
- Designed for interactive use, not reproducible builds
- Can compile from source (slow, non-deterministic)

Use the [HashiCorp APT repository](https://www.hashicorp.com/en/blog/announcing-the-hashicorp-linux-repository)
and direct binary downloads instead — same tools, deterministic, minimal footprint.

**Tailscale in the container:**

The container does NOT need `tailscaled` running inside it. The host already
runs Tailscale, so the container inherits network connectivity automatically
(Podman uses host networking or bridges through). The `tailscale` binary can
be installed for status queries, but it needs access to the host daemon socket
(`-v /var/run/tailscale:/var/run/tailscale`). The simpler alternative is using
the Tailscale MCP server (listed in `homelab/jerry/TOOLS.md`).

### Runtime Environment Variables

Pass these via `.env` or `docker-compose` environment (never bake into the image):

```bash
# ── Nomad ──────────────────────────────────────────────────────────────────────
NOMAD_ADDR=http://nomad.service.consul:4646   # or http://<node-ip>:4646
NOMAD_TOKEN=<acl-token>                        # only if Nomad ACLs are enabled

# ── Consul ─────────────────────────────────────────────────────────────────────
CONSUL_HTTP_ADDR=http://127.0.0.1:8500         # or http://consul.service.consul:8500
CONSUL_HTTP_TOKEN=<acl-token>                  # only if Consul ACLs are enabled

# ── 1Password CLI ─────────────────────────────────────────────────────────────
# Option A: Service Account (recommended for headless/container use)
OP_SERVICE_ACCOUNT_TOKEN=<service-account-token>

# Option B: 1Password Connect server (if you run op-connect in your homelab)
OP_CONNECT_HOST=https://op-connect.your-tailnet.ts.net
OP_CONNECT_TOKEN=<connect-token>

# ── Terraform (optional) ───────────────────────────────────────────────────────
TF_TOKEN_app_terraform_io=<token>              # only if using Terraform Cloud
```

For Nomad job deployments (Phase 3), inject these via the job's `template` block
using Vault or 1Password instead of environment variables:

```hcl
template {
  data        = <<EOT
{{with secret "kv/data/openclaw"}}
NOMAD_TOKEN={{.Data.data.nomad_token}}
OP_SERVICE_ACCOUNT_TOKEN={{.Data.data.op_service_account_token}}
{{end}}
EOT
  destination = "secrets/infra.env"
  env         = true
}
```

---

### Option B: Native systemd Installation (Alternative)

**Overview:**
- Install OpenClaw directly on Linux with Node.js
- Use systemd user service for auto-start
- Docker/Podman still used for agent sandboxing only
- Lightest weight, simplest to troubleshoot

**Pros:**
- ✅ Official support and documentation
- ✅ Simpler troubleshooting (direct access to logs, processes, config)
- ✅ Better performance (no container overhead)
- ✅ Easier updates (`npm i -g openclaw@latest`)
- ✅ Agent sandboxing still available via Docker/Podman

**Cons:**
- ❌ Less isolation than containers
- ❌ Doesn't align with Octant patterns
- ❌ Harder to migrate to Nomad later
- ❌ Direct system installation

**Best for:** Quick testing, official support priority, performance-critical deployments

**Critical Requirements:**

1. **Bake External Binaries into Image**
   - Any skill-required binaries MUST be in the Dockerfile
   - Runtime installations are lost on container restart
   - See example below

2. **Handle Rootless Podman Permissions**
   - Ensure mounted volumes have correct subuid ownership
   - Run `fix-podman-permissions.sh` before setup

**Enhanced Dockerfile Example:**

```dockerfile
FROM node:22-bookworm

# Install system dependencies
RUN apt-get update && apt-get install -y \
    socat \
    git \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install external binaries (examples - add yours here)
# Gmail CLI
RUN curl -L https://github.com/steipete/gog/releases/latest/download/gog_Linux_x86_64.tar.gz \
  | tar -xz -C /usr/local/bin && chmod +x /usr/local/bin/gog

# Google Places CLI
RUN curl -L https://github.com/steipete/goplaces/releases/latest/download/goplaces_Linux_x86_64.tar.gz \
  | tar -xz -C /usr/local/bin && chmod +x /usr/local/bin/goplaces

# WhatsApp CLI
RUN curl -L https://github.com/steipete/wacli/releases/latest/download/wacli_Linux_x86_64.tar.gz \
  | tar -xz -C /usr/local/bin && chmod +x /usr/local/bin/wacli

# Add more binaries as needed...

# Install Bun (required for build scripts)
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"

# Enable pnpm
RUN corepack enable

WORKDIR /app

# Cache dependencies (rebuild only when lockfiles change)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY ui/package.json ./ui/package.json
COPY scripts ./scripts

RUN pnpm install --frozen-lockfile

# Copy source and build
COPY . .
RUN pnpm build
RUN pnpm ui:install
RUN pnpm ui:build

ENV NODE_ENV=production

CMD ["node","dist/index.js"]
```

**Usage:**
```bash
# Build image
podman build \
  --build-arg "OPENCLAW_DOCKER_APT_PACKAGES=${OPENCLAW_DOCKER_APT_PACKAGES}" \
  -t openclaw:local \
  -f Dockerfile \
  .

# Run setup
./podman-setup.sh

# Service management
podman-compose up -d openclaw-gateway
podman-compose logs -f openclaw-gateway
podman-compose restart openclaw-gateway
podman-compose down

# Verify binaries persisted
podman-compose exec openclaw-gateway which gog
podman-compose exec openclaw-gateway which wacli
```

---

### Option C: Nomad Orchestrated Deployment (Future State)

**Overview:**
- Deploy OpenClaw as a Nomad job
- Integrate with Consul service discovery
- Leverage Octant's existing infrastructure
- Full infrastructure-as-code deployment

**Why Nomad:**
- ✅ **Matches Octant patterns:** All services deploy via Nomad
- ✅ **Service discovery:** Automatic Consul registration
- ✅ **Health checking:** Nomad monitors gateway health
- ✅ **Resource management:** CPU/memory limits and allocation
- ✅ **Multi-node scheduling:** Can run on any cluster node
- ✅ **Terraform integration:** Wrap in Terraform module

**Prerequisites:**
1. Successful Podman standalone deployment (Option A)
2. Octant cluster running (Consul + Nomad)
3. OpenClaw image built and available
4. Configuration tested and validated

**Deployment Pattern:**
- Create Terraform module (similar to other Octant services)
- Define Nomad job with Podman driver
- Configure Consul service registration
- Set up Traefik routing (optional)
- Store secrets in 1Password, reference in job

**Best for:** Production homelab deployment, full Octant integration

**Timeline:** After testing with standalone Podman deployment

**Note:** This option is detailed later in the "Phase 3: Nomad Integration" section.

---

## Homelab + MacBook Integration Strategy

### Recommended Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Linux Homelab Server(s)                                │
│  ┌───────────────────────────────────────────────────┐  │
│  │  OpenClaw Gateway (Always-On)                     │  │
│  │  - systemd service or Podman container            │  │
│  │  - Binds to loopback or lan                       │  │
│  │  - Multiple agents supported (optional)           │  │
│  │  - Agent sandboxing via Docker/Podman             │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                         ↕
                Tailscale VPN or
                SSH Tunnel (secure)
                         ↕
┌─────────────────────────────────────────────────────────┐
│  MacBook                                                │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Option 1: OpenClaw Mac App (local gateway)      │  │
│  │  Option 2: Connect to remote homelab gateway     │  │
│  │  Option 3: Both (separate profiles)              │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### MacBook Options

#### Option 1: Mac App Only (Local Gateway)
- Install OpenClaw.app
- Runs local gateway in menubar
- Independent from homelab
- Best for: Local development, mobile work, offline capability

#### Option 2: Remote Gateway Only
- No local gateway on MacBook
- SSH tunnel or Tailscale to homelab
- Access Control UI at `http://127.0.0.1:18789`
- Best for: Always-on homelab as primary gateway

**Remote Access Methods:**
```bash
# Method 1: SSH Tunnel (simple, secure)
ssh -N -L 18789:127.0.0.1:18789 user@homelab-server
# Then open: http://127.0.0.1:18789

# Method 2: Tailscale Serve (best UX)
# On homelab server:
tailscale serve https / http://127.0.0.1:18789
# Access via: https://homelab-server.tailscale-name.ts.net

# Method 3: Direct LAN (if gateway binds to lan)
# Gateway must bind to lan: --bind lan
# Access via: http://homelab-server-ip:18789
# Requires gateway token authentication
```

#### Option 3: Hybrid (Both Environments)
- Mac app for local/mobile work
- Remote gateway for always-on homelab agents
- Use `--profile` flag to separate configs
- Different messaging accounts per gateway
- Best for: Maximum flexibility

**Profile-based isolation:**
```bash
# On MacBook (local)
openclaw --profile mac onboard
openclaw --profile mac gateway

# On homelab (remote)
openclaw --profile homelab onboard
openclaw --profile homelab gateway

# Each profile has:
# - Separate config: ~/.openclaw-{profile}/openclaw.json
# - Separate state: ~/.openclaw-{profile}/
# - Separate workspace: ~/.openclaw/workspace-{profile}/
# - Unique ports to avoid conflicts
```

---

## Multi-Agent Architecture (Optional)

OpenClaw supports **multiple isolated agents in one Gateway process**.

### Use Cases
- Personal agent (full access) + Family agent (restricted access)
- Different messaging accounts routed to different agents
- Per-agent sandbox policies and tool restrictions
- One agent per person for complete isolation

### Configuration
Each agent has:
- Separate workspace directory
- Separate state directory
- Separate sessions
- Per-agent auth profiles
- Per-agent sandbox settings

### Example Routing
```json5
{
  agents: {
    defaults: {
      sandbox: { mode: "non-main", scope: "agent" },
    },
    list: [
      {
        id: "personal",
        name: "Personal Agent",
        workspace: "~/.openclaw/workspace-personal",
        sandbox: { mode: "off" },  // Full access
      },
      {
        id: "family",
        name: "Family Agent",
        workspace: "~/.openclaw/workspace-family",
        sandbox: { mode: "all", workspaceAccess: "ro" },
      },
    ],
  },
  bindings: [
    { agentId: "personal", match: { channel: "whatsapp", peer: { kind: "dm", id: "+15551234567" } } },
    { agentId: "family",   match: { channel: "telegram" } },
  ],
}
```

### Discord & Slack: One App, Multiple Agents

**A single Discord bot or Slack app can serve multiple agents.** You do not need a separate app per agent. The bot/app is just a platform identity — OpenClaw's routing layer handles the fan-out to different agent workspaces.

**Routing priority (most-specific wins):**
1. `peer` match (exact DM or channel ID)
2. `guildId` (Discord server)
3. `teamId` (Slack workspace)
4. `accountId` (channel account)
5. channel-wide match
6. default agent

#### Discord: route by server (guild) or channel

```json5
{
  agents: {
    list: [
      { id: "personal", workspace: "~/.openclaw/workspace-personal" },
      { id: "work",     workspace: "~/.openclaw/workspace-work" },
    ],
  },
  bindings: [
    // Entire Discord server A → personal agent
    { agentId: "personal", match: { channel: "discord", guildId: "111222333444" } },
    // Entire Discord server B → work agent
    { agentId: "work",     match: { channel: "discord", guildId: "555666777888" } },
    // Or a specific channel overrides the guild rule
    { agentId: "work",     match: { channel: "discord", peer: { kind: "channel", id: "987654321" } } },
  ],
}
```

#### Slack: route by workspace (team) or channel

```json5
{
  bindings: [
    { agentId: "personal", match: { channel: "slack", teamId: "T11111111" } },
    { agentId: "work",     match: { channel: "slack", teamId: "T22222222" } },
    // Or a specific Slack channel
    { agentId: "work",     match: { channel: "slack", peer: { kind: "channel", id: "C99999999" } } },
  ],
}
```

#### When to create separate apps (multiple tokens)

You only need separate Discord Applications or Slack Apps when:
- **Different bot personas** — you want each agent to appear under a different name/avatar in the platform
- **Security isolation** — separate tokens = separate permission scopes
- **Separate gateway processes** — if each homelab node runs its own full gateway (not multi-agent), each needs its own app

For separate tokens, use `channels.discord.accounts` / `channels.slack.accounts`:

```json5
{
  channels: {
    discord: {
      accounts: {
        homebot: { token: "Bot TOKEN_A", name: "Home Bot" },
        workbot: { token: "Bot TOKEN_B", name: "Work Bot" },
      },
    },
  },
  bindings: [
    { agentId: "personal", match: { channel: "discord", accountId: "homebot" } },
    { agentId: "work",     match: { channel: "discord", accountId: "workbot" } },
  ],
}
```

#### 3-node homelab topology guide

| Topology | Approach |
|----------|----------|
| One gateway, multiple agents | One Discord app + one Slack app — route by `guildId` / `teamId` / channel |
| One gateway per node, different servers | One app per node (each bot joins different servers) |
| Multiple gateways, same Discord server | Separate bots required — otherwise two gateways both respond |

**Documentation:** https://docs.openclaw.ai/concepts/multi-agent

---

## Security Considerations

### Minimal Security (SSH Tunnel)
```bash
# Gateway binds to loopback only
openclaw gateway --bind loopback --port 18789

# Access via SSH tunnel from MacBook
ssh -N -L 18789:127.0.0.1:18789 user@homelab-server

# Open http://127.0.0.1:18789 in browser
```

**Pros:**
- ✅ Simple setup
- ✅ No VPN required
- ✅ Encrypted tunnel
- ✅ No public exposure

**Cons:**
- ❌ Must maintain SSH connection
- ❌ Manual tunnel management

---

### Enhanced Security (Tailscale VPN) - Recommended for Octant

**You already have Tailscale!** Your Octant framework uses it for connectivity.

```bash
# Gateway can bind to loopback or Tailscale IP
openclaw gateway --bind loopback --port 18789

# Optional: Tailscale Serve for HTTPS (if not using Traefik)
tailscale serve https / http://127.0.0.1:18789

# Access from MacBook via Tailscale hostname
# https://homelab-node.your-tailnet.ts.net
```

**Pros:**
- ✅ **Already deployed** in your Octant framework
- ✅ Best user experience
- ✅ Always-on connectivity
- ✅ No manual tunnel management
- ✅ Auto HTTPS with Tailscale Serve
- ✅ Access from any device on tailnet
- ✅ Integrates with existing Octant services

**Cons:**
- None - you already have this!

**Octant Integration Notes:**
- Tailscale is already configured via Ansible
- Your MacBook is likely already on the tailnet
- All homelab nodes are accessible via Tailscale
- Consider using Traefik (already in Octant) for routing instead of Tailscale Serve

---

## Recommended Implementation Path for Octant

This section provides a phased approach to deploying OpenClaw in your Octant homelab, progressing from simple testing to full integration.

---

## Phase 1: Standalone Podman Testing

**Goal:** Get OpenClaw running in a Podman container with basic functionality

**Duration:** 1-2 hours

**Prerequisites:**
- Homelab node with Podman installed (you already have this via Octant)
- Access to the node via SSH or directly
- Basic familiarity with podman-compose

### Step 1.1: Prepare the Environment

```bash
# SSH to your homelab node
ssh user@homelab-node

# Clone your OpenClaw fork
git clone https://github.com/shamsway/openclaw.git
cd openclaw

# Checkout the podman branch
git checkout feature/podman-homelab-deployment
```

### Step 1.2: Configure Environment Variables

```bash
# Review the example env file
cat .env.podman.example

# Create your .env file
cp .env.podman.example .env

# Edit with your values
vi .env
```

**Key variables to set:**

```bash
# Use the homelab image (includes Nomad, Consul, Terraform, op CLIs)
OPENCLAW_IMAGE=openclaw-homelab:local
OPENCLAW_GATEWAY_TOKEN=<generate-with-openssl-rand-hex-32>
OPENCLAW_GATEWAY_BIND=loopback  # Start with loopback for testing
OPENCLAW_CONFIG_DIR=/home/youruser/.openclaw
OPENCLAW_WORKSPACE_DIR=/home/youruser/.openclaw/workspace

# Homelab infrastructure (add these for Jerry's ops capabilities)
NOMAD_ADDR=http://nomad.service.consul:4646
CONSUL_HTTP_ADDR=http://127.0.0.1:8500
OP_SERVICE_ACCOUNT_TOKEN=<1password-service-account-token>
```

### Step 1.3: Build and Deploy

```bash
# Build the homelab image (with Nomad, Consul, Terraform, op CLIs)
podman build -t openclaw-homelab:local -f homelab/Dockerfile .

# Run the podman setup script (uses OPENCLAW_IMAGE from .env)
./podman-setup.sh

# This will:
# - Use the already-built homelab image
# - Set up persistent directories
# - Run onboarding (interactive)
# - Start the gateway container
```

### Step 1.4: Verify Deployment

```bash
# Check container status
podman-compose ps

# View logs
podman-compose logs -f openclaw-gateway

# Test health endpoint
curl http://127.0.0.1:18789/health

# Check from CLI (inside container)
podman-compose exec openclaw-gateway node dist/index.js health --token "$OPENCLAW_GATEWAY_TOKEN"
```

### Step 1.5: Test from MacBook (SSH Tunnel)

```bash
# On MacBook, create SSH tunnel
ssh -N -L 18789:127.0.0.1:18789 user@homelab-node

# In another terminal or browser, test access
curl http://127.0.0.1:18789/health

# Open browser to Control UI
open http://127.0.0.1:18789
# Paste your gateway token when prompted
```

**Phase 1 Success Criteria:**
- ✅ Container running and healthy
- ✅ Gateway accessible via SSH tunnel from MacBook
- ✅ Can access Control UI and authenticate
- ✅ Config persists across container restarts

---

## Phase 2: Octant Infrastructure Integration

**Goal:** Integrate with existing Octant services (Tailscale, 1Password)

**Duration:** 2-4 hours

**Prerequisites:**
- Phase 1 completed successfully
- Familiarity with your Octant setup
- Access to 1Password vault

### Step 2.1: Tailscale Integration

**Option A: Use existing Tailscale setup**

Your homelab nodes are already on Tailscale. Update the gateway bind setting:

```bash
# Edit .env
OPENCLAW_GATEWAY_BIND=lan  # or specify Tailscale IP

# Restart gateway
podman-compose restart openclaw-gateway
```

**Option B: Use Tailscale Serve for HTTPS**

```bash
# On homelab node
tailscale serve https / http://127.0.0.1:18789

# Access from MacBook (no SSH tunnel needed!)
open https://homelab-node.your-tailnet.ts.net
```

**Option C: Route through Traefik** (Octant's existing ingress)

See Section "Traefik Integration" below for Consul service discovery setup.

### Step 2.2: 1Password Integration

Store your OpenClaw secrets in 1Password and reference them in the deployment.

**Create 1Password Items:**
```bash
# Using op CLI (if installed in Octant)
op item create --category=password \
  --title="OpenClaw Gateway Token" \
  --vault="Homelab" \
  token[password]=$(openssl rand -hex 32)

# For Claude API key
op item create --category=password \
  --title="Claude API Key" \
  --vault="Homelab" \
  key[password]="your-claude-key"
```

**Reference in podman-compose or env:**
```bash
# Option 1: Use op CLI to inject at runtime
export OPENCLAW_GATEWAY_TOKEN=$(op read "op://Homelab/OpenClaw Gateway Token/token")
export CLAUDE_AI_SESSION_KEY=$(op read "op://Homelab/Claude API Key/key")

# Option 2: Use Nomad's 1Password integration (Phase 3)
```

### Step 2.3: Consul Service Discovery (Optional)

If you want OpenClaw to register with Consul (useful for Traefik routing):

```bash
# Create Consul service definition
cat > /etc/consul.d/openclaw.json <<EOF
{
  "service": {
    "name": "openclaw",
    "port": 18789,
    "tags": ["openclaw", "gateway"],
    "check": {
      "http": "http://127.0.0.1:18789/health",
      "interval": "10s",
      "timeout": "2s"
    }
  }
}
EOF

# Reload Consul
consul reload
```

**Phase 2 Success Criteria:**
- ✅ Gateway accessible via Tailscale (no SSH tunnel needed)
- ✅ Secrets stored in 1Password
- ✅ Optional: Consul service registration working
- ✅ Optional: Traefik routing configured

---

## Phase 3: Nomad Orchestration (Full Octant Integration)

**Goal:** Deploy OpenClaw as a Nomad job with full infrastructure-as-code

**Duration:** 4-8 hours

**Prerequisites:**
- Phase 2 completed successfully
- Octant cluster healthy (Consul + Nomad)
- Terraform experience
- Understanding of Nomad job specifications

### Step 3.1: Create Nomad Job Specification

Create `openclaw.nomad.hcl` based on Octant patterns:

```hcl
job "openclaw" {
  datacenters = ["dc1"]
  type = "service"

  group "gateway" {
    count = 1

    network {
      port "http" {
        static = 18789
        to     = 18789
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
        image = "openclaw:local"
        ports = ["http", "canvas"]

        args = [
          "node",
          "dist/index.js",
          "gateway",
          "--bind", "lan",
          "--port", "18789"
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
      }

      # 1Password secrets injection
      template {
        data = <<EOT
{{with secret "kv/data/openclaw"}}
OPENCLAW_GATEWAY_TOKEN={{.Data.data.gateway_token}}
CLAUDE_AI_SESSION_KEY={{.Data.data.claude_api_key}}
{{end}}
EOT
        destination = "secrets/file.env"
        env         = true
      }

      service {
        name = "openclaw"
        port = "http"
        tags = [
          "traefik.enable=true",
          "traefik.http.routers.openclaw.rule=Host(`openclaw.yourdomain.com`)",
          "traefik.http.routers.openclaw.tls=true"
        ]

        check {
          type     = "http"
          path     = "/health"
          interval = "10s"
          timeout  = "2s"
        }
      }

      resources {
        cpu    = 500  # MHz
        memory = 1024  # MB
      }
    }
  }
}
```

### Step 3.2: Configure Host Volumes

On your Nomad client nodes, configure host volumes:

```bash
# Edit Nomad client configuration
sudo vi /etc/nomad.d/client.hcl
```

Add:
```hcl
client {
  host_volume "openclaw-config" {
    path      = "/opt/openclaw/config"
    read_only = false
  }

  host_volume "openclaw-workspace" {
    path      = "/opt/openclaw/workspace"
    read_only = false
  }
}
```

```bash
# Create directories
sudo mkdir -p /opt/openclaw/{config,workspace}
sudo chown -R 1000:1000 /opt/openclaw

# Restart Nomad client
sudo systemctl restart nomad
```

### Step 3.3: Create Terraform Module

Following Octant patterns, create a Terraform module:

```bash
mkdir -p terraform/openclaw
cd terraform/openclaw
```

Create `main.tf`:
```hcl
resource "nomad_job" "openclaw" {
  jobspec = file("${path.module}/openclaw.nomad.hcl")

  hcl2 {
    enabled = true
  }
}
```

Create `variables.tf`, `outputs.tf`, `versions.tf` (following other Octant modules).

### Step 3.4: Deploy via Terraform

```bash
cd terraform/openclaw

# Initialize
terraform init

# Plan
terraform plan

# Apply
terraform apply

# Verify
nomad status openclaw
nomad logs -f openclaw
```

### Step 3.5: Traefik Integration

With Consul service discovery and Traefik tags, OpenClaw will be automatically routed:

```bash
# Access via Traefik
curl https://openclaw.yourdomain.com/health

# Check Consul services
consul catalog services
consul catalog service openclaw
```

**Phase 3 Success Criteria:**
- ✅ OpenClaw deployed as Nomad job
- ✅ Scheduled on cluster node
- ✅ Consul service registration working
- ✅ Traefik routing configured
- ✅ Health checks passing
- ✅ Accessible via HTTPS with Let's Encrypt cert
- ✅ Secrets loaded from 1Password/Vault
- ✅ Fully managed via Terraform

---

## MacBook Agent Setup

**Goal:** Run an OpenClaw agent on your MacBook that works alongside homelab agents

### Option 1: Mac App (Simplest)

```bash
# Download OpenClaw.app
# Install to /Applications
# Launch and run onboarding

# The Mac app runs a local gateway
# Separate from homelab gateway
# Different config, workspace, messaging accounts
```

### Option 2: Connect to Homelab Gateway

```bash
# No local gateway needed
# Use Tailscale to access homelab gateway
open https://homelab-node.your-tailnet.ts.net

# Or SSH tunnel
ssh -N -L 18789:127.0.0.1:18789 user@homelab-node
open http://127.0.0.1:18789
```

### Option 3: Hybrid (Recommended)

Run both:
- **Homelab gateway:** Always-on, handles scheduled tasks, heavy workloads
- **MacBook gateway:** Mobile work, offline capability, local testing

Use different:
- Messaging accounts (different WhatsApp numbers, Telegram bots, etc.)
- Workspaces
- Agent configurations

---

### Phase 4: Multi-Agent Setup (Optional)
```bash
# Use SSH tunnel or Tailscale
# Access Control UI in browser
# All agent work happens on homelab
```

---

### Phase 4: Multi-Agent Setup (Optional)
```bash
# Edit ~/.openclaw/openclaw.json
# Add agents.list configuration
# Set up bindings for message routing
# Restart gateway
openclaw gateway restart
```

---

## Testing & Validation

### Quick Test (Dev Profile)
```bash
# Test without affecting main setup
openclaw --dev setup
openclaw --dev gateway --allow-unconfigured
openclaw --dev health
openclaw --dev status

# Clean up
rm -rf ~/.openclaw-dev
```

### Health Checks
```bash
# CLI health check
openclaw health

# Gateway status
openclaw gateway status

# WebSocket health (via gateway)
openclaw gateway health --json

# Check service status
systemctl --user status openclaw-gateway  # systemd
podman-compose ps  # podman

# View logs
openclaw logs --follow  # CLI method
journalctl --user -u openclaw-gateway -f  # systemd
podman-compose logs -f openclaw-gateway  # podman
```

---

## Persistence Model

### What Persists Where

| Component | Location | Persistence Mechanism | Notes |
|-----------|----------|----------------------|-------|
| Gateway config | `~/.openclaw/openclaw.json` | Host filesystem or volume mount | Main configuration file |
| Model auth profiles | `~/.openclaw/` | Host filesystem or volume mount | OAuth tokens, API keys |
| Skill configs | `~/.openclaw/skills/` | Host filesystem or volume mount | Skill-level state |
| Agent workspaces | `~/.openclaw/workspace/` | Host filesystem or volume mount | Code and artifacts |
| WhatsApp session | `~/.openclaw/sessions/` | Host filesystem or volume mount | Preserves QR login |
| Gmail keyring | `~/.openclaw/` | Host filesystem + password | Requires `GOG_KEYRING_PASSWORD` |
| External binaries | `/usr/local/bin/` (native) or `/usr/local/bin/` (container) | System PATH or Docker image | Must be in PATH |
| Node runtime | System (native) or Container image | Package manager or Docker | Rebuilt on updates |

### Container-Specific Persistence

**Critical:** If using Podman/Docker:
- External binaries MUST be in the Dockerfile
- Runtime installations are LOST on restart
- Volume mounts preserve config/workspace only
- See Hetzner guide for detailed examples

---

## Troubleshooting Guide

### Gateway Won't Start

#### Native systemd:
```bash
# Check service status
systemctl --user status openclaw-gateway

# View logs
journalctl --user -u openclaw-gateway -n 100

# Check for port conflicts
ss -ltnp | grep 18789

# Test manual start
openclaw gateway --port 18789 --verbose
```

#### Podman:
```bash
# Check container status
podman-compose ps

# View logs
podman-compose logs openclaw-gateway

# Check for port conflicts
ss -ltnp | grep 18789

# Test manual start
podman-compose up openclaw-gateway
```

---

### Permission Issues (Podman)

```bash
# Rootless Podman subuid mapping
# Run fix-podman-permissions.sh first

# Check volume permissions
ls -la ~/.openclaw
ls -la ~/.openclaw/workspace

# Container user is uid 1000 (node)
# Host directory must be readable by container user

# Fix permissions:
podman unshare chown -R 1000:1000 ~/.openclaw
podman unshare chown -R 1000:1000 ~/.openclaw/workspace
```

---

### Remote Access Issues

```bash
# Test local access first
curl http://127.0.0.1:18789/health

# Check gateway bind setting
openclaw config get gateway.bind
# Should be "loopback" for SSH tunnel or "lan" for direct access

# Test SSH tunnel
ssh -N -L 18789:127.0.0.1:18789 user@homelab-server
# In another terminal:
curl http://127.0.0.1:18789/health

# Check firewall
sudo ufw status
sudo iptables -L -n | grep 18789

# Tailscale status
tailscale status
```

---

### Binary Not Found (Container)

```bash
# Check if binary exists in container
podman-compose exec openclaw-gateway which gog

# If not found, binary was not baked into image
# Add to Dockerfile and rebuild:
podman build -t openclaw:local -f Dockerfile .
podman-compose up -d --force-recreate openclaw-gateway

# Verify again
podman-compose exec openclaw-gateway which gog
```

---

## Resource Requirements

### Minimum
- 1GB RAM
- 1 CPU core
- 2GB disk space
- Stable internet connection

### Recommended
- 2GB+ RAM
- 2+ CPU cores
- 10GB disk space (for workspaces, logs, sandboxes)
- Stable internet connection

### Raspberry Pi
- Pi 4/5 with 2GB+ RAM supported
- Add 2GB swap for stability
- See: https://docs.openclaw.ai/platforms/raspberry-pi

---

## References

### Official Documentation
- Linux Platform Guide: https://docs.openclaw.ai/platforms/linux
- Docker Installation: https://docs.openclaw.ai/install/docker
- Gateway Runbook: https://docs.openclaw.ai/gateway
- Configuration Reference: https://docs.openclaw.ai/gateway/configuration
- Multi-Agent Guide: https://docs.openclaw.ai/concepts/multi-agent
- Sandboxing Guide: https://docs.openclaw.ai/gateway/sandboxing
- Remote Access: https://docs.openclaw.ai/gateway/remote

### Production Deployment Guides
- Hetzner (Docker VPS): https://docs.openclaw.ai/platforms/hetzner
- DigitalOcean: https://docs.openclaw.ai/platforms/digitalocean
- Raspberry Pi: https://docs.openclaw.ai/platforms/raspberry-pi
- exe.dev: https://docs.openclaw.ai/platforms/exe-dev
- Fly.io: https://docs.openclaw.ai/platforms/fly

### Security & Hardening
- Ansible Deployment: https://docs.openclaw.ai/install/ansible
- openclaw-ansible repo: https://github.com/openclaw/openclaw-ansible

### External Resources
- Docker - OpenClaw: https://docs.openclaw.ai/install/docker
- Deploy OpenClaw on AWS or Hetzner: https://www.pulumi.com/blog/deploy-openclaw-aws-hetzner/
- OpenClaw Complete Guide 2026: https://www.nxcode.io/resources/news/openclaw-complete-guide-2026

---

## Decision Matrix (Octant Context)

| Requirement | Podman Container | Native systemd | Nomad Orchestrated |
|-------------|------------------|----------------|-------------------|
| Official support | ⚠️ Unofficial | ✅ Yes | ⚠️ Unofficial |
| Octant alignment | ✅ Perfect | ❌ Doesn't match | ✅ Perfect |
| Ease of setup | ✅ Simple | ✅ Simple | ⚠️ Complex |
| Ease of updates | ⚠️ Rebuild image | ✅ `npm update` | ✅ Terraform apply |
| Isolation | ✅ Container-level | ⚠️ Process-level | ✅ Container-level |
| Performance | ⚠️ Minimal overhead | ✅ Native | ⚠️ Minimal overhead |
| Troubleshooting | ⚠️ Moderate | ✅ Simple | ⚠️ Complex |
| Tailscale ready | ✅ Yes | ✅ Yes | ✅ Yes |
| 1Password ready | ✅ Manual | ✅ Manual | ✅ Automated |
| Path to Nomad | ✅ Direct | ❌ Requires rewrite | ✅ Already there |
| Production-ready | ⚠️ Testing phase | ✅ Yes | ✅ Yes |
| Best for | **Phase 1 testing** | Quick testing | **Phase 3 production** |

**Recommendation for Octant:** Start with Podman Container (Phase 1), then progress to Nomad Orchestrated (Phase 3)

---

## Next Steps Checklist for Octant Integration

### Phase 1: Standalone Testing
- [ ] Clone OpenClaw fork with Podman branch
- [ ] Configure .env file with basic settings
- [ ] Run `./podman-setup.sh` on homelab node
- [ ] Verify container health and logs
- [ ] Test SSH tunnel access from MacBook
- [ ] Validate Control UI access and authentication
- [ ] Test basic agent functionality

### Phase 2: Infrastructure Integration
- [ ] Configure gateway to bind to Tailscale (or use Tailscale Serve)
- [ ] Test Tailscale access from MacBook (no tunnel needed)
- [ ] Create 1Password items for OpenClaw secrets
- [ ] Update deployment to reference 1Password secrets
- [ ] Optional: Configure Consul service registration
- [ ] Optional: Configure Traefik routing
- [ ] Document Tailscale access patterns

### Phase 3: Nomad Deployment (When Ready)
- [ ] Create Nomad job specification
- [ ] Configure host volumes on Nomad clients
- [ ] Create Terraform module following Octant patterns
- [ ] Test Nomad job deployment
- [ ] Verify Consul service registration
- [ ] Configure Traefik routing with Let's Encrypt
- [ ] Integrate 1Password secrets in Nomad template
- [ ] Update Octant documentation with OpenClaw module

### MacBook Setup
- [ ] Decide on MacBook strategy (local app / remote / hybrid)
- [ ] If local app: Download and install OpenClaw.app
- [ ] If remote only: Document Tailscale access method
- [ ] If hybrid: Configure both with separate profiles
- [ ] Test agent functionality from MacBook

### Ongoing
- [ ] Configure backup strategy for `~/.openclaw` volumes
- [ ] Document your specific Octant integration
- [ ] Test failover and recovery procedures
- [ ] Monitor resource usage in Nomad
- [ ] Plan for OpenClaw updates (image rebuilds)

---

## Questions to Consider

1. **Which phase to start with?**
   - Phase 1 for testing (standalone Podman)
   - Skip to Phase 2 if confident (Tailscale integration)
   - Wait for Phase 3 if you want full Nomad orchestration

2. **MacBook strategy:**
   - Local Mac app only (simplest, offline-capable)
   - Remote gateway only (leverage homelab power)
   - Hybrid (best of both worlds)

3. **Multi-agent needs:**
   - Single agent for personal use
   - Multiple agents for family/work separation
   - Separate agents per messaging account

4. **Nomad deployment timing:**
   - Deploy to Nomad immediately (if comfortable with Nomad)
   - Wait until Phase 1 testing is successful
   - Add to Octant Terraform modules alongside other services

5. **Integration priorities:**
   - Start with Tailscale (already in place)
   - Add 1Password integration (Phase 2)
   - Full Nomad orchestration (Phase 3)
   - Traefik routing (optional, Phase 3)

6. **Backup strategy:**
   - How will you back up `~/.openclaw` volumes?
   - Include in existing Octant backup procedures?
   - Use Restic (already in Octant) for OpenClaw data?

---

## Conclusion

**Recommended path for Octant homelab:**

### Immediate (Phase 1)
1. **Deploy with Podman standalone** on homelab node
2. Test basic functionality with **SSH tunnel** from MacBook
3. Validate agent behavior and resource usage
4. Identify any skill binaries that need to be baked into image

### Short-term (Phase 2)
5. **Switch to Tailscale access** (already deployed in Octant)
6. **Move secrets to 1Password** (already integrated in Octant)
7. Optional: Register with **Consul** for service discovery
8. Optional: Route through **Traefik** for HTTPS

### Long-term (Phase 3)
9. **Create Nomad job specification** following Octant patterns
10. **Wrap in Terraform module** alongside other Octant services
11. Deploy via **Terraform apply** like other services
12. Monitor and iterate with Nomad's scheduling and health checks

### MacBook Setup
13. Choose your strategy: **Hybrid approach recommended**
    - Homelab gateway for always-on, heavy workloads
    - MacBook app for mobile/offline work
14. Use separate messaging accounts for each gateway
15. Leverage Tailscale for seamless access to homelab gateway

---

## Why This Approach?

**Aligns with Octant philosophy:**
- ✅ Infrastructure as code (Terraform)
- ✅ Rootless Podman containers
- ✅ Nomad orchestration
- ✅ Consul service discovery
- ✅ Tailscale connectivity
- ✅ 1Password secrets management
- ✅ Traefik ingress routing

**Progressive complexity:**
- Start simple, validate the concept
- Add integration one layer at a time
- Reach full orchestration when confident
- Maintain consistency with other Octant services

**Production-ready path:**
- Test thoroughly in standalone mode
- Integrate with existing, proven infrastructure
- Deploy to battle-tested Nomad platform
- Monitor and scale as needed

---

**Document Version:** 2.0 (Octant-specific)
**Last Updated:** 2026-01-31
**Homelab Framework:** [Octant](https://github.com/shamsway/octant)
**OpenClaw Fork:** [shamsway/openclaw](https://github.com/shamsway/openclaw)
**Target Branch:** `feature/podman-homelab-deployment`
