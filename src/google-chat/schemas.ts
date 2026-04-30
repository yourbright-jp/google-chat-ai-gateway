import { z } from "zod";

export const GoogleChatEventTypeSchema = z.enum([
  "MESSAGE",
  "ADDED_TO_SPACE",
  "REMOVED_FROM_SPACE",
  "CARD_CLICKED",
  "APP_COMMAND",
  "APP_HOME",
  "SUBMIT_FORM",
]);

const GoogleChatUserSchema = z
  .object({
    name: z.string().optional(),
    displayName: z.string().optional(),
    email: z.string().optional(),
    type: z.string().optional(),
  })
  .passthrough();

const GoogleChatThreadSchema = z
  .object({
    name: z.string().optional(),
  })
  .passthrough();

const GoogleChatSpaceSchema = z
  .object({
    name: z.string(),
    type: z.string().optional(),
    displayName: z.string().optional(),
  })
  .passthrough();

const GoogleChatMessageSchema = z
  .object({
    name: z.string().optional(),
    text: z.string().optional(),
    argumentText: z.string().optional(),
    slashCommand: z.unknown().optional(),
    thread: GoogleChatThreadSchema.optional(),
  })
  .passthrough();

export const GoogleChatEventSchema = z
  .object({
    eventType: GoogleChatEventTypeSchema.optional(),
    type: GoogleChatEventTypeSchema.optional(),
    message: GoogleChatMessageSchema.optional(),
    user: GoogleChatUserSchema.optional(),
    space: GoogleChatSpaceSchema,
    thread: GoogleChatThreadSchema.optional(),
    action: z.unknown().optional(),
    common: z.unknown().optional(),
  })
  .passthrough()
  .refine((event) => event.eventType || event.type, {
    message: "Expected eventType or legacy type",
  });

export type GoogleChatEventType = z.infer<typeof GoogleChatEventTypeSchema>;
export type GoogleChatEvent = z.infer<typeof GoogleChatEventSchema>;

export function getGoogleChatEventType(event: GoogleChatEvent): GoogleChatEventType {
  return (event.eventType ?? event.type) as GoogleChatEventType;
}
