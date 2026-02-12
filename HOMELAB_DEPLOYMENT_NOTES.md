# OpenClaw Homelab Deployment — Session Notes

**Last updated:** 2026-02-11
**Branch:** `feature/podman-homelab-deployment`

---

## Overall Status

| Component | Status | Notes |
|-----------|--------|-------|
| Container image | ✅ Built | `openclaw:local` |
| Gateway | ✅ Running | Podman, LAN bind, port 18789 |
| Config persistence | ✅ Working | `/opt/homelab/data/home/.openclaw/` |
| Model providers | ✅ Configured | moonshot primary, anthropic + z.ai fallbacks |
| Slack | ✅ Working | #home-automation, Socket Mode |
| Discord | ✅ Partial | DMs working; channel allowlist configured but untested |
| WhatsApp | ⏳ Pending | Needs dedicated phone number |
| Web UI (HTTPS) | ⚠️ Workaround | SSH tunnel via VS Code; needs proper HTTPS |
| Auto-restart | ❌ Not configured | Gateway won't survive host reboot |
| Secrets management | ❌ Not configured | Tokens/keys in plaintext `.env` and `openclaw.json` |

---

## Progress — Session 1 (2026-02-10)

- Environment verified (Podman 4.3.1, podman-compose 1.0.3)
- `.env` configured with homelab paths and LAN gateway binding
- Fixed rootless Podman permissions via `fix-podman-permissions.sh`
- Built `openclaw:local` container image
- Completed onboarding (Manual mode)
- Gateway started and health check passing
- Gateway token reconciled between `.env` and `openclaw.json`

## Progress — Session 3 (2026-02-11)

- Fixed `ctl.sh` to use `podman-compose` binary (Podman 4.3.1 has no built-in `compose` subcommand)
- Added `push` and `pull` commands to `ctl.sh` for local registry (`registry.service.consul:8082`, HTTP, `--tls-verify=false`)
- Updated `docker-compose.yml` and `.env.example` to default to registry image
- Hardened `ctl.sh build` to use absolute paths for Dockerfile and build context; prints Dockerfile/tag/context before build
- Researched and documented MCP server configuration (HTTP/SSE) — see Lesson 9 below

## Progress — Session 2 (2026-02-10/11)

- Fixed invalid Anthropic API key — re-configured via `openclaw auth login`
- Configured model providers:
  - **Primary:** `moonshot/kimi-k2.5`
  - **Fallbacks:** `anthropic/claude-sonnet-4-5`, `zai/glm-4.7`, `zai/glm-4.7-flash`, `zai/glm-4.6`, `zai/glm-4.5` series, `moonshot/kimi-k2-0905-preview`
- **Slack** — fully working via Socket Mode in `#home-automation`
- **Discord** — bot logged in; DMs working; re-invited with `bot` scope to fix private channel access; channel `groupPolicy` was `allowlist` with empty allowlist — added channel ID to fix
- **Web Control UI** — accessible via SSH port forward (`localhost:18789`); direct Tailscale access blocked by browser secure context requirement (HTTPS needed)
- Identified that `gateway.bind` in `openclaw.json` is `"auto"` but is correctly overridden by `--bind lan` in `docker-compose.yml`

---

## Lessons Learned

### 1. Rootless Podman Permissions Require `podman unshare`

Host directories owned by UID 2000 are not writable by container UID 1000. Run before first onboarding:

```bash
OPENCLAW_CONFIG_DIR=/opt/homelab/data/home/.openclaw \
OPENCLAW_WORKSPACE_DIR=/opt/homelab/data/home/.openclaw/workspace \
./fix-podman-permissions.sh
```

Files in `.openclaw` appear as UID 100999 on the host afterward — correct and expected. Read them from the host via:
```bash
podman unshare cat /opt/homelab/data/home/.openclaw/openclaw.json
```

### 2. Gateway Token Can Drift

Token lives in two places; they must match:
- `openclaw.json` → set during onboarding (authoritative)
- `.env` → `OPENCLAW_GATEWAY_TOKEN` passed as container env var

After onboarding, verify with:
```bash
podman unshare cat /opt/homelab/data/home/.openclaw/openclaw.json | grep token
grep OPENCLAW_GATEWAY_TOKEN .env
```

**Current token:** `bc39640f3817ccdc8974cec6f82f1e7d04a8723346c8bda2`

### 3. Use Manual Mode for Onboarding

Gives control over gateway bind (`lan`), auth mode (`token`), and no daemon install. Required for homelab deployments.

### 4. Config Paths Are Container-Internal During Onboarding

- Config: `/home/node/.openclaw` → host: `/opt/homelab/data/home/.openclaw`
- Workspace: `/home/node/.openclaw/workspace` → host: `/opt/homelab/data/home/.openclaw/workspace`

### 5. Discord: `bot` Scope Required for Private Channel Access

OAuth invite URL must include both `bot` and `applications.commands` scopes. Without `bot`, the bot joins as an integration only and cannot be added to private channels.

### 6. Discord: `groupPolicy: allowlist` Requires Explicit Channel IDs

If `groupPolicy` is `allowlist` and no channels are listed, the bot will work for DMs but silently ignore all server channel messages. Add channels via:
```bash
openclaw configure --section channels
```
Channel IDs (not names) are required. Enable Discord Developer Mode → right-click channel → Copy Channel ID.

### 7. Web UI Requires Secure Context (HTTPS or localhost)

Direct access via `http://<tailscale-ip>:18789` triggers `disconnected (1008): control ui requires HTTPS or localhost`. Options:
- SSH port forward (current workaround): `ssh -N -L 18789:127.0.0.1:18789 user@host`
- Tailscale Serve (recommended): `tailscale serve https / http://127.0.0.1:18789`
- Traefik + Let's Encrypt (Phase 2)

### 8. Interactive Container Shell

For a multi-command session, exec into the running gateway container:
```bash
podman exec -it homelab_openclaw-gateway_1 bash
alias openclaw='node dist/index.js'
```

### 9. MCP Server Configuration (HTTP/SSE)

MCP servers are wired in via two files — both live inside `OPENCLAW_CONFIG_DIR` so they persist across container restarts.

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

**Step 2 — `~/.openclaw/openclaw.json`** (tell OpenClaw to pass `--mcp-config` to the Claude CLI):

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

Note: `/home/node/.openclaw/` is the in-container path. The `args` array replaces (not appends) the default args, so all required flags must be listed. Drop `--strict-mcp-config` to also load Claude's user-level MCP servers.

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

---

## Current Blockers

### 🔴 No Auto-Restart on Reboot
The gateway container will not start automatically if the homelab node reboots. The `restart: unless-stopped` policy handles container crashes but not host reboots under rootless Podman.

**Fix:** Add a systemd user service or Nomad job (Phase 2/3).

### 🟡 HTTPS Access
Web UI only accessible via SSH tunnel. Not suitable for production or mobile access.

**Fix:** `tailscale serve https / http://127.0.0.1:18789` (quick) or Traefik + Let's Encrypt (proper).

### 🟡 WhatsApp Not Configured
Needs a dedicated phone number and QR code scan.

**Fix:** When ready: `openclaw providers login` → select WhatsApp → scan QR.

### 🟡 Secrets in Plaintext
API keys and tokens stored in `.env` and `openclaw.json` (mode 600, but still on disk unencrypted).

**Fix:** 1Password integration with `op run` or Nomad Vault/template injection (Phase 2).

### 🟡 Discord Channel Response Untested
Allowlist was updated to include the channel ID but not yet verified to be working end-to-end.

---

## Remaining Todos

### Near-term (Phase 2)
- [ ] Verify Discord channel responses after allowlist fix
- [ ] Set up WhatsApp channel (QR scan)
- [ ] Configure HTTPS via Tailscale Serve
- [ ] Set up auto-restart on reboot (systemd user service)
- [ ] Move secrets to 1Password; inject via `op run` at container start
- [ ] Test Control UI from MacBook without SSH tunnel (after HTTPS)

### Medium-term (Phase 2/3)
- [ ] Set up LiteLLM provider endpoint for additional model routing options
- [ ] Configure Brave Search API key for web search tool
- [ ] Explore hooks configuration (e.g. `/new` → save context to memory)
- [ ] Write Nomad job spec following Octant patterns

### Long-term (Phase 3)
- [ ] Nomad job spec with Consul service registration
- [ ] Terraform module for full Octant integration
- [ ] Automatic certificate management via Traefik
- [ ] Healthcheck integration with Octant monitoring

---

## Quick Reference

### Start/Stop Gateway
```bash
cd /opt/homelab/data/home/git/openclaw

./homelab/ctl.sh up       # start in background
./homelab/ctl.sh down     # stop and remove containers
./homelab/ctl.sh restart  # restart (after config changes)
./homelab/ctl.sh logs     # follow logs
./homelab/ctl.sh ps       # container status

# Build and push to local registry (build node)
./homelab/ctl.sh build && ./homelab/ctl.sh push

# Pull from registry and start (remote nodes)
./homelab/ctl.sh pull && ./homelab/ctl.sh up

# Health check
podman exec homelab_openclaw-gateway_1 node dist/index.js gateway health
```

### Interactive CLI Session
```bash
podman exec -it homelab_openclaw-gateway_1 bash
alias openclaw='node dist/index.js'
```

### Read Config from Host
```bash
podman unshare cat /opt/homelab/data/home/.openclaw/openclaw.json
```

### Key Paths
| What | Where |
|------|-------|
| Deployment files | `/opt/homelab/data/home/git/openclaw/` |
| Environment config | `/opt/homelab/data/home/git/openclaw/.env` |
| OpenClaw config | `/opt/homelab/data/home/.openclaw/openclaw.json` |
| Auth profiles | `/opt/homelab/data/home/.openclaw/agents/main/agent/auth-profiles.json` |
| Workspace | `/opt/homelab/data/home/.openclaw/workspace/` |
| Agent sessions | `/opt/homelab/data/home/.openclaw/agents/main/sessions/` |
| Gateway token | `bc39640f3817ccdc8974cec6f82f1e7d04a8723346c8bda2` |
| Gateway port | `18789` |
| Primary model | `moonshot/kimi-k2.5` |
