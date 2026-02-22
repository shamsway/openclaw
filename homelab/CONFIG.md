# OpenClaw Config Management

## The Two Repos

| Repo | Purpose |
|---|---|
| `openclaw` (this repo) | Source code, Dockerfile, Nomad job template, ctl.sh |
| `openclaw-agents` (sibling) | Agent config files — the source of truth for what runs |

The Nomad job mounts config from **Ceph** (`/mnt/services/openclaw-gateway/`), not directly
from the git repo. `ctl.sh` bridges the gap.

---

## What Lives Where

### In git (`openclaw-agents`)

| Path | Description |
|---|---|
| `jerry/openclaw.json` | Gateway config — all agents, providers, tools, plugins |
| `jerry/mcporter.json` | MCP server URLs |
| `jerry/cron/jobs.json` | Cron job definitions (not run history) |
| `jerry/workspace/*.md` | Jerry's workspace files (TOOLS, SOUL, HEARTBEAT, etc.) |
| `bobby/workspace/*.md` | Bobby's workspace files |
| `billy/workspace/*.md` | Billy's workspace files |

### In Ceph only (runtime, never git)

| Path | Description |
|---|---|
| `config/agents/*/sessions/` | Session transcripts |
| `config/memory/*.sqlite` | Agent memory databases |
| `config/credentials/` | Discord/Slack pairing tokens |
| `config/devices/` | Paired device list |
| `config/identity/` | Device identity |
| `config/logs/` | Log files |
| `config/cron/runs/` | Cron run history |
| `config/delivery-queue/` | Failed message delivery queue |
| `*/workspace/.openclaw/` | Workspace runtime state |
| `*/workspace/memory/` | Workspace memory files (agent-written) |

---

## Workflows

### Editing config on the homelab

```
1. Edit files in openclaw-agents/ on the homelab
2. ./homelab/ctl.sh deploy-config       ← push to Ceph (hot-reloads openclaw.json)
3. [optional] ./homelab/ctl.sh restart  ← needed for tool/plugin changes only
4. cd ../openclaw-agents && git add -A && git commit
```

### Editing config on a remote workstation (MacBook, etc.)

```
1. Clone openclaw-agents on your workstation (or pull latest)
2. Edit files locally
3. git push
4. SSH to homelab:
   cd /opt/homelab/data/home/git/openclaw-agents && git pull
   cd /opt/homelab/data/home/git/openclaw
   ./homelab/ctl.sh deploy-config
   [optional] ./homelab/ctl.sh restart  ← if you changed tool/plugin config
```

### Pulling live changes back into git

Run this when you've made changes via the Web UI or container CLI and want to
persist them (e.g. after tweaking `openclaw.json` via the gateway UI, or after
agents modify workspace docs):

```
./homelab/ctl.sh sync-back
cd ../openclaw-agents && git diff   # review
git add -A && git commit -m 'sync: live config updates'
```

### Cron job changes

Cron jobs are managed via the CLI and stored in `config/cron/jobs.json` on Ceph.
After adding/editing/removing jobs, pull them into git with `sync-back` above.
**Do not** edit `jerry/cron/jobs.json` directly in git and deploy — you would
overwrite live job state (next run times, consecutive error counts, etc.).

---

## Ceph ↔ Git Mapping

```
Ceph path                                    Git path (openclaw-agents)
─────────────────────────────────────────    ──────────────────────────────────
/mnt/services/openclaw-gateway/config/
  openclaw.json                          ←→  jerry/openclaw.json
  mcporter.json                          ←→  jerry/mcporter.json
  cron/jobs.json                         ←→  jerry/cron/jobs.json

/mnt/services/openclaw-gateway/
  jerry-workspace/*.md                   ←→  jerry/workspace/*.md
  bobby-workspace/*.md                   ←→  bobby/workspace/*.md
  billy-workspace/*.md                   ←→  billy/workspace/*.md
```

---

## Hot-reload vs. Restart Required

| Change | Action needed |
|---|---|
| `openclaw.json` model/provider settings | Nothing — hot-reloads automatically |
| `openclaw.json` agent tool config | `ctl.sh restart` |
| `openclaw.json` plugin enable/disable | `ctl.sh restart` |
| `mcporter.json` MCP server URLs | `ctl.sh restart` |
| Workspace `.md` files | Nothing — agents read on next run |

---

## Environment Overrides

Both `deploy-config` and `sync-back` respect these env vars if the default paths
don't apply (e.g. when running from a non-standard layout):

| Variable | Default |
|---|---|
| `OPENCLAW_AGENTS_REPO` | `../openclaw-agents` (relative to openclaw repo) |
| `OPENCLAW_CEPH_BASE` | `/mnt/services/openclaw-gateway` |
