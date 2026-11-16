import Link from "next/link";
import Search from "@/components/landing/Search";
import { Logo } from "@/components/plate/glyphs";
import { TIERS } from "@/lib/scope";
import { verdict } from "@/lib/ledger";
import { Calc, Led, Struct } from "@/components/led";

const PARTS = [
  ["Descriptive", "What the sources show", "Rain from four sources, soil by depth, the one sourced trial."],
  ["Diagnostic", "Why the answer is open", "Where sources disagree, and which cells of the comparison have no source."],
  ["Predictive", "What would change the answer", "Conditional ranges computed from the ledger. No forecast, no score."],
  ["Prescriptive", "What to do next", "Which document or measurement would settle each gap. Never a crop choice."],
] as const;

export default function Home() {
  const v = verdict();
  return (
    <div className="landing">
      <header className="land-head">
        <p className="brandmark"><Logo className="logo" /><span>Fallow</span></p>
        <nav aria-label="Main">
          <Link href="/field/overberg">Overberg</Link>
          <Link href="/field/swartland">Swartland</Link>
          <Link href="/ledger">Ledger</Link>
        </nav>
      </header>

      <main id="main-content" tabIndex={-1}>
        <Search
          after={
            <p className="caption">
              The method is global. The worked example is Overberg; Swartland shows what happens when the sources disagree.
            </p>
          }
        >
          <h1>Rest it, or plant again?</h1>
          <p className="lede">
            Wheat on wheat, or a lupin or canola break crop. Fallow shows what open data can say about one block of farmland, and where it stops.
          </p>
        </Search>

        <section className="land-sec" aria-labelledby="h-scope">
          <h2 id="h-scope">How much Fallow can say depends on where you are</h2>
          <ol className="ladder">
            {TIERS.map((t) => (
              <li key={t.id}>
                <p className="ladder-step">{t.step}</p>
                <div>
                  <h3>{t.name}</h3>
                  <p className="soft">{t.covers}</p>
                </div>
                <p>{t.gives}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="land-sec" aria-labelledby="h-parts">
          <h2 id="h-parts">The rotation analysis has four parts</h2>
          <dl className="parts">
            {PARTS.map(([k, t, d]) => (
              <div key={k}>
                <dt><span className="part-kicker">{k}</span>{t}</dt>
                <dd>{d}</dd>
              </div>
            ))}
          </dl>
          <p className="honest">
            Today <Calc from={v.from}><b>{v.sourced} of {v.total}</b></Calc> cells of the rotation comparison have a sourced value, so Fallow names no
            winner. Every number in its text and charts is a row in <Link href="/ledger">one ledger</Link>, or computed from those rows, with its source, its status and what would raise it.
          </p>
          <p><Link className="btn btn-solid" href="/field/overberg">Open the Overberg profile</Link></p>
        </section>
      </main>

      <footer className="land-foot">
        <p>
          Data: NASA GPM IMERG, NASA POWER (<Led ids="ob_t2m">MERRA-2</Led>), AWS Terrain Tiles, ISRIC SoilGrids, iSDA. Field outlines: Fields of the World,
          computer-predicted (<Led ids="licence_ftw">CC-BY-NC-SA-4.0</Led>). Globe coastline: Natural Earth, public domain.
        </p>
        <p>
          Model values, not measurements. Not reviewed by a grower. AI-assisted build. Built for the NASA Space Apps Challenge{" "}
          <Struct why="event year">2026</Struct>, Field Shift. Not affiliated with or endorsed by NASA.
        </p>
      </footer>
    </div>
  );
}
