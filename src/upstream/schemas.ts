import { z } from "zod";

export const UpstreamChatRequestSchema = z.object({
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

export const UpstreamChatResponseSchema = z
  .object({
    text: z.string().min(1).optional(),
    message: z.string().min(1).optional(),
  })
  .passthrough()
  .refine((response) => response.text || response.message, {
    message: "Expected text or message in upstream response",
  });

export const OpenAiChatCompletionResponseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string().min(1),
        }),
      }),
    )
    .min(1),
});

export type UpstreamChatRequest = z.infer<typeof UpstreamChatRequestSchema>;
export type UpstreamChatResponse = z.infer<typeof UpstreamChatResponseSchema>;
export type OpenAiChatCompletionResponse = z.infer<typeof OpenAiChatCompletionResponseSchema>;
