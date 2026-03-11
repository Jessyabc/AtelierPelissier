/**
 * Sage Business Cloud Accounting (Canada / NA) OAuth 2.0 helpers.
 * NA apps (A-P Connection, etc.) use accounting.na.sageone.com for auth and
 * oauth.na.sageone.com for token. Set SAGE_USE_GLOBAL_AUTH=true to use
 * www.sageone.com and oauth.accounting.sage.com instead.
 */

const SAGE_AUTH_NA = "https://accounting.na.sageone.com/oauth2/auth/central";
const SAGE_AUTH_GLOBAL = "https://www.sageone.com/oauth2/auth/central";
const SAGE_TOKEN_NA = "https://oauth.na.sageone.com/token";
const SAGE_TOKEN_GLOBAL = "https://oauth.accounting.sage.com/token";
const SAGE_SCOPES = "full_access offline_access";

function useNaEndpoints(): boolean {
  return process.env.SAGE_USE_GLOBAL_AUTH !== "true";
}

function getAuthBaseUrl(): string {
  return useNaEndpoints() ? SAGE_AUTH_NA : SAGE_AUTH_GLOBAL;
}

function getTokenUrl(): string {
  return useNaEndpoints() ? SAGE_TOKEN_NA : SAGE_TOKEN_GLOBAL;
}

export function getSageAuthorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const q = new URLSearchParams({
    client_id: params.clientId,
    response_type: "code",
    redirect_uri: params.redirectUri,
    state: params.state,
    scope: SAGE_SCOPES,
  });
  return `${getAuthBaseUrl()}?${q.toString()}`;
}

export type SageTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type?: string;
};

/**
 * Exchange authorization code for access and refresh tokens.
 */
export async function exchangeCodeForTokens(params: {
  code: string;
  redirectUri: string;
  clientId: string;
  clientSecret: string;
}): Promise<SageTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: params.code,
    redirect_uri: params.redirectUri,
    client_id: params.clientId,
    client_secret: params.clientSecret,
  });

  const res = await fetch(getTokenUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Sage token exchange failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as SageTokenResponse;
  if (!data.access_token) throw new Error("Sage response missing access_token");
  return data;
}

/**
 * Refresh access token using stored refresh token.
 */
export async function refreshSageAccessToken(params: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}): Promise<SageTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: params.refreshToken,
    client_id: params.clientId,
    client_secret: params.clientSecret,
  });

  const res = await fetch(getTokenUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Sage token refresh failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as SageTokenResponse;
  if (!data.access_token) throw new Error("Sage response missing access_token");
  return data;
}
