# LiteLLM Models Config Generator Script

## Purpose

A standalone TypeScript script (`scripts/litellm-models.ts`) that fetches the model list from a LiteLLM `/v1/models` endpoint and outputs a partial OpenClaw JSON config fragment for merging into `openclaw.json`.

## Motivation

When deploying multiple OpenClaw clients with various model/provider combinations, centralizing LLM calls through LiteLLM provides tracing and observability. This script automates the tedious process of manually configuring each model from LiteLLM into OpenClaw's provider and agent config format.

## Interface

```
bun scripts/litellm-models.ts \
  --url http://litellm.example.com:4000 \
  --api-key sk-... \
  --primary openai/gpt-4o \
  --fallbacks anthropic/claude-sonnet-4,google/gemini-2.5-pro
```

| Flag | Required | Env fallback | Description |
|------|----------|-------------|-------------|
| `--url` | Yes | `LITELLM_URL` | Base URL of the LiteLLM instance (without `/v1/models`) |
| `--api-key` | No | `LITELLM_API_KEY` | API key for LiteLLM auth |
| `--primary` | Yes | -- | Model ID to use as primary |
| `--fallbacks` | No | -- | Comma-separated model IDs for fallback list |
| `--provider-name` | No | -- | Override the provider key name (default: `litellm`) |
| `--api` | No | -- | Override the API type (default: `openai-completions`) |

## Output

Printed to stdout as JSON (valid JSON5). Example:

```json
{
  "models": {
    "mode": "merge",
    "providers": {
      "litellm": {
        "baseUrl": "http://litellm.example.com:4000/v1",
        "apiKey": "sk-...",
        "api": "openai-completions",
        "models": [
          {
            "id": "openai/gpt-4o",
            "name": "openai/gpt-4o",
            "reasoning": false,
            "input": ["text"],
            "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 },
            "contextWindow": 128000,
            "maxTokens": 8192
          }
        ]
      }
    }
  },
  "agents": {
    "defaults": {
      "model": {
        "primary": "litellm/openai/gpt-4o",
        "fallbacks": ["litellm/anthropic/claude-sonnet-4", "litellm/google/gemini-2.5-pro"]
      }
    }
  }
}
```

## Behavior

1. Parse CLI args (simple loop, no external deps -- matching repo convention).
2. Fetch `${url}/v1/models` with optional `Authorization: Bearer ${apiKey}` header.
3. Parse the OpenAI-compatible response (`{ data: [{ id, object, created, owned_by }] }`).
4. Map each model to a `ModelDefinitionConfig` with sensible defaults (128k context, 8k max tokens, text-only, no reasoning, zero cost).
5. Validate that `--primary` exists in the fetched model list (error if not).
6. Validate that all `--fallbacks` exist in the fetched model list (warn if any missing).
7. Build the partial config object and print as JSON to stdout.
8. Model references in `agents.defaults.model` are prefixed with the provider name (`litellm/model-id`) to match OpenClaw's `provider/model` convention.

## Error Handling

- Missing `--url` or `--primary`: print usage and exit 1.
- Fetch failure: print error message and exit 1.
- Primary model not in list: print available models and exit 1.
- Fallback model not in list: warn to stderr, continue with valid ones.

## Scope Boundaries

- No writing to `~/.openclaw/openclaw.json` -- output goes to stdout only.
- No model capability detection -- uses sensible defaults.
- No persistent state or caching.
- Single LiteLLM instance target per invocation.

## Implementation Conventions

- TypeScript ESM, executed via `bun scripts/litellm-models.ts`.
- Simple arg parsing loop (no yargs/commander).
- `node:fs` not needed (stdout only); native `fetch` for HTTP.
- Error output via `console.error()` + `process.exit(1)`.
- Follows patterns from `scripts/protocol-gen.ts` and `scripts/sync-plugin-versions.ts`.
