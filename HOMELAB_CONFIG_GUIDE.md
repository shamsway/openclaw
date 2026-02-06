# OpenClaw Homelab Configuration Guide

This guide explains how to use the `homelab-base-config.json` template for deploying OpenClaw in your homelab with Podman.

## ✅ Feasibility Confirmation

**YES, this approach is feasible!** The `openclaw onboard` command ultimately creates `~/.openclaw/openclaw.json`. You can:
- Pre-create this file from a template
- Skip the interactive onboarding
- Deploy consistently across multiple servers
- Version control your configuration (excluding secrets)

## 📋 Prerequisites

Before deploying, ensure you have:
- Podman installed on your homelab server
- Node.js 22+ (for building the image)
- Anthropic API key
- Network access configured (LAN/WireGuard)

## 🔧 Customizing the Base Config

### Required Changes

1. **Gateway Token** (line 9)
   ```bash
   # Generate a secure token
   openssl rand -hex 32
   ```
   Replace `REPLACE_WITH_SECURE_TOKEN` with the output.

2. **Anthropic API Key** (line 15)
   ```json
   "apiKey": "sk-ant-api03-..."
   ```

### Optional Customizations

#### Network Binding

The config uses `"bind": "lan"` for LAN/WireGuard access:
- `"loopback"`: Only localhost (use with SSH tunnel)
- `"lan"`: Binds to all interfaces (requires gateway token)
- Specific IP: `"192.168.1.100"`

#### Port

Default is `18789`. Change if you have conflicts:
```json
"port": 18790
```

#### Sandbox Engine

Configured for Podman:
```json
"sandbox": {
  "engine": "podman"
}
```

If using Docker instead, change to `"engine": "docker"`.

## 🚀 Deployment Steps

### 1. Build the Podman Image

From the OpenClaw repo root on your homelab server:

```bash
# Update Dockerfile if you need custom binaries
# See HOMELAB_DEPLOYMENT_PLAN.md Option B for examples

podman build \
  --build-arg "OPENCLAW_DOCKER_APT_PACKAGES=${OPENCLAW_DOCKER_APT_PACKAGES}" \
  -t openclaw:local \
  -f Dockerfile \
  .
```

### 2. Deploy the Configuration

**Option A: Use Pre-Generated Config (Skip Onboarding)**

```bash
# Create config directory
mkdir -p ~/.openclaw

# Copy your customized config
cp homelab-base-config.json ~/.openclaw/openclaw.json

# Create required directories
mkdir -p ~/.openclaw/workspace
mkdir -p ~/.openclaw/state
mkdir -p ~/.openclaw/sessions
mkdir -p ~/.openclaw/logs
mkdir -p ~/.openclaw/credentials

# Note: With userns_mode in docker-compose.podman.yml,
# Podman automatically handles permissions - no manual chown needed!
```

**Option B: Use Interactive Onboarding (Traditional)**

If you prefer the interactive setup:
```bash
# Don't create openclaw.json beforehand
# The onboarding wizard will create it for you
mkdir -p ~/.openclaw
mkdir -p ~/.openclaw/workspace
```

### 3. Build and Run with Podman

**Option A: With Pre-Generated Config (Skip Onboarding)**

```bash
# Build the image
podman build \
  --build-arg "OPENCLAW_DOCKER_APT_PACKAGES=${OPENCLAW_DOCKER_APT_PACKAGES}" \
  -t openclaw:local \
  -f Dockerfile \
  .

# Set environment variables
export OPENCLAW_CONFIG_DIR="$HOME/.openclaw"
export OPENCLAW_WORKSPACE_DIR="$HOME/.openclaw/workspace"
export OPENCLAW_GATEWAY_PORT=18789
export OPENCLAW_BRIDGE_PORT=18790
export OPENCLAW_GATEWAY_BIND="lan"
export OPENCLAW_IMAGE="openclaw:local"

# Start gateway directly (skipping onboarding)
podman compose \
  -f docker-compose.yml \
  -f docker-compose.podman.yml \
  up -d openclaw-gateway
```

**Option B: With Interactive Onboarding (Traditional)**

```bash
# Run the setup script (includes onboarding)
./podman-setup.sh

# This will:
# 1. Build the image
# 2. Run interactive onboarding
# 3. Start the gateway
```

### 4. Verify Deployment

```bash
# Check container status
podman compose ps

# View logs
podman compose logs -f openclaw-gateway

# Test health endpoint
curl http://YOUR_SERVER_IP:18789/health

# Test from MacBook (via WireGuard)
curl http://YOUR_SERVER_LAN_IP:18789/health
```

## 🎯 Multi-Agent Configuration

To add more agents later, edit `~/.openclaw/openclaw.json`:

### Example: Personal + Family Agents

```json
{
  "agents": {
    "defaults": { /* ... */ },
    "list": [
      {
        "id": "personal",
        "displayName": "Personal Agent",
        "workspace": "~/.openclaw/workspace-personal",
        "state": "~/.openclaw/state-personal",
        "sandbox": {
          "mode": "off"  // Full access for personal use
        }
      },
      {
        "id": "family",
        "displayName": "Family Agent",
        "workspace": "~/.openclaw/workspace-family",
        "state": "~/.openclaw/state-family",
        "sandbox": {
          "mode": "all",  // Always sandboxed
          "workspaceAccess": "ro"  // Read-only
        }
      }
    ]
  },
  "bindings": [
    {
      "channel": "control",
      "agent": "personal"
    },
    {
      "channel": "whatsapp",
      "peer": { "kind": "contact", "id": "YOUR_PHONE@s.whatsapp.net" },
      "agent": "personal"
    },
    {
      "channel": "telegram",
      "peer": { "kind": "user", "id": 123456789 },
      "agent": "family"
    }
  ]
}
```

After editing, restart the gateway:
```bash
podman compose restart openclaw-gateway
```

## 📱 Adding WhatsApp

1. **Update Configuration**

Add to the `channels` section:
```json
{
  "channels": {
    "control": {
      "enabled": true
    },
    "whatsapp": {
      "enabled": true,
      "sessionPath": "~/.openclaw/sessions/whatsapp"
    }
  }
}
```

2. **Add Binding**

```json
{
  "bindings": [
    {
      "channel": "control",
      "agent": "default"
    },
    {
      "channel": "whatsapp",
      "peer": { "kind": "contact", "id": "YOUR_PHONE@s.whatsapp.net" },
      "agent": "default"
    }
  ]
}
```

3. **Pair Device**

```bash
# Restart gateway to load WhatsApp channel
podman compose restart openclaw-gateway

# Get QR code for pairing
podman compose exec openclaw-gateway openclaw channels pair whatsapp

# Or access via Control UI: http://YOUR_SERVER_IP:18789
```

The WhatsApp session will persist in the volume mount, so you won't need to re-pair after container restarts.

## 🔌 Adding Custom MCP Servers

Once basic deployment is working, integrate your custom MCP servers:

### 1. Add MCP Configuration

Create `~/.openclaw/.mcp.json`:

```json
{
  "mcpServers": {
    "my-custom-server": {
      "command": "node",
      "args": ["/path/to/your/mcp-server/index.js"],
      "env": {
        "CUSTOM_API_KEY": "your-key-here"
      }
    },
    "another-server": {
      "command": "python",
      "args": ["/path/to/your/server.py"],
      "env": {}
    }
  }
}
```

### 2. For Podman Deployment

You have two options:

**Option A: Volume mount your MCP servers**
```yaml
# In podman-compose.yml
volumes:
  - ~/.openclaw:/home/node/.openclaw
  - /path/to/your/mcp-servers:/mcp-servers:ro
```

Then reference in `.mcp.json`:
```json
{
  "mcpServers": {
    "my-server": {
      "command": "node",
      "args": ["/mcp-servers/my-server/index.js"]
    }
  }
}
```

**Option B: Bake into Docker image**
```dockerfile
# Add to Dockerfile
COPY /path/to/mcp-servers /app/mcp-servers
```

### 3. Verify MCP Integration

```bash
# Check available MCP tools
podman compose exec openclaw-gateway openclaw mcp list

# Test MCP server connection
podman compose exec openclaw-gateway openclaw mcp health my-custom-server
```

## 🤖 LangGraph Integration Path

Two approaches to explore:

### Approach 1: MCP Wrapper for LangGraph Agents

Create an MCP server that wraps your LangGraph agents:

```python
# mcp-langgraph-bridge.py
from mcp import Server
from your_langgraph_agent import YourAgent

server = Server("langgraph-bridge")

@server.call_tool()
async def invoke_agent(task: str):
    agent = YourAgent()
    result = await agent.run(task)
    return result

# Then configure in .mcp.json
```

This lets OpenClaw invoke your LangGraph agents as tools.

### Approach 2: Replace with OpenClaw Subagents

Use OpenClaw's multi-agent architecture to replace LangGraph:
- Each LangGraph agent → OpenClaw agent with specific tools/permissions
- Agent communication → OpenClaw's built-in routing and bindings
- State management → OpenClaw's persistent sessions

Benefits:
- Unified messaging (WhatsApp, Telegram, etc.)
- Built-in sandboxing and workspace isolation
- Consistent observability and logging

## 🔐 Access from MacBook

### Via WireGuard VPN (Current Setup)

Your WireGuard VPN makes the homelab appear as LAN:

```bash
# From MacBook (connected to WireGuard)
# Access Control UI
open http://YOUR_SERVER_LAN_IP:18789

# Send messages via CLI (requires gateway token)
openclaw message send \
  --gateway-url http://YOUR_SERVER_LAN_IP:18789 \
  --gateway-token "your-token-here" \
  --agent default \
  "Hello from MacBook"
```

### Adding Tailscale Later

When ready to test Tailscale:

1. **On homelab server:**
```bash
curl -fsSL https://tailscale.com/install.sh | sh
tailscale up
```

2. **On MacBook:**
```bash
# Install via Homebrew
brew install tailscale
tailscale up
```

3. **Optional: HTTPS via Tailscale Serve**
```bash
# On homelab server
tailscale serve https / http://127.0.0.1:18789
```

Then access via: `https://your-server.your-tailnet.ts.net`

## 🧪 Testing Multi-Agent Setup

### Test Plan

1. **Single Agent Verification**
   - Deploy with `homelab-base-config.json`
   - Verify Control UI access
   - Test WhatsApp pairing and messaging
   - Confirm workspace isolation

2. **Add Second Agent**
   - Edit config to add `agent2`
   - Create new workspace/state directories
   - Add binding for a different channel (e.g., Telegram)
   - Restart and verify both agents respond independently

3. **Test Agent Isolation**
   - Give agent1 a task that creates files in workspace
   - Verify agent2 cannot see agent1's workspace
   - Test different sandbox modes (`off` vs `all`)

4. **Test Cross-Agent Communication** (if needed)
   - Use bindings to route specific contacts to specific agents
   - Verify routing works correctly

### Verification Commands

```bash
# Check agent status
podman compose exec openclaw-gateway openclaw agents list

# View agent workspaces
ls -la ~/.openclaw/workspace*

# Check active sessions per agent
podman compose exec openclaw-gateway openclaw sessions list --agent default
podman compose exec openclaw-gateway openclaw sessions list --agent agent2

# Monitor logs for multi-agent activity
podman compose logs -f openclaw-gateway | grep -E "(agent1|agent2)"
```

## 📊 Directory Structure

After deployment, your `~/.openclaw` should look like:

```
~/.openclaw/
├── openclaw.json              # Main config (from homelab-base-config.json)
├── .mcp.json                  # MCP servers (optional)
├── workspace/                 # Default agent workspace
├── workspace-personal/        # Personal agent workspace (multi-agent)
├── workspace-family/          # Family agent workspace (multi-agent)
├── state/                     # Default agent state
├── state-personal/            # Personal agent state
├── state-family/              # Family agent state
├── sessions/                  # Persistent sessions (WhatsApp, etc.)
│   └── whatsapp/
├── logs/                      # Gateway logs
│   └── gateway.log
├── credentials/               # OAuth tokens, API keys
└── skills/                    # Skill-level state (if using skills)
```

## 🔄 Version Control Strategy

Create a template repo with secrets removed:

```bash
# Create template repo
mkdir openclaw-homelab-config
cd openclaw-homelab-config

# Copy base config
cp homelab-base-config.json openclaw.json.template

# Replace secrets with placeholders
sed -i 's/sk-ant-api03-.*/REPLACE_WITH_ANTHROPIC_API_KEY/g' openclaw.json.template
sed -i 's/"token": "[^"]*"/"token": "REPLACE_WITH_SECURE_TOKEN"/g' openclaw.json.template

# Create deployment script
cat > deploy.sh << 'EOF'
#!/bin/bash
set -e

# Read secrets from environment or secret manager
ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY}"
GATEWAY_TOKEN="${GATEWAY_TOKEN:-$(openssl rand -hex 32)}"

# Generate config
sed "s/REPLACE_WITH_ANTHROPIC_API_KEY/${ANTHROPIC_API_KEY}/g" openclaw.json.template | \
  sed "s/REPLACE_WITH_SECURE_TOKEN/${GATEWAY_TOKEN}/g" > openclaw.json

# Deploy
mkdir -p ~/.openclaw
cp openclaw.json ~/.openclaw/
chmod 600 ~/.openclaw/openclaw.json

echo "Deployed to ~/.openclaw/openclaw.json"
echo "Gateway token: ${GATEWAY_TOKEN}"
EOF

chmod +x deploy.sh

# Initialize git
git init
git add openclaw.json.template deploy.sh
git commit -m "Initial homelab OpenClaw config template"
```

## 🛠️ Troubleshooting

### Gateway Won't Start

```bash
# Check container logs
podman compose logs openclaw-gateway

# Common issues:
# 1. Port already in use
ss -ltnp | grep 18789

# 2. Permission issues (rootless Podman)
podman unshare chown -R 1000:1000 ~/.openclaw

# 3. Config validation errors
podman compose exec openclaw-gateway openclaw config validate
```

### WhatsApp Pairing Fails

```bash
# Check WhatsApp channel status
podman compose exec openclaw-gateway openclaw channels status whatsapp

# Clear session and re-pair
rm -rf ~/.openclaw/sessions/whatsapp
podman compose restart openclaw-gateway
podman compose exec openclaw-gateway openclaw channels pair whatsapp
```

### MCP Server Not Found

```bash
# Verify MCP config
cat ~/.openclaw/.mcp.json

# Check if binary exists in container
podman compose exec openclaw-gateway ls -la /path/to/mcp-server

# Test MCP server manually
podman compose exec openclaw-gateway node /path/to/mcp-server/index.js
```

## 📚 Next Steps

1. ✅ Deploy basic single-agent config
2. ✅ Verify Control UI access from MacBook (via WireGuard)
3. ✅ Add and test WhatsApp channel
4. 🔄 Add second agent and test isolation
5. 🔄 Integrate first custom MCP server
6. 🔄 Test LangGraph MCP wrapper
7. 🔄 Add Tailscale for improved access
8. 🔄 Consider migrating LangGraph agents to OpenClaw native

## 🔗 References

- Main deployment plan: `HOMELAB_DEPLOYMENT_PLAN.md`
- Multi-agent docs: https://docs.openclaw.ai/concepts/multi-agent
- MCP integration: https://docs.openclaw.ai/integrations/mcp
- Podman setup: `podman-setup.sh` in repo root
- Configuration reference: https://docs.openclaw.ai/gateway/configuration

---

**Questions or issues?** Review the deployment plan or check the OpenClaw docs at https://docs.openclaw.ai
