import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import type { UpstreamChatRequest } from "./upstream/schemas.js";

const config = {
  upstreamWebhookUrl: "https://ai-backend.example.com/webhook",
  upstreamFormat: "webhook" as const,
  upstreamModel: "hermes-agent-staff",
  upstreamTimeoutMs: 25_000,
  port: 8080,
};

describe("createApp", () => {
  it("forwards MESSAGE events to the upstream webhook and returns Google Chat text", async () => {
    const sent: UpstreamChatRequest[] = [];
    const app = createApp({
      config,
      upstreamClient: {
        async sendMessage(request) {
          sent.push(request);
          return "pong";
        },
      },
    });

    const response = await app.request("/google-chat/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventType: "MESSAGE",
        space: { name: "spaces/AAA", displayName: "Ops" },
        message: { text: "ping", thread: { name: "spaces/AAA/threads/BBB" } },
        user: { name: "users/123", displayName: "Guru" },
      }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ text: "pong" });
    expect(sent).toHaveLength(1);
    expect(sent[0]?.conversationId).toBe("spaces/AAA|spaces/AAA/threads/BBB|users/123");
    expect(sent[0]?.message).toBe("ping");
  });

  it("returns a welcome message when added to a space", async () => {
    const app = createApp({ config });
    const response = await app.request("/google-chat/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventType: "ADDED_TO_SPACE",
        space: { name: "spaces/AAA" },
      }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ text: "Google Chat AI Gateway is ready." });
  });

  it("rejects invalid events", async () => {
    const app = createApp({ config });
    const response = await app.request("/google-chat/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventType: "MESSAGE" }),
    });

    expect(response.status).toBe(400);
  });
});
