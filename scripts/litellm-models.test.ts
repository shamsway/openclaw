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
