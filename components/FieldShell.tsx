"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import type { SiteId } from "@/lib/ledger/types";

/** Field view shell: the plate on one screen, with a collapsible sidebar that
 *  takes its own column so the plate rescales instead of being covered. */
export default function FieldShell({ site, plate, sidebar }: { site: SiteId; plate: ReactNode; sidebar: ReactNode }) {
  const [open, setOpen] = useState(false);
  const sideId = useId();
  const sideRef = useRef<HTMLElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  // Arriving with a #part hash opens the sidebar at that part.
  useEffect(() => {
    const sync = () => { if (window.location.hash.length > 1) setOpen(true); };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); btnRef.current?.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) requestAnimationFrame(() => sideRef.current?.focus());
  }

  return (
    <div className="field" data-side={open ? "open" : "closed"}>
      <main id="main-content" tabIndex={-1} className="field-main">
        <div className="stage-wrap">
          <div className="stage">
            <nav className="toolbar" aria-label="Field view">
              <Link className="btn" href="/">Globe</Link>
              <span className="btn-group">
                <Link className="btn" href="/field/overberg" aria-current={site === "overberg" ? "page" : undefined}>Overberg</Link>
                <Link className="btn" href="/field/swartland" aria-current={site === "swartland" ? "page" : undefined}>Swartland</Link>
              </span>
              <button ref={btnRef} type="button" className="btn btn-solid side-toggle" aria-expanded={open} aria-controls={sideId} onClick={toggle}>
                {open ? "Hide analysis" : "Rotation analysis"}
              </button>
              <a className="btn btn-solid side-jump" href="#answer">Rotation analysis</a>
            </nav>
            {plate}
          </div>
        </div>
      </main>
      <button type="button" className="side-scrim" aria-label="Close the rotation analysis" tabIndex={-1} onClick={() => { setOpen(false); btnRef.current?.focus(); }} />
      <aside ref={sideRef} id={sideId} className="side" aria-label="Rotation analysis and trust panel" tabIndex={-1}>
        <button type="button" className="btn side-close" onClick={() => { setOpen(false); btnRef.current?.focus(); }}>Close</button>
        {sidebar}
      </aside>
    </div>
  );
}
