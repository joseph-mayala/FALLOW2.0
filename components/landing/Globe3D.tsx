"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LOCATIONS } from "@/lib/locations";
import GlobeFlat, { type GlobeTarget } from "./Globe";

const HOME = { lat: -17, lon: 21 }; // centred on southern Africa
const DIST = 4.5;

interface Api { flyTo(lat: number, lon: number, ms?: number): void; turn(deg: number): void; tilt(deg: number): void }

/** The globe, lit and textured: NASA Blue Marble on a sphere, bundled with the app.
 *  No map tiles and no network at run time. Falls back to the drawn globe without WebGL. */
export default function Globe3D({ target }: { target: GlobeTarget | null }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const labels = useRef<(HTMLAnchorElement | null)[]>([]);
  const pin = useRef<HTMLSpanElement>(null);
  const api = useRef<Api | null>(null);
  const targetRef = useRef<GlobeTarget | null>(target);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    (async () => {
      const THREE = await import("three");
      const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js");
      const el = canvas.current, box = wrap.current;
      if (disposed || !el || !box) return;

      let renderer: import("three").WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({ canvas: el, antialias: true, alpha: true });
      } catch {
        setFailed(true);
        return;
      }
      const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.55;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
      scene.add(camera);

      const toVec = (lat: number, lon: number, r = 1) => {
        const phi = ((90 - lat) * Math.PI) / 180, theta = ((lon + 180) * Math.PI) / 180;
        return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
      };

      // Earth
      const tex = new THREE.TextureLoader().load("/art/earth.webp", () => { if (!disposed) setReady(true); }, undefined, () => { if (!disposed) setFailed(true); });
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      const earthGeo = new THREE.SphereGeometry(1, 128, 96);
      const earthMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.82, metalness: 0.02 });
      const earth = new THREE.Mesh(earthGeo, earthMat);
      scene.add(earth);

      // Light rides with the camera, so the side facing the reader is always lit and the limb falls away.
      const sun = new THREE.DirectionalLight(0xfff4e0, 3.6);
      sun.position.set(-2.2, 1.6, 2.4);
      camera.add(sun);
      camera.add(sun.target);
      sun.target.position.set(0, 0, -DIST);
      scene.add(new THREE.AmbientLight(0xa9bcd8, 0.95));

      // Atmosphere: a rim on the surface and a halo behind it.
      const rimMat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        vertexShader: "varying vec3 n; void main(){ n = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
        fragmentShader: "varying vec3 n; void main(){ float f = pow(1.0 - max(dot(n, vec3(0.0, 0.0, 1.0)), 0.0), 3.2); gl_FragColor = vec4(vec3(0.42, 0.68, 1.0) * f * 0.95, f); }",
      });
      const rim = new THREE.Mesh(new THREE.SphereGeometry(1.004, 96, 64), rimMat);
      scene.add(rim);
      const haloMat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending,
        vertexShader: "varying vec3 n; void main(){ n = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
        fragmentShader: "varying vec3 n; void main(){ float f = pow(max(0.66 - dot(n, vec3(0.0, 0.0, 1.0)), 0.0), 5.0); gl_FragColor = vec4(vec3(0.36, 0.62, 1.0) * f * 2.2, f); }",
      });
      const halo = new THREE.Mesh(new THREE.SphereGeometry(1.16, 96, 64), haloMat);
      scene.add(halo);

      // Stars, sparse
      const starPos = new Float32Array(900 * 3);
      let seed = 7;
      const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      for (let i = 0; i < 900; i++) {
        const u = rnd() * 2 - 1, t = rnd() * Math.PI * 2, s = Math.sqrt(1 - u * u), r = 60;
        starPos.set([r * s * Math.cos(t), r * u, r * s * Math.sin(t)], i * 3);
      }
      const starGeo = new THREE.BufferGeometry();
      starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
      const starMat = new THREE.PointsMaterial({ color: 0xdfe8ff, size: 0.16, sizeAttenuation: true, transparent: true, opacity: 0.55 });
      scene.add(new THREE.Points(starGeo, starMat));

      // Site markers: a bright point and a slow ring
      const dotGeo = new THREE.SphereGeometry(0.0085, 16, 12);
      const dotMat = new THREE.MeshBasicMaterial({ color: 0xffd27a });
      const ringGeo = new THREE.RingGeometry(0.016, 0.02, 48);
      const rings: import("three").Mesh[] = [];
      const disposables: { dispose(): void }[] = [earthGeo, earthMat, tex, rimMat, rim.geometry, haloMat, halo.geometry, starGeo, starMat, dotGeo, dotMat, ringGeo];
      const sitePos = LOCATIONS.map((l) => toVec(l.lat, l.lon, 1.004));
      sitePos.forEach((p) => {
        const d = new THREE.Mesh(dotGeo, dotMat);
        d.position.copy(p);
        scene.add(d);
        const m = new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false });
        const r = new THREE.Mesh(ringGeo, m);
        r.position.copy(p);
        r.lookAt(p.clone().multiplyScalar(2));
        scene.add(r);
        rings.push(r);
        disposables.push(m);
      });
      const pinMat = new THREE.MeshBasicMaterial({ color: 0xff8a6b });
      const pinMesh = new THREE.Mesh(dotGeo, pinMat);
      pinMesh.visible = false;
      scene.add(pinMesh);
      disposables.push(pinMat);

      // Controls: drag to turn. No wheel zoom, so the page still scrolls.
      const controls = new OrbitControls(camera, el);
      controls.enablePan = false;
      controls.enableZoom = false;
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.rotateSpeed = 0.45;
      controls.minPolarAngle = 0.35;
      controls.maxPolarAngle = Math.PI - 0.35;

      let fly: { from: import("three").Vector3; to: import("three").Vector3; t0: number; ms: number } | null = null;
      const flyTo = (lat: number, lon: number, ms = 1100) => {
        const to = toVec(Math.max(-70, Math.min(70, lat * 0.7)), lon, DIST);
        if (calm || ms <= 0) { camera.position.copy(to); camera.lookAt(0, 0, 0); controls.update(); return; }
        fly = { from: camera.position.clone(), to, t0: performance.now(), ms };
      };
      const turn = (deg: number) => {
        const p = camera.position.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), (deg * Math.PI) / 180);
        fly = { from: camera.position.clone(), to: p, t0: performance.now(), ms: calm ? 1 : 500 };
      };
      const tilt = (deg: number) => {
        const sph = new THREE.Spherical().setFromVector3(camera.position);
        sph.phi = Math.max(0.35, Math.min(Math.PI - 0.35, sph.phi + (deg * Math.PI) / 180));
        fly = { from: camera.position.clone(), to: new THREE.Vector3().setFromSpherical(sph), t0: performance.now(), ms: calm ? 1 : 400 };
      };
      api.current = { flyTo, turn, tilt };
      controls.addEventListener("start", () => { fly = null; });

      // Arrive: a short authored move from the west into the sites.
      camera.position.copy(toVec(HOME.lat * 0.7 + 18, HOME.lon - 70, DIST + 1.1));
      camera.lookAt(0, 0, 0);
      const first = targetRef.current ?? { ...HOME, name: "" };
      flyTo(first.lat, first.lon, 1900);

      const size = () => {
        const w = Math.max(240, Math.round(box.clientWidth));
        renderer.setSize(w, w, false);
      };
      size();
      const ro = new ResizeObserver(size);
      ro.observe(box);

      let visible = true;
      const io = new IntersectionObserver((e) => { visible = e[0]?.isIntersecting ?? true; });
      io.observe(box);

      const v = new THREE.Vector3(), camDir = new THREE.Vector3();
      const place = (node: HTMLElement | null, p: import("three").Vector3) => {
        if (!node) return;
        camDir.copy(camera.position).normalize();
        const facing = v.copy(p).normalize().dot(camDir);
        v.copy(p).project(camera);
        node.style.left = `${(v.x * 0.5 + 0.5) * 100}%`;
        node.style.top = `${(-v.y * 0.5 + 0.5) * 100}%`;
        node.style.opacity = facing > 0.25 ? "1" : "0";
        node.style.pointerEvents = facing > 0.25 ? "auto" : "none";
      };

      let raf = 0;
      const frame = (now: number) => {
        raf = requestAnimationFrame(frame);
        if (!visible || document.hidden) return;
        if (fly) {
          const k = Math.min(1, (now - fly.t0) / fly.ms), e = 1 - Math.pow(1 - k, 4);
          const a = fly.from.clone().normalize(), b = fly.to.clone().normalize();
          const q = new THREE.Quaternion().setFromUnitVectors(a, b);
          const step = new THREE.Quaternion().slerp(q, e);
          const len = fly.from.length() + (fly.to.length() - fly.from.length()) * e;
          camera.position.copy(a.applyQuaternion(step).multiplyScalar(len));
          camera.lookAt(0, 0, 0);
          if (k >= 1) fly = null;
        }
        controls.update();
        const pulse = calm ? 1.4 : 1 + ((now / 1600) % 1) * 2.4;
        rings.forEach((r) => {
          r.scale.setScalar(pulse);
          (r.material as import("three").MeshBasicMaterial).opacity = calm ? 0.7 : 0.85 * (1 - ((now / 1600) % 1));
        });
        const t = targetRef.current;
        const isSite = t ? LOCATIONS.some((l) => Math.abs(l.lat - t.lat) < 0.3 && Math.abs(l.lon - t.lon) < 0.3) : true;
        pinMesh.visible = !!t && !isSite;
        if (t && !isSite) {
          pinMesh.position.copy(toVec(t.lat, t.lon, 1.004));
          place(pin.current, pinMesh.position);
        } else if (pin.current) pin.current.style.opacity = "0";
        sitePos.forEach((p, i) => place(labels.current[i], p));
        renderer.render(scene, camera);
      };
      raf = requestAnimationFrame(frame);

      cleanup = () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        io.disconnect();
        controls.dispose();
        disposables.forEach((d) => d.dispose());
        renderer.dispose();
        api.current = null;
      };
    })().catch(() => setFailed(true));
    return () => { disposed = true; cleanup(); };
  }, []);

  useEffect(() => {
    targetRef.current = target;
    if (target) api.current?.flyTo(target.lat, target.lon);
  }, [target]);

  if (failed) return <GlobeFlat target={target} />;

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowLeft") api.current?.turn(-12);
    else if (e.key === "ArrowRight") api.current?.turn(12);
    else if (e.key === "ArrowUp") api.current?.tilt(-8);
    else if (e.key === "ArrowDown") api.current?.tilt(8);
    else return;
    e.preventDefault();
  }

  return (
    <div className="globe globe3d" data-ready={ready}>
      <div className="g3-stage" ref={wrap}>
        <canvas
          ref={canvas}
          role="img"
          tabIndex={0}
          onKeyDown={onKey}
          aria-label="Globe of the Earth from NASA Blue Marble imagery. The two sites with full data are marked in southern Africa. Drag, or use the arrow keys or the buttons below, to turn it."
        />
        {LOCATIONS.map((l, i) => (
          <Link key={l.slug} href={`/field/${l.slug}`} ref={(n) => { labels.current[i] = n; }} className={`g-label g3-label ${i === 0 ? "se" : "nw"}`}>
            <b>{l.name}</b>
            <span>{l.role}</span>
          </Link>
        ))}
        <span ref={pin} className="g3-pin" aria-hidden={!target}>{target?.name}</span>
      </div>
      <div className="g-controls" role="group" aria-label="Turn the globe">
        <button type="button" className="btn" onClick={() => api.current?.turn(-24)} aria-label="Turn the globe west">West</button>
        <button type="button" className="btn" onClick={() => api.current?.turn(24)} aria-label="Turn the globe east">East</button>
        <button type="button" className="btn" onClick={() => api.current?.flyTo(HOME.lat / 0.7, HOME.lon)}>Back to the sites</button>
      </div>
      <p className="g3-credit">Imagery: NASA Blue Marble, bundled with the page. Drag to turn.</p>
    </div>
  );
}
