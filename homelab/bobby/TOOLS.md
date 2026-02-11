# TOOLS.md - Tools & Notes

Notes on available MCP servers, their quirks, and anything worth remembering.

## MCP Servers

### nomad

Nomad cluster operations.
- **Endpoint:** *(e.g. http://nomad.service.consul:4646)*
- **Key queries:** job status, allocation health, evaluation failures, node list
- **Write scope:** restart (job restart / rerun); avoid `job stop`
- **Notes:** *(quirks, job names to watch, known flappy jobs)*

### consul

Consul service discovery and health.
- **Endpoint:** *(e.g. http://consul.service.consul:8500)*
- **Key queries:** health check status per service, node health, catalog queries
- **Write scope:** none (monitoring only — don't deregister services)
- **Notes:** *(which services have known flappy checks, expected transient failures)*

### infra

Infrastructure-level metrics.
- **Key queries:** disk usage per volume, memory usage, process list, CPU
- **Write scope:** none from Bobby (delegate write ops to Billy via A2A)
- **Notes:** *(mount points, what "normal" disk usage looks like for this cluster)*

### tailscale

Tailscale mesh network.
- **Tailnet:** *(your tailnet name)*
- **Expected nodes:** Jerry, Bobby *(add more as they come online)*
- **Key queries:** device list, online status, last-seen timestamps
- **Notes:** *(devices with legitimately intermittent connectivity, expected offline windows)*

### a2a-hub

Agent-to-agent router.
- **Registered agents:** Jerry (hub), Billy (automation) *(add as they come online)*
- **Key ops:** escalate to Jerry, dispatch cleanup tasks to Billy
- **Notes:** *(message format, routing conventions)*

## Cluster Layout

*(fill in during first run or as you explore)*

- **Nomad datacenter:**
- **Consul datacenter:**
- **Key services with health checks:**
- **Volumes to monitor (with thresholds):**
- **HTTP health endpoints to probe:**
- **Tailscale nodes (expected online):**
- **Quiet hours:**

## Lessons Learned

*(update as you go — known flappy services, false alarms, thresholds to tune)*
