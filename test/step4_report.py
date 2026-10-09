#!/usr/bin/env python3
# REPORT-ONLY (not graded in run_asserts): off-peak plunge r=8, L=3.5. Aggregates results/step4_offpeak/runs/*.json
import json, math, os
import numpy as np
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
R = os.path.join(os.path.dirname(__file__), '..', 'results', 'step4_offpeak'); EPS = 2.0**-53
etas = [(5e-4, '0.0005'), (1e-4, '0.0001')]
runs = {e: json.load(open(f'{R}/runs/r8_L3p5_eta{f}.json')) for e, f in etas}
md = ['# Step 4 (REPORT-ONLY, not a graded assert): r=8, L=3.5 plunge, grade reference 1e-10*E^2\n',
      'E: E^2 = Vmax(1+1e-4), Vmax = V^2(5.25) = 0.8941798941798942; E = %.16g; inward start rdot0 = %.16g (static launch at r=8, rdot=0 would give E=0.9452802163908859 and is BOUND, periapsis 5.9689).\n' % (runs[5e-4]['E'], -math.sqrt(runs[5e-4]['E']**2 - (1-2/8)*(1+3.5**2/64))),
      '| eta | steps | removed | tau end | shadow max | 64-bit max (DD-evaluated) | shadow vs 1e-10 | 64-bit vs 1e-10 | shadow first >1e-10 | 64-bit first >1e-10 |', '|---|---|---|---|---|---|---|---|---|---|']
for e, _ in etas:
    d = runs[e]; fs, fb = d['firstExceed']['shadow'], d['firstExceed']['bit64']
    md.append(f"| {e:g} | {d['steps']} | {d['engine']['reason']} | {d['tauEnd']:.4f} | {d['shadowMax']:.3e} | {d['bit64Max']:.3e} | {'PASS' if d['shadowMax']<=1e-10 else 'FAIL'} | {'PASS' if d['bit64Max']<=1e-10 else 'FAIL'} | " + (f"step {fs['step']}, r={fs['r']:.4f}, {fs['residual']:.3e}" if fs else 'never') + ' | ' + (f"step {fb['step']}, r={fb['rStart']:.4f}, {fb['residual']:.3e}" if fb else 'never') + ' |')
md.append('\n| eta | decade of r | steps | mean dt | shadow resid max | 64-bit resid max | floor max | shadow vs 1e-10 | 64-bit vs 1e-10 | N cum | sqrt(N)eps | max dr/r | max drdot/rdot | max dphi rel | binds r32 / r^2/L / r/rdot |')
md.append('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|')
for e, _ in etas:
    for x in sorted(runs[e]['decades'], key=lambda z: -z['decade']):
        b = x['binds']; n = x['cumStepsAtEnd']
        md.append(f"| {e:g} | [1e{x['decade']},1e{x['decade']+1}) | {x['steps']} | {x['hSum']/x['steps']:.3e} | {x['ddShadowMax']:.3e} | {x['dd64Max']:.3e} | {x['floorMax']:.2e} | {'PASS' if x['ddShadowMax']<=1e-10 else 'FAIL'} | {'PASS' if x['dd64Max']<=1e-10 else 'FAIL'} | {n} | {math.sqrt(n)*EPS:.2e} | {x['dRrel']:.2e} | {x['dVrel']:.2e} | {x['dPrel']:.2e} | {b['r32']} / {b['r2_over_L']} / {b['r_over_rdot']} |")
md.append('\n**Convergence 5e-4 -> 1e-4 (eta ratio 5; mean dt ratio per decade shown), p = log(res_c/res_f)/log(5)**\n\n| decade | dt ratio | shadow c | shadow f | p shadow | 64-bit c | 64-bit f | p 64-bit |\n|---|---|---|---|---|---|---|---|')
for x in sorted(runs[5e-4]['decades'], key=lambda z: -z['decade']):
    y = [z for z in runs[1e-4]['decades'] if z['decade'] == x['decade']][0]; ps = lambda a, b: math.log(a/b)/math.log(5) if a > 0 and b > 0 else float('nan')
    md.append(f"| 1e{x['decade']} | {(x['hSum']/x['steps'])/(y['hSum']/y['steps']):.3f} | {x['ddShadowMax']:.3e} | {y['ddShadowMax']:.3e} | {ps(x['ddShadowMax'], y['ddShadowMax']):.2f} | {x['dd64Max']:.3e} | {y['dd64Max']:.3e} | {ps(x['dd64Max'], y['dd64Max']):.2f} |")
open(f'{R}/step4_report.md', 'w').write('\n'.join(md) + '\n')
json.dump({str(e): {k: runs[e][k] for k in ['E', 'L', 'steps', 'tauEnd', 'engine', 'shadowMax', 'bit64Max', 'firstExceed', 'stepDiag', 'decades']} for e, _ in etas}, open(f'{R}/step4_summary.json', 'w'), indent=1)
fig, ax = plt.subplots(1, 2, figsize=(13, 5))
for e, _ in etas:
    ds = sorted(runs[e]['decades'], key=lambda z: z['decade'])
    ax[0].semilogy([x['decade'] for x in ds], [x['ddShadowMax'] for x in ds], 'o-', label=f'shadow DD eta={e:g}')
    ax[0].semilogy([x['decade'] for x in ds], [x['dd64Max'] for x in ds], 's--', label=f'64-bit eta={e:g}')
    s = np.array(runs[e]['series']); ax[1].loglog(s[:, 0], np.maximum(s[:, 2], 1e-18), label=f'dr/r eta={e:g}')
ax[0].axhline(1e-10, color='r', ls='--', label='1e-10 (report-only ref)'); ax[0].set_xlabel('decade of r (log10)'); ax[0].set_ylabel('max residual / E^2'); ax[0].set_title('r=8, L=3.5 plunge (report-only)'); ax[0].legend(fontsize=7); ax[0].grid(alpha=.3)
N = np.logspace(2, 6, 50); ax[1].loglog(N, np.sqrt(N)*EPS, 'k--', label='sqrt(N)*eps'); ax[1].set_xlabel('step index'); ax[1].set_ylabel('windowed max |r64-r_shadow|/r'); ax[1].legend(fontsize=7); ax[1].grid(alpha=.3, which='both')
plt.tight_layout(); plt.savefig(f'{R}/offpeak_residual_and_difference.png', dpi=110)
print('\n'.join(md))
