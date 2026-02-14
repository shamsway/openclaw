# Agent Permissions Design: 1Password Vault + GitHub Access

**Date:** 2026-02-14
**Status:** Approved
**Context:** OpenClaw gateway agents need secure, scoped access to secrets (API keys, tokens, certs) and GitHub repos (octant/openclaw orgs, private + public)

---

## Overview

This design establishes a permissions scheme for OpenClaw gateway agents using:
- **1Password Service Account** for centralized secret management
- **GitHub Fine-Grained Personal Access Token** for repo operations (read, write, PRs, issues)

The approach prioritizes simplicity and aligns with the current manual rotation model and single-gateway deployment.

---

## Requirements

**Agent context:**
- OpenClaw gateway agents (not Claude Code sessions or other AI tools)
- Single gateway host, multiple agents with shared credentials

**Secrets needed:**
- API keys and tokens (model providers, GitHub, npm, etc.)
- Certificates and keys as needed (SSH, TLS, signing certs)

**GitHub operations:**
- Push commits, create PRs, manage issues
- Access private repos in octant and openclaw orgs
- Eventually: some public repos

**Lifecycle:**
- Manual credential rotation (automated rotation out of scope for now)
- Startup-time secret injection (no runtime refresh needed initially)

---

## Design: 1Password Service Account + Fine-Grained PAT

### Approach

**1Password side:**
- Create a dedicated vault: `OpenClaw Agents`
- Create a 1Password Service Account with read-only access to that vault
- Agents access secrets via `op` CLI using the service account token (`OP_SERVICE_ACCOUNT_TOKEN` env var)
- No desktop app unlock required — service accounts are designed for machine access

**GitHub side:**
- Create a fine-grained Personal Access Token scoped to specific repos (octant/openclaw orgs)
- Grant permissions: Contents (R/W), Issues (R/W), Pull Requests (R/W), Metadata (R), Commit statuses (R/W), Workflows (R/W - optional)
- Store the PAT in the 1Password vault
- Agents retrieve it at runtime via `op read`

**Rationale:**
- Simple setup, good security posture, straightforward manual rotation
- Fine-grained PATs provide per-repo scoping without GitHub App complexity
- Clear upgrade path: swap PAT for GitHub App later if action attribution or automated rotation becomes needed
- Leverages existing `op` CLI integration in the openclaw codebase (1Password skill)

---

## 1Password Vault Structure

```
Vault: "OpenClaw Agents"
├── GitHub PAT           (type: API Credential)
│   ├── token            (the fine-grained PAT value)
│   ├── username         (GitHub username)
│   └── notes            (scope/expiry/repos covered)
├── Anthropic API Key    (type: API Credential)
├── OpenAI API Key       (type: API Credential)
└── [future certs/keys as needed]
```

**Service account:**
- Name: `openclaw-gateway`
- Access: **read-only** to `OpenClaw Agents` vault only
- Service account token is the one secret stored on-host (in env or systemd config)
- All other secrets retrieved at runtime via `op read 'op://OpenClaw Agents/<item>/<field>'`

**Key constraint:** Service accounts are read-only — they can't create/modify vault items. Vault contents managed from 1Password desktop/web app.

---

## GitHub Fine-Grained PAT Configuration

**Token creation** (at github.com/settings/personal-access-tokens):

- **Name:** `openclaw-gateway-agents`
- **Expiration:** 90 days (shorter interval for manual rotation — email reminders before expiry)
- **Resource owner:** Personal account (or org if repos are org-owned)
- **Repository access:** "Only select repositories" — specific octant and openclaw repos

**Permissions:**

| Category | Permission | Level | Rationale |
|----------|-----------|-------|-----------|
| Contents | Read and write | Repo | Clone, read files, push commits |
| Issues | Read and write | Repo | Create/comment/close issues |
| Pull requests | Read and write | Repo | Create/review/merge PRs |
| Metadata | Read-only | Repo | Required baseline for all tokens |
| Commit statuses | Read and write | Repo | Post status checks if needed |
| Workflows | Read and write | Repo | Trigger/manage GitHub Actions (optional) |

**Intentionally excluded:** Admin, settings, secrets, deploy keys, environments, pages (agents don't need repo administration)

**Storage in 1Password:**
- Item name: `GitHub PAT - Gateway Agents`
- Fields: `token` (PAT value), `username`, `expiry` (date), `repos` (comma-separated list in notes)
- Rotation: update token field in 1Password, agents pick it up on next gateway restart

**Runtime retrieval:**
```bash
op read 'op://OpenClaw Agents/GitHub PAT - Gateway Agents/token'
```

---

## Agent Runtime Integration

### Credential Injection Pattern

The gateway process sets `OP_SERVICE_ACCOUNT_TOKEN` in its environment (the one on-host secret). Agents retrieve individual secrets on demand:

```bash
# GitHub — used by gh CLI and git operations
export GH_TOKEN="$(op read 'op://OpenClaw Agents/GitHub PAT - Gateway Agents/token')"

# Model provider keys
export ANTHROPIC_API_KEY="$(op read 'op://OpenClaw Agents/Anthropic API Key/credential')"
export OPENAI_API_KEY="$(op read 'op://OpenClaw Agents/OpenAI API Key/credential')"
```

### Integration Options

**Option A — Startup injection (selected):**
- Wrapper script or systemd `ExecStartPre` fetches all secrets at gateway launch
- Secrets exported as env vars, live in memory for process lifetime
- Simple, requires gateway restart to pick up rotated credentials
- Aligns with manual rotation model and Terraform deployment patterns

**Option B — On-demand reads:**
- Agents call `op read` each time they need a credential
- Always fresh, no restart needed after rotation
- Slightly slower (CLI invocation per read), but `op` caches session
- Adds `op` CLI dependency to every agent subprocess

**Selected approach:** Option A (startup injection) for simplicity and operational alignment.

### On-Host Secret Storage

`OP_SERVICE_ACCOUNT_TOKEN` (the one secret NOT in vault) stored in:
- systemd unit file (`Environment=` or `EnvironmentFile=`)
- `~/.profile` on gateway host
- Dotenv file with `600` permissions

This is the "root of trust" — anyone with this token can read the vault. Protect accordingly.

### Agent Abstraction

Agents receive `GH_TOKEN`, `ANTHROPIC_API_KEY`, etc. as normal environment variables. No 1Password awareness needed in agent code — abstraction is at the gateway startup layer.

---

## Security Posture & Threat Model

### What You're Protecting

- GitHub write access to private repos (octant, openclaw orgs)
- Model provider API keys (cost/quota/data access)
- Future: SSH keys, TLS certs, deployment credentials

### Attack Surface

**1. Service account token compromise**
If `OP_SERVICE_ACCOUNT_TOKEN` leaks, attacker has read access to entire `OpenClaw Agents` vault.
**Mitigation:** Treat like root password — store with `600` permissions, never commit, rotate if exposed.

**2. Gateway host compromise**
If the host is compromised, attacker gets all secrets injected at startup (in memory).
**Mitigation:** Standard host hardening (SSH keys only, fail2ban, minimal attack surface, keep packages updated).

**3. GitHub PAT compromise**
If PAT leaks, attacker can push to repos.
**Mitigation:** Fine-grained scope (only needed repos), 90-day expiry, GitHub email before expiry. Revoke immediately if compromised, rotate in 1Password.

**4. Agent tool abuse**
Malicious actor using allowed channel could instruct agent to exfiltrate secrets.
**Mitigation:** Channel allowlists, DM pairing, tool policies (no arbitrary `exec` without approval), audit logging.

### Audit Trail

- **1Password activity log:** Shows who/what accessed vault (service account reads)
- **GitHub audit log:** Shows all actions by PAT (commits, PRs, issue comments)
- **OpenClaw security audit:** Run `openclaw security audit` to check gateway config for misconfigurations

### Rotation Procedure

1. Generate new GitHub PAT with same scope
2. Update token field in 1Password (`GitHub PAT - Gateway Agents`)
3. Restart gateway (picks up new value at startup)
4. Revoke old PAT in GitHub settings
5. Document rotation date in 1Password item notes

### What's NOT Protected

- Secrets used by non-agent processes (personal dev work) — stay in personal 1Password or `~/.profile`
- Multi-tenant isolation — all agents on gateway share same credentials. Per-agent scoping would require multiple service accounts + vaults.

### Accepted Risks

These risks align with current lab environment posture:
- Shared credentials across all gateway agents
- Startup-time injection (no runtime refresh)
- Manual rotation workflow
- Single point of compromise (service account token on-host)

Future hardening (out of scope): internal honeypot for lateral movement detection, automated rotation, per-agent credential scoping.

---

## Implementation Checklist

### 1Password Setup
- [ ] Create vault: `OpenClaw Agents`
- [ ] Create service account: `openclaw-gateway` (read-only to that vault)
- [ ] Store service account token securely on gateway host

### GitHub Setup
- [ ] Create fine-grained PAT: specific octant/openclaw repos, Contents R/W, Issues R/W, PRs R/W, Metadata R, Commit statuses R/W, Workflows R/W (optional)
- [ ] Set expiration: 90 days
- [ ] Store in 1Password vault as `GitHub PAT - Gateway Agents`

### Vault Population
- [ ] Add GitHub PAT item (token, username, expiry, repos in notes)
- [ ] Add Anthropic API Key item
- [ ] Add OpenAI API Key item
- [ ] Add other API keys/certs as needed

### Gateway Integration
- [ ] Add `OP_SERVICE_ACCOUNT_TOKEN` to gateway's systemd unit or environment file
- [ ] Create startup wrapper script: calls `op read` for each secret, exports env vars
- [ ] Update systemd `ExecStartPre=` to run wrapper (or fold into `ExecStart=`)
- [ ] Restart gateway to pick up new credential flow

### Verification
- [ ] Confirm `gh auth status` shows authenticated with PAT
- [ ] Test: agent creates issue in test repo
- [ ] Test: agent pushes commit to test branch
- [ ] Run `openclaw security audit --deep` to check for misconfigurations

### Documentation
- [ ] Document rotation procedure (PAT location in 1Password, gateway restart steps)
- [ ] Add expiry reminder to calendar (85 days from PAT creation)

---

## Future Enhancements

As 1Password's DevOps capabilities evolve, consider:
- **1Password Connect Server** for API-based access (no `op` CLI dependency)
- **Automated rotation** via 1Password Secrets Automation
- **Per-agent service accounts** for multi-tenant isolation
- **GitHub App** instead of PAT for action attribution and short-lived tokens
- **Audit log aggregation** (1Password + GitHub + OpenClaw logs)

---

## References

- OpenClaw 1Password skill: `/home/matt/git/shamsway/openclaw/skills/1password/SKILL.md`
- OpenClaw security docs: `/home/matt/git/shamsway/openclaw/docs/gateway/security/index.md`
- GitHub fine-grained PAT docs: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens
- 1Password Service Accounts: https://developer.1password.com/docs/service-accounts/
