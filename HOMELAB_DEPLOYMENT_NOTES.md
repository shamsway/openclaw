# OpenClaw Homelab Deployment — Session Notes

**Last updated:** 2026-02-12 (session 5)
**Branch:** `feature/podman-homelab-deployment`

---

## Overall Status

| Component | Status | Notes |
|-----------|--------|-------|
| Container image | ✅ Built | `openclaw:local` |
| Gateway | ✅ Running | Podman, LAN bind, port 18789 |
| Config persistence | ✅ Working | `openclaw-agents/jerry/` (git repo) |
| File ownership | ✅ Fixed | Container root (uid=0) = host `hashi`; files appear as `hashi:hashi`; no `podman unshare` needed |
| Model providers | ✅ Configured | zai/glm-4.7 primary, anthropic + moonshot fallbacks |
| Slack | ✅ Working | #home-automation, Socket Mode |
| Discord | ✅ Partial | DMs working; channel allowlist configured but untested |
| WhatsApp | ⏳ Pending | Needs dedicated phone number |
| Web UI (HTTPS) | ⚠️ Workaround | SSH tunnel via VS Code; needs proper HTTPS |
| Agent config in git | ✅ Done | `github.com/shamsway/openclaw-agents` |
| Secrets in env vars | ✅ Done | Channel tokens + LLM keys in `.env` / docker-compose; `${ENV_VAR}` in openclaw.json |
| MCP tools (mcporter) | ✅ Working | context7 active; add servers via `homelab/.mcp.json` + rebuild |
| Auto-restart | ❌ Not configured | Gateway won't survive host reboot |
| Secrets in 1Password | ⏳ Pending | `.env` tokens to be replaced with `op run` injection |

---

## Progress — Session 5 (2026-02-12)

- Adopted **mcporter** as the MCP tooling approach: CLI tool installed in the image,
  same pattern as nomad/consul/op — no `openclaw.json` or `cliBackends` changes needed
- `homelab/.mcp.json` established as source of truth for agent MCP config (separate
  from root `.mcp.json` used by Claude Code); `jq` transform at build time converts
  it to mcporter's format
- Archived old `--mcp-config` approach to `homelab/mcp-legacy.md`
- Updated Lesson 9 and `openclaw-agents/jerry/workspace/TOOLS.md` with mcporter workflow
- Implemented and validated: `mcporter list context7` and tool calls working in container

## Progress — Session 4 (2026-02-12)

- Migrated agent config from `~/.openclaw/` to `github.com/shamsway/openclaw-agents` git repo
- Two-repo strategy: `openclaw-agents/jerry/` = config + workspace; secrets gitignored
- Replaced secrets in `openclaw.json` with `${ENV_VAR}` substitutions (OpenClaw native feature)
- Added channel tokens (Discord, Slack) and LLM API keys as docker-compose env vars
- Added LiteLLM placeholder env vars (`LITELLM_BASE_URL`, `LITELLM_API_KEY`) for future setup
- Updated `.env.example` with full secrets workflow documentation
- Discovered and documented podman-compose 1.0.3 limitation: must use `${VAR}` not `${VAR:-default}`
  in docker-compose.yml (workaround: ensure all vars present in `.env`, even if empty)
- Pushed `openclaw-agents` initial commit: 13 files, secrets-free

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

### 1. Rootless Podman — UID/GID Alignment

#### Root cause

Rootless Podman maps the container's non-zero UIDs through the host user's subuid
range (`/etc/subuid`: `hashi:100000:65536`). The `node` user (uid=1000 in the base
image) therefore appears as uid=**100999** on the host (100000 + 1000 − 1), making
bind-mounted `.openclaw/` files unreadable/unmanageable without `podman unshare`.

The previous `userns_mode: "keep-id:uid=1000,gid=1000"` override was intended to
fix this but was silently ignored by `podman-compose` 1.0.3's implementation of the
`userns_mode` key.

#### Fix (implemented 2026-02-12)

`podman-compose 1.0.3` silently drops the `userns_mode` key — `--userns=keep-id`
never reaches the underlying `podman run` command, so UID remapping via that path
does not work.

The correct solution for rootless Podman is to run the container as **root inside
the container** (`USER root`, which is the default when no `USER` directive is set).
In rootless Podman, container `uid=0` maps to the calling host user (`hashi`,
`uid=2000`), so:
- Files owned by `hashi` on the host appear as `uid=0` (root) inside the container
  — readable/writable by the root process ✓
- New files written by the container appear as `hashi:hashi` on the host ✓
- No `podman unshare` required ✓

The `USER node` line was removed from `homelab/Dockerfile`; the container now runs
as root (no elevated host privileges — rootless Podman guarantees this).

After a rebuild and re-run, files written by the container appear on the host as
`hashi:hashi` — no `podman unshare` required.

**One-time migration for existing files:**
```bash
sudo chown -R hashi:hashi /opt/homelab/data/home/.openclaw
```
(Run after `ctl.sh build && ctl.sh up` with the new image.)

#### Legacy workaround (superseded)

The old `fix-podman-permissions.sh` script used `podman unshare chown -R 1000:1000`
to pre-create dirs with the subuid-mapped ownership. This is no longer necessary
after the rebuild.

### 2. Gateway Token Can Drift

Token lives in two places; they must match:
- `openclaw.json` → set during onboarding (authoritative)
- `.env` → `OPENCLAW_GATEWAY_TOKEN` passed as container env var

After onboarding, verify with:
```bash
grep token /opt/homelab/data/home/.openclaw/openclaw.json
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

### 9. MCP Tools via mcporter

MCP tools are accessed via **mcporter** — a CLI installed in the image alongside
other tools (nomad, consul, op). No `openclaw.json` or `cliBackends` changes needed.

**Config source of truth:** `homelab/.mcp.json` (Claude's native format; kept
separate from the root `.mcp.json` used by Claude Code in the dev environment).
At image build time a `jq` one-liner transforms it to `/root/.mcporter/mcporter.json`
(mcporter uses `baseUrl` instead of `url`). Rebuild whenever `homelab/.mcp.json` changes.

**Servers configured in `homelab/.mcp.json`:**
- `context7` — library and framework documentation lookup
- `mcp-nomad-server` — Nomad cluster operations (https://nomad-mcp.shamsway.net)

**Usage:**
```bash
# List all tools for a server
mcporter list context7
mcporter list tavily

# Call a tool
mcporter call context7.resolve-library-id libraryName:"react"
mcporter call context7.get-library-docs libraryId:"/facebook/react" topic:"hooks"
mcporter call tavily.search query:"kubernetes pod scheduling"
```

**Adding a new MCP server:**
1. Add entry to `homelab/.mcp.json`
2. Rebuild: `./homelab/ctl.sh build && ./homelab/ctl.sh push`
3. Each node: `./homelab/ctl.sh pull && ./homelab/ctl.sh restart`

**Legacy approach (superseded):** `homelab/mcp-legacy.md` — the `--mcp-config` +
`mcp-servers.json` method used in sessions 1–4.

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
- [ ] Move `.env` secrets to 1Password; inject via `op run -- ./homelab/ctl.sh up`
- [ ] Test Control UI from MacBook without SSH tunnel (after HTTPS)
- [ ] Configure LiteLLM gateway URL and add provider to `openclaw.json`
- [ ] Add additional MCP servers to `homelab/.mcp.json` as needed (e.g. tavily, brave-search) + rebuild

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
# After the uid=2000 rebuild, files are owned by hashi — read directly:
cat /opt/homelab/data/home/.openclaw/openclaw.json

# Legacy (pre-fix, when files were owned by uid=100999):
# podman unshare cat /opt/homelab/data/home/.openclaw/openclaw.json
```

### Key Paths
| What | Where |
|------|-------|
| Deployment files | `/opt/homelab/data/home/git/openclaw/` |
| Environment config | `/opt/homelab/data/home/git/openclaw/.env` |
| Agent config repo | `/opt/homelab/data/home/git/openclaw-agents/` |
| OpenClaw config | `/opt/homelab/data/home/git/openclaw-agents/jerry/openclaw.json` |
| Auth profiles | `/opt/homelab/data/home/git/openclaw-agents/jerry/agents/main/agent/auth-profiles.json` |
| Workspace | `/opt/homelab/data/home/git/openclaw-agents/jerry/workspace/` |
| Agent sessions | `/opt/homelab/data/home/git/openclaw-agents/jerry/agents/main/sessions/` |
| GitHub repo | `https://github.com/shamsway/openclaw-agents` |
| Gateway token | `bc39640f3817ccdc8974cec6f82f1e7d04a8723346c8bda2` |
| Gateway port | `18789` |
| Primary model | `zai/glm-4.7` |
