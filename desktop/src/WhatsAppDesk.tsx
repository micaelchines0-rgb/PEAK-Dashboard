import {invoke} from '@tauri-apps/api/core';
import {useCallback,useEffect,useRef,useState} from 'react';
import './WhatsAppDesk.css';
type Msg={id:string;chatId:string;sender:string;phone:string;body:string;at:string;quantity:number|null;order:boolean;status?:string;fromMe?:boolean};
type Group={id:string;name:string};
type Status={status:string;qr:string;phone:string;lastError:string;groupId:string;groups:Group[]};
const api=<T,>(route:string,payload?:Record<string,unknown>)=>invoke<T>('whatsapp_bridge',{route,payload:payload??null});
const senderColors=['#8ed8ff','#ffbb91','#c7adff','#8ce2ba','#ffb6d5','#ffe08c'];
function senderColor(m:Msg){const key=m.phone||m.sender||m.id;let hash=0;for(let i=0;i<key.length;i++)hash=(hash*31+key.charCodeAt(i))|0;return senderColors[(hash>>>0)%senderColors.length]}
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
 const [server,setServer]=useState<{configured:boolean;host?:string;port?:number}|null>(null);
 const [serverHost,setServerHost]=useState('');
 const [serverPort,setServerPort]=useState('38741');
 const [serverToken,setServerToken]=useState('');
 const [showServer,setShowServer]=useState(false);
 const known=useRef<Set<string>>(new Set());
 const messagesEndRef=useRef<HTMLDivElement|null>(null);
 const loaded=useRef(false);
 const refreshing=useRef(false);
 const refresh=useCallback(async()=>{
  if(refreshing.current)return;
  refreshing.current=true;
  try{
   const status=await api<Status>('status');setConnection(status);setError('');
   if(status.status==='ready'&&status.groupId){
    const result=await api<{messages:Msg[];orders:Msg[]}>('messages');
    if(loaded.current&&sound&&result.orders.some(o=>o.status==='pending'&&!known.current.has(o.id)))beep();
    known.current=new Set(result.orders.map(o=>o.id));loaded.current=true;
    setMessages(result.messages);setOrders(result.orders);
   }else{setMessages([]);setOrders([]);loaded.current=false}
  }catch(e){setConnection(null);setError(String(e))}finally{refreshing.current=false}
 },[sound]);
 useEffect(()=>{void invoke<{configured:boolean;host?:string;port?:number}>('whatsapp_server_settings').then(setServer).catch(()=>{});},[]);
 useEffect(()=>{void refresh();const timer=setInterval(()=>{if(!document.hidden)void refresh()},5000);return()=>clearInterval(timer)},[refresh]);
 async function action(route:string,payload:Record<string,unknown>){setBusy(true);try{await api(route,payload);setError('');await refresh()}catch(e){setError(String(e))}finally{setBusy(false)}}
 useEffect(()=>{messagesEndRef.current?.scrollIntoView({block:'end',behavior:'auto'});},[messages]);
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
   <div className="wa-server-config">
    <button type="button" className="btn ghost" onClick={()=>setShowServer(v=>!v)}>{server?.configured?'Servidor PEAK: '+server.host+':'+server.port:'Configurar servidor PEAK'}</button>
    {showServer&&<div className="wa-server-form">
      <label>IP Tailscale do servidor<input value={serverHost} onChange={e=>setServerHost(e.target.value)} placeholder="100.x.y.z"/></label>
      <label>Porta do operador<input value={serverPort} onChange={e=>setServerPort(e.target.value)} placeholder="38741"/></label>
      <label>Chave individual<input type="password" value={serverToken} onChange={e=>setServerToken(e.target.value)} placeholder="Cole a chave do seu operador"/></label>
      <button className="btn primary" disabled={busy} onClick={async()=>{setBusy(true);try{await invoke('whatsapp_configure_server',{host:serverHost,port:Number(serverPort),token:serverToken});setServer({configured:true,host:serverHost,port:Number(serverPort)});setServerToken('');setShowServer(false);await refresh()}catch(e){setError(String(e))}finally{setBusy(false)}}}>Salvar conexão</button>
      {server?.configured&&<button className="btn ghost" onClick={async()=>{try{await invoke('whatsapp_remove_server');setServer({configured:false});setConnection(null)}catch(e){setError(String(e))}}}>Remover servidor</button>}
    </div>}
   </div>
   {connection?.lastError&&<p role="alert">{connection.lastError}</p>}
   {error&&<p role="alert">{error}</p>}
   {!connection&&!server?.configured&&<div className="wa-recovery"><button className="btn primary" onClick={async()=>{try{await invoke('whatsapp_restart');setError('');setDiagnostics('');setTimeout(()=>void refresh(),1800)}catch(e){setError(String(e))}}}>Tentar reconectar</button><button className="btn ghost" onClick={async()=>{try{setDiagnostics(await invoke<string>('whatsapp_diagnostics'))}catch(e){setDiagnostics(String(e))}}}>Ver diagnóstico</button>{diagnostics&&<pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',fontSize:11,maxHeight:220,overflow:'auto'}}>{diagnostics}</pre>}</div>}
   {!connection&&<p>{server?.configured?'Aguardando servidor PEAK. Verifique Tailscale e a porta do operador.':'Aguardando conector local ou configuração do servidor PEAK.'}</p>}
   <label className="wa-sound"><input type="checkbox" checked={sound} onChange={e=>setSound(e.target.checked)}/> Aviso sonoro de novos pedidos</label>
  </div>
    <div className="wa-messages"><h4>Mensagens do grupo</h4>{messages.length===0?<div className="wa-empty">Aguardando mensagens reais do grupo selecionado</div>:[...messages].sort((a,b)=>new Date(a.at).getTime()-new Date(b.at).getTime()).map(m=><article className={`wa-item wa-bubble ${m.fromMe?'wa-outgoing':'wa-incoming'}`} key={m.id} style={{'--wa-sender-color':senderColor(m)} as React.CSSProperties}><div className="wa-sender-line"><b>{m.fromMe?'Você':(m.sender||'Participante')}</b><span>{m.phone?'+'+m.phone.replace(/^\+/,''):'Número não disponível'}</span></div><p>{m.body}</p><small>{new Date(m.at).toLocaleString('pt-BR')}</small></article>)}
     <div ref={messagesEndRef} aria-hidden="true" />
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
