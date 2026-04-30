# Google Chat AI Gateway

HTTP bridge for connecting a Google Chat app to an AI backend webhook.

The repository is safe to keep public as long as production endpoints, tokens, Google Cloud service account keys, and real Chat payloads stay outside git.

## Architecture

```text
Google Chat app
  -> Cloud Run /google-chat/events
  -> Zod validation for Google Chat payloads
  -> normalized upstream webhook request
  -> Google Chat text response
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
| `UPSTREAM_TIMEOUT_MS` | no | Timeout for upstream webhook calls. Defaults to `25000`. |
| `PORT` | no | HTTP port. Cloud Run provides this automatically. Defaults to `8080`. |

## Endpoints

- `GET /healthz` returns `{ "ok": true }`.
- `POST /google-chat/events` receives Google Chat interaction events.

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

The upstream webhook should respond with either:

```json
{ "text": "reply" }
```

or:

```json
{ "message": "reply" }
```

## Cloud Run Deployment

Build and deploy:

```bash
gcloud run deploy google-chat-ai-gateway \
  --source . \
  --region asia-northeast1 \
  --set-env-vars UPSTREAM_WEBHOOK_URL=https://example.com/webhook \
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
