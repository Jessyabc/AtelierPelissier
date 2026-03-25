import { NextRequest, NextResponse } from "next/server";
import { getAppConfig } from "@/lib/config";
import { getSageAuthorizeUrl } from "@/lib/sage";

const STATE_COOKIE = "sage_oauth_state";
const STATE_MAX_AGE = 600; // 10 minutes

export const dynamic = "force-dynamic";

/**
 * GET /api/integrations/sage/connect
 * Redirects the user to Sage Business Cloud to sign in and authorize the app.
 * Requires Sage Client ID and Client Secret to be saved in Admin → Integrations first.
 */
export async function GET(req: NextRequest) {
  try {
    const config = await getAppConfig();
    const clientId = config.integrations?.sageClientId as string | undefined;
    const clientSecret = config.integrations?.sageClientSecret as string | undefined;

    if (!clientId?.trim()) {
      return NextResponse.redirect(
        new URL("/admin?tab=integrations&sage=missing_credentials", req.url)
      );
    }

    const origin = req.nextUrl.origin;
    const redirectUri = `${origin}/api/integrations/sage/callback`;

    const state = crypto.randomUUID();
    const authUrl = getSageAuthorizeUrl({
      clientId: clientId.trim(),
      redirectUri,
      state,
    });

    const res = NextResponse.redirect(authUrl);
    res.cookies.set(STATE_COOKIE, state, {
      httpOnly: true,
      secure: origin.startsWith("https"),
      sameSite: "lax",
      maxAge: STATE_MAX_AGE,
      path: "/",
    });
    return res;
  } catch (err) {
    console.error("Sage connect error:", err);
    return NextResponse.redirect(
      new URL("/admin?tab=integrations&sage=error", req.url)
    );
  }
}
