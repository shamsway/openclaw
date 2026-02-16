import type { ModelApi, ModelDefinitionConfig } from "../src/config/types.models.js";

export type LiteLLMModel = {
  id: string;
  object: string;
  created: number;
  owned_by: string;
};

export type ScriptArgs = {
  url: string;
  apiKey: string | undefined;
  primary: string;
  fallbacks: string[];
  providerName: string;
  api: ModelApi;
};

const DEFAULT_PRIMARY_MODEL = "anthropic/claude-sonnet-4-5-20250929";

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
  primary ??= DEFAULT_PRIMARY_MODEL;

  return { url, apiKey, primary, fallbacks, providerName, api };
}

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
  console.error(`Usage: bun scripts/litellm-models.ts --url <litellm-url> [--primary <model-id>] [options]

Required:
  --url <url>              LiteLLM base URL (or set LITELLM_URL env var)

Optional:
  --primary <model-id>     Model ID to use as primary (default: ${DEFAULT_PRIMARY_MODEL})
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

// Only run main if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
