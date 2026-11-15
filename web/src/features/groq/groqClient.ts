/**
 * Groq high-speed LLM and Vision client for multimodal prescription digitization
 * and real-time pill strip verification.
 */

export interface GroqChatMessage {
  role: 'system' | 'user' | 'assistant';
  content:
    string | ({ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } })[];
}

export interface GroqChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
export const GROQ_TEXT_MODEL = import.meta?.env?.VITE_GROQ_TEXT_MODEL || 'openai/gpt-oss-20b';
export const GROQ_VISION_MODEL = import.meta?.env?.VITE_GROQ_VISION_MODEL || 'qwen/qwen3.8-27b';

/** Get the configured Groq API key from Vite client or server environment. */
function getGroqApiKey(): string {
  // Production security guarantee: Never bake provider API keys into client bundles.
  if (import.meta?.env?.PROD) {
    return '';
  }
  if (import.meta?.env?.VITE_GROQ_API_KEY) {
    return String(import.meta.env.VITE_GROQ_API_KEY).trim();
  }
  if (typeof process !== 'undefined' && process.env?.GROQ_API_KEY) {
    return String(process.env.GROQ_API_KEY).trim();
  }
  return '';
}

export function isGroqConfigured(): boolean {
  return Boolean(getGroqApiKey());
}

/**
 * Execute a completion request against Groq's high-speed API.
 */
export async function callGroqChat(
  messages: GroqChatMessage[],
  options: GroqChatOptions = {},
): Promise<string> {
  const apiKey = getGroqApiKey();
  if (!apiKey) {
    throw new Error('Groq API key is not configured.');
  }

  const model = options.model ?? GROQ_TEXT_MODEL;
  const payload: Record<string, unknown> = {
    model,
    messages,
    temperature: options.temperature ?? 0.1,
    max_tokens: options.maxTokens ?? 1024,
  };

  if (options.jsonMode) {
    payload.response_format = { type: 'json_object' };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, 25000);

  try {
    const response = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let message = `Groq API error (${response.status})`;
      try {
        const errorJson = JSON.parse(errorText) as { error?: { message?: string } };
        if (errorJson.error?.message) message = errorJson.error.message;
      } catch {
        // use raw message
      }
      throw new Error(message);
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Groq returned an empty response.');
    }

    return content;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Send an image along with a prompt to Groq's Vision model.
 */
export async function callGroqVision(
  prompt: string,
  base64DataUrl: string,
  options: GroqChatOptions = {},
): Promise<string> {
  const messages: GroqChatMessage[] = [
    {
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: base64DataUrl } },
      ],
    },
  ];

  return callGroqChat(messages, {
    model: options.model ?? GROQ_VISION_MODEL,
    temperature: options.temperature ?? 0.1,
    maxTokens: options.maxTokens ?? 1024,
    jsonMode: options.jsonMode,
  });
}
