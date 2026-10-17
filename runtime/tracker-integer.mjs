// Integer operations reached by the original tracker-control translation.
export function unsignedMultiply(c, operand, width) {
  if (![8,16,32].includes(width)) throw new Error('Unsupported tracker MUL width');
  const mask = (1n << BigInt(width)) - 1n;
  const product = (BigInt(c.r.eax) & mask) * (BigInt(operand >>> 0) & mask);
  const low = Number(product & mask), high = Number(product >> BigInt(width));
  if (width === 8) c.r.eax = ((c.r.eax & 0xffff0000) | Number(product)) >>> 0;
  else if (width === 16) {
    c.r.eax = ((c.r.eax & 0xffff0000) | low) >>> 0;
    c.r.edx = ((c.r.edx & 0xffff0000) | high) >>> 0;
  } else { c.r.eax = low; c.r.edx = high; }
  c.r.eflags = ((c.r.eflags & ~0x801) | (high ? 0x801 : 0)) >>> 0;
}
export function unsignedDivide(c, operand, width) {
  if (![8,16,32].includes(width)) throw new Error('Unsupported tracker DIV width');
  const mask = (1n << BigInt(width)) - 1n;
  const dividend = width === 8 ? BigInt(c.r.eax & 65535) :
    ((BigInt(c.r.edx) & mask) << BigInt(width)) | (BigInt(c.r.eax) & mask);
  const divisor = BigInt(operand >>> 0) & mask;
  if (!divisor) throw new Error('Tracker DIV zero divisor');
  const quotient = dividend / divisor, remainder = dividend % divisor;
  if (quotient > mask) throw new Error('Tracker DIV overflow');
  if (width === 8) c.r.eax = ((c.r.eax & 0xffff0000) | Number(quotient) | (Number(remainder) << 8)) >>> 0;
  else if (width === 16) {
    c.r.eax = ((c.r.eax & 0xffff0000) | Number(quotient)) >>> 0;
    c.r.edx = ((c.r.edx & 0xffff0000) | Number(remainder)) >>> 0;
  } else { c.r.eax = Number(quotient); c.r.edx = Number(remainder); }
}
export function addCarry(c, a, b, width) {
  const modulus = 2 ** width, mask = width === 32 ? 0xffffffff : modulus - 1;
  a = (a & mask) >>> 0; b = (b & mask) >>> 0;
  const sum = a + b + (c.r.eflags & 1), value = (sum & mask) >>> 0;
  return c.flags(value, width, (sum >= modulus ? 1 : 0) | ((a ^ b ^ value) & 16) |
    ((~(a ^ b) & (a ^ value) & (modulus / 2)) ? 0x800 : 0));
}
