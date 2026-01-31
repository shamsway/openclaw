# Podman Setup Instructions

## The Permission Issue

**Root Cause:** Podman rootless mode uses user namespaces where container UIDs are mapped to host subuids. The container runs as UID 1000 (`node` user), but your host directories are owned by UID 2000 (`hashi` user). This causes permission denied errors when the container tries to write to bind-mounted volumes.

## Solution: Use `podman unshare`

The `podman unshare` command runs commands in Podman's user namespace, allowing us to create directories with the correct subuid ownership that the container can access.

## Step-by-Step Setup

### 1. Fix Permissions First

```bash
# Run the permission fix script
./fix-podman-permissions.sh
```

This script:
- Removes any existing `.clawdbot` and `clawd` directories
- Creates new directories using `podman unshare`
- Sets ownership to UID 1000 (mapped to container's `node` user)

### 2. Run Podman Setup

```bash
./podman-setup.sh
```

### 3. **IMPORTANT: Paths to Use During Onboarding**

When the onboarding wizard asks for paths, use the **CONTAINER paths**, not host paths:

| Question | Use This Path | NOT This |
|----------|---------------|----------|
| Config directory | `/home/node/.clawdbot` (default) | `/opt/homelab/data/home/.clawdbot` |
| Workspace directory | `/home/node/clawd` (default) | `/opt/homelab/data/home/clawd` |

**Just press Enter to accept the defaults - they're already correct!**

### Volume Mapping Reference

```
Host Path                              → Container Path
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
/opt/homelab/data/home/.clawdbot       → /home/node/.clawdbot
/opt/homelab/data/home/clawd           → /home/node/clawd
```

The container **only sees** the container paths. It doesn't know about the host paths.

## Why This Works

1. **`podman unshare`** runs commands in Podman's user namespace
2. Inside that namespace, UID 1000 corresponds to your host user's subuids
3. When we `chown 1000:1000` inside `podman unshare`, the files become accessible to the container's UID 1000
4. From the host's perspective, these files appear owned by a subuid (not your user), but the container can read/write them

## Verification

After successful setup:

```bash
# Check container can read/write
podman-compose run --rm moltbot-cli sh -c "
  ls -la /home/node/.clawdbot &&
  touch /home/node/.clawdbot/test.txt &&
  rm /home/node/.clawdbot/test.txt &&
  echo 'Permissions OK'
"

# Check from host (will show subuid ownership)
ls -la /opt/homelab/data/home/.clawdbot
```

From the host, you'll see files owned by a high UID (like `165536` or similar) - this is **normal** for Podman rootless. The container sees these as owned by UID 1000.

## Troubleshooting

### Error: "permission denied" during onboarding

1. Verify you ran `fix-podman-permissions.sh` first
2. Check directories exist with subuid ownership:
   ```bash
   ls -la /opt/homelab/data/home/.clawdbot
   ls -la /opt/homelab/data/home/clawd
   ```
   You should see a high UID (not 2000)

3. Re-run the fix script:
   ```bash
   ./fix-podman-permissions.sh
   ./podman-setup.sh
   ```

### Error: Wrong path entered during onboarding

If you accidentally entered host paths instead of container paths:
1. Stop any running containers: `podman-compose down`
2. Re-run fix script: `./fix-podman-permissions.sh`
3. Start setup again: `./podman-setup.sh`
4. Use container paths this time: `/home/node/.clawdbot` and `/home/node/clawd`

### Can't access files from host

This is normal with Podman rootless. Files created by the container will have subuid ownership. To access them from the host:

```bash
# Read files using podman unshare
podman unshare cat /opt/homelab/data/home/.clawdbot/moltbot.json

# Or access via container
podman-compose run --rm moltbot-cli cat /home/node/.clawdbot/moltbot.json
```

## Alternative: Docker-style Permissions (Not Recommended)

If you want host-owned files instead, you could:
1. Change container user to match host UID
2. Rebuild image with `USER 2000`
3. But this breaks Node.js paths and creates other issues

The `podman unshare` approach is the proper Podman way.

## Reference

- Your UID: `2000` (hashi)
- Container UID: `1000` (node)
- Podman maps container UID 1000 to host subuid range
- Files appear as high UIDs from host, but UID 1000 from container
