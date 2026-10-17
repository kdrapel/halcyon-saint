import {restoreCheckpoint,encodeCheckpoint} from '../runtime/checkpoint.mjs';
import {createOpeningSequence} from '../runtime/sequence.mjs';
import {executeOpeningFrame} from '../runtime/generated/opening-frame.mjs';

export const cells={primary:0x4c00,secondary:0x2b7f8,active:0x2b7e4,mix:0x2b7e8,velocity:0x2b7ec,path:0x2b7fc};
export const mapping={plane:0x2a0f5,cylinder:0x29d9a};

// Retain the original scheduler, path evaluation, x87 arithmetic and rasterizer.
// Only the selected frame's *input* is cloned for repeatable experiments.
export class OpeningExperiment {
  constructor(base,checkpoints){
    this.base=base;this.checkpoints=checkpoints;this.index=-1;
    // TXT3.SCX palette read at 2C3B6. Use the original resource palette,
    // before timer-driven DAC flashes/fades and scene colour transitions.
    this.normalPalette=Array.from({length:256},(_,i)=>Array.from(base.subarray(0x2aed4+i*3,0x2aed4+i*3+3)));
  }
  step(seconds){
    const target=Math.round(seconds*10);
    if(target<150||target>354)throw new RangeError('Opening experiment covers 15.0–35.4 seconds');
    if(this.input&&this.target===target&&this.index>target)return true;
    this.target=target;
    const entry=this.checkpoints.filter(p=>p.seconds*10<=target).at(-1);
    if(!this.next||target<this.index||entry.seconds*10>this.index){
      const restored=restoreCheckpoint(this.base,entry.bytes);this.machine=restored.machine;this.index=restored.state.nextIndex;
      this.next=createOpeningSequence(this.machine,[],{resume:restored.state.sequence,beforeDraw:(c,{scene,index})=>{
        if(index===this.target){if(scene!=='opening')throw new Error('Outside opening scene');this.input=encodeCheckpoint(this.base,c,{});}
      }});
    }
    const frame=this.next(this.index++);
    if(!frame||frame.scene!=='opening')throw new Error('Opening scene ended');
    this.palette=frame.palette;
    return this.index>target;
  }
  render({original=false,mix=0,turn=0}={}){
    if(!this.input)throw new Error('Select a path state first');
    const {machine:c}=restoreCheckpoint(this.base,this.input);
    const natural={primary:c.u32(cells.primary),secondary:c.u32(cells.secondary),active:c.u32(cells.active),mix:c.view.getFloat32(cells.mix,true)};
    if(!original){
      if(this.target<250)throw new RangeError('Manual blending uses the original inside-cylinder path from 25.0 seconds. Earlier plane-only states are available in original background mode.');
      if(!Number.isFinite(mix)||mix<0||mix>1)throw new RangeError('Mapping blend must be in 0..1');
      c.w32(cells.primary,mix===1?mapping.cylinder:mapping.plane);c.w32(cells.secondary,mapping.cylinder);c.w32(cells.active,mix>0&&mix<1?1:0);
      c.view.setFloat32(cells.mix,mix,true);
      // Freeze the transition's extra matrix translation while changing blend.
      c.view.setFloat32(cells.velocity,0,true);
      // The ten-channel path records contain up, target, origin and focal data.
      // Offset target X in every record; let the original cubic and look-at
      // routines evaluate it. The object-angle accumulator is unrelated.
      if(!Number.isFinite(turn)||Math.abs(turn)>2)throw new RangeError('Look target offset must be in -2..2');
      for(let p=0;p<c.u32(0x178ac);p+=40){const a=cells.path+p+12;c.view.setFloat32(a,c.view.getFloat32(a,true)+turn,true);}
    }
    executeOpeningFrame(c,{backgroundOnly:true});
    const start=c.u32(0x466c),grid=start+65536;
    return {pixels:c.memory.slice(0x330000,0x330000+64000),palette:this.normalPalette,
      grid:new Int32Array(c.memory.slice(grid,grid+41*26*12).buffer),natural,
      origin:[0,1,2].map(k=>c.view.getFloat32(0x4c1c+k*4,true)),
      primary:c.u32(cells.primary),secondary:c.u32(cells.secondary)};
  }
}
