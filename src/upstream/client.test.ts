import { describe, expect, it } from "vitest";
import { UpstreamClient } from "./client.js";
import type { UpstreamChatRequest } from "./schemas.js";

const chatRequest: UpstreamChatRequest = {
  conversationId: "spaces/AAA|spaces/AAA/threads/BBB|users/123",
  message: "hello from chat",
  source: "google-chat",
  user: {
    id: "users/123",
    displayName: "Guru",
    email: "guru@example.com",
  },
  space: {
    id: "spaces/AAA",
    displayName: "Ops",
  },
  rawEvent: { eventType: "MESSAGE" },
};

describe("UpstreamClient", () => {
  it("can call a plain webhook upstream", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const client = new UpstreamClient({
      endpoint: "https://backend.example.com/google-chat",
      timeoutMs: 25_000,
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), init: init ?? {} });
        return Response.json({ text: "plain pong" });
      },
    });

    await expect(client.sendMessage(chatRequest)).resolves.toBe("plain pong");
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual(chatRequest);
  });

  it("can call a Hermes OpenAI-compatible chat completions upstream", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const client = new UpstreamClient({
      endpoint: "https://hermes.example.com/v1/chat/completions",
      bearerToken: "staff-token",
      format: "openai-chat-completions",
      model: "hermes-agent-staff",
      timeoutMs: 25_000,
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), init: init ?? {} });
        return Response.json({
          choices: [{ message: { role: "assistant", content: "staff pong" } }],
        });
      },
    });

    await expect(client.sendMessage(chatRequest)).resolves.toBe("staff pong");

    expect(calls[0]?.url).toBe("https://hermes.example.com/v1/chat/completions");
    expect(calls[0]?.init.headers).toMatchObject({
      authorization: "Bearer staff-token",
      "content-type": "application/json",
    });
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({
      model: "hermes-agent-staff",
      stream: false,
      messages: [
        {
          role: "system",
          content:
            "You are staff Hermes receiving Google Chat messages. Reply concisely in the same language as the user unless asked otherwise.",
        },
        {
          role: "user",
          content: [
            "Conversation: spaces/AAA|spaces/AAA/threads/BBB|users/123",
            "Space: Ops (spaces/AAA)",
            "User: Guru <guru@example.com> (users/123)",
            "",
            "hello from chat",
          ].join("\n"),
        },
      ],
    });
  });
});
