import {OpeningExperiment} from './opening-experiment.mjs';
let experiment,request,running=false;
async function bytes(url,gzip=false){
  const response=await fetch(url);if(!response.ok)throw new Error(`Cannot load ${url}: ${response.status}`);
  return new Uint8Array(await (gzip?new Response(response.body.pipeThrough(new DecompressionStream('gzip'))):response).arrayBuffer());
}
const ready=Promise.all([bytes('../data/start.bin'),bytes('../data/seek/graphics-0150.bin.gz',true),bytes('../data/seek/graphics-0300.bin.gz',true)])
  .then(([base,a,b])=>{experiment=new OpeningExperiment(base,[{seconds:15,bytes:a},{seconds:30,bytes:b}]);return true;})
  .catch(error=>{postMessage({error:error.message});return false;});
onmessage=event=>{request=event.data;pump();};
async function pump(){
  if(running)return;running=true;
  try{
    if(!await ready){request=null;return;}
    while(request){
      const current=request;
      if(!experiment.step(current.seconds)){await new Promise(resolve=>setTimeout(resolve,0));continue;}
      const result=experiment.render(current);
      if(request===current){postMessage({id:current.id,...result});request=null;}
      await new Promise(resolve=>setTimeout(resolve,0));
    }
  }catch(error){postMessage({error:error.message});request=null;}
  finally{running=false;}
}
