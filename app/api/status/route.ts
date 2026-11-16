import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Whether the optional AI analysis is switched on. Never returns a key. */
export async function GET() {
  return NextResponse.json({ ai: Boolean(process.env.GEMINI_API_KEY ?? process.env.GEMINI_KEY) }, { headers: { "Cache-Control": "no-store" } });
}
