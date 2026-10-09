"""Independent cross-check of ref_values.json (Validation). Needs mpmath."""
import json, mpmath as mp
mp.mp.dps = 30
ref = json.load(open(__file__.replace('validation_crosscheck.py', 'ref_values.json')))
def V2(r, L2): return (1 - 2/r) * (1 + L2/r**2)
def ecc(rp, ra):
    # singularity-free: u = ua + (up-ua)(1-cos x)/2, dphi = dx / sqrt(2M(u3 - u)), u3 = 1/(2M) - up - ua
    rp, ra = mp.mpf(rp), mp.mpf(ra); up, ua = 1/rp, 1/ra; u3 = mp.mpf(1)/2 - up - ua
    A = (1-2/rp)/rp**2 - (1-2/ra)/ra**2; B = (1-2/ra) - (1-2/rp)
    L2 = B/A; E2 = V2(rp, L2)
    f = lambda x: 1/mp.sqrt(2*(u3 - (ua + (up-ua)*(1-mp.cos(x))/2)))
    return 2*mp.quad(f, [0, mp.pi]) - 2*mp.pi, mp.sqrt(E2), mp.sqrt(L2)
def defl(b):
    b = mp.mpf(b); g = lambda u: 1/b**2 - u**2*(1-2*u)
    roots = mp.polyroots([2, -1, 0, 1/b**2], maxsteps=200, extraprec=100)
    u0 = sorted(mp.re(x) for x in roots if abs(mp.im(x)) < 1e-15 and mp.re(x) > 0)[0]
    I = mp.quad(lambda s: 2*u0*s/mp.sqrt(g(u0*(1-s**2))), [0, 1])
    return mp.re(2*I - mp.pi), 1/u0
worst = 0
for c in ref['precession']:
    d, E, L = ecc(c['r_p'], c['r_a'])
    for a, b in [(d, c['shift_rad']), (E, c['E']), (L, c['L'])]:
        worst = max(worst, abs(a-b)/abs(b))
for c in ref['light_deflection']:
    d, rmin = defl(c['b'])
    for a, b in [(d, c['deflection_rad']), (rmin, c['r_min'])]:
        worst = max(worst, abs(a-b)/abs(b))
for c in ref['circular']:
    r = mp.mpf(c['r'])
    for a, b in [((1-2/r)/mp.sqrt(1-3/r), c['E']), (mp.sqrt(r**2/(r-3)), c['L']),
                 (mp.sqrt(1/r**3), c['Omega']), (mp.sqrt(1-3/r), c['dtau_dt'])]:
        worst = max(worst, abs(a-b)/abs(b))
for c in ref['infall_tau_to_r0']:
    worst = max(worst, abs(mp.mpf(2)/3*mp.mpf(c['r0'])**1.5/mp.sqrt(2) - c['tau'])/c['tau'])
print('worst relative mismatch vs ref_values.json:', mp.nstr(worst, 3))
assert worst < 1e-12, 'reference mismatch'
print('PASS')
