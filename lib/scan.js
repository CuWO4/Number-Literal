'use strict';

// Characters that may occur inside a numeric or character literal. Letters are
// limited to those that occur in some accepted spelling: hex digits, the radix
// letters, the exponent letters and the suffix letters.
const K_CHARS = new Set('0123456789abcdefABCDEFlLoOpPuUxXgGiInNsSyYzZ' + "._'+-\\");

// Characters that make a neighbouring literal part of a bigger word.
const C_WORD = /[A-Za-z0-9_.]/;

const MAX_RUN = 30;

const DIG = "[0-9](?:['_]?[0-9])*";
const HEXD = "[0-9a-fA-F](?:['_]?[0-9a-fA-F])*";
const OCTD = "[0-7](?:['_]?[0-7])*";
const BIND = "[01](?:['_]?[01])*";

const RE_INT_BODY = new RegExp(
  '^(0[xX]' + HEXD + '|0[bB]' + BIND + '|0[oO]' + OCTD + "|0(?:['_]?[0-7])*|[1-9](?:['_]?[0-9])*)(.*)$"
);

// Suffix free bodies; a suffix is split off before these are applied. Each
// alternative carries at least one digit, so a parsed body is never empty.
const FRACTION = '(?:' + DIG + '\\.(?:' + DIG + ')?|(?:' + DIG + ')?\\.' + DIG + ')';

const RE_DEC_FLOAT = new RegExp(
  '^(?:' + FRACTION + '(?:[eE][+-]?' + DIG + ')?|' + DIG + '[eE][+-]?' + DIG + ')$'
);

const RE_HEX_FLOAT = new RegExp(
  '^0[xX](?:' + HEXD + '(?:\\.(?:' + HEXD + ')?)?|(?:' + HEXD + ')?\\.' + HEXD + ')[pP][+-]?' + DIG + '$'
);

// Suffixes that only name an integer or floating point type. They are accepted
// and ignored; they never influence the reported value, width or sign.
const C_INT_SUFFIX = new Set(['', 'u', 'l', 'll', 'ul', 'lu', 'ull', 'llu']);
const TYPED_INT_SUFFIX = new Set([
  'n', 'N', 'L', 'UL', 'I', 'G', 'g',
  's', 'S', 'us', 'US', 'y', 'Y', 'uy', 'UY',
  'u8', 'u16', 'u32', 'u64', 'u128', 'usize',
  'i8', 'i16', 'i32', 'i64', 'i128', 'isize'
]);
const FLOAT_SUFFIX = ['f32', 'f64', 'f0', 'f', 'F', 'd', 'D', 'l', 'L'];
const FLOAT_SUFFIX_CANDIDATES = FLOAT_SUFFIX.concat(['']);

function isIntSuffix(suffix) {
  return C_INT_SUFFIX.has(suffix.toLowerCase()) || TYPED_INT_SUFFIX.has(suffix);
}

const SIMPLE_ESCAPES = {
  a: 7, b: 8, f: 12, n: 10, r: 13, t: 9, v: 11,
  "'": 39, '"': 34, '\\': 92, '?': 63
};

function isK(ch) {
  return K_CHARS.has(ch);
}

function stripSeparators(s) {
  return s.replace(/['_]/g, '');
}

function splitIntSuffix(rest) {
  const m = RE_INT_BODY.exec(rest);
  if (!m) return null;
  const body = m[1];
  let suffix = m[2];
  if (suffix.length > 1 && suffix[0] === '_') suffix = suffix.slice(1);
  return isIntSuffix(suffix) ? body : null;
}

function splitFloatSuffix(rest) {
  for (const suffix of FLOAT_SUFFIX_CANDIDATES) {
    if (suffix !== '' && !rest.endsWith(suffix)) continue;
    const body = suffix === '' ? rest : rest.slice(0, rest.length - suffix.length);
    if (body === '') continue;
    if (RE_HEX_FLOAT.test(body) || RE_DEC_FLOAT.test(body)) return body;
    if (suffix !== '' && (body.endsWith('_') || body.endsWith("'"))) {
      const trimmed = body.slice(0, -1);
      if (trimmed !== '' && (RE_HEX_FLOAT.test(trimmed) || RE_DEC_FLOAT.test(trimmed))) {
        return trimmed;
      }
    }
  }
  return null;
}

function parseCharLiteral(tok) {
  if (tok.length < 3 || tok[0] !== "'" || tok[tok.length - 1] !== "'") return null;
  const inner = tok.slice(1, -1);
  if (inner === '') return null;
  if (inner[0] === '\\') {
    const rest = inner.slice(1);
    if (/^x[0-9a-fA-F]+$/.test(rest)) {
      return { kind: 'char', code: Number(BigInt('0x' + rest.slice(1)) & 0xFFn) };
    }
    if (/^[0-7]{1,3}$/.test(rest)) {
      return { kind: 'char', code: Number(BigInt('0o' + rest) & 0xFFn) };
    }
    if (rest.length === 1 && Object.prototype.hasOwnProperty.call(SIMPLE_ESCAPES, rest)) {
      return { kind: 'char', code: SIMPLE_ESCAPES[rest] };
    }
    return null;
  }
  if (inner.length !== 1) return null;
  return { kind: 'char', code: inner.charCodeAt(0) };
}

function splitSign(tok) {
  if (tok[0] === '-') return { sign: -1, rest: tok.slice(1) };
  if (tok[0] === '+') return { sign: 1, rest: tok.slice(1) };
  return { sign: 1, rest: tok };
}

function parseIntLiteral(tok) {
  const { sign, rest } = splitSign(tok);
  if (rest === '') return null;

  const esc = /^\\x([0-9a-fA-F]+)$/.exec(rest);
  if (esc) {
    const v = BigInt('0x' + esc[1]) & 0xFFn;
    return { kind: 'int', value: sign < 0 ? -v : v };
  }

  const body = splitIntSuffix(rest);
  if (body === null) return null;

  let prefix = '';
  let digits = body;
  if (/^0[xX]/.test(body)) { prefix = '0x'; digits = body.slice(2); }
  else if (/^0[bB]/.test(body)) { prefix = '0b'; digits = body.slice(2); }
  else if (/^0[oO]/.test(body)) { prefix = '0o'; digits = body.slice(2); }
  else if (/^0/.test(body)) { prefix = '0o'; digits = body.slice(1) || '0'; }

  const value = BigInt(prefix + stripSeparators(digits));
  return { kind: 'int', value: sign < 0 ? -value : value };
}

function parseFloatLiteral(tok) {
  const { sign, rest } = splitSign(tok);
  if (rest === '') return null;

  const body = splitFloatSuffix(rest);
  if (body === null) return null;

  const hexm = /^0[xX]([0-9a-fA-F_']*)(?:\.([0-9a-fA-F_']*))?[pP]([+-]?[0-9_']+)$/.exec(body);
  if (hexm) {
    const ip = stripSeparators(hexm[1]);
    const fp = stripSeparators(hexm[2] || '');
    const pow = parseInt(stripSeparators(hexm[3]), 10);
    return { kind: 'float', sign, num: BigInt('0x' + (ip + fp)), den: 1n, exp2: pow - 4 * fp.length };
  }

  const dm = /^([0-9_']*)(?:\.([0-9_']*))?(?:[eE]([+-]?[0-9_']+))?$/.exec(body);
  const ip = stripSeparators(dm[1]);
  const fp = stripSeparators(dm[2] || '');
  const mant = BigInt(ip + fp);
  const exp10 = (dm[3] ? parseInt(stripSeparators(dm[3]), 10) : 0) - fp.length;
  if (mant === 0n) return { kind: 'float', sign, num: 0n, den: 1n, exp2: 0 };
  if (exp10 > 400) return { kind: 'float', sign, overflow: true };
  if (exp10 < -400) return { kind: 'float', sign, underflow: true };
  if (exp10 >= 0) return { kind: 'float', sign, num: mant * 10n ** BigInt(exp10), den: 1n, exp2: 0 };
  return { kind: 'float', sign, num: mant, den: 10n ** BigInt(-exp10), exp2: 0 };
}

function classify(tok) {
  const ch = parseCharLiteral(tok);
  if (ch) return ch;
  const float = parseFloatLiteral(tok);
  if (float) return float;
  return parseIntLiteral(tok);
}

function boundaryOk(text, s, e, kind) {
  if (s > 0) {
    const left = text[s - 1];
    if (kind === 'char') {
      if (C_WORD.test(left)) return false;
    } else {
      if (left === "'" || left === '\\') return false;
      const signed = text[s] === '+' || text[s] === '-';
      if (!signed && C_WORD.test(left)) return false;
    }
  }
  if (e + 1 < text.length) {
    const right = text[e + 1];
    if (right === "'") return false;
    if (C_WORD.test(right)) return false;
  }
  return true;
}

// A character literal is a delimited and bounded form, so it is matched as its
// own branch before the plain character set below. The bound keeps an apostrophe
// in prose from pairing with a distant quote.
const RE_CHAR_SPAN = /'(?:\\.|[^'\\\n]){1,12}'/g;

function charLiteralAt(text, offset) {
  RE_CHAR_SPAN.lastIndex = 0;
  let m;
  while ((m = RE_CHAR_SPAN.exec(text)) !== null) {
    const start = m.index;
    const end = start + m[0].length - 1;
    if (offset < start) return null;
    if (offset <= end) {
      const parsed = parseCharLiteral(m[0]);
      if (!parsed) return null;
      if (!boundaryOk(text, start, end, 'char')) return null;
      return { start, end, text: m[0], parsed };
    }
  }
  return null;
}

function analyzeLine(text, offset) {
  if (offset < 0 || offset >= text.length) return null;

  const ch = charLiteralAt(text, offset);
  if (ch) return ch;

  if (!isK(text[offset])) return null;

  let rs = offset;
  let re = offset;
  while (rs > 0 && isK(text[rs - 1])) rs--;
  while (re + 1 < text.length && isK(text[re + 1])) re++;

  const len = re - rs + 1;
  if (len > MAX_RUN) return null;

  for (let l = len; l >= 1; l--) {
    for (let i = 0; i + l <= len; i++) {
      const s = rs + i;
      const e = s + l - 1;
      if (offset < s || offset > e) continue;
      const tok = text.slice(s, e + 1);
      const parsed = classify(tok);
      if (!parsed) continue;
      if (!boundaryOk(text, s, e, parsed.kind)) continue;
      return { start: s, end: e, text: tok, parsed };
    }
  }
  return null;
}

module.exports = { analyzeLine, K_CHARS, MAX_RUN };
