// Geodesic Lab UI: ALL drawing. This is the ONLY file allowed to create Float32Array (a DRAW COPY of 64-bit trail data; never fed back).
(function (root) {
  'use strict';
  const GE = root.GeodesicEngine, M = 1;
  const rate = (r) => (r > 2 * M ? Math.sqrt(1 - 2 * M / r) : 0);
  function clockColor(t, a) { const h = 12 + 205 * t, l = 16 + 34 * t; return `hsla(${h.toFixed(0)},72%,${l.toFixed(0)}%,${a === undefined ? 1 : a})`; }

  function setup(canvas) { // sizes the backing store to the CSS size (device pixel ratio capped at 2 for phones)
    const dpr = Math.min(2, root.devicePixelRatio || 1), cw = canvas.clientWidth || 300, ch = canvas.clientHeight || 300;
    if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) { canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr); }
    const ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); return { ctx, w: cw, h: ch };
  }
  function polyline(ctx, xs, ys, toX, toY) { // trail as a Float32Array DRAW COPY of screen coordinates
    const n = xs.length; if (n < 2) return; const buf = new Float32Array(2 * n);
    for (let i = 0; i < n; i++) { buf[2 * i] = toX(xs[i]); buf[2 * i + 1] = toY(ys[i]); }
    ctx.beginPath(); ctx.moveTo(buf[0], buf[1]); for (let i = 1; i < n; i++) ctx.lineTo(buf[2 * i], buf[2 * i + 1]); ctx.stroke();
  }
  function niceLen(v) { const p = Math.pow(10, Math.floor(Math.log10(v))), m = v / p; return (m >= 5 ? 5 : m >= 2 ? 2 : 1) * p; }

  // view: { R } world radius shown from the centre to the nearer canvas edge
  function toView(c, R) { const s = Math.min(c.w, c.h) / 2 * 0.96 / R; return { s, cx: c.w / 2, cy: c.h / 2, X: (x) => c.w / 2 + x * s, Y: (y) => c.h / 2 - y * s }; }

  function drawMain(c, world, R, opt) {
    const { ctx, w, h } = c, V = toView(c, R); ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#05070d'; ctx.fillRect(0, 0, w, h);
    if (opt.clockMap) { // time view: clock-rate colour map sqrt(1-2M/r) (static clocks), dark = slow
      const ext = Math.hypot(w, h) / 2, g = ctx.createRadialGradient(V.cx, V.cy, 0, V.cx, V.cy, ext), N = 40;
      g.addColorStop(0, '#000');
      for (let k = 0; k <= N; k++) { const r = 2 * Math.pow(Math.max(ext / V.s, 4) / 2, k / N), f = Math.min(1, r * V.s / ext); g.addColorStop(f, clockColor(rate(r), 0.9)); }
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
    ctx.lineWidth = 1.5;
    // ISCO dotted, photon sphere dashed, horizon filled
    const ring = (r, dash, col, lab) => { const pr = r * V.s; if (pr < 1) return; ctx.save(); ctx.setLineDash(dash); ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(V.cx, V.cy, pr, 0, 2 * Math.PI); ctx.stroke(); ctx.restore();
      if (pr > 22) { ctx.fillStyle = col; ctx.font = '11px system-ui,sans-serif'; ctx.fillText(lab, V.cx + pr * 0.707 + 4, V.cy - pr * 0.707 - 3); } };
    ring(6 * M, [1.5, 5], '#9fb4ff', 'ISCO 6M'); ring(3 * M, [8, 5], '#ffd24a', 'photon sphere 3M');
    ctx.beginPath(); ctx.arc(V.cx, V.cy, Math.max(2 * M * V.s, 2), 0, 2 * Math.PI); ctx.fillStyle = '#000'; ctx.fill(); ctx.strokeStyle = '#7a8099'; ctx.lineWidth = 1; ctx.stroke();
    if (2 * V.s > 26) { ctx.fillStyle = '#9aa3bd'; ctx.font = '11px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.fillText('horizon 2M', V.cx, V.cy + 4); ctx.textAlign = 'start'; }
    // scale bar
    const L = niceLen(R * 0.3), px = L * V.s; ctx.strokeStyle = '#cfd6ea'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(12, h - 16); ctx.lineTo(12 + px, h - 16); ctx.stroke();
    ctx.fillStyle = '#cfd6ea'; ctx.font = '11px system-ui,sans-serif'; ctx.fillText(L + ' M (coordinate labels, r = areal radius)', 12, h - 22);
    // ghosts
    if (world.ghostOn) for (const b of world.bodies) { ctx.save(); ctx.setLineDash([4, 4]); ctx.strokeStyle = 'rgba(200,200,200,0.75)'; ctx.lineWidth = 1.2; polyline(ctx, b.ghost.tx, b.ghost.ty, V.X, V.Y); ctx.restore();
      if (b.ghost.alive) { ctx.fillStyle = 'rgba(210,210,210,0.9)'; ctx.fillRect(V.X(b.ghost.x) - 2, V.Y(b.ghost.y) - 2, 4, 4); } }
    // bodies
    let lab = 0;
    for (const b of world.bodies) {
      ctx.strokeStyle = b.color; ctx.lineWidth = b.kind === 'light' ? 1.4 : 1.8; polyline(ctx, b.tx, b.ty, V.X, V.Y);
      const x = V.X(b.b.r * Math.cos(b.b.phi)), y = V.Y(b.b.r * Math.sin(b.b.phi));
      if (b.b.alive) { ctx.beginPath(); ctx.arc(x, y, b.kind === 'light' ? 3 : 4.5, 0, 2 * Math.PI); ctx.fillStyle = b.kind === 'light' ? '#fff' : b.color; ctx.fill();
        if (b.b.r < 2 * M) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke(); }
        if (b === world.selected) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, 9, 0, 2 * Math.PI); ctx.stroke(); } }
      else if (b.status === 'singularity') { // removed at r < 0.05M
        ctx.strokeStyle = b.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(V.cx - 5, V.cy - 5); ctx.lineTo(V.cx + 5, V.cy + 5); ctx.moveTo(V.cx + 5, V.cy - 5); ctx.lineTo(V.cx - 5, V.cy + 5); ctx.stroke();
        ctx.fillStyle = b.color; ctx.font = 'bold 12px system-ui,sans-serif'; ctx.fillText('GR stops here (' + b.name + ')', V.cx + 12, V.cy + 14 + 14 * lab++); }
    }
    if (opt.aim) { const a = opt.aim; ctx.strokeStyle = a.kind === 'light' ? '#fff' : '#ffd24a'; ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(a.x0, a.y0); ctx.lineTo(a.x1, a.y1); ctx.stroke(); ctx.beginPath(); ctx.arc(a.x0, a.y0, 4, 0, 2 * Math.PI); ctx.fill();
      const ang = Math.atan2(a.y1 - a.y0, a.x1 - a.x0); ctx.beginPath(); ctx.moveTo(a.x1, a.y1); ctx.lineTo(a.x1 - 9 * Math.cos(ang - 0.4), a.y1 - 9 * Math.sin(ang - 0.4)); ctx.lineTo(a.x1 - 9 * Math.cos(ang + 0.4), a.y1 - 9 * Math.sin(ang + 0.4)); ctx.closePath(); ctx.fill(); }
    return V;
  }

  function axes(ctx, x0, y0, x1, y1, xl, yl) { ctx.strokeStyle = '#59627d'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0, y1); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.fillStyle = '#9aa3bd'; ctx.font = '11px system-ui,sans-serif'; ctx.fillText(xl, x1 - ctx.measureText(xl).width, y1 + 13); ctx.save(); ctx.translate(x0 - 6, y0 + 40); ctx.rotate(-Math.PI / 2); ctx.fillText(yl, 0, 0); ctx.restore(); }

  // effective potential side panel: V^2(r) for the selected body's L, with the E^2 level line
  function drawPotential(c, body) {
    const { ctx, w, h } = c; ctx.clearRect(0, 0, w, h); ctx.fillStyle = '#0b0f1a'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#cfd6ea'; ctx.font = '12px system-ui,sans-serif';
    if (!body) { ctx.fillText('Launch a particle or ray to see V\u00b2(r) and its E\u00b2 level.', 10, 22); return { text: '' }; }
    const b = body.b, E2 = b.E * b.E, L = b.L, massive = b.kind === 'massive', V2 = (r) => massive ? GE.V2massive(r, L, M) : GE.V2light(r, L, M);
    const Rp = Math.max(24, Math.min(80, 1.25 * Math.max(b.r, 12))), x0 = 40, x1 = w - 10, y0 = 14, y1 = h - 24;
    let vmax = 0; for (let i = 0; i <= 200; i++) vmax = Math.max(vmax, V2(2 + (Rp - 2) * i / 200));
    const ymax = Math.max(1.25 * E2, 1.1 * vmax, 0.2), X = (r) => x0 + (r - 2) / (Rp - 2) * (x1 - x0), Y = (v) => y1 - Math.max(0, Math.min(v, ymax)) / ymax * (y1 - y0);
    axes(ctx, x0, y0, x1, y1, 'r / M', massive ? 'V\u00b2(r)' : 'V\u00b2 = (1-2M/r) L\u00b2/r\u00b2');
    ctx.strokeStyle = body.color; ctx.lineWidth = 2; ctx.beginPath(); for (let i = 0; i <= 300; i++) { const r = 2 + (Rp - 2) * i / 300; (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(r), Y(V2(r))); } ctx.stroke();
    ctx.save(); ctx.setLineDash([6, 4]); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(x0, Y(E2)); ctx.lineTo(x1, Y(E2)); ctx.stroke(); ctx.restore();
    ctx.fillStyle = '#fff'; ctx.fillText('E\u00b2 = ' + E2.toFixed(4), x0 + 6, Y(E2) - 4);
    const rr = Math.min(b.r, Rp); ctx.strokeStyle = '#7a8099'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(X(rr), y0); ctx.lineTo(X(rr), y1); ctx.stroke();
    ctx.beginPath(); ctx.arc(X(rr), Y(V2(Math.max(rr, 2))), 4, 0, 2 * Math.PI); ctx.fillStyle = '#fff'; ctx.fill();
    // verdict from the barrier top
    const cr = massive ? GE.criticalRadii(L, M) : (L !== 0 ? { rMax: 3 * M } : null); let verdict;
    if (!cr) verdict = 'no barrier for this L: any inward motion ends at the centre (capture).';
    else { const top = V2(cr.rMax); verdict = 'barrier top V\u00b2 = ' + top.toFixed(4) + ' at r = ' + cr.rMax.toFixed(3) + ': E\u00b2 ' + (E2 > top ? 'above it: no turning point on the way in (capture).' : 'below it: turning point (bounce or bound orbit) on that side.'); }
    return { text: verdict };
  }

  // Space view: Flamm surface profile (embedding of the equatorial slice at one instant)
  function drawFlamm(c, world, Rf) {
    const { ctx, w, h } = c; ctx.clearRect(0, 0, w, h); ctx.fillStyle = '#0b0f1a'; ctx.fillRect(0, 0, w, h);
    Rf = Math.max(8, Math.min(40, Rf)); const z = (r) => 2 * Math.sqrt(2 * M * (r - 2 * M)), zmax = z(Rf), s = Math.min((w - 30) / (2 * Rf), (h - 40) / zmax), cx = w / 2, y1 = h - 14;
    const X = (x) => cx + x * s, Y = (zz) => y1 - zz * s; ctx.strokeStyle = '#8fb0ff'; ctx.lineWidth = 2;
    for (const sg of [-1, 1]) { ctx.beginPath(); for (let i = 0; i <= 120; i++) { const r = 2 * M + (Rf - 2 * M) * Math.pow(i / 120, 1.6); (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(sg * r), Y(z(r))); } ctx.stroke(); }
    ctx.save(); ctx.setLineDash([3, 4]); ctx.strokeStyle = '#59627d'; ctx.beginPath(); ctx.moveTo(X(-2), Y(0)); ctx.lineTo(X(2), Y(0)); ctx.stroke(); ctx.restore();
    ctx.fillStyle = '#cfd6ea'; ctx.font = '12px system-ui,sans-serif'; ctx.fillText('shape of space at one instant', 8, 16);
    ctx.fillStyle = '#9aa3bd'; ctx.font = '11px system-ui,sans-serif'; ctx.fillText('Flamm surface z = 2\u221a(2M(r\u22122M)), drawn for r \u2265 2M', 8, 30);
    for (const b of world.bodies) if (b.b.alive && b.b.r >= 2 * M && b.b.r <= Rf) { const sg = Math.cos(b.b.phi) >= 0 ? 1 : -1; ctx.beginPath(); ctx.arc(X(sg * b.b.r), Y(z(b.b.r)), 4, 0, 2 * Math.PI); ctx.fillStyle = b.kind === 'light' ? '#fff' : b.color; ctx.fill(); }
  }
  // Time view strip: clock rate sqrt(1-2M/r) colour map with particle markers
  function drawClock(c, world, Rf) {
    const { ctx, w, h } = c; ctx.clearRect(0, 0, w, h); ctx.fillStyle = '#0b0f1a'; ctx.fillRect(0, 0, w, h);
    Rf = Math.max(8, Math.min(40, Rf)); const x0 = 10, x1 = w - 10, yb = 24, hb = 22, X = (r) => x0 + (r - 2) / (Rf - 2) * (x1 - x0);
    for (let i = 0; i < x1 - x0; i++) { const r = 2 + i / (x1 - x0) * (Rf - 2); ctx.fillStyle = clockColor(rate(r)); ctx.fillRect(x0 + i, yb, 1.5, hb); }
    ctx.fillStyle = '#cfd6ea'; ctx.font = '12px system-ui,sans-serif'; ctx.fillText('clock rate of a static clock, \u221a(1\u22122M/r)  (dark = slow)', 8, 16);
    ctx.fillStyle = '#9aa3bd'; ctx.font = '11px system-ui,sans-serif';
    for (const r of [2, 3, 6, 10, 20, 40]) if (r <= Rf) { ctx.fillText(r + 'M', X(r) - 8, yb + hb + 14); ctx.fillRect(X(r), yb + hb, 1, 4); }
    for (const b of world.bodies) if (b.b.alive && b.b.r >= 2 * M && b.b.r <= Rf) { ctx.fillStyle = b.kind === 'light' ? '#fff' : b.color; ctx.beginPath(); ctx.moveTo(X(b.b.r), yb - 2); ctx.lineTo(X(b.b.r) - 4, yb - 9); ctx.lineTo(X(b.b.r) + 4, yb - 9); ctx.fill(); }
  }
  root.GLDraw = { setup, toView, drawMain, drawPotential, drawFlamm, drawClock, rate, clockColor, polyline };
})(typeof self !== 'undefined' ? self : this);
