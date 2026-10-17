const notes=['C-','C#','D-','D#','E-','F-','F#','G-','G#','A-','A#','B-'];
const hex=n=>n.toString(16).toUpperCase().padStart(2,'0');
function note(value){if(value===null||value===undefined||value===255)return '...';if(value===254)return 'OFF';return (notes[value&15]??'??')+(value>>>4);}
export class ModuleTrackerView {
  constructor(canvas,title){this.canvas=canvas;this.context=canvas.getContext('2d');this.title=title;this.last='';}
  setModule(module){this.module=module;this.last='';this.title.textContent=`${module.title} · S3M · ${module.channels.length} channels`;}
  clear(){this.last='';}
  draw(marker){
    if(!this.module)return;
    let order=Math.max(0,(marker?.order??1)-1),row=marker?.row??0;
    if(row===0&&order>0){order--;row=63;}else row=Math.max(0,row-1);
    const key=`${order}:${row}`;if(this.last===key)return;this.last=key;
    const module=this.module,patternId=module.orders[order],pattern=module.patterns[patternId];
    const c=this.context,w=this.canvas.width,h=this.canvas.height,left=30,column=(w-left)/module.channels.length,line=17,center=105;
    c.fillStyle='#110d22';c.fillRect(0,0,w,h);c.font='11px monospace';c.textBaseline='middle';
    for(let i=0;i<module.channels.length;i++){c.fillStyle='#ad98cb';c.fillText('CH '+hex(module.channels[i]+1),left+i*column+5,11);c.fillStyle='#b299d830';c.fillRect(left+i*column,23,1,h-23);}
    c.fillStyle='#ed986728';c.fillRect(0,center-8,w,line);
    for(let delta=-4;delta<=5;delta++){
      const index=row+delta;if(index<0||index>=64)continue;const y=center+delta*line;
      c.fillStyle=delta===0?'#ffad78':'#9889ac';c.fillText(hex(index),4,y);
      for(let i=0;i<module.channels.length;i++){
        const cell=pattern?.[index]?.[module.channels[i]],instrument=cell?.instrument?hex(cell.instrument):'..';
        const volume=cell?.volume===null||cell?.volume===undefined?'..':hex(cell.volume);
        const effect=cell?.effect?String.fromCharCode(64+cell.effect)+hex(cell.parameter):'...';
        c.fillStyle=delta===0?'#f2e6ee':cell?.note!==null&&cell?.note!==undefined?'#c8b7df':'#756786';
        c.fillText(`${note(cell?.note)} ${instrument} ${volume} ${effect}`,left+i*column+5,y);
      }
    }
    this.title.textContent=`${module.title} · S3M · ${module.channels.length} channels · order ${hex(order)} · pattern ${hex(patternId??0)} · row ${hex(row)}`;
  }
}
