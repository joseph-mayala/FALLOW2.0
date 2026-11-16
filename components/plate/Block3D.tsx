"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { SiteId } from "@/lib/ledger/types";

export interface Block3DProps {
  site: SiteId;
  /** Heights per side in the baked terrain file. */
  grid: number;
  /** Size of the block on the ground, km. */
  widthKm: number;
  depthKm: number;
  /** Terrain height multiplier, from the ledger. */
  exaggeration: number;
  /** Noon sun altitude above the northern horizon, degrees, computed from the ledger. */
  sunAltitude: number;
  /** Soil layers, top first: a colour for each, from the clay scale. */
  layers: { depth: string; colour: string }[];
  label: string;
  /** Shown when WebGL or the baked files are unavailable. */
  fallback: ReactNode;
}

// Drawn thickness of each soil layer as a share of the cut face. Depths are not to scale.
const BAND = [0.09, 0.11, 0.13, 0.17, 0.22, 0.28];
const SOIL = 2.5; // drawn depth of the cut face, scene units
const DEPTH = 10; // north to south, scene units

/** The block in three dimensions: a NASA satellite image draped over real terrain,
 *  lit by the computed noon sun, with the six soil layers on the cut faces. */
export default function Block3D({ site, grid, widthKm, depthKm, exaggeration, sunAltitude, layers, label, fallback }: Block3DProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const reset = useRef<() => void>(() => {});
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    (async () => {
      const [THREE, { OrbitControls }, bin] = await Promise.all([
        import("three"),
        import("three/examples/jsm/controls/OrbitControls.js"),
        fetch(`/art/terrain-${site}.bin`).then((r) => { if (!r.ok) throw new Error("terrain"); return r.arrayBuffer(); }),
      ]);
      const el = canvas.current, box = wrap.current;
      if (disposed || !el || !box) return;
      const heights = new Uint16Array(bin); // decimetres above the lowest point, north row first
      if (heights.length !== grid * grid) throw new Error("terrain size");

      const renderer = new THREE.WebGLRenderer({ canvas: el, antialias: true, alpha: true });
      const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.12;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(30, 1.5, 0.1, 200);
      const trash: { dispose(): void }[] = [];
      const keep = <T extends { dispose(): void }>(x: T) => { trash.push(x); return x; };

      const W = (DEPTH * widthKm) / depthKm, D = DEPTH, G = grid;
      const yScale = (0.1 * exaggeration * DEPTH) / (depthKm * 1000); // decimetres to scene units
      const H = (i: number, j: number) => heights[j * G + i] * yScale;
      let top = 0;
      for (let k = 0; k < heights.length; k++) top = Math.max(top, heights[k] * yScale);

      // --- the ground: satellite image over terrain
      const pos = new Float32Array(G * G * 3), uv = new Float32Array(G * G * 2);
      for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
        const k = j * G + i;
        pos.set([(i / (G - 1) - 0.5) * W, H(i, j), (j / (G - 1) - 0.5) * D], k * 3);
        uv.set([i / (G - 1), 1 - j / (G - 1)], k * 2);
      }
      const idx: number[] = [];
      for (let j = 0; j < G - 1; j++) for (let i = 0; i < G - 1; i++) {
        const a = j * G + i, b = a + 1, c = a + G, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
      const ground = keep(new THREE.BufferGeometry());
      ground.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      ground.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
      ground.setIndex(idx);
      ground.computeVertexNormals();
      const sat = keep(new THREE.TextureLoader().load(`/art/sat-${site}.webp`, () => { if (!disposed) setState("ready"); }, undefined, () => { if (!disposed) setState("failed"); }));
      sat.colorSpace = THREE.SRGBColorSpace;
      sat.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      const groundMesh = new THREE.Mesh(ground, keep(new THREE.MeshStandardMaterial({ map: sat, roughness: 0.94, metalness: 0 })));
      groundMesh.castShadow = true;
      groundMesh.receiveShadow = true;
      scene.add(groundMesh);

      // --- the cut faces: six soil layers, following the surface and flattening with depth
      const cum = [0];
      BAND.forEach((b) => cum.push(cum[cum.length - 1] + b));
      const edge: { x: number; z: number; y: number }[][] = [[], [], [], []];
      for (let i = 0; i < G; i++) {
        const t = i / (G - 1) - 0.5;
        edge[0].push({ x: t * W, z: D / 2, y: H(i, G - 1) });          // south face, west to east
        edge[1].push({ x: W / 2, z: -t * D, y: H(G - 1, G - 1 - i) });  // east face, south to north
        edge[2].push({ x: -t * W, z: -D / 2, y: H(G - 1 - i, 0) });     // north face, east to west
        edge[3].push({ x: -W / 2, z: t * D, y: H(0, i) });              // west face, north to south
      }
      const bandMats: import("three").MeshStandardMaterial[] = [];
      const bandMeshes: import("three").Mesh[] = [];
      layers.forEach((layer, k) => {
        const v: number[] = [];
        const at = (p: { x: number; z: number; y: number }, c: number) => [p.x, p.y - c * (p.y + SOIL), p.z];
        for (const e of edge) for (let i = 0; i < e.length - 1; i++) {
          const a = at(e[i], cum[k]), b = at(e[i + 1], cum[k]), c = at(e[i], cum[k + 1]), d = at(e[i + 1], cum[k + 1]);
          v.push(...a, ...c, ...b, ...b, ...c, ...d);
        }
        const g = keep(new THREE.BufferGeometry());
        g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(v), 3));
        g.computeVertexNormals();
        const m = keep(new THREE.MeshStandardMaterial({ color: new THREE.Color(layer.colour), roughness: 1, metalness: 0, emissive: new THREE.Color(0x9bd063), emissiveIntensity: 0 }));
        const mesh = new THREE.Mesh(g, m);
        mesh.userData.band = k;
        scene.add(mesh);
        bandMats.push(m);
        bandMeshes.push(mesh);
        // a hairline where one layer meets the next
        const lineV: number[] = [];
        for (const e of edge) for (let i = 0; i < e.length - 1; i++) lineV.push(...at(e[i], cum[k + 1]), ...at(e[i + 1], cum[k + 1]));
        const lg = keep(new THREE.BufferGeometry());
        lg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(lineV), 3));
        scene.add(new THREE.LineSegments(lg, keep(new THREE.LineBasicMaterial({ color: 0x0b0c0b, transparent: true, opacity: 0.55 }))));
      });
      const floor = new THREE.Mesh(keep(new THREE.PlaneGeometry(W, D)), keep(new THREE.MeshStandardMaterial({ color: 0x14110d, roughness: 1 })));
      floor.rotation.x = Math.PI / 2;
      floor.position.y = -SOIL;
      scene.add(floor);

      // --- the stand: a soft pool of light and a faint measured ring, so the block sits on something
      const pool = document.createElement("canvas");
      pool.width = pool.height = 256;
      const pc = pool.getContext("2d");
      if (pc) {
        const g = pc.createRadialGradient(128, 128, 10, 128, 128, 128);
        g.addColorStop(0, "rgba(155,208,99,0.20)");
        g.addColorStop(0.55, "rgba(155,208,99,0.05)");
        g.addColorStop(1, "rgba(155,208,99,0)");
        pc.fillStyle = g;
        pc.fillRect(0, 0, 256, 256);
      }
      const poolMesh = new THREE.Mesh(keep(new THREE.PlaneGeometry(30, 30)), keep(new THREE.MeshBasicMaterial({ map: keep(new THREE.CanvasTexture(pool)), transparent: true, depthWrite: false })));
      poolMesh.rotation.x = -Math.PI / 2;
      poolMesh.position.y = -SOIL - 0.06;
      scene.add(poolMesh);
      const ring = new THREE.PolarGridHelper(11, 24, 5, 96, 0x9bd063, 0x9bd063);
      ring.position.y = -SOIL - 0.05;
      const ringMat = ring.material as import("three").Material;
      ringMat.transparent = true;
      ringMat.opacity = 0.09;
      ringMat.depthWrite = false;
      scene.add(ring);
      trash.push(ring.geometry, ringMat);

      // --- the air above: a dashed box
      const airH = 3.2;
      const air = new THREE.LineSegments(
        keep(new THREE.EdgesGeometry(keep(new THREE.BoxGeometry(W, airH, D)))),
        keep(new THREE.LineDashedMaterial({ color: 0xe9ecdf, dashSize: 0.16, gapSize: 0.14, transparent: true, opacity: 0.28 })),
      );
      air.position.y = top + airH / 2 + 0.05;
      air.computeLineDistances();
      scene.add(air);

      // --- the sun: its noon position computed from the latitude, and the arc it follows from east to west
      const a = (sunAltitude * Math.PI) / 180, R = 9.5;
      const sunAt = (t: number) => new THREE.Vector3(R * Math.cos(t), R * Math.sin(t) * Math.sin(a), -R * Math.sin(t) * Math.cos(a));
      const arcPts: import("three").Vector3[] = [];
      for (let i = 0; i <= 80; i++) arcPts.push(sunAt((i / 80) * Math.PI));
      scene.add(new THREE.Line(keep(new THREE.BufferGeometry().setFromPoints(arcPts)), keep(new THREE.LineBasicMaterial({ color: 0xe6b450, transparent: true, opacity: 0.6 }))));
      const noon = sunAt(Math.PI / 2);
      const glow = document.createElement("canvas");
      glow.width = glow.height = 128;
      const gc = glow.getContext("2d");
      if (gc) {
        const g = gc.createRadialGradient(64, 64, 2, 64, 64, 64);
        g.addColorStop(0, "rgba(255,244,214,1)");
        g.addColorStop(0.18, "rgba(255,214,120,0.95)");
        g.addColorStop(0.45, "rgba(230,180,80,0.28)");
        g.addColorStop(1, "rgba(230,180,80,0)");
        gc.fillStyle = g;
        gc.fillRect(0, 0, 128, 128);
      }
      const sunSprite = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: keep(new THREE.CanvasTexture(glow)), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
      sunSprite.position.copy(noon);
      sunSprite.scale.setScalar(2.6);
      scene.add(sunSprite);
      const ray = new THREE.Line(
        keep(new THREE.BufferGeometry().setFromPoints([noon, new THREE.Vector3(0, top, 0)])),
        keep(new THREE.LineDashedMaterial({ color: 0xe6b450, dashSize: 0.14, gapSize: 0.12, transparent: true, opacity: 0.45 })),
      );
      ray.computeLineDistances();
      scene.add(ray);

      const sun = new THREE.DirectionalLight(0xfff0d2, 3.1);
      sun.position.copy(noon).multiplyScalar(1.6);
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      sun.shadow.camera.left = -9; sun.shadow.camera.right = 9; sun.shadow.camera.top = 9; sun.shadow.camera.bottom = -9;
      sun.shadow.camera.near = 1; sun.shadow.camera.far = 40;
      sun.shadow.bias = -0.0006;
      sun.shadow.normalBias = 0.03;
      scene.add(sun);
      scene.add(new THREE.HemisphereLight(0xdbe6ff, 0x4a4032, 1.05));
      const fill = new THREE.DirectionalLight(0xfff0dc, 1.9); // so the south and east cut faces read
      fill.position.set(9, 2.5, 13);
      scene.add(fill);
      const fill2 = new THREE.DirectionalLight(0xfff0dc, 0.9);
      fill2.position.set(-12, 2, 6);
      scene.add(fill2);

      // --- camera and controls
      const HOME = new THREE.Vector3(11.4, 7.6, 15.2), LOOK = new THREE.Vector3(0, -0.35, 0);
      camera.position.copy(HOME);
      const controls = new OrbitControls(camera, el);
      controls.target.copy(LOOK);
      controls.enablePan = false;
      controls.enableZoom = false; // the page keeps its scroll
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.rotateSpeed = 0.55;
      controls.minPolarAngle = 0.5;
      controls.maxPolarAngle = 1.5;
      controls.autoRotate = !calm;
      controls.autoRotateSpeed = 0.45;
      controls.addEventListener("start", () => { controls.autoRotate = false; });
      reset.current = () => { camera.position.copy(HOME); controls.target.copy(LOOK); controls.update(); };

      // --- hover a soil layer: it lights up here and in the list beside the drawing
      const caster = new THREE.Raycaster(), ptr = new THREE.Vector2();
      let active = -1;
      const setActive = (k: number) => {
        if (k === active) return;
        active = k;
        bandMats.forEach((m, i) => { m.emissiveIntensity = i === k ? 0.42 : 0; });
        if (k >= 0) document.documentElement.dataset.depth = String(k);
        else delete document.documentElement.dataset.depth;
      };
      const onMove = (e: PointerEvent) => {
        const r = el.getBoundingClientRect();
        ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
        caster.setFromCamera(ptr, camera);
        const hit = caster.intersectObjects([...bandMeshes, groundMesh], false)[0];
        setActive(hit && typeof hit.object.userData.band === "number" ? hit.object.userData.band : -1);
      };
      const onLeave = () => setActive(-1);
      el.addEventListener("pointermove", onMove);
      el.addEventListener("pointerleave", onLeave);
      const rows = Array.from(document.querySelectorAll<HTMLElement>(".depths li"));
      const rowIn = rows.map((_, i) => () => setActive(i));
      rows.forEach((r, i) => { r.addEventListener("pointerenter", rowIn[i]); r.addEventListener("pointerleave", onLeave); });

      const size = () => {
        const w = Math.max(240, box.clientWidth), h = Math.max(240, box.clientHeight);
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        // keep the whole block in frame on narrow panes
        camera.fov = w / h < 1 ? 44 : w / h < 1.25 ? 36 : 30;
        camera.updateProjectionMatrix();
      };
      size();
      const ro = new ResizeObserver(size);
      ro.observe(box);
      let visible = true;
      const io = new IntersectionObserver((e) => { visible = e[0]?.isIntersecting ?? true; });
      io.observe(box);

      let raf = 0;
      const frame = () => {
        raf = requestAnimationFrame(frame);
        if (!visible || document.hidden) return;
        controls.update();
        renderer.render(scene, camera);
      };
      raf = requestAnimationFrame(frame);

      cleanup = () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        io.disconnect();
        el.removeEventListener("pointermove", onMove);
        el.removeEventListener("pointerleave", onLeave);
        rows.forEach((r, i) => { r.removeEventListener("pointerenter", rowIn[i]); r.removeEventListener("pointerleave", onLeave); });
        delete document.documentElement.dataset.depth;
        controls.dispose();
        trash.forEach((t) => t.dispose());
        renderer.dispose();
      };
    })().catch(() => { if (!disposed) setState("failed"); });
    return () => { disposed = true; cleanup(); };
  }, [site, grid, widthKm, depthKm, exaggeration, sunAltitude, layers]);

  if (state === "failed") return <>{fallback}</>;

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Home") { reset.current(); e.preventDefault(); }
  }

  return (
    <div className="b3d" ref={wrap} data-state={state}>
      <canvas ref={canvas} role="img" aria-label={label} tabIndex={0} onKeyDown={onKey} />
      <p className="b3d-hint" aria-hidden="true">Drag to turn · point at a soil layer</p>
      <button type="button" className="btn b3d-reset" onClick={() => reset.current()}>Reset view</button>
    </div>
  );
}
