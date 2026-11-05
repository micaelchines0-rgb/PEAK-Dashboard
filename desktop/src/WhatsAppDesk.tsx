import {useEffect,useState} from 'react';
import './WhatsAppDesk.css';
type Msg={id:string;sender:string;phone:string;body:string;at:string;quantity:number|null;order:boolean;done:boolean};
const storageKey='peak-whatsapp-v1121-preview';
function classify(body:string){const match=body.match(/\b(\d{1,5})\s*contas?\b|\bcontas?\s*(?:de\s*)?(\d{1,5})\b/i);const quantity=match?Number(match[1]||match[2]):null;const link=/(?:https?:\/\/|www\.)\S+/i.test(body);return{quantity,order:quantity!==null||link};}
function alertSound(){try{const ctx=new AudioContext();const o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.setValueAtTime(740,ctx.currentTime);o.frequency.setValueAtTime(990,ctx.currentTime+.12);g.gain.setValueAtTime(.10,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.32);o.connect(g);g.connect(ctx.destination);o.start();o.stop(ctx.currentTime+.33);o.onended=()=>void ctx.close()}catch{}}
export default function WhatsAppDesk(){
 const [items,setItems]=useState<Msg[]>(()=>{try{return JSON.parse(localStorage.getItem(storageKey)||'[]')}catch{return[]}});
 const [sender,setSender]=useState('Blogueira teste'),[phone,setPhone]=useState('(81) 99999-0000'),[body,setBody]=useState('Preciso de 5 contas'),[sound,setSound]=useState(true);
 useEffect(()=>{localStorage.setItem(storageKey,JSON.stringify(items))},[items]);
 const pending=items.filter(x=>x.order&&!x.done);
 function receive(text=body){if(!text.trim())return;const result=classify(text);const entry:Msg={id:crypto.randomUUID(),sender:sender.trim()||'Sem nome',phone:phone.trim()||'Sem telefone',body:text,at:new Date().toISOString(),...result,done:false};setItems(old=>[...old,entry].slice(-200));if(result.order&&sound)alertSound();}
 return <section className="wa-desk" aria-label="Central WhatsApp em modo de teste">
  <div className="wa-title"><div><span className="eyebrow">CENTRAL DE MENSAGENS</span><h3>WhatsApp • Pedidos</h3></div><span className="wa-preview">MODO TESTE — SEM CONEXÃO REAL</span></div>
  <div className="wa-columns">
   <section className="wa-panel"><h4>Simulador de recebimento</h4><p>Teste os pedidos sem acessar o WhatsApp.</p><label>Nome da blogueira<input value={sender} onChange={e=>setSender(e.target.value)}/></label><label>Número<input value={phone} onChange={e=>setPhone(e.target.value)}/></label><label>Mensagem<textarea rows={3} value={body} onChange={e=>setBody(e.target.value)}/></label><button className="btn primary" onClick={()=>receive()}>Simular mensagem</button><button className="btn ghost" onClick={()=>receive('https://exemplo.com/pedido-teste')}>Testar link</button><label className="wa-sound"><input type="checkbox" checked={sound} onChange={e=>setSound(e.target.checked)}/> Som de novo pedido</label><button className="btn ghost" onClick={()=>{if(window.confirm('Apagar apenas as mensagens simuladas?'))setItems([])}}>Limpar testes</button><p className="wa-hint">QR Code, número PEAK e respostas por operadores exigem integração autorizada com WhatsApp e não estão ativos nesta prévia.</p></section>
   <section className="wa-panel"><h4>Pedidos pendentes <span>{pending.length}</span></h4><p>Mensagens com links ou quantidades de contas.</p>{pending.length===0?<div className="wa-empty">Nenhum pedido pendente</div>:[...pending].reverse().map(m=><article className="wa-item wa-order" key={m.id}><b>{m.sender}</b><small>{m.phone}</small><p>{m.body}</p><em>{m.quantity!==null?m.quantity+' contas':'Link detectado'}</em><button className="btn primary" onClick={()=>setItems(prev=>prev.map(x=>x.id===m.id?{...x,done:true}:x))}>Concluir pedido</button></article>)}</section>
   <section className="wa-panel"><h4>Mensagens do grupo</h4><p>Nome, telefone e horário do remetente.</p>{items.length===0?<div className="wa-empty">Aguardando mensagens de teste</div>:[...items].reverse().map(m=><article className="wa-item" key={m.id}><b>{m.sender}</b><small>{m.phone} • {new Date(m.at).toLocaleString('pt-BR')}</small><p>{m.body}</p>{m.order&&<em>{m.done?'Pedido concluído':'Novo pedido identificado'}</em>}</article>)}</section>
  </div>
 </section>;
}
