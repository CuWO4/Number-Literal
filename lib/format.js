'use strict';

const F = require('./float');

const CTRL_NAMES = [
  'NUL', 'SOH', 'STX', 'ETX', 'EOT', 'ENQ', 'ACK', 'BEL',
  'BS', 'HT', 'LF', 'VT', 'FF', 'CR', 'SO', 'SI',
  'DLE', 'DC1', 'DC2', 'DC3', 'DC4', 'NAK', 'SYN', 'ETB',
  'CAN', 'EM', 'SUB', 'ESC', 'FS', 'GS', 'RS', 'US'
];

function isVisible(code) {
  return code >= 0x21 && code <= 0x7e;
}

function asciiName(code) {
  if (code >= 0 && code < 0x20) return CTRL_NAMES[code];
  if (code === 0x20) return 'SP';
  if (code === 0x7f) return 'DEL';
  return null;
}

function cell(value) {
  return '`' + String(value).split('|').join('\\|') + '`';
}

// Four bits per group, eight groups (32 bits) per line.
function bitLines(bitString) {
  const padded = bitString.padStart(Math.ceil(bitString.length / 4) * 4, '0');
  const groups = padded.match(/.{4}/g) || [];
  const lines = [];
  for (let i = 0; i < groups.length; i += 8) lines.push(groups.slice(i, i + 8).join(' '));
  return lines;
}

function octalDigits(u, negative, width) {
  if (u === 0n) return '0';
  const digits = u.toString(8);
  return '0' + (negative ? digits.padStart(Math.ceil(width / 3), '0') : digits);
}

function orderedBytes(bits, byteCount, endian) {
  const bytes = F.bytesOf(bits, byteCount);
  return endian === 'LE' ? bytes.reverse() : bytes;
}

function memoryHex(bits, byteCount, endian) {
  return orderedBytes(bits, byteCount, endian)
    .map(b => b.toString(16).toUpperCase().padStart(2, '0'))
    .join(' ');
}

function memoryBinary(bits, byteCount, endian) {
  const bits8 = orderedBytes(bits, byteCount, endian)
    .map(b => b.toString(2).padStart(8, '0'))
    .join('');
  return bitLines(bits8);
}

const SETTINGS_LINK = '[Settings](command:workbench.action.openSettings?%22numberLiteral%22)';

function footer(state, settings) {
  if (state.length === 0) return '';
  const chips = state.map(name => '`' + name + '`').join(' ');
  const names = settings.map(name => '`' + name + '`').join(' and ');
  return '\n' + chips + '\n\n> Change ' + names + ' in ' + SETTINGS_LINK + '.\n';
}

function table(rows) {
  let md = '| **`ATTR`** | **`VAL`** |\n| --- | --- |\n';
  for (const [attr, lines] of rows) {
    lines.forEach((line, index) => {
      md += '| ' + (index === 0 ? '`' + attr + '`' : '') + ' | ' + cell(line) + ' |\n';
    });
  }
  return md;
}

function integerCard(parsed, opts) {
  const width = opts.width === 'DWORD' ? 32 : 64;
  const u = BigInt.asUintN(width, parsed.value);
  const s = BigInt.asIntN(width, parsed.value);
  const negative = s < 0n;
  const hex = u.toString(16).toUpperCase();
  const rows = [
    ['DEC-S', [s.toString()]],
    ['DEC-U', [u.toString()]],
    ['HEX', ['0x' + (negative ? hex.padStart(width / 4, '0') : hex)]],
    ['OCT', [octalDigits(u, negative, width)]],
    ['BIN', bitLines(u.toString(2).padStart(width, '0'))]
  ];
  if (u > 0n && u < 128n) {
    const code = Number(u);
    rows.push(['ASCII', [isVisible(code) ? "'" + String.fromCharCode(code) + "'" : asciiName(code)]]);
  }
  rows.push(['MEM', [memoryHex(u, width / 8, opts.endian)].concat(memoryBinary(u, width / 8, opts.endian))]);
  return table(rows) + footer(
    [width + '-bit', opts.endianName],
    ['numberLiteral.width', 'numberLiteral.endianness']
  );
}

function floatBlock(name, bits, fmt, byteCount, opts) {
  const repr = F.floatRepr(bits, fmt, 6);
  return table([
    [name, [repr.fixed, repr.sci, repr.hex]],
    ['MEM', [memoryHex(bits, byteCount, opts.endian)].concat(memoryBinary(bits, byteCount, opts.endian))]
  ]);
}

function floatCard(parsed, opts) {
  const single = F.bitsFor(parsed, F.F32);
  const double = F.bitsFor(parsed, F.F64);
  return floatBlock('F32', single, F.F32, 4, opts)
    + '\n---\n\n'
    + floatBlock('F64', double, F.F64, 8, opts)
    + footer([opts.endianName], ['numberLiteral.endianness']);
}

function charCard(parsed) {
  const code = parsed.code;
  const rows = [
    ['DEC', [String(code)]],
    ['HEX', ['0x' + code.toString(16).toUpperCase()]],
    ['OCT', [octalDigits(BigInt(code), false)]],
    ['BIN', bitLines(code.toString(2).padStart(8, '0'))]
  ];
  if (!isVisible(code)) {
    const name = asciiName(code);
    if (name) rows.push(['NAME', [name]]);
  } else {
    rows.push(['REPR', ["'" + String.fromCharCode(code) + "'"]])
  }
  return table(rows);
}

function renderCard(match, opts) {
  const endian = opts.endian === 'BE' ? 'BE' : 'LE';
  const options = {
    width: opts.width,
    endian,
    endianName: endian === 'BE' ? 'BIG ENDIAN' : 'LITTLE ENDIAN'
  };
  const parsed = match.parsed;
  if (parsed.kind === 'int') return integerCard(parsed, options);
  if (parsed.kind === 'float') return floatCard(parsed, options);
  return charCard(parsed);
}

module.exports = { renderCard };
