import { DemoMachine } from '../runtime/machine.mjs';
import { createOpeningSequence, previewTiming } from '../runtime/sequence.mjs';
import {decodeS3M} from './module-data.mjs';
import {restoreCheckpoint} from '../runtime/checkpoint.mjs';
import {loadSeekPoint,loadSeekIndex} from './seek-points.mjs';

const names = ['JORNMA5.ER','JORNMAMO.ER','TIETO6.ER','TIETU.ER','MAAA.ER','MUNA.ER','MUNA2.ER','PALLOA.ER','PALLOD.ER','PALLOAK2.ER','AURI.ER','KALAMAS.ER','KALALAS.ER'];
let inputs, generation = 0, paused = false, audioClock = false, audioSeconds = 0;
let audioAt=0,wallSeconds=0,wallAt=0;
const playbackSeconds=()=>audioClock?audioSeconds+(performance.now()-audioAt)/1000:wallSeconds+(performance.now()-wallAt)/1000;
const tasks=[],taskChannel=new MessageChannel();
// Start each zero timer from a message task to reset timer nesting, while
// still allowing other ports (audio clock, pause and seek) to run fairly.
taskChannel.port1.onmessage=()=>{const resolve=tasks.shift();if(resolve)setTimeout(resolve,0);};
const yieldFrame = milliseconds => new Promise(resolve => {if(milliseconds>0)setTimeout(resolve,milliseconds);else{tasks.push(resolve);taskChannel.port2.postMessage(0);}});
let waiting;
const wake=()=>{const resolve=waiting;waiting=null;resolve?.();};
const waitForControl=()=>new Promise(resolve=>{waiting=resolve;});
async function load(path, binary = false) {
  const response = await fetch(new URL(path, import.meta.url));
  if (!response.ok) throw new Error(`Could not load demo data (${response.status})`);
  return binary ? response.arrayBuffer() : response.json();
}
function prepare() {
  return inputs ??= Promise.all([
    load('../data/start.bin', true), load('../data/start.json'),
    Promise.all(names.map(async name => [name, new Uint8Array(await load('../data/assets/' + name, true))])),
    load('../data/music-state.bin',true),
  ]);
}
function compose([buffer, state, resources,musicState],checkpoint) {
  const restored=checkpoint?restoreCheckpoint(new Uint8Array(buffer),checkpoint.bytes):null;
  const memory = restored?.machine.memory??new Uint8Array(buffer.slice(0));
  if (memory.length !== 0x800000) throw new Error('Invalid demo startup data');
  for (const offset of [0x3d,0x45,0x4d]) memory[offset] |= 1;
  const machine = restored?.machine??new DemoMachine(memory, { ...state.registers, eip: 0x2c898 });
  return {next:createOpeningSequence(machine, state.palette, { files: new Map(resources),startWithIntro:true,musicState:new Uint8Array(musicState),resume:restored?.state.sequence, extendTerrain:true, extendRadial:true, extendMonochrome:true, extendV08:true, extendCavern:true, extendWhite:true }),index:restored?.state.nextIndex??0};
}
function present(frame, extra) {
  const rgba = new Uint8ClampedArray(64000 * 4);
  for (let i = 0; i < frame.pixels.length; i++) {
    const rgb = frame.palette[frame.pixels[i]];
    for (let channel = 0; channel < 3; channel++) rgba[i*4+channel] = (rgb[channel]<<2)|(rgb[channel]>>4);
    rgba[i*4+3] = 255;
  }
  self.postMessage({ ...extra, scene:frame.scene, rgba:rgba.buffer }, [rgba.buffer]);
}
self.onmessage = async ({data}) => {
  if ('pause' in data) {
    if(data.pause&&!paused){wallSeconds=playbackSeconds();wallAt=performance.now();}
    if(!data.pause&&paused){wallAt=audioAt=performance.now();}
    paused = data.pause; wake(); return;
  }
  if ('clock' in data) { audioSeconds = Math.max(audioSeconds, data.clock); audioAt=performance.now(); wake(); return; }
  if ('clockEnabled' in data) {
    if(audioClock&&!data.clockEnabled){wallSeconds=playbackSeconds();wallAt=performance.now();}
    audioClock = data.clockEnabled; wake(); return;
  }
  wake();
  if (data.stop) { generation++; return; }
  const run = ++generation;
  try {
    const seconds=Math.max(0,data.seconds||0);
    const [prepared,checkpoint]=await Promise.all([prepare(),data.prepare?null:loadSeekPoint('graphics',seconds)]);
    const {next,index:startIndex}=compose(prepared,checkpoint);
    if (run !== generation) return;
    if (data.prepare) { let frame;for(let i=0;i<=20;i++)frame=next(i);const [buffer]=prepared;present(frame, {ready:true,module:decodeS3M(new Uint8Array(buffer)),seek:await loadSeekIndex()}); return; }
    paused = false; audioClock = false; audioSeconds = 0;
    const target = Math.max(0, Math.floor((data.seconds || 0) * previewTiming.fps));
    let firstFrame=true;
    for (let index = startIndex; run === generation;) {
      // Wake directly on clock/pause/seek messages. Polling with timers adds
      // avoidable delay and nested zero timers are clamped by the browser.
      while (run === generation && paused) await waitForControl();
      if (run !== generation) return;
      // Audio is the playback clock. Advance every original PIT interrupt, but
      // draw only the current picture when rendering cannot keep up. Replaying
      // every missed drawing here makes slow scenes run in slow motion while
      // their independent soundtrack continues at normal speed.
      if(index>=target&&!firstFrame)index=Math.max(index,playbackSeconds()*previewTiming.fps);
      const started = performance.now(), frame = next(index);
      if (!frame) { self.postMessage({ended:true,requestId:data.requestId, seconds:index/previewTiming.fps}); return; }
      if (index < target) {
        if (index % 10 === 0) self.postMessage({seeking:true,requestId:data.requestId, seconds:index/previewTiming.fps});
        index++;
        await yieldFrame(0);
        continue;
      }
      if(firstFrame){wallSeconds=index/previewTiming.fps;wallAt=performance.now();firstFrame=false;}
      present(frame, {frame:true,requestId:data.requestId, index, seconds:index/previewTiming.fps,renderMs:performance.now()-started});
      // No FPS target or scheduled frame interval. Checkpoint index units are
      // only a time conversion; live drawing runs as fast as computation allows.
      await yieldFrame(0);
    }
  } catch (error) {
    if (run === generation) self.postMessage({error:error.message,requestId:data.requestId});
  }
};
