import Image from "next/image";
import { DEPTHS, SITE_NAME, get, num, sitePrefix, sunNoon, type SiteId } from "@/lib/ledger";
import { clayColour } from "@/lib/clay";
import { Calc, Led, N, Struct, fmt } from "@/components/led";
import Block3D from "./Block3D";
import b3d from "@/lib/ledger/block3d.json";

/** The centre of the plate: the baked block drawing. */
export function BlockArt({ site }: { site: SiteId }) {
  const p = sitePrefix(site), sun = sunNoon(site);
  const alt =
    `Drawing of one block of ${SITE_NAME[site]} farmland cut out of the ground. Green terrain on top with ` +
    `${num(`${p}_outlines_shown`)} predicted field outlines and contour lines. Six soil layers on the cut faces, darker with more clay. ` +
    `An arc shows the sun's path from east to west, ${sun.altitude.toFixed(1)} degrees above the northern horizon at noon. ` +
    `Every value in the drawing is repeated as text on this page.`;
  return (
    <Image
      className="block-art"
      src={`/art/block-${site}.webp`}
      alt={alt}
      width={1205}
      height={1040}
      unoptimized
      loading="eager"
      data-calc={[...sun.from, `${p}_outlines_shown`].join(" ")}
    />
  );
}

/** Flat view: the six horizons as a plain column, drawn by code from the ledger. Default on small screens. */
export function FlatSoil({ site }: { site: SiteId }) {
  const p = sitePrefix(site);
  return (
    <div className="flat">
      <ol className="flat-col" aria-label="Soil by depth, flat view. Depths not to scale.">
        {DEPTHS.map((d) => {
          const k = d.replace("-", "_");
          const clay = num(`${p}_clay_${k}`);
          return (
            <li key={d}>
              <i aria-hidden="true" style={{ background: clayColour(clay) }} />
              <Struct why="soil horizon depth label, a SoilGrids standard layer"><b className="mono">{d.replace("-", "–")} cm</b></Struct>
              <span>clay <N id={`${p}_clay_${k}`} /> % · sand <N id={`${p}_sand_${k}`} /> %</span>
            </li>
          );
        })}
      </ol>
      <p className="flat-note">
        Flat view. Each band is one soil layer, darker with more clay. Depths are not to scale. Sun at noon:{" "}
        <Calc from={sunNoon(site).from}>{sunNoon(site).altitude.toFixed(1)}°</Calc> above the northern horizon.
      </p>
    </div>
  );
}

/** The block in three dimensions. Every input comes from the ledger or the baked files. */
export function Block3DView({ site }: { site: SiteId }) {
  const p = sitePrefix(site), sun = sunNoon(site);
  const half = num("b3d_half"), lat = num(`${p}_lat`), km = num("geo_km_per_deg");
  const depthKm = 2 * half * km, widthKm = depthKm * Math.cos((lat * Math.PI) / 180);
  const layers = DEPTHS.map((d) => ({ depth: d, colour: clayColour(num(`${p}_clay_${d.replace("-", "_")}`)) }));
  const label =
    `Three-dimensional model of one block of ${SITE_NAME[site]} farmland cut out of the ground. A satellite image lies over the terrain. ` +
    `Six soil layers show on the cut faces, darker with more clay. An arc shows the sun's path, ${sun.altitude.toFixed(1)} degrees above the northern horizon at noon. ` +
    `Drag to turn it. Every value is repeated as text on this page.`;
  return (
    <figure className="b3d-fig" data-calc={[...sun.from, "b3d_half", "exaggeration"].join(" ")}>
      <Block3D
        site={site} grid={b3d.grid} widthKm={widthKm} depthKm={depthKm} exaggeration={num("exaggeration")}
        sunAltitude={sun.altitude} layers={layers} label={label} fallback={<BlockArt site={site} />}
      />
      <figcaption className="b3d-cap">
        <Led ids={`${p}_b3d_image`}>NASA HLS satellite image of {String(get(`${p}_b3d_image`).value)}</Led> over{" "}
        <Led ids={[`${p}_b3d_min`, `${p}_b3d_max`]}>AWS terrain, {fmt(`${p}_b3d_min`)}–{fmt(`${p}_b3d_max`)} m</Led>,{" "}
        <Led ids="exaggeration">height ×{fmt("exaggeration")}</Led>. Soil layers from ISRIC SoilGrids, not to scale. A model, not a survey.
      </figcaption>
    </figure>
  );
}
