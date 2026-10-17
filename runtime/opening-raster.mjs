// Exact specialization of 2CDDC–2CFC5: one row in the opening's 8x8 tile.
// Pixel math uses the original wrapping integers, texture and light tables.
export function executeOpeningRaster(c,entry=183772,base=179840){
  c.instructions+=113;
  const a0=c.u32(base),b0=c.u32(base+4),z0=c.u32(base+8);
  const a1=c.u32(base+12),b1=c.u32(base+16),z1=c.u32(base+20);
  const da=((a1-a0)|0)>>11,db=((b1-b0)|0)>>11,dz=((z1-z0)|0)>>11;
  c.current=entry+50;c.w32(base+52,da);
  c.current=entry+55;c.w32(base+56,db);
  c.current=entry+61;c.w32(base+60,dz);
  let x=a0>>8,y=b0>>8,z=z0>>8;
  const texture=c.u32(18032)&0xffff0000;
  let destination=c.r.edi;
  for(let pair=0;pair<4;pair++){
    let word=0;
    for(let pixel=0;pixel<2;pixel++){
      const texel=c.u8((texture|((y&0xff00)|((x>>>8)&255)))>>>0);
      const lit=c.u8(((texture|((z>>>8)&255)<<8|texel)+65536)>>>0);
      word|=lit<<(pixel*8);
      x=(x+da)|0;y=(y+db)|0;z=(z+dz)|0;
    }
    destination=(destination+2)>>>0;
    c.current=entry+152+pair*72;c.w16(destination,word);
  }
  const r=c.r;
  r.eax=(a0+c.u32(base+28))>>>0;r.ebx=(b0+c.u32(base+32))>>>0;
  r.ecx=(z0+c.u32(base+36))>>>0;r.edx=(a1+c.u32(base+40))>>>0;
  r.esi=(b1+c.u32(base+44))>>>0;r.ebp=(z1+c.u32(base+48))>>>0;
  c.current=entry+442;c.w32(base,r.eax);
  c.current=entry+447;c.w32(base+4,r.ebx);
  c.current=entry+453;c.w32(base+8,r.ecx);
  c.current=entry+459;c.w32(base+12,r.edx);
  c.current=entry+465;c.w32(base+16,r.esi);
  c.current=entry+471;c.w32(base+20,r.ebp);
  c.current=entry+477;r.edi=c.add(destination,312,32)>>>0;
  c.current=entry+483;c.w32(base+24,c.sub(c.u32(base+24),1,32,true));
  c.current=entry+489;
  return (r.eflags&64)===0?entry:entry+495;
}
