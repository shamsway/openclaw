#!/usr/bin/env bash
# homelab/ctl.sh - Convenience wrapper for homelab podman-compose commands
#
# Works from any directory; always runs with the repo root as the project
# directory so .env is found and build contexts resolve correctly.
#
# Usage:
#   ./homelab/ctl.sh <command> [args...]
#
# Commands:
#   up       Start the gateway in the background (podman-compose up -d)
#   down     Stop and remove containers
#   logs     Follow gateway logs (podman-compose logs -f)
#   build    Build the homelab image (tag from OPENCLAW_IMAGE / OPENCLAW_VERSION)
#   push     Tag and push the image to OPENCLAW_REGISTRY (--tls-verify=false)
#   pull     Pull the image from OPENCLAW_REGISTRY and tag it locally
#   restart  Restart the gateway container
#   ps       Show container status
#
# Registry workflow (multi-node lab):
#   Build node:   ./homelab/ctl.sh build && ./homelab/ctl.sh push
#   Remote nodes: ./homelab/ctl.sh pull && ./homelab/ctl.sh up
#
# OPENCLAW_REGISTRY defaults to registry.service.consul:8082 (insecure HTTP).
# Set it in .env or export it before running this script.
#
# Extra args are forwarded to the underlying podman-compose command, e.g.:
#   ./homelab/ctl.sh logs openclaw-gateway
#   ./homelab/ctl.sh up --force-recreate

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Always run from repo root so podman-compose picks up .env and build
# contexts (context: ..) resolve correctly.
cd "$REPO_ROOT"

COMPOSE_FILES=(-f homelab/docker-compose.yml -f homelab/docker-compose.podman.yml)

# Load .env if present so OPENCLAW_IMAGE / OPENCLAW_REGISTRY are available
# when running push/pull outside of compose (compose loads .env itself).
if [[ -f "$REPO_ROOT/.env" ]]; then
  # shellcheck disable=SC1091
  set -a; source "$REPO_ROOT/.env"; set +a
fi

REGISTRY="${OPENCLAW_REGISTRY:-registry.service.consul:8082}"

# Resolve OPENCLAW_VERSION: prefer .env value, fall back to package.json, then "local".
if [[ -z "${OPENCLAW_VERSION:-}" ]]; then
  OPENCLAW_VERSION="$(node -p "require('./package.json').version" 2>/dev/null || echo "local")"
fi

# _registry_image LOCAL_IMAGE
# Returns the fully-qualified registry image name.
# Strips any existing registry prefix so the result is always REGISTRY/name:tag.
_registry_image() {
  local img="$1"
  local base="${img#*/}"  # drop host:port/... prefix when present; no-op otherwise
  echo "${REGISTRY}/${base}"
}

CMD="${1:-help}"
shift || true

case "$CMD" in
  up)
    podman-compose "${COMPOSE_FILES[@]}" up -d "$@"
    ;;
  down)
    podman-compose "${COMPOSE_FILES[@]}" down "$@"
    ;;
  logs)
    podman-compose "${COMPOSE_FILES[@]}" logs -f "$@"
    ;;
  build)
    DOCKERFILE="$REPO_ROOT/homelab/Dockerfile"
    BUILD_TAG="${OPENCLAW_IMAGE:-openclaw-homelab:${OPENCLAW_VERSION}}"
    echo "Dockerfile : $DOCKERFILE"
    echo "Image tag  : $BUILD_TAG"
    echo "Context    : $REPO_ROOT"
    podman build \
      -t "$BUILD_TAG" \
      -f "$DOCKERFILE" \
      "$REPO_ROOT" "$@"
    ;;
  push)
    LOCAL="${OPENCLAW_IMAGE:-openclaw-homelab:${OPENCLAW_VERSION}}"
    REMOTE="$(_registry_image "$LOCAL")"
    echo "Tagging ${LOCAL} → ${REMOTE}"
    podman tag "$LOCAL" "$REMOTE"
    echo "Pushing ${REMOTE} (--tls-verify=false)"
    podman push --tls-verify=false "$REMOTE" "$@"
    ;;
  pull)
    LOCAL="${OPENCLAW_IMAGE:-openclaw-homelab:${OPENCLAW_VERSION}}"
    REMOTE="$(_registry_image "$LOCAL")"
    echo "Pulling ${REMOTE} (--tls-verify=false)"
    podman pull --tls-verify=false "$REMOTE" "$@"
    echo "Tagging ${REMOTE} → ${LOCAL}"
    podman tag "$REMOTE" "$LOCAL"
    ;;
  restart)
    podman-compose "${COMPOSE_FILES[@]}" restart "$@"
    ;;
  ps|status)
    podman-compose "${COMPOSE_FILES[@]}" ps
    ;;
  help|--help|-h)
    sed -n '2,/^set /p' "$0" | grep '^#' | sed 's/^# \{0,1\}//'
    exit 0
    ;;
  *)
    echo "error: unknown command '${CMD}'" >&2
    echo "Usage: $0 {up|down|logs|build|push|pull|restart|ps}" >&2
    exit 1
    ;;
esac
