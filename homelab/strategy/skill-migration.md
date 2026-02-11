# Skill Migration: Claude Code → OpenClaw

How to adapt existing Claude Code skills for use as OpenClaw skills.

---

## What Maps Directly

- **Skill content** — the instructions, workflows, and prompts in the markdown body translate
  almost verbatim. This is the valuable part.
- **Intent routing** — Claude Code uses `description` + `triggers`; OpenClaw uses `description`
  alone. The concept is the same; fold trigger patterns into the description if needed.

---

## Key Differences

| | Claude Code | OpenClaw |
|---|---|---|
| **Structure** | Single `.md` file | Directory + `SKILL.md` |
| **Metadata** | Flexible YAML fields | Strict `metadata.openclaw` JSON |
| **Dependency gating** | None (prose only) | Native: `requires.bins`, `requires.env` |
| **Auto-install** | None | Built-in brew/npm/go/pip specs |
| **Resources** | Single file | `scripts/`, `references/`, `assets/` subdirs |
| **Invocation** | `Skill` tool / intent match | Model-auto + `/skill-name` slash command |

---

## Conversion Recipe

### 1. Restructure the file

```
# Before (Claude Code)
.claude/skills/my-skill.md

# After (OpenClaw)
skills/my-skill/
└── SKILL.md
```

The body content moves as-is.

### 2. Rewrite the frontmatter

```yaml
# Claude Code
---
description: Does X when Y happens
triggers:
  - when user mentions Y
examples:
  - Example usage
---
```

```yaml
# OpenClaw
---
name: my-skill
description: Does X when Y happens. Use when...
metadata: {"openclaw": {"emoji": "🔧", "requires": {"bins": ["needed-binary"]}}}
---
```

Drop `triggers` and `examples`. If the trigger patterns add useful routing context,
fold them into the `description` sentence.

### 3. Add dependency gating (homelab bonus)

Skills with binary or environment requirements should declare them explicitly — the skill
won't appear on nodes where it can't run:

```yaml
# Requires a binary on PATH
metadata: {"openclaw": {"requires": {"bins": ["nomad"]}}}

# Requires an environment variable
metadata: {"openclaw": {"requires": {"env": ["NOMAD_TOKEN"]}}}

# Requires either of two binaries
metadata: {"openclaw": {"requires": {"anyBins": ["brew", "apt-get"]}}}

# Requires a config key to be set
metadata: {"openclaw": {"requires": {"config": ["skills.entries.my-skill.apiKey"]}}}
```

### 4. Split out resources (optional, for larger skills)

For skills with embedded reference docs, templates, or scripts:

```
skills/my-skill/
├── SKILL.md          ← core instructions, keep concise
├── references/       ← reference docs, API docs, examples
├── scripts/          ← helper scripts invoked by the skill
└── assets/           ← templates, static files
```

Reference them from `SKILL.md` with relative links:
`See [references/api.md](references/api.md) for full API details.`

---

## Size Limit to Watch

OpenClaw's agent has a `bootstrapMaxChars` limit (default: 20,000 chars) shared across all
loaded files. Skills with very large markdown bodies may need to be trimmed or have reference
content moved to `references/`.

---

## What You Lose (Minimally)

`triggers` and `examples` don't have direct equivalents, but they're not needed — the model
routes based on `description` the same way. The main thing to ensure is that descriptions are
clear about *when* to invoke the skill.

---

## Quick Reference: Full Metadata Fields

```yaml
metadata: {
  "openclaw": {
    "emoji": "🔧",              # UI icon
    "os": ["darwin", "linux"],  # platform targeting
    "requires": {
      "bins": ["tool"],         # all required
      "anyBins": ["a", "b"],    # at least one required
      "env": ["MY_TOKEN"],      # env vars required
      "config": ["skills.entries.x.apiKey"]  # config keys required
    },
    "install": [
      {
        "id": "brew-tool",
        "kind": "brew",
        "package": "tool",
        "label": "Install tool (Homebrew)"
      }
    ],
    "primaryEnv": "MY_TOKEN",   # env var for the primary API key
    "always": true              # always include, skip other gates
  }
}
```

Supported `install.kind` values: `brew`, `node`, `go`, `uv`, `download`

---

## Estimated Effort

For a typical Claude Code skill (instructions-focused, no heavy dependencies):
- Restructure + frontmatter rewrite: ~15 min per skill, mostly mechanical
- Add `requires` metadata: 5 min if dependencies are clear
- Content trimming (if over size limit): varies

Skills that are primarily large reference docs or heavily tool-dependent may need more
substantial refactoring.
