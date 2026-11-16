import type { ReactNode } from "react";
import {
  LEDGER, METRICS, SITE_NAME, STATUS_MEANING, THRESHOLD, TRIAL_IDS,
  cellSizes, get, text, rainSummary, rowsFor, series, sitePrefix, soilCompare, trialCompare, verdict,
  type Group, type LedgerRow, type SiteId, type Status,
} from "@/lib/ledger";
import { Calc, Led, N, RowTag, Struct, Tag, fmt } from "@/components/led";

/* ------------------------------------------------------------------ */
/* Plain answer                                                         */
/* ------------------------------------------------------------------ */
export function Answer({ site }: { site: SiteId }) {
  const v = verdict(), t = trialCompare(), ob = rainSummary("overberg"), sw = rainSummary("swartland");
  return (
    <>
      <p className="verdict-chip">No winner can be named from today&apos;s sources</p>
      <p className="lede">
        Under the sources we have, we cannot name a winner between wheat on wheat and a lupin or canola break crop for {SITE_NAME[site]}.
      </p>
      <p className="count">
        <Calc from={v.from}><b>{v.sourced} of {v.total}</b></Calc> metric cells have a sourced value. Our rule<Tag status="ours" />: no winner, no score and
        no ranking colour while fewer than half are sourced.
      </p>
      <h4>Why</h4>
      <ul className="bullets">
        <li><Calc from={t.from}>The one sourced trial (ARC-SGI) shows wheat yielding less after a break crop in {t.lower} of {t.cells} cells. It counts wheat yield only, not the break crop&apos;s income, disease relief or nitrogen credit.</Calc></li>
        <li>Most of what would decide it has no source we could find: the break crop&apos;s water need, its nitrogen credit and root depth.</li>
        <li><Calc from={[...ob.from, ...sw.from]}>Under our {THRESHOLD()}% rule, Overberg rain sources agree: they are within about {Math.round(ob.pct)}% ({ob.lo} to {ob.hi} mm a year). In the Swartland they are {sw.spread} mm a year apart, so rain alone cannot settle a choice there.</Calc></li>
      </ul>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* 1. Descriptive                                                       */
/* ------------------------------------------------------------------ */
const R1 = ["r1_water_use", "r1_region_rain", "r1_sowing", "r1_tillage", "r1_disease", "r1_root", "r1_nitrogen"];
const R3 = ["r3_tillage", "r3_crown_rot", "r3_n_credit", "r3_root", "r3_water", "r3_min_rain", "r3_window", "r3_heat", "r3_planting_moisture", "r3_lupin_ph", "r3_lupin_clay", "r3_longterm_trials"];

function valueText(r: LedgerRow): string {
  if (r.value === null) return "No figure";
  if (Array.isArray(r.value)) return r.value.join(", ") + (r.unit ? ` ${r.unit}` : "");
  if (typeof r.value === "number") return `${r.value.toFixed(r.dp)}${r.unit ? ` ${r.unit}` : ""}`;
  return r.unit ? `${r.value} ${r.unit}` : String(r.value);
}

function Fact({ id }: { id: string }) {
  const r = get(id);
  return (
    <li className={`fact fact-${r.status}`}>
      <p className="fact-head"><span className="fact-label">{r.label}</span><RowTag id={id} /></p>
      <p className="fact-value"><Led ids={id}>{valueText(r)}</Led></p>
      <p className="fact-src"><Led ids={id}>Source: {r.source}</Led></p>
      <p className="fact-cav"><Led ids={id}>{r.caveat}</Led></p>
    </li>
  );
}

function RotationCard({ name, sub, ids }: { name: string; sub: string; ids: string[] }) {
  return (
    <article className="rot">
      <h4>{name}</h4>
      <p className="sub">{sub}</p>
      <ul className="facts">{ids.map((id) => <Fact key={id} id={id} />)}</ul>
    </article>
  );
}

function TrialTable() {
  const t = trialCompare();
  const flags = new Map(t.byTillage.map((b) => [b.rotId, b.lowerFlags]));
  return (
    <>
      <div className="scroll" tabIndex={0} role="region" aria-label="ARC trial wheat yields">
        <table className="data">
          <caption>ARC trial, wheat yield in kg/ha. Marked cells: wheat after the break crop yielded less than the matching monoculture cell.</caption>
          <thead>
            <tr><th scope="col">Rotation</th><th scope="col">Tillage</th><th scope="col">Value A</th><th scope="col">Value B</th><th scope="col">Value C</th></tr>
          </thead>
          <tbody>
            {TRIAL_IDS.map((row) => (
              <tr key={row.id}>
                <th scope="row">{row.rotation}</th>
                <td>{row.tillage}</td>
                {series(row.id).map((_, i) => {
                  const low = flags.get(row.id)?.[i];
                  return <td key={i} className={`num${low ? " lower" : ""}`}><N id={row.id} i={i} />{low ? " (lower)" : ""}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="bullets small">
        <li><Led ids="trial_mono_mb">Source: {get("trial_mono_mb").source}</Led><RowTag id="trial_mono_mb" />. One trial, one site band, wheat yield only.</li>
        <li>The three column labels (year or site) are not in our copy, so they are shown as A, B and C.</li>
        <li><Calc from={t.from}>Wheat after the break crop yielded less than monoculture in {t.lower} of the {t.cells} cells.</Calc></li>
        <li>The table leaves out the break crop&apos;s own income, any disease relief and any nitrogen credit. It is not a prediction for any field.</li>
      </ul>
    </>
  );
}

export function Descriptive({ site }: { site: SiteId }) {
  const rs = rainSummary(site), sc = soilCompare(site);
  return (
    <>
      <p>What the sources show, with nothing added. Each fact carries its status.</p>
      <h4>Rain: four sources</h4>
      <ul className="kv">
        {rs.sources.map((s) => (
          <li key={s.key}><span>{s.name}{s.ecmwf ? " *" : ""}</span><b className="mono"><N id={s.id} /> mm</b></li>
        ))}
      </ul>
      <p className="small">* Open-Meteo and ERA5 derive from the same ECMWF reanalysis, so they are not independent. <Led ids={rs.sources[0].id}>{get(rs.sources[0].id).period}</Led>. Models and satellite estimates, not rain gauges.</p>
      <h4>Topsoil: two soil maps</h4>
      <p><Calc from={sc.from}>Clay: SoilGrids {sc.a}%, iSDA {sc.b}%. Sand: SoilGrids {sc.sgSand}%, iSDA {sc.isdaSand}%. Both are models, not measurements.</Calc></p>
      <h4>Two rotations, side by side</h4>
      <RotationCard name="R1 Wheat monoculture" sub="Stubble retained or grazed" ids={R1} />
      <RotationCard name="R3 Lupin or canola break crop" sub="With reduced tillage" ids={R3} />
      <h4>The ARC trial is a trade-off, not a verdict</h4>
      <TrialTable />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Diagnostic                                                        */
/* ------------------------------------------------------------------ */
function Resolution({ site }: { site: SiteId }) {
  const c = cellSizes(site);
  // Squares drawn to one scale: the SVG is one IMERG cell wide.
  const W = 300, perM = W / c.imerg.sideM;
  const field = Math.max(1.6, c.fieldSideM * perM), sg = Math.max(1.2, c.soilgrids.sideM * perM);
  return (
    <figure className="resfig">
      <svg viewBox="0 0 300 300" role="img" aria-label={`One NASA GPM IMERG rain cell drawn to scale, with a ${c.fieldHa} hectare field as a small square inside it.`} data-calc={c.from.join(" ")}>
        <rect x="0.75" y="0.75" width="298.5" height="298.5" fill="var(--green-wash)" stroke="var(--bar)" strokeWidth="1.5" />
        <rect x={150 - field / 2} y={150 - field / 2} width={field} height={field} fill="var(--ink)" />
        <rect x={150 + 14} y={150 - sg / 2} width={sg} height={sg} fill="var(--low)" />
        <path d={`M150 ${150 - field / 2 - 4}V118h-34`} fill="none" stroke="var(--ink)" strokeWidth="0.8" />
        <path d={`M${164 + sg / 2} ${150 + sg / 2 + 3}V182h34`} fill="none" stroke="var(--low)" strokeWidth="0.8" />
        <text x="112" y="121" textAnchor="end" className="res-t">a field</text>
        <text x="202" y="186" className="res-t">a SoilGrids cell</text>
        <text x="10" y="22" className="res-t res-g">one IMERG rain cell</text>
      </svg>
      <figcaption>
        <Calc from={c.from}>
          Drawn to scale. One IMERG rain cell is about {c.imerg.nsKm} km by {c.imerg.ewKm} km here, roughly {c.imerg.ha.toLocaleString("en-GB")} ha:
          about {c.imerg.fields.toLocaleString("en-GB")} fields of {c.fieldHa} ha share one rain value. One MERRA-2 cell (air temperature, humidity,
          soil wetness) is about {c.merra.nsKm} km by {c.merra.ewKm} km, roughly {c.merra.fields.toLocaleString("en-GB")} such fields. A SoilGrids cell
          is {c.soilgrids.m} m across ({c.soilgrids.ha} ha); an iSDA cell is {c.isda.m} m across ({c.isda.ha} ha). A {c.fieldHa} ha field is about {c.fieldSideM} m on a side.
        </Calc>{" "}
        Grid sizes<RowTag id="res_imerg" />: carried over from Build A, not read from the dataset documents in this build.
      </figcaption>
    </figure>
  );
}

export function Diagnostic({ site }: { site: SiteId }) {
  const rs = rainSummary(site), sc = soilCompare(site), v = verdict(), TH = THRESHOLD();
  return (
    <>
      <p>Why the answer is open: where the sources agree, where they do not, and what is missing.</p>
      <h4>The disagreement rule</h4>
      <p>
        <Led ids="rule_spread">Spread is the highest minus the lowest value, as a share of the NASA IMERG figure. Up to {TH}%, the sources count as agreeing.
        Above {TH}%, every value is shown and no single verdict is given.</Led><Tag status="ours" />
      </p>
      <h4>Rain at {SITE_NAME[site]}</h4>
      <p className={rs.agree ? "callout ok" : "callout warn"}>
        <Calc from={rs.from}>
          {rs.agree
            ? <><b>The sources agree: {rs.lo} to {rs.hi} mm a year.</b> Spread {rs.spread} mm, {rs.pct}% of IMERG, inside our {TH}% threshold. Confidence stays at {rs.confidence} because all four are models, not gauges, and two share ECMWF origin.</>
            : <><b>No single verdict.</b> The sources run from {rs.lo} to {rs.hi} mm a year: spread {rs.spread} mm, {rs.pct}% of IMERG, above our {TH}% threshold. Confidence {rs.confidence}. A tool that printed one number here would mislead. A local rain gauge record would narrow it.</>}
        </Calc>
      </p>
      <h4>Soil maps at {SITE_NAME[site]}</h4>
      <p className={sc.agree ? "callout ok" : "callout warn"}>
        <Calc from={sc.from}>
          {sc.agree
            ? <><b>The two maps agree on topsoil clay.</b> {sc.d} points apart, {sc.pct}% of the SoilGrids value, inside our {TH}% rule reused for soil.</>
            : <><b>The two maps disagree on topsoil clay.</b> {sc.d} points apart, {sc.pct}% of the SoilGrids value, above our {TH}% rule reused for soil. Only a soil test can say which is right.</>}
        </Calc>
      </p>
      <h4>Eight metric cells: what can be scored today</h4>
      <div className="scroll" tabIndex={0} role="region" aria-label="Farmer metrics">
        <table className="data metrics">
          <caption>A cell is scored only when it has a sourced value. <Calc from={v.from}>Sourced today: {v.sourced} of {v.total}.</Calc></caption>
          <thead><tr><th scope="col">Metric</th><th scope="col">R1 Wheat monoculture</th><th scope="col">R3 Break crop</th></tr></thead>
          <tbody>
            {METRICS.map((m) => (
              <tr key={m.id}>
                <th scope="row">{m.name}</th>
                {[m.r1, m.r3].map((c, i) => (
                  <td key={i}>
                    <b>{c.sourced ? "scored" : "no sourced value"}</b>
                    <Led ids={c.needs.length ? c.needs : ["metric_cells"]} className="small block">{c.missing}</Led>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h4>One source value covers many farms</h4>
      <Resolution site={site} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* 4. Prescriptive: evidence steps only                                 */
/* ------------------------------------------------------------------ */
export function Prescriptive({ site }: { site: SiteId }) {
  const rs = rainSummary(site), sc = soilCompare(site), v = verdict(), p = sitePrefix(site);
  const steps: { what: ReactNode; settles: string; from?: string[] }[] = [
    { what: <><Led ids={["r1_tillage", "r3_window"]}>Open the ARC-SGI 2020 winter-rainfall guideline and the DAFF canola guideline, and quote the page for each figure: wheat and break-crop water use, the canola heat limit, nitrogen credit and rooting depth.</Led></>,
      settles: `Up to ${METRICS.filter((m) => m.id !== "bare").length * 2} of the ${v.total} metric cells (water fit, heat exposure, soil health).`, from: v.from },
    { what: <>Fetch a NASA MODIS vegetation series for the outlines and apply its quality flags.</>,
      settles: "The two bare-field-days cells." },
    ...(rs.agree ? [] : [{ what: <>Get a local rain gauge record for the same years. <Led ids={`${p}_rain_imerg`}>{get(`${p}_rain_imerg`).remedy}</Led></>,
      settles: "Which of the four rain figures to believe at this site." }]),
    ...(sc.agree ? [] : [{ what: <>Take a laboratory soil test from the field, sampled by depth.</>,
      settles: "Which soil map is right about topsoil clay." }]),
    { what: <>Run and publish the <N id="spotcheck_n" />-outline spot-check of the predicted field outlines against imagery.</>,
      settles: "Whether the outlines can be trusted as decision units." },
    { what: <>Ask a grower in the district to review the comparison and the wording.</>,
      settles: "Whether the questions asked are the ones that decide the choice on a farm." },
    ...(rs.agree && sc.agree ? [{ what: <>Rain and soil maps agree here, so no extra rain or soil record is first in line. A soil test and a rain gauge would still replace models with measurements.</>,
      settles: "Confidence, which stays capped while every value is a model." }] : []),
  ];
  return (
    <>
      <p>
        What to do next. These are steps to get evidence, in order of how many open cells each would settle. This page does not tell you which crop to plant:
        <Calc from={v.from}> with {v.sourced} of {v.total} cells sourced, that would be a guess.</Calc>
      </p>
      <ol className="steps">
        {steps.map((s, i) => (
          <li key={i}>
            <p>{s.what}</p>
            <p className="small"><b>Settles:</b> {s.from ? <Calc from={s.from}>{s.settles}</Calc> : s.settles}</p>
          </li>
        ))}
      </ol>
      <p className="small">Until then, the honest position is the plain answer above: no winner named.</p>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Trust panel                                                          */
/* ------------------------------------------------------------------ */
const GROUP_NAME: Record<Group, string> = {
  site: "Site", rain: "Rain", air: "Air", wetness: "Soil wetness", soil: "Soil by depth", topsoil: "Topsoil, two maps",
  terrain: "Terrain", outlines: "Field outlines", sun: "Sun", rule: "Our rules and thresholds", r1: "R1 Wheat monoculture",
  r3: "R3 Break crop", trial: "ARC trial", scale: "Scale", resolution: "Source grid sizes", licence: "Licence", app: "This app",
};

export function statusCounts(rows: readonly LedgerRow[]) {
  const c: Record<Status, number> = { checked: 0, unverified: 0, assumed: 0, ours: 0 };
  rows.forEach((r) => { c[r.status]++; });
  return c;
}

export function StatusKey({ rows }: { rows: readonly LedgerRow[] }) {
  const c = statusCounts(rows);
  return (
    <ul className="statuskey">
      {(Object.keys(c) as Status[]).map((s) => (
        <li key={s}>
          <Tag status={s} /> <Struct why="count of ledger rows with this status, computed from the ledger itself"><b>{c[s]}</b></Struct> rows. {STATUS_MEANING[s]}
        </li>
      ))}
    </ul>
  );
}

export function LedgerCards({ rows }: { rows: readonly LedgerRow[] }) {
  const groups = Array.from(new Set(rows.map((r) => r.group)));
  return (
    <>
      {groups.map((g) => (
        <details key={g} className="ledger-group">
          <summary>{GROUP_NAME[g]} <span className="soft">(<Struct why="count of ledger rows in this group">{rows.filter((r) => r.group === g).length}</Struct>)</span></summary>
          <ul className="ledger-cards">
            {rows.filter((r) => r.group === g).map((r) => (
              <li key={r.id} data-led={r.id}>
                <p className="fact-head"><span className="fact-label">{r.label}</span><Tag status={r.status} /></p>
                <p className="fact-value">{valueText(r)}</p>
                <dl>
                  <dt>Source</dt><dd>{r.source}{r.isNasa ? " (NASA data)" : ""}</dd>
                  <dt>Resolution</dt><dd>{r.resolution}</dd>
                  <dt>Period</dt><dd>{r.period}</dd>
                  <dt>Confidence</dt><dd>{r.confidence}</dd>
                  <dt>Checked</dt><dd>{r.date}</dd>
                  <dt>Caveat</dt><dd>{r.caveat}</dd>
                  <dt>Remedy</dt><dd>{r.remedy}</dd>
                </dl>
              </li>
            ))}
          </ul>
        </details>
      ))}
    </>
  );
}

export function Trust({ site }: { site: SiteId }) {
  const rows = rowsFor(site);
  return (
    <>
      <p>Every number in the text and charts is a row in one ledger, or is computed from rows it names. Each row gives its source, its status and what would raise that status. The few numbers inside the block drawing are part of a baked image; each is repeated as text.</p>
      <StatusKey rows={rows} />
      <LedgerCards rows={rows} />
      <p className="small"><a href="/ledger">Open the full ledger as a table</a> · <a href={`/api/ledger?lat=${fmt(`${sitePrefix(site)}_lat`)}&lon=${fmt(`${sitePrefix(site)}_lon`)}`} data-led={`${sitePrefix(site)}_lat ${sitePrefix(site)}_lon`}>Ledger as JSON</a></p>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Sources                                                              */
/* ------------------------------------------------------------------ */
export function Sources() {
  const seen = new Map<string, LedgerRow>();
  LEDGER.forEach((r) => { if (r.url && !seen.has(r.url)) seen.set(r.url, r); });
  return (
    <>
      <ul className="bullets small">
        {Array.from(seen.values()).map((r) => (
          <li key={r.id} data-led={r.id}>
            <a href={r.url ?? "#"} target="_blank" rel="noopener noreferrer">{r.source}<span className="vh"> (opens in a new tab)</span></a>
            {r.isNasa ? " · NASA data" : ""}
          </li>
        ))}
      </ul>
      <p className="small">
        <b>Field outlines:</b> Fields of the World. <Led ids="licence_ftw">{text("licence_ftw")}.</Led><RowTag id="licence_ftw" />{" "}
        <Led ids="licence_ftw">{get("licence_ftw").caveat}</Led> The outlines are computer predictions, not surveyed boundaries.
      </p>
      <p className="small"><b>Globe:</b> <Led ids="earth_img">{text("earth_img")}</Led>, bundled with the page. Without WebGL a drawn globe is shown instead: <Led ids="coast">{text("coast")}</Led>.</p>
      <p className="small">
        <b>AI use:</b> AI agents (Claude, Anthropic) wrote the page code, packaged the data and drafted the copy, under human direction. The 3D block is drawn in the browser from a NASA
        satellite image and terrain heights bundled with the page. The flat drawing is a baked image from the earlier build, drawn by code from data files that are not all in this repository. The optional analysis calls Google Gemini and is labelled as AI-generated. Nothing here has been reviewed by a grower.
      </p>
      <p className="small">Built for the NASA Space Apps Challenge <Struct why="event year">2026</Struct>, Field Shift challenge. Not affiliated with or endorsed by NASA.</p>
      <p className="small">Links open the provider&apos;s site. This page itself makes no third-party requests.</p>
    </>
  );
}
