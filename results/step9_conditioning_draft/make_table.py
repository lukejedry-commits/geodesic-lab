#!/usr/bin/env python3
# DRAFT conditioning table (pending Validation format/grade). Reads ONLY results/step8_plots_speed/runs/*.json (no new runs).
# kappa = max(rdot^2, V^2)/E^2 (NM). step8 runs store floorMax = EPS*max(rdot^2,|V^2|,E^2)/E^2 per decade with EPS = 2^-53 (test/dd.js floorOf, evaluated on the shadow state);
# so floorMax/EPS = max(kappa, 1): exact kappa when > 1, otherwise only "<= 1".
import json, os, csv
H = os.path.dirname(os.path.abspath(__file__)); S8 = os.path.join(H, '..', 'step8_plots_speed', 'runs'); EPS = 2.0 ** -53
CASES = [('r4_inward', 'r=4-1e-4, L=4 (near-peak start, rMax=4)'), ('r5_inward', 'r=5-1e-4, L=sqrt(12.5) (near-peak start, rMax=5)'), ('r8_L3p5_m1e-2', 'r=8, L=3.5, E^2=Vmax(1+1e-2) (off-peak)')]
NAMES = {0: '[10,1)M', -1: '[1,0.1)M', -2: '[0.1,0.05]M'}
rows = []
for c, desc in CASES:
    d = json.load(open(os.path.join(S8, f'{c}_eta0.0001.json')))
    for x in sorted(d['decades'], key=lambda z: -z['decade']):
        k = x['floorMax'] / EPS; kap = f'{k:.4g}' if k > 1 + 1e-9 else '<= 1'
        res = x['dd64Max']; diff = max(x['dRrel'], x['dVrel'])
        ratio = res / (k * diff) if diff > 0 else float('nan')
        rows.append({'case': desc, 'eta': d['eta'], 'decade': NAMES.get(x['decade'], str(x['decade'])), 'steps': x['steps'], 'max_kappa': kap,
          'max_residual_64bit_DD': f'{res:.3e}', 'max_residual_shadow_DD': f"{x['ddShadowMax']:.3e}", 'diff_64_vs_shadow_rel_r': f"{x['dRrel']:.2e}", 'diff_64_vs_shadow_rel_rdot': f"{x['dVrel']:.2e}",
          'ratio_res_over_kappa_diff': f'{ratio:.3g}' + ('' if k > 1 + 1e-9 else ' (kappa<=1 used as 1)'), 'pass_1e-10': 'PASS' if res <= 1e-10 else 'FAIL'})
cols = list(rows[0].keys())
with open(os.path.join(H, 'conditioning_table.csv'), 'w', newline='') as f: w = csv.DictWriter(f, cols); w.writeheader(); w.writerows(rows)
md = ['# DRAFT: per-decade conditioning table, L != 0 RK4 plunges (pending Validation format/grade)', '',
  'Source: ONLY `results/step8_plots_speed/runs/*_eta0.0001.json` (default eta = 1e-4; no new runs). Near-peak starts (r4, r5) are listed first on their own rows; the off-peak r8 case last.', '',
  '- kappa = max(rdot^2, V^2)/E^2 (NM). Derived as floorMax/2^-53 from step8 `floorMax` = eps*max(rdot^2,|V^2|,E^2)/E^2 (evaluated on the shadow state); this equals max(kappa,1), so values <= 1 are shown as "<= 1".',
  '- residual = max |rdot^2+V^2-E^2|/E^2 on the stored 64-bit state, evaluated in double-double (`dd64Max`); the shadow double-double-state value is shown beside it.',
  '- diff = max relative difference 64-bit vs shadow over the decade (r: |dr|/r; rdot: |drdot|/max(|rdot|,1e-3)), same step index (step8 `dRrel`, `dVrel`).',
  '- ratio = residual / (kappa * diff), with diff = max(rel r diff, rel rdot diff). Definition choice is mine, pending Validation.',
  '- pass/fail: 64-bit residual vs 1e-10 (graded quantity).', '',
  '| ' + ' | '.join(cols) + ' |', '|' + '---|' * len(cols)]
for r in rows: md.append('| ' + ' | '.join(str(r[c]) for c in cols) + ' |')
open(os.path.join(H, 'conditioning_table.md'), 'w').write('\n'.join(md) + '\n'); print('\n'.join(md))
