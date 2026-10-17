// Generated original visual tick. No opcode decoder.
const codeSpans=[[228949, 228955], [228955, 228962], [228962, 228968], [228968, 228973], [228973, 228979], [228979, 228984], [228984, 228986], [228986, 228987], [228987, 228988], [228988, 228993], [228993, 228995], [228995, 228996], [228996, 228998], [228998, 229000], [229000, 229002], [229002, 229008], [229008, 229014], [229014, 229020], [229020, 229022], [229022, 229025], [229025, 229028], [229028, 229030], [229030, 229032], [229032, 229035], [229035, 229038], [229038, 229040], [229040, 229041], [229041, 229042], [229042, 229044], [229044, 229051], [229051, 229061], [229061, 229063], [229063, 229073], [229073, 229080], [229080, 229083], [229083, 229086], [229086, 229088], [229088, 229098], [229098, 229105], [229105, 229108], [229108, 229111], [229111, 229113], [229113, 229123], [229123, 229133], [229133, 229143], [229143, 229150], [229150, 229160], [229160, 229170], [229170, 229171]];
export function executeCreditsTick(c,{output,blockLimit=100000}={}){
if(typeof output!=="function")throw new Error("Explicit DAC output sink required");
c.setCodeContract(codeSpans,[]);let pc=228949,a,b;c.instructions=0;c.blocks=0;
while(c.blocks++<blockLimit){c.r.eip=pc;if(pc===229171)return c;switch(pc){
case 228949:{c.instructions++;c.current=228949;c.w32(((224016)>>>0),c.add(c.u32(((224016)>>>0)),1,32,true));pc=228955;break;}
case 228955:{c.instructions++;c.current=228955;c.sub(c.u8(((16849)>>>0)),1,8);pc=228962;break;}
case 228962:{c.instructions++;c.current=228962;pc=((c.r.eflags&64)!==0)?229170:228968;break;}
case 228968:{c.instructions++;c.current=228968;c.r.edi=(1023)>>>0;pc=228973;break;}
case 228973:{c.instructions++;c.current=228973;c.r.ebp=(c.u32(((224008)>>>0)))>>>0;pc=228979;break;}
case 228979:{c.instructions++;c.current=228979;c.r.edx=(968)>>>0;pc=228984;break;}
case 228984:{c.instructions++;c.current=228984;c.r.eax=(c.logic((c.r.eax)^(c.r.eax),32))>>>0;pc=228986;break;}
case 228986:{c.instructions++;c.current=228986;a=((c.r.edx >>> 0) & 65535);b=((c.r.eax >>> 0) & 255);if((a!==968&&a!==969)||1!==1)throw new Error("Unsupported output");output(a,1,b);pc=228987;break;}
case 228987:{c.instructions++;c.current=228987;c.r.edx=(c.add(c.r.edx,1,32,true))>>>0;pc=228988;break;}
case 228988:{c.instructions++;c.current=228988;c.r.esi=(4294966528)>>>0;pc=228993;break;}
case 228993:{c.instructions++;c.current=228993;a=c.r.ebx;b=c.r.ebx;c.r.ebx=(b)>>>0;c.r.ebx=(a)>>>0;pc=228995;break;}
case 228995:{c.instructions++;c.current=228995;pc=228996;break;}
case 228996:{c.instructions++;c.current=228996;c.r.eax=(c.logic((c.r.eax)^(c.r.eax),32))>>>0;pc=228998;break;}
case 228998:{c.instructions++;c.current=228998;c.r.ebx=(c.logic((c.r.ebx)^(c.r.ebx),32))>>>0;pc=229000;break;}
case 229000:{c.instructions++;c.current=229000;c.r.ecx=(c.logic((c.r.ecx)^(c.r.ecx),32))>>>0;pc=229002;break;}
case 229002:{c.instructions++;c.current=229002;c.r.eax=((c.r.eax&4294967040)|(((c.u8(((221668+c.r.esi)>>>0)))&255)<<0))>>>0;pc=229008;break;}
case 229008:{c.instructions++;c.current=229008;c.r.ebx=((c.r.ebx&4294967040)|(((c.u8(((222436+c.r.esi)>>>0)))&255)<<0))>>>0;pc=229014;break;}
case 229014:{c.instructions++;c.current=229014;c.r.ecx=((c.r.ecx&4294967040)|(((c.u8(((223204+c.r.esi)>>>0)))&255)<<0))>>>0;pc=229020;break;}
case 229020:{c.instructions++;c.current=229020;c.r.eax=(c.sub(c.r.eax,c.r.ebx,32))>>>0;pc=229022;break;}
case 229022:{c.instructions++;c.current=229022;c.r.eax=(c.imul(c.r.eax,c.r.edi))>>>0;pc=229025;break;}
case 229025:{c.instructions++;c.current=229025;c.r.eax=(c.shift(c.r.eax,10,32,"sar"))>>>0;pc=229028;break;}
case 229028:{c.instructions++;c.current=229028;c.r.eax=(c.add(c.r.eax,c.r.ebx,32))>>>0;pc=229030;break;}
case 229030:{c.instructions++;c.current=229030;c.r.eax=(c.sub(c.r.eax,c.r.ecx,32))>>>0;pc=229032;break;}
case 229032:{c.instructions++;c.current=229032;c.r.eax=(c.imul(c.r.eax,c.r.ebp))>>>0;pc=229035;break;}
case 229035:{c.instructions++;c.current=229035;c.r.eax=(c.shift(c.r.eax,10,32,"sar"))>>>0;pc=229038;break;}
case 229038:{c.instructions++;c.current=229038;c.r.eax=(c.add(c.r.eax,c.r.ecx,32))>>>0;pc=229040;break;}
case 229040:{c.instructions++;c.current=229040;a=((c.r.edx >>> 0) & 65535);b=((c.r.eax >>> 0) & 255);if((a!==968&&a!==969)||1!==1)throw new Error("Unsupported output");output(a,1,b);pc=229041;break;}
case 229041:{c.instructions++;c.current=229041;c.r.esi=(c.add(c.r.esi,1,32,true))>>>0;pc=229042;break;}
case 229042:{c.instructions++;c.current=229042;pc=((c.r.eflags&64)===0)?228996:229044;break;}
case 229044:{c.instructions++;c.current=229044;c.w32(((224008)>>>0),c.add(c.u32(((224008)>>>0)),35,32));pc=229051;break;}
case 229051:{c.instructions++;c.current=229051;c.sub(c.u32(((224008)>>>0)),1023,32);pc=229061;break;}
case 229061:{c.instructions++;c.current=229061;pc=(((c.r.eflags>>>7)&1)!==((c.r.eflags>>>11)&1))?229073:229063;break;}
case 229063:{c.instructions++;c.current=229063;c.w32(((224008)>>>0),1023);pc=229073;break;}
case 229073:{c.instructions++;c.current=229073;c.r.eax=(c.u16(((4810)>>>0)))>>>0;pc=229080;break;}
case 229080:{c.instructions++;c.current=229080;c.r.eax=(c.logic((c.r.eax)&(31),32))>>>0;pc=229083;break;}
case 229083:{c.instructions++;c.current=229083;c.sub(c.r.eax,16,32);pc=229086;break;}
case 229086:{c.instructions++;c.current=229086;pc=((c.r.eflags&64)===0)?229098:229088;break;}
case 229088:{c.instructions++;c.current=229088;c.w32(((224008)>>>0),0);pc=229098;break;}
case 229098:{c.instructions++;c.current=229098;c.r.eax=(c.u16(((4810)>>>0)))>>>0;pc=229105;break;}
case 229105:{c.instructions++;c.current=229105;c.r.eax=(c.logic((c.r.eax)&(31),32))>>>0;pc=229108;break;}
case 229108:{c.instructions++;c.current=229108;c.sub(c.r.eax,24,32);pc=229111;break;}
case 229111:{c.instructions++;c.current=229111;pc=((c.r.eflags&64)===0)?229123:229113;break;}
case 229113:{c.instructions++;c.current=229113;c.w32(((224008)>>>0),0);pc=229123;break;}
case 229123:{c.instructions++;c.current=229123;c.w32(((224636)>>>0),c.add(c.u32(((224636)>>>0)),620,32));pc=229133;break;}
case 229133:{c.instructions++;c.current=229133;c.w32(((224640)>>>0),c.add(c.u32(((224640)>>>0)),1120,32));pc=229143;break;}
case 229143:{c.instructions++;c.current=229143;c.w32(((224644)>>>0),c.add(c.u32(((224644)>>>0)),111,32));pc=229150;break;}
case 229150:{c.instructions++;c.current=229150;c.w32(((224648)>>>0),c.add(c.u32(((224648)>>>0)),742,32));pc=229160;break;}
case 229160:{c.instructions++;c.current=229160;c.w32(((224652)>>>0),c.add(c.u32(((224652)>>>0)),421,32));pc=229170;break;}
case 229170:{c.instructions++;c.current=229170;if((c.f.cw&63)!==63)throw new Error("Unmasked FWAIT unsupported");pc=229171;break;}
default:throw new Error("Unknown tick block "+pc.toString(16));
}}throw new Error("Tick limit");}
