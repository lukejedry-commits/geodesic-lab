# Geodesic Lab v1: engine (step 1)
Schwarzschild equatorial geodesics, G = c = 1, lengths in M. Engine only; the UI is not started.
- `src/engine.js`: bodies, potentials, velocity Verlet (bound outside-2M orbits, fixed dtau = eta r_p^1.5/sqrt(M)), RK4 (light, plunges, horizon crossings, h = eta r^1.5/sqrt(M), far-field cap above r = 100M), Painleve-Gullstrand T, cone mode. 64-bit only; importable: `const GE = require('./src/engine.js')` or `window.GeodesicEngine`.
- `src/analysis.js`: periapsis finding (cubic Hermite rdot zero crossing), deflection, split-metric rays (test helpers).
- `test/run_asserts.js`: every assert of ASSERTS.md, measured value next to threshold; `node test/run_asserts.js --step <new-step-name>` writes `results/<step>/` (never overwrites). `test/plot_step.py <step>` writes the plots. `test/engine_browser.html` loads the engine as a plain script.
- `results/step1_core/`: asserts.txt (table), asserts.json (raw), convergence.json, series/, plots/.
Status: see results/step1_core/asserts.txt (2 FAIL, reported, nothing loosened).
