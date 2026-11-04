import {useEffect,useMemo,useRef,useState} from 'react';
import {invoke} from '@tauri-apps/api/core';
import {Activity,ArrowDownToLine,ArrowUpFromLine,Check,ClipboardCopy,Database,Download,FileSpreadsheet,Menu,Plus,RefreshCw,Save,Search,Settings2,Shuffle,Trash2,Wallet,X} from 'lucide-react';

type Order={id:number;created:string;client:string;phone:string;link:string;deposit:number;withdrawal:number;blogger:number};
type Input={client:string;phone:string;link:string;deposit:number;withdrawal:number;blogger:number};
const blank:Input={client:'',phone:'',link:'',deposit:0,withdrawal:0,blogger:0};
const currency=(v:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v);
const number=(v:string)=>Number(v.replace(/\./g,'').replace(',','.'))||0;
const cmd=<T,>(name:string,args?:Record<string,unknown>)=>invoke<T>(name,args);
function App(){
 const[orders,setOrders]=useState<Order[]>([]),[form,setForm]=useState<Input>(blank),[selected,setSelected]=useState<number|null>(null);
 const[notes,setNotes]=useState(''),[search,setSearch]=useState(''),[message,setMessage]=useState(''),[generator,setGenerator]=useState(false);
 const[genMin,setGenMin]=useState(11),[genMax,setGenMax]=useState(15),[genCount,setGenCount]=useState(10),[generated,setGenerated]=useState<number[]>([]);
 const[prices,setPrices]=useState<Record<string,number>>({}),[sigla,setSigla]=useState(''),[calc,setCalc]=useState(['','','','']);
 const[sidebar,setSidebar]=useState(true);
 const[splitWidth,setSplitWidth]=useState(0);
 const splitRef=useRef<HTMLDivElement>(null);
 const dragging=useRef(false);
 const startSplit=(e:React.PointerEvent<HTMLDivElement>)=>{dragging.current=true;e.currentTarget.setPointerCapture(e.pointerId)};
 const moveSplit=(e:React.PointerEvent<HTMLDivElement>)=>{if(!dragging.current||!splitRef.current)return;const rect=splitRef.current.getBoundingClientRect();setSplitWidth(Math.max(280,Math.min(rect.width-580,e.clientX-rect.left-9)))};
 const stopSplit=()=>{dragging.current=false};
 const resetSplit=()=>setSplitWidth(0);
 const refresh=async()=>{try{setOrders(await cmd<Order[]>('list_orders'))}catch(e){setMessage(String(e))}};
 useEffect(()=>{refresh();cmd<string>('get_notes').then(setNotes).catch(e=>setMessage(String(e)))},[]);
 useEffect(()=>{const timer=setTimeout(()=>cmd('set_notes',{text:notes}).catch(e=>setMessage(String(e))),700);return()=>clearTimeout(timer)},[notes]);
 const totals=useMemo(()=>orders.reduce((a,o)=>({deposit:a.deposit+o.deposit,withdrawal:a.withdrawal+o.withdrawal,blogger:a.blogger+o.blogger}),{deposit:0,withdrawal:0,blogger:0}),[orders]);
 const profit=totals.withdrawal+totals.blogger-totals.deposit;
 const filtered=orders.filter(o=>[o.client,o.phone,o.link].some(s=>s.toLowerCase().includes(search.toLowerCase())));
 const priceTotal=Object.entries(prices).reduce((a,[k,v])=>a+Number(k.slice(1))*(v||0),0);
 const save=async(e:React.FormEvent)=>{e.preventDefault();try{await cmd('save_order',{input:form,id:selected});setForm(blank);setSelected(null);await refresh();setMessage('Operação salva com sucesso')}catch(e){setMessage(String(e))}};
 const edit=(o:Order)=>{setSelected(o.id);setForm({client:o.client,phone:o.phone,link:o.link,deposit:o.deposit,withdrawal:o.withdrawal,blogger:o.blogger});window.scrollTo({top:0,behavior:'smooth'})};
 const remove=async(id:number)=>{if(!confirm('Excluir esta operação?'))return;try{await cmd('delete_order',{id});await refresh()}catch(e){setMessage(String(e))}};
 const closing=async()=>{if(!confirm('Exportar fechamento e limpar operações após salvar?'))return;try{const file=await cmd<string>('export_closing');await refresh();setMessage('Fechamento salvo: '+file)}catch(e){setMessage(String(e))}};
 const copyPix=async()=>{const text=`📌 PIX CELULAR\n💠 81995882238\n🏷️ MICAEL RICARDO\n\n💸 ${currency(priceTotal)}\n⚠️ MARCAR E ENVIAR O COMPROVANTE\n\n⏱️ Prazo para conclusão: de 30 min a 1h após o envio do comprovante.`;try{await navigator.clipboard.writeText(text);setMessage('Comanda copiada')}catch{setMessage('Não foi possível copiar')}};
 const make=()=>{if(genCount<1||genCount>500||genMin<0||genMax<genMin){setMessage('Confira os valores do gerador');return}setGenerated(Array.from({length:genCount},()=>Math.floor(Math.random()*(genMax-genMin+1))+genMin))};
 return <div className="shell">
 <aside className={sidebar?'sidebar':'sidebar collapsed'}>
  <div className="brand"><span className="brand-mark">▲</span><div><strong>PEAK</strong><small>DASHBOARD</small></div></div>
  <div className="nav-title">MENU PRINCIPAL</div>
  <button className="nav active"><Activity size={18}/> Visão geral</button>
  <button className="nav" onClick={()=>setGenerator(true)}><Shuffle size={18}/> Gerador de depósitos</button>
  <button className="nav" onClick={()=>cmd('open_data_folder').catch(e=>setMessage(String(e)))}><Database size={18}/> Arquivos e dados</button>
  <div className="sidebar-bottom"><span className="status-dot"/> Banco de dados local <small>Versão 11.0 · Prévia</small></div>
 </aside>
 <main className="main">
  <header className="topbar"><button className="icon-btn" title="Menu" onClick={()=>setSidebar(!sidebar)}><Menu size={19}/></button><div><div className="eyebrow">CENTRAL DE OPERAÇÕES</div><h1>Visão geral <span className="title-dot">.</span></h1></div><div className="top-actions"><span className="online"><span className="status-dot"/> Sistema local</span><button className="btn ghost" onClick={refresh}><RefreshCw size={16}/> Atualizar</button><button className="btn primary" onClick={closing}><FileSpreadsheet size={16}/> Fechamento diário</button></div></header>
  <div className="columns" ref={splitRef} style={splitWidth?{gridTemplateColumns:"minmax(280px, "+splitWidth+"px) 12px minmax(420px, 1fr)"}:undefined}>
   <div className="left-col">
    <section className="card section"><div className="section-head"><div><span className="eyebrow">REGISTRO</span><h3>{selected?'Editar operação':'Nova operação'}</h3></div><span className="head-icon"><Plus size={19}/></span></div>
     <form onSubmit={save} className="form-grid">
      <label>Depósito (saída)<input type="number" step="0.01" min="0" value={form.deposit||''} onChange={e=>setForm({...form,deposit:Number(e.target.value)})} placeholder="0,00"/></label>
      <label>Saque (entrada)<input type="number" step="0.01" min="0" value={form.withdrawal||''} onChange={e=>setForm({...form,withdrawal:Number(e.target.value)})} placeholder="0,00"/></label>
      <label>Blogueira (valor pago)<input type="number" step="0.01" min="0" value={form.blogger||''} onChange={e=>setForm({...form,blogger:Number(e.target.value)})} placeholder="0,00"/></label>
      <label>Nome da cliente<input required value={form.client} onChange={e=>setForm({...form,client:e.target.value})} placeholder="Nome completo"/></label>
      <label>Telefone<input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="(81) 99999-9999"/></label>
      <label>Link da conta<input value={form.link} onChange={e=>setForm({...form,link:e.target.value})} placeholder="https://..."/></label>
      <button className="btn primary submit" type="submit"><Save size={17}/>{selected?'Salvar alterações':'Salvar operação'}</button>
      {selected&&<button className="btn ghost submit" type="button" onClick={()=>{setSelected(null);setForm(blank)}}><X size={16}/> Cancelar edição</button>}
     </form><div className="operation-net" aria-live="polite"><span>Lucro líquido estimado</span><strong className={form.withdrawal+form.blogger-form.deposit<0?'net-negative':'net-positive'}>{currency(form.withdrawal+form.blogger-form.deposit)}</strong></div></section>
    <section className="card section"><div className="section-head"><div><span className="eyebrow">FERRAMENTAS</span><h3>Calculadora rápida</h3></div></div><div className="calc-grid">{['Depósitos','Saques'].map((label,i)=><div key={label}><label>{label}</label><input placeholder="0,00" value={calc[i*2]} onChange={e=>setCalc(a=>a.map((v,j)=>j===i*2?e.target.value:v))}/><input placeholder="0,00" value={calc[i*2+1]} onChange={e=>setCalc(a=>a.map((v,j)=>j===i*2+1?e.target.value:v))}/><strong>{currency(number(calc[i*2])+number(calc[i*2+1]))}</strong></div>)}</div></section>
    <section className="card section notes-card"><div className="section-head"><div><span className="eyebrow">ANOTAÇÕES</span><h3>Bloco de notas</h3></div><button className="text-btn" onClick={()=>setNotes('')}>Limpar</button></div><textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Suas anotações ficam salvas automaticamente..."/><small>↘ Arraste o canto inferior direito para redimensionar</small></section>
   </div>
   <div className="column-resizer" role="separator" title="Arraste para ajustar a largura. Clique duas vezes para restaurar." onPointerDown={startSplit} onPointerMove={moveSplit} onPointerUp={stopSplit} onLostPointerCapture={stopSplit} onDoubleClick={resetSplit}><span/></div>
   <div className="right-col">
  <section className="card section commands-top"><div className="section-head"><div><span className="eyebrow">COMANDAS</span><h3>Dragão & Pinguim</h3></div></div>
   <div className="commands-layout">
    <div className="price-group"><h4 className="green">🐉 Dragão</h4><div className="price-inputs">{['D5','D7','D9','D11'].map(t=><label key={t}>{t}<input type="number" min="0" value={prices[t]||''} onChange={e=>setPrices(p=>({...p,[t]:Number(e.target.value)}))} placeholder="0"/></label>)}</div></div>
    <div className="commands-center"><input aria-label="Consultar sigla" value={sigla} onChange={e=>setSigla(e.target.value)} placeholder="CONSULTAR SIGLA (EX: 777)"/><span>Soma Total</span><div className="commands-center-bottom"><strong>{currency(priceTotal)}</strong><button className="btn primary copy-compact" title="Copiar PIX" aria-label="Copiar PIX" onClick={copyPix}><ClipboardCopy size={17}/></button></div></div>
    <div className="price-group"><h4 className="blue">🐧 Pinguim</h4><div className="price-inputs">{['P6','P8'].map(t=><label key={t}>{t}<input type="number" min="0" value={prices[t]||''} onChange={e=>setPrices(p=>({...p,[t]:Number(e.target.value)}))} placeholder="0"/></label>)}</div></div>
   </div>
  </section>

  <section className="metrics metrics-in-column">
   {([{title:'Depósitos',value:totals.deposit,color:'blue',icon:ArrowDownToLine},{title:'Saques',value:totals.withdrawal,color:'amber',icon:ArrowUpFromLine},{title:'Blogueiras',value:totals.blogger,color:'purple',icon:Wallet},{title:'Lucro líquido',value:profit,color:profit<0?'red':'green',icon:Activity}] as const).map(x=><div className={'metric card '+x.color} key={x.title}><div className="metric-top"><span>{x.title}</span><x.icon size={19}/></div><strong>{currency(x.value)}</strong><small>Acumulado de operações</small></div>)}
  </section>
    <section className="card section records"><div className="section-head"><div><span className="eyebrow">HISTÓRICO</span><h3>Pedidos registrados <span className="count">{orders.length}</span></h3></div><div className="search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar cliente..."/></div></div><div className="table-wrap"><table><thead><tr><th>Cliente</th><th>Link</th><th>Depósito</th><th>Saque</th><th>Blogueira</th><th>Lucro</th><th></th></tr></thead><tbody>{filtered.map(o=><tr key={o.id}><td><strong>{o.client}</strong><small>{o.phone}</small></td><td className="link-cell">{o.link}</td><td>{currency(o.deposit)}</td><td>{currency(o.withdrawal)}</td><td>{currency(o.blogger)}</td><td className={o.withdrawal+o.blogger-o.deposit>=0?'green':'red'}>{currency(o.withdrawal+o.blogger-o.deposit)}</td><td><div className="row-actions"><button title="Editar" onClick={()=>edit(o)}><Settings2 size={15}/></button><button title="Excluir" onClick={()=>remove(o.id)}><Trash2 size={15}/></button></div></td></tr>)}{!filtered.length&&<tr><td colSpan={7} className="empty">Nenhuma operação encontrada.</td></tr>}</tbody></table></div></section>
   </div>
  </div>
  {message&&<div className="toast" role="status"><span>{message}</span><button onClick={()=>setMessage('')}><X size={15}/></button></div>}
  {generator&&<div className="overlay" onClick={()=>setGenerator(false)}><div className="modal card" onClick={e=>e.stopPropagation()}><div className="section-head"><div><span className="eyebrow">FERRAMENTAS</span><h3>Gerador de depósitos</h3></div><button className="icon-btn" onClick={()=>setGenerator(false)}><X size={18}/></button></div><div className="gen-grid"><label>Mínimo<input type="number" value={genMin} onChange={e=>setGenMin(+e.target.value)}/></label><label>Máximo<input type="number" value={genMax} onChange={e=>setGenMax(+e.target.value)}/></label><label>Quantidade<input type="number" value={genCount} onChange={e=>setGenCount(+e.target.value)}/></label></div><button className="btn primary" onClick={make}><Shuffle size={16}/> Gerar valores</button><textarea readOnly value={generated.join('\n')} placeholder="Os depósitos aparecerão aqui..."/><div className="modal-footer"><strong>{generated.length} depósitos · {currency(generated.reduce((a,b)=>a+b,0))}</strong><button className="btn secondary" onClick={()=>navigator.clipboard.writeText(generated.join('\n')).then(()=>setMessage('Lista copiada')).catch(()=>setMessage('Não foi possível copiar'))}><ClipboardCopy size={16}/> Copiar</button></div></div></div>}
 </main></div>
}
export default App;