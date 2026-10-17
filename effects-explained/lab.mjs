const canvas = document.querySelector('#lab');
const ctx = canvas.getContext('2d');
const form = document.querySelector('#controls');
const value = id => Number(document.getElementById(id).value);
let meshes = [];

function project([x,y,z]) {
  const scale = 400/z;
  return [320+x*scale, 200+y*scale];
}
function polygon(points, fill, wire) {
  const q = points.map(project);
  ctx.beginPath(); q.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y)); ctx.closePath();
  ctx.fillStyle=fill; ctx.fill();
  if(wire){ctx.strokeStyle='#b7dcecaa';ctx.lineWidth=.6;ctx.stroke();}
}
export function parseMesh(buffer) {
  const d=new DataView(buffer), tag=new TextDecoder().decode(new Uint8Array(buffer,0,4));
  if(tag!=='Obu!')throw new Error('Expected an Obu! mesh');
  const n=d.getUint16(4,true);let p=6;
  const vertices=Array.from({length:n},()=>{const v=[0,1,2].map(k=>d.getFloat32(p+k*4,true));p+=12;return v;});
  const uv=new TextDecoder().decode(new Uint8Array(buffer,p,4))==='Uuve';if(uv)p+=4+n*8;
  const count=d.getUint16(p,true);p+=2;
  const triangles=Array.from({length:count},()=>{const t=[0,1,2].map(k=>d.getUint16(p+k*2,true));p+=6;if(t.some(i=>i>=n))throw new Error('Invalid mesh index');return t;});
  return {vertices,triangles,uv};
}
function cave() {
  if(!meshes.length)return;
  const mesh=meshes[value('object')], yaw=value('yaw')*Math.PI/180, pitch=value('pitch')*Math.PI/180;
  const size=value('object')===0?90:8;
  const verts=mesh.vertices.map(v=>{
    const [x,y,z]=v.map(n=>n/size);
    const a=x*Math.cos(yaw)+z*Math.sin(yaw),b=z*Math.cos(yaw)-x*Math.sin(yaw);
    return [a,y*Math.cos(pitch)-b*Math.sin(pitch),y*Math.sin(pitch)+b*Math.cos(pitch)+value('distance')];
  });
  const faces=mesh.triangles.map(t=>t.map(i=>verts[i])).filter(t=>t.every(v=>v[2]>.15));
  faces.sort((a,b)=>b.reduce((s,v)=>s+v[2],0)-a.reduce((s,v)=>s+v[2],0));
  for(const t of faces){
    const a=t[1].map((v,i)=>v-t[0][i]),b=t[2].map((v,i)=>v-t[0][i]);
    const n=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
    const light=Math.abs(n[2])/(Math.hypot(...n)||1);
    polygon(t,`hsl(${value('object')===0?225:40} 45% ${20+light*45}%)`,document.querySelector('#wire').checked);
  }
  document.querySelector('#observation').textContent=`${mesh.vertices.length} vertices · ${mesh.triangles.length} triangles · ${mesh.uv?'UV coordinates present':'no UV coordinates'}. Rotate to inspect depth; move closer to see perspective change.`;
}
function draw(){ctx.fillStyle='#070b14';ctx.fillRect(0,0,640,400);cave();
  form.querySelectorAll('input[type=range]').forEach(input=>{document.querySelector(`[for="${input.id}"] output`).textContent=Number(input.value).toFixed(input.step==='1'?0:2);});
}
form.addEventListener('input',draw);
document.querySelector('#reset').addEventListener('click',()=>{form.reset();draw();});
Promise.all(['PALLOAK2.ER','AURI.ER'].map(async name=>{const r=await fetch('../data/assets/'+name);if(!r.ok)throw new Error(name+' could not load');return parseMesh(await r.arrayBuffer());})).then(data=>{meshes=data;draw();}).catch(e=>{document.querySelector('#observation').textContent='Mesh unavailable: '+e.message+'. Serve this page using Start.cmd.';});
draw();
