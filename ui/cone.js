// Geodesic Lab UI: 2+1 cone mode (true 2+1 GR contrast). Point mass m -> deficit angle delta = 8 pi G m; geodesics are straight lines on the unrolled plane.
// Uses GeodesicEngine.Cone for the numbers; everything is 64-bit JS numbers (no typed arrays).
(function (root) {
  'use strict';
  const GE = root.GeodesicEngine, Cone = GE.Cone;
  function ConeMode() { this.m = 0.08; this.b = 3; this.t = 0; this.rest = [[-4, 2.5], [-5.5, -1.5], [3, 4.5], [5, -3]].map((p) => Cone.restBody(p[0], p[1])); this.restStart = this.rest.map((p) => [p.x, p.y]); this.playing = true; }
  ConeMode.prototype.deficit = function () { return Cone.deficit(this.m); };
  ConeMode.prototype.info = function () {
    const d = this.deficit(), hit = Cone.parallelRayCrossing(this.b, d), disp = Math.max(...this.rest.map((p, i) => Math.hypot(p.x - this.restStart[i][0], p.y - this.restStart[i][1])));
    return { delta: d, deltaDeg: d * 180 / Math.PI, x: hit.x, radial: hit.radial, mismatch: hit.imageMismatch, formulaX: this.b / Math.tan(d / 2), formulaRadial: this.b / Math.sin(d / 2), restDisp: disp, clock: this.rest[0].clockRate };
  };
  ConeMode.prototype.advance = function (dt) { if (this.playing) this.t = (this.t + dt * 0.25) % 1.4; for (const p of this.rest) Cone.stepRest(p, dt); }; // rest bodies: vx = vy = 0, so nothing moves
  // point on ray 1 or ray 2 (and its continuation through the seam) at parameter t in [0, 1.4]
  function rayPoints(b, delta, X0, upTo) {
    const hit = Cone.parallelRayCrossing(b, delta), xh = hit.x, c = Math.cos(delta), s = Math.sin(delta), seg = [];
    const len1 = xh + X0; // before the seam: straight along +x
    const pts = (sign) => { const out = [], n = 40, P = [xh, sign * b], d = sign > 0 ? [c, -s] : [c, s], cont = 1.1 * X0 * 0.8;
      const tot = len1 + cont, tmax = upTo * tot;
      for (let i = 0; i <= n; i++) { const t = Math.min(tmax, i / n * tmax); let x, y; if (t <= len1) { x = -X0 + t; y = sign * b; } else { const u = t - len1; x = P[0] + u * d[0]; y = P[1] + u * d[1]; } out.push([x, y, t > len1]); }
      return out; };
    return { up: pts(1), down: pts(-1), hit };
  }
  function drawPlane(c, mode) {
    const { ctx, w, h } = c; ctx.clearRect(0, 0, w, h); ctx.fillStyle = '#0b0f1a'; ctx.fillRect(0, 0, w, h);
    const d = mode.deficit(), R = 9, s = Math.min(w, h) / 2 * 0.94 / R, cx = w / 2 - 0.0 * w, cy = h / 2, X = (x) => cx + x * s, Y = (y) => cy - y * s;
    // removed wedge |angle| < delta/2 about +x
    ctx.fillStyle = 'rgba(255,90,90,0.22)'; ctx.beginPath(); ctx.moveTo(X(0), Y(0)); ctx.lineTo(X(R * 1.2 * Math.cos(d / 2)), Y(R * 1.2 * Math.sin(d / 2))); ctx.lineTo(X(R * 1.2 * Math.cos(d / 2)), Y(-R * 1.2 * Math.sin(d / 2))); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#ff7a7a'; ctx.lineWidth = 1.5; for (const sg of [-1, 1]) { ctx.beginPath(); ctx.moveTo(X(0), Y(0)); ctx.lineTo(X(R * 1.3 * Math.cos(d / 2)), Y(sg * R * 1.3 * Math.sin(d / 2))); ctx.stroke(); }
    ctx.fillStyle = '#ff9a9a'; ctx.font = '11px system-ui,sans-serif'; ctx.fillText('removed wedge', X(2.2), Y(0.3));
    const rp = rayPoints(mode.b, d, R, Math.min(1, mode.t)), cols = ['#ffd24a', '#5ee1ff'];
    [rp.up, rp.down].forEach((pts, k) => { ctx.strokeStyle = cols[k]; ctx.lineWidth = 2; let prevCont = false; ctx.beginPath(); pts.forEach((p, i) => { const f = p[2]; if (i === 0 || f !== prevCont) { if (f) { ctx.stroke(); ctx.beginPath(); ctx.setLineDash([5, 4]); } ctx.moveTo(X(p[0]), Y(p[1])); } else ctx.lineTo(X(p[0]), Y(p[1])); prevCont = f; }); ctx.stroke(); ctx.setLineDash([]);
      const e = pts[pts.length - 1]; ctx.fillStyle = cols[k]; ctx.beginPath(); ctx.arc(X(e[0]), Y(e[1]), 4, 0, 2 * Math.PI); ctx.fill(); });
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(X(0), Y(0), 5, 0, 2 * Math.PI); ctx.fill(); ctx.fillText('m', X(0) - 14, Y(0) - 6);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(X(rp.hit.x), Y(mode.b), 5, 0, 2 * Math.PI); ctx.stroke(); ctx.beginPath(); ctx.arc(X(rp.hit.x), Y(-mode.b), 5, 0, 2 * Math.PI); ctx.stroke();
    ctx.fillStyle = '#cfd6ea'; ctx.fillText('rays meet at x = b/tan(\u03b4/2) = ' + rp.hit.x.toFixed(3), X(rp.hit.x) - 70, Y(mode.b) - 10);
    for (const p of mode.rest) { ctx.fillStyle = '#9dff7a'; ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), 4, 0, 2 * Math.PI); ctx.fill(); }
    ctx.fillStyle = '#cfd6ea'; ctx.font = '12px system-ui,sans-serif'; ctx.fillText('unrolled plane: geodesics are straight lines', 8, 16);
  }
  function drawCone(c, mode) {
    const { ctx, w, h } = c; ctx.clearRect(0, 0, w, h); ctx.fillStyle = '#0b0f1a'; ctx.fillRect(0, 0, w, h);
    const d = mode.deficit(), k = (2 * Math.PI - d) / (2 * Math.PI), S = 11, hgt = S * Math.sqrt(1 - k * k), sc = Math.min(0.42 * w / (S * k), (h - 70) / (S * Math.sqrt(1 - k * k) + 0.32 * S * k));
    const ax = w / 2, ay = 30, P = (s, th) => { const rho = s * k * sc; return [ax + rho * Math.cos(th), ay + (s * Math.sqrt(1 - k * k)) * sc * 1.0 + rho * Math.sin(th) * 0.32]; };
    // cone: rim ellipse + generators
    ctx.strokeStyle = '#59627d'; ctx.lineWidth = 1; ctx.beginPath(); for (let i = 0; i <= 90; i++) { const p = P(S, i / 90 * 2 * Math.PI); (i ? ctx.lineTo : ctx.moveTo).call(ctx, p[0], p[1]); } ctx.stroke();
    for (let i = 0; i < 16; i++) { const th = i / 16 * 2 * Math.PI, p = P(S, th); ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(p[0], p[1]); ctx.strokeStyle = 'rgba(89,98,125,0.5)'; ctx.stroke(); }
    ctx.strokeStyle = '#ff7a7a'; ctx.lineWidth = 2; ctx.beginPath(); const sm = P(S, 0); ctx.moveTo(ax, ay); ctx.lineTo(sm[0], sm[1]); ctx.stroke(); ctx.fillStyle = '#ff9a9a'; ctx.font = '11px system-ui,sans-serif'; ctx.fillText('seam (glued edges)', sm[0] - 100, sm[1] + 14);
    const rp = rayPoints(mode.b, d, S * 0.95, Math.min(1, mode.t)), cols = ['#ffd24a', '#5ee1ff'], toTh = (psi) => { let q = psi; if (q < d / 2 - 1e-12) q += 2 * Math.PI; return (q - d / 2) * 2 * Math.PI / (2 * Math.PI - d); };
    [rp.up, rp.down].forEach((pts, kk) => { ctx.strokeStyle = cols[kk]; ctx.lineWidth = 2; ctx.beginPath(); let first = true, last = null;
      for (const p of pts) { const s = Math.hypot(p[0], p[1]), th = toTh(Math.atan2(p[1], p[0])), q = P(Math.min(s, S), th); if (first || (last !== null && Math.abs(th - last) > Math.PI)) { ctx.moveTo(q[0], q[1]); first = false; } else ctx.lineTo(q[0], q[1]); last = th; }
      ctx.stroke(); const e = pts[pts.length - 1], q = P(Math.min(Math.hypot(e[0], e[1]), S), toTh(Math.atan2(e[1], e[0]))); ctx.fillStyle = cols[kk]; ctx.beginPath(); ctx.arc(q[0], q[1], 4, 0, 2 * Math.PI); ctx.fill(); });
    const hp = P(rp.hit.radial, 0); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(hp[0], hp[1], 5, 0, 2 * Math.PI); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ax, ay, 5, 0, 2 * Math.PI); ctx.fill(); ctx.fillText('m', ax + 8, ay + 4);
    ctx.fillStyle = '#cfd6ea'; ctx.font = '12px system-ui,sans-serif'; ctx.fillText('the cone (gluing the wedge edges)', 8, h - 10);
    ctx.fillText('crossing at distance b/sin(\u03b4/2) = ' + rp.hit.radial.toFixed(3) + ' from m', 8, h - 26);
  }
  root.GLCone = { ConeMode, drawPlane, drawCone };
})(typeof self !== 'undefined' ? self : this);
