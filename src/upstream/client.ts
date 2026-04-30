import {
  OpenAiChatCompletionResponseSchema,
  UpstreamChatResponseSchema,
  type UpstreamChatRequest,
} from "./schemas.js";

export type UpstreamFormat = "webhook" | "openai-chat-completions";

export type UpstreamClientOptions = {
  endpoint: string;
  bearerToken?: string;
  format?: UpstreamFormat;
  model?: string;
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
        body: JSON.stringify(this.buildBody(request)),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Upstream request failed with ${response.status}`);
      }

      const payload: unknown = await response.json();
      if (this.options.format === "openai-chat-completions") {
        const chatCompletion = OpenAiChatCompletionResponseSchema.parse(payload);
        return chatCompletion.choices[0]?.message.content ?? "";
      }

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

  private buildBody(request: UpstreamChatRequest): unknown {
    if (this.options.format !== "openai-chat-completions") {
      return request;
    }

    return {
      model: this.options.model ?? "hermes-agent-staff",
      stream: false,
      messages: [
        {
          role: "system",
          content:
            "You are staff Hermes receiving Google Chat messages. Reply concisely in the same language as the user unless asked otherwise.",
        },
        {
          role: "user",
          content: this.buildHermesUserMessage(request),
        },
      ],
    };
  }

  private buildHermesUserMessage(request: UpstreamChatRequest): string {
    const userLabel = [
      request.user?.displayName,
      request.user?.email ? `<${request.user.email}>` : undefined,
      request.user?.id ? `(${request.user.id})` : undefined,
    ]
      .filter(Boolean)
      .join(" ");
    const spaceLabel = [request.space.displayName, `(${request.space.id})`].filter(Boolean).join(" ");

    return [
      `Conversation: ${request.conversationId}`,
      `Space: ${spaceLabel}`,
      `User: ${userLabel || "unknown"}`,
      "",
      request.message,
    ].join("\n");
  }
}
