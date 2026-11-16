// Fails if any number on screen has no ledger row.
// Every text node (HTML and SVG) that contains a digit must sit inside an element
// marked data-led (ledger row ids), data-calc (rows a figure was computed from)
// or data-struct (a structural number, with its reason). Every id named must exist.
// Run against a started app: BASE=http://localhost:3000 node scripts/check-numbers.mjs
import { chromium } from "./_pw.mjs";
import { BASE, PAGES, SITES, expand } from "./pages.mjs";

// Names that contain a digit but are not quantities. Removed before the digit test.
const NAMES = ["ERA5", "MERRA-2", "R1", "R3", "3D", "Sentinel-2"];

const ids = new Set();
const rows = {};
for (const s of SITES) {
  const res = await fetch(`${BASE}/api/ledger?lat=${s.lat}&lon=${s.lon}`);
  if (!res.ok) throw new Error(`ledger API ${res.status}`);
  for (const r of (await res.json()).rows) { ids.add(r.id); rows[r.id] = r; }
}
/** How the ledger value should read on screen. */
function expected(id, i) {
  const r = rows[id];
  const v = Array.isArray(r.value) ? r.value[Number(i)] : r.value;
  if (v === null) return "No figure";
  return typeof v === "number" ? v.toFixed(r.dp) : String(v);
}
console.log(`ledger rows known: ${ids.size}`);

const browser = await chromium.launch();
let failures = 0, checked = 0, values = 0;
for (const vp of [{ width: 1920, height: 1080 }, { width: 390, height: 844 }]) {
  const page = await browser.newPage({ viewport: vp });
  for (const p of PAGES) {
    await page.goto(BASE + p.path, { waitUntil: "networkidle" });
    if (p.analysis) await expand(page);
    const found = await page.evaluate((NAMES) => {
      const out = [];
      const strip = (t) => NAMES.reduce((acc, n) => acc.split(n).join(""), t);
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const text = n.nodeValue ?? "";
        if (!/\d/.test(strip(text))) continue;
        const el = n.parentElement;
        if (!el || el.closest("script, style, noscript, next-route-announcer, nextjs-portal")) continue;
        const led = el.closest("[data-led]"), calc = el.closest("[data-calc]"), struct = el.closest("[data-struct]");
        out.push({
          text: text.trim().slice(0, 90),
          refs: [led?.getAttribute("data-led"), calc?.getAttribute("data-calc")].filter(Boolean).join(" ").split(/\s+/).filter(Boolean),
          struct: struct?.getAttribute("data-struct") ?? null,
        });
      }
      // Numbers in accessible names count too.
      for (const el of document.querySelectorAll("[aria-label], img[alt]")) {
        const text = el.getAttribute("aria-label") ?? el.getAttribute("alt") ?? "";
        if (!/\d/.test(strip(text))) continue;
        const led = el.closest("[data-led]"), calc = el.closest("[data-calc]"), struct = el.closest("[data-struct]");
        out.push({
          text: "(accessible name) " + text.slice(0, 80),
          refs: [led?.getAttribute("data-led"), calc?.getAttribute("data-calc")].filter(Boolean).join(" ").split(/\s+/).filter(Boolean),
          struct: struct?.getAttribute("data-struct") ?? null,
        });
      }
      return out;
    }, NAMES);
    // Exact values: every <N> must print exactly what the ledger holds.
    const exact = await page.evaluate(() =>
      Array.from(document.querySelectorAll("[data-n]")).map((el) => ({ id: el.getAttribute("data-led"), i: el.getAttribute("data-n"), text: el.textContent ?? "" })));
    for (const e of exact) {
      values++;
      if (!rows[e.id] || expected(e.id, e.i) !== e.text) { failures++; console.error(`FAIL ${p.name} @${vp.width}: "${e.text}" is not the ledger value of ${e.id}`); }
    }
    for (const f of found) {
      checked++;
      const unknown = f.refs.filter((id) => !ids.has(id));
      if (unknown.length) { failures++; console.error(`FAIL ${p.name} @${vp.width}: unknown ledger id ${unknown.join(", ")} for "${f.text}"`); }
      else if (f.refs.length === 0 && !f.struct) { failures++; console.error(`FAIL ${p.name} @${vp.width}: number with no ledger row: "${f.text}"`); }
    }
  }
  await page.close();
}
await browser.close();
console.log(`numeric text nodes checked: ${checked}; exact ledger values compared: ${values}; failures: ${failures}`);
process.exit(failures ? 1 : 0);
