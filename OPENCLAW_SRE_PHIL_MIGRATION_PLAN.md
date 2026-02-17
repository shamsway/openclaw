# OpenClaw SRE Migration Plan: Phil VM Recovery

Date: 2026-02-17
Scope: Migrate the high-value, low-noise parts of the Octant `sre-agent` into current OpenClaw agents.

## Why this plan

- Preserve proven behavior from the existing SRE workflow.
- Remove noisy/over-broad behavior from the current LangGraph service.
- Implement first in your current single-gateway OpenClaw mode (Jerry-hosted agents).

## Validated patterns to reuse

1. Targeted detection with cooldown.
   Pattern: `phil-vm` + `critical` alert path, with a separate cooldown for this class of alert.
   Source: `resources/octant-private/terraform/agent-farm/agents/sre-agent/workflows/monitoring_workflows.py`

2. Push/pull deduplication.
   Pattern: reject duplicate preemption workflow creation within 5 minutes.
   Source: `resources/octant-private/terraform/agent-farm/agents/sre-agent/app.py`

3. Strict restart budget.
   Pattern: max 5 restarts per 24h, then switch to manual review.
   Source: `resources/octant-private/terraform/agent-farm/agents/sre-agent/vm_preemption_workflow.py`

4. Two-stage recovery verification.
   Pattern: verify HTTP health first, then non-blocking GCP status confirmation.
   Source: `resources/octant-private/terraform/agent-farm/agents/sre-agent/vm_preemption_workflow.py`

5. Noise suppression for repeated limit events.
   Pattern: suppress duplicate manual-review Slack notifications in a time window.
   Source: `resources/octant-private/terraform/agent-farm/agents/sre-agent/vm_preemption_workflow.py`

6. Persistent event/restart history.
   Pattern: SQLite-backed events + restart records for decisions and auditability.
   Source: `resources/octant-private/terraform/agent-farm/agents/sre-agent/sqlite_db.py`

## OpenClaw mapping

- Detection/coordination agent: `bobby` (infra role).
- Human-facing narration and escalation: `jerry`.
- Optional daily report agent: `billy`.
- Keep deployment mode aligned with your current plan: one gateway on Jerry with in-process Bobby/Billy.

## Implementation plan

### Phase 0: Quiet old SRE service

1. Stop old SRE job so it no longer emits noisy alerts.
2. Keep data volume for forensics but disable autonomous actions.
3. Re-enable only if rollback is needed.

Suggested commands:

```bash
cd resources/octant-private/terraform/agent-farm
make stop-sre-agent
# equivalent:
# nomad job stop -purge sre-agent
```

### Phase 1: Build a focused "phil-keeper" workflow in OpenClaw

Implement as a Bobby-owned workflow with deterministic steps:

1. Receive trigger from health event or periodic poll.
2. Deduplicate by `phil` + 5-minute window.
3. Check recent restart count in last 24h.
4. If count >= 5, send manual-review alert (with suppression window).
5. If count < 5, attempt GCP start/restart.
6. On restart, send one message containing: `HEY PHIL, WAKE UP!`
7. Poll recovery (HTTP first, GCP second) up to configured timeout.
8. Persist event outcome and restart attempt.
9. Send compact outcome summary to Slack/Discord.

### Phase 2: Wire scheduling

Add two OpenClaw cron jobs:

1. Fast check every 2-5 minutes for Phil health/preemption signal.
2. Daily 09:00 summary with restart budget status (used/remaining in last 24h).

### Phase 3: Guardrails

1. Keep autonomous mode only while restart budget is below threshold.
2. Manual-review mode after threshold until rolling 24h budget clears.
3. Suppress duplicate "rate limit exceeded" alerts for 60 minutes.

## Data model (minimal)

Store in `workspace-bobby` (SQLite recommended):

- `vm_events`: id, hostname, event_type, timestamp, source, workflow_id, decision, notes
- `vm_restarts`: id, hostname, restart_time, success, method, workflow_id, error

Required queries:

1. `recent_restarts(hostname, 24h)`
2. `recent_preemption_event(hostname, 5m)`
3. `recent_manual_review_alert(hostname, 60m)`

## Test plan

### Functional tests

1. Preemption detected, under budget.
   Expected: restart attempted, `HEY PHIL, WAKE UP!` posted, recovery check executed, success logged.

2. Preemption detected, budget exhausted.
   Expected: no restart, manual-review notification sent once, repeats suppressed for 60m.

3. Duplicate trigger from two sources within 5m.
   Expected: second workflow skipped and linked to first workflow id.

4. VM still online false-positive.
   Expected: no restart, informational message only.

5. Restart attempted but recovery timeout.
   Expected: failure recorded with diagnosis (GCP running vs HTTP not ready split).

### Non-functional tests

1. No duplicate Slack/Discord spam during repeated incidents.
2. Rolling 24h counter correctness across day boundary.
3. Restart cap strictly enforced at 5/24h.

## Rollout order

1. Shadow mode (no restart) for 24h with full logging.
2. Limited autonomous mode with cap=2/24h for 24h.
3. Full autonomous mode with cap=5/24h.

## Reusable template for other VMs

Abstract constants into config:

- `vm_name`
- `project`
- `zone`
- `health_endpoint`
- `restart_cap_24h`
- `dedup_window_minutes`
- `alert_suppression_minutes`

Then apply the same workflow for additional preemptible instances.
