// Geodesic Lab UI: wiring (DOM, pointer aim, animation loop). No orbit state here beyond references to engine bodies.
(function (root) {
  'use strict';
  const GE = root.GeodesicEngine, S = root.GLSim, D = root.GLDraw, CN = root.GLCone, $ = (id) => document.getElementById(id), M = 1;
  const errors = (root.__glErrors = []);
  root.addEventListener('error', (e) => errors.push(String(e.message)));
  root.addEventListener('unhandledrejection', (e) => errors.push('promise: ' + e.reason));

  const world = new S.World(), cone = new CN.ConeMode();
  const st = { mode: 'bh', viewR: Math.pow(10, 1.2), speed: 10, paused: false, aim: null, ghost: false, clockmap: true, lastRO: '' };
  const cv = { main: $('main'), pot: $('pot'), flamm: $('flamm'), clock: $('clock'), cone: $('cone-cone'), plane: $('cone-plane') };
  const fmt = (x, d) => (Number.isFinite(x) ? (Math.abs(x) >= 1e5 || (x !== 0 && Math.abs(x) < 1e-3) ? x.toExponential(d === undefined ? 4 : d) : x.toFixed(d === undefined ? 5 : d)) : String(x));
  const deg = (x) => x * 180 / Math.PI, rad = (x) => x * Math.PI / 180;

  // ---- round trip: local launch (v, alpha) -> (E, L, rdot) -> inverse -> forward again; returns max abs mismatch ----------------
  function roundTrip(bd) {
    const b = bd.b, l = bd.launch, sf = Math.sqrt(1 - 2 * M / l.r);
    if (bd.kind === 'massive') { const iv = S.invertMassive(l.E, l.L, l.rdot, l.r), g = 1 / Math.sqrt(1 - iv.v * iv.v); const E2 = g * sf, L2 = g * iv.vt * l.r, rd2 = g * iv.vr * sf;
      return Math.max(Math.abs(E2 - l.E), Math.abs(L2 - l.L) / Math.max(1, Math.abs(l.L)), Math.abs(rd2 - l.rdot)); }
    const il = S.invertLight(l.L, l.E, l.rdot, l.r), b2 = l.r * Math.sin(il.alpha) / sf; return Math.abs(b2 - l.L / l.E) / Math.max(1, Math.abs(l.L)) + Math.abs(Math.cos(il.alpha) - l.rdot / l.E);
  }

  function readout(bd) {
    if (!bd) return '<p class="small">Nothing launched yet. Pick a preset or press on the picture.</p>';
    const b = bd.b, l = bd.launch, r = b.r, massive = bd.kind === 'massive', res = world.residual(bd);
    const row = (k, v) => `<tr><td>${k}</td><td>${v}</td></tr>`; let h = '<table>';
    h += row('body', `${bd.name} (${massive ? 'massive particle' : 'light ray'})`);
    h += row('status', bd.status === 'moving' ? (r < 2 ? 'inside the horizon (r &lt; 2M)' : 'moving') : bd.removedNote);
    h += row(massive ? 'proper time &tau; (own clock)' : 'affine parameter &lambda;', fmt(b.par, 5));
    h += row('Painlev&eacute;&ndash;Gullstrand time T', fmt(b.T, 5));
    h += row('r, &phi;', `${fmt(r, 5)} M, ${fmt(deg(b.phi) % 360, 3)}&deg;`);
    h += row('E, L (conserved)', `${fmt(b.E, 10)}, ${fmt(b.L, 10)}`);
    h += row('launch (local static observer)', massive ? `v = ${fmt(l.v, 6)} c, &alpha; = ${fmt(deg(l.alpha), 4)}&deg;` : `&alpha; = ${fmt(deg(l.alpha), 5)}&deg;, b = L/E = ${fmt(b.L / b.E, 8)}`);
    h += row('E, L round trip (max mismatch)', fmt(roundTrip(bd), 3));
    h += row('integrator', `${b.method === 'verlet' ? 'velocity Verlet (bound)' : 'RK4'}, &eta; = ${b.eta}`);
    if (r > 2) h += row('static clock rate &radic;(1&minus;2M/r)', fmt(Math.sqrt(1 - 2 / r), 5));
    if (r > 3 && massive) h += row('circular-orbit clock rate &radic;(1&minus;3M/r)', fmt(Math.sqrt(1 - 3 / r), 5));
    h += row('constraint residual |&#7765;&sup2;+V&sup2;&minus;E&sup2;|/E&sup2;', fmt(res, 3) + (r < 0.17 && massive && b.L !== 0 ? ' <span class="small">(see the documented limit: 64-bit check ~1e-9 relative to E² below r = 0.1M)</span>' : ''));
    h += '</table>';
    if (bd.crossedT !== null) h += `<p class="note">Crossed r = 2M at T = ${fmt(bd.crossedT, 4)}, &tau; = ${fmt(bd.crossedTau, 4)}: a finite proper time, and nothing special happens locally. Time shown is Painlev&eacute;&ndash;Gullstrand T (regular at the horizon), never Schwarzschild t. A distant observer never sees the crossing: the light redshifts, the body reddens and fades (text only; no redshift is rendered).</p>`;
    if (bd.status === 'singularity') h += '<p class="note">reached the singularity: GR stops here (removed at r &lt; 0.05M).</p>';
    if (bd.status === 'escaped') h += '<p class="note">left the displayed region (removed).</p>';
    return h;
  }
  function updateBodies() {
    const tb = $('bodies').tBodies[0]; let html = '';
    for (const bd of world.bodies) html += `<tr data-id="${bd.id}" class="${bd === world.selected ? 'sel' : ''}"><td style="color:${bd.color}">&#9679; ${bd.name}</td><td>${fmt(bd.b.par, 4)}</td><td>${fmt(bd.b.T, 4)}</td><td>${fmt(bd.b.r, 4)}</td><td>${bd.status === 'moving' ? (bd.b.r < 2 ? 'inside horizon' : 'moving') : (bd.status === 'singularity' ? 'GR stops here' : bd.status)}</td></tr>`;
    if (html !== st.lastBodies) { tb.innerHTML = html; st.lastBodies = html; }
  }

  // ---- presets / launch ----------------------------------------------------------------------------------------
  const sel = $('preset'); S.PRESETS.forEach((p) => { const o = document.createElement('option'); o.value = p.id; o.textContent = p.label; sel.appendChild(o); });
  function setSpeed(v) { st.speed = v; $('speed').value = Math.log10(v); }
  function setView(R) { st.viewR = R; $('view').value = Math.log10(R); }
  function runPreset(id) { const p = S.PRESETS.find((q) => q.id === id); sel.value = id; world.clear(); p.run(world); setView(p.viewR); setSpeed(p.speed); st.paused = false; $('pause').textContent = 'Pause'; refresh(); return p; }
  $('runpreset').onclick = () => runPreset(sel.value);
  function launchFromFields() {
    const kind = document.querySelector('input[name=kind]:checked').value, r = +$('in-r').value, phi = rad(+$('in-phi').value), a = rad(+$('in-alpha').value), v = +$('in-v').value; return launch(kind, r, phi, v, a);
  }
  function launch(kind, r, phi, v, alpha) {
    try { if (!(r > 2)) throw new Error('static observers exist only for r > 2M: choose r > 2'); if (kind === 'massive') { if (!(v >= 0 && v < 1)) throw new Error('local speed must be < 1 (c)'); world.launchMassive(r, phi, v * Math.cos(alpha), v * Math.sin(alpha)); } else world.launchLight(r, phi, alpha); $('err').textContent = ''; }
    catch (e) { $('err').textContent = e.message; return null; }
    if (r * 1.1 > st.viewR) setView(r * 1.3); return world.selected;
  }
  $('launch').onclick = launchFromFields;
  document.querySelectorAll('input[name=kind]').forEach((e) => e.onchange = () => { $('lab-v').style.display = e.value === 'light' && e.checked ? 'none' : ''; });
  const errEl = document.createElement('p'); errEl.id = 'err'; errEl.className = 'small'; errEl.style.color = '#ff9a9a'; $('launch').after(errEl);

  // ---- pointer aim ---------------------------------------------------------------------------------------------
  function canvasPos(e) { const rc = cv.main.getBoundingClientRect(); return [e.clientX - rc.left, e.clientY - rc.top]; }
  cv.main.addEventListener('pointerdown', (e) => { e.preventDefault(); cv.main.setPointerCapture(e.pointerId); const [x, y] = canvasPos(e); st.aim = { x0: x, y0: y, x1: x, y1: y }; });
  cv.main.addEventListener('pointermove', (e) => { if (!st.aim) return; const [x, y] = canvasPos(e); st.aim.x1 = x; st.aim.y1 = y; });
  cv.main.addEventListener('pointerup', (e) => { if (!st.aim) return; const [x, y] = canvasPos(e); st.aim.x1 = x; st.aim.y1 = y; finishAim(st.aim); st.aim = null; });
  cv.main.addEventListener('pointercancel', () => { st.aim = null; });
  cv.main.addEventListener('wheel', (e) => { e.preventDefault(); setView(Math.max(3, Math.min(2500, st.viewR * Math.exp(e.deltaY * 0.001)))); }, { passive: false });
  function finishAim(a) {
    const V = D.toView({ w: cv.main.clientWidth, h: cv.main.clientHeight }, st.viewR), x = (a.x0 - V.cx) / V.s, y = -(a.y0 - V.cy) / V.s, r = Math.hypot(x, y), phi = Math.atan2(y, x);
    const dx = a.x1 - a.x0, dy = -(a.y1 - a.y0), len = Math.hypot(dx, dy), er = [Math.cos(phi), Math.sin(phi)], ep = [-Math.sin(phi), Math.cos(phi)];
    const alpha = len < 6 ? 0 : Math.atan2(dx * ep[0] + dy * ep[1], dx * er[0] + dy * er[1]);
    const kind = document.querySelector('input[name=kind]:checked').value, v = Math.min(0.99, len / (0.45 * Math.min(cv.main.clientWidth, cv.main.clientHeight)));
    $('in-r').value = r.toFixed(3); $('in-phi').value = deg(phi).toFixed(2); $('in-alpha').value = deg(alpha).toFixed(2); if (kind === 'massive') $('in-v').value = v.toFixed(3);
    if (kind === 'light' && len < 6) { $('err').textContent = 'drag to aim the ray (direction from the outward radial)'; return; }
    launch(kind, r, phi, v, alpha);
  }

  // ---- toggles / sliders ---------------------------------------------------------------------------------------
  $('pause').onclick = () => { st.paused = !st.paused; $('pause').textContent = st.paused ? 'Resume' : 'Pause'; };
  $('clear').onclick = () => { world.clear(); refresh(); };
  $('zoomin').onclick = () => setView(Math.max(3, st.viewR / 1.4)); $('zoomout').onclick = () => setView(Math.min(2500, st.viewR * 1.4));
  $('ghost').onchange = (e) => { world.ghostOn = e.target.checked; };
  $('clockmap').onchange = (e) => { st.clockmap = e.target.checked; };
  $('speed').oninput = (e) => { st.speed = Math.pow(10, +e.target.value); };
  $('view').oninput = (e) => { st.viewR = Math.pow(10, +e.target.value); };
  $('bodies').tBodies[0].addEventListener('click', (e) => { const tr = e.target.closest('tr'); if (!tr) return; const bd = world.bodies.find((q) => q.id === +tr.dataset.id); if (bd) world.selected = bd; });
  $('tab-bh').onclick = () => setMode('bh'); $('tab-cone').onclick = () => setMode('cone');
  function setMode(m) { st.mode = m; $('bh').hidden = m !== 'bh'; $('cone').hidden = m !== 'cone'; $('tab-bh').classList.toggle('on', m === 'bh'); $('tab-cone').classList.toggle('on', m === 'cone'); }
  $('cone-m').oninput = (e) => { cone.m = +e.target.value; }; $('cone-b').oninput = (e) => { cone.b = +e.target.value; };
  $('cone-play').onclick = () => { cone.playing = !cone.playing; $('cone-play').textContent = cone.playing ? 'Pause' : 'Play'; };

  // ---- frame ---------------------------------------------------------------------------------------------------
  function refresh() {
    $('speedv').textContent = fmt(st.speed, 2); $('viewv').textContent = fmt(st.viewR, 1);
    if (st.mode === 'bh') {
      const cm = D.setup(cv.main); const a = st.aim ? { x0: st.aim.x0, y0: st.aim.y0, x1: st.aim.x1, y1: st.aim.y1, kind: document.querySelector('input[name=kind]:checked').value } : null;
      D.drawMain(cm, world, st.viewR, { clockMap: st.clockmap, aim: a });
      const pn = D.drawPotential(D.setup(cv.pot), world.selected); $('potnote').textContent = pn.text;
      const Rf = Math.min(40, Math.max(12, st.viewR)); D.drawFlamm(D.setup(cv.flamm), world, Rf); D.drawClock(D.setup(cv.clock), world, Rf);
      const ro = readout(world.selected); if (ro !== st.lastRO) { $('ro').innerHTML = ro; st.lastRO = ro; } updateBodies();
    } else {
      CN.drawCone(D.setup(cv.cone), cone); CN.drawPlane(D.setup(cv.plane), cone);
      const i = cone.info(); $('cone-mv').textContent = fmt(cone.m, 3); $('cone-bv').textContent = fmt(cone.b, 1);
      $('cone-ro').innerHTML = `<table><tr><td>deficit &delta; = 8&pi;Gm</td><td>${fmt(i.delta, 5)} rad = ${fmt(i.deltaDeg, 3)}&deg;</td></tr><tr><td>rays cross at x = b/tan(&delta;/2)</td><td>${fmt(i.x, 6)} (formula ${fmt(i.formulaX, 6)})</td></tr><tr><td>radial distance b/sin(&delta;/2)</td><td>${fmt(i.radial, 6)} (formula ${fmt(i.formulaRadial, 6)})</td></tr><tr><td>glued-edge image mismatch</td><td>${fmt(i.mismatch, 3)}</td></tr><tr><td>particles at rest: max displacement</td><td>${fmt(i.restDisp, 3)}</td></tr><tr><td>clock rate (everywhere)</td><td>${fmt(i.clock, 3)}</td></tr></table>`;
    }
  }
  let last = 0;
  function frame(ts) {
    const dt = Math.min(0.05, (ts - last) / 1000 || 0.016); last = ts;
    if (st.mode === 'bh') { if (!st.paused) world.advance(st.speed * dt); } else cone.advance(dt);
    refresh(); root.requestAnimationFrame(frame);
  }
  // test hooks (smoke test only; they call the same code paths as the buttons)
  root.GLApp = { world, cone, state: st, runPreset, launch, refresh, setMode, presets: S.PRESETS, fastForward(T, chunk) { chunk = chunk || 0.5; let n = 0; for (let t = 0; t < T; t += chunk) { world.advance(chunk, 400000); n++; } refresh(); return n; } };
  setView(Math.pow(10, 1.2)); setSpeed(10); runPreset('circ8');
  root.requestAnimationFrame(frame);
})(typeof self !== 'undefined' ? self : this);
