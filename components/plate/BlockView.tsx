"use client";

import { useState, type ReactNode } from "react";

type Mode = "3d" | "art" | "flat";
const MODES: [Mode, string][] = [["3d", "3D block"], ["art", "Drawing"], ["flat", "Flat"]];

/** Centre of the page. The 3D block by default; the baked drawing (with the
 *  predicted field outlines) and the flat soil column can be chosen instead. */
export default function BlockView({ three, art, flat }: { three: ReactNode; art: ReactNode; flat: ReactNode }) {
  const [mode, setMode] = useState<Mode>("3d");
  return (
    <div className="view" data-mode={mode}>
      <div className="view-toggle btn-group" role="group" aria-label="Choose the view">
        {MODES.map(([m, name]) => (
          <button key={m} type="button" className="btn" aria-pressed={mode === m} onClick={() => setMode(m)}>{name}</button>
        ))}
      </div>
      {mode === "3d" && <div className="view-3d">{three}</div>}
      <div className="view-art" hidden={mode !== "art"}>{art}</div>
      <div className="view-flat" hidden={mode !== "flat"}>{flat}</div>
    </div>
  );
}
