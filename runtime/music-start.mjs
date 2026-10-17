import {executeTrackerEntry} from './generated/mixer.mjs';

// Original module loader 26A7–2777. Hardware setup is supplied by the browser.
export function resetMusic(c,initialData) {
  const rate=c.u16(0x1291),kernelStride=c.u32(0x12b3),buffers=c.memory.slice(0x12d7,0x12e6),driver=c.u8(0x1f5d),module=c.u32(0x12e6);
  c.memory.set(initialData,0x1100);
  c.w16(0x1291,rate);c.w32(0x12b3,kernelStride);c.memory.set(buffers,0x12d7);c.w8(0x1f5d,driver);c.w32(0x12e6,module);
  c.w32(0x12ea,c.u16(module+0x20));c.w8(0x12ef,c.u16(module+0x22));c.w8(0x12ee,c.u16(module+0x24));
  c.w32(0x129f,c.u8(module+0x31));c.w32(0x12a3,Math.floor(c.u8(module+0x32)*50/125));
  let channels=0;
  for(let i=0;i<32;i++){
    c.w8(0x12f1+i,0);const channel=c.u8(module+0x40+i);
    if(channel===255)continue;
    channels++;if(!(channel&128))c.w8(0x12f1+i,1);
    c.w8(0x14b1+i,(channel&127)>=8?1:0);
  }
  c.w8(0x12f0,channels);
  const instruments=module+0x60+c.u32(0x12ea);
  for(let i=0;i<c.u8(0x12ef);i++){
    const instrument=module+c.u16(instruments+i*2)*16;
    c.w16(0x1100+i*2,c.u16(instrument+0x20));
    if(!(c.u8(instrument+0x1f)&1)){c.w16(instrument+0x14,0);c.w16(instrument+0x18,0);}
  }
  let order=0;while(c.u8(module+0x60+order)===254)order++;
  const pattern=c.u8(module+0x60+order);
  if(pattern===255)throw new Error('Empty soundtrack');
  c.w32(0x12bb,c.u16(instruments+c.u8(0x12ef)*2+pattern*2)*16+2);
  c.w32(0x12bf,order+1);c.w8(0x12ca,0);
}
export function startMusic(c) {
  const registers={...c.r},fpu=c.f;
  for(const entry of [0x34de,0x3aab]) {c.push(0x4fd00);executeTrackerEntry(c,entry);}
  c.w16(0x1f5b,c.u16(0x1f5b)|0x400);
  c.r=registers;c.f=fpu;
}
