"use client";

import { useId, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { GAZETTEER } from "@/lib/gazetteer";
import { parseLatLon, resolvePlace } from "@/lib/scope";
import type { GlobeTarget } from "./Globe";
import Globe from "./Globe3D";

function lookup(text: string): GlobeTarget | null {
  const q = text.trim().toLowerCase();
  if (!q) return null;
  const hit = GAZETTEER.find((p) => p.name.toLowerCase() === q) ?? GAZETTEER.find((p) => p.name.toLowerCase().startsWith(q) && q.length >= 3);
  if (hit) return { name: hit.name, lat: hit.lat, lon: hit.lon };
  const ll = parseLatLon(text);
  return ll ? { name: "Your point", ...ll } : null;
}

/** Search over the baked place list, plus latitude and longitude entry. No geocoder, no network. */
export default function Search({ children, after }: { children: ReactNode; after: ReactNode }) {
  const router = useRouter();
  const id = useId();
  const [text, setText] = useState("Overberg");
  const [error, setError] = useState<string | null>(null);
  const target = lookup(text);
  const resolved = target ? resolvePlace(target.lat, target.lon) : null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!target || !resolved) {
      setError("That is not in the place list. Pick a listed place, or type a latitude and longitude such as -29.1, 26.2.");
      return;
    }
    setError(null);
    if (resolved.site) router.push(`/field/${resolved.site.slug}`);
    else router.push(`/place?lat=${target.lat}&lon=${target.lon}&name=${encodeURIComponent(target.name)}`);
  }

  return (
    <div className="hero-grid">
      <div className="hero-copy">
        {children}
        <form className="search" onSubmit={submit} noValidate>
          <label htmlFor={`${id}-q`}>Find a place</label>
          <div className="search-row">
            <input
              id={`${id}-q`} type="text" list={`${id}-places`} value={text} autoComplete="off" spellCheck={false}
              onChange={(e) => { setText(e.target.value); setError(null); }}
              aria-invalid={error ? true : undefined} aria-describedby={`${id}-help ${id}-tier`}
            />
            <button type="submit" className="btn btn-solid">Open</button>
          </div>
          <datalist id={`${id}-places`}>
            {GAZETTEER.map((p) => <option key={p.name} value={p.name}>{p.region}</option>)}
          </datalist>
          <p id={`${id}-help`} className="small">
            A baked list of places, or a latitude and longitude. No online geocoder is used.
          </p>
          <p id={`${id}-tier`} className="tier-line" role="status" aria-live="polite">
            {error ? <span className="err" role="alert">{error}</span>
              : resolved ? <>Scope tier: <b>{resolved.tier.name}</b>. {resolved.site ? "Full profile available." : "No baked data for this place."}</>
              : <>Type a place to see its scope tier.</>}
          </p>
        </form>
        {after}
      </div>
      <Globe target={target} />
    </div>
  );
}
