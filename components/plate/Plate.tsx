import type { CSSProperties, ReactNode } from "react";
import {
  DEPTHS, MONTHS_LONG, MONTHS_SHORT, PLATE_MONTH, SITE_NAME, get, num, series, sitePrefix,
  rainSummary, soilCompare, sunNoon, verdict, type SiteId,
} from "@/lib/ledger";
import { Calc, Led, N, Struct, fmt } from "@/components/led";
import { Glyph, Logo, type GlyphKind } from "./glyphs";
import { clayColour } from "@/lib/clay";

/** Position of a block on the 1920x1080 plate. On small screens blocks stack instead. */
function at(l: number, t: number, w: number): CSSProperties {
  return { "--l": l, "--t": t, "--w": w } as CSSProperties;
}

const MONTH = MONTHS_LONG[PLATE_MONTH];

function Src({ glyph, children }: { glyph: GlyphKind; children: ReactNode }) {
  return (
    <p className="src">
      <Glyph kind={glyph} />
      <span>{children}</span>
    </p>
  );
}

function MonthStrip({ id, label }: { id: string; label: string }) {
  const v = series(id);
  const max = Math.max(...v);
  const row = get(id);
  const text = `${label} by month: ` + v.map((x, i) => `${MONTHS_SHORT[i]} ${x.toFixed(row.dp)}`).join(", ") + ` ${row.unit}.`;
  return (
    <svg className="strip" viewBox="0 0 120 34" role="img" aria-label={text} data-led={id}>
      {v.map((x, i) => {
        const h = Math.max(1.5, (x / max) * 26);
        return <rect key={i} x={1 + i * 10} y={26 - h} width={7.6} height={h} fill={i === PLATE_MONTH ? "var(--bar)" : "var(--bar-weak)"} />;
      })}
      <path d="M0 26.4h120" stroke="var(--rule-strong)" strokeWidth="0.8" />
      <path d={`M${1 + PLATE_MONTH * 10 + 3.8 - 3.2} 33.5l3.2-4.6 3.2 4.6z`} transform="translate(0 -1.5)" fill="var(--ink)" />
    </svg>
  );
}

function Stat({ label, id, unit, glyph, children }: { label: string; id: string; unit: string; glyph: GlyphKind; children: ReactNode }) {
  return (
    <div className="stat">
      <div className="stat-top">
        <h3 className="stat-label">{label}</h3>
        <p className="stat-num">
          <N id={id} i={PLATE_MONTH} />
          <span className="stat-unit">{unit}</span>
        </p>
        <MonthStrip id={id} label={label} />
      </div>
      <Src glyph={glyph}>{children}</Src>
    </div>
  );
}

function ClayBar({ id }: { id: string }) {
  const clay = num(id);
  const w = (clay / num("clay_scale_max")) * 100;
  return (
    <span className="claybar" aria-hidden="true">
      <span style={{ width: `${w}%`, background: clayColour(clay) }} />
    </span>
  );
}

function WetBar({ id, label }: { id: string; label: string }) {
  const v = series(id)[PLATE_MONTH];
  return (
    <div className="wet">
      <p className="wet-val"><N id={id} i={PLATE_MONTH} /><span>%</span></p>
      <div className="wet-bar" aria-hidden="true">
        <span style={{ height: `${v}%` }} />
        <i style={{ bottom: "25%" }} /><i className="mid" style={{ bottom: "50%" }} /><i style={{ bottom: "75%" }} />
      </div>
      <p className="wet-name">{label}</p>
    </div>
  );
}

function RainBars({ site }: { site: SiteId }) {
  const rs = rainSummary(site);
  const K = 0.1372; // plate units per mm, as drawn on the baked plate
  const base = 100;
  const topHi = base - rs.hi * K, topLo = base - rs.lo * K;
  const text = `Annual rain by source: ${rs.sources.map((s) => `${s.name} ${s.value} mm`).join(", ")}.`;
  return (
    <div className="rain">
      <svg className="rain-svg" viewBox="0 0 442 122" role="img" aria-label={text} data-led={rs.sources.map((s) => s.id).join(" ")}>
        <path d={`M66.5 ${topHi}H379M66.5 ${topLo}H379`} stroke="var(--ink)" strokeWidth="0.9" strokeDasharray="1.2 2.6" fill="none" />
        <path d={`M374 ${topHi}h5.5V${topLo}h-5.5`} stroke="var(--ink)" strokeWidth="1" fill="none" />
        {rs.sources.map((s, i) => {
          const h = s.value * K, x = 19.5 + i * 88.3;
          return (
            <g key={s.key}>
              <rect x={x} y={base - h} width={47} height={h} fill={i === 0 ? "var(--bar)" : "var(--bar-mid)"} stroke="var(--ink)" strokeWidth="0.8" />
              <text x={x + 23.5} y={base - h + 17.5} textAnchor="middle" className="rain-val" fill={i === 0 ? "var(--on-bar)" : "var(--ink)"}>{s.value}</text>
              <text x={x + 23.5} y={119} textAnchor="middle" className="rain-name">{s.short}{s.ecmwf ? "*" : ""}</text>
            </g>
          );
        })}
        <path d="M0 100.4h368" stroke="var(--ink)" strokeWidth="1" />
      </svg>
      <p className="rain-spread">
        <span>spread</span>
        <Calc from={rs.from}><b className="big">{rs.spread} mm</b></Calc>
        <Calc from={rs.from}><b>{rs.pct.toFixed(1)} %</b></Calc>
        <span>of IMERG</span>
        <span>(computed)</span>
      </p>
      <p className="rain-foot">* derived from the same ECMWF reanalysis, not independent</p>
    </div>
  );
}

function Topsoil({ site }: { site: SiteId }) {
  const p = sitePrefix(site), sc = soilCompare(site);
  const line = (src: "soilgrids" | "isda", name: string) => (
    <tr>
      <th scope="row">{name}</th>
      <td className="bar"><ClayBar id={`${p}_top_${src}_clay`} /><N id={`${p}_top_${src}_clay`} /></td>
      <td><N id={`${p}_top_${src}_sand`} /></td>
      <td><N id={`${p}_top_${src}_ph`} /></td>
    </tr>
  );
  return (
    <>
      <table className="topsoil">
        <caption className="vh">Topsoil in two soil maps, medians across the site&apos;s fields</caption>
        <thead>
          <tr><td style={{ width: "calc(88 * var(--u))" }} /><th scope="col" style={{ width: "calc(128 * var(--u))" }}>clay %</th><th scope="col">sand %</th><th scope="col">pH</th></tr>
        </thead>
        <tbody>
          {line("soilgrids", "SoilGrids")}
          {line("isda", "iSDA")}
          <tr className="diff">
            <th scope="row">difference</th>
            <td className="bar"><span className="computed">(computed)</span><Calc from={sc.from}>{sc.d.toFixed(1)}</Calc></td>
            <td><Calc from={sc.from}>{sc.sandD.toFixed(1)}</Calc></td>
            <td><Calc from={sc.from}>{sc.phD.toFixed(1)}</Calc></td>
          </tr>
        </tbody>
      </table>
      {sc.flagged.length > 0 && (
        <p className="topsoil-flag">
          <Glyph kind="low" />
          <b>two models disagree: {sc.flagged.join(", ")}</b>
          <Led ids="rule_soil_points" className="soft">({fmt("rule_soil_points")}+ points apart)</Led>
        </p>
      )}
      <p className="topsoil-note">two models, neither measured</p>
    </>
  );
}

export default function Plate({ site, view }: { site: SiteId; view: ReactNode }) {
  const p = sitePrefix(site), name = SITE_NAME[site];
  const sun = sunNoon(site);
  const plateNo = site === "overberg" ? 1 : 2;
  const lat = Math.abs(sun.lat);
  const v = verdict();

  return (
    <article className="plate" aria-labelledby="plate-title">
      <header className="blk plate-head" style={at(63, 38, 760)}>
        <p className="brandline">
          <Logo className="logo" />
          <span className="brand">Fallow</span>
          <span className="kicker">Field profile · Plate <Struct why="plate number, one per site">{plateNo} of 2</Struct></span>
        </p>
        <h1 id="plate-title">{name}, Western Cape, {MONTH}</h1>
        <p className="standfirst">
          One block of farmland, drawn from open data: the terrain on top, the soil by depth on the cut faces, a long-term average {MONTH} in the air above.
        </p>
      </header>

      <div className="blk plate-view" style={at(472, 66, 904)}>{view}</div>

      <section className="blk answer-card" aria-labelledby="h-answer">
        <p className="label">Plain answer</p>
        <h2 id="h-answer">{v.canName ? "The sourced cells allow a comparison" : "No winner can be named from today\u2019s sources"}</h2>
        <p>
          <Calc from={v.from}><b>{v.sourced} of {v.total}</b></Calc> cells of the wheat-or-break-crop comparison have a sourced value for {name}.
          Fallow shows what is known, and what would settle it.
        </p>
        <a className="btn" href="#answer">See the rotation analysis</a>
      </section>

      <section className="blk" style={at(63, 227, 405)} aria-labelledby="h-air">
        <h2 className="label" id="h-air">The air above · {MONTH}</h2>
        <Stat label="Rain" id={`${p}_rain_monthly`} unit="mm" glyph="arrow">
          NASA GPM IMERG · <Led ids={`${p}_rain_monthly`}>2015–2024</Led> · see rain sources
        </Stat>
        <Stat label="Air temperature" id={`${p}_t2m`} unit="°C" glyph="single">
          NASA POWER (<Led ids={`${p}_t2m`}>MERRA-2</Led>) · single model source
        </Stat>
        <Stat label="Humidity" id={`${p}_rh`} unit="%" glyph="single">
          NASA POWER (<Led ids={`${p}_rh`}>MERRA-2</Led>) · single model source
        </Stat>
        <Stat label="Land evaporation" id={`${p}_evap`} unit="mm" glyph="single">
          NASA POWER (<Led ids={`${p}_evap`}>MERRA-2</Led>) · single model source
        </Stat>
      </section>

      <section className="blk" style={at(63, 576, 405)} aria-labelledby="h-soilwet">
        <h2 className="label" id="h-soilwet">In the soil · {MONTH}</h2>
        <h3 className="wet-head">Soil wetness <span>percent of full wetness</span></h3>
        <div className="wet-row">
          <p className="wet-axis" aria-hidden="true"><Led ids="wet_scale_max">{fmt("wet_scale_max")}</Led><Struct why="axis origin">0</Struct></p>
          <WetBar id={`${p}_wet_surface`} label="surface" />
          <WetBar id={`${p}_wet_root`} label="root zone" />
          <WetBar id={`${p}_wet_profile`} label="profile" />
          <p className="wet-note">modelled,{" "}<br />not measured{" "}<br />soil moisture</p>
        </div>
        <Src glyph="single">NASA POWER (<Led ids={`${p}_wet_surface`}>MERRA-2</Led>) · single model source</Src>
      </section>

      <section className="blk" style={at(1378.5, 72, 480)} aria-labelledby="h-sun">
        <h2 className="h" id="h-sun">Computed sun position at solar noon, <Struct why="date of the June solstice, the plate's fixed day">21</Struct> June</h2>
        <p className="sun-big">
          <Calc from={sun.from}><b>{sun.altitude.toFixed(1)}°</b></Calc> above the northern horizon
        </p>
        <p className="soft">
          Astronomy for latitude <Led ids={`${p}_lat`}>{lat}° S</Led>, declination <Led ids="declination">+{fmt("declination")}°</Led>.{" "}<br />
          Computed, not a measurement.
        </p>
      </section>

      <section className="blk" style={at(1378.5, 222, 480)} aria-labelledby="h-ndvi">
        <h2 className="h" id="h-ndvi">Vegetation greenness (NDVI)</h2>
        <p className="chip"><Glyph kind="nodata" /> No data in this version</p>
      </section>

      <section className="blk" style={at(1378.5, 302, 480)} aria-labelledby="h-terrain">
        <h2 className="h" id="h-terrain">Terrain and field outlines</h2>
        <p className="tline">
          <b className="mono"><N id={`${p}_elev_min`} />–<N id={`${p}_elev_max`} /> m</b>{" "}
          <span className="soft">above sea level, contours every <N id="contour_m" /> m</span>
        </p>
        <p className="tline">
          <b className="mono"><N id={`${p}_outlines_shown`} /> of <N id={`${p}_outlines_total`} /></b>{" "}
          <span className="soft">field outlines shown: <N id="rule_min_ha" /> ha and larger</span>
        </p>
        <p className="src plain">AWS Terrain Tiles · not a survey</p>
        <p className="src plain">Fields of the World · computer-predicted</p>
      </section>

      <section className="blk" style={at(1378.5, 431, 480)} aria-labelledby="h-depth">
        <h2 className="label" id="h-depth">The soil by depth · six horizons</h2>
        <div className="depth-src"><Src glyph="low">ISRIC SoilGrids · low: first look · every layer</Src></div>
        <ul className="depths">
          {DEPTHS.map((d) => {
            const k = d.replace("-", "_");
            return (
              <li key={d}>
                <p className="depth-top">
                  <Struct why="soil horizon depth label, a SoilGrids standard layer"><b className="mono depth-name">{d.replace("-", "–")} cm</b></Struct>
                  <ClayBar id={`${p}_clay_${k}`} />
                  <span className="pair">clay <b className="mono"><N id={`${p}_clay_${k}`} /> %</b></span>
                  <span className="pair">sand <b className="mono"><N id={`${p}_sand_${k}`} /> %</b></span>
                  <span className="pair">pH <b className="mono"><N id={`${p}_ph_${k}`} /></b></span>
                </p>
                <Src glyph="low">ISRIC SoilGrids · low: first look</Src>
              </li>
            );
          })}
        </ul>
        <p className="depth-scale">clay bar scale <Struct why="axis origin">0</Struct> to <N id="clay_scale_max" /> %</p>
      </section>

      <section className="blk" style={at(63, 850, 442)} aria-labelledby="h-rain">
        <h2 className="label" id="h-rain">Annual rain · four sources · mm</h2>
        <RainBars site={site} />
      </section>

      <section className="blk" style={at(557, 850, 390)} aria-labelledby="h-topsoil">
        <h2 className="label" id="h-topsoil">
          Topsoil · two soil maps
          <span className="label-note">field medians · iSDA n = <N id={`${p}_top_n`} /></span>
        </h2>
        <Topsoil site={site} />
      </section>

      <section className="blk" style={at(981, 850, 353)} aria-labelledby="h-legend">
        <h2 className="label" id="h-legend">Legend</h2>
        <ul className="legend">
          <li><span className="sw sw-clay" aria-hidden="true" /><span>clay <Struct why="axis origin">0</Struct> to <N id="clay_scale_max" /> %: darker = more clay</span></li>
          <li><span className="sw sw-dots a" aria-hidden="true" /><span className="sw sw-dots b" aria-hidden="true" /><span>more dots = more sand</span></li>
          <li><span className="sw sw-out" aria-hidden="true" /><span className="sw sw-contour" aria-hidden="true" /><span>field outline · <N id="contour_m" /> m contour</span></li>
          <li className="two"><span><Glyph kind="low" /> Low: first look</span><span><Glyph kind="single" /> Not rated: single model source</span></li>
          <li className="two"><span><Glyph kind="nodata" /> no data</span><span><Glyph kind="month" /><span className="plain">{MONTH}, in the <Struct why="months in a year">12</Struct>-month strips</span></span></li>
        </ul>
      </section>

      <section className="blk" style={at(1378.5, 850, 480)} aria-labelledby="h-read">
        <h2 className="label" id="h-read">Read this first</h2>
        <ul className="readfirst">
          <li>Model values, not measurements.</li>
          <li>Depths not to scale.</li>
          <li>Terrain height exaggerated x<N id="exaggeration" />.</li>
        </ul>
        <p className="soft read-note">
          Relief light and shadows are computed for the noon sun shown,{" "}<br />on the exaggerated surface. One model value can cover many farms.
        </p>
      </section>

      <footer className="blk credits" style={at(63, 1021, 1795.5)}>
        <p>
          Data: NASA GPM IMERG, NASA POWER (<Led ids={`${p}_t2m`}>MERRA-2</Led>), AWS Terrain Tiles, ISRIC SoilGrids, iSDA. Field outlines: Fields of the World
          (<Led ids="licence_ftw">CC-BY-NC-SA-4.0</Led>), computer-predicted.
        </p>
        <p>
          3D block: <Led ids={`${p}_b3d_image`}>NASA HLS satellite image</Led> over AWS terrain, drawn in the browser from files bundled with the page. Drawing: a baked image, drawn by code from the data files on{" "}
          <Led ids="ob_rain_monthly">14 Nov 2026</Led>. Text and charts are live from the ledger. AI-assisted. Not affiliated with or endorsed by NASA.
        </p>
      </footer>
    </article>
  );
}
