# Geodesic Lab: Schwarzschild geodesics (ENGINE MILESTONE)

**Status: ENGINE MILESTONE + UI v1 (local build, step 6). Not published: GitHub Pages is not enabled.** This repo holds the physics engine (frozen), the assert runner, the plots and reports, and the UI (`index.html`, `style.css`, `ui/`).

## UI (open `index.html`, or serve the folder: `python3 -m http.server`)
Vanilla JS + Canvas2D, no frameworks, touch-friendly (44 px targets, pointer events). Top-down r,phi view (horizon 2M filled, photon sphere 3M dashed, ISCO 6M dotted), drag-to-aim launch for particles and light (local static observer; E, L round trip shown), V^2(r) panel with the E^2 level, Flamm surface ('shape of space at one instant') plus clock-rate colour map with the required caption, per-body proper time and Painleve-Gullstrand T, removal at r < 0.05M ('GR stops here'), Newtonian ghost (OFF by default), 2+1 cone mode, 8 presets from `spec/ref_values.json`, and the visible 'currently documented limit' note (see Limitation).

Playback independence (ASSERTS section J): `test/playback_core.js` runs the UI's stepping code (`ui/sim.js`) at three playback speeds / frame partitions to the same T; the final state is bitwise identical (rows `J.*` of the runner; `test/playback_check.js` prints the hex, `test/playback_browser.js` repeats it in headless Chrome). All orbit state is 64-bit (engine bodies); the only `Float32Array` is a draw copy of screen coordinates in `ui/draw.js`.
- Files: `ui/sim.js` (world, presets, launch), `ui/draw.js` (all drawing), `ui/cone.js`, `ui/app.js` (wiring), `ui/ref_values.js` (values copied from `spec/ref_values.json`).
- Smoke test (headless Chrome, desktop + phone viewports): `NODE_PATH=/path/to/puppeteer-core/node_modules node test/ui_smoke.js --out results/<folder>`; results and screenshots in `results/step6_ui/`.
- The engine was not changed in step 6: `src/engine.js` md5 df98e72a41a1727fbe1797ec1d8eae1a, assert suite re-run with 0 flips (125/147, `results/step6_ui/asserts.txt`).

Schwarzschild metric, equatorial plane, G = c = 1, lengths in M. Massive particles and light rays; per-particle proper time; Painleve-Gullstrand time T (Schwarzschild `t` is never integrated); removal at r < 0.05M; 2+1 cone mode.

## The 64-bit rule
All orbit state and E, L, T, tau are 64-bit floats (JS numbers). `Float32Array` may only appear on a draw copy; a source-scan assert (section G) checks this. Integrators: velocity Verlet (fixed dtau) for bound orbits outside 2M; RK4 for light, plunges and horizon crossings, default step rule `r32+L`: h = eta * min(r^{3/2}/sqrt(M), r^2/|L|, r/|rdot|). Default eta: 5e-4 for light and every other RK4 body; **1e-4 for L != 0 plunges** (NM + Validation ruling, step 5). A body is a plunge when, at launch, it is massive, L != 0, moving inward (rdot < 0, or rdot = 0 with an inward force) and E^2 >= max V^2 over [r_cut, r0] (1e-12 relative), i.e. no inward turning point (`GE.isPlunge`). An explicit `eta` always overrides. State stays 64-bit. See `docs/STEP_RULE_NOTE.md` for which limit actually binds.

## Test results (nothing was loosened; FAIL rows are real FAILs)
| step | folder | result |
|---|---|---|
| 1 | `results/step1_core` | **126/128 PASS, 2 FAIL**: `E.r4_inward.residual` 3.14 and `E.r5_inward.residual` 1.66 vs threshold 1e-10 (old r^{3/2}-only rule) |
| 2, default rule `r32+L` | `results/step2_steprule` | **121/141 graded PASS, 20 FAIL** (8 INFO rows not graded), no pass->fail flips vs step 1 |
| 5, plunge default eta 1e-4 (**current**) | `results/step5_plunge_eta` | **125/147 graded PASS, 22 FAIL** (10 INFO rows), 0 pass->fail flips vs step 2. The 20 step-2 FAIL rows are unchanged (same ids, same values; they use explicit etas). 8 new rows: 4 PASS (default eta == 1e-4, isPlunge, both cases) and 2 new FAIL (`E.r4_inward.residualDD.etadefault` 1.232e-9, `E.r5_inward.residualDD.etadefault` 2.903e-9 vs 1e-10; identical runs to the explicit eta=1e-4 rows) and 2 INFO. Only other changed values: `A.r4.inward` 2.45637->2.45636, `A.r5.inward` 3.95292->3.95293 orbits (both still PASS). |

The 20 step-2 FAILs are all L != 0 plunge rows (r=4-1e-4 with L=4, and r=5-1e-4):
- 8 residual rows (`E.r{4,5}_inward.residualDD.eta*`): the double-double-evaluated residual of the 64-bit state, max over the whole path, is 6.85e-10 .. 3.6e-8 against 1e-10 (r4: 4.185e-8, 1.508e-9, 1.232e-9, 1.701e-9 at eta 5e-4, 2e-4, 1e-4, 5e-5; r5: 3.608e-8, 6.850e-10, 2.903e-9, 1.848e-9). At the default eta (1e-4) and the finer etas the threshold is first crossed at r = 0.10-0.17 M (at the old eta 5e-4, at r ~ 0.36-0.38 M).
- 12 convergence rows (`E.r{4,5}_inward.p.dec*`): p outside [3.6, 4.4] (measured -2.08 .. 0.65). They are per decade of r, including r in [1,10) where the residual is already ~1e-13, because the 64-bit residual does not fall with eta.
Full table with measured value next to threshold: `results/step2_steprule/asserts.txt` (+ `asserts.json`).

## Shadow double-double runs (test tool only, engine stays 64-bit)
- `results/step3_shadow/`: both plunges re-integrated with the STATE in double-double (`test/shadow_dd.js`, `test/dd.js`), eta 5e-4, 2e-4, 1e-4, 5e-5. Shadow residual falls as eta^4 (p = 4.00) and is <= 1e-10 on every step for eta <= 1e-4 (6.77e-11, 1.63e-11 for r4; 5.87e-11, 4.14e-11 for r5) but FAILS at 5e-4 (4.24e-8, 3.68e-8) and 2e-4 (1.08e-9, 9.40e-10). The 64-bit residual plateaus at 0.7 .. 2.9e-9. Report: `step3_report.md`, plots `residual_by_decade_shadow_vs_64bit.png`, `difference_vs_steps.png`.
- `results/step4_offpeak/`: REPORT-ONLY extra plunge r=8, L=3.5 (E^2 = Vmax(1+1e-4)): shadow 3.62e-8 (eta 5e-4, FAIL vs 1e-10) and 5.79e-11 (1e-4, PASS); 64-bit 3.55e-8 and 8.13e-10 (FAIL). Not part of the graded asserts.
- `results/step5_plunge_eta/` (REPORT-ONLY): the off-peak case again at a 1% margin, E^2 = Vmax(1+1e-2) (E = 0.9503271505758915, rdot0 = -0.09781107105892003, margin E^2 - max V^2 = 8.94e-3, plunge confirmed): shadow 3.59e-8 (eta 5e-4, FAIL) and 6.58e-11 (1e-4, PASS); 64-bit 3.58e-8 and 1.92e-9 (FAIL). Here the 64-bit vs shadow trajectory difference is 1.4e-14 .. 4.0e-14 relative, i.e. at the sqrt(N)*eps level (1.6e-14 .. 3.6e-14). Validation's amendment also asks for eta 2e-4 (run added, `runs/r8_L3p5_m1e-2_eta0.0002.json`): shadow 9.18e-10, 64-bit 7.46e-10 (both FAIL vs 1e-10), 52492 steps, 64-bit vs shadow dr/r 1.4e-14 .. 1.7e-14; binds r2/|L| 37076 + r/rdot 441 in [1,10), r/rdot 100% below r=1.
- The reading that the near-peak starts amplify rounding is UNPROVEN (see the note).

## Run the tests
```
node test/run_asserts.js --step my_run --baseline results/step2_steprule/asserts.json     # writes results/my_run/ (refuses to overwrite)
python3 test/plot_step.py my_run                                                     # plots (needs matplotlib)
node test/shadow_dd.js --case r4_inward --eta 5e-4 --step my_shadow                  # one shadow run (r4_inward | r5_inward | r8_L3p5)
```
`run_asserts.js` prints measured value, threshold and PASS/FAIL for every assert and exits non-zero while any assert FAILs (currently 22 do, so exit code 1 is the expected result). Spec documents (verbatim copies of the frozen docs) are in `spec/`; the runner uses `./spec` by default.

## Layout
- `src/engine.js` engine (UMD: `require('./src/engine.js')` or `window.GeodesicEngine`), `src/analysis.js` test helpers
- `test/` runner, double-double helper (`dd.js`, test code only), shadow integrator, report/plot scripts, `engine_browser.html`
- `results/step1_core`, `step2_steprule`, `step3_shadow`, `step4_offpeak`, `step5_plunge_eta`, `step6_ui` (UI smoke test, screenshots, asserts re-run): outputs, never overwritten
- `docs/STEP_RULE_NOTE.md`, `spec/`
- `.devcontainer/devcontainer.json`: Codespaces (node 20 + python3 + matplotlib)

## Limitation (currently documented limit; applies to every plunge with angular momentum)
- Bodies are removed at r < 0.05M ("GR stops here").
- Measured: the 64-bit conservation check |rdot^2 + V^2 - E^2| / E^2 first crosses 1e-10 at r = 0.10-0.17 M (default eta 1e-4, and eta 2e-4 and 5e-5; all measured cases: r=4-1e-4 with L=4, r=5-1e-4, and r=8, L=3.5 at 1e-4 and 1% margins) and is about 1e-9 relative to E^2 (the frozen normalization of the check) below r = 0.1 M (0.7-2.9e-9). The measured table is `results/step5_plunge_eta/asserts.txt` and the step 3-5 reports.
- ESTIMATE (not a replacement for the measured table): residual ~ 1e-14 * 2 M L^2 / r^3, so it falls under 1e-10 at roughly r ~ (2 L^2 eps_eff / 1e-10)^(1/3), about 0.13-0.15 M for L = 3.5-4 M.
- This comes from the engine's 64-bit arithmetic: shadow double-double runs pass at eta 1e-4. The path differs from a high-precision run by between 1e-14 and 1e-9 depending on the start (no 1e-12 claim is made).
- The 2+1 cone slider is limited to delta < pi as a display choice; larger deficit angles up to 2 pi are valid 2+1 physics (the engine accepts them, `0.25` is rejected because delta = 2 pi).
