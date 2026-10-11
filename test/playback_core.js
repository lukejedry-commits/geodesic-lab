// Playback-independence check (ASSERTS J). Runs the UI's own stepping code (ui/sim.js World.advance) in a vm context that looks like the browser page
// (self/window globals, engine.js + ref_values.js + sim.js loaded as plain scripts), under three frame partitions / playback speeds, to the same final T.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
function loadUI() {
  const ctx = {}; ctx.self = ctx; ctx.window = ctx; vm.createContext(ctx);
  for (const f of ['src/engine.js', 'ui/ref_values.js', 'ui/sim.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  return ctx;
}
const buf = new DataView(new ArrayBuffer(8));
const hex = (x) => { buf.setFloat64(0, x); return buf.getBigUint64(0).toString(16).padStart(16, '0'); };
// deterministic frame-time jitter (LCG), so "different simulated frame rates" are reproducible
function lcg(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
const PARTITIONS = [
  { name: '1x @ 60 fps', speed: 1, mk: () => () => 1 / 60 },
  { name: '5x @ ~30 fps (jittered 20-45 ms)', speed: 5, mk: () => { const g = lcg(12345); return () => 0.020 + 0.025 * g(); } },
  { name: '25x @ ~7 fps (jittered 90-190 ms)', speed: 25, mk: () => { const g = lcg(777); return () => 0.09 + 0.10 * g(); } },
];
function runPartition(ctx, P, launch, Tfinal) {
  const w = new ctx.GLSim.World(); launch(w); let frames = 0; const dts = []; const dtf = P.mk();
  while (w.T < Tfinal) { const dt = dtf(); let dT = P.speed * dt; if (w.T + dT > Tfinal) dT = Tfinal - w.T; if (dT <= 0) break; w.advance(dT); frames++; if (frames < 4) dts.push(dt); }
  const b = w.bodies[0].b;
  return { partition: P.name, speed: P.speed, frames, firstFrameDts: dts, steps: b.steps, status: w.bodies[0].status,
    state: { r: b.r, phi: b.phi, rdot: b.rdot, E: b.E, L: b.L, T: b.T, tau: b.par }, hex: { r: hex(b.r), phi: hex(b.phi), rdot: hex(b.rdot), E: hex(b.E), L: hex(b.L), T: hex(b.T), tau: hex(b.par) } };
}
function cases(ctx) {
  const REF = ctx.GL_REF, GE = ctx.GeodesicEngine;
  const ecc = REF.precession.find((q) => q.r_p === 10 && q.r_a === 20);
  return [
    { id: 'verlet_ecc10_20', desc: 'Verlet orbit (rp,ra)=(10,20)', Tfinal: 500, launch: (w) => w.launchState('massive', { r: 10, rdot: 0, L: ecc.L, E: ecc.E }) },
    { id: 'rk4_plunge_r4', desc: 'RK4 plunge r=4-1e-4, L=4 (default eta 1e-4), mid-plunge', Tfinal: 40, launch: (w) => w.launchState('massive', { r: 4 - 1e-4, rdot: 0, L: 4 }) },
    { id: 'rk4_plunge_r4_removed', desc: 'same plunge run past the r=0.05M removal', Tfinal: 400, launch: (w) => w.launchState('massive', { r: 4 - 1e-4, rdot: 0, L: 4 }) },
    { id: 'light_b6', desc: 'light ray b=6 from r=40', Tfinal: 60, launch: (w) => { const R0 = 40, b = 6; w.launchState('light', { r: R0, phi: Math.PI, rdot: -Math.sqrt(1 - GE.V2light(R0, b, 1)), L: b, E: 1, rEscape: 46 }); } },
  ];
}
function runAll() {
  const out = [];
  for (const c of cases(loadUI())) {
    const runs = PARTITIONS.map((P) => { const ctx = loadUI(); return runPartition(ctx, P, c.launch, c.Tfinal); }); // fresh context per run, fresh partition RNG below
    out.push(Object.assign({ id: c.id, desc: c.desc, Tfinal: c.Tfinal }, { runs }));
  }
  return out;
}
module.exports = { runAll, loadUI, hex, PARTITIONS };
if (require.main === module) { const res = runAll(); console.log(JSON.stringify(res, (k, v) => (typeof v === 'bigint' ? v.toString() : v), 1)); }
