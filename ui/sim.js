// Geodesic Lab UI: world model. ALL orbit state lives in the engine bodies (64-bit JS numbers); nothing here uses typed arrays.
// Display clock = Painleve-Gullstrand time T; each body is stepped by the engine until its own T reaches the display T.
(function (root) {
  'use strict';
  const GE = root.GeodesicEngine, REF = root.GL_REF, M = 1;
  const COLORS = ['#ffd24a', '#5ee1ff', '#ff7ab8', '#9dff7a', '#ff9a4a', '#b99bff', '#7affd9', '#ff6a6a'];
  const BCRIT = REF.b_crit;

  // ---- launch mapping (local static observer) and its inverse, for the E, L round trip --------------------------
  function invertMassive(E, L, rdot, r) { // -> local speed components and total speed
    const sf = Math.sqrt(1 - 2 * M / r), g = E / sf, vt = L / (g * r), vr = rdot / (g * sf);
    return { vr, vt, v: Math.hypot(vr, vt), alpha: Math.atan2(vt, vr) };
  }
  function invertLight(L, E, rdot, r) { // alpha from the outward radial: b = L/E = r sin(alpha)/sqrt(1-2M/r), cos(alpha) = rdot (E = 1)
    const sf = Math.sqrt(1 - 2 * M / r); return { alpha: Math.atan2(L / E * sf / r, rdot / E) };
  }

  function World() { this.T = 0; this.bodies = []; this.nextId = 1; this.ghostOn = false; this.selected = null; this.maxTrail = 6000; }
  World.prototype.clear = function () { this.bodies = []; this.selected = null; this.T = 0; this.nextId = 1; };
  World.prototype.add = function (name, kind, b, launch) {
    const id = this.nextId++, body = { id, name: name || (kind === 'light' ? 'ray ' : 'particle ') + id, kind, b, color: COLORS[(id - 1) % COLORS.length], tx: [b.r * Math.cos(b.phi)], ty: [b.r * Math.sin(b.phi)],
      launch, status: 'moving', removedNote: '', resMax: 0, crossedT: null, crossedTau: null, stepsTotal: 0, ghost: null, lastX: b.r * Math.cos(b.phi), lastY: b.r * Math.sin(b.phi) };
    const sf = Math.sqrt(1 - 2 * M / b.r);
    if (kind === 'massive') { const iv = invertMassive(b.E, b.L, b.rdot, b.r); body.launch = Object.assign({ r: b.r, phi: b.phi, E: b.E, L: b.L, rdot: b.rdot }, launch || {}, { vr: iv.vr, vt: iv.vt, v: iv.v, alpha: iv.alpha }); }
    else { const il = invertLight(b.L, b.E, b.rdot, b.r); body.launch = Object.assign({ r: b.r, phi: b.phi, E: b.E, L: b.L, rdot: b.rdot }, launch || {}, { alpha: il.alpha, vr: Math.cos(il.alpha), vt: Math.sin(il.alpha), v: 1 }); }
    body.launch.T0 = this.T;
    // Newtonian ghost from the same local launch velocity (own float64 state; display only, never feeds the relativistic body)
    const th = b.phi, c = Math.cos(th), s = Math.sin(th), l = body.launch;
    body.ghost = { x: b.r * c, y: b.r * s, vx: l.vr * c - l.vt * s, vy: l.vr * s + l.vt * c, t: this.T, alive: true, tx: [b.r * c], ty: [b.r * s] };
    this.bodies.push(body); this.selected = body; return body;
  };
  // massive particle from a local-static-observer launch: (r, phi), local speed components
  World.prototype.launchMassive = function (r, phi, vr, vt, name) {
    const b = GE.launchMassive({ r, phi, vr, vt, T0: this.T });
    return this.add(name, 'massive', b, { cmd: { r, phi, vr, vt } });
  };
  // light ray: alpha from the outward radial (local static observer)
  World.prototype.launchLight = function (r, phi, alpha, name, rEscape) {
    const b = GE.launchLight({ r, phi, alpha, T0: this.T, rEscape: rEscape === undefined ? Math.max(200, 6 * r) : rEscape });
    return this.add(name, 'light', b, { cmd: { r, phi, alpha } });
  };
  // explicit (E, L, rdot) states, used by the presets
  World.prototype.launchState = function (kind, o, name) {
    const b = GE.launchState(kind, Object.assign({ T0: this.T }, o));
    return this.add(name, kind, b, { cmd: { state: true } });
  };

  function pushTrail(w, body, x, y) {
    const d = Math.hypot(x - body.lastX, y - body.lastY), r = Math.hypot(x, y);
    if (d > Math.max(0.004, 0.003 * r)) { body.tx.push(x); body.ty.push(y); body.lastX = x; body.lastY = y; if (body.tx.length > w.maxTrail) { body.tx.splice(0, 1000); body.ty.splice(0, 1000); } }
  }
  function stepGhost(g, Tt) {
    while (g.alive && g.t < Tt) {
      const r = Math.hypot(g.x, g.y), h = Math.min(Tt - g.t, 0.01 * Math.pow(Math.max(r, 0.05), 1.5) + 1e-6);
      let a = -M / (r * r * r); g.vx += 0.5 * h * a * g.x; g.vy += 0.5 * h * a * g.y; g.x += h * g.vx; g.y += h * g.vy;
      const r2 = Math.hypot(g.x, g.y); a = -M / (r2 * r2 * r2); g.vx += 0.5 * h * a * g.x; g.vy += 0.5 * h * a * g.y; g.t += h;
      const d = Math.hypot(g.x - g.tx[g.tx.length - 1], g.y - g.ty[g.ty.length - 1]); if (d > Math.max(0.004, 0.003 * r2)) { g.tx.push(g.x); g.ty.push(g.y); }
      if (r2 < GE.R_CUT || r2 > 1e5) g.alive = false;
    }
  }
  // advance the display clock by dT; returns the number of engine steps taken
  World.prototype.advance = function (dT, cap) {
    cap = cap || 120000; const Tt = this.T + dT; let used = 0, lag = Tt;
    for (const bd of this.bodies) {
      const b = bd.b; let n = 0;
      while (b.alive && b.T < Tt && used < cap) {
        const rBefore = b.r;
        if (!GE.step(b)) break;
        n++; used++;
        if (bd.crossedT === null && b.r < 2 * M) { bd.crossedT = b.T; bd.crossedTau = b.par; }
        if (b.kind === 'massive' || b.kind === 'light') { pushTrail(this, bd, b.r * Math.cos(b.phi), b.r * Math.sin(b.phi)); }
        if (rBefore > 1 && b.r <= 1) { /* below r = 1M: documented-limit region */ }
      }
      bd.stepsTotal += n;
      if (b.alive) { if (b.T < Tt) lag = Math.min(lag, b.T); }
      else if (bd.status === 'moving') {
        bd.status = b.reason; const x = b.r * Math.cos(b.phi), y = b.r * Math.sin(b.phi); bd.tx.push(x); bd.ty.push(y); bd.endX = x; bd.endY = y;
        bd.removedNote = b.reason === 'singularity' ? 'reached the singularity: GR stops here' : (b.reason === 'absorbed' ? 'absorbed by the star surface' : (b.reason === 'escaped' ? 'left the view region (escaped)' : String(b.reason)));
      }
      if (this.ghostOn || bd.ghost.tx.length > 1) stepGhost(bd.ghost, Math.min(Tt, lag));
    }
    this.T = lag; return used;
  };
  // constraint residual of a body (display of conservation): |rdot^2 + V^2 - E^2| / E^2
  World.prototype.residual = function (bd) { return GE.residual(bd.b); };

  // ---- presets (values from spec/ref_values.json via ui/ref_values.js) --------------------------------------------
  const C = (r) => REF.circular.find((c) => c.r === r);
  const PRESETS = [
    { id: 'circ6', label: 'Circular orbit r = 6M (ISCO)', viewR: 9, speed: 8, run(w) { const c = C(6); w.launchState('massive', { r: 6, rdot: 0, L: c.L, E: c.E }, 'circular r=6'); } },
    { id: 'circ8', label: 'Circular orbit r = 8M', viewR: 12, speed: 10, run(w) { const c = C(8); w.launchState('massive', { r: 8, rdot: 0, L: c.L, E: c.E }, 'circular r=8'); } },
    { id: 'circ10', label: 'Circular orbit r = 10M', viewR: 14, speed: 12, run(w) { const c = C(10); w.launchState('massive', { r: 10, rdot: 0, L: c.L, E: c.E }, 'circular r=10'); } },
    { id: 'ecc', label: 'Eccentric orbit (rp, ra) = (10, 20)M: precession', viewR: 26, speed: 25, run(w) { const p = REF.precession.find((q) => q.r_p === 10 && q.r_a === 20); w.launchState('massive', { r: 10, rdot: 0, L: p.L, E: p.E }, 'eccentric 10/20'); } },
    { id: 'lightb6', label: 'Light, impact parameter b = 6M', viewR: 30, speed: 14, run(w) { const R0 = 40, b = 6; w.launchState('light', { r: R0, phi: Math.PI, rdot: -Math.sqrt(1 - GE.V2light(R0, b, M)), L: b, E: 1, rEscape: 46 }, 'light b=6'); } },
    { id: 'lightb1000', label: 'Light, impact parameter b = 1000M (weak field)', viewR: 1700, speed: 220, run(w) { const R0 = 1500, b = 1000; w.launchState('light', { r: R0, phi: Math.PI, rdot: -Math.sqrt(1 - GE.V2light(R0, b, M)), L: b, E: 1, rEscape: 1520 }, 'light b=1000'); } },
    { id: 'infall6', label: 'Infall from 6M (E = 1, as if from rest at infinity)', viewR: 8, speed: 2, run(w) { w.launchState('massive', { r: 6, phi: 0, rdot: -Math.sqrt(2 * M / 6), L: 0, E: 1 }, 'infall from 6M'); } },
    { id: 'photon', label: 'Near photon sphere (unstable): b = b_crit (1 -/+ 1e-3)', viewR: 6, speed: 1.6, run(w) {
      for (const [s, nm] of [[-1, 'b below b_crit (falls in)'], [1, 'b above b_crit (bounces)']]) { const b = BCRIT * (1 + s * 1e-3), R0 = 3.5; w.launchState('light', { r: R0, phi: 0, rdot: -Math.sqrt(1 - GE.V2light(R0, b, M)), L: b, E: 1, rEscape: 20 }, nm); } } },
  ];

  root.GLSim = { World, PRESETS, invertMassive, invertLight, BCRIT, M };
})(typeof self !== 'undefined' ? self : this);
