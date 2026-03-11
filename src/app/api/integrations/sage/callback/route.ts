import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAppConfig } from "@/lib/config";
import { exchangeCodeForTokens } from "@/lib/sage";

const STATE_COOKIE = "sage_oauth_state";

/**
 * GET /api/integrations/sage/callback
 * Sage redirects here after the user authorizes. We exchange the code for tokens
 * and store them in AppConfig.integrations, then redirect to Admin.
 */
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error");
  const errorDesc = searchParams.get("error_description");

  const origin = req.nextUrl.origin;
  const redirectToAdmin = (query = "") =>
    NextResponse.redirect(new URL(`/admin${query}`, origin));

  if (errorParam) {
    const q = new URLSearchParams({ tab: "integrations", sage: "denied" });
    if (errorParam) q.set("error", errorParam);
    if (errorDesc) q.set("error_description", errorDesc);
    return redirectToAdmin(`?${q.toString()}`);
  }

  if (!code) {
    return redirectToAdmin(`?tab=integrations&sage=no_code`);
  }

  const storedState = req.cookies.get(STATE_COOKIE)?.value;
  if (!state || state !== storedState) {
    return redirectToAdmin(`?tab=integrations&sage=invalid_state`);
  }

  try {
    const config = await getAppConfig();
    const clientId = config.integrations?.sageClientId as string | undefined;
    const clientSecret = config.integrations?.sageClientSecret as string | undefined;

    if (!clientId?.trim() || !clientSecret?.trim()) {
      return redirectToAdmin(`?tab=integrations&sage=missing_config`);
    }

    const redirectUri = `${origin}/api/integrations/sage/callback`;
    const tokens = await exchangeCodeForTokens({
      code,
      redirectUri,
      clientId: clientId.trim(),
      clientSecret: clientSecret.trim(),
    });

    const expiresAt = Math.floor(Date.now() / 1000) + (tokens.expires_in ?? 0);
    const integrations = { ...config.integrations };
    integrations.sageAccessToken = tokens.access_token;
    integrations.sageRefreshToken = tokens.refresh_token ?? integrations.sageRefreshToken;
    integrations.sageTokenExpiresAt = expiresAt;
    integrations.sageEnabled = true;

    const rows = await prisma.appConfig.findMany({ take: 1 });
    const row = rows[0];
    if (row) {
      const current = (row.integrations && JSON.parse(row.integrations)) ?? {};
      await prisma.appConfig.update({
        where: { id: row.id },
        data: {
          integrations: JSON.stringify({ ...current, ...integrations }),
        },
      });
    }

    const res = redirectToAdmin("?tab=integrations&sage=connected");
    res.cookies.delete(STATE_COOKIE);
    return res;
  } catch (err) {
    console.error("Sage callback token exchange error:", err);
    return redirectToAdmin(`?tab=integrations&sage=exchange_failed`);
  }
}
