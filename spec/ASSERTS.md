# Geodesic Lab v1 — frozen asserts (Validation Engineer Expert)

Frozen 2026-10-08 before any code. Amendments are dated and cite the room ruling. Units G = c = M = 1. Reference: `ref_values.json`
(Algebra), independently reproduced to <=1e-14 by `validation_crosscheck.py`
(singularity-free periapsis form dphi = dx/sqrt(2M(u3-u)), polynomial-root u0 for light).
Thresholds change only by a room ruling. A failed assert is a fail; "looks right" is not a test.
All asserts run headless (`node test/...`), exit non-zero on any fail, and re-run after every change (regression).

## A. Circular orbits (launch with exact E, L from ref file)
- Stable r = 8, 10, 20, 100: over 100 orbits, |r - r0|/r0 <= 1e-6; Omega = dphi/dT within 1e-6 rel
  of sqrt(M/r^3); dtau/dT within 1e-6 rel of sqrt(1 - 3M/r).
- r = 4 (E = 1 exactly): first orbit |r - r0|/r0 <= 1e-6. Kick r by -1e-4 -> crosses 2M within 20 orbits.
  Kick +1e-4 -> escapes past r = 1000M (unbound).
- r = 5, 6: first orbit within 1e-6. Inward kick 1e-4 at r = 5 -> crosses 2M within 20 orbits.
  The sim must not hide real instability (no clamping of r).
- UI launch mapping: launch at r = 20M with local tangential speed v = sqrt(M/(r-2M)) through the
  user path (E = gamma*sqrt(1-2M/r), L = gamma*v*r) -> |r - r0|/r0 <= 1e-6 over 10 orbits.

## B. Eccentric orbits (5 ref cases, launch at r_p with ref E, L)
- Periapsis shift per radial period, mean over >= 10 periods, at the shipped default eta:
  relative error vs `shift_rad` <= 1e-4. Periapsis by >= cubic interpolation of the rdot zero crossing.
- Convergence: halve eta -> p = log2(err(eta)/err(eta/2)) in [1.8, 2.2] (Verlet). Step ratio must be
  within 1.8-2.2 or no p is reported. Measure where err(eta/2) >= 1e-9 (above round-off).
- Weak field only where M/p_semi <= 1e-3 (p_semi = a(1-e^2)): |sim - 6piM/p_semi| / (6piM/p_semi) <= 10*M/p_semi.
  Never assert the weak formula in strong field.

## C. Light (ref deflection cases, all b >= 1.01 b_c)
- Deflection relative error <= 1e-8; r_min relative error <= 1e-8.
- Convergence: halve step -> p in [3.6, 4.4] (RK4), same step-ratio rule.
- Capture: b = 0.99 b_c crosses 2M; b = 1.01 b_c escapes to r > 1000M.
- Launch mapping: from r = 20M at alpha with b = r sin(alpha)/sqrt(1-2M/r) = 6 -> measured L/E = 6 within 1e-12.
- Weak field only for b >= 100M: |sim - 4M/b|/(4M/b) <= 10*M/b.
- Time/space split (caption check), b = 1000M: deflection with only g_tt curved, and with only g_rr curved,
  each within 2M/b to <= 10*M/b relative; together they match 4M/b to <= 10*M/b relative.

## D. Infall and horizon (E = 1, L = 0, rdot = -sqrt(2M/r0))
- r0 = 2, 6, 10: proper time to r_end = 0.05M vs (2/3)(r0^1.5 - r_end^1.5)/sqrt(2M), rel <= 1e-8.
- Raindrop clock: for E = 1, L = 0, dT/dtau = 1 exactly, so |T - tau| <= 1e-10*(1 + tau/M) at every step
  (room ruling 2026-10-08, NM: allows the RK4 residual to accumulate), including through r = 2M. 0 NaN / Inf. T strictly increasing across 2M.
- Removed at r < 0.05M, never stepped below it.

## E. Conservation (NM's plots are the evidence; these are the numbers)
- E and L fixed at launch: bitwise unchanged for every body for the whole run.
- Constraint residual |rdot^2 + V^2 - E^2|/E^2 (null: V^2 without the 1):
  Verlet orbits over 1000 radial periods: max over last 100 periods <= 2x max over first 100, and <= 1e-6.
  RK4 paths: <= 1e-10 for the whole path.

## F. Cone mode (deficit delta = 8*pi*m)
- Two parallel rays at impact parameters +b and -b cross on the axis at distance b / tan(delta/2)
  past the apex, within 1e-12 relative. A body at rest has displacement 0 over 1000 frames.
  Clock rate 1 everywhere (no slowdown shown in this mode).

## G. Precision (room ruling 2026-10-08, NM)
- All orbit state (r, phi, rdot) and E, L, T, tau are 64-bit (Float64Array or plain JS numbers).
  No Float32Array anywhere in state or integration. Rendering may use a 32-bit copy made only for drawing.
  Assert: a test scans the source for Float32Array outside the draw path and fails if found.

## H. Regression
- Every assert above runs on every change. Baseline outputs are committed; any pass -> fail flip blocks the change.
