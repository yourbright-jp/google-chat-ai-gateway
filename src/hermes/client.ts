import { HermesChatResponseSchema, type HermesChatRequest } from "./schemas.js";

export type HermesClientOptions = {
  endpoint: string;
  apiToken?: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
};

export class HermesClient {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: HermesClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async sendMessage(request: HermesChatRequest): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);

    try {
      const response = await this.fetchImpl(this.options.endpoint, {
        method: "POST",
        headers: this.buildHeaders(),
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Hermes request failed with ${response.status}`);
      }

      const payload: unknown = await response.json();
      const hermesResponse = HermesChatResponseSchema.parse(payload);
      return hermesResponse.text ?? hermesResponse.message ?? "";
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildHeaders(): HeadersInit {
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };

    if (this.options.apiToken) {
      headers.authorization = `Bearer ${this.options.apiToken}`;
    }

    return headers;
  }
}
