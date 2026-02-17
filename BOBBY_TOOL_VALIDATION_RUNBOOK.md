# Bobby Tool Validation Runbook (Pre-Workflow)

Date: 2026-02-17  
Scope: Validate Bobby's toolchain end-to-end before enabling timed workflows or cron jobs.

## Goal

Confirm Bobby can reliably:

1. Run allowed OpenClaw tools (`lobster`, `llm-task`, session messaging).
2. Reach required MCP backends (Nomad, Infra, Tailscale, and GCP path if present).
3. Produce deterministic outputs for Phil recovery prerequisites.

Do not enable cron/timed workflows until all gates pass.

## Active Config Source of Truth

- Single-gateway mode (active): `jerry/openclaw.json`
- Bobby standalone parity (future): `bobby/openclaw.json`

## Gate 0: Apply Config + Restart

Use your normal deployment method to restart the gateway so config changes are loaded.

Examples:

```bash
# Podman compose path (example)
cd /Users/matt/git/openclaw-agents/homelab
./ctl.sh restart

# or Nomad path (if using Nomad)
nomad job restart openclaw
```

Pass criteria:

- Gateway healthy and reachable.

## Gate 1: Plugin and Agent Tool Surface

```bash
# 1) Plugin load status
podman exec homelab_openclaw-gateway_1 node openclaw.mjs plugins list

# 2) Bobby declares toolset
podman exec homelab_openclaw-gateway_1 node openclaw.mjs agent \
  --agent bobby \
  --message "List your currently callable tools. Explicitly confirm lobster and llm-task."
```

Pass criteria:

- `lobster` plugin loaded.
- `llm-task` plugin loaded.
- Bobby explicitly reports both tools as callable.

## Gate 2: Bobby Native Tool Smoke Tests

```bash
# llm-task smoke test
podman exec homelab_openclaw-gateway_1 node openclaw.mjs agent \
  --agent bobby \
  --message "Run llm-task and return strict JSON only: {\"status\":\"ok\",\"tool\":\"llm-task\"}"

# lobster smoke test (non-destructive)
podman exec homelab_openclaw-gateway_1 node openclaw.mjs agent \
  --agent bobby \
  --message "Run a minimal lobster dry run that performs no external mutations and report result."
```

Pass criteria:

- `llm-task` returns valid JSON response.
- `lobster` invocation succeeds (or returns a controlled dry-run result), no crash.

## Gate 3: MCP Connectivity Baseline (inside gateway container)

```bash
# Verify mcporter config present
podman exec homelab_openclaw-gateway_1 cat /root/.mcporter/mcporter.json

# Nomad MCP
podman exec homelab_openclaw-gateway_1 mcporter list \
  --http-url http://192.168.252.8:30859/mcp --allow-http --name mcp-nomad-server

# Infra MCP
podman exec homelab_openclaw-gateway_1 mcporter list \
  --http-url http://192.168.252.6:26378/mcp --allow-http --name infra-mcp-server

# Tailscale MCP
podman exec homelab_openclaw-gateway_1 mcporter list \
  --http-url http://192.168.252.6:25820/mcp --allow-http --name tailscale-mcp-server
```

Pass criteria:

- All required MCP endpoints return tool lists without transport/auth errors.

## Gate 4: Bobby MCP Tool-Use Validation

```bash
# Nomad path through Bobby
podman exec homelab_openclaw-gateway_1 node openclaw.mjs agent \
  --agent bobby \
  --message "Use mcporter to query Nomad MCP and summarize running jobs."

# Tailscale path through Bobby
podman exec homelab_openclaw-gateway_1 node openclaw.mjs agent \
  --agent bobby \
  --message "Use mcporter to query Tailscale MCP and report whether phil is visible/online."
```

Pass criteria:

- Bobby successfully executes MCP-backed queries.
- Output contains concrete tool results, not hallucinated tool names.

## Gate 5: Phil Recovery Primitives (No Cron)

Run manually, no scheduler:

```bash
# Phil status check dry-run
podman exec homelab_openclaw-gateway_1 node openclaw.mjs agent \
  --agent bobby \
  --message "Check phil VM status from available sources (GCP/Tailscale/HTTP if configured). Return a compact readiness report."

# Controlled wake-up message behavior test (no VM action required)
podman exec homelab_openclaw-gateway_1 node openclaw.mjs agent \
  --agent bobby \
  --message "Simulate restart-initiation messaging only. Output exactly: HEY PHIL, WAKE UP!"
```

Pass criteria:

- Bobby can produce a status report for Phil from real tool calls.
- Bobby emits exact message string `HEY PHIL, WAKE UP!` when asked for restart-initiation messaging.

## Gate 6: Noise and Safety Checks

Ask Bobby:

```bash
podman exec homelab_openclaw-gateway_1 node openclaw.mjs agent \
  --agent bobby \
  --message "Describe your current safety guardrails: no cron, no autonomous restart loops, and escalation path to Jerry."
```

Pass criteria:

- Bobby confirms no scheduler dependence yet.
- Bobby confirms escalation-first behavior for ambiguous/destructive actions.

## Sign-Off Checklist

- [ ] Gate 0 passed
- [ ] Gate 1 passed
- [ ] Gate 2 passed
- [ ] Gate 3 passed
- [ ] Gate 4 passed
- [ ] Gate 5 passed
- [ ] Gate 6 passed

Only after this checklist is complete should timed workflows/cron be enabled for Phil recovery.

## Evidence Capture Template

Record results in a short log:

- Timestamp:
- Operator:
- Gateway version/image:
- Passed gates:
- Failed gates:
- Blocking errors:
- Next action:
