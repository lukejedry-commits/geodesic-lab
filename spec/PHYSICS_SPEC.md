# Geodesic Lab v1 — Physics Spec (Physics Expert)

Units G = c = 1, lengths in M. One non-spinning mass, equatorial plane (theta = pi/2).
Metric (Schwarzschild): ds^2 = -(1-2M/r) dt^2 + dr^2/(1-2M/r) + r^2 dphi^2.
r is the areal radius (circumference / 2pi). Plot distances are coordinate labels, not proper distances.

## 1. What's on screen
- Top-down plane in (r, phi). Marked circles: horizon 2M (filled), photon sphere 3M (dashed), ISCO 6M (dotted).
- Optional "star" mode: opaque surface at R > 3M that absorbs anything that hits it. By Birkhoff's theorem the exterior is the same metric, so nothing else changes.
- Test particles and light only. They do not curve spacetime themselves.
- Conserved per particle: E = (1-2M/r) dt/dtau, L = r^2 dphi/dtau.
  - Massive: (dr/dtau)^2 = E^2 - V^2,  V^2 = (1-2M/r)(1 + L^2/r^2).
  - Light:   (dr/dlam)^2 = E^2 - (1-2M/r) L^2/r^2,  impact parameter b = L/E.
- Launch as measured by a local static observer (only exists for r > 2M):
  - Massive, speed v < 1, tangential part v_t: E = gamma*sqrt(1-2M/r), L = gamma*v_t*r.
  - Light at angle alpha from outward radial: b = r*sin(alpha)/sqrt(1-2M/r).
- Side panel: effective potential V(r) for the selected particle's L with its E level, so capture vs bounce vs orbit is visible.
- Each particle carries its proper time tau. Readouts: static clock rate sqrt(1-2M/r); circular-orbit rate sqrt(1-3M/r).
- Optional ghost overlay: Newtonian trajectory from the same launch, to show precession and capture differences.

## 2. Slowed time vs curved space (anti-rubber-sheet)
- Two views, both always available:
  (a) Space: Flamm surface z = 2*sqrt(2M(r-2M)), drawn only for r >= 2M, labelled "shape of space at one instant".
  (b) Time: colour map of clock rate sqrt(1-2M/r).
- Required caption: for slow motion, gravity comes almost entirely from (b). Newtonian limit is g_tt ~ -(1+2*Phi); spatial curvature enters only at order v^2.
  A marble rolling on surface (a) under a downward pull does NOT reproduce orbits.
- Showcase: light bending 4M/b in the weak field is half from time (2M/b) and half from space (2M/b).
  Optional toggle: "time part only" ray next to the full ray.

## 3. Horizon crossing
- Integrate in proper time (affine parameter for light), never in Schwarzschild t, which diverges at 2M.
- Display time: Painleve-Gullstrand T, ds^2 = -dT^2 + (dr + sqrt(2M/r) dT)^2 + r^2 dphi^2.
  T = t + 2*sqrt(2Mr) + 2M ln|(sqrt r - sqrt 2M)/(sqrt r + sqrt 2M)|. Flat spatial slices, regular at 2M, dT/dt -> 1 far away.
- Inside 2M every path, light included, reaches r = 0. Remove particles at a small cutoff (e.g. r < 0.05M), labelled "reached the singularity: GR stops here".
- Label: the particle crosses in finite proper time. A distant observer never sees it cross; its light redshifts and fades.
- Check value: infall from rest at infinity, tau(r0 -> 0) = (2/3) r0^(3/2) / sqrt(2M).

## 4. Cone mode (true 2+1 GR, contrast)
- Point mass m: space is flat everywhere except at m. Cut a wedge with deficit angle delta = 8*pi*G*m (require delta < 2pi) and glue its edges.
- Geodesics are straight lines on the unrolled plane. Show the cone and the unrolled plane side by side.
- Shown: particles at rest stay at rest (no attraction), no horizon, no static-clock slowdown, no orbits.
  Two parallel paths passing either side of m cross: lensing without a pull.

## 5. Out of scope for v1
Self-gravity of test particles, multiple masses, Kerr, gravitational waves, radiation reaction, ray-traced sky images.
