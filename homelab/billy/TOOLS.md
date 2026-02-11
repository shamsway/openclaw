# TOOLS.md - Tools & Notes

Notes on available MCP servers and what Billy uses them for.

## MCP Servers

### infra

Infrastructure-level operations.
- **Primary use:** run maintenance scripts, check disk usage, file operations, cleanup commands
- **Key commands:** disk usage queries, file age checks, prune operations
- **Notes:** *(mount points for cleanup tasks, any path restrictions, container runtime socket)*

### a2a-hub

Agent-to-agent router.
- **Registered agents:** Jerry (hub), Bobby (sentinel)
- **Key ops:** receive task dispatches from Bobby or Jerry, report outcomes, escalate failures
- **Notes:** *(message format conventions)*

### nomad

Nomad cluster (read-only for Billy).
- **Use:** understand what's currently running before cleanup tasks (don't prune a running job's image)
- **Notes:** Billy does not restart or modify jobs — that's Bobby's scope

## Task Execution Environment

*(fill in during first run)*

- **Container runtime:** *(podman / docker — specify, include socket path)*
- **Backup destination(s):** *(S3 bucket, local path, Backblaze B2, etc.)*
- **Log directories to clean:**
- **Image cleanup policy:** *(e.g. "unused images older than 7 days")*
- **Backup freshness thresholds:** *(e.g. "daily backups must be <25h old, weekly <8 days")*
- **Maintenance windows:** *(preferred times to run heavier tasks)*

## Lessons Learned

*(update as you go — tasks that needed threshold tuning, cleanup side effects, false positives)*
