# DRAFT: per-decade conditioning table, L != 0 RK4 plunges (pending Validation format/grade)

Source: ONLY `results/step8_plots_speed/runs/*_eta0.0001.json` (default eta = 1e-4; no new runs). Near-peak starts (r4, r5) are listed first on their own rows; the off-peak r8 case last.

- kappa = max(rdot^2, V^2)/E^2 (NM). Derived as floorMax/2^-53 from step8 `floorMax` = eps*max(rdot^2,|V^2|,E^2)/E^2 (evaluated on the shadow state); this equals max(kappa,1), so values <= 1 are shown as "<= 1".
- residual = max |rdot^2+V^2-E^2|/E^2 on the stored 64-bit state, evaluated in double-double (`dd64Max`); the shadow double-double-state value is shown beside it.
- diff = max relative difference 64-bit vs shadow over the decade (r: |dr|/r; rdot: |drdot|/max(|rdot|,1e-3)), same step index (step8 `dRrel`, `dVrel`).
- ratio = residual / (kappa * diff), with diff = max(rel r diff, rel rdot diff). Definition choice is mine, pending Validation.
- pass/fail: 64-bit residual vs 1e-10 (graded quantity).

| case | eta | decade | steps | max_kappa | max_residual_64bit_DD | max_residual_shadow_DD | diff_64_vs_shadow_rel_r | diff_64_vs_shadow_rel_rdot | ratio_res_over_kappa_diff | pass_1e-10 |
|---|---|---|---|---|---|---|---|---|---|---|
| r=4-1e-4, L=4 (near-peak start, rMax=4) | 0.0001 | [10,1)M | 163749 | 18 | 2.054e-13 | 5.157e-15 | 3.98e-11 | 7.42e-11 | 0.000154 | PASS |
| r=4-1e-4, L=4 (near-peak start, rMax=4) | 0.0001 | [1,0.1)M | 23023 | 3.043e+04 | 2.040e-10 | 8.483e-12 | 3.98e-11 | 7.29e-11 | 9.19e-05 | FAIL |
| r=4-1e-4, L=4 (near-peak start, rMax=4) | 0.0001 | [0.1,0.05]M | 6930 | 2.496e+05 | 1.232e-09 | 6.765e-11 | 3.98e-11 | 6.07e-11 | 8.13e-05 | FAIL |
| r=5-1e-4, L=sqrt(12.5) (near-peak start, rMax=5) | 0.0001 | [10,1)M | 257465 | 16 | 1.322e-13 | 4.439e-15 | 3.03e-10 | 5.57e-10 | 1.48e-05 | PASS |
| r=5-1e-4, L=sqrt(12.5) (near-peak start, rMax=5) | 0.0001 | [1,0.1)M | 23023 | 2.642e+04 | 1.969e-10 | 7.361e-12 | 3.03e-10 | 5.46e-10 | 1.36e-05 | FAIL |
| r=5-1e-4, L=sqrt(12.5) (near-peak start, rMax=5) | 0.0001 | [0.1,0.05]M | 6930 | 2.167e+05 | 2.903e-09 | 5.872e-11 | 3.03e-10 | 4.62e-10 | 2.9e-05 | FAIL |
| r=8, L=3.5, E^2=Vmax(1+1e-2) (off-peak) | 0.0001 | [10,1)M | 75036 | 15.68 | 1.542e-13 | 4.441e-15 | 3.81e-14 | 7.27e-14 | 0.135 | PASS |
| r=8, L=3.5, E^2=Vmax(1+1e-2) (off-peak) | 0.0001 | [1,0.1)M | 23023 | 2.58e+04 | 1.221e-10 | 7.189e-12 | 3.96e-14 | 6.89e-14 | 0.0687 | FAIL |
| r=8, L=3.5, E^2=Vmax(1+1e-2) (off-peak) | 0.0001 | [0.1,0.05]M | 6930 | 2.116e+05 | 1.918e-09 | 6.581e-11 | 3.80e-14 | 5.44e-14 | 0.167 | FAIL |


**Footnote (Lead ruling, 2026-10-12):** For the near-peak cases, the difference from the shadow run is mostly drift along the orbit, which the energy check does not see, so the residual/(κ·diff) ratio is not meaningful for those rows. The off-peak ratio of about 0.1 supports the rounding explanation. The trial will use NM's across-path difference δ⊥ instead.
