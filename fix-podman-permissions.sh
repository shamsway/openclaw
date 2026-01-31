#!/usr/bin/env bash
set -euo pipefail

# Fix Podman rootless permissions using podman unshare
# This creates directories with proper subuid/subgid ownership

CONFIG_DIR="${OPENCLAW_CONFIG_DIR:-$HOME/.openclaw}"
WORKSPACE_DIR="${OPENCLAW_WORKSPACE_DIR:-$HOME/.openclaw/workspace}"

echo "Fixing permissions for Podman rootless mode..."
echo "Config dir: $CONFIG_DIR"
echo "Workspace dir: $WORKSPACE_DIR"

# Clean up existing directories
rm -rf "$CONFIG_DIR" "$WORKSPACE_DIR"

# Create directories in the rootless user namespace
# This maps them to the container's UID 1000
podman unshare sh -c "
  mkdir -p '$CONFIG_DIR'
  mkdir -p '$WORKSPACE_DIR'
  chown -R 1000:1000 '$CONFIG_DIR'
  chown -R 1000:1000 '$WORKSPACE_DIR'
"

echo "Permissions fixed!"
echo "You can now run: ./podman-setup.sh"
