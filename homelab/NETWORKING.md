# homelab/NETWORKING.md — Container DNS and Service Discovery

## Current State (Podman 4.x, aardvark-dns)

Consul DNS (`*.service.consul`) resolves correctly inside the container **without any
workaround**. The resolution chain is:

```
container resolver → aardvark-dns (10.89.2.1) → host dnsmasq → Consul :8600
```

The host's dnsmasq is configured with `server=/consul/127.0.0.1#8600`, which forwards
all `.consul` queries to the local Consul agent. Podman's aardvark-dns (the per-network
DNS resolver) forwards unknown domains to the host resolver, completing the chain.

**Verified (2026-02-18):**
```
$ podman exec homelab_openclaw-gateway_1 nslookup nomad.service.consul
Server:   10.89.2.1       ← aardvark-dns
Name:     nomad.service.consul
Address:  192.168.252.7
Address:  192.168.252.8
Address:  192.168.252.6   ← 3 Nomad nodes returned via Consul
```

The container's `/etc/resolv.conf` shows:
```
search dns.podman
nameserver 10.89.2.1   ← aardvark-dns (handles *.consul forwarding)
nameserver 8.8.8.8
nameserver 8.8.4.4
```

---

## The `dns:` Entries in docker-compose.yml

`docker-compose.yml` includes:

```yaml
dns:
  - 192.168.252.6
  - 192.168.252.7
```

These are **overridden by aardvark-dns** in Podman 4.x — service-level `dns:` entries
are ignored at runtime, and the container always gets aardvark-dns as its resolver.
The entries remain as documentation and as the correct values for:

- **Podman 5.x+** — `podman network create --dns 192.168.252.6 --dns 192.168.252.7 openclaw-net`
  to bake resolvers into the network definition
- **Non-Podman deployments** (Docker, bare docker-compose) where `dns:` is honoured

**Important:** The network must be created under the correct **user namespace**. In this
homelab, containers run under the `hashi` user (rootless Podman). A network created with
`sudo podman network create` lives in root's namespace and is invisible to `hashi`'s
containers. Always create networks as the `hashi` user.

**Podman 5.x migration path (when upgrading):**
```bash
# As hashi user — create network with correct resolvers
podman network create --dns 192.168.252.6 --dns 192.168.252.7 openclaw-net

# Update docker-compose.yml service to use the named network:
#   networks:
#     - openclaw-net
# Add top-level:
#   networks:
#     openclaw-net:
#       external: true
```

---

## Podman 4.x Quirk: aardvark-dns and Container Recreate

**Symptom:** After `ctl.sh down && ctl.sh up` (which removes and recreates the container),
`nslookup nomad.service.consul` returns `NXDOMAIN` or falls through to `8.8.8.8`. The
aardvark-dns process stops when the container is removed and sometimes does not restart
cleanly when a new container is created.

**How to detect:**
```bash
pgrep -la aardvark-dns   # should show a running process
# if nothing, aardvark-dns is stopped
```

**Fix:** Use `podman restart <container>` or `ctl.sh restart` instead of down+up whenever
possible. `podman restart` does an in-place stop+start without removing the container,
which keeps aardvark-dns alive.

If DNS is already broken, restart the container directly:
```bash
podman restart homelab_openclaw-gateway_1
# Podman cleans up the stale PID and relaunches aardvark-dns
# Verify: podman exec homelab_openclaw-gateway_1 nslookup nomad.service.consul
```

**When down+up is required** (e.g. adding a new volume mount), verify DNS after:
```bash
./homelab/ctl.sh down && ./homelab/ctl.sh up
sleep 2
podman exec homelab_openclaw-gateway_1 nslookup nomad.service.consul
# If NXDOMAIN: podman restart homelab_openclaw-gateway_1
```

**Root cause:** In Podman 4.x, `podman-compose down` sends `SIGTERM` to aardvark-dns
when the last container on the network is removed. When `podman-compose up` then creates
a new container, the stale PID file (`/run/user/2000/containers/networks/aardvark-dns/aardvark.pid`)
confuses the DNS restart. `podman restart` bypasses this by never removing the container
and thus never sending the stop signal to aardvark-dns.

---

## Verifying Consul DNS from Inside the Container

```bash
# Quick check — should return 2-3 IPs
podman exec homelab_openclaw-gateway_1 nslookup nomad.service.consul

# Check what resolver is in use
podman exec homelab_openclaw-gateway_1 cat /etc/resolv.conf

# Test a specific MCP server address
podman exec homelab_openclaw-gateway_1 nslookup gcp-mcp-server.service.consul

# Test connectivity to an MCP server
podman exec homelab_openclaw-gateway_1 \
  curl -s --max-time 3 http://192.168.252.8:30859/mcp 2>&1 | head -2
```

If Consul DNS stops working (e.g. after a dnsmasq restart or Consul outage), the
aardvark-dns resolver (`10.89.2.1`) will still forward correctly once the host
resolver chain is restored. The fix is on the host, not in the container.

---

## Service Endpoints (Current)

All resolved correctly from inside the container:

| Service | Consul name | Direct IP |
|---------|-------------|-----------|
| Nomad API | `nomad.service.consul:4646` | `192.168.252.6-8:4646` |
| Consul API | `consul.service.consul:8500` | `192.168.252.6-8:8500` |
| Nomad MCP server | `192.168.252.8:30859` | direct IP |
| Infra MCP server | `192.168.252.6:26378` | direct IP |
| Tailscale MCP server | `192.168.252.6:29178` | direct IP |
| GCP MCP server | `gcp-mcp-server.service.consul:22241` | `192.168.252.7:22241` |

---

## Historical Note: extra_hosts Workaround (Removed)

An earlier version of this file documented an `extra_hosts` workaround in
`docker-compose.podman.yml` to add static `/etc/hosts` entries for `.service.consul`
names. This was based on incorrect diagnosis — the `dns:` entries were never actually
broken; Consul DNS was always working via the aardvark-dns chain. The `extra_hosts`
entries have been removed. `docker-compose.podman.yml` is now an empty Podman override
file with no service customizations.

The previous incorrect workaround:
```yaml
# REMOVED — no longer needed
extra_hosts:
  - "litellm.service.consul:192.168.252.6"
```
