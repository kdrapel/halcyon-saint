// Bounded scalar port of the audited Windows replay backend's FMA cosine path.
// Constants and operation order are retained; this is not a general x87 cosine.
import {to64Bits} from './x87-finite.mjs';
const bits=new DataView(new ArrayBuffer(8));
function dyadic(x){
  bits.setFloat64(0,x,false);const high=bits.getUint32(0,false),low=bits.getUint32(4,false),exponent=high>>>20&2047;
  const fraction=(high&0xfffff)*4294967296+low;
  if(exponent===2047||(!exponent&&fraction))throw new Error('FMA finite-normal profile exceeded');
  const n=BigInt(exponent?fraction+4503599627370496:0);
  return {n:high>>>31?-n:n,e:exponent?exponent-1075:0,negativeZero:!!(high>>>31)&&n===0n};
}
export function fusedMultiplyAdd(a,b,c){
  const x=dyadic(a),y=dyadic(b),z=dyadic(c),product=x.n*y.n,pe=x.e+y.e,e=Math.min(pe,z.e);
  const n=(product<<BigInt(pe-e))+(z.n<<BigInt(z.e-e));
  const negativeZero=n===0n&&product===0n&&z.n===0n&&((x.n<0n||x.negativeZero)!==(y.n<0n||y.negativeZero))&&z.negativeZero;
  bits.setBigUint64(0,to64Bits({n,e,negativeZero},0),false);return bits.getFloat64(0,false);
}
const fma=fusedMultiplyAdd;
const C=[-1.138263981623609e-11,2.0876146382372144e-9,-2.755731727234489e-7,2.4801587298767044e-5,-0.0013888888888887398,0.041666666666666664];
function polynomial(z){let p=C[0];for(let i=1;i<C.length;i++)p=fma(p,z,C[i]);return p;}
export function replayCosine(input){
  const a=Math.abs(input);
  if(!Number.isFinite(a)||a>=20000000)throw new Error('Replay cosine reduction range exceeded');
  if(a<=0.7853981633974483){
    if(a<7.450580596923828e-9)return 1;
    if(a<0.0001220703125)return fma(-(input*0.5),input,1);
    const z=input*input;return fma(fma(polynomial(z),z,-0.5),z,1);
  }
  const n=fma(a,0.6366197723675814,6755399441055744)-6755399441055744;
  let r=fma(-n,1.5707963267948966,a);
  const t=n*6.123233995736757e-17,productError=fma(n,6.123233995736757e-17,-t);
  const u=r-t,correction=(r-u)-t;
  r=fma(-n,6.123233995736757e-17,r);
  const tail=fma(-n,8.478427660368898e-32,((u-r)+correction)-productError);
  const z=r*r;let result;
  if(n&1){
    let p=fma(1.5918144304485914e-10,z,-2.5051132068021698e-8);
    p=fma(p,z,2.7557316103728802e-6);p=fma(p,z,-0.00019841269836761127);p=fma(p,z,0.00833333333333095);
    const v=r*z;
    let q=z*(tail*0.5-v*p)-tail;
    q=fma(-v,-0.16666666666666666,q);result=r-q;
  }else{
    const half=z*0.5,base=1-half;
    const error=fma(-r,tail,(1-base)-half);
    result=fma(polynomial(z),z*z,error)+base;
  }
  return ((n+1)&2)?-result:result;
}
