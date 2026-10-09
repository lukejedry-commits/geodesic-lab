// Geodesic Lab v1 engine: Schwarzschild equatorial geodesics, G = c = 1, lengths in M.
// Importable without any UI:  const GE = require('./src/engine.js');  (browser: window.GeodesicEngine)
// PRECISION (ASSERTS G): every orbit state (r, phi, rdot) and E, L, T, tau is a plain JS number (64-bit float).
// No 32-bit typed arrays exist in this file; a draw copy may only be made in src/draw.js (not part of step 1).
// Never integrates Schwarzschild t. Time shown is Painleve-Gullstrand T.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GeodesicEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const R_CUT = 0.05;       // bodies are removed at r < R_CUT (M); "GR stops here"
  const FAR_R = 100;        // RK4 step is exactly proportional to r^(3/2) for r <= FAR_R; beyond, capped to ~ r (see hscale)
  const ETA_VERLET = 0.002; // shipped default: fixed dtau = eta * r_p^(3/2) / sqrt(M)
  const ETA_RK4 = 0.0005;   // shipped default: h = eta * r^(3/2) / sqrt(M)

  // ---- potentials and accelerations (rddot = -0.5 dV^2/dr, written in cancelled closed form) --------
  const fOf = (r, M) => 1 - 2 * M / r;
  function V2massive(r, L, M) { return (1 - 2 * M / r) * (1 + L * L / (r * r)); }
  function V2light(r, L, M) { return (1 - 2 * M / r) * L * L / (r * r); }
  // d/dr V^2 massive = 2M/r^2 + 2M L^2/r^4 - 2 f L^2/r^3 ; rddot = -0.5 of that
  function accMassive(r, L, M) { const r2 = r * r; return -M / r2 + L * L / (r2 * r) - 3 * M * L * L / (r2 * r2); }
  function accLight(r, L, M) { const r2 = r * r; return L * L / (r2 * r) - 3 * M * L * L / (r2 * r2); }
  // dr/dlambda^2 = E^2 - V^2 -> residual (relative to E^2), null form drops the 1
  function residual(b) {
    const V2 = b.kind === 'massive' ? V2massive(b.r, b.L, b.M) : V2light(b.r, b.L, b.M);
    return Math.abs(b.rdot * b.rdot + V2 - b.E * b.E) / (b.E * b.E);
  }
  // Painleve-Gullstrand time rate. Outgoing: (E + sqrt(2M/r) rdot)/(1-2M/r); infalling: (1 + L^2/r^2 + rdot^2)/(E - sqrt(2M/r) rdot)
  // (algebraically identical; light drops the 1). Regular at r = 2M for infall.
  function dTdPar(kind, r, rdot, E, L, M) {
    const s = Math.sqrt(2 * M / r);
    if (rdot >= 0) return (E + s * rdot) / (1 - 2 * M / r);
    return ((kind === 'massive' ? 1 : 0) + L * L / (r * r) + rdot * rdot) / (E - s * rdot);
  }
  let STEP_RULE = 'r32'; // 'r32' = NM ruling (h proportional to r^(3/2), far-field cap). 'r32+L' = variant with extra limits (reported separately)
  function setStepRule(x) { if (x !== 'r32' && x !== 'r32+L') throw new Error('unknown step rule'); STEP_RULE = x; }
  function hscale(r, M) { // proportional to r^(3/2)/sqrt(M); far-field cap (r > FAR_R) ~ sqrt(FAR_R) r / sqrt(M) keeps it continuous
    return (r <= FAR_R ? Math.pow(r, 1.5) : Math.sqrt(FAR_R) * r) / Math.sqrt(M);
  }

  // ---- body construction ----------------------------------------------------------------------
  function criticalRadii(L, M) { // extrema of V^2: M r^2 - L^2 r + 3 M L^2 = 0 ; null if L^2 <= 12 M^2
    const D = L * L * L * L - 12 * M * M * L * L;
    if (!(D > 0)) return null;
    const q = Math.sqrt(D);
    return { rMax: (L * L - q) / (2 * M), rMin: (L * L + q) / (2 * M) }; // unstable peak, stable minimum
  }
  function periapsisOf(E, L, M, r0) { // inner turning point of a bound orbit outside the barrier (bisection), or null
    const c = criticalRadii(L, M);
    if (!c || !(E < 1) || !(r0 >= c.rMax)) return null;
    const Vmax = V2massive(c.rMax, L, M);
    if (!(E * E < Vmax)) return null;
    let lo = c.rMax, hi = Math.min(r0, c.rMin); // g(lo) = V2 - E2 > 0, g(hi) <= 0
    if (!(V2massive(hi, L, M) - E * E <= 1e-12 * E * E)) return null; // tolerance: exact circular orbits sit on the minimum
    for (let i = 0; i < 200; i++) { const mid = 0.5 * (lo + hi); if (V2massive(mid, L, M) - E * E > 0) lo = mid; else hi = mid; }
    return 0.5 * (lo + hi);
  }
  function makeBody(kind, o) {
    const M = o.M === undefined ? 1 : o.M;
    const b = { kind, M, r: o.r, phi: o.phi || 0, rdot: o.rdot, T: o.T0 || 0, par: o.par0 || 0, // par = proper time tau (massive) / affine lambda (light)
      alive: true, reason: null, steps: 0, rAbsorb: Math.max(R_CUT, o.rAbsorb || 0), rEscape: o.rEscape === undefined ? Infinity : o.rEscape,
      method: 'rk4', eta: o.eta, h: 0, rp: null };
    Object.defineProperty(b, 'E', { value: o.E, writable: false, enumerable: true, configurable: false }); // fixed at launch (ASSERTS E)
    Object.defineProperty(b, 'L', { value: o.L, writable: false, enumerable: true, configurable: false });
    Object.defineProperty(b, 'tau', { get() { return this.par; }, enumerable: false });
    if (kind === 'massive') {
      const rp = periapsisOf(o.E, o.L, M, o.r);
      if (rp !== null && o.method !== 'rk4') {
        b.method = 'verlet'; b.rp = rp;
        b.eta = o.eta === undefined ? ETA_VERLET : o.eta;
        b.h = b.eta * Math.pow(rp, 1.5) / Math.sqrt(M); // FIXED step, never changes
      }
    }
    if (b.method === 'rk4') b.eta = o.eta === undefined ? ETA_RK4 : o.eta;
    if (o.method === 'verlet' && b.method !== 'verlet') throw new Error('verlet requested for an orbit that is not bound outside the barrier');
    return b;
  }
  // UI launch mapping, local static observer: local speed components (vr outward, vt tangential), v^2 < 1, r > 2M
  function launchMassive(o) {
    const M = o.M === undefined ? 1 : o.M, vr = o.vr || 0, vt = o.vt || 0, v2 = vr * vr + vt * vt;
    if (!(o.r > 2 * M)) throw new Error('static observers exist only for r > 2M');
    if (!(v2 < 1)) throw new Error('local speed must be < 1');
    const g = 1 / Math.sqrt(1 - v2), sf = Math.sqrt(1 - 2 * M / o.r);
    return makeBody('massive', Object.assign({}, o, { M, E: g * sf, L: g * vt * o.r, rdot: g * vr * sf }));
  }
  // Light at angle alpha from the outward radial (local static observer); E = 1 (affine normalisation), b = L/E = r sin(alpha)/sqrt(1-2M/r)
  function launchLight(o) {
    const M = o.M === undefined ? 1 : o.M;
    if (!(o.r > 2 * M)) throw new Error('static observers exist only for r > 2M');
    const sf = Math.sqrt(1 - 2 * M / o.r), b = o.r * Math.sin(o.alpha) / sf;
    return makeBody('light', Object.assign({}, o, { M, E: 1, L: b, rdot: Math.cos(o.alpha) }));
  }
  // Launch from an explicit state (tests): E fixed from the state if not given
  function launchState(kind, o) {
    const M = o.M === undefined ? 1 : o.M;
    let E = o.E;
    if (E === undefined) E = Math.sqrt(o.rdot * o.rdot + (kind === 'massive' ? V2massive(o.r, o.L, M) : V2light(o.r, o.L, M)));
    return makeBody(kind, Object.assign({}, o, { M, E }));
  }

  // ---- cubic Hermite helpers (interpolation of r, phi, T, rdot inside a step) ------------------------
  function herm(x0, v0, x1, v1, h, s) { // value
    const t = s / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * x0 + (t3 - 2 * t2 + t) * h * v0 + (-2 * t3 + 3 * t2) * x1 + (t3 - t2) * h * v1;
  }
  function hermRoot(x0, v0, x1, v1, h, target) { // s in [0,h] with herm(s) = target (sign change required), bisection
    let lo = 0, hi = h, flo = x0 - target;
    for (let i = 0; i < 100; i++) { const mid = 0.5 * (lo + hi), fm = herm(x0, v0, x1, v1, h, mid) - target; if ((fm > 0) === (flo > 0)) { lo = mid; flo = fm; } else hi = mid; }
    return 0.5 * (lo + hi);
  }

  function remove(b, reason) { b.alive = false; b.reason = reason; }

  // ---- velocity Verlet, fixed dtau: only for bound orbits outside the barrier ------------------------
  function stepVerlet(b) {
    if (!b.alive) return false;
    const M = b.M, L = b.L, h = b.h, r0 = b.r, v0 = b.rdot;
    const a0 = accMassive(r0, L, M);
    const vh = v0 + 0.5 * h * a0;
    const r1 = r0 + h * vh;
    const a1 = accMassive(r1, L, M);
    const v1 = vh + 0.5 * h * a1;
    if (!(Number.isFinite(r1) && Number.isFinite(v1))) { remove(b, 'nan'); return false; }
    const p0 = b.phi;
    b.phi += 0.5 * h * (L / (r0 * r0) + L / (r1 * r1));
    b.T += 0.5 * h * (dTdPar('massive', r0, v0, b.E, L, M) + dTdPar('massive', r1, v1, b.E, L, M));
    b.par += h; b.r = r1; b.rdot = v1; b.steps++;
    b.prev = { r: r0, rdot: v0, acc: a0, phi: p0, h };
    return true;
  }

  // ---- classical RK4 on (r, rdot, phi, T): light, plunges, horizon crossings ------------------------------
  function stepRK4(b) {
    if (!b.alive) return false;
    if (b.r < b.rAbsorb) { remove(b, b.rAbsorb > R_CUT ? 'absorbed' : 'singularity'); return false; } // removed BEFORE stepping
    if (b.r > b.rEscape) { remove(b, 'escaped'); return false; }
    const M = b.M, L = b.L, E = b.E, kind = b.kind, massive = kind === 'massive';
    const acc = massive ? accMassive : accLight;
    let hs = hscale(b.r, M);
    if (STEP_RULE === 'r32+L') { // optional variant (NOT the NM ruling): also resolve the angular motion, h <= r^2/|L|, and the radial motion, h <= r/|rdot|
      const hl = b.L !== 0 ? b.r * b.r / Math.abs(b.L) : Infinity, hv = b.r / (Math.abs(b.rdot) + 1e-300);
      hs = Math.min(hs, hl, hv);
    }
    const h = b.eta * hs;
    const r0 = b.r, v0 = b.rdot, p0 = b.phi, T0 = b.T;
    const a0 = acc(r0, L, M), f0 = L / (r0 * r0), t0 = dTdPar(kind, r0, v0, E, L, M);
    // stage 2
    let r = r0 + 0.5 * h * v0, v = v0 + 0.5 * h * a0;
    const a1 = acc(r, L, M), f1 = L / (r * r), t1 = dTdPar(kind, r, v, E, L, M), v1 = v;
    // stage 3
    r = r0 + 0.5 * h * v1; v = v0 + 0.5 * h * a1;
    const a2 = acc(r, L, M), f2 = L / (r * r), t2 = dTdPar(kind, r, v, E, L, M), v2 = v;
    // stage 4
    r = r0 + h * v2; v = v0 + h * a2;
    const a3 = acc(r, L, M), f3 = L / (r * r), t3 = dTdPar(kind, r, v, E, L, M), v3 = v;
    const rN = r0 + h / 6 * (v0 + 2 * v1 + 2 * v2 + v3);
    const vN = v0 + h / 6 * (a0 + 2 * a1 + 2 * a2 + a3);
    const pN = p0 + h / 6 * (f0 + 2 * f1 + 2 * f2 + f3);
    const TN = T0 + h / 6 * (t0 + 2 * t1 + 2 * t2 + t3);
    if (!(Number.isFinite(rN) && Number.isFinite(vN) && Number.isFinite(pN) && Number.isFinite(TN))) { remove(b, 'nan'); return false; }
    const aN = acc(rN, L, M), fN = L / (rN * rN);
    b.prev = { r: r0, rdot: v0, acc: a0, phi: p0, h };
    if (rN < b.rAbsorb) { // crossed the cutoff inside this step: land exactly on it (cubic Hermite), then remove
      const s = hermRoot(r0, v0, rN, vN, h, b.rAbsorb);
      const tN = dTdPar(kind, rN, vN, E, L, M);
      b.r = b.rAbsorb; b.rdot = herm(v0, a0, vN, aN, h, s);
      b.phi = herm(p0, f0, pN, fN, h, s); b.T = herm(T0, t0, TN, tN, h, s); b.par += s; b.steps++;
      remove(b, b.rAbsorb > R_CUT ? 'absorbed' : 'singularity');
      return true;
    }
    b.r = rN; b.rdot = vN; b.phi = pN; b.T = TN; b.par += h; b.steps++;
    return true;
  }
  function step(b) { return b.method === 'verlet' ? stepVerlet(b) : stepRK4(b); }

  // ---- 2+1 cone mode (true 2+1 GR contrast): flat plane with a wedge of angle delta = 8 pi G m removed ----------
  const Cone = {
    deficit(m) { const d = 8 * Math.PI * m; if (!(d < 2 * Math.PI) || !(d > 0)) throw new Error('deficit angle must satisfy 0 < 8 pi G m < 2 pi'); return d; },
    // Unrolled plane, wedge |angle| < delta/2 removed about the +x axis (downstream). Parallel rays y = +b and y = -b travelling +x.
    // Intersect each ray with its wedge edge (generic 2x2 solve); the edges are glued by a rotation about the apex.
    // Returns x of the first meeting point (on the seam = the cone axis, in unrolled x-coordinate) and the mismatch of the two images.
    parallelRayCrossing(b, delta) {
      const hit = (y, ang) => { // ray (x, y) + t (1, 0) with edge u (cos ang, sin ang): solve x + t = u cos, y = u sin
        const u = y / Math.sin(ang); return [u * Math.cos(ang), y, u];
      };
      const P1 = hit(b, delta / 2), P2 = hit(-b, -delta / 2);
      // gluing: rotate the lower edge point by +delta about the apex -> must coincide with the upper edge point
      const c = Math.cos(delta), s = Math.sin(delta);
      const P2r = [c * P2[0] - s * P2[1], s * P2[0] + c * P2[1]];
      const mis = Math.hypot(P2r[0] - P1[0], P2r[1] - P1[1]) / Math.hypot(P1[0], P1[1]);
      return { x: P1[0], radial: P1[2], imageMismatch: mis };
    },
    // a body at rest stays at rest: positions in the unrolled plane do not change; clock rate is 1 everywhere
    restBody(x, y) { return { x, y, vx: 0, vy: 0, clockRate: 1 }; },
    stepRest(p, dt) { p.x += p.vx * dt; p.y += p.vy * dt; return p; },
  };

  return { R_CUT, FAR_R, ETA_VERLET, ETA_RK4, fOf, V2massive, V2light, accMassive, accLight, residual, dTdPar, hscale, setStepRule, getStepRule() { return STEP_RULE; }, criticalRadii, periapsisOf,
    makeBody, launchMassive, launchLight, launchState, stepVerlet, stepRK4, step, herm, hermRoot, Cone };
});
