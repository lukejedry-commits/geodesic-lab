// Geodesic Lab v1: analysis helpers used by the tests (periapsis finding, deflection, split-metric rays). 64-bit only.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine.js'));
  else root.GeodesicAnalysis = factory(root.GeodesicEngine);
})(typeof self !== 'undefined' ? self : this, function (GE) {
  'use strict';
  const { herm, hermRoot } = GE;

  // Periapsis (rdot zero crossing, - to +) inside the step prev -> body, by CUBIC Hermite interpolation of rdot(tau)
  // (values rdot and rddot at both ends); then r and phi at the root by cubic Hermite as well.
  function periapsisInStep(b) {
    const p = b.prev, h = p.h, L = b.L, M = b.M;
    const acc1 = b.kind === 'massive' ? GE.accMassive(b.r, L, M) : GE.accLight(b.r, L, M);
    if (!(p.rdot < 0 && b.rdot >= 0)) return null;
    const s = hermRoot(p.rdot, p.acc, b.rdot, acc1, h, 0);
    return { s, par: b.par - h + s, r: herm(p.r, p.rdot, b.r, b.rdot, h, s), phi: herm(p.phi, L / (p.r * p.r), b.phi, L / (b.r * b.r), h, s),
             T: null };
  }
  // value of Hermite r/phi at the point where r crosses a target radius inside the last step
  function crossingInStep(b, target) {
    const p = b.prev, h = p.h, L = b.L, s = hermRoot(p.r, p.rdot, b.r, b.rdot, h, target);
    return { s, phi: herm(p.phi, L / (p.r * p.r), b.phi, L / (b.r * b.r), h, s), par: b.par - h + s };
  }

  // windowed-max recorder: keeps the MAX residual of every `every` steps (point sampling could miss peaks)
  function winRec(every) { return { every, n: 0, m: 0, out: [], push(T, res, extra) { if (res > this.m) this.m = res; if (++this.n >= this.every) { this.out.push(extra === undefined ? [T, this.m] : [T, this.m, extra]); this.n = 0; this.m = 0; } } }; }

  // Gauss-Legendre nodes/weights on [-1, 1]
  function gl(n) {
    const x = new Array(n), w = new Array(n);
    for (let i = 0; i < n; i++) {
      let z = Math.cos(Math.PI * (i + 0.75) / (n + 0.5)), pp = 0;
      for (let it = 0; it < 100; it++) {
        let p1 = 1, p2 = 0;
        for (let j = 1; j <= n; j++) { const p3 = p2; p2 = p1; p1 = ((2 * j - 1) * z * p2 - (j - 1) * p3) / j; }
        pp = n * (z * p1 - p2) / (z * z - 1);
        const dz = p1 / pp; z -= dz; if (Math.abs(dz) < 1e-16) break;
      }
      x[i] = z; w[i] = 2 / ((1 - z * z) * pp * pp);
    }
    return { x, w };
  }
  const GL = gl(64);
  // Angle swept by an exact Schwarzschild null geodesic from radius R out to infinity: int_0^{1/R} du / sqrt(1/b^2 - u^2 + 2 M u^3)
  // (R >> b only; smooth integrand, 64-point Gauss-Legendre). Used to close the finite-radius integration ONLY outside R.
  function tailAngle(b, R, M) {
    const u1 = 1 / R; let sum = 0;
    for (let i = 0; i < GL.x.length; i++) { const u = 0.5 * u1 * (GL.x[i] + 1); sum += GL.w[i] * 0.5 * u1 / Math.sqrt(1 / (b * b) - u * u + 2 * M * u * u * u); }
    return sum;
  }

  // Light from far away with impact parameter b: RK4 until it comes back out to Rs.
  // deflection = (phi swept between Rs and Rs, by RK4) + 2 tail(Rs) - pi. r_min by cubic interpolation of the rdot zero crossing.
  function lightDeflection(bImp, o) {
    o = o || {};
    const M = 1, Rs = o.Rs || Math.max(1e5, 1e3 * bImp), eta = o.eta;
    const sf = Math.sqrt(1 - 2 * M / Rs);
    const alpha = Math.PI - Math.asin(bImp * sf / Rs); // ingoing
    const body = GE.launchLight({ r: Rs, phi: 0, alpha, eta, M });
    let rmin = null, phiOut = null, maxRes = 0, steps = 0, captured = false, esc1000 = false, passed = false;
    const rec = o.record ? winRec(o.every || 20) : null;
    while (body.alive && steps < 5e7) {
      const ok = GE.stepRK4(body); steps++;
      if (!ok) break;
      const res = GE.residual(body); if (res > maxRes) maxRes = res;
      if (rec) rec.push(body.T, res);
      if (!passed) { const pe = periapsisInStep(body); if (pe) { rmin = pe.r; passed = true; } }
      if (passed && body.r > 1000) esc1000 = true;
      if (body.r < 2 * M) captured = true;
      if (passed && body.r >= Rs) { const c = crossingInStep(body, Rs); phiOut = c.phi; break; }
    }
    const out = { b: bImp, Rs, eta, steps, rmin, captured, esc1000, maxResidual: maxRes, reason: body.reason, alive: body.alive, rec: rec && rec.out };
    if (phiOut !== null) { out.dphi = phiOut; out.deflection = phiOut + 2 * tailAngle(bImp, Rs, M) - Math.PI; }
    return out;
  }

  // Precession: bound orbit launched at periapsis with (E, L) from the reference file, velocity Verlet.
  // shift per radial period = mean over N periods of (phi_peri,k+1 - phi_peri,k) - 2 pi  (periapsis = cubic-Hermite rdot zero crossing).
  function precession(rp, E, L, o) {
    o = o || {};
    const N = o.periods || 20, eta = o.eta;
    const body = GE.launchState('massive', { r: rp, rdot: 0, L, E, eta, phi: 0, method: 'verlet' });
    const periP = [{ par: 0, phi: 0, T: 0 }];
    const resPer = []; let maxRes = 0, curMax = 0; let steps = 0;
    const rec = o.record ? winRec(o.every || 5000) : null;
    while (periP.length <= N && steps < 5e8) {
      GE.stepVerlet(body); steps++;
      const res = GE.residual(body); if (res > curMax) curMax = res; if (res > maxRes) maxRes = res;
      if (rec) rec.push(body.T, res);
      const pe = periapsisInStep(body);
      if (pe) { periP.push({ par: pe.par, phi: pe.phi }); resPer.push(curMax); curMax = 0; }
    }
    const shift = (periP[periP.length - 1].phi - periP[0].phi) / (periP.length - 1) - 2 * Math.PI;
    return { rp, eta, dtau: body.h, N: periP.length - 1, shift, steps, maxResidual: maxRes, residualPerPeriod: resPer, rec: rec && rec.out, E: body.E, L: body.L };
  }

  // Circular (or any) orbit run of nOrbits (phi / 2 pi), returns drift and rates
  function runOrbits(body, nOrbits, o) {
    o = o || {};
    let maxDev = 0, steps = 0, maxRes = 0, minR = body.r, maxR = body.r; const r0 = body.r, p0 = body.phi, T0 = body.T, tau0 = body.par;
    const first = { done: false, dev: 0 };
    const rec = o.record ? winRec(o.every || 2000) : null;
    while (body.alive && (body.phi - p0) < nOrbits * 2 * Math.PI && steps < 5e8) {
      if (!GE.step(body)) break; steps++;
      const dev = Math.abs(body.r - r0) / r0; if (dev > maxDev) maxDev = dev;
      if (!first.done) { first.dev = maxDev; if (body.phi - p0 >= 2 * Math.PI) first.done = true; }
      const res = GE.residual(body); if (res > maxRes) maxRes = res;
      if (rec) rec.push(body.T, res);
    }
    return { steps, maxDev, firstOrbitDev: first.dev, maxResidual: maxRes, Omega: (body.phi - p0) / (body.T - T0), dtau_dT: (body.par - tau0) / (body.T - T0), alive: body.alive, rEnd: body.r, T: body.T, orbits: (body.phi - p0) / (2 * Math.PI), rec: rec && rec.out };
  }

  // Plunge / infall: integrate with RK4 until removal; per-step |T - tau|/(1+tau/M), residual, monotonic T, min r.
  function infall(r0, o) {
    o = o || {};
    const M = 1, eta = o.eta;
    const body = GE.launchState('massive', { r: r0, rdot: -Math.sqrt(2 * M / r0), L: 0, E: 1, eta, method: 'rk4' });
    let maxTT = 0, maxRes = 0, nonFinite = 0, mono = true, minR = r0, steps = 0, Tprev = 0, crossed2M = false, TatCross = null, Tbefore = null;
    const rec = o.record ? [] : null;
    while (body.alive && steps < 5e7) {
      if (body.r < GE.R_CUT) break;
      const ok = GE.stepRK4(body); steps++;
      if (!Number.isFinite(body.r + body.T + body.par + body.rdot)) { nonFinite++; break; }
      const tt = Math.abs(body.T - body.par) / (1 + body.par / M); if (tt > maxTT) maxTT = tt;
      const res = GE.residual(body); if (res > maxRes) maxRes = res;
      if (!(body.T > Tprev)) mono = false; Tprev = body.T;
      if (body.r < minR) minR = body.r;
      if (!crossed2M && body.r < 2 * M) { crossed2M = true; TatCross = body.T; }
      if (rec && steps % (o.every || 10) === 0) rec.push([body.par, body.T, res, body.r]);
      if (!ok) break;
    }
    const tauEnd = body.par, ref = (2 / 3) * (Math.pow(r0, 1.5) - Math.pow(GE.R_CUT, 1.5)) / Math.sqrt(2 * M);
    return { r0, eta, steps, tauEnd, tauRef: ref, relErr: Math.abs(tauEnd - ref) / ref, maxTminusTau: maxTT, maxResidual: maxRes, nonFinite, TmonotonicStrict: mono, minR,
      removedReason: body.reason, rEnd: body.r, crossed2M, rec };
  }

  // Split-metric weak-field rays (b >> M), integrating the orbit equation (du/dphi)^2 = (1/(b^2 A) - u^2)/B with RK4 in phi.
  // mode: 'full' (A = f, B = 1/f), 'time' (only g_tt curved: A = f, B = 1), 'space' (only g_rr curved: A = 1, B = 1/f)
  function splitDeflection(b, mode, dphi) {
    const M = 1;
    dphi = dphi || 1e-3;
    const f = (u) => 1 - 2 * M * u;
    const A = (u) => (mode === 'space' ? 1 : f(u)), B = (u) => (mode === 'time' ? 1 : 1 / f(u));
    const F = (u) => (1 / (b * b) / A(u) - u * u) / B(u);
    const dF = (u) => { const e = 1e-7 * Math.max(Math.abs(u), 1 / b); return (F(u + e) - F(u - e)) / (2 * e); };
    const acc = (u) => 0.5 * dF(u);
    let u = 0, w = Math.sqrt(F(0)), phi = 0, maxu = 0;
    let prevU = 0, prevW = w;
    while (phi < 4 * Math.PI) {
      const k1u = w, k1w = acc(u), k2u = w + 0.5 * dphi * k1w, k2w = acc(u + 0.5 * dphi * k1u), k3u = w + 0.5 * dphi * k2w, k3w = acc(u + 0.5 * dphi * k2u), k4u = w + dphi * k3w, k4w = acc(u + dphi * k3u);
      prevU = u; prevW = w;
      u += dphi / 6 * (k1u + 2 * k2u + 2 * k3u + k4u); w += dphi / 6 * (k1w + 2 * k2w + 2 * k3w + k4w); phi += dphi;
      if (u > maxu) maxu = u;
      if (u <= 0 && prevU > 0) { // linear-cubic root of u(phi) between steps
        const s = hermRoot(prevU, prevW, u, w, dphi, 0); return (phi - dphi + s) - Math.PI;
      }
    }
    return NaN;
  }

  return { winRec, periapsisInStep, crossingInStep, tailAngle, lightDeflection, precession, runOrbits, infall, splitDeflection };
});
