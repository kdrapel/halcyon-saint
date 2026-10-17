// Explicit development DOS file bridge. No host filesystem or hardware access.
export function installArchiveDos(c,files,{hash}={}) {
  const handles=new Map(),operations=[];
  c.interrupt=number=>{
    c.inAdapter=true;
    try {
      if(number!==0x33||(c.r.eax&255)!==0x21)throw new Error('Unsupported interrupt');
      const ax=c.u16(0xdc),fn=ax>>>8,handle=c.u16(0xd0);
      if(fn===0x3d){
        const offset=c.u16(0xe4)*16+c.u16(0xd4)-0xb9c0;
        let name='';for(let i=0;i<256;i++){const byte=c.u8(offset+i);if(!byte)break;name+=String.fromCharCode(byte);}
        name=name.toUpperCase();
        if(ax!==0x3d02||!files.has(name)||handles.has(5))throw new Error('Uncontracted file open '+name);
        handles.set(5,{name,position:0});c.w16(0xdc,5);operations.push({operation:'open',name,handle:5});
      }else if(fn===0x42){
        const file=handles.get(handle);if(!file)throw new Error('Invalid handle');
        const delta=((c.u16(0xd8)<<16)|c.u16(0xd4))|0,origin=ax&255;
        if(origin>2)throw new Error('Invalid seek origin');
        const position=[0,file.position,files.get(file.name).length][origin]+delta;
        if(position<0||position>files.get(file.name).length)throw new Error('Seek outside file');
        file.position=position;c.w16(0xdc,position);c.w16(0xd4,position>>>16);
        operations.push({operation:'seek',handle,origin,delta,position});
      }else if(fn===0x3f){
        const file=handles.get(handle);if(!file)throw new Error('Invalid handle');
        const requested=c.u16(0xd8),offset=c.u16(0xe4)*16+c.u16(0xd4)-0xb9c0;
        const data=files.get(file.name).subarray(file.position,file.position+requested);
        c.check(offset,data.length);for(let i=0;i<data.length;i++)c.w8(offset+i,data[i]);
        file.position+=data.length;c.w16(0xdc,data.length);
        operations.push({operation:'read',handle,offset,requested,bytes:data.length,...(hash?{sha256:hash(data)}:{})});
      }else if(fn===0x3e){
        if(!handles.delete(handle))throw new Error('Invalid close handle');operations.push({operation:'close',handle});
      }else throw new Error('Uncontracted DOS function '+fn.toString(16));
      c.r.eflags=(c.r.eflags&~1)>>>0;
    }finally{c.inAdapter=false;}
  };
  return {operations,handles};
}
