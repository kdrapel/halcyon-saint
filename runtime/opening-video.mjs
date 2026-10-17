import {resetMusic,startMusic} from './music-start.mjs';

// ALKU.MÖH is the production's original 142-frame, 160×100 packed film.
// Decode, interpolation and radial filtering follow 4BA58 and 4BB5C–4BD49.
export function prepareOpeningVideo(c,musicState) {
  resetMusic(c,musicState);
  const raw=c.u32(0x4992c),work=c.u32(0x49930);
  c.memory.fill(0,raw,work+0x10280);
  for(const address of [0x49910,0x49928,0x49948,0x49950,0x49b8c,0x49b90,0x49bac,0x4ace8,0x4acec,0x4acf0])c.w32(address,0);
  c.w32(0x49ba8,127);c.w32(0x4aeac,7);c.w32(0x4aea4,2);c.w32(0x4aea8,60);
  c.memory.fill(0,0x4a6b0,0x4a9b0);
  c.memory.copyWithin(0x4a830,0x4a530,0x4a6b0);
  for(let i=0;i<768;i++)c.w8(0x4a9b0+i,Math.min(63,63-c.u8(0x4a3b0+i)));
}
export function drawOpeningVideo(c) {
  const m=c.memory,raw=c.u32(0x4992c),work=c.u32(0x49930),mask=c.u32(0x49938),table=c.u32(0x49944);
  const screen=0xa0000-c.u32(0x18);
  m.copyWithin(screen,work,work+64000);
  let input=c.u32(0x49918)+c.u32(0x49954+c.u32(0x49948)*4),ordinal=0;
  function pixel(value){
    const block=ordinal>>>4,x=(block%40)*4+(ordinal&3),y=Math.floor(block/40)*4+((ordinal>>>2)&3);
    m[raw+y*160+x]=value;ordinal++;
  }
  while(ordinal<16000){
    const value=m[input++];
    if(value===240){const run=m[input++],count=run>>>4;if(!count)throw new Error('Invalid original film run');for(let n=0;n<count;n++)pixel(run&15);}
    else{pixel(value>>>4);pixel(value&15);}
  }
  for(let y=0;y<100;y++)for(let x=0;x<160;x++){
    const source=raw+y*160+x,dest=work+y*640+x*2;
    const a=(m[source]<<3)&255,b=(((m[source+160]<<3)&255)+a)&255;
    const lower=b>>>1,upperNext=(m[source+1]<<3)&255;
    const lowerNext=((((m[source+161]<<3)&255)+upperNext)&255)>>>1;
    m[dest]=a;m[dest+320]=lower;m[dest+1]=((upperNext+a)&255)>>>1;m[dest+321]=((lowerNext+lower)&255)>>>1;
  }
  m.fill(0,work+64000,work+64640);m.fill(0,work-320,work);
  let previous=0;
  function blend(a,b,weight){return ((c.view.getUint32(table+((weight<<8)|a)*8,true)+c.view.getUint32(table+((weight<<8)|b)*8+4,true))>>>8)&255;}
  for(let i=0;i<64000;i++){const weight=m[mask+i],vertical=blend(m[work+i-318],m[work+i],weight);previous=blend(previous,vertical,weight);m[work+i]=previous;}
  for(let i=64000;i>0;i--){const weight=m[mask+i],vertical=blend(m[work+i+318],m[work+i],weight);previous=blend(previous,vertical,weight);m[work+i]=previous;}
  const order=c.u16(0x12bf),row=c.u8(0x12ca)&63;
  const finished=order>2||(order===2&&row>=60);
  if(!finished){
    if(c.u32(0x49928)===0 && c.u32(0x49948)>=5){
      if(!(c.u16(0x1f5b)&0x400))startMusic(c);
      c.w32(0x49928,0xffffffff);
    }
    if(order<=6&&(order===2||(order>=1&&row>=60))){
      const logo=c.u32(0x4993c),count=order===2?64000:32000;
      for(let i=0;i<count;i++)if(m[logo+i])m[work+i]=m[logo+i];
    }
    c.w32(0x49910,0);
  }
  return finished;
}
export function enterOpeningScene(c) {
  // 2C7DB–2C88F, omitting PIT/vector installation and the retrace wait.
  c.w32(0x7f50,0x2d8ad);c.w32(0x7f54,0x2d3d5);c.w32(0x7f58,0x2d5a3);
  c.memory.fill(63,0x2b4d4,0x2b7d4);c.w32(0x4694,16);c.w32(0x469c,1);
  c.w32(0x4c00,0x2a0f5);c.w32(0x467c,70);c.w32(0x4680,10000);
  c.f.push(c.f.integer(0x467c,4));c.f.push(c.f.integer(0x4680,4));c.f.binaryPop('div',1);
  c.f.store(0x178a0,8,false);c.f.store(0x178d0,8,true);
  for(const [address,value] of [[0x178a8,0],[0x178d8,240],[0x178ac,640],[0x178dc,640],[0x469c,0]])c.w32(address,value);
}
