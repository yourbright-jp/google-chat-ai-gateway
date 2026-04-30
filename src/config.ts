import { z } from "zod";

export const ConfigSchema = z.object({
  hermesEndpoint: z.url(),
  hermesApiToken: z.string().min(1).optional(),
  hermesTimeoutMs: z.number().int().positive().default(25_000),
  port: z.number().int().positive().default(8080),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return ConfigSchema.parse({
    hermesEndpoint: env.HERMES_ENDPOINT,
    hermesApiToken: env.HERMES_API_TOKEN || undefined,
    hermesTimeoutMs: env.HERMES_TIMEOUT_MS ? Number(env.HERMES_TIMEOUT_MS) : undefined,
    port: env.PORT ? Number(env.PORT) : undefined,
  });
}
