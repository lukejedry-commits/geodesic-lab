#!/usr/bin/env node
// Geodesic Lab v1: headless runner for EVERY assert in geodesic-lab-spec/ASSERTS.md (sections A-H).
// Usage: node test/run_asserts.js [--step step1_core] [--baseline path/to/previous/asserts.json] [--spec spec]  (default: ./spec, a verbatim copy of the frozen spec docs)
// Prints, for every assert, the measured value next to its threshold and PASS/FAIL (table), writes
// results/<step>/asserts.json (raw values), asserts.txt, series/*.json (for the plots). Exit code 1 on any FAIL.
// Never overwrites: refuses to run if results/<step>/asserts.json exists.
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const GE = require('../src/engine.js'), AN = require('../src/analysis.js'), DD = require('./dd.js');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const ROOT = path.join(__dirname, '..');
const STEP = opt('step', 'step1_core');
const SPEC = path.resolve(opt('spec', (fs.existsSync(path.join(ROOT, 'spec', 'ASSERTS.md')) ? path.join(ROOT, 'spec') : path.join(ROOT, '..', 'geodesic-lab-spec'))));
const OUT = path.join(ROOT, 'results', STEP);
if (fs.existsSync(path.join(OUT, 'asserts.json'))) { console.error('refusing to overwrite ' + OUT + '/asserts.json (use a new --step name)'); process.exit(2); }
fs.mkdirSync(path.join(OUT, 'series'), { recursive: true });
const ref = JSON.parse(fs.readFileSync(path.join(SPEC, 'ref_values.json'), 'utf8'));
const M = 1;
const checks = [], series = {}, info = { engine: { ETA_VERLET: GE.ETA_VERLET, ETA_RK4: GE.ETA_RK4, R_CUT: GE.R_CUT, FAR_R: GE.FAR_R }, notes: [] };
const fmt = (x) => (typeof x === 'number' ? (Number.isFinite(x) ? (Math.abs(x) >= 1e4 || (Math.abs(x) < 1e-3 && x !== 0) ? x.toExponential(3) : String(+x.toPrecision(6))) : String(x)) : String(x));
function check(id, desc, measured, op, threshold, extra) {
  let pass;
  if (op === '<=') pass = measured <= threshold; else if (op === '>=') pass = measured >= threshold; else if (op === '==') pass = measured === threshold;
  else if (op === 'info') pass = null; else if (op === 'in') pass = measured >= threshold[0] && measured <= threshold[1]; else if (op === 'true') pass = measured === true;
  if (op !== 'info' && !Number.isFinite(measured) && typeof measured === 'number') pass = false;
  checks.push({ id, desc, measured, op, threshold, pass, extra: extra || null });
}
const tracked = [];
function track(b) { tracked.push({ b, E: b.E, L: b.L }); return b; }

// ================================ A. circular orbits ==========================================
{
  const refC = Object.fromEntries(ref.circular.map((c) => [c.r, c]));
  for (const r of [8, 10, 20, 100]) {
    const c = refC[r], b = track(GE.launchState('massive', { r, rdot: 0, L: c.L, E: c.E }));
    const run = AN.runOrbits(b, 100, { record: true, every: 4000 });
    series['A_circ_r' + r] = run.rec;
    check(`A.r${r}.method`, `r=${r}: integrator chosen (Verlet expected for bound outside-2M orbit)`, b.method, '==', 'verlet');
    check(`A.r${r}.dr`, `r=${r}: max |r-r0|/r0 over 100 orbits (${run.steps} steps, orbits=${fmt(run.orbits)})`, run.maxDev, '<=', 1e-6);
    check(`A.r${r}.Omega`, `r=${r}: |Omega-ref|/ref, Omega=dphi/dT (meas ${fmt(run.Omega)} ref ${fmt(c.Omega)})`, Math.abs(run.Omega - c.Omega) / c.Omega, '<=', 1e-6);
    check(`A.r${r}.dtaudT`, `r=${r}: |dtau/dT-ref|/ref (meas ${fmt(run.dtau_dT)} ref ${fmt(c.dtau_dt)})`, Math.abs(run.dtau_dT - c.dtau_dt) / c.dtau_dt, '<=', 1e-6);
  }
  // r = 4: E = 1 exactly
  const c4 = refC[4];
  { const b = track(GE.launchState('massive', { r: 4, rdot: 0, L: 4, E: 1 }));
    const run = AN.runOrbits(b, 1, { record: true, every: 200 }); series.A_circ_r4 = run.rec;
    check('A.r4.first', `r=4 (E=1 exactly, ${b.method}): first orbit max |r-r0|/r0 (orbits=${fmt(run.orbits)})`, run.firstOrbitDev, '<=', 1e-6);
    check('A.r4.refEL', 'r=4: ref E, L equal the exact (1, 4)', Math.abs(c4.E - 1) + Math.abs(c4.L - 4), '<=', 0); }
  // kicks: r shifted by +-1e-4, rdot = 0, L unchanged, E from the state
  function plunge(kind, r, L, E0, label, stopFn, maxSteps, rec) {
    const b = track(GE.launchState('massive', { r, rdot: 0, L }));
    let steps = 0, crossed = null, res = 0; const R = rec ? AN.winRec(50) : null;
    while (b.alive && steps < (maxSteps || 5e7)) {
      if (!GE.step(b)) break; steps++;
      const rr = GE.residual(b); if (rr > res) res = rr; if (R) R.push(b.T, rr);
      if (crossed === null && b.r < 2) crossed = { orbits: b.phi / (2 * Math.PI), T: b.T, tau: b.par };
      if (stopFn(b)) break;
    }
    return { b, steps, crossed, maxResidual: res, rec: R && R.out };
  }
  { const p = plunge('m', 4 - 1e-4, 4, 1, 'r4-', (b) => b.phi > 25 * 2 * Math.PI || b.r < GE.R_CUT, 5e7, true); series.A_r4_inward = p.rec;
    check('A.r4.inward', `r=4 kick -1e-4 (${p.b.method}, E=${fmt(p.b.E)}): orbits before crossing 2M`, p.crossed ? p.crossed.orbits : Infinity, '<=', 20, { crossed: p.crossed, steps: p.steps, residualMax: p.maxResidual }); }
  { const p = plunge('m', 4 + 1e-4, 4, 1, 'r4+', (b) => b.r > 1000, 5e7, true);
    check('A.r4.outward', `r=4 kick +1e-4 (${p.b.method}, E=${fmt(p.b.E)}): max r reached (escape needs > 1000)`, p.b.r, '>=', 1000, { steps: p.steps, orbits: p.b.phi / (2 * Math.PI), minR: 'n/a' }); }
  for (const r of [5, 6]) {
    const c = refC[r], b = track(GE.launchState('massive', { r, rdot: 0, L: c.L, E: c.E }));
    const run = AN.runOrbits(b, 1, { record: true, every: 200 }); series['A_circ_r' + r] = run.rec;
    check(`A.r${r}.first`, `r=${r} (${b.method}): first orbit max |r-r0|/r0 (orbits=${fmt(run.orbits)})`, run.firstOrbitDev, '<=', 1e-6);
  }
  { const p = plunge('m', 5 - 1e-4, refC[5].L, refC[5].E, 'r5-', (b) => b.phi > 25 * 2 * Math.PI || b.r < GE.R_CUT, 5e7, true); series.A_r5_inward = p.rec;
    check('A.r5.inward', `r=5 kick -1e-4 (${p.b.method}): orbits before crossing 2M (no clamping of r)`, p.crossed ? p.crossed.orbits : Infinity, '<=', 20, { crossed: p.crossed, steps: p.steps, residualMax: p.maxResidual }); }
  // UI launch mapping at r = 20
  { const r = 20, v = Math.sqrt(M / (r - 2 * M)), b = track(GE.launchMassive({ r, vt: v, vr: 0 }));
    const run = AN.runOrbits(b, 10, { record: true, every: 500 });
    check('A.ui.launch', `UI launch r=20, v=sqrt(M/(r-2M))=${fmt(v)}: max |r-r0|/r0 over 10 orbits (${b.method})`, run.maxDev, '<=', 1e-6, { E: b.E, Eref: refC[20].E, L: b.L, Lref: refC[20].L });
    check('A.ui.EL', 'UI launch r=20: |E-Eref|/Eref and |L-Lref|/Lref (max)', Math.max(Math.abs(b.E - refC[20].E) / refC[20].E, Math.abs(b.L - refC[20].L) / refC[20].L), '<=', 1e-14); }
}

// ================================ B. eccentric orbits ==========================================
const etaD = GE.ETA_VERLET, shiftErr = {};
{
  const caseOf = (c) => `rp${c.r_p}_ra${c.r_a}`;
  const rows = [];
  for (const c of ref.precession) {
    const a = (c.r_p + c.r_a) / 2, e = (c.r_a - c.r_p) / (c.r_a + c.r_p), psemi = a * (1 - e * e);
    const run = AN.precession(c.r_p, c.E, c.L, { eta: etaD, periods: 20 });
    const err = Math.abs(run.shift - c.shift_rad) / c.shift_rad; shiftErr[caseOf(c)] = err;
    check(`B.${caseOf(c)}.shift`, `(${c.r_p},${c.r_a}) periapsis shift/period, eta=${etaD}, mean over ${run.N} periods; sim ${fmt(run.shift)} ref ${fmt(c.shift_rad)}`, err, '<=', 1e-4, { sim: run.shift, ref: c.shift_rad, eta: etaD, dtau: run.dtau, periods: run.N, method: 'cubic Hermite interpolation of the rdot (-to+) zero crossing, phi by cubic Hermite at the root' });
    // convergence pairs (eta, eta/2): step ratio and p, reported only if ratio in [1.8,2.2] and err(eta/2) >= 1e-9
    const pairs = [];
    for (const k of [1, 2]) {
      const e1 = etaD * 2 * k / 2 * (k === 1 ? 2 : 2); // k=1 -> 2*etaD ; k=2 -> 4*etaD  (coarse eta of the pair)
      const eC = etaD * Math.pow(2, k), eF = eC / 2;
      const r1 = AN.precession(c.r_p, c.E, c.L, { eta: eC, periods: 20 }), r2 = AN.precession(c.r_p, c.E, c.L, { eta: eF, periods: 20 });
      const E1 = Math.abs(r1.shift - c.shift_rad) / c.shift_rad, E2 = Math.abs(r2.shift - c.shift_rad) / c.shift_rad;
      const ratio = r1.dtau / r2.dtau;
      pairs.push({ eta: eC, etaHalf: eF, dtau: r1.dtau, dtauHalf: r2.dtau, stepRatio: ratio, err: E1, errHalf: E2, p: (ratio >= 1.8 && ratio <= 2.2 && E2 >= 1e-9) ? Math.log2(E1 / E2) : null });
    }
    rows.push({ case: caseOf(c), pairs });
    for (const [i, pr] of pairs.entries())
      check(`B.${caseOf(c)}.p${i}`, `(${c.r_p},${c.r_a}) convergence eta=${pr.eta} -> ${pr.etaHalf} (dtau ${fmt(pr.dtau)} -> ${fmt(pr.dtauHalf)}, step ratio ${fmt(pr.stepRatio)}); err ${fmt(pr.err)} -> ${fmt(pr.errHalf)}; p`, pr.p === null ? NaN : pr.p, 'in', [1.8, 2.2], pr);
    if (psemi >= 1000) { // M/p_semi <= 1e-3
      const w = 6 * Math.PI * M / psemi;
      check(`B.${caseOf(c)}.weak`, `(${c.r_p},${c.r_a}) weak field, M/p_semi=${fmt(M / psemi)}: |sim-6piM/p|/(6piM/p) (sim ${fmt(run.shift)}, formula ${fmt(w)}) vs 10 M/p`, Math.abs(run.shift - w) / w, '<=', 10 * M / psemi);
    }
  }
  info.convergenceVerlet = rows;
  info.notes.push('Weak-field formula asserted only where M/p_semi <= 1e-3: of the 5 ref cases only (1000,2000) qualifies (p_semi=1333.3); the others are strong field and are NOT asserted against 6piM/p.');
}

// ================================ C. light ======================================================
const bc = ref.b_crit;
const etaR = GE.ETA_RK4;
{
  for (const [i, c] of ref.light_deflection.entries()) {
    const r1 = AN.lightDeflection(c.b, { eta: etaR, record: true, every: 20 });
    series['C_light_b' + c.b] = r1.rec;
    const dErr = Math.abs(r1.deflection - c.deflection_rad) / c.deflection_rad, rErr = Math.abs(r1.rmin - c.r_min) / c.r_min;
    check(`C.b${fmt(c.b)}.defl`, `b=${fmt(c.b)} deflection rel err, eta=${etaR} (sim ${r1.deflection.toPrecision(12)} ref ${c.deflection_rad.toPrecision(12)}, Rs=${fmt(r1.Rs)}, ${r1.steps} steps)`, dErr, '<=', 1e-8, { sim: r1.deflection, ref: c.deflection_rad });
    check(`C.b${fmt(c.b)}.rmin`, `b=${fmt(c.b)} r_min rel err (sim ${r1.rmin.toPrecision(12)} ref ${c.r_min.toPrecision(12)}; cubic Hermite rdot zero crossing)`, rErr, '<=', 1e-8);
    check(`C.b${fmt(c.b)}.residual`, `b=${fmt(c.b)} null constraint residual max over whole RK4 path (E section)`, r1.maxResidual, '<=', 1e-10);
    // convergence: halve the step: pairs (eta_c, eta_c/2) for eta_c = 0.001 * 2^k, k = 0..4 (errors from eta = 0.0005 * 2^j, j = 0..5).
    // step ratio = eta_c/eta_c/2 = 2 (h = eta * hscale(r) at every radius); p reported (and asserted) only if err(eta_c/2) >= 1e-9
    const errAt = {}; for (let j = 0; j <= 5; j++) { const eta = etaR * Math.pow(2, j); errAt[j] = j === 0 ? dErr : (() => { const a1 = AN.lightDeflection(c.b, { eta }); return Math.abs(a1.deflection - c.deflection_rad) / c.deflection_rad; })(); }
    let firstValid = true;
    for (let k = 0; k <= 4; k++) {
      const eC = etaR * Math.pow(2, k + 1), eF = eC / 2, E1 = errAt[k + 1], E2 = errAt[k], ratio = eC / eF;
      const p = (ratio >= 1.8 && ratio <= 2.2 && E2 >= 1e-9) ? Math.log2(E1 / E2) : null;
      const pr = { eta: eC, etaHalf: eF, stepRatio: ratio, err: E1, errHalf: E2, p, rule: p === null ? 'err(eta/2) < 1e-9: no p reported' : 'ok' };
      (info.convergenceRK4 = info.convergenceRK4 || []).push(Object.assign({ b: c.b }, pr));
      // ASSERTED: the finest pair with err(eta/2) >= 1e-9 (closest to the shipped eta, above round-off). Coarser pairs are reported in convergence.json (informational).
      if (p !== null && firstValid) { firstValid = false; check(`C.b${fmt(c.b)}.p`, `b=${fmt(c.b)} convergence (finest pair above round-off) eta=${eC} -> ${eF} (step ratio ${fmt(ratio)}); err ${fmt(E1)} -> ${fmt(E2)}; p`, p, 'in', [3.6, 4.4], pr); pr.asserted = true; }
    }
    if (c.b >= 100) check(`C.b${fmt(c.b)}.weak`, `b=${fmt(c.b)} weak field: |sim-4M/b|/(4M/b) vs 10 M/b (sim ${fmt(r1.deflection)}, 4M/b ${fmt(4 / c.b)})`, Math.abs(r1.deflection - 4 / c.b) / (4 / c.b), '<=', 10 * M / c.b);
  }
  { const r = AN.lightDeflection(0.99 * bc, { eta: etaR });
    check('C.capture', `b=0.99 b_c (${fmt(0.99 * bc)}) crosses 2M (reason ${r.reason}, captured=${r.captured})`, r.captured, 'true', true);
    const e = AN.lightDeflection(1.01 * bc, { eta: etaR });
    check('C.escape', `b=1.01 b_c (${fmt(1.01 * bc)}) escapes to r > 1000 (esc1000=${e.esc1000}, r_min ${fmt(e.rmin)})`, e.esc1000, 'true', true); }
  { const r = 20, b = 6, alpha = Math.asin(b * Math.sqrt(1 - 2 * M / r) / r), body = GE.launchLight({ r, alpha, phi: 0 });
    check('C.launch', `light launch r=20, b=6: |L/E - 6|/6 (L/E=${body.L / body.E}, alpha=${fmt(alpha)})`, Math.abs(body.L / body.E - 6) / 6, '<=', 1e-12); }
  { const b = 1000, full = AN.lightDeflection(b, { eta: etaR }).deflection, t = AN.splitDeflection(b, 'time'), s = AN.splitDeflection(b, 'space'), f2 = AN.splitDeflection(b, 'full');
    const w = 2 * M / b;
    check('C.split.time', `b=1000 g_tt only curved: deflection ${t.toPrecision(8)} vs 2M/b=${w}`, Math.abs(t - w) / w, '<=', 10 * M / b);
    check('C.split.space', `b=1000 g_rr only curved: deflection ${s.toPrecision(8)} vs 2M/b=${w}`, Math.abs(s - w) / w, '<=', 10 * M / b);
    check('C.split.full', `b=1000 full metric (engine RK4 ray): ${full.toPrecision(8)} vs 4M/b=${4 / b} (u-phi integrator gives ${f2.toPrecision(8)})`, Math.abs(full - 4 / b) / (4 / b), '<=', 10 * M / b);
    check('C.split.sum', `b=1000 time part + space part = ${(t + s).toPrecision(8)} vs 4M/b=${4 / b}`, Math.abs(t + s - 4 / b) / (4 / b), '<=', 10 * M / b); }
}

// ================================ D. infall and horizon =======================================
{
  for (const [i, c] of ref.infall_tau_to_r0.entries()) {
    const r0 = c.r0, run = AN.infall(r0, { record: true, every: 20 }); series['D_infall_r' + r0] = run.rec;
    check(`D.r${r0}.tau`, `r0=${r0}: tau(r0->0.05) vs (2/3)(r0^1.5-0.05^1.5)/sqrt(2M)=${fmt(run.tauRef)} (sim ${run.tauEnd.toPrecision(12)}, ref-file tau(r0->0) ${fmt(c.tau)}; ${run.steps} steps)`, run.relErr, '<=', 1e-8);
    check(`D.r${r0}.TminusTau`, `r0=${r0}: max |T-tau|/(1+tau/M) over every step (incl. through r=2M, crossed=${run.crossed2M})`, run.maxTminusTau, '<=', 1e-10);
    check(`D.r${r0}.nan`, `r0=${r0}: non-finite states`, run.nonFinite, '==', 0);
    check(`D.r${r0}.mono`, `r0=${r0}: T strictly increasing at every step`, run.TmonotonicStrict, 'true', true);
    check(`D.r${r0}.removed`, `r0=${r0}: removed at r<0.05 (reason ${run.removedReason}); smallest r of any state (${run.minR})`, run.minR, '>=', GE.R_CUT * (1 - 1e-12));
    check(`D.r${r0}.residual`, `r0=${r0}: constraint residual max over whole path`, run.maxResidual, '<=', 1e-10);
  }
  // a removed body is never stepped again
  const b = GE.launchState('massive', { r: 0.0501, rdot: -Math.sqrt(2 / 0.0501), L: 0, E: 1, method: 'rk4' });
  let n = 0; while (b.alive && n < 100) { GE.step(b); n++; }
  const rr = b.r, stepsAt = b.steps; const again = GE.step(b);
  check('D.neverBelow', `removed body: further step() returns false and leaves r unchanged (r=${rr}, steps ${stepsAt})`, (!again && b.r === rr && b.steps === stepsAt && rr >= GE.R_CUT), 'true', true);
  // body launched already below the cut is removed before any step
  const b2 = GE.launchState('massive', { r: 0.04, rdot: -1, L: 0, E: 1, method: 'rk4' }); const ok2 = GE.step(b2);
  check('D.removeBeforeStep', 'body starting at r=0.04 < 0.05 is removed before stepping (r unchanged)', (!ok2 && !b2.alive && b2.r === 0.04 && b2.steps === 0), 'true', true);
}

// ================================ E. conservation ==============================================
{
  const refP = ref.precession;
  for (const c of refP) {
    const run = AN.precession(c.r_p, c.E, c.L, { eta: etaD, periods: 1000, record: true, every: 20000 });
    series[`E_verlet_rp${c.r_p}`] = run.rec;
    const rp = run.residualPerPeriod, first = Math.max(...rp.slice(0, 100)), last = Math.max(...rp.slice(-100));
    check(`E.rp${c.r_p}.ratio`, `Verlet (${c.r_p},${c.r_a}) 1000 periods (${run.N} found, ${run.steps} steps): max residual last 100 = ${fmt(last)} vs 2 x first 100 = ${fmt(2 * first)} (first ${fmt(first)}); measured last/first`, last / first, '<=', 2, { first, last });
    check(`E.rp${c.r_p}.abs`, `Verlet (${c.r_p},${c.r_a}) max residual over all 1000 periods`, run.maxResidual, '<=', 1e-6, { first100: first, last100: last });
    check(`E.rp${c.r_p}.periods`, `Verlet (${c.r_p},${c.r_a}) periods completed`, run.N, '>=', 1000);
  }
  // RK4 paths <= 1e-10: light (C.*.residual) and infall (D.*.residual) are asserted above in plain double (unchanged).
  // L != 0 plunges (room ruling, step 2): the residual |rdot^2 + V^2 - E^2| <= 1e-10 E^2 is graded in DOUBLE-DOUBLE arithmetic on the SAME stored
  // double state (engine state stays Float64); plain double and the round-off floor eps*max(rdot^2,|V^2|,E^2)/E^2 are posted next to it.
  const plunge = { cases: [], note: 'residual by decade of r (r at the START of each step; the final cutoff-landing state is included in the decade of the last step)' };
  const ETAS = [GE.ETA_RK4, 2e-4, 1e-4, 5e-5, 'default']; // 'default' = launched WITHOUT eta: engine default for L != 0 plunges (step 5: 1e-4)
  for (const [name, r, L] of [['r4_inward', 4 - 1e-4, 4], ['r5_inward', 5 - 1e-4, ref.circular[1].L]]) for (const eta of ETAS) {
    const b = GE.launchState('massive', eta === 'default' ? { r, rdot: 0, L, method: 'rk4' } : { r, rdot: 0, L, eta, method: 'rk4' }); const dec = {};
    if (eta === 'default') { check(`E.${name}.defaultEta`, `${name}: engine default eta for an L != 0 plunge (isPlunge=${GE.isPlunge(b.E, L, 1, r, 0)})`, b.eta, '==', 1e-4); check(`E.${name}.isPlunge`, `${name}: isPlunge at launch (1 = true)`, GE.isPlunge(b.E, L, 1, r, 0) ? 1 : 0, '==', 1); } let n = 0, mdd = 0, mpl = 0, mfl = 0, tauSum = 0;
    const R1 = AN.winRec(20), R2 = AN.winRec(20);
    const rec = (b, pr, h) => { const dd = DD.residualDD(b), pl = GE.residual(b), fl = DD.floorOf(b);
      const k = Math.floor(Math.log10(Math.max(pr, 1e-3))); const d = dec[k] || (dec[k] = { decade: k, steps: 0, ddMax: 0, plainMax: 0, floorMax: 0, hSum: 0 });
      d.steps++; d.hSum += h; if (dd > d.ddMax) d.ddMax = dd; if (pl > d.plainMax) d.plainMax = pl; if (fl > d.floorMax) d.floorMax = fl;
      if (dd > mdd) mdd = dd; if (pl > mpl) mpl = pl; if (fl > mfl) mfl = fl; R1.push(b.T, dd); R2.push(b.T, pl); };
    while (b.alive && n < 5e7) { const pr = b.r, t0 = b.par; if (!GE.step(b)) break; n++; rec(b, pr, b.par - t0); }
    plunge.cases.push({ case: name, eta, steps: n, ddMax: mdd, plainMax: mpl, floorMax: mfl, removed: b.reason, tauEnd: b.par, decades: Object.values(dec).sort((x, y) => x.decade - y.decade) });
    if (eta === GE.ETA_RK4) { series['E_rk4_' + name] = R1.out; series['E_rk4_' + name + '_plain'] = R2.out; }
    series[`E_rk4_${name}_eta${eta}`] = R1.out;
    check(`E.${name}.residualDD.eta${eta}`, `plunge ${name} eta=${eta} (${n} steps, removed: ${b.reason}): DOUBLE-DOUBLE residual max over every step to the cutoff [plain double max ${fmt(mpl)}; round-off floor max ${fmt(mfl)}]`, mdd, '<=', 1e-10, { plainDouble: mpl, floor: mfl, steps: n });
    check(`E.${name}.plain.eta${eta}`, `plunge ${name} eta=${eta}: plain-double residual (posted, not graded; floor ${fmt(mfl)})`, mpl, 'info', 1e-10);
  }
  // convergence of the double-double residual with eta, per decade, above the floor; step-ratio rule on the mean dt per decade
  plunge.convergence = [];
  for (const name of ['r4_inward', 'r5_inward']) for (let i = 0; i < 2; i++) {
    const etaC = [2e-4, 1e-4][i], etaF = etaC / 2;
    const cC = plunge.cases.find((c) => c.case === name && c.eta === etaC), cF = plunge.cases.find((c) => c.case === name && c.eta === etaF);
    for (const dC of cC.decades) {
      const dF = cF.decades.find((x) => x.decade === dC.decade); if (!dF) continue;
      const ratio = (dC.hSum / dC.steps) / (dF.hSum / dF.steps), aboveFloor = dF.ddMax >= 3 * dF.floorMax;
      const p = (ratio >= 1.8 && ratio <= 2.2 && aboveFloor) ? Math.log2(dC.ddMax / dF.ddMax) : null;
      const row = { case: name, decade: dC.decade, eta: etaC, etaHalf: etaF, meanDtRatio: ratio, ddMax: dC.ddMax, ddMaxHalf: dF.ddMax, floorHalf: dF.floorMax, aboveFloor, p, status: p !== null ? 'graded' : (aboveFloor ? 'dt ratio outside 1.8-2.2: no p' : 'at/below the round-off floor (finer residual < 3x floor): no p') };
      plunge.convergence.push(row);
      if (p !== null) check(`E.${name}.p.dec${dC.decade}.eta${etaC}`, `plunge ${name} decade 1e${dC.decade}: DD residual eta ${etaC} -> ${etaF} (mean dt ratio ${fmt(ratio)}): ${fmt(dC.ddMax)} -> ${fmt(dF.ddMax)} (floor ${fmt(dF.floorMax)}); p`, p, 'in', [3.6, 4.4], row);
    }
  }
  info.plunge = plunge;
  // E, L bitwise unchanged for every tracked body + immutability
  let bad = 0; for (const t of tracked) if (!(Object.is(t.b.E, t.E) && Object.is(t.b.L, t.L))) bad++;
  let canWrite = false; try { 'use strict'; const z = GE.launchState('massive', { r: 10, rdot: 0, L: 4 }); Object.defineProperty(z, 'x', { value: 1 }); z.E = 5; canWrite = z.E === 5; } catch (e) { canWrite = false; }
  check('E.bitwise', `E and L bitwise unchanged for all ${tracked.length} tracked bodies after their runs (changed: ${bad}); E not assignable: ${!canWrite}`, bad + (canWrite ? 1 : 0), '==', 0);
}

// ================================ F. cone mode ==================================================
{
  let worst = 0, worstImg = 0, worstRad = 0, n = 0;
  for (const m of [0.01, 0.05, 0.1, 0.2, 0.24]) for (const b of [0.3, 1, 7.5, 1000]) {
    const d = GE.Cone.deficit(m), r = GE.Cone.parallelRayCrossing(b, d), expect = b / Math.tan(d / 2);
    worst = Math.max(worst, Math.abs(r.x - expect) / expect); worstRad = Math.max(worstRad, Math.abs(r.radial - b / Math.sin(d / 2)) / (b / Math.sin(d / 2))); worstImg = Math.max(worstImg, r.imageMismatch); n++;
  }
  check('F.cross', `parallel rays +-b cross at x=b/tan(delta/2) in the unrolled plane (${n} cases m in {.01..0.24}, b in {.3..1000}); max rel err`, worst, '<=', 1e-12);
  check('F.cross.radial', `radial distance to the seam point = b/sin(delta/2) (hypot of the intersection point; ${n} cases); max rel err`, worstRad, '<=', 1e-12);
  check('F.glue', 'the two edge-hit points coincide under the gluing rotation (max relative mismatch)', worstImg, '<=', 1e-12);
  const body = GE.Cone.restBody(3.5, -1.25); const x0 = body.x, y0 = body.y; let rate = 1; for (let i = 0; i < 1000; i++) { GE.Cone.stepRest(body, 1 / 60); rate = Math.min(rate, body.clockRate); }
  check('F.rest', 'body at rest: displacement after 1000 frames', Math.hypot(body.x - x0, body.y - y0), '==', 0);
  check('F.clock', 'clock rate everywhere in cone mode (min over frames)', rate, '==', 1);
  let thr = false; try { GE.Cone.deficit(0.25); } catch (e) { thr = true; }
  check('F.deficitLimit', 'deficit >= 2 pi (m = 0.25) is rejected', thr, 'true', true);
  info.notes.push('F: "distance b/tan(delta/2) past the apex" is asserted both as the x-coordinate in the unrolled plane (F.cross) and as the radial distance to the seam point b/sin(delta/2) (F.cross.radial).');
}

// ================================ G. precision ===================================================
{
  const srcDir = path.join(ROOT, 'src'); const hits = [];
  for (const f of fs.readdirSync(srcDir)) {
    if (!f.endsWith('.js') || f === 'draw.js') continue; // draw.js (UI step) is the only place a 32-bit draw copy may live
    const text = fs.readFileSync(path.join(srcDir, f), 'utf8').split('\n');
    text.forEach((line, i) => { if (/Float32|Float16|fround|Int32Array\s*\(\s*[^)]*\)\s*;\s*\/\/\s*state/.test(line) && !/^\s*\/\/.*(No 32-bit|a draw copy)/.test(line) && !/no 32-bit typed arrays exist/.test(line)) hits.push(f + ':' + (i + 1) + ': ' + line.trim()); });
  }
  check('G.scan', `source scan of src/*.js (excluding draw.js) for Float32Array/Float32/Float16/fround: hits ${hits.length}${hits.length ? ' -> ' + hits.join(' | ') : ''}`, hits.length, '==', 0, { hits });
  // value-level: a 32-bit round trip would break the state precision: confirm engine state is not float32-representable
  const e0 = ref.precession[0], b = GE.launchState('massive', { r: e0.r_p, rdot: 0, L: e0.L, E: e0.E }); for (let i = 0; i < 1000; i++) GE.step(b); // eccentric orbit: state genuinely varies
  const f32 = (x) => new Float32Array([x])[0];
  check('G.runtime', 'after 1000 Verlet steps on the (10,20) orbit r, phi, T, tau are not float32-representable (state is 64-bit)', (b.r !== f32(b.r)) && (b.phi !== f32(b.phi)) && (b.T !== f32(b.T)) && (b.par !== f32(b.par)), 'true', true);
}

// ================================ H. regression ===================================================
let baselineInfo = 'none given';
const bpath = opt('baseline', null);
// write outputs first (baseline comparison needs the verdicts)
const status = Object.fromEntries(checks.map((c) => [c.id, c.pass]));
const missing = [];
if (bpath && fs.existsSync(bpath)) {
  const base = JSON.parse(fs.readFileSync(bpath, 'utf8')); const flips = [];
  for (const c of base.checks) if (c.pass === true && status[c.id] === false) flips.push(c.id);
  baselineInfo = `${bpath}: ${base.checks.length} baseline asserts, pass->fail flips: ${flips.length}`;
  check('H.regression', `no pass->fail flip vs baseline (${baselineInfo})`, flips.length, '==', 0, { flips });
} else check('H.baseline', 'baseline file for this step: none (first run; this output IS the baseline, committed)', true, 'true', true);

const lines = []; const w = (s) => lines.push(s);
const idW = Math.max(...checks.map((c) => c.id.length));
w(`Geodesic Lab v1 asserts  step=${STEP}  engine ETA_VERLET=${GE.ETA_VERLET} ETA_RK4=${GE.ETA_RK4}  R_CUT=${GE.R_CUT}`);
w('ID'.padEnd(idW) + '  RESULT  MEASURED        OP  THRESHOLD       DESCRIPTION');
for (const c of checks) w(c.id.padEnd(idW) + '  ' + (c.pass === null ? 'INFO  ' : c.pass ? 'PASS  ' : 'FAIL  ') + '  ' + fmt(c.measured).padEnd(14) + '  ' + c.op.padEnd(2) + '  ' + fmt(Array.isArray(c.threshold) ? c.threshold.join('..') : c.threshold).padEnd(14) + '  ' + c.desc);
const graded = checks.filter((c) => c.pass !== null), nFail = graded.filter((c) => !c.pass).length;
w(`\n${graded.length - nFail}/${graded.length} PASS, ${nFail} FAIL  (${checks.length - graded.length} INFO rows not graded)`);
info.notes.forEach((n) => w('note: ' + n));
console.log(lines.join('\n'));
fs.writeFileSync(path.join(OUT, 'asserts.txt'), lines.join('\n') + '\n');
fs.writeFileSync(path.join(OUT, 'asserts.json'), JSON.stringify({ step: STEP, when: new Date().toISOString(), info, checks, summary: { total: graded.length, fail: nFail, info: checks.length - graded.length } }, null, 1));
for (const [k, v] of Object.entries(series)) fs.writeFileSync(path.join(OUT, 'series', k + '.json'), JSON.stringify(v));
fs.writeFileSync(path.join(OUT, 'convergence.json'), JSON.stringify({ verlet: info.convergenceVerlet, rk4: info.convergenceRK4, method: 'periapsis: cubic Hermite interpolation of the rdot (- to +) zero crossing; light r_min the same; p only if step ratio in [1.8,2.2] and err(eta/2) >= 1e-9' }, null, 1));
process.exit(nFail ? 1 : 0);
