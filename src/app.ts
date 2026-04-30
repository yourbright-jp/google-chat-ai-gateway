import { Hono } from "hono";
import { z } from "zod";
import { loadConfig, type Config } from "./config.js";
import { buildConversationId } from "./google-chat/conversation-id.js";
import { textResponse } from "./google-chat/response.js";
import {
  getGoogleChatEventType,
  GoogleChatEventSchema,
  type GoogleChatEvent,
} from "./google-chat/schemas.js";
import { UpstreamClient } from "./upstream/client.js";
import type { UpstreamChatRequest } from "./upstream/schemas.js";

type AppDependencies = {
  config?: Config;
  upstreamClient?: Pick<UpstreamClient, "sendMessage">;
};

export function createApp(dependencies: AppDependencies = {}) {
  const config = dependencies.config ?? loadConfig();
  const upstreamClient =
    dependencies.upstreamClient ??
    new UpstreamClient({
      endpoint: config.upstreamWebhookUrl,
      ...(config.upstreamBearerToken ? { bearerToken: config.upstreamBearerToken } : {}),
      timeoutMs: config.upstreamTimeoutMs,
    });

  const app = new Hono();

  app.get("/healthz", (c) => c.json({ ok: true }));

  app.post("/google-chat/events", async (c) => {
    const rawBody: unknown = await c.req.json().catch(() => undefined);
    const parsed = GoogleChatEventSchema.safeParse(rawBody);

    if (!parsed.success) {
      return c.json(
        {
          error: "invalid_google_chat_event",
          issues: z.treeifyError(parsed.error),
        },
        400,
      );
    }

    const event = parsed.data;
    const eventType = getGoogleChatEventType(event);

    switch (eventType) {
      case "MESSAGE":
      case "APP_COMMAND":
        return c.json(textResponse(await forwardMessage(event, upstreamClient)));
      case "ADDED_TO_SPACE":
        return c.json(textResponse("Google Chat AI Gateway is ready."));
      case "REMOVED_FROM_SPACE":
        return c.body(null, 204);
      case "CARD_CLICKED":
      case "APP_HOME":
      case "SUBMIT_FORM":
        return c.json(textResponse("This interaction is not supported yet."));
      default:
        return c.json(textResponse("Unsupported Google Chat event."));
    }
  });

  app.notFound((c) => c.json({ error: "not_found" }, 404));

  return app;
}

async function forwardMessage(
  event: GoogleChatEvent,
  upstreamClient: Pick<UpstreamClient, "sendMessage">,
): Promise<string> {
  const text = event.message?.argumentText ?? event.message?.text;

  if (!text?.trim()) {
    return "Message text is required.";
  }

  const request: UpstreamChatRequest = {
    conversationId: buildConversationId(event),
    message: text.trim(),
    source: "google-chat",
    user: {
      id: event.user?.name,
      displayName: event.user?.displayName,
      email: event.user?.email,
    },
    space: {
      id: event.space.name,
      displayName: event.space.displayName,
    },
    rawEvent: event,
  };

  return upstreamClient.sendMessage(request);
}
