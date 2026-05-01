export type GoogleChatTextResponse = {
  text: string;
};

export type GoogleWorkspaceChatTextResponse = {
  hostAppDataAction: {
    chatDataAction: {
      createMessageAction: {
        message: {
          text: string;
        };
      };
    };
  };
};

export function textResponse(text: string): GoogleChatTextResponse {
  return { text };
}

export function workspaceChatTextResponse(text: string): GoogleWorkspaceChatTextResponse {
  return {
    hostAppDataAction: {
      chatDataAction: {
        createMessageAction: {
          message: { text },
        },
      },
    },
  };
}
