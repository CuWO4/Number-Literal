'use strict';

// Exact IEEE-754 arithmetic on rationals. All values stay exact until the
// final rounding, which rounds half to even like printf does.

const F32 = { mantBits: 23, expBits: 8, bias: 127, eMin: -126, eMax: 127 };
const F64 = { mantBits: 52, expBits: 11, bias: 1023, eMin: -1022, eMax: 1023 };

function bitLength(v) {
  return v === 0n ? 0 : v.toString(2).length;
}

function infBits(fmt) {
  return ((1n << BigInt(fmt.expBits)) - 1n) << BigInt(fmt.mantBits);
}

function signBit(fmt, sign) {
  return sign < 0 ? 1n << BigInt(fmt.expBits + fmt.mantBits) : 0n;
}

function cmpPow2(num, den, k) {
  if (k >= 0) {
    const r = den << BigInt(k);
    return num < r ? -1 : num > r ? 1 : 0;
  }
  const l = num << BigInt(-k);
  return l < den ? -1 : l > den ? 1 : 0;
}

function cmpPow10(num, den, k) {
  if (k >= 0) {
    const r = den * 10n ** BigInt(k);
    return num < r ? -1 : num > r ? 1 : 0;
  }
  const l = num * 10n ** BigInt(-k);
  return l < den ? -1 : l > den ? 1 : 0;
}

function roundHalfEven(num, den) {
  const q = num / den;
  const r = num % den;
  const twice = r * 2n;
  if (twice > den) return q + 1n;
  if (twice < den) return q;
  return q % 2n === 0n ? q : q + 1n;
}

function scale(num, den, exp2) {
  if (exp2 >= 0) return { num: num << BigInt(exp2), den };
  return { num, den: den << BigInt(-exp2) };
}

// Correctly rounds the positive rational num/den * 2^exp2 into the format.
function bitsFromRational(sign, num, den, exp2, fmt) {
  const sbits = signBit(fmt, sign);
  const scaled = scale(num, den, exp2);
  const n0 = scaled.num;
  const d0 = scaled.den;
  if (n0 === 0n) return sbits;

  let e = bitLength(n0) - bitLength(d0) + 1;
  while (cmpPow2(n0, d0, e) >= 0) e++;
  while (cmpPow2(n0, d0, e - 1) < 0) e--;

  if (e - 1 > fmt.eMax) return sbits | infBits(fmt);

  if (e - 1 >= fmt.eMin) {
    const shift = e - 1 - fmt.mantBits;
    const sc = scale(n0, d0, -shift);
    let m = roundHalfEven(sc.num, sc.den);
    const limit = 1n << BigInt(fmt.mantBits + 1);
    if (m === limit) {
      m >>= 1n;
      e += 1;
      if (e - 1 > fmt.eMax) return sbits | infBits(fmt);
    }
    return sbits | (BigInt(e - 1 + fmt.bias) << BigInt(fmt.mantBits)) | (m - (1n << BigInt(fmt.mantBits)));
  }

  const sc = scale(n0, d0, -(fmt.eMin - fmt.mantBits));
  const m = roundHalfEven(sc.num, sc.den);
  return sbits | m;
}

function bitsFor(p, fmt) {
  if (p.num === undefined) {
    return p.overflow ? signBit(fmt, p.sign) | infBits(fmt) : signBit(fmt, p.sign);
  }
  return bitsFromRational(p.sign, p.num, p.den, p.exp2, fmt);
}

function decompose(bits, fmt) {
  const mantMask = (1n << BigInt(fmt.mantBits)) - 1n;
  const expMask = (1n << BigInt(fmt.expBits)) - 1n;
  return {
    frac: bits & mantMask,
    ebits: Number((bits >> BigInt(fmt.mantBits)) & expMask),
    sign: ((bits >> BigInt(fmt.expBits + fmt.mantBits)) & 1n) === 1n ? -1 : 1
  };
}

function exactParts(bits, fmt) {
  const { frac, ebits, sign } = decompose(bits, fmt);
  if (ebits === (1 << fmt.expBits) - 1) {
    return { special: frac === 0n ? 'inf' : 'nan', sign };
  }
  if (ebits === 0 && frac === 0n) return { zero: true, sign };
  if (ebits === 0) return { sign, m: frac, exp2: 1 - fmt.bias - fmt.mantBits };
  return { sign, m: frac + (1n << BigInt(fmt.mantBits)), exp2: ebits - fmt.bias - fmt.mantBits };
}

function formatFixed(m, exp2, sign, decimals) {
  const sc = scale(m, 1n, exp2);
  const q = roundHalfEven(sc.num * 10n ** BigInt(decimals), sc.den);
  const digits = q.toString().padStart(decimals + 1, '0');
  const intPart = digits.slice(0, digits.length - decimals) || '0';
  const fracPart = decimals > 0 ? digits.slice(digits.length - decimals) : '';
  return (sign < 0 ? '-' : '') + intPart + (decimals > 0 ? '.' + fracPart : '');
}

function formatSci(m, exp2, sign, decimals) {
  if (m === 0n) {
    return (sign < 0 ? '-' : '') + '0' + (decimals > 0 ? '.' + '0'.repeat(decimals) : '') + 'E+00';
  }
  const sc = scale(m, 1n, exp2);
  const num = sc.num;
  const den = sc.den;

  let k = Math.floor(Math.log10(Number(m)) + exp2 * Math.log10(2));
  while (cmpPow10(num, den, k) < 0) k--;
  while (cmpPow10(num, den, k + 1) >= 0) k++;

  let n2 = num;
  let d2 = den;
  if (k >= 0) d2 = d2 * 10n ** BigInt(k);
  else n2 = n2 * 10n ** BigInt(-k);

  const limit = 10n ** BigInt(decimals + 1);
  let q = roundHalfEven(n2 * 10n ** BigInt(decimals), d2);
  if (q >= limit) {
    k += 1;
    q = roundHalfEven(n2 * 10n ** BigInt(decimals), d2 * 10n);
  }
  const digits = q.toString().padStart(decimals + 1, '0');
  const expStr = (k < 0 ? '-' : '+') + String(Math.abs(k)).padStart(2, '0');
  return (sign < 0 ? '-' : '') + digits[0] + (decimals > 0 ? '.' + digits.slice(1) : '') + 'E' + expStr;
}

function hexFloat(bits, fmt) {
  const { frac, ebits, sign } = decompose(bits, fmt);
  const base = sign < 0 ? '-' : '';
  if (ebits === (1 << fmt.expBits) - 1) return base + (frac === 0n ? 'inf' : 'nan');
  if (ebits === 0 && frac === 0n) return base + '0x0P+0';

  const nibbles = Math.ceil(fmt.mantBits / 4);
  const pad = nibbles * 4 - fmt.mantBits;
  const digits = (frac << BigInt(pad)).toString(16).toUpperCase().padStart(nibbles, '0').replace(/0+$/, '');

  const lead = ebits === 0 ? '0' : '1';
  const exp = ebits === 0 ? 1 - fmt.bias : ebits - fmt.bias;
  const expStr = 'P' + (exp < 0 ? '-' : '+') + String(Math.abs(exp));
  return base + '0x' + lead + (digits === '' ? '' : '.' + digits) + expStr;
}

function bytesOf(bits, byteCount) {
  const out = [];
  for (let i = byteCount - 1; i >= 0; i--) out.push(Number((bits >> BigInt(8 * i)) & 0xFFn));
  return out;
}

function floatRepr(bits, fmt, decimals) {
  const p = exactParts(bits, fmt);
  if (p.special) {
    const t = (p.sign < 0 ? '-' : '') + p.special;
    return { fixed: t, sci: t, hex: hexFloat(bits, fmt) };
  }
  if (p.zero) {
    const base = p.sign < 0 ? '-' : '';
    return {
      fixed: base + formatFixed(0n, 0, 1, decimals),
      sci: base + formatSci(0n, 0, 1, decimals),
      hex: hexFloat(bits, fmt)
    };
  }
  return {
    fixed: formatFixed(p.m, p.exp2, p.sign, decimals),
    sci: formatSci(p.m, p.exp2, p.sign, decimals),
    hex: hexFloat(bits, fmt)
  };
}

module.exports = { F32, F64, bitsFor, bytesOf, floatRepr };
