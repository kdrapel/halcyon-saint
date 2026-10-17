import { DemoMachine } from '../runtime/machine.mjs';
import { NativeAudioStream } from '../runtime/native-audio-stream.mjs';
import {restoreCheckpoint} from '../runtime/checkpoint.mjs';
import {loadSeekPoint} from './seek-points.mjs';
let machine, stream, port, position = 0, origin=0,initialMarker;
async function load(path, binary = false) {
  const response = await fetch(new URL(path, import.meta.url));
  if (!response.ok) throw new Error(`Could not load music data (${response.status})`);
  return binary ? response.arrayBuffer() : response.json();
}
self.onmessage = async ({data}) => {
  try {
    if (data.initialize) {
      const [buffer, state,introState,checkpoint] = await Promise.all([load('../data/start.bin',true),load('../data/start.json'),load('../data/music-state.bin',true),loadSeekPoint('audio',data.seconds||0)]);
      const restored=checkpoint?restoreCheckpoint(new Uint8Array(buffer),checkpoint.bytes):null;
      const memory = restored?.machine.memory??new Uint8Array(buffer);
      for (const offset of [0x3d,0x45,0x4d]) memory[offset] |= 1;
      machine = restored?.machine??new DemoMachine(memory, {...state.registers});
      stream = new NativeAudioStream(machine,restored?{}:{introState:new Uint8Array(introState)});
      if(restored)Object.assign(stream,restored.state.stream,{pending:Uint8Array.from(restored.state.stream.pending)});
      let skip = Math.floor((data.seconds || 0) * stream.rate / 4) * 4;
      origin=skip;
      skip-=restored?.state.consumed??0;
      while (skip) { const count = Math.min(skip,4096); stream.fill(count); skip -= count; }
      stream.takeMarkers();initialMarker={sample:0,order:machine.u16(0x12bf),row:machine.u8(0x12ca)};
      self.postMessage({ready:true,sourceRate:stream.rate});
    } else if (data.connect) {
      if (!machine || port) throw new Error('Music initialization order');
      port = data.port;
      port.onmessage = ({data:request}) => {
        try {
          if (request.pull !== 4096) throw new Error('Invalid music request');
          const pcm = stream.fill(request.pull);
          const markers=stream.takeMarkers().map(marker=>({...marker,sample:marker.sample-origin}));
          if(position===0)markers.unshift(initialMarker);
          port.postMessage({offset:position,pcm:pcm.buffer,markers,order:machine.u16(0x12bf),row:machine.u8(0x12ca)},[pcm.buffer]);
          position += request.pull;
        } catch (error) { port.postMessage({error:error.message}); port.close(); }
      };
      port.start();
    }
  } catch (error) { self.postMessage({error:error.message}); }
};
