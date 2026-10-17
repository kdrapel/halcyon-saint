let indexPromise;const cache=new Map();
export function loadSeekIndex(){return indexPromise??=fetch(new URL('../data/seek/index.json',import.meta.url)).then(response=>{if(!response.ok)throw new Error('Could not load seek points');return response.json();});}
export async function loadSeekPoint(kind,seconds){
  const index=await loadSeekIndex(),entry=index[kind].findLast(point=>point.seconds<=seconds);
  if(!entry)return null;
  if(!cache.has(entry.file)){
    cache.set(entry.file,(async()=>{
      const response=await fetch(new URL('../data/seek/'+entry.file,import.meta.url));
      if(!response.ok)throw new Error('Could not load seek point');
      const bytes=new Uint8Array(await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
      const digest=await crypto.subtle.digest('SHA-256',bytes),hex=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
      if(hex!==entry.sha256)throw new Error('Seek point integrity check failed');
      return bytes;
    })().catch(error=>{cache.delete(entry.file);throw error;}));
    if(cache.size>3)cache.delete(cache.keys().next().value);
  }
  return {entry,bytes:await cache.get(entry.file)};
}
