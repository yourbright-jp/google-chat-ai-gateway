import { z } from "zod";

export const ConfigSchema = z.object({
  upstreamWebhookUrl: z.url(),
  upstreamBearerToken: z.string().min(1).optional(),
  upstreamTimeoutMs: z.number().int().positive().default(25_000),
  port: z.number().int().positive().default(8080),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return ConfigSchema.parse({
    upstreamWebhookUrl: env.UPSTREAM_WEBHOOK_URL,
    upstreamBearerToken: env.UPSTREAM_BEARER_TOKEN || undefined,
    upstreamTimeoutMs: env.UPSTREAM_TIMEOUT_MS ? Number(env.UPSTREAM_TIMEOUT_MS) : undefined,
    port: env.PORT ? Number(env.PORT) : undefined,
  });
}
