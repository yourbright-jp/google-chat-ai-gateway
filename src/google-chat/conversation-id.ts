import type { GoogleChatEvent } from "./schemas.js";

export function buildConversationId(event: GoogleChatEvent): string {
  const space = event.space.name;
  const thread = event.message?.thread?.name ?? event.thread?.name ?? "unthreaded";
  const user = event.user?.name ?? "anonymous";

  return [space, thread, user].join("|");
}
