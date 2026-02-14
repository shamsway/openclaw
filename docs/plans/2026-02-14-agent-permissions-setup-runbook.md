# Agent Permissions Setup Runbook

> **Companion to:** `docs/plans/2026-02-14-agent-permissions-design.md`

**Goal:** Operational guide for setting up 1Password vault + GitHub PAT for OpenClaw gateway agents

**Prerequisites:**
- 1Password account with vault creation permissions
- 1Password CLI (`op`) installed and configured on your local machine
- GitHub account with access to target repos (octant/openclaw orgs)
- Access to the gateway host (SSH or direct)

---

## Part 1: 1Password Vault Setup

### Step 1: Create the vault

**Via 1Password Desktop/Web:**

1. Open 1Password (desktop app or web at https://my.1password.com)
2. Click **Vaults** in sidebar
3. Click **+ New Vault**
4. Name: `OpenClaw Agents`
5. Description: `Secrets for OpenClaw gateway agents (service account read-only access)`
6. Click **Create Vault**

**Verification:**
```bash
op vault list | grep "OpenClaw Agents"
```
Expected output: Shows the vault in the list

---

### Step 2: Create service account

**Via 1Password Web (service accounts require web interface):**

1. Go to https://my.1password.com
2. Click your account name (top-right) → **Developer Tools** → **Service Accounts**
3. Click **Create Service Account**
4. Name: `openclaw-gateway`
5. Description: `Read-only access to OpenClaw Agents vault for gateway runtime`
6. Click **Create**

**Grant vault access:**

1. On the service account details page, click **Grant Access to a Vault**
2. Select vault: `OpenClaw Agents`
3. Set permissions: **View items** (read-only)
4. Click **Grant Access**

**Save the token:**

1. Copy the service account token (starts with `ops_...`)
2. **CRITICAL:** Store this token securely — you can't retrieve it again
3. Recommended temporary storage: In your **personal** 1Password vault (not the agent vault) as `OP_SERVICE_ACCOUNT_TOKEN - openclaw-gateway`

**Verification:**
```bash
# Test the service account token
export OP_SERVICE_ACCOUNT_TOKEN="ops_..."  # paste the token
op vault list
```
Expected output: Shows vaults accessible to the service account (only `OpenClaw Agents` should be listed)

---

## Part 2: GitHub Fine-Grained PAT Setup

### Step 3: Create GitHub fine-grained personal access token

**Via GitHub Web:**

1. Go to https://github.com/settings/personal-access-tokens/new
2. Fill in the form:

**Token name:** `openclaw-gateway-agents`

**Description:**
```
Fine-grained PAT for OpenClaw gateway agents. Scoped to octant/openclaw repos.
Permissions: Contents R/W, Issues R/W, PRs R/W, Metadata R, Commit statuses R/W, Workflows R/W.
Created: 2026-02-14
Rotation: Every 90 days
```

**Expiration:** 90 days (select custom date 90 days from today)

**Resource owner:** Select your personal account (or the org if repos are org-owned)

**Repository access:** Only select repositories

Click **Select repositories** and choose:
- All octant org repos you need (e.g., `octant/octant`, `octant/...`)
- All openclaw org repos you need (e.g., `openclaw/openclaw`, `openclaw/...`)

**Permissions (Repository permissions section):**

| Category | Permission | Access |
|----------|-----------|--------|
| Actions | (optional) | Read and write |
| Commit statuses | Required | Read and write |
| Contents | Required | Read and write |
| Issues | Required | Read and write |
| Metadata | Required | Read-only (auto-selected) |
| Pull requests | Required | Read and write |
| Workflows | Optional | Read and write |

3. Scroll to bottom and click **Generate token**
4. **Copy the token** (starts with `github_pat_...`) — you can't retrieve it again

**Verification:**
```bash
# Test the PAT
export GH_TOKEN="github_pat_..."  # paste the token
gh auth status
```
Expected output: Shows "Logged in to github.com account [your-username] (keyring)"

```bash
# Test repo access
gh repo list openclaw --limit 5
```
Expected output: Lists openclaw repos you have access to

---

## Part 3: Populate 1Password Vault

### Step 4: Add GitHub PAT to vault

**Via 1Password Desktop/Web:**

1. Open the `OpenClaw Agents` vault
2. Click **+ New Item**
3. Type: **API Credential**
4. Fill in fields:

**Title:** `GitHub PAT - Gateway Agents`

**Fields:**
- **username:** `[your-github-username]`
- **credential:** `github_pat_...` (paste the PAT from Step 3)

**In the Notes section, add:**
```
Scope: octant/*, openclaw/* repos
Permissions: Contents R/W, Issues R/W, PRs R/W, Metadata R, Commit statuses R/W, Workflows R/W
Created: 2026-02-14
Expires: [90 days from creation date]
Repos: [comma-separated list of repo names, e.g., openclaw/openclaw, octant/octant]
```

5. Click **Save**

**Verification:**
```bash
# Using the service account token from Step 2
export OP_SERVICE_ACCOUNT_TOKEN="ops_..."
op read 'op://OpenClaw Agents/GitHub PAT - Gateway Agents/credential'
```
Expected output: Prints the GitHub PAT

---

### Step 5: Add model provider API keys

**Anthropic API Key:**

1. In the `OpenClaw Agents` vault, click **+ New Item**
2. Type: **API Credential**
3. Title: `Anthropic API Key`
4. credential field: `[your-anthropic-api-key]`
5. Notes: `Used by OpenClaw gateway agents for Claude models`
6. Click **Save**

**OpenAI API Key:**

1. In the `OpenClaw Agents` vault, click **+ New Item**
2. Type: **API Credential**
3. Title: `OpenAI API Key`
4. credential field: `[your-openai-api-key]`
5. Notes: `Used by OpenClaw gateway agents for GPT models`
6. Click **Save**

**Add other keys as needed** (npm tokens, deployment creds, etc.)

**Verification:**
```bash
# Using the service account token
export OP_SERVICE_ACCOUNT_TOKEN="ops_..."

# Test each credential
op read 'op://OpenClaw Agents/Anthropic API Key/credential'
op read 'op://OpenClaw Agents/OpenAI API Key/credential'
```
Expected output: Each command prints the corresponding API key

---

## Part 4: Gateway Host Configuration

### Step 6: Store service account token on gateway host

**Option A: Environment file (recommended for systemd)**

SSH to the gateway host and create an environment file:

```bash
# On gateway host
sudo mkdir -p /etc/openclaw
sudo touch /etc/openclaw/secrets.env
sudo chmod 600 /etc/openclaw/secrets.env
sudo chown root:root /etc/openclaw/secrets.env
```

Edit the file:
```bash
sudo nano /etc/openclaw/secrets.env
```

Add:
```bash
OP_SERVICE_ACCOUNT_TOKEN=ops_...
```

Save and exit.

**Option B: User profile (for non-systemd deployments)**

SSH to the gateway host and edit `~/.profile` (or `~/.bash_profile`):

```bash
# On gateway host
nano ~/.profile
```

Add at the end:
```bash
# 1Password service account for OpenClaw agents
export OP_SERVICE_ACCOUNT_TOKEN="ops_..."
```

Save, exit, and source:
```bash
source ~/.profile
```

**Verification:**
```bash
# On gateway host (new shell session if using Option B)
op vault list
```
Expected output: Shows `OpenClaw Agents` vault

---

### Step 7: Create startup wrapper script

**Create the script:**

SSH to the gateway host and create the wrapper:

```bash
# On gateway host
sudo mkdir -p /usr/local/bin
sudo nano /usr/local/bin/openclaw-inject-secrets.sh
```

Paste the following:

```bash
#!/usr/bin/env bash
set -euo pipefail

# Wrapper script to inject secrets from 1Password into OpenClaw gateway environment
# Requires: OP_SERVICE_ACCOUNT_TOKEN set in environment (systemd unit or ~/.profile)

echo "[openclaw-inject-secrets] Fetching secrets from 1Password..."

# GitHub PAT
export GH_TOKEN
GH_TOKEN="$(op read 'op://OpenClaw Agents/GitHub PAT - Gateway Agents/credential')"
echo "[openclaw-inject-secrets] ✓ GH_TOKEN loaded"

# Anthropic API Key
export ANTHROPIC_API_KEY
ANTHROPIC_API_KEY="$(op read 'op://OpenClaw Agents/Anthropic API Key/credential')"
echo "[openclaw-inject-secrets] ✓ ANTHROPIC_API_KEY loaded"

# OpenAI API Key
export OPENAI_API_KEY
OPENAI_API_KEY="$(op read 'op://OpenClaw Agents/OpenAI API Key/credential')"
echo "[openclaw-inject-secrets] ✓ OPENAI_API_KEY loaded"

# Add more secrets here as needed:
# export NPM_TOKEN
# NPM_TOKEN="$(op read 'op://OpenClaw Agents/NPM Token/credential')"
# echo "[openclaw-inject-secrets] ✓ NPM_TOKEN loaded"

echo "[openclaw-inject-secrets] All secrets loaded successfully"

# Execute the actual gateway command (passed as arguments to this script)
exec "$@"
```

Save, exit, and make executable:
```bash
sudo chmod +x /usr/local/bin/openclaw-inject-secrets.sh
```

**Verification:**
```bash
# On gateway host
# Test the script with a dummy command
sudo -E /usr/local/bin/openclaw-inject-secrets.sh env | grep -E '(GH_TOKEN|ANTHROPIC_API_KEY|OPENAI_API_KEY)'
```
Expected output: Shows the three env vars with values (secrets will be visible)

---

### Step 8: Update gateway startup configuration

**For systemd deployments:**

Edit the systemd unit file:

```bash
# On gateway host
sudo systemctl edit --full openclaw-gateway.service
```

**Option A: Use EnvironmentFile + wrapper**

```ini
[Unit]
Description=OpenClaw Gateway
After=network.target

[Service]
Type=simple
User=openclaw
Group=openclaw
EnvironmentFile=/etc/openclaw/secrets.env
ExecStart=/usr/local/bin/openclaw-inject-secrets.sh openclaw gateway run --bind loopback --port 18789
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-tier.target
```

**Option B: Use ExecStartPre to source secrets, then run gateway**

```ini
[Unit]
Description=OpenClaw Gateway
After=network.target

[Service]
Type=simple
User=openclaw
Group=openclaw
EnvironmentFile=/etc/openclaw/secrets.env
ExecStartPre=/usr/local/bin/openclaw-inject-secrets.sh /bin/true
ExecStart=openclaw gateway run --bind loopback --port 18789
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-tier.target
```

**Note:** Option A is simpler — the wrapper script directly execs the gateway command.

Save, reload, and restart:
```bash
sudo systemctl daemon-reload
sudo systemctl restart openclaw-gateway.service
sudo systemctl status openclaw-gateway.service
```

**For manual/tmux/nohup deployments:**

Wrap your existing command:

```bash
# Old command:
# nohup openclaw gateway run --bind loopback --port 18789 > /tmp/openclaw-gateway.log 2>&1 &

# New command:
source ~/.profile  # if using Option B from Step 6
nohup /usr/local/bin/openclaw-inject-secrets.sh openclaw gateway run --bind loopback --port 18789 > /tmp/openclaw-gateway.log 2>&1 &
```

**Verification:**
```bash
# Check gateway logs for secret injection messages
sudo journalctl -u openclaw-gateway.service -n 50 | grep openclaw-inject-secrets

# Or for manual deployments:
tail -n 50 /tmp/openclaw-gateway.log | grep openclaw-inject-secrets
```
Expected output: Shows the "✓ loaded" messages for each secret

---

## Part 5: Verification & Testing

### Step 9: Verify GitHub authentication

**Test gh CLI:**

```bash
# On gateway host (as the gateway user)
gh auth status
```
Expected output: Shows authenticated as your GitHub username

**Test git operations:**

```bash
# On gateway host
cd /tmp
git clone https://github.com/openclaw/openclaw.git test-clone
```
Expected output: Clone succeeds (public repo test)

For private repo:
```bash
git clone https://github.com/octant/[private-repo].git test-private-clone
```
Expected output: Clone succeeds

Clean up:
```bash
rm -rf /tmp/test-clone /tmp/test-private-clone
```

---

### Step 10: Test agent operations

**Test: Agent creates an issue**

Via OpenClaw gateway (from your messaging interface):

Send message to agent:
```
Create a test issue in openclaw/openclaw repo titled "Test: Agent GitHub Access" with body "Verifying agent can create issues via PAT"
```

Expected: Agent creates the issue successfully. Verify at https://github.com/openclaw/openclaw/issues

**Test: Agent pushes a commit**

Send message to agent:
```
In a test branch, create a file test-agent-access.txt with content "Agent GitHub access verified" and push to openclaw/openclaw
```

Expected: Agent creates branch, commits file, pushes successfully. Verify at https://github.com/openclaw/openclaw/branches

**Test: Agent creates a PR**

Send message to agent:
```
Create a PR from the test branch to main with title "Test: Agent PR Creation"
```

Expected: PR created successfully. Close/delete the PR and branch after verification.

---

### Step 11: Security audit

Run the OpenClaw security audit:

```bash
# On gateway host (or via gateway command if accessible remotely)
openclaw security audit --deep
```

Expected output: No critical issues related to:
- Channel allowlists
- Tool policies
- Exec approval mode
- File permissions on config files

If issues found, run:
```bash
openclaw security audit --fix
```

Review the changes and re-run the audit.

---

## Part 6: Documentation & Maintenance

### Step 12: Document the setup

Create a local runbook for your team (this can live in your internal wiki/docs):

**Required info:**
- Location of `OP_SERVICE_ACCOUNT_TOKEN` on gateway host (`/etc/openclaw/secrets.env` or `~/.profile`)
- 1Password vault name (`OpenClaw Agents`)
- GitHub PAT item name in vault (`GitHub PAT - Gateway Agents`)
- Gateway restart procedure (systemd command or manual kill/restart)
- Rotation schedule (90 days for GitHub PAT)

**Example internal doc:**

```markdown
# OpenClaw Agent Credentials

**1Password Vault:** `OpenClaw Agents`
**Service Account:** `openclaw-gateway` (read-only)
**GitHub PAT:** Stored as `GitHub PAT - Gateway Agents` in vault

## Locations
- Service account token: `/etc/openclaw/secrets.env` on gateway host
- Wrapper script: `/usr/local/bin/openclaw-inject-secrets.sh`
- Systemd unit: `/etc/systemd/system/openclaw-gateway.service`

## Restart Gateway
```bash
ssh gateway-host
sudo systemctl restart openclaw-gateway.service
sudo systemctl status openclaw-gateway.service
```

## Rotation (every 90 days)
1. Create new GitHub PAT (same scope)
2. Update `GitHub PAT - Gateway Agents` credential field in 1Password
3. Restart gateway
4. Revoke old PAT in GitHub settings
5. Update "Created" date in 1Password item notes
```

---

### Step 13: Set rotation reminder

Add a calendar event 85 days from today (5 days before the 90-day expiry):

**Event title:** Rotate OpenClaw GitHub PAT
**Date:** [85 days from PAT creation]
**Description:**
```
1. Go to https://github.com/settings/personal-access-tokens/new
2. Create new PAT with same scope as "openclaw-gateway-agents"
3. Update credential in 1Password: "OpenClaw Agents" vault → "GitHub PAT - Gateway Agents"
4. SSH to gateway and restart: sudo systemctl restart openclaw-gateway.service
5. Revoke old PAT in GitHub settings
6. Update notes in 1Password item with new creation date
7. Set new reminder for 85 days from today
```

---

## Troubleshooting

### Issue: `op read` fails with "vault not found"

**Check:**
1. Verify service account has access to the vault:
   ```bash
   export OP_SERVICE_ACCOUNT_TOKEN="ops_..."
   op vault list
   ```
2. Ensure vault name is exact (case-sensitive): `OpenClaw Agents`

### Issue: GitHub PAT doesn't work for private repos

**Check:**
1. Verify PAT scope includes the specific repos:
   ```bash
   export GH_TOKEN="github_pat_..."
   gh repo list openclaw --limit 10
   ```
2. Check PAT hasn't expired: https://github.com/settings/tokens
3. Verify permissions include "Contents: Read and write"

### Issue: Gateway doesn't have secrets in environment

**Check:**
1. Verify wrapper script is being called:
   ```bash
   sudo journalctl -u openclaw-gateway.service -n 100 | grep openclaw-inject-secrets
   ```
2. Check systemd unit has `EnvironmentFile=/etc/openclaw/secrets.env`
3. Verify `/etc/openclaw/secrets.env` has correct permissions (600) and contains `OP_SERVICE_ACCOUNT_TOKEN`

### Issue: Service account token won't authenticate

**Check:**
1. Token format: should start with `ops_`
2. Token not expired (service account tokens don't expire, but can be revoked)
3. Verify in 1Password web UI that service account still exists and has vault access

---

## Security Checklist

After setup, verify:

- [ ] `/etc/openclaw/secrets.env` has permissions `600` (or `~/.profile` is user-only)
- [ ] Service account token (`ops_...`) is not committed to git
- [ ] GitHub PAT is not logged anywhere (check `/tmp/openclaw-gateway.log` or systemd logs)
- [ ] Gateway host has SSH key-only access (no password auth)
- [ ] Channel allowlists configured (run `openclaw security audit`)
- [ ] Tool policies prevent arbitrary `exec` without approval
- [ ] Calendar reminder set for PAT rotation (85 days)

---

## Next Steps

Once this runbook is validated:
1. Consider creating helper scripts for rotation automation
2. Review existing octant tools/scripts for integration opportunities
3. Add audit log aggregation (1Password + GitHub + OpenClaw logs)
4. Evaluate 1Password Connect Server for containerized deployments

---

## References

- Design doc: `docs/plans/2026-02-14-agent-permissions-design.md`
- 1Password CLI: https://developer.1password.com/docs/cli/
- 1Password Service Accounts: https://developer.1password.com/docs/service-accounts/
- GitHub Fine-Grained PATs: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens
- OpenClaw security docs: `docs/gateway/security/index.md`
