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
