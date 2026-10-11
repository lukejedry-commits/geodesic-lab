#!/usr/bin/env node
// Same playback-independence check, but inside headless Chrome through the page's own GLSim/GeodesicEngine (the code the UI runs).
// NODE_PATH=/tmp/pp/node_modules node test/playback_browser.js out.json   (compares against test/playback_core.js results computed in Node)
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), puppeteer = require('puppeteer-core'), core = require('./playback_core.js');
const ROOT = path.join(__dirname, '..');
const srv = http.createServer((q, s) => { const f = path.join(ROOT, q.url.split('?')[0].replace(/^\/$/, '/index.html')); if (!fs.existsSync(f)) { s.writeHead(404); return s.end(); } s.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html' : f.endsWith('.css') ? 'text/css' : 'text/javascript' }); fs.createReadStream(f).pipe(s); });
(async () => {
  await new Promise((r) => srv.listen(0, r)); const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] }); const p = await b.newPage();
  await p.goto(`http://127.0.0.1:${srv.address().port}/index.html`); await new Promise((r) => setTimeout(r, 400));
  const page = await p.evaluate(() => {
    const GE = window.GeodesicEngine, S = window.GLSim, REF = window.GL_REF, dv = new DataView(new ArrayBuffer(8)), hex = (x) => { dv.setFloat64(0, x); return dv.getBigUint64(0).toString(16).padStart(16, '0'); };
    const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
    const PART = [{ name: '1x @ 60 fps', speed: 1, mk: () => () => 1 / 60 }, { name: '5x @ ~30 fps (jittered 20-45 ms)', speed: 5, mk: () => { const g = lcg(12345); return () => 0.020 + 0.025 * g(); } }, { name: '25x @ ~7 fps (jittered 90-190 ms)', speed: 25, mk: () => { const g = lcg(777); return () => 0.09 + 0.10 * g(); } }];
    const ecc = REF.precession.find((q) => q.r_p === 10 && q.r_a === 20);
    const cases = [{ id: 'verlet_ecc10_20', Tfinal: 500, launch: (w) => w.launchState('massive', { r: 10, rdot: 0, L: ecc.L, E: ecc.E }) }, { id: 'rk4_plunge_r4', Tfinal: 40, launch: (w) => w.launchState('massive', { r: 4 - 1e-4, rdot: 0, L: 4 }) },
      { id: 'rk4_plunge_r4_removed', Tfinal: 400, launch: (w) => w.launchState('massive', { r: 4 - 1e-4, rdot: 0, L: 4 }) }, { id: 'light_b6', Tfinal: 60, launch: (w) => { const R0 = 40, bb = 6; w.launchState('light', { r: R0, phi: Math.PI, rdot: -Math.sqrt(1 - GE.V2light(R0, bb, 1)), L: bb, E: 1, rEscape: 46 }); } }];
    return cases.map((c) => ({ id: c.id, runs: PART.map((P) => { const w = new S.World(); c.launch(w); const dtf = P.mk(); let frames = 0; while (w.T < c.Tfinal) { let dT = P.speed * dtf(); if (w.T + dT > c.Tfinal) dT = c.Tfinal - w.T; if (dT <= 0) break; w.advance(dT); frames++; } const bb = w.bodies[0].b;
      return { partition: P.name, frames, steps: bb.steps, status: w.bodies[0].status, hex: { r: hex(bb.r), phi: hex(bb.phi), rdot: hex(bb.rdot), E: hex(bb.E), L: hex(bb.L), T: hex(bb.T), tau: hex(bb.par) } }; }) }));
  });
  await b.close(); srv.close(); const node = core.runAll(); let ok = true; const report = [];
  for (const c of page) { const n = node.find((x) => x.id === c.id); const ref = c.runs[0]; const within = c.runs.every((r) => r.steps === ref.steps && Object.keys(ref.hex).every((k) => r.hex[k] === ref.hex[k]));
    const cross = Object.keys(ref.hex).every((k) => ref.hex[k] === n.runs[0].hex[k]) && ref.steps === n.runs[0].steps; ok = ok && within; report.push({ id: c.id, browserIdenticalAcrossPartitions: within, steps: ref.steps, browserEqualsNode: cross, runs: c.runs });
    console.log(`${c.id}: browser partitions identical: ${within} (steps ${c.runs.map((r) => r.steps).join('/')}, frames ${c.runs.map((r) => r.frames).join('/')}, status ${ref.status}); browser == node bitwise: ${cross}`); }
  if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(report, null, 1)); process.exit(ok ? 0 : 1);
})();
