# OpenClaw Homelab Deployment — Session Notes

**Date:** 2026-02-10
**Session Goal:** Deploy OpenClaw gateway via Podman on Octant homelab (Phase 1)

---

## Progress Made

### ✅ Completed

- **Environment verified** — Podman 4.3.1 and podman-compose 1.0.3 already installed on homelab node
- **Deployment branch checked out** — Running on `feature/podman-homelab-deployment` (detached HEAD from `origin/feature/podman-homelab-deployment`)
- **`.env` configured** — Custom homelab paths set:
  - `OPENCLAW_CONFIG_DIR=/opt/homelab/data/home/.openclaw`
  - `OPENCLAW_WORKSPACE_DIR=/opt/homelab/data/home/.openclaw/workspace`
  - `OPENCLAW_GATEWAY_BIND=lan` (for Tailscale access)
- **Permissions fixed** — Ran `fix-podman-permissions.sh` with explicit env vars to create directories with correct Podman user namespace ownership
- **Container image built** — `openclaw:local` built successfully via `podman-setup.sh`
- **Onboarding completed** — Manual mode; config saved to `/opt/homelab/data/home/.openclaw/openclaw.json`
- **Gateway started and healthy** — `Gateway Health: OK (0ms)`; listening on `ws://0.0.0.0:18789`

### Current State

| Component | Status |
|-----------|--------|
| Container image | ✅ Built (`openclaw:local`) |
| Config file | ✅ Saved (`/opt/homelab/data/home/.openclaw/openclaw.json`) |
| Gateway health | ✅ Passing |
| LAN binding | ✅ `0.0.0.0:18789` |
| Messaging channels | ⚠️ Not configured |
| API key | ⚠️ Not configured |
| MacBook access | ⚠️ Not tested |

---

## Lessons Learned

### 1. Rootless Podman Permissions Require `podman unshare`

**Problem:** Host directories created normally (owned by UID 2000 / `hashi`) are not writable by the container (which runs as UID 1000 / `node`). First run of onboarding failed with:
```
Error: EACCES: permission denied, open '/home/node/.openclaw/openclaw.json.tmp'
```

**Fix:** Run `fix-podman-permissions.sh` with explicit env vars before onboarding:
```bash
OPENCLAW_CONFIG_DIR=/opt/homelab/data/home/.openclaw \
OPENCLAW_WORKSPACE_DIR=/opt/homelab/data/home/.openclaw/workspace \
./fix-podman-permissions.sh
```

This uses `podman unshare chown -R 1000:1000` to create directories owned correctly within the user namespace. Files appear as UID `100999` on the host (the mapped representation of container UID 1000 for `hashi`'s subuid range) — this is expected and correct.

**Note:** The `fix-podman-permissions.sh` script deletes and recreates the config/workspace directories — run it **before** onboarding, not after saving real config/data.

**Access from host:** Files in `.openclaw` are owned by UID 100999 and have `600` permissions. Reading them from the host requires:
```bash
podman unshare cat /opt/homelab/data/home/.openclaw/openclaw.json
```

### 2. Gateway Token Can Get Out of Sync

The gateway token exists in two places and must match:
- **`openclaw.json`** — set during onboarding (authoritative config)
- **`.env` / `OPENCLAW_GATEWAY_TOKEN`** — passed as container env var

The setup script regenerated a new token during the first run and saved it to `.env`. Then during onboarding, leaving the token prompt blank generated *another* new token saved to `openclaw.json`. These two diverged.

**Fix:** After onboarding, verify the `.env` token matches `openclaw.json`:
```bash
podman unshare cat /opt/homelab/data/home/.openclaw/openclaw.json | grep token
grep OPENCLAW_GATEWAY_TOKEN .env
```

**Current token** (both `.env` and `openclaw.json` now agree):
```
bc39640f3817ccdc8974cec6f82f1e7d04a8723346c8bda2
```

### 3. Onboarding: Use Manual Mode

QuickStart may not offer control over gateway bind address or other settings. Manual mode is recommended for homelab deployments so you can confirm:
- Gateway bind: `lan`
- Auth: `token`
- No daemon install (container handles this)
- No Tailscale Serve (handled externally by your Octant setup)

### 4. Health Check Command Syntax

The `health --token` flag does not exist. The correct commands are:
```bash
# From inside the container:
node dist/index.js gateway health     # Returns "OK (0ms)"
node dist/index.js health             # Shows agent/session status

# Via podman exec (from host):
podman exec openclaw_openclaw-gateway_1 node dist/index.js gateway health
```

### 5. Onboarding Config Paths Are Container-Internal

When onboarding asks for directory paths, provide container-internal paths:
- Config: `/home/node/.openclaw` (maps to host `/opt/homelab/data/home/.openclaw`)
- Workspace: `/home/node/.openclaw/workspace` (maps to host `/opt/homelab/data/home/.openclaw/workspace`)

---

## Existing Blockers

### 🔴 No Model API Key Configured

The gateway has `anthropic/claude-sonnet-4-5` set as the model but no API key is configured. Agents will start but all AI calls will fail.

**Options (choose one or combine):**
1. **Anthropic API key** — Add directly to `openclaw.json` or pass as env var:
   ```json
   {
     "providers": {
       "anthropic": { "apiKey": "sk-ant-api03-..." }
     }
   }
   ```
2. **LiteLLM endpoint** — Configure as OpenAI-compatible provider for Claude access via your existing LiteLLM deployment
3. **z.ai / Moonshot** — Cheaper providers for testing; configure as additional providers

### 🟡 Messaging Channels Not Configured (Deferred to Phase 2)

Slack and WhatsApp are the priority channels. Neither is set up yet.

### 🟡 MacBook Access Not Tested

Gateway is listening on LAN (`0.0.0.0:18789`). Tailscale access from MacBook not yet verified.

---

## Suggested Next Steps

### Immediate (Start of Next Session)

1. **Start the gateway:**
   ```bash
   cd /opt/homelab/data/home/git/openclaw
   podman-compose \
     -f docker-compose.yml \
     -f docker-compose.podman.yml \
     up -d openclaw-gateway
   ```

2. **Configure a model provider** — Pick the easiest option first:
   - For quick testing: add `ANTHROPIC_API_KEY` to `.env` and the `providers.anthropic.apiKey` block to `openclaw.json`
   - For LiteLLM: configure an OpenAI-compatible provider endpoint

3. **Test from MacBook via Tailscale:**
   ```
   http://<tailscale-ip>:18789/?token=bc39640f3817ccdc8974cec6f82f1e7d04a8723346c8bda2
   ```
   Verify the Control UI loads and you can send a test message to the agent.

### Phase 2 (After MacBook Access Confirmed)

4. **Set up Slack channel** — Requires a Slack bot token:
   ```bash
   podman-compose -f docker-compose.yml -f docker-compose.podman.yml \
     run --rm openclaw-cli providers add --provider slack --token <bot-token>
   ```

5. **Set up WhatsApp channel** — Requires QR code scan:
   ```bash
   podman-compose -f docker-compose.yml -f docker-compose.podman.yml \
     run --rm openclaw-cli providers login
   ```

6. **Store secrets in 1Password** — Move gateway token and API keys out of `.env` and into 1Password, injecting at runtime via `op run` or Nomad templates

7. **Configure Tailscale Serve** (optional) — For HTTPS access without exposing port directly:
   ```bash
   tailscale serve https / http://127.0.0.1:18789
   ```

### Phase 3 (Future)
- Wrap in Nomad job spec following Octant patterns
- Create Terraform module alongside other Octant services
- Integrate 1Password secrets in Nomad template

---

## Quick Reference

### Start/Stop Gateway
```bash
cd /opt/homelab/data/home/git/openclaw

# Start
podman-compose -f docker-compose.yml -f docker-compose.podman.yml up -d openclaw-gateway

# Stop
podman-compose -f docker-compose.yml -f docker-compose.podman.yml down

# Logs
podman-compose -f docker-compose.yml -f docker-compose.podman.yml logs -f openclaw-gateway

# Health check
podman exec openclaw_openclaw-gateway_1 node dist/index.js gateway health
```

### Config Access (from host)
```bash
# Read config (requires podman unshare due to user namespace)
podman unshare cat /opt/homelab/data/home/.openclaw/openclaw.json

# Edit config
podman unshare vi /opt/homelab/data/home/.openclaw/openclaw.json
```

### Key Paths
| What | Where |
|------|-------|
| Deployment files | `/opt/homelab/data/home/git/openclaw/` |
| Environment config | `/opt/homelab/data/home/git/openclaw/.env` |
| OpenClaw config | `/opt/homelab/data/home/.openclaw/openclaw.json` |
| Workspace | `/opt/homelab/data/home/.openclaw/workspace/` |
| Agent sessions | `/opt/homelab/data/home/.openclaw/agents/main/sessions/` |
| Gateway token | `bc39640f3817ccdc8974cec6f82f1e7d04a8723346c8bda2` |
| Gateway port | `18789` |

---

*Session completed 2026-02-10. Phase 1 gateway deployment successful. Phase 2 (API key + channels) deferred to next session.*
