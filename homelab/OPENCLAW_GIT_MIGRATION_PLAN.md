# .openclaw → Git Repo Migration Plan

Generated: 2026-02-12

## Current State

```
~/.openclaw/
├── agents/
│   └── main/
│       ├── agent/        # runtime state (volatile)
│       └── sessions/     # session JSONL logs + sessions.json (large, volatile)
├── canvas/               # generated index.html
├── credentials/          # SECRETS — API keys/tokens (mode 600)
├── cron/
│   ├── jobs.json
│   └── jobs.json.bak
├── devices/
│   ├── paired.json
│   └── pending.json
├── exec-approvals.json
├── identity/
│   ├── device-auth.json  # auth token (SENSITIVE)
│   └── device.json       # device identity
├── openclaw.json         # main config (check for embedded secrets)
├── openclaw.json.bak*    # auto-backups (noisy)
├── update-check.json     # ephemeral cache
└── workspace/            # ← ALREADY a local git repo (no remote yet)
    ├── .git/
    ├── AGENTS.md
    ├── HEARTBEAT.md
    ├── IDENTITY.md
    ├── SOUL.md
    ├── TOOLS.md
    ├── USER.md
    └── memory/
        └── 2026-02-11.md
```

## Two-Repo Strategy

### Repo 1: `openclaw-workspace` (HIGH PRIORITY)
The `workspace/` dir is already a local git repo. Push it to GitHub first — this is
the most valuable content (agent identity, memory, personality).

```bash
git -C ~/.openclaw/workspace remote add origin git@github.com:YOURUSER/openclaw-workspace.git
git -C ~/.openclaw/workspace push -u origin main
```

Keep this as a **separate** repo (not a submodule of the config repo). It has its own
identity and may be shared or promoted independently.

### Repo 2: `openclaw-config` (OPTIONAL)
A separate private repo for portable config snapshots. Useful when setting up new
agent nodes from scratch.

```bash
git -C ~/.openclaw init -b main
# Create .gitignore (see below)
git -C ~/.openclaw add openclaw.json cron/jobs.json devices/paired.json exec-approvals.json .gitignore
git -C ~/.openclaw commit -m "Initial config snapshot"
git -C ~/.openclaw remote add origin git@github.com:YOURUSER/openclaw-config.git
git -C ~/.openclaw push -u origin main
```

## Recommended .gitignore (for openclaw-config repo)

```gitignore
# === SECRETS — never commit ===
credentials/
identity/

# === Volatile / ephemeral ===
update-check.json
openclaw.json.bak*

# === Session logs (large, not useful in git) ===
agents/*/sessions/
agents/*/agent/

# === Generated ===
canvas/

# === workspace is its own repo ===
workspace/
```

## Before Committing openclaw.json

Inspect for embedded secrets before pushing:

```bash
# Check keys — look for anything that looks like a token/key/password
python3 -c "import json; d=json.load(open('openclaw.json')); print(list(d.keys()))"
```

If tokens/keys are present:
- Option A: strip them from the committed file (store in .env / 1Password instead)
- Option B: use `git-crypt` to encrypt sensitive files at rest
- Option C: only commit a `openclaw.json.example` template with placeholders

## For Other Agents (future nodes)

Each agent gets its own `workspace/` repo (different identity/memory). The config
repo (`openclaw-config`) can be shared if configs are identical, or per-agent if
they diverge. Suggested naming:

- `openclaw-workspace-jerry`   (this agent, Octant node)
- `openclaw-workspace-<name>`  (future agents)
- `openclaw-config`            (shared config template, or per-node if different)

## Commit Cadence

`workspace/` changes frequently (memory notes, identity updates). Consider:
- Auto-commit via a cron job: `openclaw cron add "commit workspace" ...`
- Or a post-session hook that commits + pushes
- Manual: commit after meaningful sessions

`openclaw.json` changes rarely. Commit manually after significant config changes.

---

## UID/GID Fix (Podman — see below)

The `.openclaw` files are currently owned by uid=100999 (container's node user
remapped through the rootless subuid range). This makes host-side management
(git operations, chown, etc.) painful. See the companion section in
HOMELAB_DEPLOYMENT_NOTES.md or the PR for the Dockerfile/compose fix.
