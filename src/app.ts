import { Hono } from "hono";
import { z } from "zod";
import { loadConfig, type Config } from "./config.js";
import { buildConversationId } from "./google-chat/conversation-id.js";
import { GoogleChatApiClient, GoogleChatPushRequestSchema } from "./google-chat/push.js";
import { textResponse, workspaceChatTextResponse } from "./google-chat/response.js";
import {
  getGoogleChatEventType,
  normalizeGoogleChatEvent,
  type GoogleChatEvent,
} from "./google-chat/schemas.js";
import { UpstreamClient } from "./upstream/client.js";
import type { UpstreamChatRequest } from "./upstream/schemas.js";

type AppDependencies = {
  config?: Config;
  upstreamClient?: Pick<UpstreamClient, "sendMessage">;
  googleChatClient?: Pick<GoogleChatApiClient, "sendTextMessage" | "isThreadEngaged">;
};

export function createApp(dependencies: AppDependencies = {}) {
  const config = dependencies.config ?? loadConfig();
  const upstreamClient =
    dependencies.upstreamClient ??
    new UpstreamClient({
      endpoint: config.upstreamWebhookUrl,
      ...(config.upstreamBearerToken ? { bearerToken: config.upstreamBearerToken } : {}),
      format: config.upstreamFormat,
      model: config.upstreamModel,
      timeoutMs: config.upstreamTimeoutMs,
    });
  const googleChatClient =
    dependencies.googleChatClient ??
    new GoogleChatApiClient({
      apiBaseUrl: config.googleChatApiBaseUrl,
      ...(config.googleChatServiceAccountJson ? { serviceAccountJson: config.googleChatServiceAccountJson } : {}),
    });

  const app = new Hono();

  app.get("/healthz", (c) => c.json({ ok: true }));

  app.post("/google-chat/push", async (c) => {
    if (!config.googleChatPushToken) {
      return c.json({ error: "google_chat_push_not_configured" }, 503);
    }

    const authorization = c.req.header("authorization");
    if (authorization !== `Bearer ${config.googleChatPushToken}`) {
      return c.json({ error: "unauthorized" }, 401);
    }

    const rawBody: unknown = await c.req.json().catch(() => undefined);
    const parsed = GoogleChatPushRequestSchema.safeParse(rawBody);

    if (!parsed.success) {
      return c.json(
        {
          error: "invalid_google_chat_push_request",
          issues: z.treeifyError(parsed.error),
        },
        400,
      );
    }

    const message = await googleChatClient.sendTextMessage(parsed.data);
    return c.json({ ok: true, ...message });
  });

  app.post("/google-chat/events", async (c) => {
    const rawBody: unknown = await c.req.json().catch(() => undefined);
    const parsed = normalizeGoogleChatEvent(rawBody);
    const respondWithText = isWorkspaceAddOnChatEvent(rawBody) ? workspaceChatTextResponse : textResponse;

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
      case "APP_COMMAND": {
        if (!(await shouldRespond(event, googleChatClient))) {
          // Google Chat treats an empty JSON body as "no message".
          // We use it for channel chitchat that is not @-directed at
          // the bot and not in a thread the bot has already joined.
          return c.json({});
        }
        return c.json(respondWithText(await forwardMessage(event, upstreamClient)));
      }
      case "ADDED_TO_SPACE":
        return c.json(respondWithText("Google Chat AI Gateway is ready."));
      case "REMOVED_FROM_SPACE":
        return c.body(null, 204);
      case "CARD_CLICKED":
      case "APP_HOME":
      case "SUBMIT_FORM":
        return c.json(respondWithText("This interaction is not supported yet."));
      default:
        return c.json(respondWithText("Unsupported Google Chat event."));
    }
  });

  app.notFound((c) => c.json({ error: "not_found" }, 404));

  return app;
}

function isWorkspaceAddOnChatEvent(rawBody: unknown): boolean {
  return typeof rawBody === "object" && rawBody !== null && "chat" in rawBody;
}

/**
 * Decides whether the gateway should forward this event to the upstream
 * AI backend.
 *
 *   - DM:                         always respond.
 *   - Space + `@`-mention:        respond.
 *   - Space + no mention, but the bot already has a message in the
 *     thread (i.e. the thread was started by an `@`-mention earlier):
 *                                 respond.
 *   - Space + no mention + not in a bot-engaged thread:
 *                                 ignore.
 *
 * Pre-requisite: the Chat app must be configured to receive every
 * message in spaces where it is a member (not just `@`-mentions),
 * otherwise the second/third branches never get the chance to fire.
 *
 * Engagement is checked with a single `spaces.messages.list` call
 * filtered to the target thread. If that call fails (auth misconfig,
 * API outage, …) the gateway defaults to "ignore" rather than
 * spamming the channel with unsolicited replies.
 */
async function shouldRespond(
  event: GoogleChatEvent,
  chatClient: Pick<GoogleChatApiClient, "isThreadEngaged">,
): Promise<boolean> {
  // Defensive: a bot's own message should never round-trip to itself.
  if (event.user?.type === "BOT") {
    return false;
  }
  if (event.space.type === "DM") {
    return true;
  }
  // Google Chat populates `message.argumentText` only when the bot is
  // `@`-mentioned (or a slash command is directed at it); plain channel
  // chitchat leaves it undefined.
  if (typeof event.message?.argumentText === "string") {
    return true;
  }
  const threadName = event.message?.thread?.name;
  if (!threadName) {
    return false;
  }
  try {
    return await chatClient.isThreadEngaged(event.space.name, threadName);
  } catch (err) {
    console.error("[gateway] isThreadEngaged failed; ignoring message", {
      threadName,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
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
