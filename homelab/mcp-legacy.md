# Legacy MCP Approach (Superseded)

> **Superseded in session 5** — MCP tools are now accessed via the `mcporter` CLI
> installed in the image. See `homelab/jerry/TOOLS.md` and Lesson 9 in
> `HOMELAB_DEPLOYMENT_NOTES.md` for the current approach.
>
> This document preserves the original `--mcp-config` wiring for reference.

---

## MCP Server Configuration via `--mcp-config` (HTTP/SSE)

MCP servers were wired in via two files — both inside `OPENCLAW_CONFIG_DIR` so
they persist across container restarts.

**Step 1 — `~/.openclaw/mcp-servers.json`** (Claude's MCP server list):

```json
{
  "mcpServers": {
    "my-server": {
      "type": "http",
      "url": "http://my-server.service.consul:8080/mcp"
    },
    "legacy-sse-server": {
      "type": "sse",
      "url": "http://other-server.service.consul:9090/sse"
    },
    "authed-server": {
      "type": "http",
      "url": "http://internal.service.consul:8080/mcp",
      "headers": { "Authorization": "Bearer <token>" }
    }
  }
}
```

**Step 2 — `~/.openclaw/openclaw.json`** (pass `--mcp-config` to the Claude CLI backend):

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

Note: `/home/node/.openclaw/` is the in-container path. The `args` array replaces
(not appends to) the default args, so all required flags must be present.
Drop `--strict-mcp-config` to also load Claude's user-level MCP servers.

**Restart after any changes:**
```bash
./homelab/ctl.sh restart
```

**Validation commands:**
```bash
# List MCP servers known to Claude inside the container
podman exec homelab_openclaw-gateway_1 claude mcp list

# Inspect a specific server (shows url, type, tools)
podman exec homelab_openclaw-gateway_1 claude mcp get <server-name>

# Check for connection errors at startup
./homelab/ctl.sh logs | grep -i mcp

# End-to-end test — ask Jerry to introspect her tools
openclaw agent --message "what mcp tools do you have available? list them all"

# Verbose MCP debug: temporarily add --debug to openclaw.json args, then:
./homelab/ctl.sh logs
```

## Why This Approach Was Retired

- Required maintaining a separate `mcp-servers.json` file in the mounted config dir
- Required modifying `openclaw.json` `cliBackends.args` (a non-obvious config path)
- Relied on Claude CLI's HTTP MCP client behaviour in non-interactive (`-p`) mode
- mcporter provides the same access as a plain CLI tool — consistent with nomad,
  consul, op, gcloud already installed in the image — with no agent config changes
