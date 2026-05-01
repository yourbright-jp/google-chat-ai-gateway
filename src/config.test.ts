import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";

describe("loadConfig", () => {
  it("loads Hermes chat completions upstream settings", () => {
    expect(
      loadConfig({
        UPSTREAM_WEBHOOK_URL: "https://hermes.example.com/v1/chat/completions",
        UPSTREAM_FORMAT: "openai-chat-completions",
        UPSTREAM_MODEL: "hermes-agent-staff",
        UPSTREAM_BEARER_TOKEN: "staff-token",
        GOOGLE_CHAT_PUSH_TOKEN: "push-token",
      }),
    ).toMatchObject({
      upstreamWebhookUrl: "https://hermes.example.com/v1/chat/completions",
      upstreamFormat: "openai-chat-completions",
      upstreamModel: "hermes-agent-staff",
      upstreamBearerToken: "staff-token",
      googleChatPushToken: "push-token",
      googleChatApiBaseUrl: "https://chat.googleapis.com",
    });
  });
});
