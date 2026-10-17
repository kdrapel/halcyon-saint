import {executeOpeningRaster} from './opening-raster.mjs';
import {textureTail} from './texture-kernels.mjs';

export function installRasterKernels(blocks){
  for(const [entry,base] of [[183772,179840],[199304,195760],[215988,211936],[251276,247696]]){
    const original=blocks[entry];if(!original)continue;
    blocks[entry]=c=>c.onWrite?original(c):executeOpeningRaster(c,entry,base);
  }
  for(const entry of [198112,214920,237768,250228,266824,296608]){
    const original=blocks[entry];if(!original)continue;
    blocks[entry]=c=>copyClear(c,entry,original);
  }
  for(const entry of [132304,134444]){
    const original=blocks[entry];if(!original)continue;
    blocks[entry]=c=>textureTail(c,entry,original);
  }
  const remap=blocks[170612];if(remap)blocks[170612]=c=>blueRemap(c,remap);
}

function blueRemap(c,original){
  const r=c.r,count=r.esi>>>0,start=r.edi+1;
  if(c.onWrite||c.onPixelLoop||!count||count>64000||start+count>c.memory.length||
    (start<170629&&start+count>169672))return original(c);
  const step=c.u32(169672),lookup=c.u32(170625);
  let a=r.eax,b=r.ebx,d=r.edx,destination=r.edi,lastB=b;
  for(let i=0;i<count;i++){
    a=((a&0xffffff00)|((b>>>8)&255))>>>0;destination=(destination+1)>>>0;
    lastB=b;b=(b+step)>>>0;
    d=((d&0xffffff00)|c.u8(destination))>>>0;
    d=((d&0xffff00ff)|c.u8((lookup+a)>>>0)<<8)>>>0;
    a=((a&0xffffff00)|c.u8(d))>>>0;
    c.current=170632;c.w8(destination,a&255);
  }
  r.eax=a;r.ebx=c.add(lastB,step,32)>>>0;r.edx=d;r.edi=destination;
  r.esi=c.sub(1,1,32,true)>>>0;
  c.instructions+=count*9;c.blocks+=count-1;c.current=170634;
  return 170636;
}

function copyClear(c,entry,original){
  const r=c.r,source=r.esi,destination=r.edi,count=r.ecx>>>0,bytes=count*8;
  if(c.onWrite||!count||source+bytes>c.memory.length||destination+bytes>c.memory.length||
    (source<destination+bytes&&destination<source+bytes))return original(c);
  c.checkWrite(source,bytes);c.checkWrite(destination,bytes);
  r.eax=c.u32(source+bytes-8);r.ebx=c.u32(source+bytes-4);
  c.memory.copyWithin(destination,source,source+bytes);
  if(r.ebp===0)c.memory.fill(0,source,source+bytes);
  else for(let p=source;p<source+bytes;p+=4)c.view.setUint32(p,r.ebp,true);
  r.esi=(source+bytes)>>>0;
  r.edi=c.add(destination+bytes-8,8,32)>>>0;
  r.ecx=c.sub(1,1,32,true)>>>0;
  c.instructions+=count*10;c.blocks+=count-1;c.current=entry+22;
  return entry+24;
}
