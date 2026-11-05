import {invoke} from '@tauri-apps/api/core';
import {useCallback,useEffect,useRef,useState} from 'react';
import './WhatsAppDesk.css';
type Msg={id:string;chatId:string;sender:string;phone:string;body:string;at:string;quantity:number|null;order:boolean;status?:string};
type Group={id:string;name:string};
type Status={status:string;qr:string;phone:string;lastError:string;groupId:string;groups:Group[]};
const api=<T,>(route:string,payload?:Record<string,unknown>)=>invoke<T>('whatsapp_bridge',{route,payload:payload??null});
function beep(){try{const c=new AudioContext(),o=c.createOscillator(),g=c.createGain();o.frequency.value=880;g.gain.value=.08;o.connect(g);g.connect(c.destination);o.start();o.stop(c.currentTime+.18);o.onended=()=>void c.close()}catch{}}
export default function WhatsAppDesk(){
 const [connection,setConnection]=useState<Status|null>(null);
 const [messages,setMessages]=useState<Msg[]>([]);
 const [orders,setOrders]=useState<Msg[]>([]);
 const [text,setText]=useState('');
 const [error,setError]=useState('');
 const [diagnostics,setDiagnostics]=useState('');
 const [sound,setSound]=useState(true);
 const [busy,setBusy]=useState(false);
 const known=useRef<Set<string>>(new Set());
 const loaded=useRef(false);
 const refresh=useCallback(async()=>{
  try{
   const status=await api<Status>('status');setConnection(status);setError('');
   if(status.status==='ready'&&status.groupId){
    const result=await api<{messages:Msg[];orders:Msg[]}>('messages');
    if(loaded.current&&sound&&result.orders.some(o=>o.status==='pending'&&!known.current.has(o.id)))beep();
    known.current=new Set(result.orders.map(o=>o.id));loaded.current=true;
    setMessages(result.messages);setOrders(result.orders);
   }else{setMessages([]);setOrders([]);loaded.current=false}
  }catch(e){setConnection(null);setError(String(e))}
 },[sound]);
 useEffect(()=>{void refresh();const timer=setInterval(()=>void refresh(),2500);return()=>clearInterval(timer)},[refresh]);
 async function action(route:string,payload:Record<string,unknown>){setBusy(true);try{await api(route,payload);setError('');await refresh()}catch(e){setError(String(e))}finally{setBusy(false)}}
 const pending=orders.filter(o=>o.status==='pending');
 const doing=orders.filter(o=>o.status==='doing');
 return <aside className="wa-desk" aria-label="Central WhatsApp">
  <div className="wa-title"><div><span className="eyebrow">CENTRAL DE MENSAGENS</span><h3>WhatsApp dos operadores</h3></div><span className="wa-preview">{connection?.status==='ready'?'CONECTADO':'DESCONECTADO'}</span></div>
  <div className="wa-columns">
   <section className="wa-panel wa-chat"><div className="wa-chat-head"><h4>{connection?.status==="ready"?(connection.groups.find(g=>g.id===connection.groupId)?.name||"Selecionar grupo"):"Conectar WhatsApp"}</h4><span className="wa-chat-status">{connection?.status==="ready"?"● Online":"● Offline"}</span></div>
  <div className={"wa-connect "+(connection?.status==="ready"?"wa-connected":"wa-disconnected")}>
   {connection?.status!=='ready'&&<p>Leia o QR Code com seu WhatsApp pessoal para conectar.</p>}
   {connection?.qr&&<div className="wa-qr"><img src={connection.qr} alt="QR Code de conexão do WhatsApp" width="220" height="220"/><p>No celular: Aparelhos conectados → Conectar aparelho</p></div>}
   {connection?.status==='ready'&&<div className="wa-group-picker"><label>Grupo das blogueiras<select value={connection.groupId||''} onChange={e=>void action('select',{groupId:e.target.value})} disabled={busy}><option value="">Selecione um grupo</option>{connection.groups.map(g=><option value={g.id} key={g.id}>{g.name}</option>)}</select></label><button className="btn ghost" onClick={()=>void action('groups',{})} disabled={busy}>Atualizar grupos</button></div>}
   {connection?.lastError&&<p role="alert">{connection.lastError}</p>}
   {error&&<p role="alert">{error}</p>}
   {!connection&&<div className="wa-recovery"><button className="btn primary" onClick={async()=>{try{await invoke('whatsapp_restart');setError('');setDiagnostics('');setTimeout(()=>void refresh(),1800)}catch(e){setError(String(e))}}}>Tentar reconectar</button><button className="btn ghost" onClick={async()=>{try{setDiagnostics(await invoke<string>('whatsapp_diagnostics'))}catch(e){setDiagnostics(String(e))}}}>Ver diagnóstico</button>{diagnostics&&<pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',fontSize:11,maxHeight:220,overflow:'auto'}}>{diagnostics}</pre>}</div>}
   {!connection&&<p>Aguardando o conector iniciar. Se o aviso persistir, reinstale a versão atualizada da PEAK Dashboard.</p>}
   <label className="wa-sound"><input type="checkbox" checked={sound} onChange={e=>setSound(e.target.checked)}/> Aviso sonoro de novos pedidos</label>
  </div>
    <div className="wa-messages"><h4>Mensagens do grupo</h4>{messages.length===0?<div className="wa-empty">Aguardando mensagens reais do grupo selecionado</div>:[...messages].reverse().map(m=><article className="wa-item" key={m.id}><b>{m.sender}</b><small>{m.phone} • {new Date(m.at).toLocaleString('pt-BR')}</small><p>{m.body}</p></article>)}
    </div>
    {connection?.status==='ready'&&connection.groupId&&<form onSubmit={e=>{e.preventDefault();if(!text.trim())return;void (async()=>{setBusy(true);try{await api('send',{text});setText('');setError('');await refresh()}catch(e){setError(String(e))}finally{setBusy(false)}})()}}><textarea value={text} onChange={e=>setText(e.target.value)} rows={3} maxLength={4000} placeholder="Responder no grupo usando seu número"/><button className="btn primary" disabled={busy||!text.trim()}>Enviar mensagem</button></form>}
   </section>
   <div className="wa-operations">
    <section className="wa-panel wa-pending"><h4>Pedidos pendentes <span>{pending.length}</span></h4>{pending.length===0?<div className="wa-empty">Nenhum pedido pendente</div>:pending.map(m=><article className="wa-item wa-order" key={m.id}><b>{m.sender}</b><small>{m.phone}</small><p>{m.body}</p><em>{m.quantity!==null?m.quantity+' contas':'Link identificado'}</em><button className="btn primary" disabled={busy} onClick={()=>void action('order',{id:m.id,status:'doing'})}>Iniciar serviço</button></article>)}</section>
    <section className="wa-panel wa-doing"><h4>Serviços sendo feitos <span>{doing.length}</span></h4>{doing.length===0?<div className="wa-empty">Nenhum serviço em andamento</div>:doing.map(m=><article className="wa-item" key={m.id}><b>{m.sender}</b><p>{m.body}</p><button className="btn primary" disabled={busy} onClick={()=>void action('order',{id:m.id,status:'done'})}>Concluir serviço</button></article>)}</section>
   </div>
  </div>
 </aside>;
}
