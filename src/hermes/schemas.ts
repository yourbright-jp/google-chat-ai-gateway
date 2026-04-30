import { z } from "zod";

export const HermesChatRequestSchema = z.object({
  conversationId: z.string().min(1),
  message: z.string().min(1),
  source: z.literal("google-chat"),
  user: z
    .object({
      id: z.string().optional(),
      displayName: z.string().optional(),
      email: z.string().optional(),
    })
    .optional(),
  space: z.object({
    id: z.string(),
    displayName: z.string().optional(),
  }),
  rawEvent: z.unknown(),
});

export const HermesChatResponseSchema = z
  .object({
    text: z.string().min(1).optional(),
    message: z.string().min(1).optional(),
  })
  .passthrough()
  .refine((response) => response.text || response.message, {
    message: "Expected text or message in Hermes response",
  });

export type HermesChatRequest = z.infer<typeof HermesChatRequestSchema>;
export type HermesChatResponse = z.infer<typeof HermesChatResponseSchema>;
