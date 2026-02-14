# LiteLLM Models Config Generator - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a script that fetches models from a LiteLLM `/v1/models` endpoint and outputs partial OpenClaw config JSON for merging into `openclaw.json`.

**Architecture:** Single TypeScript file with pure functions extracted for testability. CLI entry point parses args, fetches models, delegates to pure transform functions, prints JSON to stdout.

**Tech Stack:** TypeScript ESM, native `fetch`, Vitest for tests, no external deps.

---

### Task 1: Arg Parsing and Core Types

**Files:**
- Create: `scripts/litellm-models.ts`
- Create: `scripts/litellm-models.test.ts`

**Step 1: Write the failing test for arg parsing**

In `scripts/litellm-models.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { parseArgs } from "./litellm-models.js";

describe("parseArgs", () => {
  it("parses required and optional flags", () => {
    const result = parseArgs([
      "--url", "http://localhost:4000",
      "--api-key", "sk-test",
      "--primary", "openai/gpt-4o",
      "--fallbacks", "anthropic/claude-sonnet-4,google/gemini-2.5-pro",
      "--provider-name", "my-litellm",
      "--api", "openai-responses",
    ]);
    expect(result).toEqual({
      url: "http://localhost:4000",
      apiKey: "sk-test",
      primary: "openai/gpt-4o",
      fallbacks: ["anthropic/claude-sonnet-4", "google/gemini-2.5-pro"],
      providerName: "my-litellm",
      api: "openai-responses",
    });
  });

  it("uses defaults for optional flags", () => {
    const result = parseArgs([
      "--url", "http://localhost:4000",
      "--primary", "openai/gpt-4o",
    ]);
    expect(result).toEqual({
      url: "http://localhost:4000",
      apiKey: undefined,
      primary: "openai/gpt-4o",
      fallbacks: [],
      providerName: "litellm",
      api: "openai-completions",
    });
  });

  it("reads apiKey from LITELLM_API_KEY env when flag omitted", () => {
    const prev = process.env.LITELLM_API_KEY;
    process.env.LITELLM_API_KEY = "sk-env";
    try {
      const result = parseArgs(["--url", "http://localhost:4000", "--primary", "m"]);
      expect(result.apiKey).toBe("sk-env");
    } finally {
      if (prev === undefined) delete process.env.LITELLM_API_KEY;
      else process.env.LITELLM_API_KEY = prev;
    }
  });

  it("reads url from LITELLM_URL env when flag omitted", () => {
    const prev = process.env.LITELLM_URL;
    process.env.LITELLM_URL = "http://env-host:4000";
    try {
      const result = parseArgs(["--primary", "m"]);
      expect(result.url).toBe("http://env-host:4000");
    } finally {
      if (prev === undefined) delete process.env.LITELLM_URL;
      else process.env.LITELLM_URL = prev;
    }
  });

  it("throws when --url and LITELLM_URL are both missing", () => {
    const prev = process.env.LITELLM_URL;
    delete process.env.LITELLM_URL;
    try {
      expect(() => parseArgs(["--primary", "m"])).toThrow("--url");
    } finally {
      if (prev !== undefined) process.env.LITELLM_URL = prev;
    }
  });

  it("throws when --primary is missing", () => {
    expect(() => parseArgs(["--url", "http://localhost:4000"])).toThrow("--primary");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run scripts/litellm-models.test.ts`
Expected: FAIL (module not found)

**Step 3: Write the implementation**

In `scripts/litellm-models.ts`, add the types and `parseArgs` function:

```typescript
import type { ModelApi } from "../src/config/types.models.js";

export type ScriptArgs = {
  url: string;
  apiKey: string | undefined;
  primary: string;
  fallbacks: string[];
  providerName: string;
  api: ModelApi;
};

export function parseArgs(argv: string[]): ScriptArgs {
  let url: string | undefined;
  let apiKey: string | undefined;
  let primary: string | undefined;
  let fallbacks: string[] = [];
  let providerName = "litellm";
  let api: ModelApi = "openai-completions";

  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case "--url":
        url = argv[++i];
        break;
      case "--api-key":
        apiKey = argv[++i];
        break;
      case "--primary":
        primary = argv[++i];
        break;
      case "--fallbacks":
        fallbacks = argv[++i]!.split(",").map((s) => s.trim()).filter(Boolean);
        break;
      case "--provider-name":
        providerName = argv[++i]!;
        break;
      case "--api":
        api = argv[++i] as ModelApi;
        break;
    }
  }

  url ??= process.env.LITELLM_URL;
  apiKey ??= process.env.LITELLM_API_KEY;

  if (!url) {
    throw new Error("Missing required --url flag or LITELLM_URL env var");
  }
  if (!primary) {
    throw new Error("Missing required --primary flag");
  }

  return { url, apiKey, primary, fallbacks, providerName, api };
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run scripts/litellm-models.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
scripts/committer "feat: add litellm-models script arg parsing with tests" scripts/litellm-models.ts scripts/litellm-models.test.ts
```

---

### Task 2: Model Mapping Function

**Files:**
- Modify: `scripts/litellm-models.ts`
- Modify: `scripts/litellm-models.test.ts`

**Step 1: Write the failing test for model mapping**

Append to `scripts/litellm-models.test.ts`:

```typescript
import { toModelDefinition } from "./litellm-models.js";
import type { LiteLLMModel } from "./litellm-models.js";

describe("toModelDefinition", () => {
  it("maps a LiteLLM model entry to ModelDefinitionConfig", () => {
    const input: LiteLLMModel = {
      id: "openai/gpt-4o",
      object: "model",
      created: 1700000000,
      owned_by: "openai",
    };
    const result = toModelDefinition(input);
    expect(result).toEqual({
      id: "openai/gpt-4o",
      name: "openai/gpt-4o",
      reasoning: false,
      input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 128000,
      maxTokens: 8192,
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run scripts/litellm-models.test.ts`
Expected: FAIL (toModelDefinition not exported)

**Step 3: Write the implementation**

Add to `scripts/litellm-models.ts`:

```typescript
import type { ModelDefinitionConfig } from "../src/config/types.models.js";

export type LiteLLMModel = {
  id: string;
  object: string;
  created: number;
  owned_by: string;
};

export function toModelDefinition(model: LiteLLMModel): ModelDefinitionConfig {
  return {
    id: model.id,
    name: model.id,
    reasoning: false,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128000,
    maxTokens: 8192,
  };
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run scripts/litellm-models.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
scripts/committer "feat: add LiteLLM model-to-config mapping" scripts/litellm-models.ts scripts/litellm-models.test.ts
```

---

### Task 3: Config Builder Function

**Files:**
- Modify: `scripts/litellm-models.ts`
- Modify: `scripts/litellm-models.test.ts`

**Step 1: Write the failing test for config building**

Append to `scripts/litellm-models.test.ts`:

```typescript
import { buildConfig } from "./litellm-models.js";

describe("buildConfig", () => {
  const models: LiteLLMModel[] = [
    { id: "openai/gpt-4o", object: "model", created: 1, owned_by: "openai" },
    { id: "anthropic/claude-sonnet-4", object: "model", created: 2, owned_by: "anthropic" },
    { id: "google/gemini-2.5-pro", object: "model", created: 3, owned_by: "google" },
  ];

  it("builds partial openclaw config with primary and fallbacks", () => {
    const result = buildConfig({
      models,
      args: {
        url: "http://localhost:4000",
        apiKey: "sk-test",
        primary: "openai/gpt-4o",
        fallbacks: ["anthropic/claude-sonnet-4"],
        providerName: "litellm",
        api: "openai-completions",
      },
    });

    expect(result.models.mode).toBe("merge");
    expect(result.models.providers.litellm.baseUrl).toBe("http://localhost:4000/v1");
    expect(result.models.providers.litellm.apiKey).toBe("sk-test");
    expect(result.models.providers.litellm.api).toBe("openai-completions");
    expect(result.models.providers.litellm.models).toHaveLength(3);
    expect(result.agents.defaults.model.primary).toBe("litellm/openai/gpt-4o");
    expect(result.agents.defaults.model.fallbacks).toEqual(["litellm/anthropic/claude-sonnet-4"]);
  });

  it("omits apiKey from config when undefined", () => {
    const result = buildConfig({
      models,
      args: {
        url: "http://localhost:4000",
        apiKey: undefined,
        primary: "openai/gpt-4o",
        fallbacks: [],
        providerName: "litellm",
        api: "openai-completions",
      },
    });

    expect(result.models.providers.litellm.apiKey).toBeUndefined();
  });

  it("strips trailing slash from url before appending /v1", () => {
    const result = buildConfig({
      models,
      args: {
        url: "http://localhost:4000/",
        apiKey: undefined,
        primary: "openai/gpt-4o",
        fallbacks: [],
        providerName: "litellm",
        api: "openai-completions",
      },
    });

    expect(result.models.providers.litellm.baseUrl).toBe("http://localhost:4000/v1");
  });

  it("does not double-append /v1 if url already ends with it", () => {
    const result = buildConfig({
      models,
      args: {
        url: "http://localhost:4000/v1",
        apiKey: undefined,
        primary: "openai/gpt-4o",
        fallbacks: [],
        providerName: "litellm",
        api: "openai-completions",
      },
    });

    expect(result.models.providers.litellm.baseUrl).toBe("http://localhost:4000/v1");
  });

  it("uses custom provider name", () => {
    const result = buildConfig({
      models,
      args: {
        url: "http://localhost:4000",
        apiKey: undefined,
        primary: "openai/gpt-4o",
        fallbacks: [],
        providerName: "my-proxy",
        api: "openai-completions",
      },
    });

    expect(result.models.providers["my-proxy"]).toBeDefined();
    expect(result.agents.defaults.model.primary).toBe("my-proxy/openai/gpt-4o");
  });

  it("omits fallbacks key when list is empty", () => {
    const result = buildConfig({
      models,
      args: {
        url: "http://localhost:4000",
        apiKey: undefined,
        primary: "openai/gpt-4o",
        fallbacks: [],
        providerName: "litellm",
        api: "openai-completions",
      },
    });

    expect(result.agents.defaults.model.fallbacks).toBeUndefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run scripts/litellm-models.test.ts`
Expected: FAIL (buildConfig not exported)

**Step 3: Write the implementation**

Add to `scripts/litellm-models.ts`:

```typescript
type PartialOpenClawConfig = {
  models: {
    mode: "merge";
    providers: Record<string, {
      baseUrl: string;
      apiKey?: string;
      api: ModelApi;
      models: ModelDefinitionConfig[];
    }>;
  };
  agents: {
    defaults: {
      model: {
        primary: string;
        fallbacks?: string[];
      };
    };
  };
};

export function buildConfig(params: {
  models: LiteLLMModel[];
  args: ScriptArgs;
}): PartialOpenClawConfig {
  const { models, args } = params;

  let baseUrl = args.url.replace(/\/+$/, "");
  if (!baseUrl.endsWith("/v1")) {
    baseUrl += "/v1";
  }

  const provider: PartialOpenClawConfig["models"]["providers"][string] = {
    baseUrl,
    api: args.api,
    models: models.map(toModelDefinition),
  };
  if (args.apiKey) {
    provider.apiKey = args.apiKey;
  }

  const modelConfig: PartialOpenClawConfig["agents"]["defaults"]["model"] = {
    primary: `${args.providerName}/${args.primary}`,
  };
  if (args.fallbacks.length > 0) {
    modelConfig.fallbacks = args.fallbacks.map((f) => `${args.providerName}/${f}`);
  }

  return {
    models: {
      mode: "merge",
      providers: { [args.providerName]: provider },
    },
    agents: {
      defaults: { model: modelConfig },
    },
  };
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run scripts/litellm-models.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
scripts/committer "feat: add config builder for litellm-models script" scripts/litellm-models.ts scripts/litellm-models.test.ts
```

---

### Task 4: Validation Functions

**Files:**
- Modify: `scripts/litellm-models.ts`
- Modify: `scripts/litellm-models.test.ts`

**Step 1: Write the failing test for validation**

Append to `scripts/litellm-models.test.ts`:

```typescript
import { validateModels } from "./litellm-models.js";

describe("validateModels", () => {
  const modelIds = ["openai/gpt-4o", "anthropic/claude-sonnet-4", "google/gemini-2.5-pro"];

  it("returns valid result when primary and all fallbacks exist", () => {
    const result = validateModels({
      availableIds: modelIds,
      primary: "openai/gpt-4o",
      fallbacks: ["anthropic/claude-sonnet-4"],
    });
    expect(result.valid).toBe(true);
    expect(result.validFallbacks).toEqual(["anthropic/claude-sonnet-4"]);
    expect(result.warnings).toEqual([]);
  });

  it("returns invalid when primary is not in list", () => {
    const result = validateModels({
      availableIds: modelIds,
      primary: "openai/gpt-5",
      fallbacks: [],
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("gpt-5");
    expect(result.error).toContain("openai/gpt-4o");
  });

  it("warns and filters when a fallback is not in list", () => {
    const result = validateModels({
      availableIds: modelIds,
      primary: "openai/gpt-4o",
      fallbacks: ["anthropic/claude-sonnet-4", "missing/model"],
    });
    expect(result.valid).toBe(true);
    expect(result.validFallbacks).toEqual(["anthropic/claude-sonnet-4"]);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("missing/model");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run scripts/litellm-models.test.ts`
Expected: FAIL (validateModels not exported)

**Step 3: Write the implementation**

Add to `scripts/litellm-models.ts`:

```typescript
type ValidationResult = {
  valid: boolean;
  error?: string;
  validFallbacks: string[];
  warnings: string[];
};

export function validateModels(params: {
  availableIds: string[];
  primary: string;
  fallbacks: string[];
}): ValidationResult {
  const { availableIds, primary, fallbacks } = params;
  const idSet = new Set(availableIds);

  if (!idSet.has(primary)) {
    return {
      valid: false,
      error: `Primary model "${primary}" not found. Available models:\n${availableIds.map((id) => `  - ${id}`).join("\n")}`,
      validFallbacks: [],
      warnings: [],
    };
  }

  const warnings: string[] = [];
  const validFallbacks: string[] = [];
  for (const fb of fallbacks) {
    if (idSet.has(fb)) {
      validFallbacks.push(fb);
    } else {
      warnings.push(`Fallback model "${fb}" not found in available models, skipping.`);
    }
  }

  return { valid: true, validFallbacks, warnings };
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run scripts/litellm-models.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
scripts/committer "feat: add model validation for litellm-models script" scripts/litellm-models.ts scripts/litellm-models.test.ts
```

---

### Task 5: CLI Main Function (Fetch + Orchestration)

**Files:**
- Modify: `scripts/litellm-models.ts`

**Step 1: Write the main function**

Add to the bottom of `scripts/litellm-models.ts`:

```typescript
type LiteLLMModelsResponse = {
  data: LiteLLMModel[];
  object: string;
};

async function fetchModels(url: string, apiKey: string | undefined): Promise<LiteLLMModel[]> {
  const endpoint = `${url.replace(/\/+$/, "")}/v1/models`;
  const headers: Record<string, string> = {};
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const res = await fetch(endpoint, { headers });
  if (!res.ok) {
    throw new Error(`Failed to fetch models from ${endpoint}: ${res.status} ${res.statusText}`);
  }

  const body = (await res.json()) as LiteLLMModelsResponse;
  return body.data;
}

function printUsage(): void {
  console.error(`Usage: bun scripts/litellm-models.ts --url <litellm-url> --primary <model-id> [options]

Required:
  --url <url>              LiteLLM base URL (or set LITELLM_URL env var)
  --primary <model-id>     Model ID to use as primary

Optional:
  --api-key <key>          API key (or set LITELLM_API_KEY env var)
  --fallbacks <m1,m2,...>  Comma-separated fallback model IDs
  --provider-name <name>   Provider key in config (default: litellm)
  --api <api-type>         API type (default: openai-completions)`);
}

async function main() {
  let args: ScriptArgs;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    printUsage();
    console.error(`\nError: ${(err as Error).message}`);
    process.exit(1);
  }

  let models: LiteLLMModel[];
  try {
    models = await fetchModels(args.url, args.apiKey);
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`);
    process.exit(1);
  }

  if (models.length === 0) {
    console.error("No models returned from the LiteLLM endpoint.");
    process.exit(1);
  }

  const availableIds = models.map((m) => m.id);
  const validation = validateModels({
    availableIds,
    primary: args.primary,
    fallbacks: args.fallbacks,
  });

  for (const warning of validation.warnings) {
    console.error(`Warning: ${warning}`);
  }

  if (!validation.valid) {
    console.error(`Error: ${validation.error}`);
    process.exit(1);
  }

  // Use validated fallbacks (invalid ones filtered out)
  args.fallbacks = validation.validFallbacks;

  const config = buildConfig({ models, args });
  console.log(JSON.stringify(config, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

**Step 2: Verify script runs with --help-like behavior (no args)**

Run: `bun scripts/litellm-models.ts`
Expected: Prints usage + error about missing --url, exits 1

**Step 3: Commit**

```bash
scripts/committer "feat: add CLI main function for litellm-models script" scripts/litellm-models.ts
```

---

### Task 6: Final Verification

**Step 1: Run all tests**

Run: `pnpm vitest run scripts/litellm-models.test.ts`
Expected: All tests PASS

**Step 2: Run lint**

Run: `pnpm lint`
Expected: No errors in new files

**Step 3: Run format**

Run: `pnpm format`
Expected: Files formatted

**Step 4: Final commit if lint/format changed anything**

```bash
scripts/committer "chore: format litellm-models script" scripts/litellm-models.ts scripts/litellm-models.test.ts
```
