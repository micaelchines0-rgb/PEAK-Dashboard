import {useEffect,useRef,useState} from 'react';
type Message={id:string;groupId:string;sender:string;phone?:string;text:string;timestamp:number;fromMe:boolean};
type Group={id:string;name:string};
const gateway=(import.meta.env.VITE_PEAK_WHATSAPP_GATEWAY_URL||'').replace(/\/$/,'');
const isOrder=(text:string)=>/https?:\\/\\/[^\\s]+/i.test(text)||/\\b(?:\\d+\\s*(?:contas?|cts?)|contas?\\s*(?:de\\s*)?\\d+)\\b/i.test(text);
const timeMs=(timestamp:number)=>timestamp<1e12?timestamp*1000:timestamp;
const notifyOrder=()=>{try{const Context=window.AudioContext;const ctx=new Context();const tone=(at:number,hz:number)=>{const osc=ctx.createOscillator();const gain=ctx.createGain();osc.type='sine';osc.frequency.value=hz;gain.gain.setValueAtTime(0.0001,at);gain.gain.exponentialRampToValueAtTime(0.17,at+0.015);gain.gain.exponentialRampToValueAtTime(0.0001,at+0.18);osc.connect(gain);gain.connect(ctx.destination);osc.start(at);osc.stop(at+0.19)};tone(ctx.currentTime,740);tone(ctx.currentTime+0.21,980);setTimeout(()=>void ctx.close(),650)}catch{/* Audio can be unavailable before user interaction. */}};
export default function WhatsAppChat({operatorId}:{operatorId:string}){
 const [groups,setGroups]=useState<Group[]>([]),[group,setGroup]=useState(''),[messages,setMessages]=useState<Message[]>([]),[draft,setDraft]=useState(''),[status,setStatus]=useState('desconectado'),[qr,setQr]=useState(''),[error,setError]=useState('');
 const openedAt=useState(()=>Date.now())[0];
 const seen=useRef(new Set<string>());
 const initialized=useRef(false);
 const [newOrders,setNewOrders]=useState(0);
 const [connecting,setConnecting]=useState(false);
 const session= gateway+'/operators/'+encodeURIComponent(operatorId);
 const connect=async()=>{setConnecting(true);setError('');try{const r=await fetch(session+'/connect',{method:'POST'});if(!r.ok)throw Error('Não foi possível iniciar a conexão');const data=await r.json();setQr(data.qr||'');setStatus(data.status||'aguardando QR Code')}catch(e){setError(String(e))}finally{setConnecting(false)}};
 const [sending,setSending]=useState(false);
 useEffect(()=>{if(!group&&groups.length)setGroup(groups[0].id)},[groups,group]);
 useEffect(()=>{if(!gateway||!operatorId)return;let live=true;const refresh=async()=>{try{const r=await fetch(session+'/status');if(!r.ok)throw Error('Servidor indisponível');const data=await r.json();if(live){setStatus(data.status||'desconectado');setQr(data.qr||'');setGroups(data.groups||[]);setError('')}}catch(e){if(live)setError(String(e))}};void refresh();const timer=setInterval(refresh,5000);return()=>{live=false;clearInterval(timer)}},[operatorId]);
 useEffect(()=>{seen.current.clear();initialized.current=false;setNewOrders(0);if(!gateway||!group||!operatorId)return;let live=true;const refresh=async()=>{try{const r=await fetch(session+'/groups/'+encodeURIComponent(group)+'/messages');if(!r.ok)throw Error('Falha ao carregar mensagens');const data=await r.json();if(live){const incoming:Message[]=(data.messages||[]).filter((m:Message)=>timeMs(m.timestamp)>=openedAt);const fresh=incoming.filter(m=>!seen.current.has(m.id)&&!m.fromMe&&isOrder(m.text));incoming.forEach(m=>seen.current.add(m.id));if(initialized.current&&fresh.length){setNewOrders(n=>n+fresh.length);notifyOrder()}initialized.current=true;setMessages(incoming)}}catch(e){if(live)setError(String(e))}};void refresh();const timer=setInterval(refresh,3000);return()=>{live=false;clearInterval(timer)}},[group,operatorId]);
 const send=async()=>{if(!draft.trim()||!group||sending)return;setSending(true);try{const r=await fetch(session+'/groups/'+encodeURIComponent(group)+'/messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:draft.trim()})});if(!r.ok)throw Error('Não foi possível enviar');setDraft('');setError('')}catch(e){setError(String(e))}finally{setSending(false)}};
 return <section className="card section" style={{padding:12,minHeight:330,display:'flex',flexDirection:'column',gap:8}}>
 <div className="section-head"><div><span className="eyebrow">GRUPO WHATSAPP</span><h3 style={{fontSize:16}}>Mensagens recebidas</h3></div><small>{status}</small></div>
 {newOrders>0?<div style={{background:'#263956',padding:8,borderRadius:8,display:'flex',justifyContent:'space-between',alignItems:'center'}}><strong style={{fontSize:12,color:'#9cc8ff'}}>🔔 {newOrders} novo(s) pedido(s)</strong><button className="btn ghost" onClick={()=>setNewOrders(0)}>Limpar aviso</button></div>:null}
 {!gateway?<small>Servidor WhatsApp ainda não configurado. O QR Code ficará disponível após a instalação da ponte local.</small>:null}
 {gateway&&status!=='conectado'?<button className="btn primary" disabled={connecting} onClick={()=>void connect()}>{connecting?'Conectando...':'Conectar meu WhatsApp'}</button>:null}
 {qr&&qr.startsWith('data:image/png;base64,')?<div style={{background:'#fff',padding:10,alignSelf:'center'}}><img src={qr} alt="QR Code para vincular seu WhatsApp" width={200} height={200}/><small style={{display:'block',color:'#111'}}>WhatsApp → Aparelhos conectados → Conectar aparelho</small></div>:null}
 {error?<small role="alert" style={{color:'#ff9292'}}>{error}</small>:null}
 {groups.length>1?<select aria-label="Grupo WhatsApp" value={group} onChange={e=>setGroup(e.target.value)}>{groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select>:<small>{groups.find(g=>g.id===group)?.name||'Aguardando grupo conectado'}</small>}
 <div style={{flex:1,minHeight:200,maxHeight:330,overflowY:'auto',display:'flex',flexDirection:'column',gap:8}}>
 {messages.length===0?<small style={{opacity:.7}}>As novas mensagens aparecerão aqui enquanto a Dashboard estiver aberta.</small>:null}
 {messages.map(m=><div key={m.id} style={{alignSelf:m.fromMe?'flex-end':'stretch',background:m.fromMe?'#174b49':'#263956',padding:'9px 10px',borderRadius:9}}>
 <div style={{fontWeight:700,fontSize:12}}>{m.sender||'Participante'}</div><div style={{fontSize:11,opacity:.8}}>{m.phone||'Número não informado'}</div>
 <div style={{whiteSpace:'pre-wrap',fontSize:13,marginTop:5}}>{m.text}</div><small style={{opacity:.7}}>{new Date(timeMs(m.timestamp)).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</small>
 </div>)}</div>
 <div style={{display:'flex',gap:6}}><input aria-label="Resposta WhatsApp" style={{flex:1,minWidth:0}} placeholder="Responder ao grupo..." value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')void send()}} disabled={!group||status!=='conectado'}/><button className="btn primary" disabled={!group||status!=='conectado'||sending||!draft.trim()} onClick={()=>void send()}>Enviar</button></div>
 </section>
}
