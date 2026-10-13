export function validCommand(event, host, origin) {
 const p=event.data;
 return event.source===host && event.origin===origin && p?.type==='domera.cad' && p.version===1 && typeof p.id==='string' && p.id.length<100 && ['load','export','saved'].includes(p.action) && (p.action!=='load' || (typeof p.name==='string' && /\.(dwg|dxf)$/i.test(p.name) && p.bytes instanceof ArrayBuffer && p.bytes.byteLength<=100*1024*1024));
}
if (typeof window !== 'undefined' && window.parent !== window) {
 const origin=new URL(document.baseURI).origin;
 window.__domeraCadCommands=[];
 window.__domeraCadReply=payload=>window.parent.postMessage({type:'domera.cad.reply',version:1,...payload},origin);
 window.addEventListener('message',event=>{
  if(!validCommand(event,window.parent,origin)) return;
  if(window.__domeraCadCommands.length>=8) {window.__domeraCadReply({id:event.data.id,ok:false,error:'Editor is busy'});return;}
  window.__domeraCadCommands.push({...event.data,bytes:event.data.bytes ? new Uint8Array(event.data.bytes) : undefined});
 });
}
