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
