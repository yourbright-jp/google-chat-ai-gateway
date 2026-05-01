import { z } from "zod";

export const ConfigSchema = z.object({
  upstreamWebhookUrl: z.url(),
  upstreamBearerToken: z.string().min(1).optional(),
  upstreamFormat: z.enum(["webhook", "openai-chat-completions"]).default("webhook"),
  upstreamModel: z.string().min(1).default("hermes-agent-staff"),
  upstreamTimeoutMs: z.number().int().positive().default(25_000),
  googleChatPushToken: z.string().min(1).optional(),
  googleChatServiceAccountJson: z.string().min(1).optional(),
  googleChatApiBaseUrl: z.url().default("https://chat.googleapis.com"),
  port: z.number().int().positive().default(8080),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return ConfigSchema.parse({
    upstreamWebhookUrl: env.UPSTREAM_WEBHOOK_URL,
    upstreamBearerToken: env.UPSTREAM_BEARER_TOKEN || undefined,
    upstreamFormat: env.UPSTREAM_FORMAT || undefined,
    upstreamModel: env.UPSTREAM_MODEL || undefined,
    upstreamTimeoutMs: env.UPSTREAM_TIMEOUT_MS ? Number(env.UPSTREAM_TIMEOUT_MS) : undefined,
    googleChatPushToken: env.GOOGLE_CHAT_PUSH_TOKEN || undefined,
    googleChatServiceAccountJson: env.GOOGLE_CHAT_SERVICE_ACCOUNT_JSON || undefined,
    googleChatApiBaseUrl: env.GOOGLE_CHAT_API_BASE_URL || undefined,
    port: env.PORT ? Number(env.PORT) : undefined,
  });
}
