#!/usr/bin/env node
// Headless-Chrome smoke test for the UI (local only). Needs puppeteer-core:  NODE_PATH=/tmp/pp/node_modules node test/ui_smoke.js [--out results/step6_ui]
// Serves the repo on localhost, loads index.html at desktop and phone viewports, runs every preset, drives a pointer drag launch, the toggles and cone mode,
// fails on any console error / page error / failed request, and saves screenshots. Also source-scans ui/*.js for Float32 outside draw.js.
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const puppeteer = require('puppeteer-core');
const ROOT = path.join(__dirname, '..'), args = process.argv.slice(2), oi = args.indexOf('--out'), OUT = path.resolve(ROOT, oi >= 0 ? args[oi + 1] : 'results/step6_ui');
fs.mkdirSync(OUT, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const server = http.createServer((q, s) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]).replace(/^\/$/, '/index.html')); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { s.writeHead(404); return s.end('nf'); } s.writeHead(200, { 'content-type': mime[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(s); });
const results = [], log = (id, ok, detail) => { results.push({ id, ok, detail }); console.log((ok ? 'PASS ' : 'FAIL ') + id + '  ' + detail); };
(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r)); const url = `http://127.0.0.1:${server.address().port}/index.html`;
  // source scan: Float32 only in ui/draw.js
  { const hits = []; for (const f of ['index.html', 'style.css', ...fs.readdirSync(path.join(ROOT, 'ui')).map((x) => 'ui/' + x), ...fs.readdirSync(path.join(ROOT, 'src')).map((x) => 'src/' + x)]) { if (f === 'ui/draw.js') continue; const t = fs.readFileSync(path.join(ROOT, f), 'utf8'); if (/Float32|Float16|fround|Int32Array|Uint8Array|Uint16Array|Uint32Array/.test(t.replace(/\/\/[^\n]*/g, ''))) hits.push(f); }
    const d = fs.readFileSync(path.join(ROOT, 'ui/draw.js'), 'utf8'); const n32 = (d.match(/Float32Array/g) || []).length;
    log('scan.float32.outside_draw', hits.length === 0, `typed-array/Float32 hits outside ui/draw.js: ${hits.length} ${hits.join(',')}; Float32Array mentions in draw.js: ${n32} (draw copy of screen coordinates only)`); }
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'] });
  for (const dev of [{ name: 'desktop', w: 1280, h: 900, mobile: false }, { name: 'phone', w: 390, h: 844, mobile: true }]) {
    const page = await browser.newPage(); const errs = [];
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
    page.on('pageerror', (e) => errs.push('pageerror: ' + e.message)); page.on('requestfailed', (r) => errs.push('requestfailed: ' + r.url()));
    page.on('response', (r) => { if (r.status() >= 400) errs.push('http ' + r.status() + ' ' + r.url()); });
    await page.setViewport({ width: dev.w, height: dev.h, deviceScaleFactor: dev.mobile ? 2 : 1, isMobile: dev.mobile, hasTouch: dev.mobile });
    await page.goto(url, { waitUntil: 'load' }); await new Promise((r) => setTimeout(r, 500));
    const ready = await page.evaluate(() => typeof window.GLApp === 'object' && window.GLApp.world.bodies.length > 0);
    log(`${dev.name}.load`, ready, `GLApp ready, initial preset body count > 0`);
    const ov = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
    if (dev.mobile) log(`${dev.name}.layout_viewport`, ov.iw === dev.w, `innerWidth ${ov.iw} must equal device width ${dev.w} (page must not force a wider layout)`);
    log(`${dev.name}.no_hscroll`, ov.sw <= ov.iw + 1, `scrollWidth ${ov.sw} vs innerWidth ${ov.iw}`);
    const tap = await page.evaluate(() => [...document.querySelectorAll('button, select, input[type=number]')].filter((e) => e.offsetParent && e.getBoundingClientRect().height < 40).map((e) => e.id || e.className));
    log(`${dev.name}.touch_targets`, tap.length === 0, `controls under 40px tall: ${tap.length} ${tap.join(',')}`);
    const spans = { circ6: 100, circ8: 150, circ10: 200, ecc: 500, lightb6: 60, lightb1000: 3200, infall6: 40, photon: 40 };
    for (const id of Object.keys(spans)) {
      const o = await page.evaluate((id, span) => { const A = window.GLApp; A.runPreset(id); A.fastForward(span); const w = A.world; return { n: w.bodies.length, T: w.T, bodies: w.bodies.map((b) => ({ name: b.name, status: b.status, r: b.b.r, phi: b.b.phi, tau: b.b.par, Tb: b.b.T, E: b.b.E, L: b.b.L, steps: b.stepsTotal, finite: [b.b.r, b.b.phi, b.b.par, b.b.T, b.b.rdot].every(Number.isFinite), method: b.b.method, eta: b.b.eta, crossedT: b.crossedT, resMax: b.resMax, rt: 0 })) }; }, id, spans[id]);
      const fin = o.bodies.every((b) => b.finite); let extra = '';
      if (id === 'circ8') { const b = o.bodies[0]; extra = `|r-8|/8 = ${(Math.abs(b.r - 8) / 8).toExponential(2)}`; log(`${dev.name}.preset.${id}.circular_stays`, Math.abs(b.r - 8) / 8 < 1e-5, extra); }
      if (id === 'infall6') { const b = o.bodies[0], exp = (2 / 3) * (Math.pow(6, 1.5) - Math.pow(0.05, 1.5)) / Math.sqrt(2); extra = `removed=${b.status}, tau=${b.tau.toFixed(5)} expected ${exp.toFixed(5)}`; log(`${dev.name}.preset.${id}.tau`, b.status === 'singularity' && Math.abs(b.tau - exp) / exp < 1e-3, extra); }
      if (id === 'photon') { extra = o.bodies.map((b) => b.name + ': ' + b.status + ' r=' + b.r.toFixed(3)).join(' | '); log(`${dev.name}.preset.${id}.fate`, o.bodies[0].status === 'singularity' && o.bodies[1].status !== 'singularity', extra); }
      if (id === 'lightb6') { extra = o.bodies[0].status + ' r=' + o.bodies[0].r.toFixed(2); }
      log(`${dev.name}.preset.${id}`, fin && o.bodies.length > 0, `bodies ${o.n}, T=${o.T.toFixed(2)}, steps ${o.bodies.map((b) => b.steps).join('/')}, ${o.bodies.map((b) => b.method + ' eta=' + b.eta).join('; ')} ${extra}`);
      await page.screenshot({ path: path.join(OUT, `${dev.name}_preset_${id}.png`) });
    }
    // pointer drag launch (real mouse/touch path)
    const before = await page.evaluate(() => { window.GLApp.runPreset('circ8'); return window.GLApp.world.bodies.length; });
    const box = await (await page.$('#main')).boundingBox(); const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    await page.mouse.move(cx + 0.30 * box.width * 0.5, cy); await page.mouse.down(); await page.mouse.move(cx + 0.30 * box.width * 0.5, cy - 60, { steps: 4 }); await page.mouse.up();
    const after = await page.evaluate(() => { const A = window.GLApp, w = A.world, b = w.selected; A.fastForward(5); return { n: w.bodies.length, name: b.name, kind: b.kind, r: b.launch.r, v: b.launch.v, alpha: b.launch.alpha, E: b.b.E, L: b.b.L }; });
    log(`${dev.name}.drag_launch`, after.n === before + 1, `bodies ${before} -> ${after.n}; launched ${after.kind} at r=${after.r.toFixed(3)}, v=${after.v.toFixed(4)}c, alpha=${(after.alpha * 180 / Math.PI).toFixed(2)}deg, E=${after.E.toFixed(8)}, L=${after.L.toFixed(8)}`);
    // E, L round trip over a grid of launches
    const rt = await page.evaluate(() => { const A = window.GLApp, GE = window.GeodesicEngine; let worst = 0; for (const r of [2.5, 3, 6, 10, 50]) for (const v of [0, 0.1, 0.5, 0.9, 0.99]) for (const a of [0, 0.7, 1.57, 3, -2]) { A.world.clear(); const b = A.world.launchMassive(r, 0.3, v * Math.cos(a), v * Math.sin(a)); const l = b.launch; worst = Math.max(worst, Math.abs(l.vr - v * Math.cos(a)), Math.abs(l.vt - v * Math.sin(a))); } for (const r of [2.5, 3, 10, 100]) for (const a of [0.2, 1.57, 2.5, -1]) { A.world.clear(); const b = A.world.launchLight(r, 0, a); worst = Math.max(worst, Math.abs(Math.sin(b.launch.alpha) - Math.sin(a)), Math.abs(Math.cos(b.launch.alpha) - Math.cos(a))); } return worst; });
    log(`${dev.name}.EL_roundtrip`, rt < 1e-12, `max |recovered - commanded| over 125 massive + 16 light launches = ${rt.toExponential(2)}`);
    // toggles: ghost off by default, on draws ghost
    const g0 = await page.evaluate(() => { window.GLApp.runPreset('circ8'); return document.getElementById('ghost').checked; });
    log(`${dev.name}.ghost_default_off`, g0 === false, `ghost checkbox checked at load: ${g0}`);
    await page.click('#ghost'); await page.evaluate(() => window.GLApp.fastForward(40)); const gh = await page.evaluate(() => ({ on: window.GLApp.world.ghostOn, n: window.GLApp.world.bodies[0].ghost.tx.length })); log(`${dev.name}.ghost_on`, gh.on && gh.n > 5, `ghostOn ${gh.on}, ghost path points ${gh.n}`); await page.click('#ghost');
    // required text
    const txt = await page.evaluate(() => document.body.innerText);
    for (const [k, re] of [['limit_note', /Currently documented limit[\s\S]*0\.05M[\s\S]*1e.?9/i], ['caption', /slowed time, not curved space/i], ['caption2', /g.{0,3}tt/i]]) log(`${dev.name}.text.${k}`, re.test(txt), String(re));
    await page.evaluate(() => { window.GLApp.runPreset('infall6'); window.GLApp.fastForward(40); window.GLApp.refresh(); }); const t2 = await page.evaluate(() => document.body.innerText);
    log(`${dev.name}.text.gr_stops_here`, /GR stops here/.test(t2) && /distant observer never sees the crossing/.test(t2) && /redden/.test(t2), 'label + distant-observer text after a plunge');
    await page.screenshot({ path: path.join(OUT, `${dev.name}_full_infall.png`), fullPage: true });
    // cone mode
    await page.click('#tab-cone'); await new Promise((r) => setTimeout(r, 400)); const cr = await page.evaluate(() => { window.GLApp.cone.t = 0.9; window.GLApp.refresh(); return window.GLApp.cone.info(); });
    const ok = Math.abs(cr.x - cr.formulaX) / cr.formulaX < 1e-12 && Math.abs(cr.radial - cr.formulaRadial) / cr.formulaRadial < 1e-12 && cr.restDisp === 0 && cr.clock === 1;
    log(`${dev.name}.cone`, ok, `delta=${cr.deltaDeg.toFixed(3)}deg x=${cr.x.toFixed(6)} (b/tan) radial=${cr.radial.toFixed(6)} (b/sin) rest displacement=${cr.restDisp} clock=${cr.clock}`);
    await page.screenshot({ path: path.join(OUT, `${dev.name}_cone.png`), fullPage: true });
    await page.click('#tab-bh'); await page.evaluate(() => window.GLApp.runPreset('circ8')); await new Promise((r) => setTimeout(r, 300)); await page.evaluate(() => window.GLApp.fastForward(60));
    await page.screenshot({ path: path.join(OUT, `${dev.name}_main.png`), fullPage: false }); await page.screenshot({ path: path.join(OUT, `${dev.name}_full.png`), fullPage: true });
    const pe = await page.evaluate(() => window.__glErrors.slice()); log(`${dev.name}.console_errors`, errs.length === 0 && pe.length === 0, `console errors/warnings: ${errs.length}, page errors: ${pe.length} ${errs.concat(pe).slice(0, 5).join(' | ')}`);
    await page.close();
  }
  await browser.close(); server.close();
  const fails = results.filter((r) => !r.ok).length; fs.writeFileSync(path.join(OUT, 'smoke.json'), JSON.stringify({ pass: results.length - fails, fail: fails, results }, null, 1));
  console.log(`\nUI smoke: ${results.length - fails}/${results.length} PASS, ${fails} FAIL`); process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
