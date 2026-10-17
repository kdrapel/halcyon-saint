import { NativeAudioPlayer } from './native-audio.mjs';
import {ModuleTrackerView} from './tracker-view.mjs';

const $ = selector => document.querySelector(selector);
const shell=$('#shell'), gate=$('#gate'), start=$('#start'), hud=$('#hud'), status=$('#status');
const screen=$('#screen'), context=screen.getContext('2d',{alpha:false});
const background=$('#background').getContext('2d',{alpha:false});
const timeline=$('#timeline'), time=$('#time'), pause=$('#pause');
const statsToggle=$('#stats-toggle'),stats=$('#stats'),nerdPanel=$('#nerd-panel'),playerDetails=$('#player-details');
const tracker=new ModuleTrackerView($('#tracker'),$('#tracker-title'));
const loadingOverlay=$('#loading');
const worker=new Worker(new URL('./render-worker.mjs',import.meta.url),{type:'module'});
let playing=false, paused=false, scrubbing=false, position=0, audio=null, audioOffset=0, hudTimer;
let statsEnabled=false,statsDirty=false,statsUpdated=0,displayedFrames=[],scene='',renderMs=0,audioError='';
let requestId=0,loading=false,framePrepared=false,audioPrepared=false,scrubPointer=null;
const clock=seconds=>`${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
function resetStats(){displayedFrames=[];statsDirty=false;statsUpdated=0;stats.textContent='FPS: —';tracker.clear();}
statsToggle.addEventListener('change',()=>{statsEnabled=statsToggle.checked;nerdPanel.hidden=!statsEnabled||!playing;resetStats();});
function updateStats(now){
  requestAnimationFrame(updateStats);if(!statsEnabled)return;
  nerdPanel.hidden=!playing;if(!playing)return;
  if(loading){displayedFrames=[];statsDirty=false;stats.textContent='FPS: — (loading)';return;}
  if(paused){displayedFrames=[];statsDirty=false;stats.textContent='FPS: 0 (paused)';return;}
  // Count pictures actually presented in distinct browser paints.
  if(statsDirty)displayedFrames.push(now);statsDirty=false;
  while(displayedFrames.length&&displayedFrames[0]<=now-1000)displayedFrames.shift();
  if(now-statsUpdated<250)return;statsUpdated=now;
  stats.textContent=`FPS: ${displayedFrames.length} · Render: ${renderMs.toFixed(1)} ms · ${scene}`;
  const snapshot=audio?.snapshot;
  const rates=snapshot?.sourceRate?`${snapshot.sourceRate} → ${snapshot.outputRate} Hz`:'starting';
  const audioTime=snapshot?.started&&Number.isFinite(snapshot.seconds)?audioOffset+snapshot.seconds:null;
  const drift=audioTime===null?'—':`${(audioTime-position).toFixed(2)} s`;
  playerDetails.textContent=`Player: JavaScript · 320 × 200 · Audio: ${snapshot?.state??'starting'} · ${rates} · Underruns: ${snapshot?.underrunFrames??0} · Graphics behind audio: ${drift}`;
  tracker.draw(snapshot?.tracker);
}
requestAnimationFrame(updateStats);

function revealControls() {
  if(document.fullscreenElement)return;
  hud.classList.add('visible'); clearTimeout(hudTimer);
  hudTimer=setTimeout(()=>hud.classList.remove('visible'),2500);
}
function closeAudio() { audio?.close(); audio=null; worker.postMessage({clockEnabled:false}); }
function finishLoading(id){
  if(id!==requestId||!playing||!framePrepared||!audioPrepared)return;
  loading=false;loadingOverlay.hidden=true;pause.disabled=false;status.textContent=audioError;
  worker.postMessage({pause:false});
  if(audio?.context?.state==='suspended')audio.resume().catch(error=>{audioError=`Music: ${error.message}`;status.textContent=audioError;});
}
async function startAudio(seconds,id) {
  closeAudio();
  if(!playing)return;
  audioOffset=seconds;
  const current=new NativeAudioPlayer({volume:1,onStatus:state=>{
    if(audio!==current)return;
    if(state.error){audioError=`Music: ${state.error}`;status.textContent=audioError;worker.postMessage({clockEnabled:false});return;}
    if(state.started && Number.isFinite(state.seconds)) {
      worker.postMessage({clock:audioOffset+state.seconds});
      worker.postMessage({clockEnabled:true});
    }
  }});
  audio=current;
  await current.start(seconds,{hold:true});
  if(audio!==current||id!==requestId)return;
  audioPrepared=true;finishLoading(id);
}
function run(seconds=0) {
  closeAudio(); playing=true; paused=false; scrubbing=false;
  const id=++requestId;loading=true;framePrepared=false;audioPrepared=false;loadingOverlay.hidden=false;pause.disabled=true;
  audioError='';resetStats();nerdPanel.hidden=!statsEnabled;
  position=Math.max(0,Math.min(Number(timeline.max),seconds));
  gate.classList.add('hidden'); hud.hidden=false; pause.textContent='Pause';
  status.textContent='';
  timeline.value=String(position); time.textContent=clock(position); revealControls();
  worker.postMessage({seconds:position,requestId:id});
  startAudio(position,id).catch(error=>{if(id!==requestId)return;audioError=`Music: ${error.message}`;audioPrepared=true;finishLoading(id);});
}
function stop(message='') {
  requestId++;loading=false;loadingOverlay.hidden=true;pause.disabled=false;
  if(scrubPointer!==null&&timeline.hasPointerCapture(scrubPointer))timeline.releasePointerCapture(scrubPointer);scrubPointer=null;
  playing=false;paused=false;scrubbing=false;worker.postMessage({stop:true});closeAudio();
  gate.classList.remove('hidden');hud.hidden=true;pause.textContent='Pause';
  nerdPanel.hidden=true;resetStats();
  timeline.value='0';time.textContent='0:00';position=0;status.textContent=message;
}
function togglePause() {
  if(!playing||loading)return;
  paused=!paused;worker.postMessage({pause:paused});pause.textContent=paused?'Resume':'Pause';
  if(paused)audio?.pause();else audio?.resume();revealControls();
}
async function fullscreen() {
  try { if(document.fullscreenElement)await document.exitFullscreen();else await shell.requestFullscreen(); }
  catch {status.textContent='Fullscreen is unavailable in this browser.';}
}
let lastRunFrame=-1;
worker.onmessage=({data})=>{
  if(data.ready){
    background.putImageData(new ImageData(new Uint8ClampedArray(data.rgba),320,200),0,0);tracker.setModule(data.module);
    timeline.max=String(data.seek.duration-0.1);
    $('#seek-marks').replaceChildren(...data.seek.graphics.map(point=>{const option=document.createElement('option');option.value=String(point.seconds);return option;}));
    start.disabled=false;start.textContent='Start';return;
  }
  if(data.requestId!==undefined&&data.requestId!==requestId)return;
  if(data.error){if(!playing){status.textContent=data.error;start.textContent='Reload to retry';}else stop(`Playback stopped: ${data.error}`);return;}
  if(!playing)return;
  if(data.seeking)return;
  if(data.ended){timeline.max=String(data.seconds);stop('Demo complete');return;}
  if(data.frame){
    context.putImageData(new ImageData(new Uint8ClampedArray(data.rgba),320,200),0,0);
    position=data.seconds;lastRunFrame=data.index;status.textContent=audioError;
    scene=data.scene;renderMs=data.renderMs;statsDirty=true;
    if(!scrubbing){timeline.value=String(position);time.textContent=clock(position);}
    if(loading){framePrepared=true;worker.postMessage({pause:true});finishLoading(requestId);}
  }
};
worker.onerror=event=>stop(`Playback stopped: ${event.message}`);
start.addEventListener('click',()=>{lastRunFrame=-1;run();});
pause.addEventListener('click',togglePause);
$('#stop').addEventListener('click',()=>stop());$('#fullscreen').addEventListener('click',fullscreen);
$('#backward').addEventListener('click',()=>run(position-15));$('#forward').addEventListener('click',()=>run(position+15));
timeline.addEventListener('input',()=>{scrubbing=true;time.textContent=clock(Number(timeline.value));});
timeline.addEventListener('change',()=>{lastRunFrame=-1;run(Number(timeline.value));});
function cueAtPointer(event){const rect=timeline.getBoundingClientRect(),ratio=Math.max(0,Math.min(1,(event.clientX-rect.left-8)/Math.max(1,rect.width-16)));const step=Number(timeline.step);timeline.value=String(Math.round(ratio*Number(timeline.max)/step)*step);time.textContent=clock(Number(timeline.value));}
timeline.addEventListener('pointerdown',event=>{if(event.button!==0)return;event.preventDefault();scrubbing=true;scrubPointer=event.pointerId;timeline.focus();timeline.setPointerCapture(event.pointerId);cueAtPointer(event);});
timeline.addEventListener('pointermove',event=>{if(event.pointerId===scrubPointer)cueAtPointer(event);});
timeline.addEventListener('pointerup',event=>{if(event.pointerId!==scrubPointer)return;cueAtPointer(event);timeline.releasePointerCapture(event.pointerId);scrubPointer=null;lastRunFrame=-1;run(Number(timeline.value));});
timeline.addEventListener('pointercancel',()=>{scrubbing=false;scrubPointer=null;timeline.value=String(position);time.textContent=clock(position);});
shell.addEventListener('pointermove',revealControls);shell.addEventListener('pointerdown',revealControls);
document.addEventListener('keydown',event=>{
  if(event.target instanceof HTMLInputElement)return;
  if(event.code==='Space'){event.preventDefault();if(playing)togglePause();else if(!start.disabled){lastRunFrame=-1;run();}}
  else if(event.code==='ArrowLeft'||event.code==='ArrowRight'){event.preventDefault();if(playing){lastRunFrame=-1;run(position+(event.code==='ArrowRight'?10:-10));}}
  else if(event.code==='KeyF')fullscreen();else if(event.code==='Escape'&&playing)stop();
});
worker.postMessage({prepare:true});
