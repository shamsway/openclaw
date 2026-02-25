# Harry/Bob Skill Priorities (Near-Term)

Date: 2026-02-23

This note captures a practical, near-term skill prioritization for Harry and Bob, plus a short list of ClawHub deep-research skills to trial carefully.

Guiding approach:

- Keep Harry focused on orchestration + local CLI execution.
- Keep Bob focused on research + fact-checking + citation quality.
- Prefer ClawHub (`https://clawhub.ai`) for discovery/install (`clawhub install <skill-slug>`).
- Use `awesome-openclaw-skills` as a discovery/reference catalog, not a trust boundary.
- Trial deep-research skills in a specialist/staging agent before promoting into Bob.

## Priority For Harry (Direct Use)

## 1) `coding-agent`

Why:

- Covers local Claude Code, Codex, OpenCode, and Pi patterns.
- Encodes PTY/background process patterns already working in your environment.

Local skill:

- `openclaw-agents/skills/coding-agent/SKILL.md`

Basic testing plan:

1. Run one short Codex task in PTY mode.
2. Run one Claude Code task in PTY mode.
3. Run one background coding session and verify `process` log/poll flow.
4. Confirm Harry does not use it during heartbeat runs.

## 2) `gemini`

Why:

- Fast CLI adjunct for Harry for one-shot Q&A, summaries, and alternate model perspective.

Local skill:

- `openclaw-agents/skills/gemini/SKILL.md`

Basic testing plan:

1. Run one one-shot Q&A prompt.
2. Run one JSON output prompt.
3. Confirm auth works non-interactively after initial login.
4. Document when Harry should prefer Gemini CLI vs `coding-agent`.

## 3) `tmux` (optional, high leverage)

Why:

- Strong multiplier if Harry orchestrates multiple local CLI sessions in parallel.

Local skill:

- `openclaw-agents/skills/tmux/SKILL.md`

Basic testing plan:

1. Start isolated tmux socket/session.
2. Launch 2 CLI tasks in separate panes/sessions.
3. Capture pane output reliably.
4. Confirm attach/cleanup commands are documented in Harry `TOOLS.md`.

## 4) `clawhub`

Why:

- Lets Harry or a future `skill-intake` agent manage skill search/install/update directly.

Local skill:

- `openclaw-agents/skills/clawhub/SKILL.md`

Basic testing plan:

1. Run `clawhub search` for a known topic.
2. Install one test skill into a workspace.
3. Run `clawhub list`.
4. Run `clawhub update` safely on a test skill.

Note:

- Treat `https://clawhub.ai` as canonical (some local docs/skills may still reference older `clawhub.com` wording).

## 5) `session-logs`

Why:

- Useful for debugging Harry/Bob behavior drift and reviewing prior runs.

Local skill:

- `openclaw-agents/skills/session-logs/SKILL.md`

Basic testing plan:

1. Query a known prior session.
2. Extract user-only and assistant-only messages.
3. Pull a session/day cost summary.
4. Use once after a Bob research run to inspect behavior/citation failures.

## Priority For Bob (Direct Use)

## 1) `wikipedia`

Why:

- No auth, no binary, structured and fast.
- Excellent orientation step before broader web fetch and synthesis.

Local skill:

- `openclaw-agents/skills/wikipedia/SKILL.md`

Basic testing plan:

1. Fetch article summary for a known topic.
2. Use title search for an ambiguous term.
3. Fetch full sections for a deeper topic.
4. Confirm Bob cites the article URL and labels Wikipedia as orientation when higher rigor is needed.

## 2) `nano-pdf`

Why:

- Useful for papers, reports, and document-heavy research.

Local skill:

- `openclaw-agents/skills/nano-pdf/SKILL.md`

Basic testing plan:

1. Run on a test PDF and verify page targeting.
2. Confirm Bob can inspect/edit without damaging output.
3. Record page-index quirks in Bob `TOOLS.md` if observed.

## 3) `summarize`

Why:

- Good preprocessor for long URLs/files before Bob synthesizes and cites.

Local skill:

- `openclaw-agents/skills/summarize/SKILL.md`

Basic testing plan:

1. Summarize a long article URL.
2. Summarize a PDF.
3. Test `--extract-only` or JSON output flow for structured intake.
4. Confirm Bob still cites original sources, not only the summarize output.

## 4) `oracle` (advisory deep dive)

Why:

- Useful for long-form analysis with bundled context when Harry/Bob want a second-pass synthesis.

Local skill:

- `openclaw-agents/skills/oracle/SKILL.md`

Basic testing plan:

1. Run a dry-run with a small file set.
2. Run one browser-based deep analysis prompt.
3. Confirm results are treated as advisory and primary-source citations remain separate.

## ClawHub Deep-Research Skills To Trial For Bob (Ranked)

These were identified via the local `awesome-openclaw-skills` catalog and should be trialed through a specialist/staging agent first.

## 1) `academic-deep-research` (best first trial)

Why:

- Strong methodology with source/citation/contradiction handling.
- Uses native OpenClaw research tools, which fits Bob's operating model.

Tradeoff:

- Prescriptive and potentially verbose; may need a local wrapper skill for routine use.

Recommendation:

- Trial first in a specialist or staging research agent.

## 2) `gemini-deep-research`

Why:

- Purpose-built for long-running multi-source synthesis via Gemini's deep research flow.

Tradeoff:

- Requires direct `GEMINI_API_KEY`.
- More of an API/service wrapper than transparent in-tool methodology.

Recommendation:

- Trial behind a dedicated specialist agent (for example `deep-research-runner`) rather than placing directly in Bob initially.

## 3) `research` (pors/research)

Why:

- Interesting pattern for offloading deep research to Gemini CLI in a spawned sub-agent.
- Aligns with your local Gemini CLI setup.

Tradeoff:

- Appears older / more opinionated and likely needs adaptation to your current environment.

Recommendation:

- Use as inspiration/reference for a local wrapper pattern more than a direct install-first choice.

## 4) `deepwiki`

Why:

- Strong for GitHub repository docs/wiki research, not generic web deep research.

Tradeoff:

- Depends on DeepWiki MCP and is narrower in scope.

Recommendation:

- Consider as a separate specialist agent (`repo-doc-researcher`) or Bob support tool if repo/documentation research becomes common.

## 5) Generic `deep-research` / `research*` slugs (various)

Why:

- There are many candidates in ClawHub and the awesome catalog.

Tradeoff:

- Quality and trust vary widely; some are thin wrappers, duplicates, or external-platform dependent.

Recommendation:

- Screen through `skill-intake`; do not add directly to Bob.

## Recommended Near-Term Setup

## Harry direct skills

- `coding-agent`
- `gemini`
- `clawhub`
- `tmux`
- `session-logs`

## Bob direct skills

- `wikipedia`
- `nano-pdf`
- `summarize`
- `oracle`

## Bob deep-research trial path

1. Start with built-in `web_search` + `web_fetch` + `wikipedia` and confirm Bob's research brief quality.
2. Add `summarize` for long-source preprocessing.
3. Trial `academic-deep-research` in a specialist/staging agent.
4. If Gemini offload is attractive, trial `gemini-deep-research` next.

## Optional specialist to support Bob

- `deep-research-runner` (wrapper agent around one deep-research skill)

Why:

- Keeps Bob's core behavior stable while allowing experimentation with heavier research orchestration skills.

## Rationale

- Harry stays focused on orchestration and local execution.
- Bob gets reliable source-first tools before adding heavy orchestration.
- Deep-research skills are introduced behind a wrapper/specialist pattern, reducing risk and prompt sprawl.
