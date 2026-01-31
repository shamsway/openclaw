# Podman Permission Issue Fix

## Problem

When running `podman-setup.sh`, the onboarding process failed with:

```
Error: EACCES: permission denied, mkdir '/home/node/.clawdbot/agents/main/agent'
exit code: 1
```

## Root Cause

**UID/GID Mismatch between Host and Container:**

- Host user UID: `2000` (hashi)
- Container `node` user UID: `1000`

In Podman rootless mode, bind-mounted volumes retain host permissions. When the container tries to write to `/home/node/.clawdbot` (mounted from host `$HOME/.clawdbot`), the container's UID 1000 doesn't match the host directory owner (UID 2000), causing permission denied errors.

## Solution

Created `docker-compose.podman.yml` with Podman-specific user namespace mapping:

```yaml
services:
  moltbot-gateway:
    userns_mode: "keep-id:uid=1000,gid=1000"

  moltbot-cli:
    userns_mode: "keep-id:uid=1000,gid=1000"
```

This tells Podman to:
1. Map the host user (UID 2000) to the container's `node` user (UID 1000)
2. Keep file ownership consistent between host and container

## Changes Made

1. **Created:** `docker-compose.podman.yml` - Podman-specific user namespace settings
2. **Modified:** `podman-setup.sh` - Now includes the Podman override file automatically

## How to Retry

1. **Clean up partial config:**
   ```bash
   rm -rf "$HOME/.clawdbot/agents"
   rm -rf "$HOME/clawd"
   mkdir -p "$HOME/.clawdbot"
   mkdir -p "$HOME/clawd"
   ```

2. **Run setup again:**
   ```bash
   ./podman-setup.sh
   ```

The `userns_mode: keep-id` setting will now ensure proper permissions.

## Verification

After successful setup, verify permissions:

```bash
# Check that directories were created
ls -la "$HOME/.clawdbot/agents"

# Check container can write
podman-compose run --rm moltbot-cli sh -c "touch /home/node/.clawdbot/test.txt && rm /home/node/.clawdbot/test.txt && echo 'Permissions OK'"
```

## Technical Details

### Podman Rootless User Namespaces

Podman rootless mode runs containers in user namespaces where:
- Container UID 0 (root) maps to host user UID (2000)
- Container UID 1000 (node) maps to host subuid range

Without `userns_mode: keep-id:uid=1000,gid=1000`:
- Container sees files owned by a subuid (not UID 1000)
- Writes from container UID 1000 fail with EACCES

With `userns_mode: keep-id:uid=1000,gid=1000`:
- Host UID 2000 is mapped to container UID 1000
- Container can read/write files created by host user

### Why Docker Doesn't Have This Issue

Docker typically runs with root privileges and uses a daemon that can manage UIDs. Podman's rootless architecture is more secure but requires explicit UID mapping for bind mounts.

## Alternative Solutions (Not Used)

1. **Change container user at runtime:**
   ```yaml
   user: "2000:2000"
   ```
   - Breaks Node.js installation paths (`/home/node`)
   - Would need to fix `$HOME` and permissions inside container

2. **Use named volumes instead of bind mounts:**
   - Loses easy access to config files from host
   - Not suitable for this use case

3. **Run with `--privileged` or root:**
   - Security anti-pattern
   - Defeats purpose of rootless Podman

## References

- [Podman User Namespaces](https://github.com/containers/podman/blob/main/docs/tutorials/rootless_tutorial.md)
- [userns_mode documentation](https://docs.docker.com/compose/compose-file/compose-file-v3/#userns_mode)
- Moltbot Dockerfile: Uses `USER node` (UID 1000) for security
