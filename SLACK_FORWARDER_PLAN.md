# slack-forwarder — Build & Deploy Plan

Prerequisite for the `thread-ownership` OpenClaw plugin. Prevents Bobby, Billy,
and Jerry from posting conflicting responses in the same Slack thread when a
message is broadcast to multiple agent bindings.

---

## What it does

The `thread-ownership` plugin intercepts every outbound Slack message and calls
this service before allowing the send. The service tracks which agent "owns" a
given Slack thread. First agent to claim a thread wins; others are suppressed
(unless the user @-mentions them directly).

---

## API contract

Single endpoint:

```
POST /api/v1/ownership/:channelId/:threadTs
Content-Type: application/json
Body: { "agent_id": "bobby" }
```

| Response | Meaning | Plugin action |
|---|---|---|
| `200 OK` | Agent successfully claimed (or already owns) the thread | Send message |
| `409 Conflict` | Different agent owns thread — body: `{ "owner": "jerry" }` | Cancel send |
| Any error / unexpected | Network failure, timeout, etc. | Fail open — send message |

The plugin fails open on errors to prevent a down forwarder from silencing all agents.

### Ownership logic (3 cases)

1. **Key does not exist** → store `channelId:threadTs → agentId` with TTL, return `200`
2. **Key exists, value == agentId** → idempotent re-claim, return `200`
3. **Key exists, value != agentId** → return `409 { "owner": "<existing agentId>" }`

---

## KV store: Redis (recommended over Consul KV)

Use Redis. Thread ownership entries are ephemeral (TTL-based), and Redis's
`SET NX EX` is a single atomic operation — no session management needed.
Consul KV TTL requires session machinery that adds unnecessary complexity here.

**Redis commands:**

```
# Claim (atomic set-if-not-exists with TTL)
SET thread-ownership:{channelId}:{threadTs} {agentId} NX EX 14400
# Returns "OK" if claimed, nil if key already existed

# Check existing owner (only called when NX claim fails)
GET thread-ownership:{channelId}:{threadTs}
# Returns existing agentId string
```

**TTL:** `14400` seconds (4 hours). Slack threads don't stay active forever;
this prevents stale ownership blocking legitimate agent responses in old threads.
Adjust down if high thread volume causes Redis memory pressure.

**Redis connection:** Use your existing Redis deployment. Default port 6379.
The service only needs read/write on keys prefixed `thread-ownership:`.

---

## Implementation spec

### Routes

```
POST /api/v1/ownership/:channelId/:threadTs
  Body: { agent_id: string }
  1. key = "thread-ownership:{channelId}:{threadTs}"
  2. result = SET key {agent_id} NX EX 14400
  3. if result == "OK":
       return 200
  4. existing = GET key
  5. if existing == agent_id:
       return 200
  6. return 409 { "owner": existing }

GET /health
  return 200 { "ok": true }
```

No authentication required — this service is internal, reachable only within
the Podman/Nomad network.

### Environment variables

| Var | Default | Description |
|---|---|---|
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |
| `PORT` | `8750` | HTTP listen port |
| `OWNERSHIP_TTL_SECONDS` | `14400` | Key TTL (4 hours) |

### Language / framework

Any works. Suggested options by complexity:
- **Node.js** (express + ioredis) — consistent with the gateway stack
- **Go** (net/http + go-redis) — single binary, minimal footprint
- **Python** (fastapi + redis-py) — fast to write

The entire service is ~50-80 lines of actual logic regardless of language.

---

## Nomad job spec (outline)

```hcl
job "slack-forwarder" {
  datacenters = ["dc1"]
  type        = "service"

  group "forwarder" {
    count = 1

    network {
      port "http" { static = 8750 }
    }

    service {
      name = "slack-forwarder"
      port = "http"
      tags = ["http"]

      check {
        type     = "http"
        path     = "/health"
        interval = "30s"
        timeout  = "5s"
      }
    }

    task "forwarder" {
      driver = "docker"

      config {
        image = "<your-registry>/slack-forwarder:<tag>"
        ports = ["http"]
      }

      env {
        PORT      = "${NOMAD_PORT_http}"
        REDIS_URL = "redis://<redis-host>:6379"
      }

      resources {
        cpu    = 50
        memory = 64
      }
    }
  }
}
```

Consul service registration is handled automatically by the `service` block.
Once deployed, `slack-forwarder.service.consul` resolves from inside the
gateway container.

---

## Enabling thread-ownership after deploy

1. Deploy slack-forwarder and confirm `slack-forwarder.service.consul` resolves:
   ```bash
   podman exec homelab_openclaw-gateway_1 nslookup slack-forwarder.service.consul
   ```

2. Edit `openclaw-agents/jerry/openclaw.json`:
   ```json
   "thread-ownership": {
     "enabled": true,
     "config": {
       "forwarderUrl": "http://slack-forwarder.service.consul:8750",
       "abTestChannels": [
         "C0AF7JDDBB8",
         "C0AF9LAUWPL",
         "C0AEU73AYNB",
         "G01A46T1546"
       ]
     }
   }
   ```
   `abTestChannels` must be non-empty or the plugin skips enforcement entirely.
   These are the four Slack channel IDs already in the gateway bindings.

3. Restart the gateway to load the plugin:
   ```bash
   ./homelab/ctl.sh restart
   # verify DNS still up after restart:
   podman exec homelab_openclaw-gateway_1 nslookup nomad.service.consul
   ```

4. Test by sending a message to a shared channel — only one agent should reply.
   Check gateway logs for `thread-ownership` cancel events:
   ```bash
   podman logs -f homelab_openclaw-gateway_1 2>&1 | grep -i "thread\|ownership\|cancel"
   ```

---

## Notes

- The @-mention bypass is handled entirely in the plugin (in-memory, 5-minute TTL).
  The forwarder doesn't need to know about @-mentions.
- The forwarder has no persistence requirement. A restart clears all ownership state,
  which is fine — threads will just re-establish ownership on the next message.
- If the forwarder is unreachable, the plugin fails open (all agents can post).
  This is intentional to prevent a down forwarder from silencing the system.
