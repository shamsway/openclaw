# TOOLS.md - Tools & Notes

Notes on available MCP servers, their quirks, and anything else worth remembering.

## How MCP Servers Are Configured

MCP servers are wired in through two files inside `OPENCLAW_CONFIG_DIR` (`/home/node/.openclaw/` in-container, `/opt/homelab/data/home/.openclaw/` on the host):

**`~/.openclaw/mcp-servers.json`** — the server list (Claude's format):
```json
{
  "mcpServers": {
    "server-name": {
      "type": "http",
      "url": "http://server.service.consul:8080/mcp"
    },
    "sse-server": {
      "type": "sse",
      "url": "http://server.service.consul:9090/sse"
    }
  }
}
```

**`~/.openclaw/openclaw.json`** — passes the config to the Claude CLI backend:
```json
{
  "agents": {
    "defaults": {
      "cliBackends": {
        "claude-cli": {
          "args": [
            "-p",
            "--output-format", "json",
            "--dangerously-skip-permissions",
            "--mcp-config", "/home/node/.openclaw/mcp-servers.json",
            "--strict-mcp-config"
          ]
        }
      }
    }
  }
}
```

After editing either file: `./homelab/ctl.sh restart`

**Validation:**
```bash
podman exec homelab_openclaw-gateway_1 claude mcp list
podman exec homelab_openclaw-gateway_1 claude mcp get <server-name>
./homelab/ctl.sh logs | grep -i mcp
```

Full reference: `HOMELAB_DEPLOYMENT_NOTES.md` → Lesson 9.

## MCP Servers

### nomad

Nomad cluster operations.
- **Endpoint:** *(e.g. http://nomad.service.consul:4646)*
- **Notes:** *(quirks, common queries, useful job names)*

### gcp

Google Cloud resources.
- **Project:** *(GCP project ID if applicable)*
- **Notes:**

### tailscale

Tailscale mesh network.
- **Tailnet:** *(your tailnet name)*
- **Nodes:** Jerry (this one), + others as they come online
- **Notes:**

### infra

Infrastructure-level operations.
- **Notes:** *(what this covers — Ansible playbooks? Terraform? Both?)*

### a2a-hub

Agent-to-agent router. Dispatches tasks to specialized agents once they're online.
- **Notes:** *(routing logic, which agents are registered)*

## SSH / Access

*(add node access details here as needed — hostnames, jump hosts, key locations)*

- **Jerry:** *(hostname or Tailscale IP)*

## Cluster Layout

*(fill in as you explore)*

- **Nomad datacenter:**
- **Consul datacenter:**
- **Key services registered in Consul:**

## Lessons Learned

*(update as you go — quirks, gotchas, things not to forget)*
