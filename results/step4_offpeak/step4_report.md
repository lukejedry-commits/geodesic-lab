# Step 4 (REPORT-ONLY, not a graded assert): r=8, L=3.5 plunge, grade reference 1e-10*E^2

E: E^2 = Vmax(1+1e-4), Vmax = V^2(5.25) = 0.8941798941798942; E = 0.9456581370502303; inward start rdot0 = -0.02673246470702165 (static launch at r=8, rdot=0 would give E=0.9452802163908859 and is BOUND, periapsis 5.9689).

| eta | steps | removed | tau end | shadow max | 64-bit max (DD-evaluated) | shadow vs 1e-10 | 64-bit vs 1e-10 | shadow first >1e-10 | 64-bit first >1e-10 |
|---|---|---|---|---|---|---|---|---|---|
| 0.0005 | 45819 | singularity | 159.6517 | 3.624e-08 | 3.547e-08 | FAIL | FAIL | step 41893, r=0.3566, 1.000e-10 | step 41893, r=0.3566, 1.001e-10 |
| 0.0001 | 229117 | singularity | 159.6517 | 5.791e-11 | 8.132e-10 | PASS | FAIL | never | step 220501, r=0.1184, 1.017e-10 |

| eta | decade of r | steps | mean dt | shadow resid max | 64-bit resid max | floor max | shadow vs 1e-10 | 64-bit vs 1e-10 | N cum | sqrt(N)eps | max dr/r | max drdot/rdot | max dphi rel | binds r32 / r^2/L / r/rdot |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 0.0005 | [1e0,1e1) | 39831 | 4.006e-03 | 2.781e-12 | 2.760e-12 | 1.76e-15 | PASS | PASS | 39831 | 2.22e-14 | 1.18e-12 | 2.16e-12 | 6.41e-15 | 0 / 39656 / 175 |
| 0.0005 | [1e-1,1e0) | 4603 | 2.125e-05 | 4.550e-09 | 4.551e-09 | 2.90e-12 | FAIL | FAIL | 44434 | 2.34e-14 | 1.18e-12 | 2.12e-12 | 3.84e-14 | 0 / 0 / 4603 |
| 0.0005 | [1e-2,1e-1) | 1385 | 1.548e-07 | 3.624e-08 | 3.547e-08 | 2.37e-11 | FAIL | FAIL | 45819 | 2.38e-14 | 1.18e-12 | 1.80e-12 | 5.29e-14 | 0 / 0 / 1385 |
| 0.0001 | [1e0,1e1) | 199164 | 8.011e-04 | 4.504e-15 | 1.233e-13 | 1.76e-15 | PASS | PASS | 199164 | 4.95e-14 | 1.09e-12 | 2.00e-12 | 1.21e-14 | 0 / 198287 / 877 |
| 0.0001 | [1e-1,1e0) | 23023 | 4.248e-06 | 7.259e-12 | 3.131e-10 | 2.89e-12 | PASS | FAIL | 222187 | 5.23e-14 | 1.09e-12 | 1.96e-12 | 3.89e-14 | 0 / 0 / 23023 |
| 0.0001 | [1e-2,1e-1) | 6930 | 3.096e-08 | 5.791e-11 | 8.132e-10 | 2.37e-11 | PASS | FAIL | 229117 | 5.31e-14 | 1.09e-12 | 1.66e-12 | 5.08e-14 | 0 / 0 / 6930 |

**Convergence 5e-4 -> 1e-4 (eta ratio 5; mean dt ratio per decade shown), p = log(res_c/res_f)/log(5)**

| decade | dt ratio | shadow c | shadow f | p shadow | 64-bit c | 64-bit f | p 64-bit |
|---|---|---|---|---|---|---|---|
| 1e0 | 5.000 | 2.781e-12 | 4.504e-15 | 3.99 | 2.760e-12 | 1.233e-13 | 1.93 |
| 1e-1 | 5.002 | 4.550e-09 | 7.259e-12 | 4.00 | 4.551e-09 | 3.131e-10 | 1.66 |
| 1e-2 | 4.999 | 3.624e-08 | 5.791e-11 | 4.00 | 3.547e-08 | 8.132e-10 | 2.35 |
