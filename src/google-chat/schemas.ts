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

const GoogleWorkspaceChatEventObjectSchema = z
  .object({
    chat: z
      .object({
        user: GoogleChatUserSchema.optional(),
        space: GoogleChatSpaceSchema.optional(),
        messagePayload: z
          .object({
            message: GoogleChatMessageSchema,
            space: GoogleChatSpaceSchema.optional(),
          })
          .passthrough()
          .optional(),
        addedToSpacePayload: z
          .object({
            space: GoogleChatSpaceSchema,
          })
          .passthrough()
          .optional(),
        removedFromSpacePayload: z
          .object({
            space: GoogleChatSpaceSchema,
          })
          .passthrough()
          .optional(),
        buttonClickedPayload: z
          .object({
            message: GoogleChatMessageSchema.optional(),
            space: GoogleChatSpaceSchema.optional(),
          })
          .passthrough()
          .optional(),
        appCommandPayload: z
          .object({
            message: GoogleChatMessageSchema.optional(),
            space: GoogleChatSpaceSchema.optional(),
          })
          .passthrough()
          .optional(),
      })
      .passthrough(),
    commonEventObject: z.unknown().optional(),
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

export function normalizeGoogleChatEvent(rawEvent: unknown) {
  const legacyEvent = GoogleChatEventSchema.safeParse(rawEvent);
  if (legacyEvent.success) {
    return legacyEvent;
  }

  const addOnEvent = GoogleWorkspaceChatEventObjectSchema.safeParse(rawEvent);
  if (!addOnEvent.success) {
    return legacyEvent;
  }

  const { chat, commonEventObject } = addOnEvent.data;
  const event =
    chat.messagePayload
      ? {
          type: "MESSAGE",
          space: chat.messagePayload.space ?? chat.space,
          message: chat.messagePayload.message,
          user: chat.user,
          thread: chat.messagePayload.message.thread,
          common: commonEventObject,
        }
      : chat.addedToSpacePayload
        ? {
            type: "ADDED_TO_SPACE",
            space: chat.addedToSpacePayload.space,
            user: chat.user,
            common: commonEventObject,
          }
        : chat.removedFromSpacePayload
          ? {
              type: "REMOVED_FROM_SPACE",
              space: chat.removedFromSpacePayload.space,
              user: chat.user,
              common: commonEventObject,
            }
          : chat.buttonClickedPayload
            ? {
                type: "CARD_CLICKED",
                space: chat.buttonClickedPayload.space ?? chat.space,
                message: chat.buttonClickedPayload.message,
                user: chat.user,
                thread: chat.buttonClickedPayload.message?.thread,
                common: commonEventObject,
              }
            : chat.appCommandPayload
              ? {
                  type: "APP_COMMAND",
                  space: chat.appCommandPayload.space ?? chat.space,
                  message: chat.appCommandPayload.message,
                  user: chat.user,
                  thread: chat.appCommandPayload.message?.thread,
                  common: commonEventObject,
                }
              : rawEvent;

  return GoogleChatEventSchema.safeParse(event);
}
