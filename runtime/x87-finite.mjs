// Exact dyadic arithmetic for the bounded finite-normal cross-product fixtures.
// This is not a general x87 emulator: exceptions, subnormal results and NaNs fail.
const bits = (n) => {
  if(n<0n)n=-n;
  if(n<0x100000000n)return 32-Math.clz32(Number(n))||1;
  if(n<0x10000000000000000n)return 64-Math.clz32(Number(n>>32n));
  if(n<0x1000000000000000000000000n)return 96-Math.clz32(Number(n>>64n));
  if(n<0x100000000000000000000000000000000n)return 128-Math.clz32(Number(n>>96n));
  return n.toString(2).length;
};
const precisionLimits={24:1n<<24n,53:1n<<53n,64:1n<<64n};
const precisionLimit=precision=>precisionLimits[precision]??(1n<<BigInt(precision));
const ATAN_BITS = 192n;
const ATAN_SCALE = 1n << ATAN_BITS;
function atanFixed(value) {
  if (value < 0n) return -atanFixed(-value);
  const square = (value * value) >> ATAN_BITS;
  let term = value, sum = value;
  for (let k = 1; k < 512; k += 1) {
    term = (term * square) >> ATAN_BITS;
    const part = term / BigInt(2 * k + 1);
    if (part === 0n) break;
    sum += (k & 1) ? -part : part;
  }
  return sum;
}
let atanPi;
function piFixed() {
  if (atanPi === undefined) atanPi = 16n * atanFixed(ATAN_SCALE / 5n) - 4n * atanFixed(ATAN_SCALE / 239n);
  return atanPi;
}
function atanUnitRatio(ratio) {
  const quarter = piFixed() / 4n;
  return ratio > ATAN_SCALE / 2n
    ? quarter + atanFixed(((ratio - ATAN_SCALE) << ATAN_BITS) / (ratio + ATAN_SCALE))
    : atanFixed(ratio);
}
export function atan2Extended(y, x, rc = 0) {
  if (y.special || x.special) throw new Error('Nonfinite FPATAN input unsupported');
  const yNegative = y.n < 0n || (y.n === 0n && y.negativeZero);
  const xNegative = x.n < 0n || (x.n === 0n && x.negativeZero);
  const yMagnitude = y.n < 0n ? -y.n : y.n;
  const xMagnitude = x.n < 0n ? -x.n : x.n;
  let angle;
  if (xMagnitude === 0n) {
    angle = yMagnitude === 0n ? 0n : piFixed() / 2n;
  } else if (yMagnitude === 0n) {
    angle = xNegative ? piFixed() : 0n;
  } else {
    let numerator = yMagnitude, denominator = xMagnitude;
    const exponent = y.e - x.e;
    if (exponent >= 0) numerator <<= BigInt(exponent);
    else denominator <<= BigInt(-exponent);
    const ratio = (numerator << ATAN_BITS) / denominator;
    angle = ratio > ATAN_SCALE
      ? piFixed() / 2n - atanUnitRatio((ATAN_SCALE << ATAN_BITS) / ratio)
      : atanUnitRatio(ratio);
  }
  if (xNegative) angle = yNegative ? angle - piFixed() : piFixed() - angle;
  else if (yNegative) angle = -angle;
  return round({ n: angle, e: -Number(ATAN_BITS), negativeZero: angle === 0n && yNegative }, 64, rc);
}
export function round(value, precision, rc) {
  if (value.n === 0n) return value;
  const negative = value.n < 0n;
  let n = negative ? -value.n : value.n;
  const shift = bits(n) - precision;
  if (shift <= 0) return value;
  let q = n >> BigInt(shift);
  const remainder = n - (q << BigInt(shift));
  const halfway = 1n << BigInt(shift - 1);
  if ((rc === 0 && (remainder > halfway || (remainder === halfway && (q & 1n)))) ||
      (remainder !== 0n && ((rc === 1 && negative) || (rc === 2 && !negative)))) q += 1n;
  const carryShift = q >= precisionLimit(precision) ? 1 : 0;
  q >>= BigInt(carryShift);
  return { n: negative ? -q : q, e: value.e + shift + carryShift, negativeZero: false };
}
export function from64(hex) {
  return from64Bits(BigInt('0x' + hex));
}
export function from64Bits(raw) {
  const exponent = Number((raw >> 52n) & 0x7ffn);
  const fraction = raw & ((1n << 52n) - 1n);
  if (exponent === 0x7ff || (exponent === 0 && fraction !== 0n)) throw new Error('Unsupported nonfinite/subnormal input');
  const negative = (raw >> 63n) !== 0n;
  const n = exponent === 0 ? 0n : (1n << 52n) | fraction;
  return { n: negative ? -n : n, e: exponent === 0 ? 0 : exponent - 1023 - 52, negativeZero: negative && n === 0n };
}
export function raw80(value) {
  if (value.n === 0n) return { mantissa_hex: '0000000000000000', exponent_hex: value.negativeZero ? '8000' : '0000' };
  const negative = value.n < 0n;
  const n = negative ? -value.n : value.n;
  const length = bits(n);
  const exponent = value.e + length - 1 + 16383;
  if (exponent <= 0 || exponent >= 32767 || length > 64) throw new Error('Unsupported extended range/precision');
  return { mantissa_hex: (n << BigInt(64 - length)).toString(16).padStart(16, '0'),
    exponent_hex: (exponent | (negative ? 0x8000 : 0)).toString(16).padStart(4, '0') };
}
export function to64(value, rc) {
  return to64Bits(value, rc).toString(16).padStart(16, '0');
}
export function to64Bits(value, rc) {
  const rounded = round(value, 53, rc);
  const negative = rounded.n < 0n || rounded.negativeZero;
  const n = rounded.n < 0n ? -rounded.n : rounded.n;
  if (n === 0n) return negative ? 0x8000000000000000n : 0n;
  const length = bits(n);
  const exponent = rounded.e + length - 1 + 1023;
  if (exponent <= 0 || exponent >= 2047) throw new Error('Unsupported binary64 store range');
  const fraction = (n << BigInt(53 - length)) & ((1n << 52n) - 1n);
  return (negative ? 1n << 63n : 0n) | (BigInt(exponent) << 52n) | fraction;
}
export function multiply(a, b, precision, rc) {
  return round({ n: a.n * b.n, e: a.e + b.e,
    negativeZero: (a.n < 0n || a.negativeZero) !== (b.n < 0n || b.negativeZero) }, precision, rc);
}
export function subtract(a, b, precision, rc) {
  const e = Math.min(a.e, b.e);
  const n = (a.n << BigInt(a.e - e)) - (b.n << BigInt(b.e - e));
  const negativeZeroDifference = a.n === 0n && b.n === 0n && a.negativeZero && !b.negativeZero;
  return round({ n, e, negativeZero: n === 0n && (negativeZeroDifference || rc === 1) }, precision, rc);
}
export function add(a, b, precision, rc) {
  const e = Math.min(a.e, b.e);
  const n = (a.n << BigInt(a.e - e)) + (b.n << BigInt(b.e - e));
  const bothNegativeZero = a.n === 0n && b.n === 0n && a.negativeZero && b.negativeZero;
  return round({ n, e, negativeZero: n === 0n && (bothNegativeZero || rc === 1) }, precision, rc);
}
export function divide(a, b, precision, rc) {
  if (b.n === 0n) throw new Error('Division by zero unsupported');
  const negative = (a.n < 0n || a.negativeZero) !== (b.n < 0n || b.negativeZero);
  if (a.n === 0n) return { n: 0n, e: 0, negativeZero: negative };
  const numerator = a.n < 0n ? -a.n : a.n, denominator = b.n < 0n ? -b.n : b.n;
  let exponent = bits(numerator) - bits(denominator);
  if (exponent >= 0 ? numerator < (denominator << BigInt(exponent)) : (numerator << BigInt(-exponent)) < denominator) exponent -= 1;
  const shift = precision - 1 - exponent;
  const scaledNumerator = shift >= 0 ? numerator << BigInt(shift) : numerator;
  const scaledDenominator = shift >= 0 ? denominator : denominator << BigInt(-shift);
  let q = scaledNumerator / scaledDenominator;
  const remainder = scaledNumerator % scaledDenominator;
  if ((rc === 0 && (remainder * 2n > scaledDenominator || (remainder * 2n === scaledDenominator && (q & 1n)))) ||
      (remainder !== 0n && ((rc === 1 && negative) || (rc === 2 && !negative)))) q += 1n;
  const carry = q >= precisionLimit(precision) ? 1 : 0;
  q >>= BigInt(carry);
  return { n: negative ? -q : q, e: a.e - b.e + exponent - precision + 1 + carry, negativeZero: false };
}
