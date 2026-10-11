#!/usr/bin/env python3
# Redraws the plunge residual curves (default eta = 1e-4): 64-bit state evaluated in double-double and in plain double, next to the shadow double-double-state residual.
# Data: results/step8_plots_speed/runs/*_curves.json (windowed max over 40 steps; reproduces the stored whole-run maxima of results/step3_shadow, step5_plunge_eta bit for bit).
import json, os
import numpy as np
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
R = os.path.join(os.path.dirname(__file__), '..', 'results', 'step8_plots_speed')
cases = [('r4_inward', 'r = 4-1e-4, L = 4'), ('r5_inward', 'r = 5-1e-4, L = 3.5355'), ('r8_L3p5_m1e-2', 'r = 8, L = 3.5, E^2 = Vmax(1+1e-2)')]
fig, ax = plt.subplots(2, 3, figsize=(17, 9))
for j, (c, ttl) in enumerate(cases):
    d = json.load(open(f'{R}/runs/{c}_eta0.0001_curves.json')); a = np.array(d['curves']); ns = json.load(open(f'{R}/runs/{c}_eta0.0001.json'))['steps']; T, r = a[:, 0], a[:, 1]
    for row in (0, 1):
        x = r if row == 0 else (T[-1] - T + 1e-9)
        k = ax[row][j]
        k.loglog(x, np.maximum(a[:, 3], 1e-18), color='tab:blue', lw=1.4, label='64-bit state, double-double residual (graded)')
        k.loglog(x, np.maximum(a[:, 4], 1e-18), color='tab:orange', lw=1.0, ls='--', label='64-bit state, plain-double residual')
        k.loglog(x, np.maximum(a[:, 2], 1e-18), color='tab:green', lw=1.4, label='shadow double-double STATE residual')
        k.loglog(x, np.maximum(a[:, 5], 1e-18), color='k', lw=0.8, ls=':', label='round-off floor eps*max(rdot^2,|V^2|,E^2)/E^2')
        k.axhline(1e-10, color='r', ls='--', lw=1.2, label='1e-10 gate')
        k.set_ylim(1e-17, 1e-7); k.invert_xaxis(); k.grid(alpha=.3, which='both')
        k.set_xlabel('r / M  (decreasing to the 0.05M cutoff)' if row == 0 else 'T_end - T  (PG time to the cutoff; decreasing)')
        k.set_ylabel('|rdot^2 + V^2 - E^2| / E^2 (window max)'); k.set_title(f'{ttl}\neta = 1e-4 (default), {ns} steps' if row == 0 else 'same data vs time to cutoff')
        if j == 0 and row == 0: k.legend(fontsize=7, loc='upper left')
plt.suptitle('Plunge residual, default eta = 1e-4: 64-bit state vs double-double-state shadow', y=0.995)
plt.tight_layout(); plt.savefig(f'{R}/residual_vs_T_rk4_plunges.png', dpi=110)
