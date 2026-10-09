# STEP_RULE_NOTE: the RK4 step rule as it actually binds

Status: a NOTE only. It does not change `PHYSICS_SPEC.md` (in `/workspace/geodesic-lab-spec`, not edited), the gates, the engine, or the default eta (RK4 5e-4).
Evidence: `results/step3_shadow/` (r=4-1e-4 with L=4; r=5-1e-4 with L=sqrt(12.5)) and `results/step4_offpeak/` (r=8, L=3.5), run with the default 'r32+L' rule.

## Rule (engine default `r32+L`)
h = eta * min( r^{3/2}/sqrt(M)  [r <= 100M],  r^2/|L|,  r/|rdot| )

## Which limit binds (counts of RK4 steps, by the r at the start of the step)
- **r^{3/2} never binds** in any L != 0 plunge run (0 steps of every run at eta = 5e-4, 2e-4, 1e-4, 5e-5; cases r4, r5, r8).
- **r in [1, 10): r^2/|L| binds ~99.5%** of steps (r/|rdot| the remaining ~0.5%). Examples at eta=5e-4: r4 32610 of 32749 (99.58%); r5 51320 of 51492 (99.67%); r8 39656 of 39831 (99.56%).
- **r in [0.05, 1): r/|rdot| binds 100%** (r4 and r5 at eta=5e-4: 4602 steps in [0.1,1) and 1386 in [0.05,0.1), all r/|rdot|; same counts for r8 within 1 step).
- Consequence: for L != 0 plunges the engine's step is, in practice, h = eta*r^2/|L| outside r~1 and h = eta*r/|rdot| inside. The "h proportional to r^{3/2}" statement in the spec is only the third, never-binding bound for these orbits (it does bind for L=0 and for light/far-field cases, which are covered by the section A-F asserts, unchanged).

## Residual behaviour (numbers, see step3/step4 reports)
- 64-bit state residual |rdot^2+V^2-E^2|/E^2, evaluated in double-double, plateaus at 0.7e-9 to 2.9e-9 for eta <= 2e-4 (does not fall with eta) and FAILS 1e-10 at all four etas.
- With the STATE carried in double-double (test tool `test/shadow_dd.js` only) the residual falls as eta^4 (p = 4.00) and passes 1e-10 on every step for eta <= 1e-4 (r4: 6.77e-11, 1.63e-11; r5: 5.87e-11, 4.14e-11), but fails at eta = 5e-4 (4.2e-8, 3.7e-8) and 2e-4 (1.1e-9, 9.4e-10).
- Off-peak report-only case r=8, L=3.5 (E^2 = Vmax(1+1e-4)): shadow 3.62e-8 (eta 5e-4, FAIL vs 1e-10) and 5.79e-11 (eta 1e-4, PASS); 64-bit 3.55e-8 and 8.13e-10 (FAIL both).

## Unstable-peak starts amplify rounding (UNPROVEN reading)
r = 4-1e-4 with L = 4 and r = 5-1e-4 start at, or very near, the unstable maximum of V^2 (rMax = 4M for L = 4M; rMax = 5M for r5's L = sqrt(12.5) M). Starting at rdot = 0 on the top of the barrier, the trajectory is exponentially sensitive to a 1e-16 perturbation: the 64-bit minus shadow difference grows from ~1e-16 (first 200 steps) to 4e-11..1e-9 relative in r and then stays there, far above sqrt(N)*eps (2e-14..8e-14) and not scaling as eta^4. In the off-peak r=8 case the same 64-bit minus shadow difference is only ~1e-12 relative (1.1e-12 to 1.2e-12), roughly 35-500 times smaller than the near-peak cases, while the 64-bit residual plateau (8e-10 at eta=1e-4) is of the same size as in the near-peak cases.
This is a reading of these numbers, NOT a proven mechanism: the off-peak case shows the trajectory-difference amplification is tied to the peak start, but the residual plateau itself appears with and without it, and we have not isolated what in the 64-bit arithmetic produces the plateau beyond "it is absent when the state is held in double-double".
