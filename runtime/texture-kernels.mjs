// Preserve the original ADD/ADC/ADC carry chain without calculating flags
// between operations that overwrite them. The last ADC retains all its flags.
export function texturePixels(c,count,storeAddress,storeStep){
  const r=c.r,dx=c.u32(129576),dy=c.u32(129580),dz=c.u8(129584);
  let x=r.ecx,y=r.edx,b=r.ebx,a=r.eax,destination=r.edi;
  for(let i=0;i<count;i++){
    a=((a&0xffff00ff)|((x>>>8)&255)<<8)>>>0;
    b=((b&0xffff00ff)|(y&255)<<8)>>>0;
    destination=(destination+1)>>>0;
    const sx=x+dx;x=sx>>>0;
    a=((a&0xffffff00)|c.u8(b))>>>0;
    const sy=y+dy+(sx>=4294967296?1:0);y=sy>>>0;
    a=((a&0xffffff00)|c.u8(a))>>>0;
    const low=b&255,carry=sy>=4294967296?1:0;
    let next=(low+dz+carry)&255;
    if(i===count-1){r.eflags=(r.eflags&~1)|carry;next=c.adc(low,dz,8);}
    b=((b&0xffffff00)|next)>>>0;
    c.current=storeAddress+i*storeStep;c.w8(destination,a&255);
  }
  r.eax=a;r.ebx=b;r.ecx=x;r.edx=y;r.edi=destination;
}

export function textureTail(c,entry,original){
  const count=c.r.esi>>>0,destination=c.r.edi+1;
  if(c.onWrite||!count||count>64000||destination+count>c.memory.length||
    (destination<129585&&destination+count>129576))return original(c);
  texturePixels(c,count,entry+28,0);
  c.r.esi=c.sub(1,1,32,true)>>>0;
  c.instructions+=count*11;c.blocks+=count-1;c.current=entry+30;
  return entry+32;
}
