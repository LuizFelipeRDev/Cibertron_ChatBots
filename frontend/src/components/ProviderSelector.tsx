const PROVIDER_KEY = "punkbot_provider";
const GROK_KEY = "punkbot_grok_api_key";

export type Provider = "gemini" | "grok" | "groq";

export function getProvider(): Provider {
  return (localStorage.getItem(PROVIDER_KEY) as Provider) || "gemini";
}

export function getGrokApiKey(): string {
  return localStorage.getItem(GROK_KEY) || "";
}
