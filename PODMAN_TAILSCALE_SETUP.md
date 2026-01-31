# Moltbot Initial Setup Guide (Podman + Tailscale)

This guide covers the initial setup flow for deploying Moltbot in a home lab environment using Podman and Tailscale.

## Initial Setup Flow (Fresh Deployment)

### 1. **Installation**

```bash
# Standard installation (recommended)
curl -fsSL https://openclaw.ai/install.sh | bash

# Or for your Podman setup
./podman-setup.sh
```

**Requirements:**
- Node.js 22+
- For Podman: version 4.0+ with podman-compose

### 2. **Onboarding Wizard**

```bash
openclaw onboard --install-daemon
```

The wizard walks you through:
- **Gateway selection:** Local (runs on this machine) vs Remote (connect to existing gateway)
- **Model authentication:**
  - Anthropic OAuth (preferred, browser-based)
  - Or API key (manual via `~/.openclaw/agents/<agentId>/agent/auth-profiles.json`)
- **Gateway binding:**
  - `loopback` (127.0.0.1 only)
  - `lan` (all interfaces)
  - `tailnet` (Tailscale IP only)
  - `auto` (auto-detects Tailscale)
- **Gateway auth:** Token (auto-generated) or password
- **Channel setup:** WhatsApp, Telegram, Discord, Mattermost
- **DM pairing policy:** Allowlist (approve first contact) or open
- **Workspace bootstrap:** Creates `~/.openclaw/workspace/` with agent instructions
- **Service installation:** systemd (Linux) or launchd (macOS)

### 3. **Tailscale Integration**

Since you're already running Tailscale, you have two excellent options:

#### **Option A: Tailscale Serve (Tailnet-only, HTTPS)**

```bash
openclaw gateway --tailscale serve --port 18789
```

- Exposes gateway only to your tailnet devices
- Automatic HTTPS via Tailscale
- No public internet exposure
- Auth via Tailscale identity headers (optional)

**Config example:**
```json5
{
  "gateway": {
    "bind": "tailnet",
    "port": 18789,
    "tailscale": {
      "mode": "serve"  // tailnet-only
    }
  }
}
```

#### **Option B: Direct Tailnet Bind**

```bash
openclaw gateway --bind tailnet --port 18789
```

- Binds to your Tailscale IP (e.g., 100.x.y.z)
- HTTP only (HTTPS via reverse proxy if needed)
- Access from any tailnet device

### 4. **Configuration Location**

All config lives in `~/.openclaw/`:

```
~/.openclaw/
├── openclaw.json          # Main config (JSON5)
├── credentials/          # Provider credentials (WhatsApp, Telegram, etc.)
├── devices/              # Approved node devices (iOS, Android)
├── agents/<agentId>/
│   ├── sessions/         # Agent session logs
│   └── agent/            # Auth profiles, workspace config
└── ...
```

**Workspace** (where Claude reads/writes): `~/.openclaw/workspace/` by default

### 5. **Channel Setup**

After onboarding, add messaging channels:

```bash
# WhatsApp (QR code scan)
openclaw channels login

# Telegram (bot token from @BotFather)
openclaw providers add --provider telegram --token <YOUR_BOT_TOKEN>

# Discord (bot token from Discord Developer Portal)
openclaw providers add --provider discord --token <YOUR_BOT_TOKEN>
```

### 6. **DM Pairing (Security)**

First-time contacts need approval:

```bash
# List pending pairing requests
openclaw pairing list whatsapp

# Approve a contact
openclaw pairing approve whatsapp <8-CHAR-CODE>
```

### 7. **Verification**

```bash
# Check gateway status
openclaw status

# Health check
openclaw health

# Security audit
openclaw security audit --deep
```

### 8. **Service Management**

```bash
# For Podman (via compose)
podman-compose logs -f openclaw-gateway
podman-compose restart openclaw-gateway

# For native install with systemd
systemctl --user status openclaw-gateway
systemctl --user restart openclaw-gateway
journalctl --user -u openclaw-gateway -f
```

## Recommended Setup for Home Lab

Given your Podman + Tailscale environment:

1. **Use the Podman setup** (`./podman-setup.sh`)
2. **Configure Tailscale Serve** in your `.env`:
   ```bash
   OPENCLAW_GATEWAY_BIND=tailnet
   ```
3. **Enable token auth** (auto-generated during setup)
4. **Set up one channel** (WhatsApp is easiest with QR code)
5. **Access from any tailnet device** using the host's Tailscale IP

## Key Configuration Tips

**Minimal working config** (`~/.openclaw/openclaw.json`):

```json5
{
  "gateway": {
    "bind": "tailnet",
    "port": 18789,
    "auth": {
      "mode": "token"
    }
  }
}
```

**Important notes:**
- **Config validation:** Strict schema - unknown keys cause startup failure
- **Hot reload:** Gateway watches config changes
- **Credential storage:** Separate from config (in `credentials/`)

## Environment Variables (.env)

Create `.env` file with these values:

```bash
# Directory for openclaw configuration and credentials
OPENCLAW_CONFIG_DIR=/home/youruser/.openclaw

# Directory for workspace files (where Claude can read/write)
OPENCLAW_WORKSPACE_DIR=/home/youruser/.openclaw/workspace

# Gateway port (exposed to network)
OPENCLAW_GATEWAY_PORT=18789

# Bridge port (internal)
OPENCLAW_BRIDGE_PORT=18790

# Gateway bind address: 'tailnet' recommended for Tailscale setup
OPENCLAW_GATEWAY_BIND=tailnet

# Gateway authentication token (auto-generated if blank)
OPENCLAW_GATEWAY_TOKEN=

# Container image name
OPENCLAW_IMAGE=openclaw:local

# Claude AI credentials (required for Claude integration)
# Get these from https://claude.ai after logging in
# Check browser dev tools > Application > Cookies
CLAUDE_AI_SESSION_KEY=
CLAUDE_WEB_SESSION_KEY=
CLAUDE_WEB_COOKIE=
```

## Next Steps After Setup

1. Test by sending a message to your bot on WhatsApp/Telegram
2. Approve the pairing request if needed
3. Send a test command: "Can you help me?"
4. Verify Claude responds
5. Optional: Add iOS/Android nodes for mobile access
6. Optional: Set up remote access via SSH tunnel to control from outside tailnet

## Additional Resources

Official documentation at https://docs.openclaw.ai:

- [Getting Started Guide](https://docs.openclaw.ai/start/getting-started)
- [Tailscale Integration](https://docs.openclaw.ai/gateway/tailscale)
- [Docker Setup](https://docs.openclaw.ai/install/docker) (similar to Podman setup)
- [Gateway Configuration](https://docs.openclaw.ai/gateway/configuration)
- [Security & Authentication](https://docs.openclaw.ai/gateway/security)
- [Pairing Guide](https://docs.openclaw.ai/start/pairing)

## Troubleshooting

If you encounter issues:

```bash
# Run the doctor command to check for common issues
openclaw doctor

# Check gateway logs
podman-compose logs -f openclaw-gateway

# Verify Tailscale connectivity
tailscale status
tailscale ip

# Test gateway health
openclaw health --token "$OPENCLAW_GATEWAY_TOKEN"
```

## File Locations Reference

- **Setup script:** `./podman-setup.sh`
- **Environment config:** `.env` (copy from `.env.podman.example`)
- **Docker compose:** `docker-compose.yml`
- **Main config:** `~/.openclaw/openclaw.json`
- **Credentials:** `~/.openclaw/credentials/`
- **Workspace:** `~/.openclaw/workspace/` (default)
- **Session logs:** `~/.openclaw/agents/<agentId>/sessions/`
