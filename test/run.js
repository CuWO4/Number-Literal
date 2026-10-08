'use strict';

const { analyzeLine } = require('../lib/scan');
const { renderCard } = require('../lib/format');

let passed = 0;
let failed = 0;

function show(value) {
  if (typeof value === 'bigint') return value.toString() + 'n';
  return JSON.stringify(value);
}

function eq(name, actual, expected) {
  const a = show(actual);
  const e = show(expected);
  if (a === e) {
    passed++;
  } else {
    failed++;
    console.log('FAIL ' + name + '\n  actual   ' + a + '\n  expected ' + e);
  }
}

function hover(text, offset) {
  const m = analyzeLine(text, offset);
  return m ? m.text : null;
}

function parsed(text, offset) {
  const m = analyzeLine(text, offset);
  return m ? m.parsed : null;
}

function tokenCases() {
  const cases = [
    ['x = 123;', 5, '123'],
    ['abc123def', 4, null],
    ['xyz123', 4, null],
    ['123abc', 1, null],
    ['123xyz', 1, null],
    ['v1.5', 2, null],
    ['_1', 1, null],
    ['1_000', 0, '1_000'],
    ['1.5.3', 2, null],
    ['1.5.3', 4, null],
    ['1..2', 2, null],
    ['0xFF.5', 2, null],
    ['x-1', 2, '-1'],
    ['12-34', 1, '12'],
    ['12-34', 4, '-34'],
    ['--1', 2, '-1'],
    ['1-2', 2, '-2'],
    ['0x1-2', 4, '-2'],
    ['1e-5', 3, '1e-5'],
    ['1e-5', 1, '1e-5'],
    ['1e+5', 3, '1e+5'],
    ['1.5e-3', 4, '1.5e-3'],
    ['0x1p-3', 3, '0x1p-3'],
    ['0x1.8p3', 1, '0x1.8p3'],
    ["'a'", 1, "'a'"],
    ["'\\x67'", 3, "'\\x67'"],
    ["'\\053'", 3, "'\\053'"],
    ["'123'", 2, null],
    ["'ab'", 1, null],
    ["''", 1, null],
    ['\\x41', 2, '\\x41'],
    ['\\101', 2, null],
    ['\\n', 1, null],
    ['"\\x41"', 3, '\\x41'],
    ['0xFFG', 2, '0xFFG'],
    ['08', 0, null],
    ['1f', 0, null],
    ['1e', 0, null],
    ['0x', 1, null],
    ['0b2', 1, null],
    ['0777', 3, '0777'],
    ['0o777', 1, '0o777'],
    ['0b1010', 1, '0b1010'],
    ['1ull', 0, '1ull'],
    ['0xFFull', 2, '0xFFull'],
    ['1LL', 0, '1LL'],
    ['1.0L', 0, '1.0L'],
    ["1''000", 3, null],
    ["1'000'000", 5, "1'000'000"],
    ['0x1F', 1, '0x1F'],
    ['0X1F', 1, '0X1F'],
    ['3.14', 1, '3.14'],
    ['1.', 0, '1.'],
    ['.5', 1, '.5'],
    ['1.e5', 1, '1.e5'],
    ['p.x', 1, null],
    ['e5', 1, null],
    ['value 42 here', 6, '42'],
    ['f(0xFF)', 4, '0xFF'],
    ['a[0]', 2, '0'],
    ['(1+2)', 1, '1'],
    ['(1+2)', 3, '+2'],
    ['0b' + '1'.repeat(40), 5, null]
  ];
  for (const c of cases) {
    eq('hover(' + JSON.stringify(c[0]) + ', ' + c[1] + ')', hover(c[0], c[1]), c[2]);
  }
}

function valueCases() {
  eq('int 0x1F', parsed('0x1F', 1).value, 31n);
  eq('int 0777', parsed('0777', 3).value, 511n);
  eq('int 0o777', parsed('0o777', 1).value, 511n);
  eq('int 0b1010', parsed('0b1010', 1).value, 10n);
  eq('int 1e5 is float', parsed('1e5', 1).kind, 'float');
  eq("int 1'000'000", parsed("1'000'000", 5).value, 1000000n);
  eq('int -1', parsed('-1', 1).value, -1n);
  eq('int \\x41', parsed('\\x41', 2).value, 65n);
  eq('int \\x1FF wraps', parsed('\\x1FF', 2).value, 255n);
  eq('int 1ull', parsed('1ull', 0).value, 1n);
  eq("char 'a'", parsed("'a'", 1).code, 97);
  eq("char '\\n'", parsed("'\\n'", 2).code, 10);
  eq("char '\\0'", parsed("'\\0'", 2).code, 0);
  eq("char '\\\\'", parsed("'\\\\'", 2).code, 92);
  eq("char '\\''", parsed("'\\''", 2).code, 39);
  eq("char '\\x41'", parsed("'\\x41'", 3).code, 65);
  eq("char '\\777' wraps", parsed("'\\777'", 3).code, 255);
  eq('float 3.14 kind', parsed('3.14', 1).kind, 'float');
}

function rows(md, attr, occurrence) {
  const wanted = occurrence || 1;
  const out = [];
  let seen = 0;
  let on = false;
  for (const line of md.split('\n')) {
    const m = /^\|(.*)\|(.*)\|$/.exec(line);
    if (!m) {
      on = false;
      continue;
    }
    const a = m[1].trim();
    const v = m[2].trim().replace(/^`|`$/g, '');
    if (a === '`' + attr + '`') {
      seen++;
      on = seen === wanted;
      if (on) out.push(v);
    } else if (on && a === '') {
      out.push(v);
    } else {
      on = false;
    }
  }
  return out;
}

function card(text, offset, opts) {
  const m = analyzeLine(text, offset);
  if (!m) throw new Error('no match for ' + text);
  return renderCard(m, opts || { width: 'QWORD', endian: 'LE' });
}

function cardCases() {
  let md = card('-1', 1, { width: 'DWORD', endian: 'LE' });
  eq('DWORD -1 DEC-S', rows(md, 'DEC-S'), ['-1']);
  eq('DWORD -1 DEC-U', rows(md, 'DEC-U'), ['4294967295']);
  eq('DWORD -1 HEX', rows(md, 'HEX'), ['0xFFFFFFFF']);
  eq('DWORD -1 OCT', rows(md, 'OCT'), ['0' + '3' + '7'.repeat(10)]);
  eq('DWORD -1 BIN', rows(md, 'BIN'), ['1111 1111 1111 1111 1111 1111 1111 1111']);
  eq('DWORD -1 MEM hex', rows(md, 'MEM')[0], 'FF FF FF FF');

  md = card('-1', 1, { width: 'QWORD', endian: 'BE' });
  eq('QWORD -1 BE MEM hex', rows(md, 'MEM')[0], 'FF FF FF FF FF FF FF FF');
  eq('QWORD -1 BE HEX', rows(md, 'HEX'), ['0xFFFFFFFFFFFFFFFF']);

  md = card('0x41', 2, { width: 'QWORD', endian: 'LE' });
  eq('0x41 DEC-U', rows(md, 'DEC-U'), ['65']);
  eq('0x41 HEX', rows(md, 'HEX'), ['0x41']);
  eq('0x41 OCT', rows(md, 'OCT'), ['0101']);
  eq('0x41 BIN', rows(md, 'BIN'), [
    '0000 0000 0000 0000 0000 0000 0000 0000',
    '0000 0000 0000 0000 0000 0000 0100 0001'
  ]);
  eq('0x41 ASCII', rows(md, 'ASCII'), ["'A'"]);
  eq('0x41 MEM hex', rows(md, 'MEM')[0], '41 00 00 00 00 00 00 00');
  eq('0x41 MEM binary', rows(md, 'MEM')[1], '0100 0001 0000 0000 0000 0000 0000 0000');
  eq('0x41 footer state', md.indexOf('`64-bit` `LITTLE ENDIAN`') >= 0, true);
  eq('0x41 footer settings link', md.indexOf('(command:workbench.action.openSettings') >= 0, true);
  eq('0x41 footer names settings',
    md.indexOf('`numberLiteral.width`') >= 0 && md.indexOf('`numberLiteral.endianness`') >= 0, true);

  md = card('0x41', 2, { width: 'QWORD', endian: 'BE' });
  eq('0x41 MEM hex BE', rows(md, 'MEM')[0], '00 00 00 00 00 00 00 41');
  eq('0x41 BIN is big endian memory',
    rows(md, 'BIN').join('|'), rows(md, 'MEM').slice(1).join('|'));

  md = card('0x20', 2, { width: 'QWORD', endian: 'LE' });
  eq('0x20 ASCII', rows(md, 'ASCII'), ['SP']);

  md = card('0x00', 2, { width: 'QWORD', endian: 'LE' });
  eq('0x00 DEC-U', rows(md, 'DEC-U'), ['0']);
  eq('0x00 HEX', rows(md, 'HEX'), ['0x0']);
  eq('0x00 OCT', rows(md, 'OCT'), ['0']);
  eq('0x00 BIN', rows(md, 'BIN'), [
    '0000 0000 0000 0000 0000 0000 0000 0000',
    '0000 0000 0000 0000 0000 0000 0000 0000'
  ]);
  eq('0x00 no ASCII', rows(md, 'ASCII'), []);

  md = card('0x01', 2, { width: 'QWORD', endian: 'LE' });
  eq('0x01 ASCII', rows(md, 'ASCII'), ['SOH']);

  md = card("'\\n'", 2, { width: 'QWORD', endian: 'LE' });
  eq('char \\n DEC', rows(md, 'DEC'), ['10']);
  eq('char \\n HEX', rows(md, 'HEX'), ['0xA']);
  eq('char \\n OCT', rows(md, 'OCT'), ['012']);
  eq('char \\n BIN', rows(md, 'BIN'), ['0000 1010']);
  eq('char \\n NAME', rows(md, 'NAME'), ['LF']);
  eq('char \\n no footer', md.indexOf('numberLiteral') < 0, true);

  md = card("'A'", 1, { width: 'QWORD', endian: 'LE' });
  eq("char 'A' DEC", rows(md, 'DEC'), ['65']);
  eq("char 'A' NAME", rows(md, 'NAME'), []);

  md = card('3.14', 2, { width: 'QWORD', endian: 'LE' });
  eq('3.14 F32', rows(md, 'F32'), ['3.140000', '3.140000E+00', '0x1.91EB86P+1']);
  eq('3.14 F64', rows(md, 'F64'), ['3.140000', '3.140000E+00', '0x1.91EB851EB851FP+1']);
  eq('3.14 F32 memory', rows(md, 'MEM', 1), ['C3 F5 48 40', '1100 0011 1111 0101 0100 1000 0100 0000']);
  eq('3.14 F64 memory', rows(md, 'MEM', 2), [
    '1F 85 EB 51 B8 1E 09 40',
    '0001 1111 1000 0101 1110 1011 0101 0001',
    '1011 1000 0001 1110 0000 1001 0100 0000'
  ]);  eq('3.14 footer endian only', md.indexOf('`LITTLE ENDIAN`') >= 0 && md.indexOf('numberLiteral.width') < 0, true);

  md = card('3.14', 2, { width: 'QWORD', endian: 'BE' });
  eq('3.14 BE F32 memory', rows(md, 'MEM', 1), ['40 48 F5 C3', '0100 0000 0100 1000 1111 0101 1100 0011']);

  md = card('3.14f', 3, { width: 'QWORD', endian: 'LE' });
  eq('3.14f F32', rows(md, 'F32'), ['3.140000', '3.140000E+00', '0x1.91EB86P+1']);

  md = card('0.0', 1, { width: 'QWORD', endian: 'LE' });
  eq('0.0 F32', rows(md, 'F32'), ['0.000000', '0.000000E+00', '0x0P+0']);

  md = card('-0.0', 2, { width: 'QWORD', endian: 'LE' });
  eq('-0.0 F32', rows(md, 'F32'), ['-0.000000', '-0.000000E+00', '-0x0P+0']);

  md = card('1e400', 3, { width: 'QWORD', endian: 'LE' });
  eq('1e400 F32', rows(md, 'F32'), ['inf', 'inf', 'inf']);
  eq('1e400 F64', rows(md, 'F64'), ['inf', 'inf', 'inf']);

  md = card('1e-400', 3, { width: 'QWORD', endian: 'LE' });
  eq('1e-400 F32', rows(md, 'F32'), ['0.000000', '0.000000E+00', '0x0P+0']);

  md = card('3.141592653589793', 4, { width: 'QWORD', endian: 'LE' });
  eq('pi F64 fixed', rows(md, 'F64')[0], '3.141593');
}

function charCases() {
  const accepted = [
    ["'a'", 97], ["'Z'", 90], ["'0'", 48], ["' '", 32], ["'@'", 64], ["'#'", 35],
    ["'|'", 124], ["')'", 41], ["'='", 61], ["'.'", 46], ["','", 44], ["'~'", 126],
    ["'*'", 42], ["'\u00e9'", 233],
    ["'\\a'", 7], ["'\\b'", 8], ["'\\f'", 12], ["'\\n'", 10], ["'\\r'", 13],
    ["'\\t'", 9], ["'\\v'", 11], ["'\\0'", 0], ["'\\\\'", 92], ["'\\''", 39],
    ["'\\\"'", 34], ["'\\?'", 63],
    ["'\\7'", 7], ["'\\77'", 63], ["'\\777'", 255], ["'\\400'", 0],
    ["'\\x0'", 0], ["'\\x41'", 65], ["'\\xff'", 255], ["'\\x0041'", 65],
    ["'\\xFFFFFFFF'", 255]
  ];
  for (const entry of accepted) {
    const p = parsed(entry[0], 1);
    eq('char ' + entry[0], p && p.kind === 'char' ? p.code : null, entry[1]);
  }

  const rejected = ["''", "'ab'", "'123'", "'\\x'", "'\\8'", "'\\q'", "'\\xZZ'", "'a", "'\\'"];
  for (const text of rejected) {
    eq('char rejected ' + text, hover(text, 1), null);
  }

  eq('char span bound', hover("'" + 'a'.repeat(13) + "'", 3), null);
  eq('char cursor on open quote', hover("'a'", 0), "'a'");
  eq('char cursor on close quote', hover("'a'", 2), "'a'");
  eq('char between two literals', hover("'a' + 'b'", 4), null);
  eq('char after literal', hover("'a' 42", 4), '42');

  eq('card \\0 DEC', rows(card("'\\0'", 2), 'DEC'), ['0']);
  eq('card \\0 HEX', rows(card("'\\0'", 2), 'HEX'), ['0x0']);
  eq('card \\0 BIN', rows(card("'\\0'", 2), 'BIN'), ['0000 0000']);
  eq('card \\0 OCT', rows(card("'\\0'", 2), 'OCT'), ['0']);
  eq('card \\0 NAME', rows(card("'\\0'", 2), 'NAME'), ['NUL']);
  eq('card space NAME', rows(card("' '", 1), 'NAME'), ['SP']);
  eq('card 0x7f NAME', rows(card("'\\x7f'", 3), 'NAME'), ['DEL']);
  eq('card A no NAME', rows(card("'A'", 1), 'NAME'), []);
  eq('card e9 DEC', rows(card("'\u00e9'", 1), 'DEC'), ['233']);
  eq('card e9 HEX', rows(card("'\u00e9'", 1), 'HEX'), ['0xE9']);
  eq('card x13 BIN', rows(card("'\\x13'", 3), 'BIN'), ['0001 0011']);
  eq('card x13 OCT', rows(card("'\\x13'", 3), 'OCT'), ['023']);
  eq('card e9 no NAME', rows(card("'\u00e9'", 1), 'NAME'), []);
}

function extraCases() {
  eq('int 0x7C ASCII escaped', card('0x7C', 2).indexOf("'\\|'") >= 0, true);

  eq('3.14 F32 memory BE', rows(card('3.14', 2, { width: 'QWORD', endian: 'BE' }), 'MEM', 1),
    ['40 48 F5 C3', '0100 0000 0100 1000 1111 0101 1100 0011']);
  eq('3.14 F64 memory BE hex', rows(card('3.14', 2, { width: 'QWORD', endian: 'BE' }), 'MEM', 2)[0],
    '40 09 1E B8 51 EB 85 1F');

  eq('table header', card('0x41', 2).split('\n')[0], '| **`ATTR`** | **`VAL`** |');

  eq('long binary literal', hover('0b' + '1'.repeat(30), 5), null);
  eq('short binary literal', hover('0b1010ull', 3), '0b1010ull');
}

function newSpellingCases() {
  const accepted = [
    '1_000', '1_000_000', '0x1_F', '0b1010_0101', '0o7_5_5', '1_000.5',
    '123_u32', '123u32', '1u8', '1u128', '1usize', '1i128', '1isize',
    '42n', '42N', '42G', '42g', '42I', '42L', '42UL', '1s', '1us', '1y', '1uy',
    '1.0f', '1.5L', '1.0f32', '1.0f64', '1.0f0', '1.5d', '1.5D', '12E+99_f64',
    '1.',
    '.5',
    '0x1.p3', '0x.8p3', '.5e3', '1.e5'
  ];
  for (const text of accepted) {
    eq('spelling accepted ' + text, hover(text, text[0] === '.' ? 1 : 0), text);
  }

  const rejected = [
    '1f', '1i', '1r', '1j', '1.5m', '1.5M', '1_', '1__000', '100__000',
    '1m', '1.5n', '1.0L4', '1e', '1e+', '0x1p', '0b2', '08',
    '.', '0xp3', '0x.p3', '1.e'
  ];
  for (const text of rejected) {
    eq('spelling rejected ' + text, hover(text, 0), null);
  }

  eq('spelling 0xFFG value', parsed('0xFFG', 2).value, 255n);
  eq('spelling 1_000 value', parsed('1_000', 0).value, 1000n);
  eq('spelling 0x1_F value', parsed('0x1_F', 0).value, 31n);
  eq('spelling 0b1010_0101 value', parsed('0b1010_0101', 0).value, 165n);
  eq('spelling 123_u32 value', parsed('123_u32', 0).value, 123n);
  eq('spelling 42n kind', parsed('42n', 0).kind, 'int');
  eq('spelling 1.0f0 kind', parsed('1.0f0', 0).kind, 'float');
  eq('spelling 1.5d kind', parsed('1.5d', 0).kind, 'float');
  eq('spelling 1_ value', parsed('1_', 0), null);

  eq('adjacency 10%2 left', hover('10%2', 1), '10');
  eq('adjacency 10%2 right', hover('10%2', 3), '2');
  eq('adjacency a&1', hover('a&1', 2), '1');
  eq('adjacency 50%', hover('50%', 0), '50');
  eq('adjacency 1#c', hover('1#c', 0), '1');
  eq('adjacency x_1', hover('x_1', 2), null);
  eq('adjacency 1_000 union', hover('a1_000', 3), null);

  eq('unsupported $1F', hover('$1F', 2), null);
  eq('unsupported #x1F', hover('#x1F', 3), null);
  eq('unsupported 16#FF', hover('16#FF', 1), '16');
  eq('unsupported %1010', hover('%1010', 1), '1010');
  eq('unsupported &HFF', hover('&HFF', 2), null);

  const md = card('1_000', 0, { width: 'QWORD', endian: 'LE' });
  eq('spelling card DEC-U', rows(md, 'DEC-U'), ['1000']);
  eq('spelling card HEX', rows(md, 'HEX'), ['0x3E8']);
}

tokenCases();
valueCases();
cardCases();
charCases();
extraCases();
newSpellingCases();

console.log('passed ' + passed + ', failed ' + failed);
process.exit(failed === 0 ? 0 : 1);
