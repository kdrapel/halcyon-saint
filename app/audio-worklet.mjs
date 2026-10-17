import {NativePcmQueue} from '../runtime/native-pcm-queue.mjs';
class NativeAudioProcessor extends AudioWorkletProcessor {
  constructor(options){
    super();this.queue=new NativePcmQueue(options.processorOptions.sourceRate,sampleRate);
    this.pending=0;this.nextOffset=0;this.blocks=0;this.stream=null;this.failed=false;
    this.markers=[];this.markerHead=0;this.currentMarker=null;
    this.port.onmessage=({data})=>{
      if(data.connect){
        this.stream=data.port;this.stream.onmessage=({data:chunk})=>{
          try {
            if(chunk.error)throw new Error(chunk.error);
            if(chunk.offset!==this.nextOffset||this.pending<=0)throw new Error('Native PCM stream order mismatch');
            const bytes=new Uint8Array(chunk.pcm);this.nextOffset+=bytes.length;this.pending--;
            this.queue.append(bytes);this.markers.push(...(chunk.markers??[]));this.queuedMarker={order:chunk.order,row:chunk.row,endSample:this.nextOffset};this.request();
          }catch(error){this.failed=true;this.port.postMessage({error:error.message});}
        };
        this.stream.start();this.request();
      }
    };
  }
  request(){while(!this.failed&&this.stream&&this.queue.available+this.pending*4096<16384){this.pending++;this.stream.postMessage({pull:4096});}}
  process(inputs,outputs){
    const output=outputs[0]?.[0];if(!output)return true;
    if(this.failed){output.fill(0);return true;}
    this.queue.fill(output);this.request();
    while(this.markerHead<this.markers.length&&this.markers[this.markerHead].sample<=this.queue.consumed)this.currentMarker=this.markers[this.markerHead++];
    if(this.markerHead>128){this.markers.splice(0,this.markerHead);this.markerHead=0;}
    // A 30 Hz renderer needs a finer clock than the former ~21 Hz reports.
    if(++this.blocks%4===0)this.port.postMessage({seconds:this.queue.seconds,samples:this.queue.consumed,
      queueSamples:this.queue.available,pending:this.pending,underrunFrames:this.queue.underrunFrames,
      contextSeconds:currentTime,started:this.queue.started,queuedMarker:this.queuedMarker,tracker:this.currentMarker});
    return true;
  }
}
registerProcessor('saint-native-audio',NativeAudioProcessor);
