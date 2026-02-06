# OpenClaw Homelab Quick Start

A streamlined checklist for deploying OpenClaw in your homelab using the base configuration approach.

## ⚡ Quick Deploy (15 minutes)

### Prerequisites Checklist
- [ ] Homelab Linux server with Podman installed
- [ ] Anthropic API key ready
- [ ] WireGuard VPN connected (or LAN access)
- [ ] OpenClaw repo cloned on homelab server

### Step 1: Prepare Configuration (5 min)

```bash
# On your homelab server
cd ~/openclaw  # or wherever you cloned the repo

# Generate a secure gateway token
export GATEWAY_TOKEN=$(openssl rand -hex 32)
echo "Save this token: ${GATEWAY_TOKEN}"

# Create custom config from template
cp homelab-base-config.json ~/.openclaw/openclaw.json

# Replace placeholders (or edit manually)
sed -i "s/REPLACE_WITH_SECURE_TOKEN/${GATEWAY_TOKEN}/g" ~/.openclaw/openclaw.json
sed -i "s/REPLACE_WITH_ANTHROPIC_API_KEY/sk-ant-api03-YOUR_KEY/g" ~/.openclaw/openclaw.json

# Optional: Adjust network settings if needed
# Edit ~/.openclaw/openclaw.json and change "bind" or "port"
```

### Step 2: Build and Deploy (5 min)

```bash
# Build Podman image
podman build \
  -t openclaw:local \
  -f Dockerfile \
  .

# Set environment variables
export OPENCLAW_CONFIG_DIR="$HOME/.openclaw"
export OPENCLAW_WORKSPACE_DIR="$HOME/.openclaw/workspace"
export OPENCLAW_GATEWAY_PORT=18789
export OPENCLAW_GATEWAY_BIND="lan"

# Start gateway (Podman handles permissions automatically via userns_mode)
podman compose \
  -f docker-compose.yml \
  -f docker-compose.podman.yml \
  up -d openclaw-gateway
```

**Alternative: Interactive Onboarding**

If you prefer the wizard instead of pre-configured setup:
```bash
./podman-setup.sh
# Follow the prompts - this creates the config for you
```

### Step 3: Verify (5 min)

```bash
# Check container status
podman compose -f docker-compose.yml -f docker-compose.podman.yml ps

# View logs (look for "Gateway started" message)
podman compose -f docker-compose.yml -f docker-compose.podman.yml logs openclaw-gateway | tail -50

# Test health endpoint
curl http://localhost:18789/health
# Should return: {"status":"ok"}

# From MacBook (via WireGuard)
curl http://YOUR_SERVER_LAN_IP:18789/health
```

**Note:** You can create an alias to simplify the command:
```bash
# Add to ~/.bashrc or ~/.zshrc
alias pc='podman compose -f docker-compose.yml -f docker-compose.podman.yml'

# Then use:
pc ps
pc logs -f openclaw-gateway
pc restart openclaw-gateway
```

### Step 4: Access Control UI

```bash
# From MacBook browser (via WireGuard)
open http://YOUR_SERVER_LAN_IP:18789

# You'll need the gateway token from Step 1
# Enter it when prompted for authentication
```

✅ **Basic deployment complete!**

---

## 🚀 Next: Add WhatsApp (10 minutes)

### Update Configuration

```bash
# Edit ~/.openclaw/openclaw.json
# Add to "channels" section:
{
  "whatsapp": {
    "enabled": true,
    "sessionPath": "~/.openclaw/sessions/whatsapp"
  }
}

# Add to "bindings" section (replace with your phone number):
{
  "channel": "whatsapp",
  "peer": {
    "kind": "contact",
    "id": "1234567890@s.whatsapp.net"  # Replace with your number
  },
  "agent": "default"
}

# Restart gateway
podman compose restart openclaw-gateway
```

### Pair WhatsApp

**Option 1: Via Control UI (easier)**
1. Open http://YOUR_SERVER_LAN_IP:18789
2. Click "Channels" → "WhatsApp"
3. Click "Pair"
4. Scan QR code with WhatsApp mobile app
   - Open WhatsApp → Settings → Linked Devices → Link a Device

**Option 2: Via CLI**
```bash
podman compose exec openclaw-gateway openclaw channels pair whatsapp
# Scan the QR code that appears
```

### Test WhatsApp

Send a message to yourself from WhatsApp. The agent should respond!

✅ **WhatsApp integration complete!**

---

## 🎯 Next: Add Second Agent (15 minutes)

### Create Agent Workspaces

```bash
# On homelab server
mkdir -p ~/.openclaw/workspace-personal
mkdir -p ~/.openclaw/workspace-family
mkdir -p ~/.openclaw/state-personal
mkdir -p ~/.openclaw/state-family

# Fix permissions for Podman
podman unshare chown -R 1000:1000 ~/.openclaw/workspace-personal
podman unshare chown -R 1000:1000 ~/.openclaw/workspace-family
podman unshare chown -R 1000:1000 ~/.openclaw/state-personal
podman unshare chown -R 1000:1000 ~/.openclaw/state-family
```

### Update Configuration

Replace the `agents.list` section in `~/.openclaw/openclaw.json`:

```json
{
  "agents": {
    "defaults": { /* keep existing defaults */ },
    "list": [
      {
        "id": "personal",
        "displayName": "Personal Agent",
        "workspace": "~/.openclaw/workspace-personal",
        "state": "~/.openclaw/state-personal",
        "sandbox": {
          "mode": "off"
        }
      },
      {
        "id": "family",
        "displayName": "Family Agent",
        "workspace": "~/.openclaw/workspace-family",
        "state": "~/.openclaw/state-family",
        "sandbox": {
          "mode": "all",
          "workspaceAccess": "ro"
        }
      }
    ]
  }
}
```

Update bindings to route channels to specific agents:

```json
{
  "bindings": [
    {
      "channel": "control",
      "agent": "personal"
    },
    {
      "channel": "whatsapp",
      "peer": { "kind": "contact", "id": "YOUR_PHONE@s.whatsapp.net" },
      "agent": "personal"
    }
  ]
}
```

### Restart and Verify

```bash
# Restart gateway
podman compose restart openclaw-gateway

# Check both agents are loaded
podman compose exec openclaw-gateway openclaw agents list

# Expected output:
# - personal (Personal Agent)
# - family (Family Agent)

# Test each agent has isolated workspace
ls -la ~/.openclaw/workspace-personal
ls -la ~/.openclaw/workspace-family
```

✅ **Multi-agent setup complete!**

---

## 🔌 Next: Add Custom MCP Server (20 minutes)

### Example: Simple MCP Server

Create a test MCP server on your homelab:

```bash
# Create MCP server directory
mkdir -p ~/mcp-servers/test-server
cd ~/mcp-servers/test-server

# Create simple MCP server (example)
cat > index.js << 'EOF'
#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new Server({
  name: 'test-server',
  version: '1.0.0',
}, {
  capabilities: {
    tools: {},
  },
});

server.setRequestHandler('tools/list', async () => {
  return {
    tools: [
      {
        name: 'test_tool',
        description: 'A test tool from your custom MCP server',
        inputSchema: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'A message to echo back',
            },
          },
          required: ['message'],
        },
      },
    ],
  };
});

server.setRequestHandler('tools/call', async (request) => {
  if (request.params.name === 'test_tool') {
    return {
      content: [
        {
          type: 'text',
          text: `Echo: ${request.params.arguments.message}`,
        },
      ],
    };
  }
  throw new Error(`Unknown tool: ${request.params.name}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);
EOF

# Install MCP SDK
npm init -y
npm install @modelcontextprotocol/sdk
```

### Configure OpenClaw to Use MCP Server

```bash
# Update podman-compose.yml to mount MCP servers
# Add to volumes section:
volumes:
  - ~/.openclaw:/home/node/.openclaw
  - ~/mcp-servers:/mcp-servers:ro

# Create MCP config
cat > ~/.openclaw/.mcp.json << 'EOF'
{
  "mcpServers": {
    "test-server": {
      "command": "node",
      "args": ["/mcp-servers/test-server/index.js"]
    }
  }
}
EOF

# Restart with new volume mount
podman compose down
podman compose up -d openclaw-gateway
```

### Test MCP Integration

```bash
# List available MCP servers
podman compose exec openclaw-gateway openclaw mcp list

# Should show: test-server

# Test the tool via agent
# Send a message via WhatsApp or Control UI:
# "Use the test_tool to echo 'Hello from MCP'"
```

✅ **Custom MCP server integrated!**

---

## 📊 Verification Checklist

After completing all steps, verify:

- [ ] Gateway responds at http://YOUR_SERVER_LAN_IP:18789/health
- [ ] Control UI accessible and authenticated
- [ ] WhatsApp paired and receives messages
- [ ] Multiple agents listed in `openclaw agents list`
- [ ] Each agent has isolated workspace
- [ ] MCP server appears in `openclaw mcp list`
- [ ] Agent can use MCP tools

---

## 🎓 Next Learning Steps

### 1. Test LangGraph Integration

**Option A: MCP Wrapper**
- Wrap your LangGraph agent as an MCP server
- Follow the same pattern as test-server above
- Agent invokes LangGraph via MCP tool calls

**Option B: Native Migration**
- Review your LangGraph agent's tools and state
- Map to OpenClaw agent configuration
- Use OpenClaw's multi-agent routing instead of LangGraph
- Benefit: unified messaging, sandboxing, observability

### 2. Explore Tailscale

When ready for better remote access:

```bash
# On homelab server
curl -fsSL https://tailscale.com/install.sh | sh
tailscale up

# On MacBook
brew install tailscale
tailscale up

# Access via Tailscale hostname
# https://your-server.your-tailnet.ts.net
```

### 3. Add More Channels

Try adding Telegram or Discord:
- Follow similar pattern as WhatsApp
- Update `channels` config
- Add bindings to route to agents
- Pair/authenticate the channel

### 4. Harden Security

Once basics work, consider:
- Ansible hardened deployment (see HOMELAB_DEPLOYMENT_PLAN.md)
- Firewall rules (UFW)
- Restrict gateway token access
- Regular backups of `~/.openclaw`

---

## 📝 Common Questions

**Q: Can I skip onboarding entirely with this approach?**
A: Yes! The config file replaces the onboarding process. Just ensure all required fields are set.

**Q: How do I update OpenClaw?**
A: Rebuild the Podman image with the latest code:
```bash
git pull origin main
podman build -t openclaw:local -f Dockerfile .
podman compose up -d --force-recreate openclaw-gateway
```

**Q: Where are my agent's files stored?**
A: In the workspace directories:
- Default: `~/.openclaw/workspace/`
- Multi-agent: `~/.openclaw/workspace-{agent-id}/`

**Q: How do I back up my setup?**
A: Back up the entire `~/.openclaw` directory:
```bash
tar czf openclaw-backup-$(date +%Y%m%d).tar.gz ~/.openclaw
```

**Q: Can I use the same config on multiple servers?**
A: Yes! Just change the gateway token per server and adjust any server-specific paths.

**Q: How do I see what the agent is doing?**
A: Multiple options:
- Control UI: http://YOUR_SERVER_LAN_IP:18789
- Logs: `podman compose logs -f openclaw-gateway`
- Session history: `openclaw sessions list --agent default`

---

## 🆘 Quick Troubleshooting

### Gateway won't start
```bash
podman compose logs openclaw-gateway
# Check for port conflicts, permission errors, or config validation issues
```

### Can't access from MacBook
```bash
# On server: verify gateway is listening
ss -ltnp | grep 18789

# On MacBook: verify WireGuard connection
ping YOUR_SERVER_LAN_IP
```

### WhatsApp won't pair
```bash
# Clear session and retry
rm -rf ~/.openclaw/sessions/whatsapp
podman compose restart openclaw-gateway
```

### MCP server not found
```bash
# Verify mount point
podman compose exec openclaw-gateway ls -la /mcp-servers

# Check MCP config
cat ~/.openclaw/.mcp.json
```

---

## 📚 Full Documentation

For detailed information, see:
- `HOMELAB_CONFIG_GUIDE.md` - Complete configuration reference
- `HOMELAB_DEPLOYMENT_PLAN.md` - Architecture options and planning
- https://docs.openclaw.ai - Official documentation

---

**Ready to deploy?** Start with Step 1 above and work through sequentially. Each step builds on the previous one.

Good luck with your homelab deployment! 🚀
