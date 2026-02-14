import { describe, expect, it } from "vitest";
import { buildConfig, parseArgs, toModelDefinition, validateModels } from "./litellm-models.js";
import type { LiteLLMModel } from "./litellm-models.js";

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
      if (prev === undefined) {
        delete process.env.LITELLM_API_KEY;
      } else {
        process.env.LITELLM_API_KEY = prev;
      }
    }
  });

  it("reads url from LITELLM_URL env when flag omitted", () => {
    const prev = process.env.LITELLM_URL;
    process.env.LITELLM_URL = "http://env-host:4000";
    try {
      const result = parseArgs(["--primary", "m"]);
      expect(result.url).toBe("http://env-host:4000");
    } finally {
      if (prev === undefined) {
        delete process.env.LITELLM_URL;
      } else {
        process.env.LITELLM_URL = prev;
      }
    }
  });

  it("throws when --url and LITELLM_URL are both missing", () => {
    const prev = process.env.LITELLM_URL;
    delete process.env.LITELLM_URL;
    try {
      expect(() => parseArgs(["--primary", "m"])).toThrow("--url");
    } finally {
      if (prev !== undefined) {
        process.env.LITELLM_URL = prev;
      }
    }
  });

  it("throws when --primary is missing", () => {
    expect(() => parseArgs(["--url", "http://localhost:4000"])).toThrow("--primary");
  });
});

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
