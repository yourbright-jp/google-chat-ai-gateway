import { describe, expect, it } from "vitest";
import { GoogleChatEventSchema } from "./schemas.js";
import { buildConversationId } from "./conversation-id.js";

describe("buildConversationId", () => {
  it("combines space, thread, and user identifiers", () => {
    const event = GoogleChatEventSchema.parse({
      eventType: "MESSAGE",
      space: { name: "spaces/AAA" },
      message: {
        text: "hello",
        thread: { name: "spaces/AAA/threads/BBB" },
      },
      user: { name: "users/123" },
    });

    expect(buildConversationId(event)).toBe("spaces/AAA|spaces/AAA/threads/BBB|users/123");
  });
});
