import { UpstreamChatResponseSchema, type UpstreamChatRequest } from "./schemas.js";

export type UpstreamClientOptions = {
  endpoint: string;
  bearerToken?: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
};

export class UpstreamClient {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: UpstreamClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async sendMessage(request: UpstreamChatRequest): Promise<string> {
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
        throw new Error(`Upstream request failed with ${response.status}`);
      }

      const payload: unknown = await response.json();
      const upstreamResponse = UpstreamChatResponseSchema.parse(payload);
      return upstreamResponse.text ?? upstreamResponse.message ?? "";
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildHeaders(): HeadersInit {
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };

    if (this.options.bearerToken) {
      headers.authorization = `Bearer ${this.options.bearerToken}`;
    }

    return headers;
  }
}
