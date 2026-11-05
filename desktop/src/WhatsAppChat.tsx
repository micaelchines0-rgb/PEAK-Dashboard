import {useEffect,useState} from 'react';
type Message={id:string;groupId:string;sender:string;phone?:string;text:string;timestamp:number;fromMe:boolean};
type Group={id:string;name:string};
const gateway=(import.meta.env.VITE_PEAK_WHATSAPP_GATEWAY_URL||'').replace(/\/$/,'');
export default function WhatsAppChat(){
 const [groups,setGroups]=useState<Group[]>([]),[group,setGroup]=useState(''),[messages,setMessages]=useState<Message[]>([]),[draft,setDraft]=useState(''),[status,setStatus]=useState('desconectado'),[qr,setQr]=useState(''),[error,setError]=useState('');
 const openedAt=useState(()=>Date.now())[0];
 const [sending,setSending]=useState(false);
 useEffect(()=>{if(!group&&groups.length)setGroup(groups[0].id)},[groups,group]);
 useEffect(()=>{if(!gateway)return;let live=true;const refresh=async()=>{try{const r=await fetch(gateway+'/status');if(!r.ok)throw Error('Servidor indisponível');const data=await r.json();if(live){setStatus(data.status||'desconectado');setQr(data.qr||'');setGroups(data.groups||[]);setError('')}}catch(e){if(live)setError(String(e))}};void refresh();const timer=setInterval(refresh,5000);return()=>{live=false;clearInterval(timer)}},[]);
 useEffect(()=>{if(!gateway||!group)return;let live=true;const refresh=async()=>{try{const r=await fetch(gateway+'/groups/'+encodeURIComponent(group)+'/messages');if(!r.ok)throw Error('Falha ao carregar mensagens');const data=await r.json();if(live)setMessages((data.messages||[]).filter((m:Message)=>m.timestamp>=openedAt))}catch(e){if(live)setError(String(e))}};void refresh();const timer=setInterval(refresh,3000);return()=>{live=false;clearInterval(timer)}},[group]);
 const send=async()=>{if(!draft.trim()||!group||sending)return;setSending(true);try{const r=await fetch(gateway+'/groups/'+encodeURIComponent(group)+'/messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:draft.trim()})});if(!r.ok)throw Error('Não foi possível enviar');setDraft('');setError('')}catch(e){setError(String(e))}finally{setSending(false)}};
 return <section className="card section" style={{padding:12,minHeight:330,display:'flex',flexDirection:'column',gap:8}}>
 <div className="section-head"><div><span className="eyebrow">GRUPO WHATSAPP</span><h3 style={{fontSize:16}}>Mensagens recebidas</h3></div><small>{status}</small></div>
 {!gateway?<small>Servidor WhatsApp ainda não configurado.</small>:null}
 {error?<small role="alert" style={{color:'#ff9292'}}>{error}</small>:null}
 {groups.length>1?<select aria-label="Grupo WhatsApp" value={group} onChange={e=>setGroup(e.target.value)}>{groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select>:<small>{groups.find(g=>g.id===group)?.name||'Aguardando grupo conectado'}</small>}
 <div style={{flex:1,minHeight:200,maxHeight:330,overflowY:'auto',display:'flex',flexDirection:'column',gap:8}}>
 {messages.length===0?<small style={{opacity:.7}}>As novas mensagens aparecerão aqui enquanto a Dashboard estiver aberta.</small>:null}
 {messages.map(m=><div key={m.id} style={{alignSelf:m.fromMe?'flex-end':'stretch',background:m.fromMe?'#174b49':'#263956',padding:'9px 10px',borderRadius:9}}>
 <div style={{fontWeight:700,fontSize:12}}>{m.sender||'Participante'}</div><div style={{fontSize:11,opacity:.8}}>{m.phone||'Número não informado'}</div>
 <div style={{whiteSpace:'pre-wrap',fontSize:13,marginTop:5}}>{m.text}</div><small style={{opacity:.7}}>{new Date(m.timestamp).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</small>
 </div>)}</div>
 <div style={{display:'flex',gap:6}}><input aria-label="Resposta WhatsApp" style={{flex:1,minWidth:0}} placeholder="Responder ao grupo..." value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')void send()}} disabled={!group||status!=='conectado'}/><button className="btn primary" disabled={!group||status!=='conectado'||sending||!draft.trim()} onClick={()=>void send()}>Enviar</button></div>
 </section>
}
