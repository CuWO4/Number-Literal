'use strict';

const fs = require('fs');
const path = require('path');
const { analyzeLine } = require('../lib/scan');
const F = require('../lib/float');

const cases = fs.readFileSync(path.join(__dirname, 'cases.txt'), 'utf8')
  .split('\n')
  .map(l => l.trim())
  .filter(l => l !== '');

const out = [];
for (const text of cases) {
  const match = analyzeLine(text, 0);
  if (!match) {
    out.push(text + '\tNO MATCH');
    continue;
  }
  const p = match.parsed;
  const b64 = F.bitsFor(p, F.F64);
  const b32 = F.bitsFor(p, F.F32);
  const r64 = F.floatRepr(b64, F.F64, 6);
  const r32 = F.floatRepr(b32, F.F32, 6);
  out.push([text, r64.fixed, r64.sci, r64.hex, r32.fixed, r32.sci, r32.hex].join('\t'));
}
process.stdout.write(out.join('\n') + '\n');
