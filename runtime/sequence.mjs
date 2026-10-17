// Development composition from one seed; timer/device scheduling is exploratory.
import { DemoFpu } from './machine.mjs';
import {prepareOpeningVideo,drawOpeningVideo,enterOpeningScene} from './opening-video.mjs';
import {executeIntroTick} from './generated/intro-tick.mjs';
import { executeOpeningFrame } from './generated/opening-frame.mjs';
import { executeOpeningTick } from './generated/opening-tick.mjs';
import { executeMixer } from './generated/mixer.mjs';
import { executeOrangeInit } from './generated/orange-init.mjs';
import { executeOrangeSetup } from './generated/orange-setup.mjs';
import { executeOrangeFrame } from './generated/orange-frame.mjs';
import { executeOrangeTick } from './generated/orange-tick.mjs';
import { installArchiveDos } from './archive-dos.mjs';
import { executeBlueInit } from './generated/blue-init.mjs';
import { executeBlueSetup } from './generated/blue-setup.mjs';
import { executeBlueFrame } from './generated/blue-frame.mjs';
import { executeBlueTick } from './generated/blue-tick.mjs';
import {executeCreditsInit} from './generated/credits-init.mjs';
import {executeCreditsSetup} from './generated/credits-setup.mjs';
import {executeCreditsFrame} from './generated/credits-frame.mjs';
import {executeCreditsTick} from './generated/credits-tick.mjs';
import {executeTerrainInit} from './generated/terrain-init.mjs';
import {executeTerrainSetup} from './generated/terrain-setup.mjs';
import {executeTerrainFrame} from './generated/terrain-frame.mjs';
import {executeTerrainTick} from './generated/terrain-tick.mjs';
import {executeRadialInit} from './generated/radial-init.mjs';
import {executeRadialSetup} from './generated/radial-setup.mjs';
import {executeRadialFrame} from './generated/radial-frame.mjs';
import {executeRadialTick} from './generated/radial-tick.mjs';
import {executeMonochromeInit} from './generated/monochrome-init.mjs';
import {executeMonochromeStep} from './generated/monochrome-frame.mjs';
import {executeMonochromeTick} from './generated/monochrome-tick.mjs';
import {executeV08Init} from './generated/v08-init.mjs';
import {executeV08Setup} from './generated/v08-setup.mjs';
import {executeV08Step} from './generated/v08-frame.mjs';
import {executeV08Tick} from './generated/v08-tick.mjs';
import {executeCavernInit} from './generated/cavern-init.mjs';
import {executeCavernSetup} from './generated/cavern-setup.mjs';
import {executeCavernStep} from './generated/cavern-frame.mjs';
import {executeCavernTick} from './generated/cavern-tick.mjs';
import {executeWhiteInit} from './generated/white-init.mjs';
import {executeWhiteSetup} from './generated/white-setup.mjs';
import {executeWhiteEnding} from './generated/white-ending-frame.mjs';
import {executeWhiteStep} from './generated/white-frame.mjs';
import {executeWhiteTick} from './generated/white-tick.mjs';
export const previewTiming = { pitHz:1193182, divisor:0x4100, fps:10 };
export function createOpeningSequence(machine, initialPalette, {files,initialScene='opening',startWithIntro=false,musicState,resume,onPcm,extendCredits=true,extendTerrain=false,extendRadial=false,extendMonochrome=false,extendV08=false,extendCavern=false,extendWhite=false}={}) {
  let tick=resume?.tick??0, samples=resume?.samples??0;
  let scene=resume?.scene??(startWithIntro?'intro':initialScene);
  const updates={intro:executeIntroTick,opening:executeOpeningTick,orange:executeOrangeTick,blue:executeBlueTick,credits:executeCreditsTick,terrain:executeTerrainTick,radial:executeRadialTick,monochrome:executeMonochromeTick,v08:executeV08Tick,cavern:executeCavernTick,white:executeWhiteTick,ending:executeWhiteTick};
  const drawings={opening:executeOpeningFrame,orange:executeOrangeFrame,blue:executeBlueFrame,credits:executeCreditsFrame,terrain:executeTerrainFrame,radial:executeRadialFrame,monochrome:executeMonochromeStep,v08:executeV08Step,cavern:executeCavernStep,white:executeWhiteStep};
  if(!updates[scene])throw new Error('Unsupported initial scene');
  let palette=(resume?.palette??initialPalette).map(rgb=>rgb.slice());
  const rate=machine.u16(0x1291);
  const introHeap=resume?.introHeap??machine.u32(0x4fc0c);
  if(startWithIntro&&!resume){
    if(!musicState)throw new Error('Missing soundtrack startup data');
    prepareOpeningVideo(machine,musicState);
    machine.r.esp=0x4fc0c;machine.w32(0x4fc0c,0x4b618);
    palette=Array.from({length:256},()=>[0,0,0]);
  }
  function leaveAllocatedScene(){
    machine.pop(); // scene RET
    machine.w32(8,machine.pop()); // main dispatcher's allocator restore
  }
  function enterAllocatedScene(returnAddress){
    machine.push(machine.u32(8));
    machine.push(returnAddress);
  }
  function interrupt() {
    const registers={...machine.r}, fpu=machine.f;
    machine.f=new DemoFpu(machine);
    try {
      const target=Math.floor((tick+1)*rate*previewTiming.divisor/previewTiming.pitHz/4)*4;
      const count=target-samples;
      if(count&&(scene!=='intro'||(machine.u16(0x1f5b)&0x400))){
        machine.r.ecx=count;machine.r.edi=0;executeMixer(machine);
        if(onPcm){const address=machine.u32(0x12db);onPcm(machine.memory.slice(address,address+count),samples);}
      }
      samples=target;
      let component=0;
      const update=updates[scene];
      update(machine,{output(port,size,value){
        if(port===0x3c8)component=value*3;
        else {palette[Math.floor(component/3)][component%3]=value&63;component++;}
      }});
      tick++;
    } finally {machine.r=registers;machine.f=fpu;}
  }
  const frame=function(index) {
    const target=Math.floor(index/previewTiming.fps*previewTiming.pitHz/previewTiming.divisor);
    while(tick<target)interrupt();
    if(scene==='intro'){
      if(!drawOpeningVideo(machine)){
        const pixelOffset=0xa0000-machine.u32(0x18);
        return {pixels:machine.memory.slice(pixelOffset,pixelOffset+64000),palette:palette.map(rgb=>rgb.slice()),tick,scene};
      }
      machine.pop();machine.push(introHeap);machine.push(0x4b64d);machine.w32(8,introHeap);
      machine.memory.fill(0,0xa0000-machine.u32(0x18),0xa0000-machine.u32(0x18)+64000);
      enterOpeningScene(machine);scene='opening';
    }
    if(scene==='opening'&&(machine.u16(0x12bf)>5||(machine.u16(0x12bf)===5&&(machine.u8(0x12ca)&63)>=60))){
      if(!files)return null;
      machine.w32(8,machine.u32(0x4fc0c));
      installArchiveDos(machine,files);
      executeOrangeInit(machine);
      // Native PIT/vector installation is outside this host-scheduled preview.
      executeOrangeSetup(machine);
      scene='orange';
    }
    if(scene==='orange'&&machine.u16(0x12bf)>=12){
      if(!files?.has('TIETO6.ER')||!files.has('TIETU.ER'))return null;
      machine.w32(8,machine.u32(0x4fc0c));
      installArchiveDos(machine,files);executeBlueInit(machine);executeBlueSetup(machine);scene='blue';
    }
    if(scene==='blue'&&machine.u16(0x12bf)>=22){
      if(!extendCredits)return null;
      machine.w32(8,machine.u32(0x4fc0c));
      executeCreditsInit(machine);executeCreditsSetup(machine);scene='credits';
    }
    if(scene==='credits'&&machine.u16(0x12bf)>=24){
      if(!extendTerrain||!files?.has('MAAA.ER'))return null;
      machine.w32(8,machine.u32(0x4fc0c));
      installArchiveDos(machine,files);executeTerrainInit(machine);executeTerrainSetup(machine);scene='terrain';
    }
    if(scene==='terrain'&&machine.u16(0x12bf)>=26){
      if(!extendRadial||!files?.has('MUNA.ER')||!files.has('MUNA2.ER'))return null;
      machine.w32(8,machine.u32(0x4fc0c));
      installArchiveDos(machine,files);executeRadialInit(machine);executeRadialSetup(machine);scene='radial';
    }
    if(scene==='radial'&&machine.u16(0x12bf)>=28){
      if(!extendMonochrome)return null;
      leaveAllocatedScene();
      // Timer installation/retrace at 4958C/49607 remains an explicit host boundary.
      executeMonochromeInit(machine);scene='monochrome';
    }
    if(scene==='monochrome'&&machine.u16(0x12bf)>=30){
      if(!extendV08||!files?.has('PALLOA.ER')||!files.has('PALLOD.ER'))return null;
      // The main dispatcher does not pop an allocator checkpoint after monochrome.
      machine.pop(); // monochrome RET; its caller has no saved allocator
      enterAllocatedScene(0x4b882);
      installArchiveDos(machine,files);executeV08Init(machine);executeV08Setup(machine);scene='v08';
    }
    if(scene==='v08'&&machine.u16(0x12bf)>=35){
      if(!extendCavern||!files?.has('PALLOAK2.ER')||!files.has('AURI.ER'))return null;
      leaveAllocatedScene();enterAllocatedScene(0x4b8d0);
      installArchiveDos(machine,files);executeCavernInit(machine);executeCavernSetup(machine);scene='cavern';
    }
    if(scene==='cavern'&&machine.u16(0x12bf)>=39){
      if(!extendWhite||!files?.has('KALAMAS.ER')||!files.has('KALALAS.ER'))return null;
      // Original CPU exit 49044–49050 preserves this phase before timer teardown.
      machine.f.push(machine.f.mem(0x47c7e,8));machine.f.store(0x4960,8,true);
      leaveAllocatedScene();enterAllocatedScene(0x4b91a);
      installArchiveDos(machine,files);executeWhiteInit(machine);executeWhiteSetup(machine);scene='white';
    }
    if(scene==='white'&&machine.u16(0x12bf)>=45){
      // The original white loop falls through its order-45 branch into the
      // ending picture: it draws the final white frame, copies the production
      // ending picture, clears the shared counter and waits at 42160 until the
      // counter reaches 0x2BC or a keyboard press arrives.
      executeWhiteEnding(machine);
      scene='ending';
    }
    if(scene==='ending'&&machine.u32(0x469c)>=0x2bc)return null;
    if(['v08','cavern','white','ending'].includes(scene)){
      machine.ioRead=(port,size)=>{if(port!==0x60||size!==1)throw new Error('Unsupported scene input');return 0;};
      if(scene!=='ending'&&machine.u32(0x469c)<1)machine.w32(0x469c,1); // explicit first-frame retrace pulse
    }
    if(scene!=='ending'){ // the original waits on the static production picture; the ISR animates its palette
      const draw=drawings[scene];
      draw(machine);
    }
    const pixelOffset=scene==='credits'?machine.u32(0x36ae8):['monochrome','v08','cavern','white','ending'].includes(scene)?0xa0000-machine.u32(0x18):0x330000;
    return {pixels:machine.memory.slice(pixelOffset,pixelOffset+64000),palette:palette.map(rgb=>rgb.slice()),tick,scene};
  };
  frame.snapshot=()=>({tick,samples,scene,palette:palette.map(rgb=>rgb.slice()),introHeap});
  return frame;
}
