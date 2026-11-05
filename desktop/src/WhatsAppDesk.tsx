import {invoke} from '@tauri-apps/api/core';
import {useCallback,useEffect,useRef,useState} from 'react';
import './WhatsAppDesk.css';
type EditOrder={group:'dragao'|'pinguim';body:string;rows:{tier:string;quantity:number;unit:number|null}[]};
type Msg={id:string;chatId:string;sender:string;phone:string;body:string;at:string;quantity:number|null;order:boolean;status?:string;priceRepliedAt?:string;edit?:EditOrder;receiptId?:string;receiptAt?:string;priceDetails?:{total:number};fromMe?:boolean};
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
 const [replyTo,setReplyTo]=useState<Msg|null>(null);
 const [error,setError]=useState('');
 const [diagnostics,setDiagnostics]=useState('');
 const [sound,setSound]=useState(true);
 const [busy,setBusy]=useState(false);
 const [dismissedReceipts,setDismissedReceipts]=useState<string[]>([]);
 const [editingId,setEditingId]=useState<string|null>(null);
 const [editDraft,setEditDraft]=useState<EditOrder|null>(null);
 const [orderGroups,setOrderGroups]=useState<Record<string,'dragao'|'pinguim'>>({});
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
 const waiting=orders.filter(o=>o.status==='awaiting_payment');
 const receiptAlert=waiting.find(o=>o.receiptId&&!dismissedReceipts.includes(o.receiptId));
 return <aside className="wa-desk" aria-label="Central WhatsApp">
  {receiptAlert&&<div className="wa-receipt-overlay" role="dialog" aria-modal="true" aria-label="Comprovante recebido"><div className="wa-receipt-modal"><h2>Comprovante recebido</h2><p><b>{receiptAlert.sender}</b> · {receiptAlert.phone}</p><p>Pedido: {receiptAlert.body}</p><p>Valor da comanda: {receiptAlert.priceDetails?.total?.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})||'Não disponível'}</p><p className="wa-receipt-warning">Imagem ou documento recebido. Confira o comprovante e a entrada do pagamento antes de confirmar.</p><div className="wa-receipt-actions"><button type="button" disabled={busy} onClick={()=>void action('confirm-payment',{id:receiptAlert.id})}>Confirmar pagamento</button><button type="button" onClick={()=>setDismissedReceipts(v=>[...v,receiptAlert.receiptId!])}>Verificar depois</button></div></div></div>}
  
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
    <div className="wa-messages"><h4>Mensagens do grupo</h4>{messages.length===0?<div className="wa-empty">Aguardando mensagens reais do grupo selecionado</div>:[...messages].sort((a,b)=>new Date(a.at).getTime()-new Date(b.at).getTime()).map(m=><div className={`wa-message-row ${m.fromMe?'wa-message-row-outgoing':''}`} key={m.id}><article className={`wa-item wa-bubble ${m.fromMe?'wa-outgoing':'wa-incoming'}`} key={m.id} style={{'--wa-sender-color':senderColor(m)} as React.CSSProperties}><div className="wa-sender-line"><b>{m.fromMe?'Você':(m.sender||'Participante')}</b><span>{m.phone?'+'+m.phone.replace(/^\+/,''):'Número não disponível'}</span></div><p>{m.body}</p><small>{new Date(m.at).toLocaleString('pt-BR')}</small></article><button type="button" className="wa-reply-arrow" aria-label={`Responder à mensagem de ${m.sender}`} title="Responder esta mensagem" onClick={()=>setReplyTo(m)}>↩</button></div>)}
     <div ref={messagesEndRef} aria-hidden="true" />
    </div>
    {replyTo&&<div className="wa-reply-preview"><span><b>Respondendo a {replyTo.fromMe?'Você':replyTo.sender}</b><small>{replyTo.body.slice(0,110)}</small></span><button type="button" aria-label="Cancelar resposta" onClick={()=>setReplyTo(null)}>×</button></div>}
    {connection?.status==='ready'&&connection.groupId&&<form onSubmit={e=>{e.preventDefault();if(!text.trim())return;void (async()=>{setBusy(true);try{await api('send',{text,...(replyTo?{replyId:replyTo.id}:{})});setText('');setReplyTo(null);setError('');await refresh()}catch(e){setError(String(e))}finally{setBusy(false)}})()}}><textarea value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();if(!busy&&text.trim())e.currentTarget.form?.requestSubmit()}}} rows={2} maxLength={4000} placeholder="Responder no grupo • Enter envia • Shift+Enter quebra linha"/><button className="btn primary" disabled={busy||!text.trim()}>Enviar mensagem</button></form>}
   </section>
   <div className="wa-operations">
    <section className="wa-panel wa-pending"><h4>Pedidos pendentes <span>{pending.length}</span></h4>{pending.length===0?<div className="wa-empty">Nenhum pedido pendente</div>:pending.map((m,i)=>{const link=m.body.match(/https?:\/\/[^\s]+/i)?.[0];return <article className="wa-item wa-order wa-order-card" key={m.id}>
     <div className="wa-order-top"><span className="wa-order-index">{i+1}/{pending.length}</span><time>{new Date(m.at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</time><b style={{color:senderColor(m)}}>{m.sender||'Participante'}</b><span className="wa-order-phone">{m.phone?'+'+m.phone.replace(/^\+/,''):'Número indisponível'}</span></div>
     <div className="wa-order-body">{link?<><a href={link} target="_blank" rel="noopener noreferrer">{link}</a>{m.body.replace(link,'').trim()&&<p>{m.body.replace(link,'').trim()}</p>}</>:<p>{m.body}</p>}</div>
     <div className="wa-order-quantity">{m.quantity!==null?m.quantity+' contas':'Link identificado'}</div>
     {editingId===m.id&&editDraft&&<div className="wa-order-editor">
      <label>Grupo<select value={editDraft.group} onChange={e=>setEditDraft(v=>v?{...v,group:e.target.value as 'dragao'|'pinguim'}:v)}><option value="dragao">Dragão</option><option value="pinguim">Pinguim</option></select></label>
      <label>Pedido / link<textarea value={editDraft.body} onChange={e=>setEditDraft(v=>v?{...v,body:e.target.value}:v)} rows={2}/></label>
      <div className="wa-edit-rows">{editDraft.rows.map((row,i)=><div key={row.tier}><span>Depósito {row.tier}</span><input aria-label={'Quantidade '+row.tier} type="number" min="0" value={row.quantity} onChange={e=>setEditDraft(v=>v?{...v,rows:v.rows.map((x,j)=>j===i?{...x,quantity:Number(e.target.value)}:x)}:v)}/><input aria-label={'Preço unitário '+row.tier} type="number" min="0" step="0.01" placeholder="R$/conta" value={row.unit??''} onChange={e=>setEditDraft(v=>v?{...v,rows:v.rows.map((x,j)=>j===i?{...x,unit:e.target.value===''?null:Number(e.target.value)}:x)}:v)}/></div>)}</div>
      <div className="wa-edit-buttons"><button type="button" disabled={busy} onClick={()=>void (async()=>{try{setBusy(true);await api('edit-order',{id:m.id,edit:editDraft});setError('');setEditingId(null);setEditDraft(null);setOrderGroups(v=>({...v,[m.id]:editDraft.group}));await refresh()}catch(e){setError(String(e))}finally{setBusy(false)}})()}>Salvar alterações</button><button type="button" onClick={()=>{setEditingId(null);setEditDraft(null)}}>Cancelar</button></div>
     </div>}
     <div className="wa-order-actions">
      <div className="wa-order-action-left">
       <div className="wa-order-choice"><button type="button" className={orderGroups[m.id]==='dragao'?'selected':''} onClick={()=>setOrderGroups(v=>({...v,[m.id]:'dragao'}))}>Dragão</button><button type="button" className={orderGroups[m.id]==='pinguim'?'selected':''} onClick={()=>setOrderGroups(v=>({...v,[m.id]:'pinguim'}))}>Pinguim</button></div>
       <button type="button" className="wa-order-icon-btn" title="Editar pedido" aria-label="Editar" onClick={()=>{setEditingId(m.id);setEditDraft(m.edit?structuredClone(m.edit):{group:orderGroups[m.id]||'pinguim',body:m.body,rows:['10','11-15','15-18','19-25'].map((tier,i)=>({tier,quantity:0,unit:null}))})}}>✎</button>
       <button type="button" title="Não fazemos — funcionalidade a definir" disabled>⊘ Não fazemos</button>
       <button type="button" title="Pôr em serviço — funcionalidade a definir" disabled>▷ Pôr em serviço</button>
       <button type="button" title="Criar Registro — funcionalidade a definir" disabled>⊞ Criar Registro</button>
       <button type="button" className="wa-order-icon-btn" title="Registro visual — funcionalidade a definir" aria-label="Registro visual" disabled>▣</button>
      </div>
      <button type="button" className="wa-order-reply-price" disabled={busy||Boolean(m.priceRepliedAt)} onClick={()=>void action('quote-price',{id:m.id,...(orderGroups[m.id]?{group:orderGroups[m.id]}:{})})}>{m.priceRepliedAt?"Preço enviado":"Responder preço"}</button>
     </div>
    </article>})}</section>
    <section className="wa-panel wa-awaiting"><h4>Aguardando pagamento <span>{waiting.length}</span></h4>{waiting.length===0?<div className="wa-empty">Nenhuma comanda aguardando comprovante</div>:waiting.map(m=><article className="wa-item" key={m.id}><b>{m.sender}</b><small>{m.phone}</small><p>{m.body}</p><em>{m.receiptId?'Comprovante recebido — conferir pagamento':'Aguardando comprovante'}</em>{m.receiptId&&<button type="button" className="btn primary" disabled={busy} onClick={()=>void action('confirm-payment',{id:m.id})}>Confirmar pagamento</button>}</article>)}</section>
    <section className="wa-panel wa-doing"><h4>Serviços sendo feitos <span>{doing.length}</span></h4>{doing.length===0?<div className="wa-empty">Nenhum serviço em andamento</div>:doing.map(m=><article className="wa-item" key={m.id}><b>{m.sender}</b><p>{m.body}</p><button className="btn primary" disabled={busy} onClick={()=>void action('order',{id:m.id,status:'done'})}>Concluir serviço</button></article>)}</section>
   </div>
  </div>
 </aside>;
}
