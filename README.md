# Google Chat AI Gateway

HTTP bridge for connecting a Google Chat app to an AI backend webhook or an OpenAI-compatible Hermes API server.

The repository is safe to keep public as long as production endpoints, tokens, Google Cloud service account keys, and real Chat payloads stay outside git.

## Architecture

```text
Google Chat app
  -> Cloud Run /google-chat/events
  -> Zod validation for Google Chat payloads
  -> normalized upstream webhook request or OpenAI chat completions request
  -> Google Chat text response

Hermes or another internal service
  -> Cloud Run /google-chat/push
  -> Google Chat API spaces.messages.create
  -> target Google Chat space
```

## Local Development

```bash
npm install
cp .env.example .env
npm run dev
```

Required environment variables:

| Name | Required | Description |
| --- | --- | --- |
| `UPSTREAM_WEBHOOK_URL` | yes | AI/backend webhook URL that receives normalized Chat messages. |
| `UPSTREAM_BEARER_TOKEN` | no | Bearer token sent to the upstream webhook. Leave empty if it does not require it. |
| `UPSTREAM_FORMAT` | no | Upstream request format. Use `webhook` for normalized JSON or `openai-chat-completions` for Hermes/OpenAI-compatible APIs. Defaults to `webhook`. |
| `UPSTREAM_MODEL` | no | Model value sent when `UPSTREAM_FORMAT=openai-chat-completions`. Defaults to `hermes-agent-staff`. |
| `UPSTREAM_TIMEOUT_MS` | no | Timeout for upstream webhook calls. Defaults to `25000`. |
| `GOOGLE_CHAT_PUSH_TOKEN` | no | Internal bearer token required by `POST /google-chat/push`. Leave unset to disable push. |
| `GOOGLE_CHAT_SERVICE_ACCOUNT_JSON` | no | Service account JSON used for Google Chat API push calls. If unset, the gateway uses the Cloud Run metadata service account. |
| `GOOGLE_CHAT_API_BASE_URL` | no | Google Chat API base URL. Defaults to `https://chat.googleapis.com`. |
| `PORT` | no | HTTP port. Cloud Run provides this automatically. Defaults to `8080`. |

## Endpoints

- `GET /healthz` returns `{ "ok": true }`.
- `POST /google-chat/events` receives Google Chat interaction events.
- `POST /google-chat/push` sends a text message to a specific Google Chat space.

## When the Gateway Responds

The gateway decides whether to forward an inbound message to the upstream AI backend based on where the message arrived and whether the bot has been involved in its thread:

| Where | `@`-mention | Bot already replied in this thread | Action |
| --- | --- | --- | --- |
| DM | — | — | forward |
| Space | yes | — | forward |
| Space | no | yes | forward (thread continuity) |
| Space | no | no | ignore (respond `{}`) |
| Space | no | no thread | ignore |

This lets a user start a thread by `@`-mentioning the bot once and then keep replying in that thread without re-mentioning on every message. Channel chitchat outside an engaged thread is ignored.

The "already replied in this thread" check is a single `spaces.messages.list` call filtered to the target thread, looking for any message whose `sender.type` is `BOT`. If the call fails (auth misconfig, API outage, …) the gateway defaults to ignore rather than spamming the channel.

**Prerequisite**: the Google Chat app must be configured to receive every message in spaces where it is a member, not just `@`-mentions. In the Chat API admin panel set the app's space messaging mode so that *all* messages in member spaces are delivered to this endpoint. Without that, the gateway never sees un-mentioned thread replies and the second/third branches above never fire.

The Chat app's service account also needs the `https://www.googleapis.com/auth/chat.bot` scope for the engagement check (already required for `/google-chat/push`).

## Push Messages to Google Chat

`POST /google-chat/push` is for trusted internal callers such as Hermes. It requires:

- `GOOGLE_CHAT_PUSH_TOKEN` configured on this gateway.
- A bearer token matching `GOOGLE_CHAT_PUSH_TOKEN`.
- Google Chat API access with the `https://www.googleapis.com/auth/chat.bot` scope.
- The Chat app added to the target space.

Request:

```http
POST /google-chat/push
Authorization: Bearer <GOOGLE_CHAT_PUSH_TOKEN>
Content-Type: application/json
```

```json
{
  "space": "spaces/AAA",
  "text": "hello from Hermes",
  "requestId": "optional-dedupe-id",
  "threadName": "spaces/AAA/threads/BBB"
}
```

Response:

```json
{
  "ok": true,
  "name": "spaces/AAA/messages/BBB",
  "threadName": "spaces/AAA/threads/BBB"
}
```

For Cloud Run, prefer using the service's attached service account with Chat API permissions. For local development, set `GOOGLE_CHAT_SERVICE_ACCOUNT_JSON` to a service account JSON string.

## Upstream Request Shape

`MESSAGE` and `APP_COMMAND` events are forwarded to the upstream webhook as:

```json
{
  "conversationId": "spaces/AAA|spaces/AAA/threads/BBB|users/123",
  "message": "hello",
  "source": "google-chat",
  "user": {
    "id": "users/123",
    "displayName": "User",
    "email": "user@example.com"
  },
  "space": {
    "id": "spaces/AAA",
    "displayName": "Space name"
  },
  "rawEvent": {}
}
```

When `UPSTREAM_FORMAT=webhook`, the upstream webhook should respond with either:

```json
{ "text": "reply" }
```

or:

```json
{ "message": "reply" }
```

When `UPSTREAM_FORMAT=openai-chat-completions`, the gateway posts an OpenAI-compatible request:

```json
{
  "model": "hermes-agent-staff",
  "stream": false,
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "Conversation: ...\nSpace: ...\nUser: ...\n\nhello" }
  ]
}
```

The upstream response is read from `choices[0].message.content`.

## Hermes Staff Configuration

For the Railway staff Hermes service:

```dotenv
UPSTREAM_WEBHOOK_URL=https://hermes-agent-staff-production.up.railway.app/v1/chat/completions
UPSTREAM_FORMAT=openai-chat-completions
UPSTREAM_MODEL=hermes-agent-staff
UPSTREAM_BEARER_TOKEN=<staff API_SERVER_KEY>
```

## Cloud Run Deployment

Build and deploy:

```bash
gcloud run deploy google-chat-ai-gateway \
  --source . \
  --region asia-northeast1 \
  --set-env-vars UPSTREAM_WEBHOOK_URL=https://hermes-agent-staff-production.up.railway.app/v1/chat/completions,UPSTREAM_FORMAT=openai-chat-completions,UPSTREAM_MODEL=hermes-agent-staff \
  --set-secrets UPSTREAM_BEARER_TOKEN=UPSTREAM_BEARER_TOKEN:latest
```

For production, configure the service so it is not publicly invokable and authorize the Google Chat service account as an invoker. Keep all secrets in Secret Manager or Cloud Run environment configuration, not in this repository.

## Google Chat App Setup

1. Enable the Google Chat API in the Google Cloud project.
2. Create a Google Chat app.
3. Choose an HTTP endpoint for interactivity.
4. Set the endpoint to:

```text
https://<cloud-run-service-url>/google-chat/events
```

5. Test with a direct message first, then add the app to a space.

## Verification

```bash
npm run typecheck
npm test
```
