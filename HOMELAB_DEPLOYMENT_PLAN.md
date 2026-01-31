# OpenClaw Homelab Deployment Plan

**Date:** 2026-01-31
**Target Environment:** Linux homelab with Podman + MacBook integration

## Executive Summary

This document outlines deployment strategies for running OpenClaw Gateway in a Linux homelab environment, with considerations for Podman containerization, security hardening, and MacBook integration.

---

## Current State Assessment

### Existing Setup
- ✅ `podman-setup.sh` script created (mirrors Docker setup)
- ✅ Podman compose configuration in place
- ✅ Basic container build and volume mounting configured
- ⚠️ Podman is **not officially supported** (Docker is official)

### What's Working
- Image building with Podman
- Persistent volumes for config (`~/.openclaw`) and workspace (`~/.openclaw/workspace`)
- Onboarding flow
- Gateway startup via podman-compose

---

## Architecture Options

### Option A: Native systemd Installation (Recommended)

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
- ❌ Direct system installation

**Best for:** Single dedicated homelab server, production use

**Installation:**
```bash
# Install Node.js 22+
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install OpenClaw globally
sudo npm i -g openclaw@latest

# Run onboarding (interactive)
openclaw onboard --install-daemon

# This creates ~/.config/systemd/user/openclaw-gateway.service
# and enables systemd user service with lingering

# Verify installation
systemctl --user status openclaw-gateway
openclaw health
openclaw status
```

**Service Management:**
```bash
# Status
systemctl --user status openclaw-gateway
openclaw gateway status

# Logs
journalctl --user -u openclaw-gateway -f
openclaw logs --follow

# Control
systemctl --user stop openclaw-gateway
systemctl --user start openclaw-gateway
systemctl --user restart openclaw-gateway
# OR use CLI shortcuts:
openclaw gateway stop
openclaw gateway start
openclaw gateway restart

# Enable lingering (survive logout)
sudo loginctl enable-linger $USER
```

---

### Option B: Podman Container (Current Approach)

**Overview:**
- Gateway runs inside Podman container
- Persistence via volume mounts
- Isolated environment, easy to destroy/rebuild

**Pros:**
- ✅ Complete isolation
- ✅ Easy to destroy and rebuild
- ✅ Familiar Docker-compatible workflow
- ✅ Existing `podman-setup.sh` script ready

**Cons:**
- ❌ Not officially supported (Docker only)
- ❌ Additional complexity for troubleshooting
- ❌ Container overhead
- ❌ Must bake external binaries into image

**Best for:** Testing, experimentation, or strong preference for containers

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

### Option C: Ansible Hardened Deployment (Production-Grade)

**Overview:**
- Automated deployment with 4-layer security architecture
- Native installation (not containerized gateway)
- Firewall + VPN + Docker isolation + systemd hardening

**Security Layers:**
1. **Firewall (UFW)**: Only SSH (22) + Tailscale (41641/udp) exposed publicly
2. **VPN (Tailscale)**: Gateway accessible only via VPN mesh
3. **Docker Isolation**: DOCKER-USER iptables chain prevents external port exposure
4. **Systemd Hardening**: NoNewPrivileges, PrivateTmp, unprivileged user

**What Gets Installed:**
- Tailscale (mesh VPN)
- UFW firewall
- Docker CE + Compose V2 (for agent sandboxes)
- Node.js 22 + pnpm
- OpenClaw (host-based, not containerized)
- Systemd service with security hardening

**Installation:**
```bash
# One-command install
curl -fsSL https://raw.githubusercontent.com/openclaw/openclaw-ansible/main/install.sh | bash

# Manual install
sudo apt update && sudo apt install -y ansible git
git clone https://github.com/openclaw/openclaw-ansible.git
cd openclaw-ansible
ansible-galaxy collection install -r requirements.yml
./run-playbook.sh
```

**Best for:** Production homelab with security focus, multi-user environments

**Verification:**
```bash
# Check service status
sudo systemctl status openclaw

# View logs
sudo journalctl -u openclaw -f

# Test external attack surface (should only show port 22)
nmap -p- YOUR_SERVER_IP
```

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
  "agents": {
    "defaults": {
      "sandbox": {
        "mode": "non-main",
        "scope": "agent"
      }
    },
    "list": [
      {
        "id": "personal",
        "displayName": "Personal Agent",
        "workspace": "~/.openclaw/workspace-personal",
        "sandbox": {
          "mode": "off"  // Full access
        }
      },
      {
        "id": "family",
        "displayName": "Family Agent",
        "workspace": "~/.openclaw/workspace-family",
        "sandbox": {
          "mode": "all",  // Always sandboxed
          "workspaceAccess": "ro"  // Read-only
        }
      }
    ]
  },
  "bindings": [
    {
      "channel": "whatsapp",
      "peer": { "kind": "contact", "id": "1234567890@s.whatsapp.net" },
      "agent": "personal"
    },
    {
      "channel": "telegram",
      "peer": { "kind": "user" },
      "agent": "family"
    }
  ]
}
```

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

### Enhanced Security (Tailscale VPN)
```bash
# Install Tailscale on homelab + MacBook
curl -fsSL https://tailscale.com/install.sh | sh
tailscale up

# Gateway can bind to loopback or Tailscale IP
openclaw gateway --bind loopback --port 18789

# Optional: Tailscale Serve for HTTPS
tailscale serve https / http://127.0.0.1:18789

# Access from MacBook via Tailscale hostname
# https://homelab-server.tailnet-name.ts.net
```

**Pros:**
- ✅ Best user experience
- ✅ Always-on connectivity
- ✅ No manual tunnel management
- ✅ Auto HTTPS with Tailscale Serve
- ✅ Access from any device on tailnet

**Cons:**
- ❌ Requires Tailscale account
- ❌ Additional dependency

---

### Maximum Security (Ansible Hardened)
```bash
# Use openclaw-ansible playbook
curl -fsSL https://raw.githubusercontent.com/openclaw/openclaw-ansible/main/install.sh | bash
```

**Security Architecture:**
1. Firewall: Only SSH + Tailscale ports exposed
2. VPN: Gateway accessible only via Tailscale
3. Docker isolation: DOCKER-USER iptables chain
4. Systemd hardening: NoNewPrivileges, PrivateTmp, unprivileged user

**Pros:**
- ✅ Production-grade security
- ✅ Defense in depth (4 layers)
- ✅ Automated setup
- ✅ Battle-tested configuration

**Cons:**
- ❌ More complex setup
- ❌ Requires Tailscale
- ❌ May be overkill for home use

---

## Recommended Implementation Path

### Phase 1: Initial Setup (Choose One)

#### Path A: Native systemd (Recommended)
```bash
# On homelab server
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm i -g openclaw@latest
openclaw onboard --install-daemon

# Verify
systemctl --user status openclaw-gateway
openclaw health
```

#### Path B: Podman Container
```bash
# On homelab server
# 1. Update Dockerfile to include required binaries
# 2. Run setup
./podman-setup.sh

# Verify
podman-compose ps
podman-compose logs openclaw-gateway
podman-compose exec openclaw-gateway which gog
```

---

### Phase 2: Remote Access Setup

#### Option 1: SSH Tunnel (Simplest)
```bash
# From MacBook
ssh -N -L 18789:127.0.0.1:18789 user@homelab-server
# Open http://127.0.0.1:18789 in browser
```

#### Option 2: Tailscale (Best UX)
```bash
# Install on both homelab and MacBook
curl -fsSL https://tailscale.com/install.sh | sh
tailscale up

# On homelab (optional, for HTTPS):
tailscale serve https / http://127.0.0.1:18789

# Access from MacBook:
# https://homelab-server.tailnet-name.ts.net
```

---

### Phase 3: MacBook Integration

#### Local Mac App (Optional)
```bash
# Download OpenClaw.app
# Runs independent local gateway
# Access via menubar app
```

#### Connect to Remote Gateway
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

## Decision Matrix

| Requirement | Native systemd | Podman Container | Ansible Hardened |
|-------------|----------------|------------------|------------------|
| Official support | ✅ Yes | ⚠️ Unofficial | ✅ Yes |
| Ease of setup | ✅ Simple | ⚠️ Moderate | ⚠️ Complex |
| Ease of updates | ✅ `npm update` | ⚠️ Rebuild image | ✅ `npm update` |
| Isolation | ⚠️ Process-level | ✅ Container-level | ⚠️ Process-level |
| Performance | ✅ Native | ⚠️ Container overhead | ✅ Native |
| Troubleshooting | ✅ Simple | ⚠️ Complex | ✅ Simple |
| Security | ⚠️ Basic | ✅ Good | ✅ Excellent |
| Production-ready | ✅ Yes | ⚠️ Untested | ✅ Yes |
| Best for | General use | Testing/isolation | Production security |

---

## Next Steps Checklist

- [ ] Choose deployment approach (systemd / Podman / Ansible)
- [ ] Choose access method (SSH tunnel / Tailscale / Direct)
- [ ] Set up homelab gateway
- [ ] Test remote access from MacBook
- [ ] Decide on MacBook integration (local app / remote / hybrid)
- [ ] Configure multi-agent routing (if needed)
- [ ] Set up agent sandboxing (optional)
- [ ] Configure backup strategy for `~/.openclaw`
- [ ] Document your specific configuration
- [ ] Test failover and recovery procedures

---

## Questions to Consider

1. **Deployment approach:** Native systemd (recommended) or Podman containers?
2. **Access method:** SSH tunnel (simple) or Tailscale VPN (better UX)?
3. **MacBook usage:** Local gateway, remote only, or both?
4. **Multi-agent needs:** Single agent or multiple isolated agents?
5. **Security level:** Basic (SSH tunnel), Enhanced (Tailscale), or Maximum (Ansible)?
6. **Backup strategy:** How will you back up `~/.openclaw`?

---

## Conclusion

**Recommended starting point for most homelab users:**

1. Use **native systemd installation** on Linux server (Option A)
2. Access via **SSH tunnel** from MacBook (simple, secure)
3. Install **Mac app** for local/offline work (optional)
4. Upgrade to **Tailscale VPN** when ready for better UX
5. Consider **Ansible hardening** for production-grade security

The Podman approach works but adds complexity without official support. Start simple, add complexity only as needed.

---

**Document Version:** 1.0
**Last Updated:** 2026-01-31
**Maintainer:** Homelab deployment planning
