#!/usr/bin/env bash
# homelab/ctl.sh - Convenience wrapper for homelab podman compose commands
#
# Works from any directory; always runs with the repo root as the project
# directory so .env is found and build contexts resolve correctly.
#
# Usage:
#   ./homelab/ctl.sh <command> [args...]
#
# Commands:
#   up       Start the gateway in the background (podman compose up -d)
#   down     Stop and remove containers
#   logs     Follow gateway logs (podman compose logs -f)
#   build    Build the homelab image (openclaw-homelab:local)
#   restart  Restart the gateway container
#   ps       Show container status
#
# Extra args are forwarded to the underlying podman compose command, e.g.:
#   ./homelab/ctl.sh logs openclaw-gateway
#   ./homelab/ctl.sh up --force-recreate

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Always run from repo root so podman compose picks up .env and build
# contexts (context: ..) resolve correctly.
cd "$REPO_ROOT"

COMPOSE_FILES=(-f homelab/docker-compose.yml -f homelab/docker-compose.podman.yml)

CMD="${1:-help}"
shift || true

case "$CMD" in
  up)
    podman compose "${COMPOSE_FILES[@]}" up -d "$@"
    ;;
  down)
    podman compose "${COMPOSE_FILES[@]}" down "$@"
    ;;
  logs)
    podman compose "${COMPOSE_FILES[@]}" logs -f "$@"
    ;;
  build)
    podman build \
      -t "${OPENCLAW_IMAGE:-openclaw-homelab:local}" \
      -f homelab/Dockerfile \
      . "$@"
    ;;
  restart)
    podman compose "${COMPOSE_FILES[@]}" restart "$@"
    ;;
  ps|status)
    podman compose "${COMPOSE_FILES[@]}" ps
    ;;
  help|--help|-h)
    sed -n '2,/^set /p' "$0" | grep '^#' | sed 's/^# \{0,1\}//'
    exit 0
    ;;
  *)
    echo "error: unknown command '${CMD}'" >&2
    echo "Usage: $0 {up|down|logs|build|restart|ps}" >&2
    exit 1
    ;;
esac
