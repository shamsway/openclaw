# OpenClaw Podman Setup

This document explains the current Podman setup approach for OpenClaw.

## Overview

OpenClaw uses **Podman rootless mode** with automatic user namespace mapping. The `docker-compose.podman.yml` file includes `userns_mode: keep-id` settings that handle permission mapping automatically.

## How It Works

### The Permission Challenge

- **Container user**: `node` (UID 1000)
- **Your host user**: Variable UID (e.g., 2000 for `hashi` user)
- **Problem**: Without mapping, container UID 1000 can't write to host directories owned by UID 2000

### The Solution: userns_mode

The `docker-compose.podman.yml` file includes:

```yaml
services:
  openclaw-gateway:
    userns_mode: "keep-id:uid=1000,gid=1000"
```

This tells Podman to:
1. Map your host user to the container's `node` user (UID 1000)
2. Allow the container to read/write to your host directories
3. Handle this automatically - no manual permission fixes needed

## Setup Methods

### Method 1: Pre-Generated Config (Recommended for Homelab)

Use this when you have a template config file and want to skip interactive onboarding.

**Prerequisites:**
- Customized `homelab-base-config.json` with your API keys and settings

**Steps:**

```bash
# 1. Create directories
mkdir -p ~/.openclaw/workspace

# 2. Deploy your config
cp homelab-base-config.json ~/.openclaw/openclaw.json

# 3. Build image
podman build -t openclaw:local -f Dockerfile .

# 4. Set environment variables
export OPENCLAW_CONFIG_DIR="$HOME/.openclaw"
export OPENCLAW_WORKSPACE_DIR="$HOME/.openclaw/workspace"
export OPENCLAW_GATEWAY_PORT=18789
export OPENCLAW_GATEWAY_BIND="lan"

# 5. Start gateway (userns_mode handles permissions automatically)
podman compose \
  -f docker-compose.yml \
  -f docker-compose.podman.yml \
  up -d openclaw-gateway
```

**Verify:**
```bash
# Check container status
podman compose -f docker-compose.yml -f docker-compose.podman.yml ps

# View logs
podman compose -f docker-compose.yml -f docker-compose.podman.yml logs -f openclaw-gateway

# Test health endpoint
curl http://localhost:18789/health
```

### Method 2: Interactive Onboarding (Traditional)

Use this for first-time setup or when you want the wizard to guide you.

**Steps:**

```bash
# Run the setup script
./podman-setup.sh

# Follow the interactive prompts:
# - Gateway bind: lan
# - Gateway auth: token
# - Gateway token: (script generates one)
# - Tailscale: Off
# - Install daemon: No
```

The script will:
1. Build the container image
2. Run interactive onboarding (creates `~/.openclaw/openclaw.json`)
3. Start the gateway

## File Locations

| What | Container Path | Host Path |
|------|----------------|-----------|
| Config | `/home/node/.openclaw` | `$HOME/.openclaw` |
| Workspace | `/home/node/.openclaw/workspace` | `$HOME/.openclaw/workspace` |
| Sessions | `/home/node/.openclaw/sessions` | `$HOME/.openclaw/sessions` |
| Logs | `/home/node/.openclaw/logs` | `$HOME/.openclaw/logs` |

The container only sees the container paths. When configuring OpenClaw, always use container paths (starting with `/home/node/`).

## Common Operations

### View Logs
```bash
podman compose -f docker-compose.yml -f docker-compose.podman.yml logs -f openclaw-gateway
```

### Restart Gateway
```bash
podman compose -f docker-compose.yml -f docker-compose.podman.yml restart openclaw-gateway
```

### Stop Gateway
```bash
podman compose -f docker-compose.yml -f docker-compose.podman.yml down
```

### Run CLI Commands
```bash
# Example: Check health
podman compose -f docker-compose.yml -f docker-compose.podman.yml run --rm openclaw-cli health

# Example: Check channel status
podman compose -f docker-compose.yml -f docker-compose.podman.yml run --rm openclaw-cli channels status
```

### Access Config Files from Host

Files are owned by subuids due to Podman's user namespace mapping. To read them:

**Option 1: Via container**
```bash
podman compose -f docker-compose.yml -f docker-compose.podman.yml run --rm openclaw-cli cat /home/node/.openclaw/openclaw.json
```

**Option 2: Via podman unshare**
```bash
podman unshare cat ~/.openclaw/openclaw.json
```

## Updating OpenClaw

```bash
# Pull latest code
git pull origin main

# Rebuild image
podman build -t openclaw:local -f Dockerfile .

# Recreate container with new image
podman compose -f docker-compose.yml -f docker-compose.podman.yml up -d --force-recreate openclaw-gateway
```

Your config and data persist in `~/.openclaw/` and won't be affected.

## Troubleshooting

### Permission Denied Errors

The `userns_mode: keep-id` setting should handle this automatically. If you still see permission errors:

1. **Verify compose files are loaded:**
   ```bash
   # Make sure you're using BOTH compose files
   podman compose -f docker-compose.yml -f docker-compose.podman.yml config
   # Should show userns_mode in the output
   ```

2. **Check directory ownership:**
   ```bash
   ls -la ~/.openclaw
   # Files may show high UIDs (e.g., 165536) - this is normal for Podman rootless
   ```

3. **Recreate containers:**
   ```bash
   podman compose -f docker-compose.yml -f docker-compose.podman.yml down
   podman compose -f docker-compose.yml -f docker-compose.podman.yml up -d
   ```

### Gateway Won't Start

```bash
# Check container logs
podman compose -f docker-compose.yml -f docker-compose.podman.yml logs openclaw-gateway

# Common issues:
# - Port conflict: Change OPENCLAW_GATEWAY_PORT
# - Missing API key: Check ~/.openclaw/openclaw.json
# - Config syntax error: Validate JSON
```

### Can't Access from Network

```bash
# Verify gateway is listening
ss -ltnp | grep 18789

# Check firewall
sudo ufw status
sudo ufw allow 18789/tcp

# Verify bind setting in config
grep -A2 '"gateway"' ~/.openclaw/openclaw.json
# Should show "bind": "lan" for network access
```

## Comparison with Docker

| Feature | Docker | Podman |
|---------|--------|--------|
| Root required | Yes (daemon) | No (rootless) |
| Permission handling | Automatic | userns_mode needed |
| Compose command | `docker compose` | `podman compose` |
| Official support | ✅ Yes | ⚠️ Unofficial |

Podman is more secure (rootless) but requires the `userns_mode` configuration for proper bind mount permissions.

## Legacy Documentation

The following files document earlier permission fix approaches:
- `PODMAN_SETUP_INSTRUCTIONS.md` - Uses `podman unshare` manually
- `PODMAN_PERMISSIONS_FIX.md` - Documents the `userns_mode` solution

**Current approach:** The `userns_mode` setting in `docker-compose.podman.yml` handles everything automatically. No manual permission fixes needed.

## References

- Podman rootless: https://github.com/containers/podman/blob/main/docs/tutorials/rootless_tutorial.md
- userns_mode docs: https://docs.docker.com/compose/compose-file/compose-file-v3/#userns_mode
- OpenClaw Docker docs: https://docs.openclaw.ai/install/docker
- Main deployment plan: `HOMELAB_DEPLOYMENT_PLAN.md`
