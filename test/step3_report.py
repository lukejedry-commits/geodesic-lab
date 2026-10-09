#!/usr/bin/env python3
# aggregates results/step3_shadow/runs/*.json -> tables (md+json) and plots
import json, glob, math, os, sys
import numpy as np
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
R = os.path.join(os.path.dirname(__file__), '..', 'results', 'step3_shadow')
def fmt(e): return {5e-4:'0.0005',2e-4:'0.0002',1e-4:'0.0001',5e-5:'0.00005'}[e]
EPS = 2.0**-52 / 2  # unit roundoff 1.11e-16
etas = [5e-4, 2e-4, 1e-4, 5e-5]; cases = ['r4_inward', 'r5_inward']
runs = {(c, e): json.load(open(f'{R}/runs/{c}_eta{fmt(e)}.json')) for c in cases for e in etas}
out = {}; md = []
def slope(a, b, ea, eb):
    return math.log(a / b) / math.log(ea / eb) if a > 0 and b > 0 else float('nan')
for c in cases:
    md.append(f'\n## {c}  (L={runs[(c,etas[0])]["L"]})\n')
    md.append('| eta | decade of r | steps | mean dt | shadow-DD resid max | 64-bit (DD-evaluated) resid max | floor max | thr 1e-10 shadow | cum steps N | sqrt(N)*eps | max dr/r (64b-shadow) | max drdot/rdot | max dphi | binds r32 / r^2/L / r/rdot |')
    md.append('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|')
    for e in etas:
        d = runs[(c, e)]
        for x in sorted(d['decades'], key=lambda z: -z['decade']):
            n = x['cumStepsAtEnd']; b = x['binds']
            md.append(f"| {e:g} | [1e{x['decade']},1e{x['decade']+1}) | {x['steps']} | {x['hSum']/x['steps']:.3e} | {x['ddShadowMax']:.3e} | {x['dd64Max']:.3e} | {x['floorMax']:.2e} | {'PASS' if x['ddShadowMax']<=1e-10 else 'FAIL'} | {n} | {math.sqrt(n)*EPS:.2e} | {x['dRrel']:.2e} | {x['dVrel']:.2e} | {x['dPrel']:.2e} | {b['r32']} / {b['r2_over_L']} / {b['r_over_rdot']} |")
    # convergence p, dt ratio (pairs), per decade
    md.append('\n**Convergence (shadow DD residual, per decade; pair = (coarse, fine) eta; dt ratio = mean dt coarse / mean dt fine; p = log(res_c/res_f)/log(eta_c/eta_f); graded only if fine-eta shadow residual >= 3x floor)**\n')
    md.append('| pair | decade | dt ratio | rule 1.8-2.2 | shadow res coarse | shadow res fine | floor fine | p | graded | p in [3.6,4.4] | 64-bit res coarse | 64-bit res fine | p (64-bit) |')
    md.append('|---|---|---|---|---|---|---|---|---|---|---|---|---|')
    pv = {}
    for (ec, ef) in [(5e-4, 2e-4), (2e-4, 1e-4), (1e-4, 5e-5)]:
        dc, df = runs[(c, ec)], runs[(c, ef)]
        for x in sorted(dc['decades'], key=lambda z: -z['decade']):
            y = [z for z in df['decades'] if z['decade'] == x['decade']][0]
            ratio = (x['hSum']/x['steps'])/(y['hSum']/y['steps']); p = slope(x['ddShadowMax'], y['ddShadowMax'], ec, ef); p64 = slope(x['dd64Max'], y['dd64Max'], ec, ef)
            graded = y['ddShadowMax'] >= 3*y['floorMax']
            ok = (3.6 <= p <= 4.4) if graded else None
            pv[f'{ec:g}/{ef:g}/d{x["decade"]}'] = dict(dt_ratio=ratio, p=p, graded=graded, ok=ok, p64=p64)
            md.append(f"| {ec:g}/{ef:g} | 1e{x['decade']} | {ratio:.3f} | {'ok' if 1.8<=ratio<=2.2 else 'NO'} | {x['ddShadowMax']:.3e} | {y['ddShadowMax']:.3e} | {y['floorMax']:.2e} | {p:.2f} | {'yes' if graded else 'below floor'} | {'PASS' if ok else ('FAIL' if ok is False else 'n/a')} | {x['dd64Max']:.3e} | {y['dd64Max']:.3e} | {p64:.2f} |")
    md.append('\n**Whole-run maximum and first exceedance of 1e-10 (step index n counted from 1; tau = proper time)**\n')
    md.append('| eta | steps | shadow max resid | 64-bit max resid | shadow first >1e-10 (step, r, tau, value) | 64-bit first >1e-10 (step, r start->end, tau, value, value before) |')
    md.append('|---|---|---|---|---|---|')
    for e in etas:
        d = runs[(c, e)]; fs, fb = d['firstExceed']['shadow'], d['firstExceed']['bit64']
        f1 = f"{fs['step']}, r={fs['r']:.5f}, tau={fs['tau']:.4f}, {fs['residual']:.3e}" if fs else 'never'
        f2 = f"{fb['step']}, r={fb['rStart']:.5f}->{fb['rEnd']:.5f}, tau={fb['tau']:.4f}, {fb['residual']:.3e}, {fb['residualBefore']:.3e}" if fb else 'never'
        md.append(f"| {e:g} | {d['steps']} | {d['shadowMax']:.3e} | {d['bit64Max']:.3e} | {f1} | {f2} |")
    md.append('\n**Stage diagnosis at the step where the 64-bit residual first exceeds 1e-10 (step redone from that 64-bit pre-state in plain doubles vs double-double; relative differences)**\n')
    md.append('| eta | step | pre-state resid | post resid (double step) | post resid (DD step) | r2 | v2 | a1 | r3 | v3 | a2 | r4 | v4 | a3 | final r | final rdot |')
    md.append('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|')
    for e in etas:
        g = runs[(c, e)]['stepDiag']
        if not g: md.append(f'| {e:g} | none (64-bit never exceeds) |'); continue
        s = g['stageRelDiff_double_vs_DD']
        md.append(f"| {e:g} | {g['step']} | {g['preStateResidualDD']:.3e} | {g['postResidualDouble_stepD']:.3e} | {g['postResidualDD_stepDD']:.3e} | {s['r2']:.1e} | {s['vs2']:.1e} | {s['a1']:.1e} | {s['r3']:.1e} | {s['vs3']:.1e} | {s['a2']:.1e} | {s['r4']:.1e} | {s['vs4']:.1e} | {s['a3']:.1e} | {g['finalRelDiff']['r']:.1e} | {g['finalRelDiff']['rdot']:.1e} |")
    # difference scaling with eta (max over all decades)
    md.append('\n**Trajectory difference (64-bit minus shadow) over the whole run, vs eta; expectation if pure random-walk round-off: ~ sqrt(N)*eps (grows as eta^-1/2 when eta shrinks); if truncation-like: ~ eta^4 (falls)**\n')
    md.append('| eta | N steps | sqrt(N)*eps | max dr/r | ratio to sqrt(N)eps | max drdot/rdot | max dphi (rel) | dr/r at r~3.99 (step<=1000) |')
    md.append('|---|---|---|---|---|---|---|---|')
    for e in etas:
        d = runs[(c, e)]; mx = max(x['dRrel'] for x in d['decades']); mv = max(x['dVrel'] for x in d['decades']); mp = max(x['dPrel'] for x in d['decades'])
        early = d['series'][0][2]
        md.append(f"| {e:g} | {d['steps']} | {math.sqrt(d['steps'])*EPS:.2e} | {mx:.2e} | {mx/(math.sqrt(d['steps'])*EPS):.0f} | {mv:.2e} | {mp:.2e} | {early:.2e} (first 200 steps) |")
    out[c] = dict(convergence=pv, runs={str(e): {k: runs[(c, e)][k] for k in ['steps','shadowMax','bit64Max','firstExceed','stepDiag','decades']} for e in etas})
json.dump(out, open(f'{R}/step3_summary.json', 'w'), indent=1)
open(f'{R}/step3_report.md', 'w').write('# Step 3: shadow double-double state vs 64-bit engine\n' + '\n'.join(md) + '\n')
# plots
fig, ax = plt.subplots(2, 2, figsize=(13, 9))
for i, c in enumerate(cases):
    for j, (key, ttl) in enumerate([('ddShadowMax', 'shadow (DD state) residual'), ('dd64Max', '64-bit state residual (DD-evaluated)')]):
        a = ax[i][j]
        for e in etas:
            ds = sorted(runs[(c, e)]['decades'], key=lambda z: z['decade']); a.semilogy([x['decade'] for x in ds], [x[key] for x in ds], 'o-', label=f'eta={e:g}')
        ds = sorted(runs[(c, etas[0])]['decades'], key=lambda z: z['decade']); a.semilogy([x['decade'] for x in ds], [x['floorMax'] for x in ds], 'k:', label='round-off floor (eta=5e-4)')
        a.axhline(1e-10, color='r', ls='--', label='1e-10 gate'); a.set_title(f'{c}: {ttl}'); a.set_xlabel('decade of r (log10)'); a.set_ylabel('max |rdot^2+V^2-E^2|/E^2'); a.legend(fontsize=7); a.grid(alpha=.3)
plt.tight_layout(); plt.savefig(f'{R}/residual_by_decade_shadow_vs_64bit.png', dpi=110); plt.close()
fig, ax = plt.subplots(1, 2, figsize=(13, 5))
for i, c in enumerate(cases):
    a = ax[i]; cum = 0
    for e in etas:
        s = np.array(runs[(c, e)]['series']); a.loglog(s[:, 0], np.maximum(s[:, 2], 1e-18), label=f'dr/r  eta={e:g}')
    N = np.logspace(2, 6, 50); a.loglog(N, np.sqrt(N) * EPS, 'k--', label='sqrt(N)*eps')
    a.set_xlabel('step index N'); a.set_ylabel('windowed max |r64 - r_shadow| / r'); a.set_title(f'{c}: trajectory difference vs steps'); a.legend(fontsize=7); a.grid(alpha=.3, which='both')
plt.tight_layout(); plt.savefig(f'{R}/difference_vs_steps.png', dpi=110); plt.close()
print('\n'.join(md))
