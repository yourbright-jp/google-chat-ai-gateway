import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import type { UpstreamChatRequest } from "./upstream/schemas.js";

const config = {
  upstreamWebhookUrl: "https://ai-backend.example.com/webhook",
  upstreamFormat: "webhook" as const,
  upstreamModel: "hermes-agent-staff",
  upstreamTimeoutMs: 25_000,
  googleChatPushToken: "push-secret",
  googleChatApiBaseUrl: "https://chat.googleapis.com",
  port: 8080,
};

type StubChatClient = {
  sendTextMessage: (...args: never[]) => Promise<never>;
  isThreadEngaged: (space: string, threadName: string) => Promise<boolean>;
  engagedCalls: Array<[string, string]>;
};

function stubChatClient(engaged: boolean): StubChatClient {
  const stub: StubChatClient = {
    sendTextMessage: async () => {
      throw new Error("sendTextMessage should not be called in event handling");
    },
    isThreadEngaged: async (space, threadName) => {
      stub.engagedCalls.push([space, threadName]);
      return engaged;
    },
    engagedCalls: [],
  };
  return stub;
}

describe("createApp", () => {
  it("forwards mentioned MESSAGE events in a space without an engagement check", async () => {
    const sent: UpstreamChatRequest[] = [];
    const chatClient = stubChatClient(false);
    const app = createApp({
      config,
      upstreamClient: {
        async sendMessage(request) {
          sent.push(request);
          return "pong";
        },
      },
      googleChatClient: chatClient,
    });

    const response = await app.request("/google-chat/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventType: "MESSAGE",
        space: { name: "spaces/AAA", type: "ROOM", displayName: "Ops" },
        message: {
          text: "@Hermes ping",
          argumentText: "ping",
          thread: { name: "spaces/AAA/threads/BBB" },
        },
        user: { name: "users/123", displayName: "Guru" },
      }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ text: "pong" });
    expect(sent).toHaveLength(1);
    expect(sent[0]?.conversationId).toBe("spaces/AAA|spaces/AAA/threads/BBB|users/123");
    expect(sent[0]?.message).toBe("ping");
    expect(chatClient.engagedCalls).toEqual([]);
  });

  it("forwards an un-mentioned thread reply when the bot has already engaged in the thread", async () => {
    const sent: UpstreamChatRequest[] = [];
    const chatClient = stubChatClient(true);
    const app = createApp({
      config,
      upstreamClient: {
        async sendMessage(request) {
          sent.push(request);
          return "pong";
        },
      },
      googleChatClient: chatClient,
    });

    const response = await app.request("/google-chat/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventType: "MESSAGE",
        space: { name: "spaces/AAA", type: "ROOM" },
        message: {
          text: "follow up",
          thread: { name: "spaces/AAA/threads/BBB" },
        },
        user: { name: "users/123", displayName: "Guru" },
      }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ text: "pong" });
    expect(sent).toHaveLength(1);
    expect(chatClient.engagedCalls).toEqual([["spaces/AAA", "spaces/AAA/threads/BBB"]]);
  });

  it("ignores an un-mentioned thread reply when the bot has not engaged in the thread", async () => {
    const sent: UpstreamChatRequest[] = [];
    const chatClient = stubChatClient(false);
    const app = createApp({
      config,
      upstreamClient: {
        async sendMessage(request) {
          sent.push(request);
          return "pong";
        },
      },
      googleChatClient: chatClient,
    });

    const response = await app.request("/google-chat/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventType: "MESSAGE",
        space: { name: "spaces/AAA", type: "ROOM" },
        message: {
          text: "drive-by chat",
          thread: { name: "spaces/AAA/threads/QQQ" },
        },
        user: { name: "users/123", displayName: "Guru" },
      }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({});
    expect(sent).toEqual([]);
    expect(chatClient.engagedCalls).toEqual([["spaces/AAA", "spaces/AAA/threads/QQQ"]]);
  });

  it("forwards every message in a DM regardless of mention", async () => {
    const sent: UpstreamChatRequest[] = [];
    const chatClient = stubChatClient(false);
    const app = createApp({
      config,
      upstreamClient: {
        async sendMessage(request) {
          sent.push(request);
          return "pong";
        },
      },
      googleChatClient: chatClient,
    });

    const response = await app.request("/google-chat/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventType: "MESSAGE",
        space: { name: "spaces/DM1", type: "DM" },
        message: { text: "hi" },
        user: { name: "users/123" },
      }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ text: "pong" });
    expect(sent).toHaveLength(1);
    expect(chatClient.engagedCalls).toEqual([]);
  });

  it("ignores top-level space messages with no mention and no thread", async () => {
    const sent: UpstreamChatRequest[] = [];
    const chatClient = stubChatClient(true);
    const app = createApp({
      config,
      upstreamClient: {
        async sendMessage(request) {
          sent.push(request);
          return "pong";
        },
      },
      googleChatClient: chatClient,
    });

    const response = await app.request("/google-chat/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventType: "MESSAGE",
        space: { name: "spaces/AAA", type: "ROOM" },
        message: { text: "ambient" },
        user: { name: "users/123" },
      }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({});
    expect(sent).toEqual([]);
    expect(chatClient.engagedCalls).toEqual([]);
  });

  it("falls back to ignore when the engagement check throws", async () => {
    const sent: UpstreamChatRequest[] = [];
    const app = createApp({
      config,
      upstreamClient: {
        async sendMessage(request) {
          sent.push(request);
          return "pong";
        },
      },
      googleChatClient: {
        async sendTextMessage() {
          throw new Error("not used");
        },
        async isThreadEngaged() {
          throw new Error("Chat API down");
        },
      },
    });

    const response = await app.request("/google-chat/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventType: "MESSAGE",
        space: { name: "spaces/AAA", type: "ROOM" },
        message: {
          text: "follow up",
          thread: { name: "spaces/AAA/threads/BBB" },
        },
        user: { name: "users/123" },
      }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({});
    expect(sent).toEqual([]);
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

  it("forwards Google Workspace add-on Chat message payloads when mentioned", async () => {
    const sent: UpstreamChatRequest[] = [];
    const app = createApp({
      config,
      upstreamClient: {
        async sendMessage(request) {
          sent.push(request);
          return "pong";
        },
      },
      googleChatClient: stubChatClient(false),
    });

    const response = await app.request("/google-chat/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat: {
          user: { name: "users/123", displayName: "Guru" },
          messagePayload: {
            space: { name: "spaces/AAA", type: "ROOM", displayName: "Ops" },
            message: {
              text: "@Hermes ping",
              argumentText: "ping",
              thread: { name: "spaces/AAA/threads/BBB" },
            },
          },
        },
        commonEventObject: { hostApp: "CHAT" },
      }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      hostAppDataAction: {
        chatDataAction: {
          createMessageAction: {
            message: { text: "pong" },
          },
        },
      },
    });
    expect(sent[0]?.conversationId).toBe("spaces/AAA|spaces/AAA/threads/BBB|users/123");
    expect(sent[0]?.message).toBe("ping");
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

  it("pushes a message to a specific Google Chat space", async () => {
    const sent: unknown[] = [];
    const app = createApp({
      config,
      googleChatClient: {
        async sendTextMessage(request) {
          sent.push(request);
          return { name: "spaces/AAA/messages/BBB" };
        },
        async isThreadEngaged() {
          throw new Error("isThreadEngaged should not be called from /google-chat/push");
        },
      },
    });

    const response = await app.request("/google-chat/push", {
      method: "POST",
      headers: {
        authorization: "Bearer push-secret",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        space: "spaces/AAA",
        text: "hello from Hermes",
      }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, name: "spaces/AAA/messages/BBB" });
    expect(sent).toEqual([{ space: "spaces/AAA", text: "hello from Hermes" }]);
  });

  it("requires the push bearer token", async () => {
    const app = createApp({ config });
    const response = await app.request("/google-chat/push", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        space: "spaces/AAA",
        text: "hello",
      }),
    });

    expect(response.status).toBe(401);
  });
});
