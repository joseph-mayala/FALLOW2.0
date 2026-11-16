/**
 * Predictive part: "What would change the answer".
 * Ported from Build A (reference/build-a/app.js, section A1). Conditional
 * ranges only. Every figure is computed in lib/ledger/derive.ts from ledger rows.
 */
import type { ReactNode } from "react";
import {
  MONTHS_LONG, MONTHS_SHORT, SEASON, THRESHOLD, get, moistureSteps, seasonRain, series, sitePrefix, soilCompare,
  trialCompare, DEPTHS, num, text, type SiteId,
} from "@/lib/ledger";
import { Calc, RowTag, Tag } from "@/components/led";

const MINUS = "−";
const sgn = (x: number) => (x > 0 ? "+" : x < 0 ? MINUS : "") + Math.abs(x);

function Block({ title, from, conds, lines }: { title: string; from: string[]; conds: ReactNode[]; lines: ReactNode[] }) {
  return (
    <div className="cond">
      <h4>{title}</h4>
      <ul className="cond-list">
        {conds.map((c, i) => <li key={i}><Calc from={from}>{c}</Calc></li>)}
      </ul>
      <details className="working">
        <summary>Inputs and arithmetic</summary>
        <ul>
          {lines.map((l, i) => <li key={i}><Calc from={from}>{l}</Calc></li>)}
        </ul>
      </details>
    </div>
  );
}

function RainBlock({ site }: { site: SiteId }) {
  const s = seasonRain(site), TH = THRESHOLD();
  const { lo, hi, cut1, cut2, rs, wuMin } = s;
  let wuText: string;
  if (hi < wuMin) wuText = `all four season estimates (${lo} to ${hi} mm) fall short of ${wuMin} mm, by ${wuMin - hi} to ${wuMin - lo} mm. Any rest would have to come from stored soil water, which no source here gives. `;
  else if (lo >= wuMin) wuText = `all four season estimates (${lo} to ${hi} mm) reach ${wuMin} mm. `;
  else wuText = `${s.reach} of 4 season estimates reach ${wuMin} mm (range ${lo} to ${hi} mm), so the sources do not agree on whether wheat's water need is met from rain alone. `;
  const conds: ReactNode[] = [
    <><strong>If May to October rain falls in the lower third of the four sources (below about {cut1} mm): </strong><Tag status="ours" /> water is the main risk for a break crop. Its water need has no source<RowTag id="r3_water" />; canola is reported very susceptible to drought stress during flowering<RowTag id="r3_heat" />.</>,
    <><strong>In the middle third ({cut1} to {cut2} mm): </strong><Tag status="ours" /> rain does not separate the two rotations. The trial gap below and the missing nitrogen and disease figures decide it.</>,
    <><strong>In the upper third (above about {cut2} mm): </strong><Tag status="ours" /> the wheat-on-wheat disease carry-over matters more. Retained stubble can increase take-all, crown rot, Septoria, eyespot and head blight<RowTag id="r1_disease" />, with no size of effect given. That a wetter season makes this worse:<Tag status="assumed" />.</>,
    rs.agree
      ? <>Under our {TH}% rain-spread rule<Tag status="ours" /> the four sources agree here (annual spread {rs.pct}%). The lower and upper ends are only {hi - lo} mm apart in season, so the three statements sit close together.</>
      : <>Under our {TH}% rain-spread rule<Tag status="ours" /> the sources disagree here (annual spread {rs.pct}%). The lower and upper ends are {hi - lo} mm apart in season, so the data cannot say which statement fits a normal season. A local rain gauge record would.</>,
    <>Against the wheat water-use figure of {s.wuText}<RowTag id="r1_water_use" /> (from a passage on summer-rainfall provinces): {wuText}Stored soil water:<Tag status="assumed" />.</>,
  ];
  const minRain = num("r3_min_rain");
  const reachMin = s.src.filter((x) => x.season >= minRain).length;
  conds.push(
    <>Against the reported break-crop minimum of {minRain} mm in the season<RowTag id="r3_min_rain" />: {reachMin} of 4 season estimates reach it (range {lo} to {hi} mm). The figure is a minimum for a viable crop, not a water-use figure, and its source was not opened by us.</>,
  );
  const lines: ReactNode[] = [
    <>NASA GPM IMERG monthly rain, May to October: {s.seasonMonths.join(" + ")} = {s.seasonMm} mm, of {s.annual} mm a year ({s.sharePct}%).</>,
    <>May to October as the growing season is our window<RowTag id="season_months" />; only the May to July sowing window is sourced<RowTag id="r1_sowing" />.</>,
    <>Season estimate per source = annual figure × {s.sharePct}%, assuming all four sources share IMERG&apos;s monthly pattern<Tag status="assumed" />: {s.src.map((x) => `${x.name} ${x.annual} × ${s.shareFactor} = ${x.season}`).join("; ")} mm.</>,
    <>Lower-third edge = {lo} + ({hi} {MINUS} {lo}) ÷ 3 = {cut1} mm. Upper-third edge = {lo} + 2 × ({hi} {MINUS} {lo}) ÷ 3 = {cut2} mm.</>,
    <>Annual spread = ({rs.hi} {MINUS} {rs.lo}) ÷ {rs.imerg} (IMERG) = {rs.pct}%; our threshold is {TH}%.</>,
  ];
  return <Block title="Rain in the growing season" from={[...s.from, "r3_min_rain"]} conds={conds} lines={lines} />;
}

function MoistureBlock({ site }: { site: SiteId }) {
  const m = moistureSteps(site);
  const conds: ReactNode[] = m.steps.map((st) => (
    <>
      <strong>If “moist enough” means {st.prev === null ? "" : `more than ${st.prev}% and `}up to {st.value}% of full wetness: </strong>
      the model&apos;s surface layer reaches it in {MONTHS_LONG[st.month]}.
      {st.month === 5
        ? " June is the end of the canola window; planting after 15 June is reported to cut yield significantly"
        : " That is inside the canola window of April to early June"}
      <RowTag id="r3_window" />.
    </>
  ));
  conds.push(<><strong>If it means more than {m.last}%: </strong>the model does not reach it by June, so the canola window would be missed<RowTag id="r3_window" />.</>);
  conds.push(<>Lupin: the source covers canola only. No lupin planting-moisture figure found<Tag status="assumed" />.</>);
  const lines: ReactNode[] = [
    <>NASA POWER (MERRA-2) modelled surface wetness, 2001-2025 monthly climatology: {m.readings.map((r) => `${MONTHS_SHORT[r.month]} ${r.value}%`).join(", ")}.</>,
    <>Canola cannot be planted when the top 5 to 7.5 cm of soil has dried out<RowTag id="r3_planting_moisture" />.</>,
    <>The model&apos;s surface layer is not the top 5 cm and is not a measurement. Which percent counts as “dried out”:<Tag status="assumed" />.</>,
  ];
  return <Block title="Topsoil moisture at canola planting" from={m.from} conds={conds} lines={lines} />;
}

function SoilBlock({ site }: { site: SiteId }) {
  const c = soilCompare(site), TH = THRESHOLD(), p = sitePrefix(site);
  const depthIds = DEPTHS.map((d) => `${p}_clay_${d.replace("-", "_")}`);
  const phR = get("r3_lupin_ph").range, clayR = get("r3_lupin_clay").range;
  if (!phR || !clayR) throw new Error("Ledger: lupin soil rows have no range");
  const [phLo, phHi] = phR, [clayLo, clayHi] = clayR;
  const phOver = [c.pa, c.pb].filter((x) => x > phHi).length;
  const clayOver = [c.a, c.b].filter((x) => x >= clayLo).length;
  const conds: ReactNode[] = [
    c.agree
      ? <><strong>If a soil test lands near the maps&apos; {Math.min(c.a, c.b)} to {Math.max(c.a, c.b)}% clay: </strong>the two maps agree under our {TH}% rule, reused here for soil<Tag status="ours" />, so the topsoil map is not what keeps the answer open.</>
      : <><strong>If your field is near {c.a}% clay (SoilGrids), the topsoil is sandy; near {c.b}% (iSDA), it holds about {c.ratio} times as much clay. </strong>The maps disagree under our {TH}% rule, reused here for soil<Tag status="ours" />, so only a soil test can say which.</>,
    <>Either way, tillage depth depends on the soil: {text("r1_tillage")}<RowTag id="r1_tillage" />. Which clay level counts as compaction-prone, and which rotation that favours:<Tag status="assumed" />.</>,
    <>pH (water): SoilGrids {c.pa}, iSDA {c.pb}, difference {c.phD}. Lupin is reported to need pH {phLo} to {phHi}<RowTag id="r3_lupin_ph" />: {phOver} of 2 maps put this topsoil above {phHi}. The source does not say whether its pH is in water or KCl, so the maps cannot settle it.</>,
    <>Lupin is reported unsuited above {clayLo} to {clayHi}% clay<RowTag id="r3_lupin_clay" />: {clayOver} of 2 maps put this topsoil at or above {clayLo}%. Both figures are unverified, so this is a question for a soil test, not a finding. No source here ties pH or clay to wheat or canola<Tag status="assumed" />.</>,
  ];
  const lines: ReactNode[] = [
    <>Topsoil clay, medians across the site&apos;s fields (iSDA from {c.n} fields): SoilGrids {c.a}%, iSDA {c.b}%.</>,
    <>Difference = {c.d} points; {c.d} ÷ {c.a} (SoilGrids) = {c.pct}%; our threshold is {TH}%. Using SoilGrids as the base is our choice.</>,
    <>SoilGrids clay by depth: {DEPTHS.map((d, i) => `${d} cm ${num(depthIds[i])}%`).join(", ")}. Both maps are models, not measurements.</>,
  ];
  return <Block title="Soil clay and pH" from={[...c.from, "r1_tillage", "r3_lupin_ph", "r3_lupin_clay", ...depthIds]} conds={conds} lines={lines} />;
}

function TrialBlock() {
  const t = trialCompare();
  const conds: ReactNode[] = t.byTillage.map((b) => {
    const lead = `If you use ${b.tillage.toLowerCase()}${b.tillage === "Mouldboard" ? " ploughing" : ""}: `;
    return b.avg < 0
      ? <><strong>{lead}</strong>wheat after the break crop averaged {Math.abs(b.avg)} kg/ha less than monoculture ({b.lc} of {b.diffs.length} cells lower). The break crop&apos;s own income, disease relief and nitrogen credit would need to make up about that much wheat. None of the three has a sourced value<RowTag id="r3_n_credit" />.</>
      : <><strong>{lead}</strong>wheat after the break crop averaged {b.avg} kg/ha more than monoculture, though {b.lc} of {b.diffs.length} cells were lower. On the average, wheat yield alone does not count against the break crop here; cell by cell it {b.lc * 2 > b.diffs.length ? "mostly does" : "mostly does not"}.</>;
  });
  const lines: ReactNode[] = t.byTillage.map((b) => (
    <>{b.tillage}: {b.rv.map((v, i) => `(${v} ${MINUS} ${b.mv[i]})`).join(" + ")} = {b.diffs.map(sgn).join(" ")} = {sgn(b.tot)}; ÷ {b.diffs.length} = {sgn(b.avg)} kg/ha.</>
  ));
  lines.push(<>Averaging the three unlabelled columns is our choice; their labels (year or site) are not in our copy. {get("trial_mono_mb").source}, one trial, one site band. The same figures apply to both sites.</>);
  return <Block title="Wheat yield given up, or gained, after a break crop (ARC trial, by tillage)" from={t.from} conds={conds} lines={lines} />;
}

export default function Change({ site }: { site: SiteId }) {
  // series() is touched so a missing monthly row fails the build here, not at render.
  series(`${sitePrefix(site)}_rain_monthly`);
  void SEASON;
  return (
    <>
      <p>
        This does not change the plain answer. It shows which way the evidence would lean under different conditions, using only figures in the ledger.
        There is no forecast, no score and no ranking. Each statement shows its inputs and arithmetic.
      </p>
      <RainBlock site={site} />
      <MoistureBlock site={site} />
      <SoilBlock site={site} />
      <TrialBlock />
    </>
  );
}
