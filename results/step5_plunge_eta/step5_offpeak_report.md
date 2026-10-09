# Step 5 (REPORT-ONLY, not a graded assert), 1% margin: r=8, L=3.5 plunge, grade reference 1e-10*E^2

E: E^2 = Vmax(1+1e-2), Vmax = V^2(5.25) = 0.8941798941798942; E = 0.9503271505758915; inward start rdot0 = -0.09781107105892003 (static launch at r=8, rdot=0 would give E=0.9452802163908859 and is BOUND, periapsis 5.9689).

| eta | steps | removed | tau end | shadow max | 64-bit max (DD-evaluated) | shadow vs 1e-10 | 64-bit vs 1e-10 | shadow first >1e-10 | 64-bit first >1e-10 |
|---|---|---|---|---|---|---|---|---|---|
| 0.0005 | 20993 | singularity | 46.8808 | 3.587e-08 | 3.583e-08 | FAIL | FAIL | step 17074, r=0.3554, 1.001e-10 | step 17086, r=0.3533, 1.000e-10 |
| 0.0001 | 104989 | singularity | 46.8808 | 6.581e-11 | 1.918e-09 | PASS | FAIL | never | step 96507, r=0.1168, 1.016e-10 |

| eta | decade of r | steps | mean dt | shadow resid max | 64-bit resid max | floor max | shadow vs 1e-10 | 64-bit vs 1e-10 | N cum | sqrt(N)eps | max dr/r | max drdot/rdot | max dphi rel | binds r32 / r^2/L / r/rdot |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 0.0005 | [1e0,1e1) | 15006 | 3.118e-03 | 2.760e-12 | 2.706e-12 | 1.74e-15 | PASS | PASS | 15006 | 1.36e-14 | 1.44e-14 | 2.37e-14 | 8.19e-15 | 0 / 14830 / 176 |
| 0.0005 | [1e-1,1e0) | 4602 | 2.124e-05 | 4.504e-09 | 4.587e-09 | 2.87e-12 | FAIL | FAIL | 19608 | 1.55e-14 | 1.57e-14 | 2.53e-14 | 8.95e-15 | 0 / 0 / 4602 |
| 0.0005 | [1e-2,1e-1) | 1385 | 1.548e-07 | 3.587e-08 | 3.583e-08 | 2.35e-11 | FAIL | FAIL | 20993 | 1.61e-14 | 1.41e-14 | 2.19e-14 | 4.26e-15 | 0 / 0 / 1385 |
| 0.0001 | [1e0,1e1) | 75036 | 6.235e-04 | 4.441e-15 | 1.542e-13 | 1.74e-15 | PASS | PASS | 75036 | 3.04e-14 | 3.81e-14 | 7.27e-14 | 7.13e-15 | 0 / 74154 / 882 |
| 0.0001 | [1e-1,1e0) | 23023 | 4.248e-06 | 7.189e-12 | 1.221e-10 | 2.86e-12 | PASS | FAIL | 98059 | 3.48e-14 | 3.96e-14 | 6.89e-14 | 1.44e-14 | 0 / 0 / 23023 |
| 0.0001 | [1e-2,1e-1) | 6930 | 3.096e-08 | 6.581e-11 | 1.918e-09 | 2.35e-11 | PASS | FAIL | 104989 | 3.60e-14 | 3.80e-14 | 5.44e-14 | 1.54e-14 | 0 / 0 / 6930 |

**Convergence 5e-4 -> 1e-4 (eta ratio 5; mean dt ratio per decade shown), p = log(res_c/res_f)/log(5)**

| decade | dt ratio | shadow c | shadow f | p shadow | 64-bit c | 64-bit f | p 64-bit |
|---|---|---|---|---|---|---|---|
| 1e0 | 5.000 | 2.760e-12 | 4.441e-15 | 4.00 | 2.706e-12 | 1.542e-13 | 1.78 |
| 1e-1 | 4.999 | 4.504e-09 | 7.189e-12 | 4.00 | 4.587e-09 | 1.221e-10 | 2.25 |
| 1e-2 | 5.001 | 3.587e-08 | 6.581e-11 | 3.91 | 3.583e-08 | 1.918e-09 | 1.82 |
