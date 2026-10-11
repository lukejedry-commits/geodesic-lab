#!/usr/bin/env node
// Prints the playback-independence table (ASSERTS J): node test/playback_check.js [out.json]
'use strict';
const { runAll } = require('./playback_core.js'); const res = runAll(); let allOK = true;
for (const c of res) {
  console.log(`\n${c.id}: ${c.desc}, final T = ${c.Tfinal}`);
  for (const r of c.runs) console.log(`  ${r.partition.padEnd(36)} speed ${String(r.speed).padStart(2)}x  frames ${String(r.frames).padStart(6)}  first dts ${r.firstFrameDts.map((x) => x.toFixed(4)).join(',')}  steps ${r.steps}  status ${r.status}`);
  const ref = c.runs[0]; const keys = Object.keys(ref.hex); let ok = true;
  for (const r of c.runs.slice(1)) { if (r.steps !== ref.steps) ok = false; for (const k of keys) if (r.hex[k] !== ref.hex[k]) ok = false; }
  allOK = allOK && ok; c.identical = ok;
  console.log('  hex of doubles (partition 1): ' + keys.map((k) => `${k}=${ref.hex[k]}`).join(' '));
  for (const r of c.runs.slice(1)) console.log(`  partition vs 1: steps ${r.steps === ref.steps ? 'same' : 'DIFFER'}; ` + keys.map((k) => `${k}:${r.hex[k] === ref.hex[k] ? '=' : 'DIFF ' + r.hex[k]}`).join(' '));
  console.log('  => ' + (ok ? 'BITWISE IDENTICAL' : 'NOT identical'));
}
if (process.argv[2]) require('fs').writeFileSync(process.argv[2], JSON.stringify(res, null, 1));
console.log('\nALL ' + (allOK ? 'IDENTICAL' : 'NOT IDENTICAL')); process.exit(allOK ? 0 : 1);
