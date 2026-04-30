import { describe, expect, it } from "vitest";
import { GoogleChatEventSchema, getGoogleChatEventType } from "./schemas.js";

describe("GoogleChatEventSchema", () => {
  it("accepts a MESSAGE event with additional Google fields", () => {
    const event = GoogleChatEventSchema.parse({
      eventType: "MESSAGE",
      space: { name: "spaces/AAA" },
      message: { text: "hello", unknownField: true },
      user: { name: "users/123" },
      unknownTopLevel: true,
    });

    expect(getGoogleChatEventType(event)).toBe("MESSAGE");
    expect(event.message?.text).toBe("hello");
  });

  it("accepts legacy type as an event type fallback", () => {
    const event = GoogleChatEventSchema.parse({
      type: "ADDED_TO_SPACE",
      space: { name: "spaces/AAA" },
    });

    expect(getGoogleChatEventType(event)).toBe("ADDED_TO_SPACE");
  });
});
