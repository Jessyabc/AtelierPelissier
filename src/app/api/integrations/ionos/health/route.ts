import { NextResponse } from "next/server";

const IONOS_DNS_BASE = "https://api.hosting.ionos.com/dns/v1";

function readIonosKeys() {
  const publicKey =
    process.env.IONOS_PUBLIC_API_KEY?.trim() ||
    process.env.IONOS_API_KEY_PUBLIC?.trim() ||
    process.env.IONOS_API_PUBLIC?.trim() ||
    "";
  const secretKey =
    process.env.IONOS_SECRET_API_KEY?.trim() ||
    process.env.IONOS_API_KEY_SECRET?.trim() ||
    process.env.IONOS_API_SECRET?.trim() ||
    "";
  return { publicKey, secretKey };
}

function mask(value: string) {
  if (!value) return "";
  if (value.length <= 8) return "*".repeat(value.length);
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

/**
 * GET /api/integrations/ionos/health
 * Verifies IONOS key presence and performs a minimal DNS API auth check.
 * Never returns raw keys.
 */
export async function GET() {
  const { publicKey, secretKey } = readIonosKeys();
  if (!publicKey || !secretKey) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "IONOS API keys are missing. Add IONOS_PUBLIC_API_KEY and IONOS_SECRET_API_KEY to .env.local.",
        configured: {
          publicKey: Boolean(publicKey),
          secretKey: Boolean(secretKey),
        },
      },
      { status: 400 }
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(`${IONOS_DNS_BASE}/zones`, {
      method: "GET",
      headers: {
        "X-API-Key": `${publicKey}.${secretKey}`,
        Accept: "application/json",
      },
      signal: controller.signal,
      cache: "no-store",
    });

    const raw = await res.text();
    let zoneCount: number | null = null;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) zoneCount = parsed.length;
    } catch {
      // Ignore parse errors; we only need auth status.
    }

    if (res.status === 401 || res.status === 403) {
      return NextResponse.json(
        {
          ok: false,
          error: "IONOS authentication failed. Check public/secret key pair.",
          status: res.status,
          configured: {
            publicKey: mask(publicKey),
            secretKey: mask(secretKey),
          },
        },
        { status: 401 }
      );
    }

    if (!res.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "IONOS API responded with an error.",
          status: res.status,
          details: raw.slice(0, 300),
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "IONOS API key pair is valid for DNS API.",
      endpoint: `${IONOS_DNS_BASE}/zones`,
      zoneCount,
      configured: {
        publicKey: mask(publicKey),
        secretKey: mask(secretKey),
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown network error";
    return NextResponse.json(
      {
        ok: false,
        error: "Could not reach IONOS DNS API.",
        details: msg,
      },
      { status: 504 }
    );
  } finally {
    clearTimeout(timeout);
  }
}

