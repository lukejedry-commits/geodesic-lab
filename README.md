# Geodesic Lab: Schwarzschild geodesics (ENGINE MILESTONE)

**Status: ENGINE MILESTONE. The UI is NOT started.** This repo holds the physics engine, the assert runner, the plots and the reports. Pages is not enabled.

Schwarzschild metric, equatorial plane, G = c = 1, lengths in M. Massive particles and light rays; per-particle proper time; Painleve-Gullstrand time T (Schwarzschild `t` is never integrated); removal at r < 0.05M; 2+1 cone mode.

## The 64-bit rule
All orbit state and E, L, T, tau are 64-bit floats (JS numbers). `Float32Array` may only appear on a draw copy; a source-scan assert (section G) checks this. Integrators: velocity Verlet (fixed dtau) for bound orbits outside 2M; RK4 for light, plunges and horizon crossings, default step rule `r32+L`: h = eta * min(r^{3/2}/sqrt(M), r^2/|L|, r/|rdot|). See `docs/STEP_RULE_NOTE.md` for which limit actually binds.

## Test results (nothing was loosened; FAIL rows are real FAILs)
| step | folder | result |
|---|---|---|
| 1 | `results/step1_core` | **126/128 PASS, 2 FAIL**: `E.r4_inward.residual` 3.14 and `E.r5_inward.residual` 1.66 vs threshold 1e-10 (old r^{3/2}-only rule) |
| 2, default rule `r32+L` | `results/step2_steprule` | **121/141 graded PASS, 20 FAIL** (8 INFO rows not graded), no pass->fail flips vs step 1 |

The 20 step-2 FAILs are all L != 0 plunge rows (r=4-1e-4 with L=4, and r=5-1e-4):
- 8 residual rows (`E.r{4,5}_inward.residualDD.eta*`): the double-double-evaluated residual of the 64-bit state, max over the whole path, is 6.85e-10 .. 3.6e-8 against 1e-10 (r4: 4.185e-8, 1.508e-9, 1.232e-9, 1.701e-9 at eta 5e-4, 2e-4, 1e-4, 5e-5; r5: 3.608e-8, 6.850e-10, 2.903e-9, 1.848e-9). The threshold is first crossed below r ~ 0.4.
- 12 convergence rows (`E.r{4,5}_inward.p.dec*`): p outside [3.6, 4.4] (measured -2.08 .. 0.65). They are per decade of r, including r in [1,10) where the residual is already ~1e-13, because the 64-bit residual does not fall with eta.
Full table with measured value next to threshold: `results/step2_steprule/asserts.txt` (+ `asserts.json`).

## Shadow double-double runs (test tool only, engine stays 64-bit)
- `results/step3_shadow/`: both plunges re-integrated with the STATE in double-double (`test/shadow_dd.js`, `test/dd.js`), eta 5e-4, 2e-4, 1e-4, 5e-5. Shadow residual falls as eta^4 (p = 4.00) and is <= 1e-10 on every step for eta <= 1e-4 (6.77e-11, 1.63e-11 for r4; 5.87e-11, 4.14e-11 for r5) but FAILS at 5e-4 (4.24e-8, 3.68e-8) and 2e-4 (1.08e-9, 9.40e-10). The 64-bit residual plateaus at 0.7 .. 2.9e-9. Report: `step3_report.md`, plots `residual_by_decade_shadow_vs_64bit.png`, `difference_vs_steps.png`.
- `results/step4_offpeak/`: REPORT-ONLY extra plunge r=8, L=3.5 (E^2 = Vmax(1+1e-4)): shadow 3.62e-8 (eta 5e-4, FAIL vs 1e-10) and 5.79e-11 (1e-4, PASS); 64-bit 3.55e-8 and 8.13e-10 (FAIL). Not part of the graded asserts.
- The reading that the near-peak starts amplify rounding is UNPROVEN (see the note).

## Run the tests
```
node test/run_asserts.js --step my_run --baseline results/step1_core/asserts.json     # writes results/my_run/ (refuses to overwrite)
python3 test/plot_step.py my_run                                                     # plots (needs matplotlib)
node test/shadow_dd.js --case r4_inward --eta 5e-4 --step my_shadow                  # one shadow run (r4_inward | r5_inward | r8_L3p5)
```
`run_asserts.js` prints measured value, threshold and PASS/FAIL for every assert and exits non-zero while any assert FAILs (currently 20 do, so exit code 1 is the expected result). Spec documents (verbatim copies of the frozen docs) are in `spec/`; the runner uses `./spec` by default.

## Layout
- `src/engine.js` engine (UMD: `require('./src/engine.js')` or `window.GeodesicEngine`), `src/analysis.js` test helpers
- `test/` runner, double-double helper (`dd.js`, test code only), shadow integrator, report/plot scripts, `engine_browser.html`
- `results/step1_core`, `step2_steprule`, `step3_shadow`, `step4_offpeak`: outputs, never overwritten
- `docs/STEP_RULE_NOTE.md`, `spec/`
- `.devcontainer/devcontainer.json`: Codespaces (node 20 + python3 + matplotlib)
