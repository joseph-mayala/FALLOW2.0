# Fallow

**Rest it, or plant again?**
NASA Space Apps Challenge 2026 · *Field Shift: Adapting Farms with NASA Data*

## How to open it

There are two ways.

### Option 1: just click the link

**https://fallow2.vercel.app**

Nothing to install and no login. It works on a phone.

### Option 2: run it on your own computer

You need [Node.js](https://nodejs.org) 18.17 or newer (version 20 or later is best) and Git.

1. Get the code:

   ```bash
   git clone https://github.com/joseph-mayala/FALLOW2.0.git
   ```

2. Go into the folder:

   ```bash
   cd FALLOW2.0
   ```

3. Install what it needs (about a minute, once):

   ```bash
   npm install
   ```

4. Start it:

   ```bash
   npm run dev
   ```

5. Open **http://localhost:3000** in your browser. Stop it with `Ctrl + C`.

No key, account or login is needed. The pages make no third-party request:
fonts, globe imagery, satellite images and terrain are all in this repository.

To run the production version instead, use `npm run build` and then `npm start`.

**Optional, for option 2 only:** copy `.env.example` to `.env.local` and add a
`GEMINI_API_KEY` to turn on the AI analysis in the rotation sheet. It is
labelled as AI-generated and not validated. Everything else works without it.

If port 3000 is busy, Next.js picks the next free port and prints the address.

## What Fallow is

Fallow helps a wheat grower or adviser in South Africa's Western Cape look at one
question: next winter, wheat on wheat again, or a lupin or canola break crop?
It compares the two rotations, shows where every figure comes from, and says
plainly when the sources are too thin or too far apart to name a winner. Today
they are, so the page names none.

Two sites have full data: **Overberg** (the worked example) and **Swartland**
(the example of sources that disagree).

## What is on the page

- **Globe** (`/`): the Earth from NASA Blue Marble imagery, with the two sites
  marked. Drag to turn it. A place search over a baked list, or a latitude and
  longitude. No online geocoder.
- **Field view** (`/field/overberg`, `/field/swartland`): a dashboard around a
  3D block of the site. A NASA satellite image lies over real terrain, lit by
  the computed noon sun, with six soil layers on the cut faces. Point at a
  layer and its row lights up. Around it: June climate, soil wetness, soil by
  depth, rain from four sources, two soil maps side by side.
- **Rotation analysis** (the sheet on the field view): the plain answer, then
  what the sources show, why the answer is open, what would change it, and what
  to do next.
- **Ledger** (`/ledger`): every figure in the app as one row, with its source,
  status and what would raise it.
- **Other places** (`/place?lat=&lon=`): says what tier a place falls in and
  declines the rotation panel where no data is baked in.

## One ledger

Every number on screen is a row in `lib/ledger/rows.ts`, or is computed in
`lib/ledger/derive.ts` from rows it names. A row is:

- **checked** when a source was opened and read, or the value was re-fetched and matched;
- **unverified** when a source is named but we could not open it or confirm it for the site;
- **assumed** when no source was found (never used in a score);
- **our threshold** when it is a cut-off we chose.

The team's research register (15 Nov 2026) was merged into the ledger. Each
row took the status its source could support when we tried to open it that
day. Sources that would not open stayed unverified, even where the register
had marked them verified.

## Data sources

| What | Source | NASA |
| --- | --- | --- |
| Rain, primary | GPM IMERG, 2015–2024 average | yes |
| Temperature, humidity, evaporation, soil wetness | NASA POWER (MERRA-2) climatology | yes |
| Satellite image on the 3D block | HLS (Harmonized Landsat and Sentinel-2), via NASA GIBS | yes |
| Globe imagery | Blue Marble, via NASA GIBS | yes |
| Rain cross-checks | Open-Meteo, ERA5, Meteomatics | no |
| Soil by depth | ISRIC SoilGrids, with iSDA as a second map | no |
| Terrain | AWS Terrain Tiles | no |
| Field outlines (on the flat drawing) | Fields of the World, South Africa, CC-BY-NC-SA-4.0 | no |
| Rotation facts and the yield trial | ARC-SGI guidelines and trial; Department of Agriculture canola guideline | no |

## Scripts

| Command | What it does |
| --- | --- |
| `npm run build` | Production build |
| `npm run typecheck` | TypeScript check |
| `node scripts/bake-3d.mjs` | Re-fetches the globe image, the two satellite images and the terrain heights, and writes them into `public/art` |
| `npm run check:numbers` | Fails if any number on screen has no ledger row (needs Playwright) |
| `npm run check:network` | Fails if a page makes a third-party request (needs Playwright) |
| `npm run verify:sources` | Re-fetches what can be re-fetched and compares it with the ledger |

## What this cannot tell you

- Model values, not measurements. One grid cell can cover many farms.
- Nothing here has been tested with a grower or against a field trial.
- The satellite image shows one winter day. No figure is derived from it.
- The field outlines are computer predictions, not surveyed boundaries.

## AI use

AI agents (Claude, Anthropic) wrote the code, packaged the data and drafted the
copy, under human direction. The team's research register was drafted with AI
assistance. The optional analysis calls Google Gemini at the reader's request.
The 3D views are drawn by code from the bundled NASA imagery and terrain; no
AI-generated image or video is used.

*Not affiliated with or endorsed by NASA.*
