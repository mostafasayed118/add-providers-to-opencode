export type Preset = {
  id: string;
  name: string;
  baseURL: string;
  providerId: string;
  context?: number;
};

export const PRESETS: Preset[] = [
  {
    id: "ollama",
    name: "Ollama (local)",
    baseURL: "http://localhost:11434/v1",
    providerId: "ollama",
  },
  {
    id: "lmstudio",
    name: "LM Studio (local)",
    baseURL: "http://localhost:1234/v1",
    providerId: "lmstudio",
  },
  {
    id: "llamacpp",
    name: "llama.cpp (local)",
    baseURL: "http://127.0.0.1:8080/v1",
    providerId: "llamacpp",
    context: 128000,
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    baseURL: "https://openrouter.ai/api/v1",
    providerId: "openrouter",
  },
  {
    id: "runinfra",
    name: "RunInfra",
    baseURL: "https://api.runinfra.ai/v1",
    providerId: "runinfra",
  },
  {
    id: "together",
    name: "Together AI",
    baseURL: "https://api.together.xyz/v1",
    providerId: "together",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    baseURL: "https://api.deepseek.com/v1",
    providerId: "deepseek",
  },
  {
    id: "groq",
    name: "Groq",
    baseURL: "https://api.groq.com/openai/v1",
    providerId: "groq",
  },
];
