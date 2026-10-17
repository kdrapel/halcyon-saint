export function decodeS3M(memory) {
  const view=new DataView(memory.buffer,memory.byteOffset,memory.byteLength),base=view.getUint32(0x12e6,true);
  const word=offset=>view.getUint16(base+offset,true);
  if(String.fromCharCode(...memory.subarray(base+44,base+48))!=='SCRM')throw new Error('Invalid Saint soundtrack');
  const title=new TextDecoder().decode(memory.subarray(base,base+28)).replace(/\0.*$/,'').trim();
  const orders=Array.from(memory.subarray(base+96,base+96+word(32))),channels=[];
  for(let ch=0;ch<32;ch++)if(memory[base+64+ch]!==255)channels.push(ch);
  const pointers=96+word(32)+word(34)*2,patterns=[];
  for(let p=0;p<word(36);p++){
    let cursor=base+word(pointers+p*2)*16;
    const end=cursor+view.getUint16(cursor,true);cursor+=2;
    const rows=Array.from({length:64},()=>Array(32).fill(null));let row=0;
    while(row<64&&cursor<end){
      const command=memory[cursor++];if(!command){row++;continue;}
      const cell={note:null,instrument:0,volume:null,effect:0,parameter:0};
      if(command&32){cell.note=memory[cursor++];cell.instrument=memory[cursor++];}
      if(command&64)cell.volume=memory[cursor++];
      if(command&128){cell.effect=memory[cursor++];cell.parameter=memory[cursor++];}
      if(cursor>end)throw new Error('Truncated Saint pattern');
      rows[row][command&31]=cell;
    }
    patterns.push(rows);
  }
  return {title,orders,channels,patterns};
}
