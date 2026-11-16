import { NextRequest, NextResponse } from "next/server";
import { parseSiteQuery } from "@/lib/siteGuard";
import { buildPayload } from "@/lib/ai/payload";
import { cached, HOUR } from "@/lib/cache";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Optional AI analysis. The server builds the payload from the fact ledger
 * (the caller supplies only which site), sends it to Google Gemini and asks
 * for the four types of analysis. The reply is shown only if its numbers
 * pass the number check. The UI labels it AI-generated and not validated.
 * With no key set the route answers { configured: false } and the page is
 * complete without it.
 */
/* ── per-IP rate limit (in-memory, per server instance) ─────────── */
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 3600_000;
const MAX_TRACKED_IPS = 1000;
const hits = new Map<string, number[]>();

/** Client address for rate limiting. Prefers the platform's own header, then
 *  the last x-forwarded-for hop (the one added by the nearest proxy), because
 *  earlier hops can be set by the caller. Returns null when there is none. */
function clientIp(req: NextRequest): string | null {
  const real = req.headers.get("x-real-ip")?.trim();
  const hops = req.headers.get("x-forwarded-for")?.split(",").map((h) => h.trim()).filter(Boolean) ?? [];
  const ip = real || hops[hops.length - 1];
  return ip && /^[0-9a-fA-F:.]{3,45}$/.test(ip) ? ip : null;
}

/* ── global cap: upstream calls per hour across all callers ─────── */
const GLOBAL_LIMIT = 30;
let globalHits: number[] = [];
function takeGlobalSlot(): boolean {
  const now = Date.now();
  globalHits = globalHits.filter((t) => now - t < RATE_WINDOW_MS);
  if (globalHits.length >= GLOBAL_LIMIT) return false;
  globalHits.push(now);
  return true;
}

/** true if this call is allowed; records it when allowed */
function takeRateSlot(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    hits.set(ip, recent);
    return false;
  }
  recent.push(now);
  hits.delete(ip);
  hits.set(ip, recent);
  while (hits.size > MAX_TRACKED_IPS) {
    const oldest = hits.keys().next().value;
    if (oldest === undefined) break;
    hits.delete(oldest);
  }
  return true;
}

/* ── number check: every number in the reply must come from the input ── */
const MAX_UNVERIFIED = 3;
const MAX_PAYLOAD_CHARS = 40_000;
const NUMBER_CHECK_FAIL = "AI analysis unavailable: output failed the number check";
const NUM_RE = /\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g;

function inputNumberSet(text: string): Set<string> {
  const set = new Set<string>();
  for (const tok of text.match(NUM_RE) ?? []) {
    const v = Number(tok.replace(/,/g, ""));
    if (!Number.isFinite(v)) continue;
    // accept the model rounding an input value to 0-3 decimals
    for (let d = 0; d <= 3; d++) set.add(v.toFixed(d));
  }
  return set;
}

function checkNumbers(markdown: string, allowed: Set<string>) {
  const failed: string[] = [];
  let checked = 0;
  for (const tok of markdown.match(NUM_RE) ?? []) {
    checked++;
    const clean = tok.replace(/,/g, "");
    const v = Number(clean);
    const decimals = clean.includes(".") ? clean.split(".")[1].length : 0;
    const whole = decimals === 0 && Number.isInteger(v);
    if (whole && v >= 0 && v <= 10) continue; // list numbering, small counts
    if (whole && v >= 1900 && v <= 2100) continue; // years
    if (decimals <= 3 && allowed.has(v.toFixed(decimals))) continue;
    failed.push(tok);
  }
  return { checked, failed };
}

export async function POST(req: NextRequest) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return NextResponse.json({ configured: false, error: "The AI analysis is switched off on this server." }, { status: 200 });
  }

  // Same-origin only: a browser on another site cannot spend this server's quota.
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (origin) {
    let originHost: string | null = null;
    try { originHost = new URL(origin).host; } catch { originHost = null; }
    if (!originHost || originHost !== host) {
      return NextResponse.json({ error: "Cross-origin requests are not accepted." }, { status: 403 });
    }
  }

  const q = parseSiteQuery(req);
  if (q instanceof NextResponse) return q;

  const ip = clientIp(req);
  if (!ip) {
    return NextResponse.json({ configured: true, error: "The request could not be attributed to a client address." }, { status: 400 });
  }
  if (!takeRateSlot(ip)) {
    return NextResponse.json(
      { configured: true, error: "Rate limit reached: 10 analyses per hour. Try again later." },
      { status: 429 }
    );
  }

  const envModel = process.env.GEMINI_MODEL;
  const model = envModel && /^[\w.-]{1,60}$/.test(envModel) ? envModel : "gemini-3.5-flash-lite";
  let payload: ReturnType<typeof buildPayload>;
  let payloadJson: string;
  try {
    payload = buildPayload(q.site.slug);
    payloadJson = JSON.stringify(payload);
    // Never send a cut-off payload: the model would see broken JSON.
    if (payloadJson.length > MAX_PAYLOAD_CHARS) throw new Error("payload too large");
  } catch (e) {
    console.error("analyze: payload could not be built", e instanceof Error ? e.message : "unknown");
    return NextResponse.json({ configured: true, error: "The analysis could not be prepared." }, { status: 200 });
  }

  const prompt = `You are an analyst inside "Fallow", a decision-support page for a winter-rainfall wheat grower.
The grower at ${payload.site} faces ONE decision:
"Next winter, do I plant wheat on wheat again, or put in a lupin or canola break crop?"

Below is the page's fact ledger for this site. Use ONLY this data. Never invent a number: every number
you write must appear in the data. Each ledger row has a status: "checked", "unverified", "assumed"
(no source found) or "ours" (our own threshold). Say the status whenever you rely on a row.

HARD RULES
- ${payload.diagnostic.metric_cells.sourced} of ${payload.diagnostic.metric_cells.total} metric cells are sourced. You must NOT name a winner, give a score, rank the rotations or tell the grower which crop to plant.
- Predictions must be conditional ("if ..., then the evidence would lean ...") and must quote the conditional ranges given. No forecast.
- Recommendations must be steps to gather evidence (a document to open, a measurement to take), taken from the remedies in the data.
- All values are model values or written guidelines, not measurements. Say so.

DATA (JSON):
${payloadJson}

Write concise GitHub-flavoured markdown with EXACTLY these four sections and no preamble:

## Descriptive: what the sources show
4 to 6 bullets. The figures that matter most, each with its source and status.

## Diagnostic: why the answer is open
Bullets. Where the rain sources and the soil maps agree or disagree under the page's rule, which metric cells have no source, and what the source cell size means for a single field.

## Predictive: what would change the answer
Conditional statements only, built from the conditional ranges in the data. State that the thresholds are the page's own.

## Prescriptive: what to do next
A short numbered list of evidence steps, most useful first. End with one sentence saying no crop is recommended and why.

Keep it under 420 words.`;

  // The payload is the same for every caller of a site, so one good reply is
  // kept for an hour. That bounds upstream calls whatever the callers do.
  try {
    const result = await cached(`analyze:${q.site.slug}:${model}`, HOUR, async () => {
      if (!takeGlobalSlot()) throw new AnalyzeError("The AI analysis is busy. Try again later.");
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 1400 },
          }),
          cache: "no-store",
          signal: AbortSignal.timeout(45_000),
        }
      );
      if (!res.ok) {
        console.error(`analyze: upstream status ${res.status}`);
        throw new AnalyzeError("The AI service returned an error. Try again later.");
      }
      const text = extractText(await res.json());
      if (!text) throw new AnalyzeError("The AI service returned no text.");
      // Numbers are compared with the prompt, which carries exactly the ledger payload the model saw.
      const check = checkNumbers(text, inputNumberSet(prompt));
      if (check.failed.length > MAX_UNVERIFIED) throw new AnalyzeError(NUMBER_CHECK_FAIL);
      const markdown = check.failed.length
        ? `${text}\n\n---\n\n_Number check: ${check.failed.join(", ")} not found in the ledger. Treat as unverified._`
        : text;
      return { model, markdown };
    });
    return NextResponse.json({ configured: true, ...result });
  } catch (e) {
    if (e instanceof AnalyzeError) return NextResponse.json({ configured: true, error: e.message }, { status: 200 });
    console.error("analyze: request failed", e instanceof Error ? e.name : "unknown");
    return NextResponse.json({ configured: true, error: "The AI service could not be reached. Try again later." }, { status: 200 });
  }
}

/** A failure with a message that is safe to show the visitor. */
class AnalyzeError extends Error {}

function extractText(json: unknown): string | null {
  if (typeof json !== "object" || json === null) return null;
  const candidates = (json as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  const parts = (candidates[0] as { content?: { parts?: unknown } } | null)?.content?.parts;
  if (!Array.isArray(parts)) return null;
  const text = parts.map((p) => (typeof (p as { text?: unknown })?.text === "string" ? (p as { text: string }).text : "")).join("");
  return text.length > 0 ? text : null;
}
