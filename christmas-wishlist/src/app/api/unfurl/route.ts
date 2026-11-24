import { NextResponse, type NextRequest } from "next/server";
import { decodeBody, parseProductPage, type Unfurled } from "@/lib/unfurl/parse";
import { checkUrl, safeFetch, UnfurlBlockedError } from "@/lib/unfurl/safe-fetch";
import { createClient } from "@/lib/supabase/server";

export type UnfurlResponse = { ok: boolean; fields: Unfurled; message?: string };

const json = (body: UnfurlResponse, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

/**
 * GET /api/unfurl?url=… → { ok, fields: { title?, image_url?, price_cents?, currency? } }
 *
 * Signed-in users only, so this can't be used as an open proxy. Failures
 * still return 200 with whatever was found, so the form can fall back to
 * manual entry without an error screen.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return json({ ok: false, fields: {}, message: "Sign in first." }, 401);

  const raw = request.nextUrl.searchParams.get("url")?.trim() ?? "";
  try {
    checkUrl(raw);
  } catch (err) {
    return json({ ok: false, fields: {}, message: (err as Error).message }, 400);
  }

  try {
    const page = await safeFetch(raw);
    const isHtml = /html|xml/i.test(page.contentType) || page.contentType === "";
    if (page.status >= 400 || !isHtml) {
      return json({ ok: false, fields: {}, message: "That store didn't share product details." });
    }
    const fields = parseProductPage(decodeBody(page.body, page.contentType), page.url);
    return json({ ok: Object.keys(fields).length > 0, fields });
  } catch (err) {
    const message =
      err instanceof UnfurlBlockedError ? err.message : "We couldn't reach that page. You can type the details instead.";
    return json({ ok: false, fields: {}, message });
  }
}
