# Harry/Bob Specialized Support Agents (Shortlist)

Date: 2026-02-23

This is a short, near-term list of specialist agents to support Harry (orchestrator/front door) and Bob (research specialist) using the wrapper-agent pattern.

Design principles:

- Keep each agent narrow (one job, one owner/client, minimal tools)
- Use ClawHub (`https://clawhub.ai`) as the preferred source for skill discovery/installation (`clawhub install <skill-slug>`)
- Use `awesome-openclaw-skills` as backup/reference, not as a trust boundary
- Enforce boundaries in config (`agents.list[].skills` + per-agent tool policy), not just persona text

## Recommended Rollout Order

1. `skill-intake`
2. `citation-auditor`
3. `agent-maintainer`
4. `evidence-collector`
5. `agent-regression-tester`

## 1) skill-intake (ClawHub-first skill scout + vetter)

Purpose:

- Discover, review, sandbox-test, and approve candidate skills for Harry/Bob and future specialist agents.

Why now:

- Immediate need is expanding capability without bloating Harry/Bob.

Scope:

- ClawHub-first discovery/install workflow
- `awesome-openclaw-skills` as fallback/category reference
- Shortlist generation, risk notes, wrapper-skill recommendation

Basic testing plan:

1. Ask for 3 candidate skills for one capability (for example, PDF research support).
2. Verify it returns a shortlist with risk notes and required bins/env.
3. Give it one chosen skill and confirm it proposes a wrapper-skill pattern.
4. Give it an obviously risky/overbroad skill and confirm it flags or rejects it.

## 2) citation-auditor (Bob output QA agent)

Purpose:

- Audit Bob's research answers for citation completeness, date clarity, and contradiction handling.

Why now:

- Improves Bob reliability immediately without changing Bob's core role.

Scope:

- Review-only specialist
- No actions, no messaging, no ops changes

Basic testing plan:

1. Give it a strong Bob answer and confirm it passes with minimal notes.
2. Give it a Bob answer missing dates and confirm it flags exact gaps.
3. Give it conflicting sources and confirm it requires a conflicts section.
4. Give it an uncited claim and confirm it rejects or marks low confidence.

## 3) agent-maintainer (wrapper-agent builder/refactorer)

Purpose:

- Create/refactor simple specialist agents and keep `AGENTS.md` / `SOUL.md` / `TOOLS.md` / `HEARTBEAT.md` consistent.

Why now:

- Harry/Bob are evolving quickly and the wrapper-agent pattern should be repeatable.

Scope:

- Agent archetype selection (specialist wrapper, domain bundle, orchestrator)
- Minimal skill set and tool policy proposal
- Workspace file plan and acceptance test matrix

Basic testing plan:

1. Ask it to design a one-skill specialist agent (for example, PDF extractor).
2. Confirm it proposes a narrow archetype and minimal tools.
3. Ask it to refactor an intentionally overbroad agent concept and confirm it splits responsibilities.
4. Ask it for a Harry/Bob support agent and confirm explicit escalation/handoff rules.

## 4) evidence-collector (research source pack builder for Bob)

Purpose:

- Collect and normalize source material (web pages, PDFs, docs) into a structured evidence pack for Bob.

Why now:

- Speeds Bob's research flow and reduces repeated source-gathering work.

Scope:

- Web search/fetch + PDF/doc extraction
- Source URL/date capture
- Evidence pack formatting for Bob's research brief workflow

Basic testing plan:

1. Give it a current-topic research prompt and confirm it returns source URLs + dates.
2. Give it mixed sources (web + PDF) and confirm it includes both in one pack.
3. Simulate offline/no-web and confirm it clearly reports what could not be verified.
4. Feed its output to Bob and confirm Bob can produce a consistent brief faster.

## 5) agent-regression-tester (acceptance prompt runner)

Purpose:

- Maintain a small prompt-based regression suite for Harry, Bob, and specialist agents after skill/persona changes.

Why now:

- Fast iteration on agents/skills will cause drift without a lightweight check loop.

Scope:

- Test planning and result logging
- Manual or semi-automated prompt runs first

Basic testing plan:

1. Create 3-5 prompts for Harry, Bob, and one specialist agent.
2. Run before/after a file change and compare behavior/format drift.
3. Confirm it catches out-of-scope failures (for example, Bob trying to take action).
4. Confirm it logs results in a stable location for future comparisons.

## Expected Outcomes (Near Term)

- Harry stays focused on orchestration and communication
- Bob gets stronger quality control and source prep support
- New capabilities are added through specialist agents, not Harry/Bob sprawl
- Skill adoption becomes safer and more repeatable (ClawHub-first intake + wrapper skills)

## Next Step

Start with `skill-intake` and `citation-auditor`, then use the `openclaw-agent-creator` skill to define their minimal skill/tool policies and file templates before installing any new third-party skills.
