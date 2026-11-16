import Link from "next/link";
import type { Metadata } from "next";
import { Logo } from "@/components/plate/glyphs";
import { LEDGER, type LedgerRow } from "@/lib/ledger";
import { StatusKey } from "@/components/side/sections";
import { Tag } from "@/components/led";

export const metadata: Metadata = { title: "The fact ledger" };

function valueText(r: LedgerRow): string {
  if (r.value === null) return "No figure";
  if (Array.isArray(r.value)) return r.value.join(", ");
  if (typeof r.value === "number") return r.value.toFixed(r.dp);
  return String(r.value);
}

export default function LedgerPage() {
  return (
    <div className="landing wide">
      <header className="land-head">
        <Link className="brandmark" href="/"><Logo className="logo" /><span>Fallow</span></Link>
        <nav aria-label="Main"><Link href="/">Globe</Link><Link href="/field/overberg">Overberg</Link><Link href="/field/swartland">Swartland</Link></nav>
      </header>
      <main id="main-content" tabIndex={-1}>
        <h1>The fact ledger</h1>
        <p className="lede">Every number in Fallow's text and charts is one of these rows, or is computed from them. The 3D block and the drawing are pictures; their few numbers are repeated as text from these rows. Open a row for its caveat and what would raise its status.</p>
        <StatusKey rows={LEDGER} />
        <div className="scroll" tabIndex={0} role="region" aria-label="Fact ledger table">
          <table className="data ledger-table">
            <caption>All ledger rows. Series are listed January to December, or in trial column order.</caption>
            <thead>
              <tr>
                {["Figure", "Value", "Status", "Source", "More"].map((h) => <th key={h} scope="col">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {LEDGER.map((r) => (
                <tr key={r.id} data-led={r.id}>
                  <th scope="row">{r.label}{r.isNasa ? <span className="nasa-chip">NASA data</span> : null}</th>
                  <td className="num">{valueText(r)}{r.unit ? <span className="unit"> {r.unit}</span> : null}</td>
                  <td><Tag status={r.status} /></td>
                  <td>{r.url ? <a href={r.url} target="_blank" rel="noopener noreferrer">{r.source}<span className="vh"> (opens in a new tab)</span></a> : r.source}{r.page ? `, ${r.page}` : ""}</td>
                  <td>
                    <details className="row-more">
                      <summary>Caveat and detail<span className="vh"> for {r.label}</span></summary>
                      <dl>
                        <dt>Caveat</dt><dd>{r.caveat}</dd>
                        <dt>To raise it</dt><dd>{r.remedy}</dd>
                        <dt>Confidence</dt><dd>{r.confidence}</dd>
                        <dt>Resolution</dt><dd>{r.resolution}</dd>
                        <dt>Period</dt><dd>{r.period}</dd>
                        <dt>Checked</dt><dd>{r.date}</dd>
                      </dl>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
