// Development state helpers for statically generated original-code JS blocks.
// No instruction decoder or opcode dispatcher. Hardware access always fails.
import { to64Bits, raw80, round, add, subtract, multiply, divide, atan2Extended } from './x87-finite.mjs';
import { addCarry } from './tracker-integer.mjs';
import {replayCosine} from './crt-cosine.mjs';
const parity = (value) => ((0x9669 >>> (((value & 255) ^ ((value & 255) >>> 4)) & 15)) & 1) !== 0;
const ARITH = 0x8d5;
const codeContracts = new WeakMap();
export class DemoMachine {
  constructor(memory, registers, { onWrite } = {}) {
    this.memory = memory; this.view = new DataView(memory.buffer, memory.byteOffset, memory.byteLength);
    this.r = { ...registers }; this.onWrite = onWrite; this.f = new DemoFpu(this); this.blocks = 0;
  }
  check(address, size) { if (!Number.isInteger(address) || address < 0 || address + size > this.memory.length) throw new RangeError(`Unavailable RAM ${address.toString(16)}+${size}`); }
  setCodeContract(spans, patches) {
    let variants=codeContracts.get(spans);
    if(!variants){variants=new WeakMap();codeContracts.set(spans,variants);}
    let contract=variants.get(patches);
    if(contract){this.codeBytes=contract.code;this.patchBytes=contract.patch;return;}
    const length = Math.max(0, ...spans.map((span) => span[1]));
    this.codeBytes = new Uint8Array(length); this.patchBytes = new Uint8Array(length);
    for (const [start, end] of spans) this.codeBytes.fill(1, start, end);
    for (const [start, end] of patches) this.patchBytes.fill(1, start, end);
    variants.set(patches,{code:this.codeBytes,patch:this.patchBytes});
  }
  checkWrite(address, size) {
    this.check(address, size);
    if (this.codeBytes && address < this.codeBytes.length) {
      for (let offset = address; offset < address + size; offset += 1) {
        if (this.codeBytes[offset] && !this.patchBytes[offset]) throw new Error(`Unsupported opcode-byte write ${offset.toString(16)}`);
      }
    }
  }
  u8(a) { this.check(a, 1); return this.view.getUint8(a); }
  u16(a) { this.check(a, 2); return this.view.getUint16(a, true); }
  u32(a) { this.check(a, 4); return this.view.getUint32(a, true); }
  w8(a, v) { this.checkWrite(a, 1); this.view.setUint8(a, v); this.onWrite?.(a, 1, BigInt(v & 255)); }
  w16(a, v) { this.checkWrite(a, 2); this.view.setUint16(a, v, true); this.onWrite?.(a, 2, BigInt(v & 65535)); }
  w32(a, v) { this.checkWrite(a, 4); this.view.setUint32(a, v, true); this.onWrite?.(a, 4, BigInt(v >>> 0)); }
  push(value, size = 4) { this.r.esp = (this.r.esp - size) >>> 0; size === 2 ? this.w16(this.r.esp, value) : this.w32(this.r.esp, value); }
  pop(size = 4) { const value = size === 2 ? this.u16(this.r.esp) : this.u32(this.r.esp); this.r.esp = (this.r.esp + size) >>> 0; return value; }
  pushAll() {
    const saved = this.r.esp, values = [this.r.edi, this.r.esi, this.r.ebp, saved, this.r.ebx, this.r.edx, this.r.ecx, this.r.eax];
    this.r.esp = (saved - 32) >>> 0;
    // Unicorn serializes the instruction's eight stores at ascending addresses.
    values.forEach((value, index) => this.w32(this.r.esp + index * 4, value));
  }
  popAll() { for (const name of ['edi', 'esi', 'ebp']) this.r[name] = this.pop(); this.pop(); for (const name of ['ebx', 'edx', 'ecx', 'eax']) this.r[name] = this.pop(); }
  flags(result, width, extra = 0, preserveCarry = false) {
    const mask = width === 32 ? 0xffffffff : (1 << width) - 1, sign = 1 << (width - 1);
    const value = (result & mask) >>> 0;
    const carry = preserveCarry ? this.r.eflags & 1 : extra & 1;
    this.r.eflags = ((this.r.eflags & ~ARITH) | carry | (extra & 0x810) |
      (value === 0 ? 64 : 0) | ((value & sign) !== 0 ? 128 : 0) | (parity(value) ? 4 : 0)) >>> 0;
    return value;
  }
  add(a, b, width = 32, preserveCarry = false) {
    const modulus = width === 32 ? 4294967296 : 1 << width, mask = width === 32 ? 0xffffffff : modulus - 1, sign = 1 << (width - 1);
    a = (a & mask) >>> 0; b = (b & mask) >>> 0;
    const value = ((a + b) & mask) >>> 0;
    return this.flags(value, width, (a + b >= modulus ? 1 : 0) | ((a ^ b ^ value) & 16) | ((~(a ^ b) & (a ^ value) & sign) ? 0x800 : 0), preserveCarry);
  }
  sub(a, b, width = 32, preserveCarry = false) {
    const modulus = width === 32 ? 4294967296 : 1 << width, mask = width === 32 ? 0xffffffff : modulus - 1, sign = 1 << (width - 1);
    a = (a & mask) >>> 0; b = (b & mask) >>> 0;
    const value = ((a - b) & mask) >>> 0;
    return this.flags(value, width, (a < b ? 1 : 0) | ((a ^ b ^ value) & 16) | (((a ^ b) & (a ^ value) & sign) ? 0x800 : 0), preserveCarry);
  }
  logic(value, width = 32) { return this.flags(value, width); }
  adc(a,b,width=32) { return addCarry(this,a,b,width); }
  rotate(value,count,width,kind) {
    if(width!==32)throw new Error('Unsupported rotate width');
    count&=31;if(!count)return value>>>0;
    const result=kind==='rol'?((value<<count)|(value>>>(32-count)))>>>0:((value>>>count)|(value<<(32-count)))>>>0;
    const carry=kind==='rol'?result&1:result>>>31;
    const overflow=kind==='rol'?((result>>>31)^carry)&1:((result>>>31)^(result>>>30))&1;
    this.r.eflags=((this.r.eflags&~(count===1?0x801:1))|carry|(count===1?overflow<<11:0))>>>0;
    return result;
  }
  shift(value, count, width, kind) {
    count &= 31; if (!count) return value;
    const mask = width === 32 ? 0xffffffff : 2 ** width - 1;
    value = (value & mask) >>> 0;
    let result, carry, overflow = 0;
    if (kind === 'shl') { result = (value << count) & mask; carry = count <= width ? (value >>> (width - count)) & 1 : 0; overflow = ((result >>> (width - 1)) ^ carry) & 1; }
    else if (kind === 'shr') { result = value >>> count; carry = (value >>> (count - 1)) & 1; overflow = (value >>> (width - 1)) & 1; }
    else { const signed = width === 32 ? value | 0 : value << (32 - width) >> (32 - width); result = signed >> count; carry = (signed >> (count - 1)) & 1; }
    return this.flags(result, width, carry | (count === 1 && overflow ? 0x800 : 0));
  }
  imul(a, b) { const value = Math.imul(a,b) >>> 0; const overflow = (a|0)*(b|0) !== (value|0); this.r.eflags = ((this.r.eflags & ~0x801) | (overflow ? 0x801 : 0)) >>> 0; return value; }
  divideUnsigned(divisor, width) {
    const bits=BigInt(width),mask=(1n<<bits)-1n,low=BigInt(this.r.eax>>>0)&mask;
    const high=width===8?0n:(BigInt(width===16?this.r.edx>>>0:this.r.edx>>>0)&mask);
    const numerator=(high<<bits)|low,denominator=BigInt(divisor>>>0)&mask;
    if(width!==8&&width!==16&&width!==32)throw new Error('Unsupported DIV width');
    if(!denominator)throw new Error('DIV by zero');
    const quotient=numerator/denominator,remainder=numerator%denominator;
    if(quotient>mask)throw new Error('DIV quotient overflow');
    if(width===8)this.r.eax=((this.r.eax&0xffff0000)|((Number(remainder)&255)<<8)|(Number(quotient)&255))>>>0;
    else if(width===16){this.r.eax=((this.r.eax&0xffff0000)|Number(quotient))>>>0;this.r.edx=((this.r.edx&0xffff0000)|Number(remainder))>>>0;}
    else {this.r.eax=Number(quotient)>>>0;this.r.edx=Number(remainder)>>>0;}
  }
  divideSigned(divisor, width) {
    const bits=BigInt(width),low=BigInt(this.r.eax>>>0)&((1n<<bits)-1n);
    const high=width===8?0n:BigInt(this.r.edx>>>0)&((1n<<bits)-1n);
    const numerator=BigInt.asIntN(width*2,(high<<bits)|low),denominator=BigInt.asIntN(width,BigInt(divisor>>>0));
    if(width!==8&&width!==16&&width!==32)throw new Error('Unsupported IDIV width');
    if(!denominator)throw new Error('IDIV by zero');
    const quotient=numerator/denominator,remainder=numerator%denominator;
    if(quotient<-(1n<<(bits-1n))||quotient>((1n<<(bits-1n))-1n))throw new Error('IDIV quotient overflow');
    if(width===8)this.r.eax=((this.r.eax&0xffff0000)|((Number(remainder)&255)<<8)|(Number(quotient)&255))>>>0;
    else if(width===16){this.r.eax=((this.r.eax&0xffff0000)|Number(quotient))>>>0;this.r.edx=((this.r.edx&0xffff0000)|Number(remainder))>>>0;}
    else {this.r.eax=Number(BigInt.asUintN(32,quotient))>>>0;this.r.edx=Number(BigInt.asUintN(32,remainder))>>>0;}
  }
  sahf() { this.r.eflags = ((this.r.eflags & ~0xd5) | ((this.r.eax >>> 8) & 0xd5)) >>> 0; }
  repStosd() { const step = this.r.eflags & 0x400 ? -4 : 4; while (this.r.ecx) { this.w32(this.r.edi, this.r.eax); this.r.edi = (this.r.edi + step) >>> 0; this.r.ecx = (this.r.ecx - 1) >>> 0; } }
  repMovsd() { const step = this.r.eflags & 0x400 ? -4 : 4; while (this.r.ecx) { this.w32(this.r.edi, this.u32(this.r.esi)); this.r.esi = (this.r.esi + step) >>> 0; this.r.edi = (this.r.edi + step) >>> 0; this.r.ecx = (this.r.ecx - 1) >>> 0; } }
}

const singleConversion=new DataView(new ArrayBuffer(4));
class SingleValue {
  constructor(value){this.native=value;this.negativeZero=Object.is(value,-0);this._n=undefined;this._e=undefined;}
  get fast(){return true;}
  get narrow(){return true;}
  decode(){
    if(this._n!==undefined)return;
    singleConversion.setFloat32(0,this.native,true);const raw=singleConversion.getUint32(0,true);
    const exponent=(raw>>>23)&255,fraction=raw&0x7fffff,integer=exponent?0x800000|fraction:fraction;
    const zeros=integer?31-Math.clz32(integer&-integer):0,n=BigInt(integer>>>zeros);
    this._n=raw>>>31?-n:n;this._e=(exponent?exponent-150:(fraction?-149:0))+zeros;
  }
  get n(){this.decode();return this._n;}
  get e(){this.decode();return this._e;}
}
const zero = () => new SingleValue(0);
function nativeOperand(value){
  if(value.fast!==undefined)return value.fast;
  value.fast=value.n>-0x20000000000000n&&value.n<0x20000000000000n&&value.e>=-149&&value.e<=127;
  value.narrow=value.n>-0x1000000n&&value.n<0x1000000n;
  if(value.fast)value.native=value.n===0n?(value.negativeZero?-0:0):Number(value.n)*2**value.e;
  return value.fast;
}
const nan = (negative = true, mantissa = 0xffffff0000000000n) => ({ special: 'nan', negative, mantissa });
export class DemoFpu {
  constructor(machine) { this.c = machine; this.conversion = new DataView(new ArrayBuffer(8)); this.cw = 0x7f; this.condition = 0; this.exceptions = 0; this.top = 0; this.slots = Array.from({ length: 8 }, zero); this.empty = Array(8).fill(true); }
  get sw() { return this.condition | (this.top << 11) | this.exceptions; }
  get precision() { const p = { 0: 24, 2: 53, 3: 64 }[(this.cw >>> 8) & 3]; if (!p) throw new Error('Reserved PC'); return p; }
  get rc() { return (this.cw >>> 10) & 3; }
  st(i = 0) { const slot = (this.top + i) & 7; return this.slots[slot]; }
  set(i, value) { const slot = (this.top + i) & 7; this.slots[slot] = value; this.empty[slot] = false; }
  push(value) { this.top = (this.top - 1) & 7; if (!this.empty[this.top]) throw new Error('FPU overflow in generated frame'); this.set(0, value); }
  pop() { this.empty[this.top] = true; this.top = (this.top + 1) & 7; }
  free(i) { this.empty[(this.top + i) & 7] = true; }
  number(value) {
    if (value.special) {
      if (value.special !== 'nan') return value.negative ? -Infinity : Infinity;
      this.conversion.setBigUint64(0, (value.negative ? 0x8000000000000000n : 0n) | 0x7ff0000000000000n | (value.mantissa >> 11n & 0xfffffffffffffn), false);
      return this.conversion.getFloat64(0, false);
    }
    if(value.native!==undefined)return value.native;
    if(value.n===0n)return value.negativeZero?-0:0;
    // Number(BigInt) performs the same nearest-even significand rounding as
    // the binary64 packer. Scaling by an exactly representable power of two
    // is exact in this normal, non-overflowing range. Keep the packer for the
    // extended exponent cases where scaling could round or underflow twice.
    if(value.e>=-1022&&value.e<=959&&value.n>-0x10000000000000000n&&value.n<0x10000000000000000n)
      return Number(value.n)*2**value.e;
    const buffer = this.conversion; buffer.setBigUint64(0, to64Bits(value, 0), false);
    return buffer.getFloat64(0, false);
  }
  fromNumber(value) {
    if (Number.isNaN(value)) {
      this.conversion.setFloat64(0,value,false);const raw=this.conversion.getBigUint64(0,false);
      return nan((raw>>63n)!==0n,0x8000000000000000n | ((raw&0xfffffffffffffn)<<11n));
    }
    if (!Number.isFinite(value)) return { special: 'infinity', negative: value < 0 };
    if(Math.fround(value)===value)return new SingleValue(value);
    const buffer = this.conversion; buffer.setFloat64(0, value, false);
    const high=buffer.getUint32(0,false),low=buffer.getUint32(4,false),exponent=(high>>>20)&2047;
    const significand=(high&0xfffff)*4294967296+low;
    if(!exponent&&significand)throw new Error('Unsupported nonfinite/subnormal input');
    // Every integer here is <= 2^53-1: this conversion is exact, not arithmetic rounding.
    const integer=exponent?significand+4503599627370496:0;
    const upper=(high&0xfffff)|(exponent?0x100000:0);
    const zeros=integer?(low?31-Math.clz32((low&-low)>>>0):32+31-Math.clz32((upper&-upper)>>>0)):0;
    const n=BigInt(integer/2**zeros);
    const e=exponent?exponent-1075+zeros:0;
    return {n:high>>>31?-n:n,e,negativeZero:!!(high>>>31)&&n===0n,native:value,fast:e>=-149&&e<=127,narrow:Math.fround(value)===value};
  }
  fromSingle(value){
    return new SingleValue(value);
  }
  mem(a, size) {
    this.c.check(a,size);
    if(size!==4)return this.fromNumber(this.c.view.getFloat64(a,true));
    const raw=this.c.view.getUint32(a,true),exponent=(raw>>>23)&255,fraction=raw&0x7fffff,negative=!!(raw>>>31);
    if(exponent===255){
      if(!fraction)return {special:'infinity',negative};
      // Preserve the prior JS binary32-to-binary64 load's quieting behavior.
      // Exceptional status for signaling inputs remains outside this profile.
      return nan(negative,0x8000000000000000n|(BigInt(fraction|0x400000)<<40n));
    }
    // Load the exact 24-bit dyadic directly, avoiding a binary64 round trip and
    // 29 trailing zero bits in every subsequent BigInt arithmetic operation.
    return new SingleValue(this.c.view.getFloat32(a,true));
  }
  integer(a, size) { const value = size === 2 ? this.c.u16(a) << 16 >> 16 : this.c.u32(a) | 0; return Math.fround(value)===value?new SingleValue(value):{ n: BigInt(value), e: 0, negativeZero: false,native:value,fast:true }; }
  operation(kind, a, b) {
    const divideZero=kind==='div'&&!b.special&&(b.native!==undefined?b.native===0:b.n===0n);
    if(divideZero){
      if(!(this.cw&4))throw new Error('Unmasked x87 divide by zero');
      this.exceptions|=4;
    }
    if (a.special || b.special || divideZero) {
      const x = this.number(a), y = this.number(b);
      return this.fromNumber(kind === 'add' ? x + y : kind === 'sub' ? x - y : kind === 'mul' ? x * y : x / y);
    }
    // With exactly representable binary64 inputs, double rounding to 24 bits
    // can disagree only when the binary64 result is a binary32 midpoint.
    // Detect those ties and retain the exact dyadic path. Bound exponents so
    // the intermediate binary64 operation cannot underflow or overflow.
    if((this.cw&0x300)===0&&nativeOperand(a)&&nativeOperand(b)){
      const x=a.native,y=b.native;
      const result=kind==='add'?x+y:kind==='sub'?x-y:kind==='mul'?x*y:x/y;
      let single=Math.fround(result);
      if(single===0&&result===0)return this.fromSingle(this.rc===1&&(kind==='add'||kind==='sub')?-0:single);
      if(Number.isFinite(single)&&Math.abs(single)>=1.1754943508222875e-38){
        this.conversion.setFloat64(0,result,true);
        const tail=this.conversion.getUint32(0,true)&0x1fffffff,rc=this.rc;
        if((rc===0&&tail===0x10000000)||(rc!==0&&tail===0)){
          const narrow=a.narrow&&b.narrow;
          const exact=kind==='mul'?narrow||a.n===1n||a.n===-1n||b.n===1n||b.n===-1n:
            kind==='div'?narrow||b.n===1n||b.n===-1n:
            (narrow&&Math.abs(a.e-b.e)<=29)||a.n===0n||b.n===0n;
          if(exact)return this.fromSingle(single);
        }
        if(rc===0){if(tail!==0x10000000)return this.fromSingle(single);}
        else if(tail!==0){
          // Directed rounding is ambiguous only at an exactly represented
          // binary32 value; the exact path resolves those boundaries.
          const down=rc===1||(rc===3&&result>0),up=rc===2||(rc===3&&result<0);
          if((down&&single>result)||(up&&single<result)){
            this.conversion.setFloat32(0,single,true);
            const raw=this.conversion.getUint32(0,true);
            this.conversion.setUint32(0,(raw+(down?(single>0?-1:1):(single>0?1:-1)))>>>0,true);
            single=this.conversion.getFloat32(0,true);
          }
          if(Number.isFinite(single)&&Math.abs(single)>=1.1754943508222875e-38)return this.fromSingle(single);
        }
      }
    }
    return { add, sub: subtract, mul: multiply, div: divide }[kind](a, b, this.precision, this.rc);
  }
  binary(kind, value) { this.set(0, this.operation(kind, this.st(), value)); }
  binaryPop(kind, target, reverse = false) { this.set(target, this.operation(kind, reverse ? this.st() : this.st(target), reverse ? this.st(target) : this.st())); this.pop(); }
  swap(i) { const a = this.st(), b = this.st(i); this.set(0, b); this.set(i, a); }
  compare(i, pops) { const a = this.number(this.st()), b = this.number(this.st(i)); this.condition = Number.isNaN(a) || Number.isNaN(b) ? 0x4500 : a < b ? 0x100 : a === b ? 0x4000 : 0; for (let n = 0; n < pops; n += 1) this.pop(); }
  unary(kind) {
    const value = this.st();
    if(value instanceof SingleValue&&(kind==='neg'||kind==='abs')){this.set(0,new SingleValue(kind==='neg'?-value.native:Math.abs(value.native)));return;}
    if (kind === 'neg') { this.set(0, value.special ? { ...value, negative: !value.negative } : { n: -value.n, e: value.e, negativeZero: value.n === 0n && !value.negativeZero }); return; }
    if (kind === 'abs') { this.set(0, value.special ? { ...value, negative: false } : { n: value.n < 0n ? -value.n : value.n, e: value.e, negativeZero: false }); return; }
    const n = this.number(value); const result = this.fromNumber(kind === 'sin' ? Math.sin(n) : kind === 'cos' ? Math.cos(n) : Math.sqrt(n));
    this.set(0, kind === 'sqrt' && !result.special ? round(result, this.precision, this.rc) : result);
  }
  atan() {
    const y=this.st(1),x=this.st();
    // Quiet NaNs produced by the original geometry's negative discriminants
    // propagate through FPATAN, with the normal destination and stack pop.
    const source=x.special==='nan'?x:y.special==='nan'?y:null;
    const result=source?{...source,mantissa:source.mantissa|0x4000000000000000n}:atan2Extended(y,x,this.rc);
    this.set(1,result);this.pop();
  }
  sincos(){const value=this.st(),n=this.number(value);this.set(0,this.fromNumber(Math.sin(n)));this.push(this.fromNumber(value.special?Math.cos(n):replayCosine(n)));}
  store(a, size, pop) {
    this.c.checkWrite(a, size);
    const value = this.st();
    if (size === 4) {
      if (value.special) this.c.w32(a, value.special === 'nan' ? ((value.negative ? 0x80000000 : 0) | 0x7f800000 | Number(value.mantissa>>40n & 0x7fffffn))>>>0 : value.negative ? 0xff800000 : 0x7f800000);
      else if(value.narrow&&value.native!==undefined){this.c.view.setFloat32(a,value.native,true);this.c.w32(a,this.c.view.getUint32(a,true));}
      else { const rounded = round(value, 24, this.rc); this.c.view.setFloat32(a, this.number(rounded), true); this.c.w32(a, this.c.view.getUint32(a, true)); }
    } else {
      this.c.check(a, 8);
      if(!value.special&&value.native!==undefined){
        this.c.view.setFloat64(a,value.native,true);this.c.onWrite?.(a,8,this.c.view.getBigUint64(a,true));
        if(pop)this.pop();return;
      }
      const raw = value.special ? (value.special === 'nan' ? ((value.negative ? 0x8000000000000000n : 0n) | 0x7ff0000000000000n | (value.mantissa>>11n & 0xfffffffffffffn)) : (value.negative ? 0xfff0000000000000n : 0x7ff0000000000000n)) : to64Bits(value, this.rc);
      this.c.view.setBigUint64(a, raw, true); this.c.onWrite?.(a, 8, raw);
    }
    if (pop) this.pop();
  }
  storeRegister(i, pop) { this.set(i, this.st()); if (pop) this.pop(); }
  storeInteger(a, size, pop) {
    const value = this.st(); let output = -(2 ** (size * 8 - 1));
    if(!value.special&&nativeOperand(value)){
      const x=value.native,rc=this.rc;
      let result=rc===3?Math.trunc(x):rc===1?Math.floor(x):rc===2?Math.ceil(x):Math.round(x);
      if(rc===0&&Math.abs(x%1)===0.5&&(result&1))result--;
      const limit=size===2?32768:2147483648;
      if(result>=-limit&&result<limit)output=result;
      size===2?this.c.w16(a,output):this.c.w32(a,output);if(pop)this.pop();return;
    }
    if (!value.special) {
      const negative = value.n < 0n || value.negativeZero, n = value.n < 0n ? -value.n : value.n;
      let q, remainder = 0n, denominator = 1n;
      if (value.e >= 0) q = n << BigInt(value.e);
      else { denominator = 1n << BigInt(-value.e); q = n / denominator; remainder = n % denominator; }
      if ((this.rc === 0 && (remainder * 2n > denominator || (remainder * 2n === denominator && (q & 1n)))) ||
          (remainder && ((this.rc === 1 && negative) || (this.rc === 2 && !negative)))) q += 1n;
      const signed = negative ? -q : q;
      if (signed >= -(1n << BigInt(size * 8 - 1)) && signed < (1n << BigInt(size * 8 - 1))) output = Number(signed);
    }
    size === 2 ? this.c.w16(a, output) : this.c.w32(a, output); if (pop) this.pop();
  }
  snapshot() {
    return { cw: this.cw, sw: this.sw, top: this.top,
      tag_word: this.empty.reduce((tag, isEmpty, slot) => tag | ((isEmpty ? 3 : this.slots[slot].special ? 2 : this.slots[slot].n === 0n ? 1 : 0) << (slot * 2)), 0),
      physical_slots: this.slots.map((value) => value.special ? { mantissa_hex: value.special === 'nan' ? value.mantissa.toString(16).padStart(16,'0') : '8000000000000000', exponent_hex: value.negative ? 'ffff' : '7fff' } : raw80(value)) };
  }
}
