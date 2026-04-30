export type GoogleChatTextResponse = {
  text: string;
};

export function textResponse(text: string): GoogleChatTextResponse {
  return { text };
}
