import {frameToRgba} from './demo-core.mjs';
import {gridColours,gridSample} from './mapping-grid.mjs';
const $=id=>document.getElementById(id);
const worker=new Worker(new URL('./opening-worker.mjs',import.meta.url),{type:'module'});
const source=document.createElement('canvas');source.width=320;source.height=200;
const sourceContext=source.getContext('2d'),image=sourceContext.createImageData(320,200);
const ctx=$('lab').getContext('2d');let id=0,frame,scheduled=false;
function paint(){
 if(!frame)return;
 image.data.set(frameToRgba(frame));sourceContext.putImageData(image,0,0);ctx.imageSmoothingEnabled=false;ctx.drawImage(source,0,0,640,400);
 if($('grid').checked){ctx.strokeStyle='#ffc47888';ctx.lineWidth=.7;ctx.beginPath();for(let x=0;x<=640;x+=16){ctx.moveTo(x,0);ctx.lineTo(x,400);}for(let y=0;y<=400;y+=16){ctx.moveTo(0,y);ctx.lineTo(640,y);}ctx.stroke();}
 const map=$('coordinates').getContext('2d'),data=map.createImageData(41,26);
 const colours=gridColours(frame.grid);data.data.set(colours.rgba);
 $('grid-status').textContent=`${colours.valid} mapped samples; ${colours.invalid} invalid or empty samples shown in slate. Colours use continuous coordinate ranges, without texture wrapping.`;
 const small=document.createElement('canvas');small.width=41;small.height=26;small.getContext('2d').putImageData(data,0,0);map.imageSmoothingEnabled=false;map.drawImage(small,0,0,410,260);
}
function update(){
 const original=$('original').checked;
 $('phase').min=original?'15':'25';
 if(!original&&Number($('phase').value)<25)$('phase').value='25';
 for(const input of document.querySelectorAll('input[type=range]')){document.querySelector(`[for="${input.id}"] output`).textContent=input.id==='turn'?input.value:Number(input.value).toFixed(input.id==='phase'?1:2);}
 $('mix').disabled=original;$('turn').disabled=original;
 $('state').textContent='Computing original routines…';
 worker.postMessage({id:++id,seconds:Number($('phase').value),mix:Number($('mix').value),turn:Number($('turn').value),original});
}
function requestUpdate(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;update();});}
$('controls').addEventListener('input',requestUpdate);
$('grid').addEventListener('input',paint);
document.querySelectorAll('[data-mix]').forEach(button=>button.addEventListener('click',()=>{$('original').checked=false;$('mix').value=button.dataset.mix;requestUpdate();}));
$('reset').addEventListener('click',()=>{$('controls').reset();$('grid').checked=false;requestUpdate();});
worker.onmessage=({data})=>{
 if(data.error){$('state').textContent='Experiment unavailable: '+data.error;return;}
 if(data.id!==id)return;frame=data;paint();
 const names={172277:'plane',171418:'cylinder'};
 $('state').textContent=$('original').checked?'Original background choreography · fixed texture palette':'Manual background inputs · fixed texture palette';
 $('measured').textContent=`Original path origin: ${data.origin.map(n=>n.toFixed(2)).join(', ')}. Natural mapping: ${names[data.natural.primary]??'unknown'}${data.natural.active?' → '+(names[data.natural.secondary]??'unknown')+'; blend '+data.natural.mix.toFixed(3):''}.`;
};
worker.onerror=()=>{$('state').textContent='The renderer worker could not start. Serve the release using Start.cmd.';};
$('coordinates').addEventListener('pointermove',event=>{
 if(!frame)return;const rect=event.currentTarget.getBoundingClientRect();
 const x=Math.max(0,Math.min(40,Math.floor((event.clientX-rect.left)/rect.width*41))),y=Math.max(0,Math.min(25,Math.floor((event.clientY-rect.top)/rect.height*26)));
 const sample=gridSample(frame.grid,y*41+x);
 $('grid-sample').textContent=`Sample (${x}, ${y}): `+(sample.valid?`U ${sample.u.toFixed(3)}, V ${sample.v.toFixed(3)}, shade ${sample.shade.toFixed(3)}`:'invalid intersection or empty mapping.');
});
update();
