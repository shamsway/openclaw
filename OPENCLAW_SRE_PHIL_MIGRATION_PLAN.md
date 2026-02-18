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

## Remediation plan and implementation checklist

This section closes the execution gaps and turns the migration into a run-ready checklist.

### 1) Source-of-truth and path fixes

Problem:

- Referenced source paths were written as `resources/octant-private/...` under this repo, but the local source currently exists under sibling workspace `../openclaw-agents/resources/octant-private/...`.

Actions:

1. Update local references during implementation review to:
   - `../openclaw-agents/resources/octant-private/terraform/agent-farm/agents/sre-agent/workflows/monitoring_workflows.py`
   - `../openclaw-agents/resources/octant-private/terraform/agent-farm/agents/sre-agent/app.py`
   - `../openclaw-agents/resources/octant-private/terraform/agent-farm/agents/sre-agent/vm_preemption_workflow.py`
   - `../openclaw-agents/resources/octant-private/terraform/agent-farm/agents/sre-agent/sqlite_db.py`
2. Record commit SHAs (or file hashes) of those source files before implementation.
3. Preserve a short "pattern parity" table (old behavior -> new behavior) in PR notes.

Definition of done:

- Every reused pattern maps to a concrete implementation artifact and test case.

### 2) Phase 0 stop/verify/rollback runbook

Problem:

- "Stop old SRE job" exists, but no verification or rollback checks.

Actions:

1. Stop old job.
2. Verify no active allocations.
3. Verify no new outbound alerts from old job for 15 minutes.
4. Keep old config and deployment manifest for rollback.

Runbook:

```bash
# stop
cd ../openclaw-agents/resources/octant-private/terraform/agent-farm
make stop-sre-agent
# fallback:
# nomad job stop -purge sre-agent

# verify nomad status (expect: not found / dead / zero allocs)
nomad job status sre-agent || true
nomad job allocs sre-agent || true

# verify no new logs in watch window
# (replace with your existing log sink query if not using nomad logs)
nomad logs -stderr -tail 200 sre-agent || true
```

Rollback:

- Re-run deploy/start target for `sre-agent` and confirm alerts resume in expected channel.

Definition of done:

- Old `sre-agent` is stopped, verified quiet, and rollback command is validated once.

### 3) Concrete implementation artifacts

Problem:

- Workflow exists conceptually, but not as concrete files/contracts.

Actions:

1. Add Bobby workflow contract docs in `workspace-bobby`:
   - trigger input schema
   - deterministic decision steps
   - output schema used by summary delivery
2. Add persistence layer file for `vm_events` + `vm_restarts`.
3. Add shared constants/config for:
   - restart cap
   - dedupe window
   - suppression window
   - recovery timeout/poll interval
4. Add explicit error codes:
   - `E_DEDUPED`
   - `E_BUDGET_EXCEEDED`
   - `E_RESTART_FAILED`
   - `E_RECOVERY_TIMEOUT`
   - `E_HEALTHCHECK_FALSE_POSITIVE`

Definition of done:

- Workflow has deterministic I/O and error taxonomy; behavior is testable without human interpretation.

### 4) Cron wiring (target spec)

Problem:

- Current runtime has one 15-minute job only; plan requires two jobs.

Actions:

1. Keep/replace fast Phil check with 2-5 minute cadence.
2. Add daily budget/status summary at 09:00.
3. Pin timezone explicitly for deterministic 09:00 behavior.

Canonical job specs (JSON shape):

```json
{
  "name": "Bobby heartbeat",
  "agentId": "bobby",
  "enabled": true,
  "schedule": { "kind": "cron", "expr": "*/5 * * * *", "tz": "America/New_York" },
  "sessionTarget": "isolated",
  "wakeMode": "now",
  "payload": {
    "kind": "agentTurn",
    "message": "Run phil-keeper check for VM preemption/health and enforce dedupe, restart budget, and manual-review suppression."
  },
  "delivery": {
    "mode": "announce",
    "channel": "discord",
    "to": "channel:1472975617111625902"
  }
}
```

```json
{
  "name": "Phil daily budget summary",
  "agentId": "bobby",
  "enabled": true,
  "schedule": { "kind": "cron", "expr": "0 9 * * *", "tz": "America/New_York" },
  "sessionTarget": "isolated",
  "wakeMode": "next-heartbeat",
  "payload": {
    "kind": "agentTurn",
    "message": "Summarize last 24h Phil VM incidents, restart attempts, successes/failures, and remaining restart budget."
  },
  "delivery": {
    "mode": "announce",
    "channel": "discord",
    "to": "channel:1472975617111625902"
  }
}
```

Definition of done:

- Two jobs exist, schedule/tz are explicit, and both can be force-run (`cron.run`) successfully.

### 5) SQLite schema, indexes, retention, and locking

Problem:

- Table intent exists, but no DDL/index/retention/transaction rules.

Actions:

1. Use WAL mode and busy timeout.
2. Create schema + indexes:

```sql
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;

CREATE TABLE IF NOT EXISTS vm_events (
  id TEXT PRIMARY KEY,
  hostname TEXT NOT NULL,
  event_type TEXT NOT NULL,
  ts_utc TEXT NOT NULL,
  source TEXT NOT NULL,
  workflow_id TEXT,
  decision TEXT NOT NULL,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS vm_restarts (
  id TEXT PRIMARY KEY,
  hostname TEXT NOT NULL,
  restart_time_utc TEXT NOT NULL,
  success INTEGER NOT NULL CHECK (success IN (0,1)),
  method TEXT NOT NULL,
  workflow_id TEXT,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_vm_events_host_ts
  ON vm_events(hostname, ts_utc DESC);

CREATE INDEX IF NOT EXISTS idx_vm_events_host_type_ts
  ON vm_events(hostname, event_type, ts_utc DESC);

CREATE INDEX IF NOT EXISTS idx_vm_restarts_host_ts
  ON vm_restarts(hostname, restart_time_utc DESC);
```

3. Transaction rules:
   - one transaction per workflow decision
   - insert event + optional restart row atomically
4. Retention:
   - keep 90 days by default
   - nightly purge job removes older rows

Definition of done:

- Schema is created on startup, queries are indexed, and concurrent runs do not produce lock errors.

### 6) Security and permission preflight

Problem:

- Restart action is defined without required IAM/auth checks.

Actions:

1. Validate GCP auth before enabling autonomous restart:
   - credential source available
   - can `get` VM status
   - can `start` VM
2. Validate health endpoint reachability from Jerry host.
3. Fail closed if preflight fails (manual-review mode only).

Preflight checklist:

1. `gcloud auth list` shows active expected account/service identity.
2. `gcloud compute instances describe <vm> --zone <zone> --project <project>` succeeds.
3. One dry-run/start permission check succeeds in non-prod or maintenance window.
4. HTTP health endpoint returns expected status semantics.

Definition of done:

- Autonomous restart cannot run unless all preflight checks are green.

### 7) Explicit guardrail state machine

Problem:

- Policy exists, but transition logic is implicit.

States:

1. `shadow`: observe/log only, never restart.
2. `auto_limited`: restart allowed, cap=2/24h.
3. `auto_full`: restart allowed, cap=5/24h.
4. `manual_review`: no restart; one notification per suppression window.

Transitions:

1. `shadow -> auto_limited`: 24h shadow run with no critical logic defects.
2. `auto_limited -> auto_full`: 24h limited run with no duplicate spam and correct counters.
3. `auto_* -> manual_review`: restart count reaches cap in rolling 24h OR preflight fails.
4. `manual_review -> auto_*`: rolling window clears below cap and preflight passes.

Definition of done:

- State, reason, and transition are persisted with each decision event.

### 8) Test harness and acceptance gates

Problem:

- Test scenarios are listed, but execution evidence requirements are missing.

Actions:

1. For each functional test, capture:
   - trigger input
   - expected decision
   - expected DB rows
   - expected outbound message text pattern
2. Add a reproducible force-run script for cron jobs.
3. Add acceptance gates before moving rollout phase:
   - zero duplicate alert spam in 24h
   - strict cap enforcement
   - dedupe working under dual trigger race

Definition of done:

- Every scenario has objective pass/fail criteria and captured evidence.

## Execution checklist (in order)

1. Fix source paths and capture old-code references + hashes.
2. Execute Phase 0 stop/verify/rollback validation.
3. Implement SQLite schema + query helpers.
4. Implement Bobby phil-keeper deterministic workflow + error codes.
5. Add/adjust cron jobs (fast check + daily summary with explicit tz).
6. Implement state machine and persist transition reasons.
7. Run functional + non-functional test matrix with evidence.
8. Roll out: shadow -> auto_limited -> auto_full.
9. Final handoff document: current state, last 24h stats, rollback steps.

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
