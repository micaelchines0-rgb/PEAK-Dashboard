import {useEffect,useState} from 'react';
type Message={id:string;groupId:string;sender:string;text:string;timestamp:number;fromMe:boolean};
type Group={id:string;name:string};
const gateway=(import.meta.env.VITE_PEAK_WHATSAPP_GATEWAY_URL||'').replace(/\/$/,'');
export default function WhatsAppChat(){
 const [groups,setGroups]=useState<Group[]>([]),[group,setGroup]=useState(''),[messages,setMessages]=useState<Message[]>([]),[draft,setDraft]=useState(''),[status,setStatus]=useState('desconectado'),[qr,setQr]=useState(''),[error,setError]=useState('');
 const [sending,setSending]=useState(false);
 useEffect(()=>{if(!gateway)return;let live=true;const refresh=async()=>{try{const r=await fetch(gateway+'/status');if(!r.ok)throw Error('Servidor indisponível');const data=await r.json();if(live){setStatus(data.status||'desconectado');setQr(data.qr||'');setGroups(data.groups||[]);setError('')}}catch(e){if(live)setError(String(e))}};void refresh();const timer=setInterval(refresh,5000);return()=>{live=false;clearInterval(timer)}},[]);
 useEffect(()=>{if(!gateway||!group)return;let live=true;const refresh=async()=>{try{const r=await fetch(gateway+'/groups/'+encodeURIComponent(group)+'/messages');if(!r.ok)throw Error('Falha ao carregar mensagens');const data=await r.json();if(live)setMessages(data.messages||[])}catch(e){if(live)setError(String(e))}};void refresh();const timer=setInterval(refresh,3000);return()=>{live=false;clearInterval(timer)}},[group]);
 const send=async()=>{if(!draft.trim()||!group||sending)return;setSending(true);try{const r=await fetch(gateway+'/groups/'+encodeURIComponent(group)+'/messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:draft.trim()})});if(!r.ok)throw Error('Não foi possível enviar');setDraft('');setError('')}catch(e){setError(String(e))}finally{setSending(false)}};
 return <section className="card section" style={{padding:20,minHeight:440}}>
  <div className="section-head"><div><span className="eyebrow">CENTRAL DE ATENDIMENTO</span><h3>WhatsApp PEAK</h3></div><span>{status}</span></div>
  {!gateway?<p>Integração preparada. Configure VITE_PEAK_WHATSAPP_GATEWAY_URL para conectar o servidor privado da PEAK.</p>:null}
  {error?<p role="alert" style={{color:'#ff9292'}}>{error}</p>:null}
  {qr?<div style={{padding:12,background:'#fff',color:'#111',display:'inline-block'}}>Conecte o número PEAK pelo QR Code exibido no painel seguro do servidor. Nunca compartilhe a sessão.</div>:null}
  <div style={{display:'grid',gridTemplateColumns:'minmax(160px, 1fr) minmax(260px, 3fr)',gap:14,marginTop:12}}>
   <aside style={{display:'grid',alignContent:'start',gap:8}}>{groups.map(g=><button key={g.id} className={'btn '+(group===g.id?'primary':'ghost')} onClick={()=>setGroup(g.id)}>{g.name}</button>)}</aside>
   <div style={{display:'flex',flexDirection:'column',gap:10,minHeight:320}}>
    <div style={{flex:1,overflowY:'auto',maxHeight:390,display:'flex',flexDirection:'column',gap:8}}>{messages.map(m=><div key={m.id} style={{alignSelf:m.fromMe?'flex-end':'flex-start',maxWidth:'85%',background:m.fromMe?'#174b49':'#263956',padding:'9px 12px',borderRadius:10}}><small>{m.sender}</small><div style={{whiteSpace:'pre-wrap'}}>{m.text}</div><small>{new Date(m.timestamp).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</small></div>)}</div>
    <div style={{display:'flex',gap:8}}><input aria-label="Mensagem" style={{flex:1,minWidth:0}} placeholder="Digite a resposta ou comanda..." value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')void send()}} disabled={!group||status!=='conectado'}/><button className="btn primary" disabled={!group||status!=='conectado'||sending||!draft.trim()} onClick={()=>void send()}>Enviar</button></div>
   </div>
  </div>
 </section>
}
