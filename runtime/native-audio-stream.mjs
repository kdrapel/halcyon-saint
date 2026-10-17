import {executeMixer} from './generated/mixer.mjs';
import {resetMusic,startMusic} from './music-start.mjs';
// Keep native mixer invocation boundaries tied to PIT time, independent of
// browser output quanta. Long JS comparison found arbitrary fill boundaries
// differ; retain the schedule used by the validated visual composition.
export class NativeAudioStream {
  constructor(machine,{introState}={}){this.machine=machine;this.rate=machine.u16(0x1291);this.tick=0;this.produced=0;this.pending=new Uint8Array(0);this.offset=0;this.markers=[];this.lastMarker='';this.intro=!!introState;if(introState)resetMusic(machine,introState);}
  takeMarkers(){const markers=this.markers;this.markers=[];return markers;}
  fill(count){
    if(!Number.isInteger(count)||count<4||count>4096||count%4)throw new Error('Aligned bounded audio fill required');
    const result=new Uint8Array(count);let position=0;
    while(position<count){
      if(this.offset===this.pending.length){
        const target=Math.floor((this.tick+1)*this.rate*0x4100/(1193182*4))*4;
        const bytes=target-this.produced,c=this.machine;
        if(this.intro&&this.tick===35)startMusic(c);
        if(this.intro&&this.tick<35)this.pending=new Uint8Array(bytes).fill(128);
        else{c.r.ecx=bytes;c.r.edi=0;executeMixer(c);const address=c.u32(0x12db);this.pending=c.memory.slice(address,address+bytes);}
        this.offset=0;
        const order=c.u16(0x12bf),row=c.u8(0x12ca),marker=order+':'+row;
        if(marker!==this.lastMarker){this.markers.push({sample:this.produced,order,row});this.lastMarker=marker;}
        this.produced=target;this.tick++;
      }
      const take=Math.min(count-position,this.pending.length-this.offset);
      result.set(this.pending.subarray(this.offset,this.offset+take),position);position+=take;this.offset+=take;
    }
    return result;
  }
}
