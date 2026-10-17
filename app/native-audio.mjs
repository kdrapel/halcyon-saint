// Dedicated mixer worker -> direct message port -> AudioWorklet.
export class NativeAudioPlayer {
  constructor({volume=1,onStatus=()=>{}}={}){this.volume=volume;this.onStatus=onStatus;this.snapshot={state:'idle',seconds:0,underrunFrames:0};this.closed=false;}
  async start(seconds=0,{hold=false}={}){
    this.context=new AudioContext();const resumed=this.context.resume().then(()=>hold&&!this.closed?this.context.suspend():undefined);
    this.snapshot={...this.snapshot,state:'starting'};this.onStatus(this.snapshot);
    this.worker=new Worker(new URL('./audio-worker.mjs',import.meta.url),{type:'module'});
    const ready=new Promise((resolve,reject)=>{
      this.rejectReady=reject;
      this.worker.onmessage=({data})=>{if(data.error)reject(new Error(data.error));else if(data.ready)resolve(data);};
      this.worker.onerror=event=>reject(new Error(event.message));
    });
    this.worker.postMessage({initialize:true,seconds});
    try{
      const [{sourceRate}]=await Promise.all([ready,this.context.audioWorklet.addModule(new URL('./audio-worklet.mjs',import.meta.url)),resumed]);
      if(this.closed)return;
      const fail=message=>{if(this.closed)return;this.snapshot={...this.snapshot,state:'error',error:message};this.onStatus(this.snapshot);this.close();};
      this.worker.onmessage=({data})=>{if(data.error)fail(data.error);};
      this.worker.onerror=event=>fail(event.message);
      this.node=new AudioWorkletNode(this.context,'saint-native-audio',{numberOfInputs:0,numberOfOutputs:1,outputChannelCount:[1],processorOptions:{sourceRate}});
      this.gain=this.context.createGain();this.gain.gain.value=this.volume;this.node.connect(this.gain).connect(this.context.destination);
      this.node.onprocessorerror=()=>fail('Native audio processor failed');
      this.context.onstatechange=()=>{if(this.closed)return;this.snapshot={...this.snapshot,state:this.context.state==='running'?(this.snapshot.started?'playing':'starting'):this.context.state};this.onStatus(this.snapshot);};
      this.node.port.onmessage=({data})=>{
        if(this.closed)return;
        if(data.error){this.snapshot={...this.snapshot,state:'error',error:data.error};this.onStatus(this.snapshot);this.close();return;}
        this.snapshot={...data,state:data.started?'playing':'starting',sourceRate,outputRate:this.context.sampleRate};this.onStatus(this.snapshot);
      };
      const channel=new MessageChannel();
      this.worker.postMessage({connect:true,port:channel.port1},[channel.port1]);
      this.node.port.postMessage({connect:true,port:channel.port2},[channel.port2]);
    }catch(error){if(!this.closed){this.snapshot={...this.snapshot,state:'error',error:error.message};this.onStatus(this.snapshot);this.close();}}
  }
  setVolume(value){this.volume=value;if(this.gain)this.gain.gain.setValueAtTime(value,this.context.currentTime);}
  pause(){return this.context?.suspend();}
  resume(){return this.context?.resume();}
  close(){if(this.closed)return;this.closed=true;this.rejectReady?.(new Error('Audio canceled'));this.node?.disconnect();this.worker?.terminate();this.context?.close().catch(()=>{});}
}
