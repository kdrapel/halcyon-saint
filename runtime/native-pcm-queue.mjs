// Streaming linear resampling of native unsigned mono bytes. No captured audio.
export class NativePcmQueue {
  constructor(sourceRate, outputRate) {
    if(!Number.isInteger(sourceRate)||!Number.isInteger(outputRate)||sourceRate<8000||outputRate<8000)throw new Error('Invalid PCM rate');
    this.sourceRate=sourceRate;this.outputRate=outputRate;this.blocks=[];this.head=0;this.offset=0;
    this.available=0;this.phase=0;this.consumed=0;this.underrunFrames=0;this.started=false;
  }
  append(bytes) {
    if(!(bytes instanceof Uint8Array)||!bytes.length)throw new Error('Nonempty native PCM bytes required');
    if(this.available+bytes.length>65536)throw new Error('PCM queue bound exceeded');
    this.blocks.push(bytes);this.available+=bytes.length;
  }
  peek(index) {
    const first=this.blocks[this.head];const position=this.offset+index;
    return position<first.length?first[position]:this.blocks[this.head+1][position-first.length];
  }
  consume(count) {
    this.available-=count;this.consumed+=count;
    while(count){const first=this.blocks[this.head],step=Math.min(count,first.length-this.offset);
      this.offset+=step;count-=step;
      if(this.offset===first.length){this.head++;this.offset=0;}
    }
    if(this.head>=32){this.blocks=this.blocks.slice(this.head);this.head=0;}
  }
  fill(output) {
    let rendered=0;
    for(let i=0;i<output.length;i++) {
      const nextPhase=this.phase+this.sourceRate,step=Math.floor(nextPhase/this.outputRate);
      if(this.available<Math.max(2,step)){output[i]=0;if(this.started)this.underrunFrames++;continue;}
      this.started=true;
      const a=this.peek(0),b=this.peek(1);
      output[i]=(a+(b-a)*this.phase/this.outputRate-128)/128;
      this.phase=nextPhase%this.outputRate;this.consume(step);rendered++;
    }
    return rendered;
  }
  get seconds(){return (this.consumed+this.phase/this.outputRate)/this.sourceRate;}
}
