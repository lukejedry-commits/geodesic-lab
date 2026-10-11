#!/usr/bin/env node
// STEP 3 TEST TOOL (never part of the engine): re-integrates an L != 0 massive plunge with the SAME RK4 / 'r32+L' step logic as src/engine.js,
// but with the STATE (r, rdot, phi) stored and stepped in double-double (test/dd.js). The 64-bit engine runs in lock-step for comparison.
// Usage: node test/shadow_dd.js --case r4_inward|r5_inward --eta 2e-4 [--step step3_shadow]   (one process per case/eta; output JSON in results/<step>/runs/)
'use strict';
const fs = require('fs'), path = require('path');
const GE = require('../src/engine.js'), D = require('./dd.js');
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const CURVES = args.indexOf('--curves') >= 0; // step 8: also write windowed per-step residual curves (shadow, 64-bit DD, 64-bit plain) vs T and r
const CASE = opt('case', 'r4_inward'), ETA = +opt('eta', '2e-4'), STEP = opt('step', 'step3_shadow');
const ref = JSON.parse(fs.readFileSync((fs.existsSync(path.join(__dirname, '..', 'spec', 'ref_values.json')) ? path.join(__dirname, '..', 'spec', 'ref_values.json') : path.join(__dirname, '..', '..', 'geodesic-lab-spec', 'ref_values.json')), 'utf8'));
const M = 1, RABS = GE.R_CUT;
const { dd, add, mul, div, neg } = D;
const L5 = ref.circular[1].L;
// step 4 addition: report-only off-peak case r=8, L=3.5. E^2 = Vmax(1+1e-4) (static r=8 launch, rdot=0, is bound: periapsis 5.97), inward start rdot = -sqrt(E^2 - V^2(8))
const V2m = (r, L_) => (1 - 2 / r) * (1 + L_ * L_ / (r * r));
const OFF = CASE === 'r8_L3p5' || CASE === 'r8_L3p5_m1e-2', MARGIN = CASE === 'r8_L3p5_m1e-2' ? 1e-2 : 1e-4;
const OFF_E = OFF ? Math.sqrt(V2m(5.25, 3.5) * (1 + MARGIN)) : undefined, OFF_V0 = OFF ? -Math.sqrt(OFF_E * OFF_E - V2m(8, 3.5)) : 0;
const [r0d, L] = CASE === 'r4_inward' ? [4 - 1e-4, 4] : (OFF ? [8, 3.5] : [5 - 1e-4, L5]);
const sc = (a, c) => mul(a, dd(c));
const hi = (a) => a[0];
function accDD(r) { const inv = div(dd(1), r), inv2 = mul(inv, inv), inv3 = mul(inv2, inv), inv4 = mul(inv2, inv2), L2 = mul(dd(L), dd(L));
  return add(add(neg(sc(inv2, M)), mul(L2, inv3)), neg(sc(mul(L2, inv4), 3 * M))); }
const phidDD = (r) => mul(dd(L), mul(div(dd(1), r), div(dd(1), r)));
function resDD(r, v, E) { // |rdot^2 + V^2 - E^2| / E^2, V^2 = (1-2M/r)(1+L^2/r^2), all double-double
  const f = add(dd(1), neg(div(dd(2 * M), r))), t = div(mul(dd(L), dd(L)), mul(r, r)), V2 = mul(f, add(dd(1), t));
  const res = add(add(mul(v, v), V2), neg(mul(dd(E), dd(E)))); return Math.abs(res[0] + res[1]) / (E * E); }
function floorOf(r, v, E) { const rr = hi(r), vv = hi(v), V2 = Math.abs((1 - 2 * M / rr) * (1 + L * L / (rr * rr))); return D.EPS * Math.max(vv * vv, V2, E * E) / (E * E); }
// the engine's step rule, evaluated on the (hi parts of the) state; returns the step size and which limit binds
function rule(rr, vv) {
  const hs = (rr <= GE.FAR_R ? Math.pow(rr, 1.5) : Math.sqrt(GE.FAR_R) * rr) / Math.sqrt(M), hl = L !== 0 ? rr * rr / Math.abs(L) : Infinity, hv = rr / (Math.abs(vv) + 1e-300);
  const m = Math.min(hs, hl, hv); return { h: ETA * m, which: m === hs ? 'r32' : (m === hl ? 'r2_over_L' : 'r_over_rdot') };
}
function herm(x0, v0, x1, v1, h, s) { const t = s / h, t2 = t * t, t3 = t2 * t; // DD Hermite
  return add(add(sc(x0, 2 * t3 - 3 * t2 + 1), sc(v0, (t3 - 2 * t2 + t) * h)), add(sc(x1, -2 * t3 + 3 * t2), sc(v1, (t3 - t2) * h))); }
function hermRootHi(x0, v0, x1, v1, h, target) { const H = (s) => { const t = s / h, t2 = t * t, t3 = t2 * t; return (2 * t3 - 3 * t2 + 1) * x0 + (t3 - 2 * t2 + t) * h * v0 + (-2 * t3 + 3 * t2) * x1 + (t3 - t2) * h * v1; };
  let lo = 0, hi_ = h, flo = x0 - target; for (let i = 0; i < 100; i++) { const mid = 0.5 * (lo + hi_), fm = H(mid) - target; if ((fm > 0) === (flo > 0)) { lo = mid; flo = fm; } else hi_ = mid; } return 0.5 * (lo + hi_); }

// one DD RK4 step from DD state; returns new DD state (and stage info)
function stepDD(S, h) {
  const r0 = S.r, v0 = S.v, p0 = S.p, hh = dd(h), h6 = div(dd(h), dd(6));
  const a0 = accDD(r0), f0 = phidDD(r0);
  let r = add(r0, sc(v0, 0.5 * h)), v = add(v0, sc(a0, 0.5 * h)); const a1 = accDD(r), f1 = phidDD(r), v1 = v, r2 = r, vs2 = v;
  r = add(r0, sc(v1, 0.5 * h)); v = add(v0, sc(a1, 0.5 * h)); const a2 = accDD(r), f2 = phidDD(r), v2 = v, r3 = r, vs3 = v;
  r = add(r0, mul(hh, v2)); v = add(v0, mul(hh, a2)); const a3 = accDD(r), f3 = phidDD(r), v3 = v, r4 = r, vs4 = v;
  const sv = add(add(v0, sc(v1, 2)), add(sc(v2, 2), v3)), sa = add(add(a0, sc(a1, 2)), add(sc(a2, 2), a3)), sf = add(add(f0, sc(f1, 2)), add(sc(f2, 2), f3));
  return { r: add(r0, mul(h6, sv)), v: add(v0, mul(h6, sa)), p: add(p0, mul(h6, sf)), a0, aN: null, f0, stages: { r2, vs2, r3, vs3, r4, vs4, a0, a1, a2, a3 } };
}
// the same step in plain doubles (engine arithmetic, copied operation for operation from stepRK4 for a massive body) from a double state
function stepD(r0, v0, h) {
  const acc = (r) => GE.accMassive(r, L, M);
  const a0 = acc(r0); let r = r0 + 0.5 * h * v0, v = v0 + 0.5 * h * a0; const a1 = acc(r), v1 = v, r2 = r, vs2 = v;
  r = r0 + 0.5 * h * v1; v = v0 + 0.5 * h * a1; const a2 = acc(r), v2 = v, r3 = r, vs3 = v;
  r = r0 + h * v2; v = v0 + h * a2; const a3 = acc(r), v3 = v, r4 = r, vs4 = v;
  return { r: r0 + h / 6 * (v0 + 2 * v1 + 2 * v2 + v3), v: v0 + h / 6 * (a0 + 2 * a1 + 2 * a2 + a3), stages: { r2, vs2, r3, vs3, r4, vs4, a0, a1, a2, a3 } };
}

function run() {
  const eng = GE.launchState('massive', OFF ? { r: r0d, rdot: OFF_V0, L, E: OFF_E, eta: ETA, method: 'rk4' } : { r: r0d, rdot: 0, L, eta: ETA, method: 'rk4' }); // default rule r32+L
  if (GE.getStepRule() !== 'r32+L') throw new Error('engine default rule is not r32+L');
  const E = eng.E;
  let S = { r: dd(r0d), v: dd(OFF ? OFF_V0 : 0), p: dd(0) }; let tau = 0;
  const dec = {}, lim = {}, ser = []; let n = 0, first = { shadow: null, bit64: null }, diag = null;
  const curves = [], cw = { n: 0, sh: 0, dd: 0, pl: 0, fl: 0 };
  const win = { n: 0, dr: 0, dv: 0, dp: 0, rmax: 0 };
  let prevEng = { r: eng.r, rdot: eng.rdot, phi: eng.phi }, landed = false;
  const dk = (rr) => Math.floor(Math.log10(Math.max(rr, 1e-3)));
  while (eng.alive) {
    const rr = hi(S.r), vv = hi(S.v), k = dk(rr), R = rule(rr, vv), h = R.h;
    const preEng = { r: eng.r, rdot: eng.rdot, phi: eng.phi };
    GE.stepRK4(eng); n++;
    // shadow step with the same h (engine's h computed from ITS double state: use the shadow's own state-derived h; the two agree to ~1e-16)
    let N = stepDD(S, h);
    const aN = accDD(N.r); let rN = N.r, vN = N.v, pN = N.p, landedNow = false;
    if (hi(rN) < RABS) { // land exactly on the cutoff by cubic Hermite (DD arithmetic), as the engine does in doubles
      const fN = phidDD(rN), s = hermRootHi(hi(S.r), hi(S.v), hi(rN), hi(vN), h, RABS);
      vN = herm(S.v, N.a0, vN, aN, h, s); pN = herm(S.p, N.f0, pN, fN, h, s); rN = dd(RABS); landedNow = true; tau += s;
    } else tau += h;
    S = { r: rN, v: vN, p: pN };
    // residuals
    const rs = resDD(S.r, S.v, E), re = D.residualDD(eng), fl = floorOf(S.r, S.v, E);
    const d = dec[k] || (dec[k] = { decade: k, steps: 0, hSum: 0, ddShadowMax: 0, dd64Max: 0, floorMax: 0, dR: 0, dRrel: 0, dVrel: 0, dP: 0, dPrel: 0, cumStepsAtEnd: 0, binds: { r32: 0, r2_over_L: 0, r_over_rdot: 0 } });
    d.steps++; d.hSum += h; d.binds[R.which]++; d.cumStepsAtEnd = n;
    if (rs > d.ddShadowMax) d.ddShadowMax = rs; if (re > d.dd64Max) d.dd64Max = re; if (fl > d.floorMax) d.floorMax = fl;
    if (CURVES) { const pl = GE.residual(eng); cw.n++; cw.sh = Math.max(cw.sh, rs); cw.dd = Math.max(cw.dd, re); cw.pl = Math.max(cw.pl, pl); cw.fl = Math.max(cw.fl, fl);
      if (cw.n >= 40) { curves.push([eng.T, eng.r, cw.sh, cw.dd, cw.pl, cw.fl]); cw.n = 0; cw.sh = cw.dd = cw.pl = cw.fl = 0; } }
    // trajectory difference, 64-bit engine minus shadow (double-double difference, same step index)
    const dr = Math.abs(add(dd(eng.r), neg(S.r))[0]), dv = Math.abs(add(dd(eng.rdot), neg(S.v))[0]), dp = Math.abs(add(dd(eng.phi), neg(S.p))[0]);
    const drr = dr / hi(S.r), dvr = dv / Math.max(Math.abs(hi(S.v)), 1e-3), dpr = dp / Math.max(Math.abs(hi(S.p)), 1);
    if (dr > d.dR) d.dR = dr; if (drr > d.dRrel) d.dRrel = drr; if (dvr > d.dVrel) d.dVrel = dvr; if (dp > d.dP) d.dP = dp; if (dpr > d.dPrel) d.dPrel = dpr;
    win.n++; win.dr = Math.max(win.dr, drr); win.dv = Math.max(win.dv, dvr); win.dp = Math.max(win.dp, dpr);
    if (win.n >= 200) { ser.push([n, hi(S.r), win.dr, win.dv, win.dp]); win.n = 0; win.dr = win.dv = win.dp = 0; }
    // first exceed of 1e-10
    if (first.shadow === null && rs > 1e-10) first.shadow = { step: n, r: rr, tau, residual: rs };
    if (first.bit64 === null && re > 1e-10) {
      first.bit64 = { step: n, rStart: preEng.r, rEnd: eng.r, tau: eng.par, residual: re, residualBefore: n > 1 ? prevRes : 0 };
      // which RK4 stage / quantity: redo THIS step from the 64-bit pre-state in doubles and in double-double (pre-state treated exact)
      const hD = ETA * Math.min(...[((preEng.r <= GE.FAR_R ? Math.pow(preEng.r, 1.5) : Math.sqrt(GE.FAR_R) * preEng.r)), preEng.r * preEng.r / Math.abs(L), preEng.r / (Math.abs(preEng.rdot) + 1e-300)]);
      const dD = stepD(preEng.r, preEng.rdot, hD), dX = stepDD({ r: dd(preEng.r), v: dd(preEng.rdot), p: dd(preEng.phi) }, hD);
      const rel = {}; for (const key of ['r2', 'vs2', 'r3', 'vs3', 'r4', 'vs4', 'a0', 'a1', 'a2', 'a3']) { const x = dX.stages[key], y = dD.stages[key]; rel[key] = Math.abs(add(dd(y), neg(x))[0]) / Math.max(Math.abs(x[0]), 1e-300); }
      const relFinal = { r: Math.abs(add(dd(dD.r), neg(dX.r))[0]) / Math.abs(dX.r[0]), rdot: Math.abs(add(dd(dD.v), neg(dX.v))[0]) / Math.max(Math.abs(dX.v[0]), 1e-300) };
      diag = { step: n, hD, preStateResidualDD: resDD(dd(preEng.r), dd(preEng.rdot), E),
        postResidualDouble_stepD: resDD(dd(dD.r), dd(dD.v), E), postResidualDD_stepDD: resDD(dX.r, dX.v, E),
        stageRelDiff_double_vs_DD: rel, finalRelDiff: relFinal, note: 'step redone from the 64-bit pre-state: double arithmetic (engine ops) vs double-double arithmetic of the same RK4 step' };
    }
    var prevRes = re;
    if (landedNow) { landed = true; break; }
  }
  if (CURVES && cw.n > 0) curves.push([eng.T, eng.r, cw.sh, cw.dd, cw.pl, cw.fl]);
  const decades = Object.values(dec).sort((a, b) => a.decade - b.decade);
  return { case: CASE, eta: ETA, E, L, steps: n, tauEnd: tau, engine: { steps: eng.steps, reason: eng.reason, tau: eng.par }, decades, firstExceed: first, stepDiag: diag, curves,
    shadowMax: Math.max(...decades.map((d) => d.ddShadowMax)), bit64Max: Math.max(...decades.map((d) => d.dd64Max)), series: ser };
}
const out = run();
const dir = path.join(__dirname, '..', 'results', STEP, 'runs'); fs.mkdirSync(dir, { recursive: true });
const f = path.join(dir, `${CASE}_eta${ETA}.json`); if (fs.existsSync(f)) { console.error('refusing to overwrite ' + f); process.exit(2); }
if (CURVES) { fs.writeFileSync(f.replace('.json', '_curves.json'), JSON.stringify({ case: out.case, eta: out.eta, E: out.E, L: out.L, columns: ['T', 'r', 'shadowDD', 'bit64DD', 'bit64plain', 'floor'], curves: out.curves })); delete out.curves; }
fs.writeFileSync(f, JSON.stringify(out));
console.log(CASE, ETA, 'steps', out.steps, 'engine steps', out.engine.steps, 'shadow max', out.shadowMax, '64-bit max', out.bit64Max);
