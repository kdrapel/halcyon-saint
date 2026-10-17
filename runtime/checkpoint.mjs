import {DemoMachine} from './machine.mjs';
const PAGE=4096;
export function encodeCheckpoint(base,machine,state){
  const pages=[];
  for(let start=0;start<base.length;start+=PAGE){for(let i=start;i<start+PAGE;i++)if(base[i]!==machine.memory[i]){pages.push(start/PAGE);break;}}
  const metadata=new TextEncoder().encode(JSON.stringify({schema:1,registers:machine.r,fpu:machine.f.snapshot(),state}));
  const output=new Uint8Array(8+metadata.length+pages.length*(4+PAGE)),view=new DataView(output.buffer);
  view.setUint32(0,metadata.length,true);view.setUint32(4,pages.length,true);output.set(metadata,8);
  let offset=8+metadata.length;
  for(const page of pages){view.setUint32(offset,page,true);offset+=4;output.set(machine.memory.subarray(page*PAGE,(page+1)*PAGE),offset);offset+=PAGE;}
  return output;
}
export function restoreCheckpoint(base,bytes){
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),length=view.getUint32(0,true),count=view.getUint32(4,true);
  if(bytes.length!==8+length+count*(4+PAGE))throw new Error('Invalid seek checkpoint length');
  const metadata=JSON.parse(new TextDecoder().decode(bytes.subarray(8,8+length)));
  if(metadata.schema!==1)throw new Error('Unsupported seek checkpoint');
  const memory=base.slice();let offset=8+length;
  for(let n=0;n<count;n++){const page=view.getUint32(offset,true);offset+=4;if(page>=base.length/PAGE)throw new Error('Invalid seek checkpoint page');memory.set(bytes.subarray(offset,offset+PAGE),page*PAGE);offset+=PAGE;}
  const c=new DemoMachine(memory,{...metadata.registers}),f=c.f,raw=metadata.fpu;
  f.cw=raw.cw;f.top=raw.top;f.condition=raw.sw&0x4500;f.exceptions=raw.sw&0xff;
  f.empty=Array.from({length:8},(_,i)=>((raw.tag_word>>>(i*2))&3)===3);
  f.slots=raw.physical_slots.map(slot=>{
    const mantissa=BigInt('0x'+slot.mantissa_hex),exponent=parseInt(slot.exponent_hex,16),negative=!!(exponent&0x8000);
    if((exponent&0x7fff)===0x7fff)return {special:(mantissa&0x7fffffffffffffffn)?'nan':'infinity',negative,mantissa};
    return {n:negative?-mantissa:mantissa,e:mantissa?(exponent&0x7fff)-16383-63:0,negativeZero:!mantissa&&negative};
  });
  return {machine:c,state:metadata.state};
}
