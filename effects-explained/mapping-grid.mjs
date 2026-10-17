const FIXED=65535;
export function gridSample(grid,index){
  const raw=Array.from(grid.subarray(index*3,index*3+3));
  const valid=!raw.includes(-2147483648)&&raw.some(n=>n!==0);
  return {valid,u:raw[0]/FIXED,v:raw[1]/FIXED,shade:raw[2]/FIXED};
}
function coordinateScale(values){
  values.sort((a,b)=>a-b);
  const at=f=>values[Math.floor((values.length-1)*f)]??0;
  const center=at(.5),spread=Math.max(at(.75)-at(.25),1);
  return n=>Math.round(255*(.5+Math.atan((n-center)/spread)/Math.PI));
}
// Diagnostic colours must not wrap at texture repeats or turn x87 indefinite
// integers into seemingly valid coordinates. The renderer's grid stays intact.
export function gridColours(grid){
  const samples=Array.from({length:grid.length/3},(_,i)=>gridSample(grid,i));
  const valid=samples.filter(s=>s.valid),red=coordinateScale(valid.map(s=>s.u)),green=coordinateScale(valid.map(s=>s.v));
  const rgba=new Uint8ClampedArray(samples.length*4);
  samples.forEach((sample,i)=>{
    rgba.set(sample.valid?[red(sample.u),green(sample.v),Math.round(Math.max(0,Math.min(1,sample.shade/63))*255),255]:[24,31,41,255],i*4);
  });
  return {rgba,valid:valid.length,invalid:samples.length-valid.length};
}
