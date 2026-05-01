import { createSign } from "node:crypto";
import { z } from "zod";

const CHAT_BOT_SCOPE = "https://www.googleapis.com/auth/chat.bot";
const GOOGLE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";

export const GoogleChatPushRequestSchema = z.object({
  space: z.string().regex(/^spaces\/[A-Za-z0-9_-]+$/, "Expected a Google Chat space name like spaces/AAA"),
  text: z.string().trim().min(1).max(32_000),
  requestId: z.string().min(1).max(128).optional(),
  threadName: z.string().min(1).optional(),
});

export type GoogleChatPushRequest = z.infer<typeof GoogleChatPushRequestSchema>;

export type GoogleChatPushResult = {
  name?: string;
  threadName?: string;
};

export type GoogleChatApiClientOptions = {
  apiBaseUrl: string;
  serviceAccountJson?: string;
  fetchImpl?: typeof fetch;
};

type ServiceAccountCredentials = {
  client_email: string;
  private_key: string;
  token_uri?: string;
};

type CachedToken = {
  accessToken: string;
  expiresAtMs: number;
};

export class GoogleChatApiClient {
  private readonly fetchImpl: typeof fetch;
  private cachedToken?: CachedToken;

  constructor(private readonly options: GoogleChatApiClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async sendTextMessage(request: GoogleChatPushRequest): Promise<GoogleChatPushResult> {
    const accessToken = await this.getAccessToken();
    const url = new URL(`${this.options.apiBaseUrl.replace(/\/$/, "")}/v1/${request.space}/messages`);

    if (request.requestId) {
      url.searchParams.set("requestId", request.requestId);
    }
    if (request.threadName) {
      url.searchParams.set("messageReplyOption", "REPLY_MESSAGE_OR_FAIL");
    }

    const body: { text: string; thread?: { name: string } } = { text: request.text };
    if (request.threadName) {
      body.thread = { name: request.threadName };
    }

    const response = await this.fetchImpl(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const message = await response.text().catch(() => "");
      throw new Error(`Google Chat push failed with ${response.status}${message ? `: ${message}` : ""}`);
    }

    const payload = (await response.json().catch(() => ({}))) as { name?: string; thread?: { name?: string } };
    return {
      ...(payload.name ? { name: payload.name } : {}),
      ...(payload.thread?.name ? { threadName: payload.thread.name } : {}),
    };
  }

  private async getAccessToken(): Promise<string> {
    if (this.cachedToken && Date.now() < this.cachedToken.expiresAtMs - 60_000) {
      return this.cachedToken.accessToken;
    }

    const token = this.options.serviceAccountJson
      ? await this.getServiceAccountAccessToken(this.options.serviceAccountJson)
      : await this.getMetadataAccessToken();

    this.cachedToken = token;
    return token.accessToken;
  }

  private async getServiceAccountAccessToken(serviceAccountJson: string): Promise<CachedToken> {
    const credentials = parseServiceAccountCredentials(serviceAccountJson);
    const tokenUrl = credentials.token_uri ?? GOOGLE_OAUTH_TOKEN_URL;
    const nowSeconds = Math.floor(Date.now() / 1000);
    const assertion = signJwt(
      {
        alg: "RS256",
        typ: "JWT",
      },
      {
        iss: credentials.client_email,
        scope: CHAT_BOT_SCOPE,
        aud: tokenUrl,
        exp: nowSeconds + 3600,
        iat: nowSeconds,
      },
      credentials.private_key,
    );

    const response = await this.fetchImpl(tokenUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    });

    if (!response.ok) {
      throw new Error(`Google OAuth token request failed with ${response.status}`);
    }

    const payload = (await response.json()) as { access_token?: string; expires_in?: number };
    if (!payload.access_token) {
      throw new Error("Google OAuth token response did not include access_token");
    }

    return {
      accessToken: payload.access_token,
      expiresAtMs: Date.now() + (payload.expires_in ?? 3600) * 1000,
    };
  }

  private async getMetadataAccessToken(): Promise<CachedToken> {
    const url = new URL("http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token");
    url.searchParams.set("scopes", CHAT_BOT_SCOPE);

    const response = await this.fetchImpl(url, {
      headers: { "Metadata-Flavor": "Google" },
    });

    if (!response.ok) {
      throw new Error(`Google metadata token request failed with ${response.status}`);
    }

    const payload = (await response.json()) as { access_token?: string; expires_in?: number };
    if (!payload.access_token) {
      throw new Error("Google metadata token response did not include access_token");
    }

    return {
      accessToken: payload.access_token,
      expiresAtMs: Date.now() + (payload.expires_in ?? 3600) * 1000,
    };
  }
}

function parseServiceAccountCredentials(serviceAccountJson: string): ServiceAccountCredentials {
  const parsed = JSON.parse(serviceAccountJson) as Partial<ServiceAccountCredentials>;

  if (!parsed.client_email || !parsed.private_key) {
    throw new Error("GOOGLE_CHAT_SERVICE_ACCOUNT_JSON must include client_email and private_key");
  }

  return {
    client_email: parsed.client_email,
    private_key: parsed.private_key,
    ...(parsed.token_uri ? { token_uri: parsed.token_uri } : {}),
  };
}

function signJwt(header: object, claims: object, privateKey: string): string {
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedClaims = base64UrlEncode(JSON.stringify(claims));
  const input = `${encodedHeader}.${encodedClaims}`;
  const signature = createSign("RSA-SHA256").update(input).sign(privateKey);
  return `${input}.${base64UrlEncode(signature)}`;
}

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}
