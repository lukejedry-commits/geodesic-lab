# Geodesic Lab v1 reference values. Units G=c=1, lengths in M (M=1).
import mpmath as mp, json
mp.mp.dps = 30
M = mp.mpf(1)
out = {}
# Circular orbits
circ = []
for r in [4, 5, 6, 8, 10, 20, 100]:
    r = mp.mpf(r)
    L = mp.sqrt(M*r**2/(r-3*M)); E = (1-2*M/r)/mp.sqrt(1-3*M/r)
    Om = mp.sqrt(M/r**3); dtau = mp.sqrt(1-3*M/r)
    circ.append(dict(r=float(r), E=float(E), L=float(L), Omega=float(Om), dtau_dt=float(dtau)))
out['circular'] = circ
# Light deflection, exact, with u = u0(1-s^2)
def deflect(b):
    b = mp.mpf(b)
    roots = sorted([mp.re(x) for x in mp.polyroots([2*M, -1, 0, 1/b**2], maxsteps=200, extraprec=60)])
    un, u0, ub = roots
    g = lambda s: 2*mp.sqrt(u0)/mp.sqrt(2*M*(u0*(1-s**2)-un)*(ub-u0*(1-s**2)))
    return 2*mp.quad(g, [0, 1]) - mp.pi, 1/u0
bc = 3*mp.sqrt(3)*M
defl = []
for b in [bc*mp.mpf('1.01'), 5.5, 6, 8, 10, 20, 100, 1000]:
    d, rmin = deflect(b)
    w1 = 4*M/mp.mpf(b); w2 = w1 + mp.mpf(15)*mp.pi/4*(M/mp.mpf(b))**2
    defl.append(dict(b=float(b), r_min=float(rmin), deflection_rad=float(d), weak_4M_over_b=float(w1), weak_2nd_order=float(w2)))
out['light_deflection'] = defl
out['b_crit'] = float(bc)
# Bound eccentric orbits: periapsis shift per radial period
def precess(rp, ra):
    u1, u2 = 1/mp.mpf(ra), 1/mp.mpf(rp); u3 = 1/(2*M) - u1 - u2
    L = 1/mp.sqrt(u1*u2 + u1*u3 + u2*u3); E = mp.sqrt(1 - 2*M*u1*u2*u3*L**2)
    f = lambda c: 1/mp.sqrt(2*M*(u3 - (u1 + (u2-u1)*(1-mp.cos(c))/2)))
    dphi = 2*mp.quad(f, [0, mp.pi]) - 2*mp.pi
    a = (rp+ra)/mp.mpf(2); e = (ra-rp)/mp.mpf(ra+rp)
    return dict(r_p=rp, r_a=ra, E=float(E), L=float(L), shift_rad=float(dphi), weak_6piM_over_a1e2=float(6*mp.pi*M/(a*(1-e**2))))
out['precession'] = [precess(*x) for x in [(10, 20), (8, 40), (20, 60), (100, 200), (1000, 2000)]]
# Infall from rest at infinity
out['infall_tau_to_r0'] = [dict(r0=r0, tau=float(mp.mpf(2)/3*mp.mpf(r0)**1.5/mp.sqrt(2*M))) for r0 in [2, 6, 10]]
json.dump(out, open('ref_values.json', 'w'), indent=1)
print(json.dumps(out, indent=1))
