#!/usr/bin/env python3
"""NM's plot gate for the engine: constraint residual vs T for every frozen orbit case, convergence (eta, eta/2), infall check.
Usage: python3 test/plot_step.py step1_core   (reads results/<step>/, writes results/<step>/plots/*.png; refuses to overwrite)"""
import json, os, sys, math
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt
step = sys.argv[1] if len(sys.argv) > 1 else "step1_core"
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "results", step)
P = os.path.join(R, "plots"); os.makedirs(P, exist_ok=True)
def out(name):
    f = os.path.join(P, name)
    if os.path.exists(f): sys.exit("refusing to overwrite " + f)
    return f
S = lambda n: json.load(open(os.path.join(R, "series", n + ".json")))
A = json.load(open(os.path.join(R, "asserts.json"))); CV = json.load(open(os.path.join(R, "convergence.json")))
def line(ax, rec, label, **k):
    ax.plot([p[0] for p in rec], [max(p[1], 1e-18) for p in rec], label=label, lw=1, **k)
# 1 circular
fig, ax = plt.subplots(figsize=(9, 5))
for n in ["r8", "r10", "r20", "r100", "r4", "r5", "r6"]: line(ax, S("A_circ_" + n), "r=" + n[1:])
for n, lab in [("A_r4_inward", "r=4 kick -1e-4 (plunge)"), ("A_r5_inward", "r=5 kick -1e-4 (plunge)")]: line(ax, S(n), lab, ls="--")
ax.set_yscale("log"); ax.set_xscale("symlog", linthresh=1); ax.set_xlim(left=0); ax.set_xlabel("T (Painleve-Gullstrand, M)"); ax.set_ylabel("|rdot^2+V^2-E^2|/E^2 (windowed max)")
ax.set_title("A: circular orbits and kicks, constraint residual vs T"); ax.legend(fontsize=7); ax.grid(alpha=.3); fig.tight_layout(); fig.savefig(out("residual_vs_T_circular.png"), dpi=110)
# 2 eccentric Verlet
fig, ax = plt.subplots(figsize=(9, 5))
for rp in [10, 8, 20, 100, 1000]: line(ax, S(f"E_verlet_rp{rp}"), f"r_p={rp}")
ax.axhline(1e-6, color="k", ls="--", lw=.8, label="limit 1e-6"); ax.set_yscale("log"); ax.set_xscale("log"); ax.set_xlabel("T (M), 1000 radial periods"); ax.set_ylabel("constraint residual (windowed max)")
ax.set_title("E: Verlet eccentric orbits, 1000 periods, residual vs T"); ax.legend(fontsize=7); ax.grid(alpha=.3); fig.tight_layout(); fig.savefig(out("residual_vs_T_eccentric_verlet.png"), dpi=110)
# 3 RK4 paths
fig, ax = plt.subplots(figsize=(9, 5))
for b in ["5.248113946933699", "5.5", "6", "8", "10", "20", "100", "1000"]: line(ax, S("C_light_b" + b), "light b=" + b[:6])
for r0 in [2, 6, 10]:
    rec = S(f"D_infall_r{r0}"); ax.plot([p[1] for p in rec], [max(p[2], 1e-18) for p in rec], lw=1, ls=":", label=f"infall r0={r0}")
HAS_PL = "plunge" in A["info"]
for n, lab in [("E_rk4_r4_inward", "plunge r=4-1e-4 (L=4)" + (": double-double" if HAS_PL else "")), ("E_rk4_r5_inward", "plunge r=5-1e-4" + (": double-double" if HAS_PL else ""))]: line(ax, S(n), lab, ls="--")
if HAS_PL:
    for n, lab in [("E_rk4_r4_inward_plain", "r=4 plunge: plain double"), ("E_rk4_r5_inward_plain", "r=5 plunge: plain double")]: line(ax, S(n), lab, ls=":")
ax.axhline(1e-10, color="k", ls="--", lw=.8, label="limit 1e-10"); ax.set_yscale("log"); ax.set_xscale("symlog", linthresh=1); ax.set_xlim(left=0); ax.set_xlabel("T (M)"); ax.set_ylabel("constraint residual")
ax.set_title("E: RK4 paths (light, infall, plunges), residual vs T"); ax.legend(fontsize=6, ncol=2); ax.grid(alpha=.3); fig.tight_layout(); fig.savefig(out("residual_vs_T_rk4.png"), dpi=110)
# 4 convergence
NP = 3 if "plunge" in A["info"] else 2
fig, axs = plt.subplots(1, NP, figsize=(6.5 * NP, 5))
for row in CV["verlet"]:
    pts = {}
    for pr in row["pairs"]: pts[pr["eta"]] = pr["err"]; pts[pr["etaHalf"]] = pr["errHalf"]
    xs = sorted(pts); axs[0].loglog(xs, [pts[x] for x in xs], "o-", label=row["case"])
xs = [0.002, 0.008]; axs[0].loglog(xs, [2e-7 * (x / 0.002) ** 2 for x in xs], "k:", label="slope 2")
axs[0].axhline(1e-4, color="gray", ls="--", lw=.8); axs[0].set_xlabel("eta (dtau = eta r_p^1.5/sqrt(M))"); axs[0].set_ylabel("rel. error of periapsis shift"); axs[0].set_title("Verlet: shift error vs eta (periapsis = cubic Hermite rdot zero crossing)"); axs[0].legend(fontsize=6); axs[0].grid(alpha=.3, which="both")
byb = {}
for r in CV["rk4"]: byb.setdefault(r["b"], {}).update({r["eta"]: r["err"], r["etaHalf"]: r["errHalf"]})
for b, d in byb.items():
    xs = sorted(d); axs[1].loglog(xs, [max(d[x], 1e-16) for x in xs], "o-", label=f"b={b:.4g}")
xs = [0.001, 0.016]; axs[1].loglog(xs, [4.5e-8 * (x / 0.001) ** 4 for x in xs], "k:", label="slope 4"); axs[1].axhline(1e-8, color="gray", ls="--", lw=.8); axs[1].axhline(1e-9, color="r", ls=":", lw=.8, label="p only above 1e-9")
axs[1].set_xlabel("eta (h = eta r^1.5/sqrt(M))"); axs[1].set_ylabel("rel. error of deflection"); axs[1].set_title("RK4 light: deflection error vs eta"); axs[1].legend(fontsize=6); axs[1].grid(alpha=.3, which="both")
if NP == 3:
    ax = axs[2]; col = {"r4_inward": "tab:blue", "r5_inward": "tab:orange"}; mk = {-2: "o", -1: "s", 0: "^"}
    for c in A["info"]["plunge"]["cases"]:
        pass
    for case in ["r4_inward", "r5_inward"]:
        for dec in [-2, -1, 0]:
            xs, ys, fl = [], [], []
            for c in sorted([c for c in A["info"]["plunge"]["cases"] if c["case"] == case], key=lambda c: c["eta"]):
                d = [d for d in c["decades"] if d["decade"] == dec]
                if d: xs.append(c["eta"]); ys.append(d[0]["ddMax"]); fl.append(d[0]["floorMax"])
            ax.loglog(xs, ys, mk[dec] + "-", color=col[case], alpha=.4 + .3 * (dec + 2) / 2, label=f"{case} r in 1e{dec} decade: double-double")
            ax.loglog(xs, fl, mk[dec] + ":", color="gray", ms=3)
    ax.loglog([5e-5, 2e-4], [1e-9 * (x / 2e-4) ** 4 for x in [5e-5, 2e-4]], "k--", lw=.8, label="slope 4 (expected)"); ax.axhline(1e-10, color="r", ls="--", lw=.8, label="gate 1e-10")
    ax.set_xlabel("eta"); ax.set_ylabel("max DD residual per decade of r (gray dotted: round-off floor)"); ax.set_title("plunges: DD residual vs eta (does NOT fall as eta^4)"); ax.legend(fontsize=5); ax.grid(alpha=.3, which="both")
fig.tight_layout(); fig.savefig(out("convergence.png"), dpi=110)
# 5 infall check
fig, axs = plt.subplots(1, 2, figsize=(13, 5))
for r0 in [2, 6, 10]:
    rec = S(f"D_infall_r{r0}"); par = [p[0] for p in rec]; T = [p[1] for p in rec]; r = [p[3] for p in rec]
    an = [(2 / 3) * (r0 ** 1.5 - x ** 1.5) / math.sqrt(2) for x in r]
    axs[0].semilogy(par, [max(abs(a - b) / max(b, 1e-12), 1e-18) for a, b in zip(par, an)], lw=1, label=f"r0={r0}: |tau - analytic(r)|/tau")
    axs[1].semilogy(par, [max(abs(t - p) / (1 + p), 1e-18) for t, p in zip(T, par)], lw=1, label=f"r0={r0}")
axs[0].set_xlabel("tau"); axs[0].set_title("infall: tau vs (2/3)(r0^1.5-r^1.5)/sqrt(2M)"); axs[0].legend(fontsize=7); axs[0].grid(alpha=.3, which="both")
axs[1].axhline(1e-10, color="k", ls="--", lw=.8, label="limit 1e-10"); axs[1].set_xlabel("tau"); axs[1].set_title("|T - tau|/(1+tau/M), E=1, L=0 (through r=2M)"); axs[1].legend(fontsize=7); axs[1].grid(alpha=.3, which="both")
fig.tight_layout(); fig.savefig(out("infall_check.png"), dpi=110)
print("wrote", os.listdir(P))
