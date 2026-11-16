// Bakes the assets the two 3D views are drawn from, so the running app makes
// no third-party request:
//   public/art/earth.webp          NASA Blue Marble (shaded relief and bathymetry), via NASA GIBS
//   public/art/sat-<site>.webp     NASA HLS Sentinel-2 true-colour image of the block, via NASA GIBS
//   public/art/terrain-<site>.bin  heights for the block, from AWS Terrain Tiles (terrarium)
//   lib/ledger/block3d.json        the figures the ledger quotes about these assets
// Run: node scripts/bake-3d.mjs
import sharp from "sharp";
import { writeFileSync, mkdirSync } from "node:fs";

const HALF = 0.06;        // half-size of the 3D block, degrees (our choice)
const GRID = 161;         // heights per side
const Z = 12, N = 2 ** Z; // terrain tile zoom
const SITES = {
  overberg: { lat: -34.2, lon: 19.801, day: "2025-08-02" },
  swartland: { lat: -33.46, lon: 18.73, day: "2025-07-28" },
};
const WMS = "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&SRS=EPSG:4326&STYLES=&FORMAT=image/jpeg";
const HLS = "HLS_S30_Nadir_BRDF_Adjusted_Reflectance";

async function get(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return Buffer.from(await r.arrayBuffer());
}

const tiles = new Map();
async function tile(x, y) {
  const k = `${x}/${y}`;
  if (!tiles.has(k)) {
    const { data, info } = await sharp(await get(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${Z}/${x}/${y}.png`)).raw().toBuffer({ resolveWithObject: true });
    tiles.set(k, { data, ch: info.channels });
  }
  return tiles.get(k);
}
const lon2x = (lon) => ((lon + 180) / 360) * N;
const lat2y = (lat) => { const r = (lat * Math.PI) / 180; return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * N; };
async function px(gx, gy) {
  const tx = Math.floor(gx / 256), ty = Math.floor(gy / 256);
  const t = await tile(tx, ty);
  const i = ((gy - ty * 256) * 256 + (gx - tx * 256)) * t.ch;
  return t.data[i] * 256 + t.data[i + 1] + t.data[i + 2] / 256 - 32768;
}
async function elev(lat, lon) { // bilinear
  const fx = lon2x(lon) * 256 - 0.5, fy = lat2y(lat) * 256 - 0.5;
  const x0 = Math.floor(fx), y0 = Math.floor(fy), ax = fx - x0, ay = fy - y0;
  const [a, b, c, d] = [await px(x0, y0), await px(x0 + 1, y0), await px(x0, y0 + 1), await px(x0 + 1, y0 + 1)];
  return a * (1 - ax) * (1 - ay) + b * ax * (1 - ay) + c * (1 - ax) * ay + d * ax * ay;
}

mkdirSync("public/art", { recursive: true });
const facts = { half_deg: HALF, grid: GRID, retrieved: new Date().toISOString().slice(0, 10), sites: {} };

for (const [name, s] of Object.entries(SITES)) {
  // heights, north row first, west to east
  const h = new Float32Array(GRID * GRID);
  let mn = Infinity, mx = -Infinity;
  for (let j = 0; j < GRID; j++) for (let i = 0; i < GRID; i++) {
    const e = await elev(s.lat + HALF - (2 * HALF * j) / (GRID - 1), s.lon - HALF + (2 * HALF * i) / (GRID - 1));
    h[j * GRID + i] = e; if (e < mn) mn = e; if (e > mx) mx = e;
  }
  const u16 = new Uint16Array(GRID * GRID);
  for (let k = 0; k < h.length; k++) u16[k] = Math.round((h[k] - mn) * 10); // decimetres above the lowest point
  writeFileSync(`public/art/terrain-${name}.bin`, Buffer.from(u16.buffer));
  const bb = `${s.lon - HALF},${s.lat - HALF},${s.lon + HALF},${s.lat + HALF}`;
  const sat = await get(`${WMS}&LAYERS=${HLS}&BBOX=${bb}&WIDTH=1280&HEIGHT=1280&TIME=${s.day}`);
  await sharp(sat).modulate({ saturation: 1.08 }).webp({ quality: 84 }).toFile(`public/art/sat-${name}.webp`);
  facts.sites[name] = { lat: s.lat, lon: s.lon, elev_min: Math.round(mn * 10) / 10, elev_max: Math.round(mx * 10) / 10, image_day: s.day };
  console.log(name, facts.sites[name]);
}

const earth = await get(`${WMS}&LAYERS=BlueMarble_ShadedRelief_Bathymetry&BBOX=-180,-90,180,90&WIDTH=4096&HEIGHT=2048`);
await sharp(earth).webp({ quality: 82 }).toFile("public/art/earth.webp");
writeFileSync("lib/ledger/block3d.json", JSON.stringify(facts, null, 1) + "\n");
console.log("done");
