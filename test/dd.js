// Double-double helper (TEST CODE ONLY; the engine state stays Float64). ~106-bit significand, Dekker/Knuth error-free transforms.
'use strict';
const twoSum = (a, b) => { const s = a + b, bb = s - a; return [s, (a - (s - bb)) + (b - bb)]; };
const split = (a) => { const c = 134217729 * a, hi = c - (c - a); return [hi, a - hi]; };
const twoProd = (a, b) => { const p = a * b, [ah, al] = split(a), [bh, bl] = split(b); return [p, ((ah * bh - p) + ah * bl + al * bh) + al * bl]; };
const dd = (x) => [x, 0];
function add(a, b) { let [s, e] = twoSum(a[0], b[0]); e += a[1] + b[1]; const h = s + e; return [h, e - (h - s)]; }
const neg = (a) => [-a[0], -a[1]];
function mul(a, b) { let [p, e] = twoProd(a[0], b[0]); e += a[0] * b[1] + a[1] * b[0]; const h = p + e; return [h, e - (h - p)]; }
function div(a, b) { const q1 = a[0] / b[0]; let r = add(a, neg(mul(dd(q1), b))); const q2 = r[0] / b[0]; r = add(r, neg(mul(dd(q2), b))); const q3 = r[0] / b[0]; return add(add(dd(q1), dd(q2)), dd(q3)); }
// |rdot^2 + V^2 - E^2| for a massive body, V^2 = (1-2M/r)(1+L^2/r^2), M = 1, evaluated in double-double from the stored doubles (null: without the 1)
function residualDD(b) {
  const M = b.M, r = dd(b.r), L = dd(b.L), rd = dd(b.rdot), E = dd(b.E);
  const f = add(dd(1), neg(div(dd(2 * M), r))), L2 = mul(L, L), t = div(L2, mul(r, r)), g = add(b.kind === 'massive' ? dd(1) : dd(0), t);
  const V2 = mul(f, g), res = add(add(mul(rd, rd), V2), neg(mul(E, E)));
  return Math.abs(res[0] + res[1]) / (b.E * b.E);
}
const EPS = Math.pow(2, -53);
function floorOf(b) { const V2 = Math.abs((1 - 2 * b.M / b.r) * ((b.kind === 'massive' ? 1 : 0) + b.L * b.L / (b.r * b.r))); return EPS * Math.max(b.rdot * b.rdot, V2, b.E * b.E) / (b.E * b.E); }
module.exports = { dd, add, mul, div, neg, residualDD, floorOf, EPS };
